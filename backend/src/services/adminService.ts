import bcrypt from "bcryptjs";
import { config } from "../config";
import { AdminUserModel } from "../models/AdminUser";

export async function ensureDefaultAdminUser(): Promise<void> {
  const email = config.adminEmail.toLowerCase();
  const existing = await AdminUserModel.findOne({ email });
  if (existing) return;

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await AdminUserModel.create({
    email,
    passwordHash
  });
}
