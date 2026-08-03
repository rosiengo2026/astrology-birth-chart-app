import { promises as fs } from "fs";
import path from "path";
import mongoose from "mongoose";
import { config } from "../config";
import { connectDatabase } from "../db";
import { AdminUserModel } from "../models/AdminUser";
import { normalizeAdminRole, sanitizeMemberPermissions } from "../types/adminRoles";

type LocalAdminRecord = {
  id?: string;
  email: string;
  passwordHash: string;
  passwordPlain?: string;
  role?: string;
  permissions?: string[];
  createdAt?: string;
};

const DEFAULT_FILE = path.resolve(process.cwd(), "data", "admin-users.json");

function parseCliArgs(argv: string[]): { filePath: string; dryRun: boolean } {
  const dryRun = argv.includes("--dry-run");
  const fileArg = argv.find((arg) => !arg.startsWith("-"));
  const filePath = fileArg ? path.resolve(fileArg) : DEFAULT_FILE;
  return { filePath, dryRun };
}

async function readLocalAdminUsers(filePath: string): Promise<LocalAdminRecord[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("admin-users.json must contain a JSON array.");
  }
  return parsed as LocalAdminRecord[];
}

async function run() {
  const { filePath, dryRun } = parseCliArgs(process.argv.slice(2));

  const rows = await readLocalAdminUsers(filePath);
  if (rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No admin users found in file.");
    process.exit(0);
  }

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(`Dry run — no writes. Source: ${filePath}`);
    for (const row of rows) {
      const email = row.email?.toLowerCase().trim();
      if (!email || !row.passwordHash) {
        // eslint-disable-next-line no-console
        console.warn("Skipping invalid row:", row);
        continue;
      }
      const role = normalizeAdminRole(row.role, "member");
      // eslint-disable-next-line no-console
      console.log(`Would upsert: ${email} (${role})`);
    }
    process.exit(0);
  }

  const connected = await connectDatabase();
  if (!connected) {
    throw new Error(
      `Could not connect to MongoDB at ${config.mongoUri}. Set MONGO_URI to your Railway connection string and try again.`
    );
  }

  // eslint-disable-next-line no-console
  console.log("Mongo database:", mongoose.connection.name);
  // eslint-disable-next-line no-console
  console.log(`Importing ${rows.length} account(s) from ${filePath}…`);

  for (const row of rows) {
    const email = row.email?.toLowerCase().trim();
    if (!email || !row.passwordHash) {
      // eslint-disable-next-line no-console
      console.warn("Skipping invalid row:", row);
      continue;
    }

    const role = normalizeAdminRole(row.role, "member");
    const passwordPlain = typeof row.passwordPlain === "string" ? row.passwordPlain.trim() : "";
    const permissions = role === "admin" ? [] : sanitizeMemberPermissions(row.permissions ?? []);

    const result = await AdminUserModel.findOneAndUpdate(
      { email },
      {
        email,
        passwordHash: row.passwordHash,
        passwordPlain,
        role,
        permissions
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // eslint-disable-next-line no-console
    console.log(`Upserted: ${result.email} (${result.role})`);
  }

  const total = await AdminUserModel.countDocuments();
  // eslint-disable-next-line no-console
  console.log(`Done. MongoDB now has ${total} admin user(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
