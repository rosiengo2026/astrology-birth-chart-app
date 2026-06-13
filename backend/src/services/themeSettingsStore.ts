import { promises as fs } from "fs";
import path from "path";
import { isDatabaseReady } from "../db";
import { ThemeSettingsModel } from "../models/ThemeSettings";

export type ThemeSettingsPayload = {
  logoUrl: string;
  /** Full-bleed background; empty string = storefront default from CSS */
  backgroundImageUrl: string;
  /** Brand / hero title on the public site */
  siteTitle: string;
  backgroundColor: string;
  surfaceColor: string;
  panelBorderColor: string;
  bodyTextColor: string;
  mutedTextColor: string;
  headingTextColor: string;
  linkColor: string;
  linkHoverColor: string;
  warningTextColor: string;
  errorTextColor: string;
  fontBody: string;
  fontHeading: string;
  fontUi: string;
  fontLink: string;
  fontWarning: string;
  fontCode: string;
};

export const defaultThemeSettings: ThemeSettingsPayload = {
  logoUrl: "",
  backgroundImageUrl: "",
  siteTitle: "AstroScope",
  backgroundColor: "#020617",
  surfaceColor: "#0f172a",
  panelBorderColor: "#1e293b",
  bodyTextColor: "#ffffff",
  mutedTextColor: "#fbbf24",
  headingTextColor: "#ffffff",
  linkColor: "#38bdf8",
  linkHoverColor: "#7dd3fc",
  warningTextColor: "#fcd34d",
  errorTextColor: "#fb7185",
  fontBody: "Inter",
  fontHeading: "Inter",
  fontUi: "Inter",
  fontLink: "Inter",
  fontWarning: "Inter",
  fontCode: "JetBrains Mono"
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "theme-settings.json");

function coercePayload(raw: Partial<Record<keyof ThemeSettingsPayload, unknown>>): ThemeSettingsPayload {
  const d = defaultThemeSettings;
  const str = (k: keyof ThemeSettingsPayload) =>
    typeof raw[k] === "string" ? (raw[k] as string) : d[k];
  return {
    logoUrl: str("logoUrl"),
    backgroundImageUrl: str("backgroundImageUrl"),
    siteTitle: str("siteTitle"),
    backgroundColor: str("backgroundColor"),
    surfaceColor: str("surfaceColor"),
    panelBorderColor: str("panelBorderColor"),
    bodyTextColor: str("bodyTextColor"),
    mutedTextColor: str("mutedTextColor"),
    headingTextColor: str("headingTextColor"),
    linkColor: str("linkColor"),
    linkHoverColor: str("linkHoverColor"),
    warningTextColor: str("warningTextColor"),
    errorTextColor: str("errorTextColor"),
    fontBody: str("fontBody"),
    fontHeading: str("fontHeading"),
    fontUi: str("fontUi"),
    fontLink: str("fontLink"),
    fontWarning: str("fontWarning"),
    fontCode: str("fontCode")
  };
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(defaultThemeSettings, null, 2), "utf-8");
  }
}

export async function readLocalThemeSettings(): Promise<ThemeSettingsPayload> {
  await ensureFile();
  const rawText = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(rawText) as Partial<ThemeSettingsPayload>;
    return coercePayload(parsed);
  } catch {
    return { ...defaultThemeSettings };
  }
}

export async function writeLocalThemeSettings(payload: ThemeSettingsPayload): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export async function getThemeSettingsFromDb(): Promise<ThemeSettingsPayload | null> {
  const doc = await ThemeSettingsModel.findOne().sort({ updatedAt: -1 }).lean();
  if (!doc) return null;
  return coercePayload(doc as Partial<ThemeSettingsPayload>);
}

export async function upsertThemeSettingsDb(payload: ThemeSettingsPayload): Promise<ThemeSettingsPayload> {
  const updated = await ThemeSettingsModel.findOneAndUpdate(
    {},
    { $set: payload },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return coercePayload((updated ?? payload) as Partial<ThemeSettingsPayload>);
}

function expandHexValid(t: string): string {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t.trim());
  if (!m) return defaultThemeSettings.backgroundColor;
  const hex = m[1];
  if (hex.length === 3) {
    const [r, g, b] = hex.split("") as [string, string, string];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return `#${hex.toLowerCase()}`;
}

export function normalizeColor(input: string, fallback: string): string {
  const t = input.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) return fallback;
  return expandHexValid(t);
}

function normalizeFont(input: string, fallback: string): string {
  const t = input.trim().slice(0, 80);
  return t || fallback;
}

function normalizeSiteTitle(input: string, fallback: string): string {
  const t = input.trim().slice(0, 120);
  return t || fallback;
}

/** Merge partial / loose JSON into a complete validated payload. */
export function normalizeThemePayload(raw: Partial<ThemeSettingsPayload>): ThemeSettingsPayload {
  const d = defaultThemeSettings;
  const bgUrl =
    typeof raw.backgroundImageUrl === "string" ? raw.backgroundImageUrl.trim().slice(0, 2000) : d.backgroundImageUrl;
  return {
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl.trim() : d.logoUrl,
    backgroundImageUrl: bgUrl,
    siteTitle: normalizeSiteTitle(String(raw.siteTitle ?? d.siteTitle), d.siteTitle),
    backgroundColor: normalizeColor(String(raw.backgroundColor ?? d.backgroundColor), d.backgroundColor),
    surfaceColor: normalizeColor(String(raw.surfaceColor ?? d.surfaceColor), d.surfaceColor),
    panelBorderColor: normalizeColor(String(raw.panelBorderColor ?? d.panelBorderColor), d.panelBorderColor),
    bodyTextColor: normalizeColor(String(raw.bodyTextColor ?? d.bodyTextColor), d.bodyTextColor),
    mutedTextColor: normalizeColor(String(raw.mutedTextColor ?? d.mutedTextColor), d.mutedTextColor),
    headingTextColor: normalizeColor(String(raw.headingTextColor ?? d.headingTextColor), d.headingTextColor),
    linkColor: normalizeColor(String(raw.linkColor ?? d.linkColor), d.linkColor),
    linkHoverColor: normalizeColor(String(raw.linkHoverColor ?? d.linkHoverColor), d.linkHoverColor),
    warningTextColor: normalizeColor(String(raw.warningTextColor ?? d.warningTextColor), d.warningTextColor),
    errorTextColor: normalizeColor(String(raw.errorTextColor ?? d.errorTextColor), d.errorTextColor),
    fontBody: normalizeFont(String(raw.fontBody ?? d.fontBody), d.fontBody),
    fontHeading: normalizeFont(String(raw.fontHeading ?? d.fontHeading), d.fontHeading),
    fontUi: normalizeFont(String(raw.fontUi ?? d.fontUi), d.fontUi),
    fontLink: normalizeFont(String(raw.fontLink ?? d.fontLink), d.fontLink),
    fontWarning: normalizeFont(String(raw.fontWarning ?? d.fontWarning), d.fontWarning),
    fontCode: normalizeFont(String(raw.fontCode ?? d.fontCode), d.fontCode)
  };
}

export async function loadThemeOverrides(): Promise<ThemeSettingsPayload> {
  if (isDatabaseReady()) {
    const fromDb = await getThemeSettingsFromDb();
    if (fromDb) {
      return normalizeThemePayload(fromDb);
    }
  }
  const local = await readLocalThemeSettings();
  return normalizeThemePayload(local);
}
