import bcrypt from "bcryptjs";
import { config } from "../config";
import { isDatabaseReady } from "../db";
import { AdminUserModel } from "../models/AdminUser";
import {
  AdminPermission,
  AdminRole,
  effectivePermissions,
  normalizeAdminRole,
  sanitizeMemberPermissions
} from "../types/adminRoles";
import {
  countLocalAdminUsers,
  countLocalAdmins,
  createLocalAdminUser,
  deleteLocalAdminUser,
  ensureDefaultLocalAdminUser,
  findLocalAdminById,
  listLocalAdminUsers,
  localEffectivePermissions,
  updateLocalAdminAccess,
  updateLocalAdminEmail,
  updateLocalAdminPassword,
  verifyLocalAdminCredentials
} from "./localAdminStore";

export { ensureDefaultLocalAdminUser };

export type AdminUserProfile = {
  id: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
};

export type AdminUserListItem = {
  id: string;
  email: string;
  password: string;
  role: AdminRole;
  permissions: AdminPermission[];
  createdAt: string | null;
};

const ENV_ADMIN_ID = "local-admin";

function dbEffectivePermissions(role: AdminRole, permissions: unknown): AdminPermission[] {
  if (role === "admin") return effectivePermissions("admin", []);
  if (Array.isArray(permissions) && permissions.length > 0) {
    return sanitizeMemberPermissions(permissions as AdminPermission[]);
  }
  return sanitizeMemberPermissions(["cms:read", "theme:read", "preview:access"]);
}

export async function ensureDefaultAdminUser(): Promise<void> {
  if (!isDatabaseReady()) {
    await ensureDefaultLocalAdminUser();
    return;
  }

  const email = config.adminEmail.toLowerCase();
  const existing = await AdminUserModel.findOne({ email });
  if (existing) return;

  const passwordHash = await bcrypt.hash(config.adminPassword, 10);
  await AdminUserModel.create({
    email,
    passwordHash,
    passwordPlain: config.adminPassword,
    role: "admin",
    permissions: []
  });
}

export async function resolveAdminPermissionsById(adminId: string): Promise<AdminPermission[]> {
  if (adminId === ENV_ADMIN_ID) {
    return effectivePermissions("admin", []);
  }

  if (!isDatabaseReady()) {
    const admin = await findLocalAdminById(adminId);
    if (!admin) return sanitizeMemberPermissions([]);
    return localEffectivePermissions(admin);
  }

  const admin = await AdminUserModel.findById(adminId).lean();
  if (!admin) return sanitizeMemberPermissions([]);
  const role = normalizeAdminRole(admin.role, "member");
  return dbEffectivePermissions(role, admin.permissions);
}

export async function getAdminProfileById(adminId: string): Promise<AdminUserProfile | null> {
  if (adminId === ENV_ADMIN_ID) {
    return {
      id: ENV_ADMIN_ID,
      email: config.adminEmail.toLowerCase(),
      role: "admin",
      permissions: effectivePermissions("admin", [])
    };
  }

  if (!isDatabaseReady()) {
    const admin = await findLocalAdminById(adminId);
    if (!admin) return null;
    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: localEffectivePermissions(admin)
    };
  }

  const admin = await AdminUserModel.findById(adminId).lean();
  if (!admin) return null;
  const role = normalizeAdminRole(admin.role, "member");
  return {
    id: String(admin._id),
    email: admin.email,
    role,
    permissions: dbEffectivePermissions(role, admin.permissions)
  };
}

export async function countAdminUsers(): Promise<number> {
  if (isDatabaseReady()) {
    return AdminUserModel.countDocuments();
  }
  return countLocalAdminUsers();
}

export async function createAdminUser(
  email: string,
  password: string,
  role: AdminRole = "member",
  permissions: AdminPermission[] = []
): Promise<{ id: string; email: string; password: string; role: AdminRole; permissions: AdminPermission[] }> {
  const normalizedRole = normalizeAdminRole(role, "member");
  const memberPermissions = normalizedRole === "admin" ? [] : sanitizeMemberPermissions(permissions);

  if (!isDatabaseReady()) {
    return createLocalAdminUser(email, password, normalizedRole, memberPermissions);
  }

  const normalized = email.toLowerCase().trim();
  const existing = await AdminUserModel.findOne({ email: normalized });
  if (existing) {
    throw new Error("EMAIL_IN_USE");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await AdminUserModel.create({
    email: normalized,
    passwordHash,
    passwordPlain: password,
    role: normalizedRole,
    permissions: memberPermissions
  });
  const finalRole = normalizeAdminRole(admin.role, normalizedRole);
  return {
    id: String(admin._id),
    email: admin.email,
    password,
    role: finalRole,
    permissions: dbEffectivePermissions(finalRole, admin.permissions)
  };
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  if (!isDatabaseReady()) {
    const rows = await listLocalAdminUsers();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      password: row.passwordPlain,
      role: row.role,
      permissions: localEffectivePermissions(row),
      createdAt: row.createdAt
    }));
  }

  const rows = await AdminUserModel.find().sort({ createdAt: -1 }).limit(500).lean();
  return rows.map((row) => {
    const created = row.createdAt;
    const createdAt =
      created instanceof Date
        ? created.toISOString()
        : typeof created === "string" || typeof created === "number"
          ? new Date(created).toISOString()
          : null;
    const role = normalizeAdminRole(row.role, "member");
    return {
      id: String(row._id),
      email: row.email,
      password: typeof row.passwordPlain === "string" ? row.passwordPlain : "",
      role,
      permissions: dbEffectivePermissions(role, row.permissions),
      createdAt
    };
  });
}

export async function updateAdminUserAccess(
  id: string,
  role: AdminRole,
  permissions: AdminPermission[]
): Promise<void> {
  const normalizedRole = normalizeAdminRole(role, "member");
  const memberPermissions = normalizedRole === "admin" ? [] : sanitizeMemberPermissions(permissions);

  if (!isDatabaseReady()) {
    await updateLocalAdminAccess(id, normalizedRole, memberPermissions);
    return;
  }

  const target = await AdminUserModel.findById(id);
  if (!target) {
    throw new Error("NOT_FOUND");
  }
  const currentRole = normalizeAdminRole(target.role, "member");
  if (currentRole === "admin" && normalizedRole !== "admin") {
    throw new Error("ADMIN_ROLE_PROTECTED");
  }
  target.role = normalizedRole;
  target.permissions = memberPermissions;
  await target.save();
}

export async function updateAdminUserPassword(id: string, password: string): Promise<void> {
  if (id === ENV_ADMIN_ID) {
    throw new Error("ENV_ADMIN");
  }

  if (!isDatabaseReady()) {
    await updateLocalAdminPassword(id, password);
    return;
  }

  const target = await AdminUserModel.findById(id);
  if (!target) {
    throw new Error("NOT_FOUND");
  }
  target.passwordHash = await bcrypt.hash(password, 10);
  target.passwordPlain = password;
  await target.save();
}

export async function updateAdminUserEmail(id: string, email: string): Promise<void> {
  if (id === ENV_ADMIN_ID) {
    throw new Error("ENV_ADMIN");
  }

  const normalized = email.toLowerCase().trim();

  if (!isDatabaseReady()) {
    await updateLocalAdminEmail(id, normalized);
    return;
  }

  const existing = await AdminUserModel.findOne({ email: normalized });
  if (existing && String(existing._id) !== id) {
    throw new Error("EMAIL_IN_USE");
  }

  const target = await AdminUserModel.findById(id);
  if (!target) {
    throw new Error("NOT_FOUND");
  }
  target.email = normalized;
  await target.save();
}

export async function deleteAdminUser(id: string): Promise<void> {
  if (!isDatabaseReady()) {
    await deleteLocalAdminUser(id);
    return;
  }

  const count = await AdminUserModel.countDocuments();
  if (count <= 1) {
    throw new Error("LAST_ADMIN");
  }

  const target = await AdminUserModel.findById(id);
  if (!target) {
    throw new Error("NOT_FOUND");
  }
  if (normalizeAdminRole(target.role, "member") === "admin") {
    throw new Error("ADMIN_PROTECTED");
  }

  const result = await AdminUserModel.deleteOne({ _id: id });
  if (result.deletedCount === 0) {
    throw new Error("NOT_FOUND");
  }
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ valid: boolean; subject: string; role: AdminRole; permissions: AdminPermission[] }> {
  const normalized = email.toLowerCase().trim();

  if (isDatabaseReady()) {
    const admin = await AdminUserModel.findOne({ email: normalized });
    if (admin) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      const role = normalizeAdminRole(admin.role, "member");
      return {
        valid,
        subject: String(admin._id),
        role,
        permissions: dbEffectivePermissions(role, admin.permissions)
      };
    }
    const envMatch =
      normalized === config.adminEmail.toLowerCase() && password === config.adminPassword;
    return {
      valid: envMatch,
      subject: envMatch ? ENV_ADMIN_ID : "",
      role: "admin",
      permissions: effectivePermissions("admin", [])
    };
  }

  return verifyLocalAdminCredentials(normalized, password);
}

export async function countAdmins(): Promise<number> {
  if (isDatabaseReady()) {
    return AdminUserModel.countDocuments({ role: { $in: ["admin", "super_admin"] } });
  }
  return countLocalAdmins();
}
