import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { AdminUserModel } from "../models/AdminUser";
import { LicenseModel } from "../models/License";

/**
 * Unique license code: ASL-YYYYMMDD- + 96-bit random hex (DB still enforces unique index).
 * Date segment helps humans spot issuance day; random suffix prevents collisions.
 */
export function generateLicenseKey(at: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = at.getFullYear();
  const m = pad(at.getMonth() + 1);
  const d = pad(at.getDate());
  const suffix = randomBytes(12).toString("hex").toUpperCase();
  return `ASL-${y}${m}${d}-${suffix}`;
}

/** 10-char PIN for pairing with license key at setup (no ambiguous 0/O). */
export function generateLicensePin(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * Atomically reserves the license, creates admin, links license → admin.
 * Rolls back license reservation if admin creation fails.
 */
export async function redeemLicenseAndCreateAdmin(input: {
  licenseKey: string;
  email: string;
  password: string;
}): Promise<{ adminId: string }> {
  const normalizedKey = input.licenseKey.trim();
  const email = input.email.toLowerCase().trim();

  const existingUser = await AdminUserModel.findOne({ email });
  if (existingUser) {
    throw new Error("EMAIL_IN_USE");
  }

  const doc = await LicenseModel.findOne({ licenseKey: normalizedKey, isUsed: false }).lean();
  if (!doc) {
    throw new Error("INVALID_OR_USED_LICENSE");
  }

  const reserved = await LicenseModel.findOneAndUpdate(
    { _id: doc._id, isUsed: false },
    { $set: { isUsed: true, usedAt: new Date() } },
    { new: true }
  );

  if (!reserved) {
    throw new Error("INVALID_OR_USED_LICENSE");
  }

  try {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const admin = await AdminUserModel.create({ email, passwordHash });
    await LicenseModel.updateOne({ _id: reserved._id }, { $set: { adminUserId: admin._id } });
    return { adminId: String(admin._id) };
  } catch (err) {
    await LicenseModel.updateOne(
      { _id: reserved._id },
      { $set: { isUsed: false }, $unset: { usedAt: 1, adminUserId: 1 } }
    );
    const code = (err as { code?: number })?.code;
    if (code === 11000) {
      throw new Error("EMAIL_IN_USE");
    }
    throw err;
  }
}
