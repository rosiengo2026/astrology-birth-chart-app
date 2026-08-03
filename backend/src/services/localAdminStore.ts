import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { config } from "../config";
import {
  AdminPermission,
  AdminRole,
  effectivePermissions,
  normalizeAdminRole,
  sanitizeMemberPermissions
} from "../types/adminRoles";

export interface LocalAdminUser {
  id: string;
  email: string;
  passwordHash: string;
  passwordPlain: string;
  role: AdminRole;
  permissions: AdminPermission[];
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "admin-users.json");

function legacyMemberPermissions(role: string): AdminPermission[] {
  if (role === "editor") {
    return sanitizeMemberPermissions(["cms:read", "cms:write", "theme:read", "theme:write", "preview:access"]);
  }
  if (role === "viewer") {
    return sanitizeMemberPermissions(["cms:read", "theme:read", "preview:access"]);
  }
  return sanitizeMemberPermissions(["cms:read", "theme:read", "preview:access"]);
}

function normalizeRecord(raw: Partial<LocalAdminUser> & { email: string; passwordHash: string }): LocalAdminUser {
  const legacyRole = typeof raw.role === "string" ? raw.role : "member";
  const role = normalizeAdminRole(legacyRole, config.adminEmail.toLowerCase() === raw.email?.toLowerCase() ? "admin" : "member");
  const permissions =
    role === "admin"
      ? []
      : Array.isArray(raw.permissions) && raw.permissions.length > 0
        ? sanitizeMemberPermissions(raw.permissions)
        : legacyMemberPermissions(legacyRole);
  return {
    id: raw.id ?? randomUUID(),
    email: raw.email.toLowerCase().trim(),
    passwordHash: raw.passwordHash,
    passwordPlain: typeof raw.passwordPlain === "string" ? raw.passwordPlain : "",
    role,
    permissions,
    createdAt: raw.createdAt ?? new Date().toISOString()
  };
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readAll(): Promise<LocalAdminUser[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Array<Partial<LocalAdminUser> & { email: string; passwordHash: string }>;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => normalizeRecord(item));
}

async function writeAll(items: LocalAdminUser[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export async function listLocalAdminUsers(): Promise<LocalAdminUser[]> {
  const items = await readAll();
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function countLocalAdminUsers(): Promise<number> {
  return (await readAll()).length;
}

export async function countLocalAdmins(): Promise<number> {
  return (await readAll()).filter((item) => item.role === "admin").length;
}

export async function findLocalAdminByEmail(email: string): Promise<LocalAdminUser | null> {
  const normalized = email.toLowerCase().trim();
  const items = await readAll();
  return items.find((item) => item.email === normalized) ?? null;
}

export async function findLocalAdminById(id: string): Promise<LocalAdminUser | null> {
  const items = await readAll();
  return items.find((item) => item.id === id) ?? null;
}

export async function createLocalAdminUser(
  email: string,
  password: string,
  role: AdminRole = "member",
  permissions: AdminPermission[] = []
): Promise<{ id: string; email: string; password: string; role: AdminRole; permissions: AdminPermission[] }> {
  const normalized = email.toLowerCase().trim();
  const normalizedRole = normalizeAdminRole(role, "member");
  const items = await readAll();
  if (items.some((item) => item.email === normalized)) {
    throw new Error("EMAIL_IN_USE");
  }

  const memberPermissions = normalizedRole === "admin" ? [] : sanitizeMemberPermissions(permissions);
  const passwordHash = await bcrypt.hash(password, 10);
  const record: LocalAdminUser = {
    id: randomUUID(),
    email: normalized,
    passwordHash,
    passwordPlain: password,
    role: normalizedRole,
    permissions: memberPermissions,
    createdAt: new Date().toISOString()
  };
  items.push(record);
  await writeAll(items);
  return {
    id: record.id,
    email: record.email,
    password: record.passwordPlain,
    role: record.role,
    permissions: effectivePermissions(record.role, record.permissions)
  };
}

export async function updateLocalAdminAccess(
  id: string,
  role: AdminRole,
  permissions: AdminPermission[]
): Promise<void> {
  const items = await readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new Error("NOT_FOUND");
  }
  const current = items[index];
  const nextRole = normalizeAdminRole(role, current.role);
  if (current.role === "admin" && nextRole !== "admin") {
    throw new Error("ADMIN_ROLE_PROTECTED");
  }
  items[index] = {
    ...current,
    role: nextRole,
    permissions: nextRole === "admin" ? [] : sanitizeMemberPermissions(permissions)
  };
  await writeAll(items);
}

export async function updateLocalAdminEmail(id: string, email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const items = await readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new Error("NOT_FOUND");
  }
  if (items.some((item) => item.id !== id && item.email === normalized)) {
    throw new Error("EMAIL_IN_USE");
  }
  items[index] = {
    ...items[index],
    email: normalized
  };
  await writeAll(items);
}

export async function updateLocalAdminPassword(id: string, password: string): Promise<void> {
  const items = await readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new Error("NOT_FOUND");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  items[index] = {
    ...items[index],
    passwordHash,
    passwordPlain: password
  };
  await writeAll(items);
}

export async function deleteLocalAdminUser(id: string): Promise<void> {
  const items = await readAll();
  if (items.length <= 1) {
    throw new Error("LAST_ADMIN");
  }
  const target = items.find((item) => item.id === id);
  if (!target) {
    throw new Error("NOT_FOUND");
  }
  if (target.role === "admin") {
    throw new Error("ADMIN_PROTECTED");
  }
  await writeAll(items.filter((item) => item.id !== id));
}

export async function ensureDefaultLocalAdminUser(): Promise<void> {
  const items = await readAll();
  const email = config.adminEmail.toLowerCase();
  if (items.some((item) => item.email === email)) {
    return;
  }
  if (items.length > 0) {
    return;
  }
  await createLocalAdminUser(config.adminEmail, config.adminPassword, "admin", []);
}

export async function verifyLocalAdminCredentials(
  email: string,
  password: string
): Promise<{ valid: boolean; subject: string; role: AdminRole; permissions: AdminPermission[] }> {
  const normalized = email.toLowerCase().trim();
  const admin = await findLocalAdminByEmail(normalized);
  if (admin) {
    const valid = await bcrypt.compare(password, admin.passwordHash);
    return {
      valid,
      subject: admin.id,
      role: admin.role,
      permissions: effectivePermissions(admin.role, admin.permissions)
    };
  }
  const envMatch =
    normalized === config.adminEmail.toLowerCase() && password === config.adminPassword;
  return {
    valid: envMatch,
    subject: envMatch ? "local-admin" : "",
    role: "admin",
    permissions: effectivePermissions("admin", [])
  };
}

export function localEffectivePermissions(user: LocalAdminUser): AdminPermission[] {
  return effectivePermissions(user.role, user.permissions);
}
