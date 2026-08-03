import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "./config";
import { connectDatabase, isDatabaseReady } from "./db";
import { requireAdminAuth, AuthRequest } from "./middleware/auth";
import { requireAdminPermission } from "./middleware/adminPermissions";
import { backgroundUpload, logoUpload, paypalQrUpload, vietqrUpload } from "./middleware/logoUpload";
import { MeaningModel } from "./models/Meaning";
import {
  getPaymentSettingsFromDb,
  readLocalPaymentSettings,
  upsertPaymentSettingsDb,
  writeLocalPaymentSettings,
  type PaymentSettingsPayload
} from "./services/paymentSettingsStore";
import {
  defaultThemeSettings,
  loadThemeOverrides,
  normalizeThemePayload,
  upsertThemeSettingsDb,
  writeLocalThemeSettings,
  type ThemeSettingsPayload
} from "./services/themeSettingsStore";
import { generateNatalChart } from "./services/chartService";
import { calculateNatalTransits } from "./services/transitService";
import { calculateSynastry } from "./services/synastryService";
import { ensureDefaultAdminUser, ensureDefaultLocalAdminUser, countAdminUsers, createAdminUser, deleteAdminUser, getAdminProfileById, listAdminUsers, updateAdminUserAccess, verifyAdminCredentials } from "./services/adminService";
import {
  ADMIN_ROLES,
  MEMBER_ASSIGNABLE_PERMISSIONS,
  effectivePermissions,
  sanitizeMemberPermissions,
  type AdminPermission
} from "./types/adminRoles";
import {
  createLocalMeaning,
  deleteLocalMeaning,
  listLocalMeanings,
  replaceLocalMeanings,
  updateLocalMeaning
} from "./services/localCmsStore";
import {
  createVietQrSession,
  extractWebhookTransfer,
  getVietQrSession,
  listPendingVietQrSessions,
  markVietQrSessionPaid,
  matchAndPayVietQrTransfer,
  extractWebhookTransfers
} from "./services/vietqrPaymentStore";
import {
  buildChartInterpretationExport,
  buildExportFilename,
  formatChartInterpretationPdf
} from "./services/chartInterpretationExport";

const router = express.Router();
const ASPECT_ACCESS_SCOPE = "aspect_meanings";

function adminPerm(...permissions: AdminPermission[]) {
  return [requireAdminAuth, requireAdminPermission(...permissions)];
}

const chartInputSchema = z.object({
  date: z.string().min(1),
  time: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().min(1)
});

const localizedSchema = z.union([
  z.string().min(1),
  z.object({
    en: z.string().optional().default(""),
    vi: z.string().optional().default("")
  }).refine((value) => value.en.trim().length > 0 || value.vi.trim().length > 0, {
    message: "At least one language is required"
  })
]);
const paymentConfirmSchema = z.object({
  method: z.enum(["vietqr", "paypal"]),
  transferContent: z.string().optional().default("")
});

const paymentSettingsBodySchema = z.object({
  vietqrImageUrl: z.string().optional().default(""),
  vietqrInstructionsVi: z.string().optional().default(""),
  vietqrInstructionsEn: z.string().optional().default(""),
  /** PayPal hosted checkout / button URL; empty = use env PAYPAL_UNLOCK_URL */
  paypalUnlockUrl: z.string().optional().default(""),
  paypalQrImageUrl: z.string().optional().default(""),
  /** 0 = use ASPECT_ACCESS_PRICE from env */
  aspectUnlockPriceVnd: z.coerce.number().int().min(0).optional().default(0),
  /** 0 = use ASPECT_ACCESS_PRICE_USD from env */
  aspectUnlockPriceUsd: z.coerce.number().min(0).optional().default(0)
});

const themeSettingsBodySchema = z.object({
  logoUrl: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
  siteTitle: z.string().optional(),
  backgroundColor: z.string().optional(),
  surfaceColor: z.string().optional(),
  panelBorderColor: z.string().optional(),
  bodyTextColor: z.string().optional(),
  mutedTextColor: z.string().optional(),
  headingTextColor: z.string().optional(),
  linkColor: z.string().optional(),
  linkHoverColor: z.string().optional(),
  warningTextColor: z.string().optional(),
  errorTextColor: z.string().optional(),
  fontBody: z.string().optional(),
  fontHeading: z.string().optional(),
  fontUi: z.string().optional(),
  fontLink: z.string().optional(),
  fontWarning: z.string().optional(),
  fontCode: z.string().optional(),
  aspectColorConjunction: z.string().optional(),
  aspectColorSextile: z.string().optional(),
  aspectColorSquare: z.string().optional(),
  aspectColorTrine: z.string().optional(),
  aspectColorOpposition: z.string().optional(),
  fontChartSign: z.string().optional(),
  fontChartPlanet: z.string().optional()
});

async function loadPaymentOverrides(): Promise<PaymentSettingsPayload> {
  const dbReady = isDatabaseReady();
  if (dbReady) {
    const fromDb = await getPaymentSettingsFromDb();
    if (fromDb) {
      return fromDb;
    }
  }
  return readLocalPaymentSettings();
}

/** CMS / data file URL overrides `PAYPAL_UNLOCK_URL` when set. */
async function resolveEffectivePaypalUnlockUrl(): Promise<string> {
  const overrides = await loadPaymentOverrides();
  const fromCms = overrides.paypalUnlockUrl.trim();
  if (fromCms) return fromCms;
  if (config.paypalUnlockUrl.trim()) return config.paypalUnlockUrl;
  if (config.paypalHostedButtonId.trim()) {
    return `https://www.paypal.com/ncp/payment/${encodeURIComponent(config.paypalHostedButtonId)}`;
  }
  return "";
}

function resolveAspectPrices(overrides: PaymentSettingsPayload): { vnd: number; usd: number; currency: string } {
  const vnd =
    typeof overrides.aspectUnlockPriceVnd === "number" &&
    Number.isFinite(overrides.aspectUnlockPriceVnd) &&
    overrides.aspectUnlockPriceVnd > 0
      ? Math.floor(overrides.aspectUnlockPriceVnd)
      : config.aspectAccessPrice;
  const usd =
    typeof overrides.aspectUnlockPriceUsd === "number" &&
    Number.isFinite(overrides.aspectUnlockPriceUsd) &&
    overrides.aspectUnlockPriceUsd > 0
      ? overrides.aspectUnlockPriceUsd
      : config.aspectAccessPriceUsd;
  return { vnd, usd, currency: config.aspectAccessCurrency };
}

function normalizeLocalized(value: unknown): { en: string; vi: string } {
  if (typeof value === "string") {
    return { en: value, vi: value };
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as { en?: unknown; vi?: unknown };
    const en = typeof obj.en === "string" ? obj.en.trim() : "";
    const vi = typeof obj.vi === "string" ? obj.vi.trim() : "";
    if (en || vi) {
      return { en: en || vi, vi: vi || en };
    }
  }
  return { en: "", vi: "" };
}

function mapMeaningResponse(item: any) {
  return {
    ...item.toObject(),
    title: normalizeLocalized(item.title),
    content: normalizeLocalized(item.content)
  };
}

function createAspectAccessToken() {
  return jwt.sign({ scope: ASPECT_ACCESS_SCOPE }, config.jwtSecret, {
    expiresIn: `${config.aspectAccessTtlMinutes}m`
  });
}

function hasAspectAccess(token: unknown): boolean {
  if (typeof token !== "string" || !token.trim()) {
    return false;
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    return payload.scope === ASPECT_ACCESS_SCOPE;
  } catch {
    return false;
  }
}

async function ensureDatabase(_res: express.Response): Promise<boolean> {
  if (isDatabaseReady()) {
    return true;
  }
  const reconnected = await connectDatabase();
  if (reconnected) {
    await ensureDefaultAdminUser();
  }
  return reconnected;
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, databaseReady: isDatabaseReady() });
});

/** Public branding / theme for the storefront (no auth). */
router.get("/theme-settings", async (_req, res) => {
  try {
    const theme = await loadThemeOverrides();
    res.json(theme);
  } catch {
    res.json(defaultThemeSettings);
  }
});

const adminSetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters")
});

const memberPermissionSchema = z.enum(
  MEMBER_ASSIGNABLE_PERMISSIONS as unknown as [AdminPermission, ...AdminPermission[]]
);

const adminUserCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(ADMIN_ROLES).optional().default("member"),
  permissions: z.array(memberPermissionSchema).optional().default([])
});

const adminUserAccessSchema = z.object({
  role: z.enum(ADMIN_ROLES),
  permissions: z.array(memberPermissionSchema).optional().default([])
});

router.get("/auth/setup-status", async (_req, res) => {
  const databaseReady = isDatabaseReady();
  let hasAdminUsers = false;
  try {
    hasAdminUsers = (await countAdminUsers()) > 0;
  } catch {
    hasAdminUsers = false;
  }
  res.json({
    databaseReady,
    hasAdminUsers,
    setupAvailable: !hasAdminUsers,
    message: hasAdminUsers
      ? "Sign in with an existing admin account."
      : "First admin setup is available."
  });
});

router.post("/auth/setup", async (req, res) => {
  const parsed = adminSetupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const existingCount = await countAdminUsers();
    if (existingCount > 0) {
      res.status(403).json({
        error: "An admin account already exists. Sign in or ask an existing admin to create your account."
      });
      return;
    }

    const created = await createAdminUser(parsed.data.email, parsed.data.password, "admin", []);
    const token = jwt.sign({ sub: created.id, role: "admin" }, config.jwtSecret, { expiresIn: "8h" });
    res.status(201).json({
      token,
      role: "admin",
      permissions: effectivePermissions("admin", []),
      message: "Admin account created. You are logged in."
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "EMAIL_IN_USE") {
      res.status(409).json({ error: "An admin with this email already exists." });
      return;
    }
    const message = err instanceof Error ? err.message : "Setup failed.";
    res.status(500).json({ error: message });
  }
});

router.post("/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid credentials payload" });
    return;
  }

  const email = parsed.data.email.toLowerCase();
  await ensureDatabase(res);

  const { valid, subject, role, permissions } = await verifyAdminCredentials(email, parsed.data.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid email/password" });
    return;
  }

  const token = jwt.sign({ sub: subject, role }, config.jwtSecret, { expiresIn: "8h" });
  res.json({ token, role, permissions });
});

router.get("/auth/me", requireAdminAuth, async (req: AuthRequest, res) => {
  if (!req.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const profile = await getAdminProfileById(req.adminId);
  if (!profile) {
    res.status(404).json({ error: "Admin user not found." });
    return;
  }
  res.json(profile);
});

router.post("/generate-chart", async (req, res) => {
  const parsed = chartInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const chart = generateNatalChart(parsed.data);
    res.json({ chart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate chart.";
    res.status(400).json({ error: message });
  }
});

const transitInputSchema = chartInputSchema.extend({
  transitDate: z.string().min(1),
  transitTime: z.string().min(1),
  transitTimezone: z.string().min(1).optional(),
  transitCity: z.string().min(1).optional(),
  transitCountry: z.string().min(1).optional(),
  transitLatitude: z.number().optional(),
  transitLongitude: z.number().optional()
});

router.post("/transits", async (req, res) => {
  const parsed = transitInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { transitDate, transitTime, transitTimezone, transitCity, transitCountry, transitLatitude, transitLongitude, ...natal } =
    parsed.data;

  try {
    const result = calculateNatalTransits({
      natal,
      transitDate,
      transitTime,
      transitTimezone,
      transitCity,
      transitCountry,
      transitLatitude,
      transitLongitude
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate transits.";
    res.status(400).json({ error: message });
  }
});

const synastryPersonSchema = chartInputSchema.extend({
  label: z.string().trim().min(1).max(40).optional()
});

const synastryInputSchema = z.object({
  personA: synastryPersonSchema,
  personB: synastryPersonSchema
});

router.post("/synastry", async (req, res) => {
  const parsed = synastryInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = calculateSynastry(parsed.data);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate synastry.";
    res.status(400).json({ error: message });
  }
});

const chartExportSchema = chartInputSchema.extend({
  chartImage: z.string().optional()
});

async function sendChartInterpretationPdf(
  res: express.Response,
  chartInput: z.infer<typeof chartInputSchema>,
  options: { chartImage?: string; includeAspects: boolean }
): Promise<void> {
  const chart = generateNatalChart(chartInput);
  const dbReady = await ensureDatabase(res);
  const exportData = await buildChartInterpretationExport(chart, dbReady, {
    includeAspects: options.includeAspects
  });
  const filename = buildExportFilename(chart.birth.date);
  const pdfBuffer = await formatChartInterpretationPdf(exportData, options.chartImage);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
}

router.post("/charts/export-interpretations-pdf", async (req, res) => {
  const schema = chartExportSchema.extend({
    aspectAccessToken: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { chartImage, aspectAccessToken, ...chartInput } = parsed.data;
  const includeAspects = hasAspectAccess(aspectAccessToken);

  try {
    await sendChartInterpretationPdf(res, chartInput, { chartImage, includeAspects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export chart interpretations.";
    res.status(400).json({ error: message });
  }
});

router.post("/cms/charts/export-interpretations", ...adminPerm("preview:access"), async (req, res) => {
  const parsed = chartExportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { chartImage, ...chartInput } = parsed.data;

  try {
    await sendChartInterpretationPdf(res, chartInput, { chartImage, includeAspects: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export chart interpretations.";
    res.status(400).json({ error: message });
  }
});

router.get("/payments/aspect/options", async (_req, res) => {
  await ensureDatabase(res);
  const overrides = await loadPaymentOverrides();
  const prices = resolveAspectPrices(overrides);
  const qrImageUrl = overrides.vietqrImageUrl.trim() || config.vietQrQrImageUrl;
  const paypalRedirect = await resolveEffectivePaypalUnlockUrl();
  const callbackUrl = `${config.frontendUrl}${config.paypalReturnPath}`;
  res.json({
    vietqr: {
      transferPrefix: config.vietQrTransferContent,
      amount: prices.vnd,
      currency: prices.currency,
      qrImageUrl,
      instructionsVi: overrides.vietqrInstructionsVi.trim(),
      instructionsEn: overrides.vietqrInstructionsEn.trim(),
      sessionTtlMinutes: config.vietQrSessionTtlMinutes,
      webhookConfigured: Boolean(config.vietQrWebhookApiKey.trim())
    },
    paypal: {
      amount: prices.usd,
      currency: config.paypalCurrency,
      redirectUrl: paypalRedirect,
      startUrl: "/api/payments/aspect/paypal/start",
      callbackUrl,
      qrImageUrl: overrides.paypalQrImageUrl.trim(),
      clientId: config.paypalClientId,
      hostedButtonId: config.paypalHostedButtonId
    }
  });
});

router.post("/payments/aspect/vietqr/session", async (_req, res) => {
  await ensureDatabase(res);
  const overrides = await loadPaymentOverrides();
  const prices = resolveAspectPrices(overrides);
  const session = await createVietQrSession({
    transferPrefix: config.vietQrTransferContent,
    amount: prices.vnd,
    currency: prices.currency,
    ttlMinutes: config.vietQrSessionTtlMinutes
  });
  res.json({
    sessionId: session.sessionId,
    transferContent: session.transferContent,
    amount: session.amount,
    currency: session.currency,
    expiresAt: session.expiresAt,
    qrImageUrl: overrides.vietqrImageUrl.trim() || config.vietQrQrImageUrl,
    instructionsVi: overrides.vietqrInstructionsVi.trim(),
    instructionsEn: overrides.vietqrInstructionsEn.trim()
  });
});

router.get("/payments/aspect/vietqr/status", async (req, res) => {
  const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const session = await getVietQrSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "Payment session not found" });
    return;
  }
  res.json({
    status: session.status,
    accessToken: session.status === "paid" ? session.accessToken ?? null : null,
    expiresAt: session.expiresAt,
    paidAt: session.paidAt ?? null
  });
});

function verifyVietQrWebhookAuth(req: express.Request): boolean {
  const expected = config.vietQrWebhookApiKey.trim();
  if (!expected) return false;
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization.trim() : "";
  if (
    authHeader === `Apikey ${expected}` ||
    authHeader.toLowerCase() === `apikey ${expected.toLowerCase()}` ||
    authHeader === `Bearer ${expected}`
  ) {
    return true;
  }
  const secureToken = req.headers["secure-token"];
  if (typeof secureToken === "string" && secureToken === expected) return true;
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey === expected) return true;
  return false;
}

router.post("/payments/aspect/vietqr/webhook", async (req, res) => {
  if (!config.vietQrWebhookApiKey.trim()) {
    res.status(503).json({
      error: "VIETQR_WEBHOOK_API_KEY is not configured on the server."
    });
    return;
  }
  if (!verifyVietQrWebhookAuth(req)) {
    res.status(401).json({ error: "Unauthorized webhook" });
    return;
  }

  const transfers = extractWebhookTransfers(req.body);
  if (transfers.length === 0) {
    res.status(400).json({ error: "Unrecognized webhook payload" });
    return;
  }

  for (const item of transfers) {
    const paid = await matchAndPayVietQrTransfer({
      description: item.description,
      amount: item.amount,
      createAccessToken: createAspectAccessToken
    });
    if (paid) {
      res.json({ matched: true, sessionId: paid.sessionId });
      return;
    }
  }

  console.warn(
    "[vietqr-webhook] no pending session matched",
    JSON.stringify({ transfers, sample: transfers[0] ?? null }).slice(0, 500)
  );
  res.status(202).json({ matched: false });
});

router.get("/payments/aspect/paypal/start", async (_req, res) => {
  const hostedUrl = await resolveEffectivePaypalUnlockUrl();
  if (!hostedUrl) {
    res.status(400).json({ error: "PayPal URL is not configured. Set it in Admin → Payment or PAYPAL_UNLOCK_URL." });
    return;
  }
  // Hosted PayPal buttons configure return/cancel URLs in the PayPal dashboard.
  // Appending return params here breaks checkout for NCP / hosted-button links.
  res.redirect(hostedUrl);
});

router.get("/payments/aspect/paypal/callback", (req, res) => {
  const hasReference = ["paymentId", "PayerID", "token", "tx"].some((key) => typeof req.query[key] === "string");
  if (!hasReference) {
    const failedUrl = new URL(`${config.frontendUrl}${config.paypalReturnPath}`);
    failedUrl.searchParams.set("paypal", "failed");
    res.redirect(failedUrl.toString());
    return;
  }

  const accessToken = createAspectAccessToken();
  const successUrl = new URL(`${config.frontendUrl}${config.paypalReturnPath}`);
  successUrl.searchParams.set("paypal", "success");
  successUrl.searchParams.set("aspectAccessToken", accessToken);
  res.redirect(successUrl.toString());
});

router.post("/payments/aspect/confirm", async (req, res) => {
  const parsed = paymentConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payment confirmation payload" });
    return;
  }

  if (parsed.data.method === "vietqr") {
    res.status(400).json({
      error: "VietQR unlock requires a verified bank transfer. Create a payment session and wait for webhook confirmation."
    });
    return;
  }

  if (parsed.data.method === "paypal") {
    const paypalUrl = await resolveEffectivePaypalUnlockUrl();
    if (!paypalUrl) {
      res.status(400).json({ error: "PayPal is not configured yet." });
      return;
    }
    res.status(400).json({
      error: "PayPal unlock is completed through the PayPal return callback, not manual confirmation."
    });
    return;
  }

  res.status(400).json({ error: "Unsupported payment method." });
});

router.post("/payments/aspect/unlock", (_req, res) => {
  res.status(410).json({ error: "Deprecated. Use /payments/aspect/options + /payments/aspect/confirm." });
});

router.get("/payments/aspect/status", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!hasAspectAccess(token)) {
    res.json({ unlocked: false });
    return;
  }
  await ensureDatabase(res);
  const overrides = await loadPaymentOverrides();
  const prices = resolveAspectPrices(overrides);
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  const expiresAt = typeof decoded?.exp === "number" ? new Date(decoded.exp * 1000).toISOString() : null;
  res.json({
    unlocked: true,
    expiresAt,
    amount: prices.vnd,
    currency: prices.currency
  });
});

router.get("/meanings/public", async (req, res) => {
  const dbReady = await ensureDatabase(res);
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const keysRaw = typeof req.query.keys === "string" ? req.query.keys : "";
  const keys = keysRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const filter: Record<string, unknown> = {};
  if (category) {
    filter.category = category;
  }
  if (keys.length) {
    filter.key = { $in: keys };
  }

  const aspectAccessToken = typeof req.query.aspectAccessToken === "string" ? req.query.aspectAccessToken : "";
  const aspectUnlocked = hasAspectAccess(aspectAccessToken);

  if (dbReady) {
    const items = await MeaningModel.find(filter).sort({ category: 1, key: 1 });
    const mapped = items.map(mapMeaningResponse);
    res.json(aspectUnlocked ? mapped : mapped.filter((item) => item.category !== "aspect"));
    return;
  }

  const items = await listLocalMeanings({ category, keys });
  res.json(aspectUnlocked ? items : items.filter((item) => item.category !== "aspect"));
});

router.get("/cms/meanings", ...adminPerm("cms:read"), async (req, res) => {
  const dbReady = await ensureDatabase(res);
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  if (dbReady) {
    const filter = category ? { category } : {};
    const items = await MeaningModel.find(filter).sort({ category: 1, key: 1 });
    res.json(items.map(mapMeaningResponse));
    return;
  }

  const items = await listLocalMeanings({ category });
  res.json(items);
});

router.post("/cms/meanings", ...adminPerm("cms:write"), async (req, res) => {
  const dbReady = await ensureDatabase(res);
  const schema = z.object({
    category: z.enum(["planet_sign", "planet_house", "aspect", "house", "house_sign"]),
    key: z.string().min(1),
    title: localizedSchema,
    content: localizedSchema
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const normalized = {
    ...parsed.data,
    title: normalizeLocalized(parsed.data.title),
    content: normalizeLocalized(parsed.data.content)
  };

  if (dbReady) {
    const created = await MeaningModel.create(normalized);
    res.status(201).json(mapMeaningResponse(created));
    return;
  }

  const created = await createLocalMeaning(normalized);
  res.status(201).json(created);
});

router.put("/cms/meanings/:id", ...adminPerm("cms:write"), async (req, res) => {
  const dbReady = await ensureDatabase(res);
  const schema = z.object({
    category: z.enum(["planet_sign", "planet_house", "aspect", "house", "house_sign"]),
    key: z.string().min(1),
    title: localizedSchema,
    content: localizedSchema
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const normalized = {
    ...parsed.data,
    title: normalizeLocalized(parsed.data.title),
    content: normalizeLocalized(parsed.data.content)
  };

  if (dbReady) {
    const updated = await MeaningModel.findByIdAndUpdate(req.params.id, normalized, { new: true });
    if (!updated) {
      res.status(404).json({ error: "Meaning not found" });
      return;
    }
    res.json(mapMeaningResponse(updated));
    return;
  }

  const updated = await updateLocalMeaning(String(req.params.id), normalized);
  if (!updated) {
    res.status(404).json({ error: "Meaning not found" });
    return;
  }
  res.json(updated);
});

router.delete("/cms/meanings/:id", ...adminPerm("cms:write"), async (req, res) => {
  const dbReady = await ensureDatabase(res);
  if (dbReady) {
    const deleted = await MeaningModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Meaning not found" });
      return;
    }
    res.status(204).send();
    return;
  }

  const deleted = await deleteLocalMeaning(String(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: "Meaning not found" });
    return;
  }
  res.status(204).send();
});

router.get("/cms/export", ...adminPerm("backup:manage"), async (_req, res) => {
  const dbReady = await ensureDatabase(res);
  if (dbReady) {
    const meanings = await MeaningModel.find().sort({ category: 1, key: 1 });
    res.json({
      exportedAt: new Date().toISOString(),
      meanings: meanings.map(mapMeaningResponse)
    });
    return;
  }

  const meanings = await listLocalMeanings();
  res.json({ exportedAt: new Date().toISOString(), meanings });
});

router.get("/cms/backup", ...adminPerm("backup:manage"), async (_req, res) => {
  const dbReady = await ensureDatabase(res);
  const exportedAt = new Date().toISOString();
  const paymentSettings = await loadPaymentOverrides();
  const themeSettings = await loadThemeOverrides();

  if (dbReady) {
    const meanings = await MeaningModel.find().sort({ category: 1, key: 1 });
    res.json({
      exportedAt,
      source: "database",
      meanings: meanings.map(mapMeaningResponse),
      paymentSettings,
      themeSettings
    });
    return;
  }

  const meanings = await listLocalMeanings();
  res.json({
    exportedAt,
    source: "local-file",
    meanings,
    paymentSettings,
    themeSettings
  });
});

router.post("/cms/import", ...adminPerm("backup:manage"), async (req, res) => {
  const dbReady = await ensureDatabase(res);
  const schema = z.object({
    meanings: z.array(
      z.object({
        category: z.enum(["planet_sign", "planet_house", "aspect", "house", "house_sign"]),
        key: z.string(),
        title: localizedSchema,
        content: localizedSchema
      })
    )
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const normalized = parsed.data.meanings.map((meaning) => ({
    ...meaning,
    title: normalizeLocalized(meaning.title),
    content: normalizeLocalized(meaning.content)
  }));

  if (dbReady) {
    await MeaningModel.deleteMany({});
    await MeaningModel.insertMany(normalized);
  } else {
    await replaceLocalMeanings(normalized);
  }
  res.json({ imported: parsed.data.meanings.length });
});

router.post("/cms/backup/import", ...adminPerm("backup:manage"), async (req, res) => {
  const dbReady = await ensureDatabase(res);
  const schema = z.object({
    meanings: z.array(
      z.object({
        category: z.enum(["planet_sign", "planet_house", "aspect", "house", "house_sign"]),
        key: z.string(),
        title: localizedSchema,
        content: localizedSchema
      })
    ),
    paymentSettings: z
      .object({
        vietqrImageUrl: z.string().optional().default(""),
        vietqrInstructionsVi: z.string().optional().default(""),
        vietqrInstructionsEn: z.string().optional().default(""),
        paypalUnlockUrl: z.string().optional().default(""),
  paypalQrImageUrl: z.string().optional().default(""),
        aspectUnlockPriceVnd: z.coerce.number().int().min(0).optional().default(0),
        aspectUnlockPriceUsd: z.coerce.number().min(0).optional().default(0)
      })
      .optional(),
    themeSettings: z
      .object({
        logoUrl: z.string().optional(),
        backgroundImageUrl: z.string().optional(),
        siteTitle: z.string().optional(),
        backgroundColor: z.string().optional(),
        surfaceColor: z.string().optional(),
        panelBorderColor: z.string().optional(),
        bodyTextColor: z.string().optional(),
        mutedTextColor: z.string().optional(),
        headingTextColor: z.string().optional(),
        linkColor: z.string().optional(),
        linkHoverColor: z.string().optional(),
        warningTextColor: z.string().optional(),
        errorTextColor: z.string().optional(),
        fontBody: z.string().optional(),
        fontHeading: z.string().optional(),
        fontUi: z.string().optional(),
        fontLink: z.string().optional(),
        fontWarning: z.string().optional(),
        fontCode: z.string().optional(),
        aspectColorConjunction: z.string().optional(),
        aspectColorSextile: z.string().optional(),
        aspectColorSquare: z.string().optional(),
        aspectColorTrine: z.string().optional(),
        aspectColorOpposition: z.string().optional(),
        fontChartSign: z.string().optional(),
        fontChartPlanet: z.string().optional()
      })
      .optional()
  });

  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const normalizedMeanings = parsed.data.meanings.map((meaning) => ({
    ...meaning,
    title: normalizeLocalized(meaning.title),
    content: normalizeLocalized(meaning.content)
  }));

  const paymentPayload: PaymentSettingsPayload = {
    vietqrImageUrl: parsed.data.paymentSettings?.vietqrImageUrl?.trim() ?? "",
    vietqrInstructionsVi: parsed.data.paymentSettings?.vietqrInstructionsVi?.trim() ?? "",
    vietqrInstructionsEn: parsed.data.paymentSettings?.vietqrInstructionsEn?.trim() ?? "",
    paypalUnlockUrl: parsed.data.paymentSettings?.paypalUnlockUrl?.trim() ?? "",
    paypalQrImageUrl: parsed.data.paymentSettings?.paypalQrImageUrl?.trim() ?? "",
    aspectUnlockPriceVnd: Math.floor(parsed.data.paymentSettings?.aspectUnlockPriceVnd ?? 0),
    aspectUnlockPriceUsd: parsed.data.paymentSettings?.aspectUnlockPriceUsd ?? 0
  };

  const themePayload: ThemeSettingsPayload = normalizeThemePayload({
    ...defaultThemeSettings,
    ...(parsed.data.themeSettings ?? {})
  });

  if (dbReady) {
    await MeaningModel.deleteMany({});
    await MeaningModel.insertMany(normalizedMeanings);
    await upsertPaymentSettingsDb(paymentPayload);
    await upsertThemeSettingsDb(themePayload);
  } else {
    await replaceLocalMeanings(normalizedMeanings);
    await writeLocalPaymentSettings(paymentPayload);
    await writeLocalThemeSettings(themePayload);
  }

  res.json({
    importedAt: new Date().toISOString(),
    imported: {
      meanings: normalizedMeanings.length,
      paymentSettings: true,
      themeSettings: true
    }
  });
});

router.get("/cms/payment-settings", ...adminPerm("payment:manage"), async (_req, res) => {
  await ensureDatabase(res);
  const overrides = await loadPaymentOverrides();
  res.json({
    vietqrImageUrl: overrides.vietqrImageUrl,
    vietqrInstructionsVi: overrides.vietqrInstructionsVi,
    vietqrInstructionsEn: overrides.vietqrInstructionsEn,
    paypalUnlockUrl: overrides.paypalUnlockUrl,
    paypalQrImageUrl: overrides.paypalQrImageUrl,
    aspectUnlockPriceVnd: overrides.aspectUnlockPriceVnd,
    aspectUnlockPriceUsd: overrides.aspectUnlockPriceUsd,
    envFallbackQrUrl: config.vietQrQrImageUrl,
    envFallbackPaypalUrl: config.paypalUnlockUrl,
    envFallbackAspectPriceVnd: config.aspectAccessPrice,
    envFallbackAspectPriceUsd: config.aspectAccessPriceUsd
  });
});

router.put("/cms/payment-settings", ...adminPerm("payment:manage"), async (req, res) => {
  const parsed = paymentSettingsBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const payload: PaymentSettingsPayload = {
    vietqrImageUrl: parsed.data.vietqrImageUrl.trim(),
    vietqrInstructionsVi: parsed.data.vietqrInstructionsVi.trim(),
    vietqrInstructionsEn: parsed.data.vietqrInstructionsEn.trim(),
    paypalUnlockUrl: parsed.data.paypalUnlockUrl.trim(),
    paypalQrImageUrl: parsed.data.paypalQrImageUrl.trim(),
    aspectUnlockPriceVnd: Math.floor(parsed.data.aspectUnlockPriceVnd),
    aspectUnlockPriceUsd: parsed.data.aspectUnlockPriceUsd
  };
  const dbReady = await ensureDatabase(res);
  if (dbReady) {
    const saved = await upsertPaymentSettingsDb(payload);
    res.json(saved);
    return;
  }
  await writeLocalPaymentSettings(payload);
  res.json(payload);
});

router.post(
  "/cms/upload-vietqr",
  ...adminPerm("payment:manage"),
  (req, res, next) => {
    vietqrUpload.single("vietqr")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file received — use multipart field name "vietqr"' });
      return;
    }
    const vietqrImageUrl = `/api/uploads/${file.filename}`;
    const dbReady = await ensureDatabase(res);
    const current = await loadPaymentOverrides();
    const payload: PaymentSettingsPayload = {
      ...current,
      vietqrImageUrl
    };
    if (dbReady) {
      const saved = await upsertPaymentSettingsDb(payload);
      res.status(201).json({ vietqrImageUrl, paymentSettings: saved });
      return;
    }
    await writeLocalPaymentSettings(payload);
    res.status(201).json({ vietqrImageUrl, paymentSettings: payload });
  }
);

router.post(
  "/cms/upload-paypal-qr",
  ...adminPerm("payment:manage"),
  (req, res, next) => {
    paypalQrUpload.single("paypalQr")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file received — use multipart field name "paypalQr"' });
      return;
    }
    const paypalQrImageUrl = `/api/uploads/${file.filename}`;
    const dbReady = await ensureDatabase(res);
    const current = await loadPaymentOverrides();
    const payload: PaymentSettingsPayload = {
      ...current,
      paypalQrImageUrl
    };
    if (dbReady) {
      const saved = await upsertPaymentSettingsDb(payload);
      res.status(201).json({ paypalQrImageUrl, paymentSettings: saved });
      return;
    }
    await writeLocalPaymentSettings(payload);
    res.status(201).json({ paypalQrImageUrl, paymentSettings: payload });
  }
);

router.get("/cms/payments/vietqr/pending", ...adminPerm("payment:manage"), async (_req, res) => {
  const pending = await listPendingVietQrSessions();
  res.json({ pending });
});

router.post("/cms/payments/vietqr/:sessionId/confirm", ...adminPerm("payment:manage"), async (req, res) => {
  const sessionId = typeof req.params.sessionId === "string" ? req.params.sessionId : "";
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const session = await getVietQrSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "Payment session not found" });
    return;
  }
  if (session.status === "paid") {
    res.json({ status: "paid", accessToken: session.accessToken ?? null });
    return;
  }
  if (session.status !== "pending") {
    res.status(400).json({ error: `Session is ${session.status}` });
    return;
  }
  const accessToken = createAspectAccessToken();
  const paid = await markVietQrSessionPaid({ sessionId, accessToken });
  res.json({ status: "paid", accessToken: paid?.accessToken ?? accessToken });
});

router.get("/cms/theme-settings", ...adminPerm("theme:read"), async (_req, res) => {
  await ensureDatabase(res);
  const theme = await loadThemeOverrides();
  res.json(theme);
});

router.put("/cms/theme-settings", ...adminPerm("theme:write"), async (req, res) => {
  const parsed = themeSettingsBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const payload: ThemeSettingsPayload = normalizeThemePayload({
    ...defaultThemeSettings,
    ...(parsed.data as Partial<ThemeSettingsPayload>)
  });
  const dbReady = await ensureDatabase(res);
  if (dbReady) {
    const saved = await upsertThemeSettingsDb(payload);
    res.json(saved);
    return;
  }
  await writeLocalThemeSettings(payload);
  res.json(payload);
});

router.post(
  "/cms/upload-logo",
  ...adminPerm("theme:write"),
  (req, res, next) => {
    logoUpload.single("logo")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file received — use multipart field name "logo"' });
      return;
    }
    const logoUrl = `/api/uploads/${file.filename}`;
    const dbReady = await ensureDatabase(res);
    const themePatch = normalizeThemePayload({
      ...(await loadThemeOverrides()),
      logoUrl
    });
    if (dbReady) {
      await upsertThemeSettingsDb(themePatch);
    } else {
      await writeLocalThemeSettings(themePatch);
    }
    res.status(201).json({ logoUrl, theme: themePatch });
  }
);

router.post(
  "/cms/upload-background",
  ...adminPerm("theme:write"),
  (req, res, next) => {
    backgroundUpload.single("background")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        res.status(400).json({ error: msg });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file received — use multipart field name "background"' });
      return;
    }
    const backgroundImageUrl = `/api/uploads/${file.filename}`;
    const dbReady = await ensureDatabase(res);
    const themePatch = normalizeThemePayload({
      ...(await loadThemeOverrides()),
      backgroundImageUrl
    });
    if (dbReady) {
      await upsertThemeSettingsDb(themePatch);
    } else {
      await writeLocalThemeSettings(themePatch);
    }
    res.status(201).json({ backgroundImageUrl, theme: themePatch });
  }
);

router.get("/cms/admin-users", ...adminPerm("admin:manage"), async (_req, res) => {
  try {
    const users = await listAdminUsers();
    res.json({ users, storage: isDatabaseReady() ? "mongodb" : "local" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list admin users.";
    res.status(500).json({ error: message });
  }
});

router.post("/cms/admin-users", ...adminPerm("admin:manage"), async (req, res) => {
  const parsed = adminUserCreateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const permissions = sanitizeMemberPermissions(parsed.data.permissions);
    const user = await createAdminUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.role,
      permissions
    );
    res.status(201).json({ user, storage: isDatabaseReady() ? "mongodb" : "local" });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "EMAIL_IN_USE") {
      res.status(409).json({ error: "An admin with this email already exists." });
      return;
    }
    const message = err instanceof Error ? err.message : "Failed to create admin user.";
    res.status(500).json({ error: message });
  }
});

router.patch("/cms/admin-users/:id/access", ...adminPerm("admin:manage"), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ error: "Admin user id is required." });
    return;
  }
  const parsed = adminUserAccessSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const permissions = sanitizeMemberPermissions(parsed.data.permissions);
    await updateAdminUserAccess(id, parsed.data.role, permissions);
    res.json({
      ok: true,
      role: parsed.data.role,
      permissions: effectivePermissions(parsed.data.role, permissions)
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "LAST_ADMIN") {
      res.status(400).json({ error: "Cannot change role of the last admin." });
      return;
    }
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Admin user not found." });
      return;
    }
    const message = err instanceof Error ? err.message : "Failed to update admin access.";
    res.status(500).json({ error: message });
  }
});

router.delete("/cms/admin-users/:id", ...adminPerm("admin:manage"), async (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  if (!id) {
    res.status(400).json({ error: "Admin user id is required." });
    return;
  }

  try {
    await deleteAdminUser(id);
    res.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "ADMIN_PROTECTED") {
      res.status(400).json({ error: "Admin accounts cannot be deleted." });
      return;
    }
    if (code === "LAST_ADMIN") {
      res.status(400).json({ error: "Cannot delete the last admin account." });
      return;
    }
    if (code === "LAST_SUPER_ADMIN") {
      res.status(400).json({ error: "Cannot delete the last super admin account." });
      return;
    }
    if (code === "NOT_FOUND") {
      res.status(404).json({ error: "Admin user not found." });
      return;
    }
    const message = err instanceof Error ? err.message : "Failed to delete admin user.";
    res.status(500).json({ error: message });
  }
});

export default router;
