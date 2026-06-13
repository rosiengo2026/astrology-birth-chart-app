import bcrypt from "bcryptjs";
import { config } from "../config";
import { connectDatabase } from "../db";
import { AdminUserModel } from "../models/AdminUser";

async function run() {
  await connectDatabase();
  const existing = await AdminUserModel.findOne({ email: config.adminEmail.toLowerCase() });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log("Admin user already exists.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await AdminUserModel.create({
    email: config.adminEmail.toLowerCase(),
    passwordHash
  });
  // eslint-disable-next-line no-console
  console.log(`Admin seeded for ${config.adminEmail}`);
  process.exit(0);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
