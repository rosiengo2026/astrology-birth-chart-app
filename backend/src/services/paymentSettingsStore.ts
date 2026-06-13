import { promises as fs } from "fs";
import path from "path";
import { PaymentSettingsModel } from "../models/PaymentSettings";

export type PaymentSettingsPayload = {
  vietqrImageUrl: string;
  vietqrInstructionsVi: string;
  vietqrInstructionsEn: string;
  paypalUnlockUrl: string;
  paypalQrImageUrl: string;
  /** 0 = fall back to ASPECT_ACCESS_PRICE */
  aspectUnlockPriceVnd: number;
  /** 0 = fall back to ASPECT_ACCESS_PRICE_USD */
  aspectUnlockPriceUsd: number;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "payment-settings.json");

const empty: PaymentSettingsPayload = {
  vietqrImageUrl: "",
  vietqrInstructionsVi: "",
  vietqrInstructionsEn: "",
  paypalUnlockUrl: "",
  paypalQrImageUrl: "",
  aspectUnlockPriceVnd: 0,
  aspectUnlockPriceUsd: 0
};

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(empty, null, 2), "utf-8");
  }
}

export async function readLocalPaymentSettings(): Promise<PaymentSettingsPayload> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Partial<PaymentSettingsPayload>;
    const vnd =
      typeof parsed.aspectUnlockPriceVnd === "number" && Number.isFinite(parsed.aspectUnlockPriceVnd)
        ? Math.max(0, Math.floor(parsed.aspectUnlockPriceVnd))
        : 0;
    const usd =
      typeof parsed.aspectUnlockPriceUsd === "number" && Number.isFinite(parsed.aspectUnlockPriceUsd)
        ? Math.max(0, parsed.aspectUnlockPriceUsd)
        : 0;
    return {
      vietqrImageUrl: typeof parsed.vietqrImageUrl === "string" ? parsed.vietqrImageUrl : "",
      vietqrInstructionsVi: typeof parsed.vietqrInstructionsVi === "string" ? parsed.vietqrInstructionsVi : "",
      vietqrInstructionsEn: typeof parsed.vietqrInstructionsEn === "string" ? parsed.vietqrInstructionsEn : "",
      paypalUnlockUrl: typeof parsed.paypalUnlockUrl === "string" ? parsed.paypalUnlockUrl : "",
      paypalQrImageUrl: typeof parsed.paypalQrImageUrl === "string" ? parsed.paypalQrImageUrl : "",
      aspectUnlockPriceVnd: vnd,
      aspectUnlockPriceUsd: usd
    };
  } catch {
    return { ...empty };
  }
}

export async function writeLocalPaymentSettings(payload: PaymentSettingsPayload): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export async function getPaymentSettingsFromDb(): Promise<PaymentSettingsPayload | null> {
  const doc = await PaymentSettingsModel.findOne().sort({ updatedAt: -1 }).lean();
  if (!doc) return null;
  return {
    vietqrImageUrl: doc.vietqrImageUrl ?? "",
    vietqrInstructionsVi: doc.vietqrInstructionsVi ?? "",
    vietqrInstructionsEn: doc.vietqrInstructionsEn ?? "",
    paypalUnlockUrl: doc.paypalUnlockUrl ?? "",
    paypalQrImageUrl: doc.paypalQrImageUrl ?? "",
    aspectUnlockPriceVnd:
      typeof doc.aspectUnlockPriceVnd === "number" && Number.isFinite(doc.aspectUnlockPriceVnd)
        ? Math.max(0, Math.floor(doc.aspectUnlockPriceVnd))
        : 0,
    aspectUnlockPriceUsd:
      typeof doc.aspectUnlockPriceUsd === "number" && Number.isFinite(doc.aspectUnlockPriceUsd)
        ? Math.max(0, doc.aspectUnlockPriceUsd)
        : 0
  };
}

export async function upsertPaymentSettingsDb(payload: PaymentSettingsPayload): Promise<PaymentSettingsPayload> {
  const updated = await PaymentSettingsModel.findOneAndUpdate(
    {},
    {
      $set: {
        vietqrImageUrl: payload.vietqrImageUrl,
        vietqrInstructionsVi: payload.vietqrInstructionsVi,
        vietqrInstructionsEn: payload.vietqrInstructionsEn,
        paypalUnlockUrl: payload.paypalUnlockUrl,
        paypalQrImageUrl: payload.paypalQrImageUrl,
        aspectUnlockPriceVnd: payload.aspectUnlockPriceVnd,
        aspectUnlockPriceUsd: payload.aspectUnlockPriceUsd
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return {
    vietqrImageUrl: updated?.vietqrImageUrl ?? "",
    vietqrInstructionsVi: updated?.vietqrInstructionsVi ?? "",
    vietqrInstructionsEn: updated?.vietqrInstructionsEn ?? "",
    paypalUnlockUrl: updated?.paypalUnlockUrl ?? "",
    paypalQrImageUrl: updated?.paypalQrImageUrl ?? "",
    aspectUnlockPriceVnd:
      typeof updated?.aspectUnlockPriceVnd === "number" && Number.isFinite(updated.aspectUnlockPriceVnd)
        ? Math.max(0, Math.floor(updated.aspectUnlockPriceVnd))
        : 0,
    aspectUnlockPriceUsd:
      typeof updated?.aspectUnlockPriceUsd === "number" && Number.isFinite(updated?.aspectUnlockPriceUsd)
        ? Math.max(0, updated.aspectUnlockPriceUsd)
        : 0
  };
}
