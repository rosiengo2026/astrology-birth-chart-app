export const ADMIN_ROLES = ["admin", "member"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminPermission =
  | "cms:read"
  | "cms:write"
  | "theme:read"
  | "theme:write"
  | "payment:manage"
  | "admin:manage"
  | "backup:manage"
  | "preview:access";

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  "cms:read",
  "cms:write",
  "theme:read",
  "theme:write",
  "payment:manage",
  "admin:manage",
  "backup:manage",
  "preview:access"
];

/** Permissions an admin can grant to members via checklist — never payment, backup, or user management. */
export const MEMBER_ASSIGNABLE_PERMISSIONS = [
  "cms:read",
  "cms:write",
  "theme:read",
  "theme:write",
  "preview:access"
] as const satisfies readonly AdminPermission[];

export type MemberAssignablePermission = (typeof MEMBER_ASSIGNABLE_PERMISSIONS)[number];

export const ADMIN_ONLY_PERMISSIONS: AdminPermission[] = [
  "payment:manage",
  "admin:manage",
  "backup:manage"
];

export const MEMBER_PERMISSION_LABELS: Record<
  MemberAssignablePermission,
  { en: string; vi: string }
> = {
  "cms:read": { en: "View CMS meanings", vi: "Xem nội dung CMS" },
  "cms:write": { en: "Edit CMS meanings", vi: "Sửa nội dung CMS" },
  "theme:read": { en: "View branding & theme", vi: "Xem giao diện & thương hiệu" },
  "theme:write": { en: "Edit branding & theme", vi: "Sửa giao diện & thương hiệu" },
  "preview:access": { en: "Storefront preview", vi: "Xem trước storefront" }
};

export function normalizeAdminRole(value: unknown, fallback: AdminRole = "member"): AdminRole {
  if (value === "admin" || value === "super_admin") return "admin";
  if (value === "member" || value === "editor" || value === "viewer") return "member";
  return fallback;
}

export function sanitizeMemberPermissions(input: unknown): AdminPermission[] {
  const allowed = new Set<string>(MEMBER_ASSIGNABLE_PERMISSIONS);
  const adminOnly = new Set<string>(ADMIN_ONLY_PERMISSIONS);
  const picked = new Set<AdminPermission>();
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string" && allowed.has(item) && !adminOnly.has(item)) {
        picked.add(item as AdminPermission);
      }
    }
  }
  if (picked.has("cms:write")) picked.add("cms:read");
  if (picked.has("theme:write")) picked.add("theme:read");
  return MEMBER_ASSIGNABLE_PERMISSIONS.filter((permission) => picked.has(permission));
}

export function effectivePermissions(role: AdminRole, memberPermissions: AdminPermission[]): AdminPermission[] {
  if (role === "admin") return [...ALL_ADMIN_PERMISSIONS];
  return sanitizeMemberPermissions(memberPermissions);
}

export function permissionsIncludeAll(
  granted: AdminPermission[],
  required: AdminPermission[]
): boolean {
  const set = new Set(granted);
  return required.every((permission) => set.has(permission));
}
