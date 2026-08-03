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

export const MEMBER_PERMISSION_OPTIONS: Array<{
  id: AdminPermission;
  labelEn: string;
  labelVi: string;
}> = [
  { id: "cms:read", labelEn: "View CMS meanings", labelVi: "Xem nội dung CMS" },
  { id: "cms:write", labelEn: "Edit CMS meanings", labelVi: "Sửa nội dung CMS" },
  { id: "theme:read", labelEn: "View branding & theme", labelVi: "Xem giao diện & thương hiệu" },
  { id: "theme:write", labelEn: "Edit branding & theme", labelVi: "Sửa giao diện & thương hiệu" },
  { id: "preview:access", labelEn: "Storefront preview", labelVi: "Xem trước storefront" }
];

export function normalizeAdminRole(value: unknown, fallback: AdminRole = "member"): AdminRole {
  if (value === "admin" || value === "super_admin") return "admin";
  if (value === "member" || value === "editor" || value === "viewer") return "member";
  return fallback;
}

export function sanitizeMemberPermissions(input: AdminPermission[]): AdminPermission[] {
  const allowed = new Set(MEMBER_PERMISSION_OPTIONS.map((option) => option.id));
  const picked = new Set<AdminPermission>();
  for (const permission of input) {
    if (allowed.has(permission)) picked.add(permission);
  }
  if (picked.has("cms:write")) picked.add("cms:read");
  if (picked.has("theme:write")) picked.add("theme:read");
  return MEMBER_PERMISSION_OPTIONS.map((option) => option.id).filter((id) => picked.has(id));
}

export function hasPermission(
  permissions: AdminPermission[] | undefined,
  permission: AdminPermission,
  role?: AdminRole
): boolean {
  if (permission === "payment:manage" || permission === "admin:manage" || permission === "backup:manage") {
    return role === "admin";
  }
  return Boolean(permissions?.includes(permission));
}

export function roleLabel(role: AdminRole): { en: string; vi: string } {
  if (role === "admin") return { en: "Admin", vi: "Quản trị viên" };
  return { en: "Member", vi: "Thành viên" };
}

export const ADMIN_ROLE_OPTIONS: Array<{
  value: AdminRole;
  labelEn: string;
  labelVi: string;
}> = [
  { value: "admin", labelEn: "Admin — full access", labelVi: "Quản trị viên — toàn quyền" },
  { value: "member", labelEn: "Member — custom permissions", labelVi: "Thành viên — phân quyền tùy chọn" }
];

export function toggleMemberPermission(
  current: AdminPermission[],
  permission: AdminPermission
): AdminPermission[] {
  const next = new Set(current);
  if (next.has(permission)) {
    next.delete(permission);
    if (permission === "cms:read") next.delete("cms:write");
    if (permission === "theme:read") next.delete("theme:write");
  } else {
    next.add(permission);
    if (permission === "cms:write") next.add("cms:read");
    if (permission === "theme:write") next.add("theme:read");
  }
  return sanitizeMemberPermissions([...next]);
}

export function defaultMemberPermissions(): AdminPermission[] {
  return ["cms:read", "theme:read", "preview:access"];
}
