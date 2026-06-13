import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

export type VietQrPaymentStatus = "pending" | "paid" | "expired";

export type VietQrPaymentSession = {
  sessionId: string;
  transferContent: string;
  amount: number;
  currency: string;
  status: VietQrPaymentStatus;
  accessToken?: string;
  createdAt: string;
  paidAt?: string;
  expiresAt: string;
};

type StoreShape = {
  sessions: VietQrPaymentSession[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "vietqr-payments.json");

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ sessions: [] } satisfies StoreShape, null, 2), "utf-8");
  }
}

async function readStore(): Promise<StoreShape> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] };
  } catch {
    return { sessions: [] };
  }
}

async function writeStore(store: StoreShape): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function pruneExpired(store: StoreShape, now = Date.now()): StoreShape {
  const sessions = store.sessions.map((session) => {
    if (session.status !== "pending") return session;
    if (new Date(session.expiresAt).getTime() > now) return session;
    return { ...session, status: "expired" as const };
  });
  return { sessions: sessions.slice(-500) };
}

export function buildTransferContent(prefix: string): string {
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const base = prefix.trim() || "natalchart";
  return `${base}-${code}`;
}

export async function createVietQrSession(input: {
  transferPrefix: string;
  amount: number;
  currency: string;
  ttlMinutes: number;
}): Promise<VietQrPaymentSession> {
  const store = pruneExpired(await readStore());
  const now = new Date();
  const session: VietQrPaymentSession = {
    sessionId: crypto.randomUUID(),
    transferContent: buildTransferContent(input.transferPrefix),
    amount: input.amount,
    currency: input.currency,
    status: "pending",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.ttlMinutes * 60_000).toISOString()
  };
  store.sessions.push(session);
  await writeStore(store);
  return session;
}

export async function getVietQrSession(sessionId: string): Promise<VietQrPaymentSession | null> {
  const store = pruneExpired(await readStore());
  await writeStore(store);
  return store.sessions.find((session) => session.sessionId === sessionId) ?? null;
}

export async function markVietQrSessionPaid(input: {
  sessionId: string;
  accessToken: string;
}): Promise<VietQrPaymentSession | null> {
  const store = pruneExpired(await readStore());
  const index = store.sessions.findIndex((session) => session.sessionId === input.sessionId);
  if (index < 0) return null;
  const current = store.sessions[index];
  if (current.status === "paid") return current;
  const updated: VietQrPaymentSession = {
    ...current,
    status: "paid",
    accessToken: input.accessToken,
    paidAt: new Date().toISOString()
  };
  store.sessions[index] = updated;
  await writeStore(store);
  return updated;
}

function normalizeDescription(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

export async function matchAndPayVietQrTransfer(input: {
  description: string;
  amount: number;
  createAccessToken: () => string;
}): Promise<VietQrPaymentSession | null> {
  const store = pruneExpired(await readStore());
  const description = normalizeDescription(input.description);
  const amount = Math.round(input.amount);
  if (!description || amount <= 0) return null;

  const index = store.sessions.findIndex((session) => {
    if (session.status !== "pending") return false;
    if (session.amount !== amount) return false;
    const memo = session.transferContent.trim().toLowerCase();
    return description === memo || description.includes(memo);
  });
  if (index < 0) {
    await writeStore(store);
    return null;
  }

  const accessToken = input.createAccessToken();
  const updated: VietQrPaymentSession = {
    ...store.sessions[index],
    status: "paid",
    accessToken,
    paidAt: new Date().toISOString()
  };
  store.sessions[index] = updated;
  await writeStore(store);
  return updated;
}

export function extractWebhookTransfer(body: unknown): { description: string; amount: number } | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  if (Array.isArray(payload.data) && payload.data.length > 0) {
    const row = payload.data[0] as Record<string, unknown>;
    const description = normalizeDescription(row.description ?? row.content ?? row.transferContent);
    const amount = normalizeAmount(row.amount ?? row.transferAmount);
    if (description && amount) return { description, amount };
  }

  if (payload.transferAmount !== undefined || payload.transferContent !== undefined) {
    const description = normalizeDescription(payload.transferContent ?? payload.content ?? payload.description);
    const amount = normalizeAmount(payload.transferAmount ?? payload.amount);
    if (description && amount) return { description, amount };
  }

  const description = normalizeDescription(payload.description ?? payload.content ?? payload.transferContent);
  const amount = normalizeAmount(payload.amount ?? payload.transferAmount);
  if (description && amount) return { description, amount };
  return null;
}

export async function listPendingVietQrSessions(): Promise<VietQrPaymentSession[]> {
  const store = pruneExpired(await readStore());
  await writeStore(store);
  return store.sessions.filter((session) => session.status === "pending");
}
