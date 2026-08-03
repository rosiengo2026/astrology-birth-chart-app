"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { bi } from "@/lib/bilingual";
import {
  CHART_GLYPH_FONT_CHOICES,
  defaultSiteTheme,
  resolveBackgroundImageUrl,
  resolveThemeAssetUrl,
  THEME_FONT_CHOICES,
  type SiteThemeSettings
} from "@/lib/siteTheme";
import { BirthChartApp } from "@/components/BirthChartApp";
import { CmsMeaningsBulkEditor } from "@/components/admin/CmsMeaningsBulkEditor";
import {
  ADMIN_ROLE_OPTIONS,
  defaultMemberPermissions,
  hasPermission,
  MEMBER_PERMISSION_OPTIONS,
  roleLabel,
  toggleMemberPermission,
  type AdminPermission,
  type AdminRole
} from "@/lib/adminRoles";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

function adminNoticeClass(text: string): string {
  if (!text) return "text-amber-200";
  const lower = text.toLowerCase();
  if (
    /thất bại|failed|invalid|hết hạn|expired|could not|không tải|offline|error:/.test(lower) &&
    !/thành công|successfully|đã lưu|đã xóa|đã nhập|đã cấp|refreshed latest|mới nhất|branding & theme saved|payment display settings saved/.test(
      lower
    )
  ) {
    return "text-rose-300";
  }
  if (
    /successfully|saved|deleted|imported|thành công|đã lưu|đã xóa|đã nhập|đã cấp|refreshed latest|mới nhất|tạo mục|cập nhật thành công|branding & theme saved|payment display settings saved|đã xong/.test(
      lower
    )
  ) {
    return "text-emerald-300";
  }
  return "text-amber-200";
}

function themeFontSelectOptions(current: string) {
  const base = [...THEME_FONT_CHOICES];
  if (current.trim() && !base.some((o) => o.value === current)) {
    base.push({ value: current, label: `${current} (saved · đã lưu)` });
  }
  return base;
}

function chartGlyphFontSelectOptions(current: string) {
  const base = [...CHART_GLYPH_FONT_CHOICES];
  if (current.trim() && !base.some((o) => o.value === current)) {
    base.push({ value: current, label: `${current} (saved · đã lưu)` });
  }
  return base;
}

export default function AdminPage() {
  /** Must match server first paint — read localStorage in useEffect to avoid hydration mismatch. */
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState<string>("");
  const [cmsRefreshSignal, setCmsRefreshSignal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [adminTab, setAdminTab] = useState<"manage" | "preview">("manage");
  const [importing, setImporting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBackupBusy, setImportBackupBusy] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    vietqrImageUrl: "",
    vietqrInstructionsVi: "",
    vietqrInstructionsEn: "",
    paypalUnlockUrl: "",
    paypalQrImageUrl: "",
    envFallbackQrUrl: "",
    envFallbackPaypalUrl: "",
    aspectUnlockPriceVnd: 0,
    aspectUnlockPriceUsd: 0
  });
  const [paymentMessage, setPaymentMessage] = useState("");
  const [themeForm, setThemeForm] = useState<SiteThemeSettings>(defaultSiteTheme);
  const [themeMessage, setThemeMessage] = useState("");
  const [logoUploadBusy, setLogoUploadBusy] = useState(false);
  const [vietqrUploadBusy, setVietqrUploadBusy] = useState(false);
  const [paypalQrUploadBusy, setPaypalQrUploadBusy] = useState(false);
  const [backgroundUploadBusy, setBackgroundUploadBusy] = useState(false);
  const [adminUsers, setAdminUsers] = useState<
    Array<{
      id: string;
      email: string;
      password: string;
      role: AdminRole;
      permissions: AdminPermission[];
      createdAt: string | null;
    }>
  >([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminUserBusy, setAdminUserBusy] = useState(false);
  const [adminUserMessage, setAdminUserMessage] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("member");
  const [newAdminPermissions, setNewAdminPermissions] = useState<AdminPermission[]>(defaultMemberPermissions());
  const [adminProfile, setAdminProfile] = useState<{
    id: string;
    email: string;
    role: AdminRole;
    permissions: AdminPermission[];
  } | null>(null);
  const [setupAvailable, setSetupAvailable] = useState(false);
  const backendBackupInputRef = useRef<HTMLInputElement | null>(null);
  const vietqrFileInputRef = useRef<HTMLInputElement | null>(null);
  const paypalQrFileInputRef = useRef<HTMLInputElement | null>(null);
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("adminToken");
    setToken("");
    setAdminProfile(null);
    setMessage(bi("Session expired or invalid token. Please sign in again.", "Phiên hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại."));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminToken");
    setToken("");
    setAdminProfile(null);
    setMessage("");
  }, []);

  const can = useCallback(
    (permission: AdminPermission) =>
      hasPermission(adminProfile?.permissions, permission, adminProfile?.role),
    [adminProfile?.permissions, adminProfile?.role]
  );

  const loadAdminProfile = useCallback(
    async (currentToken = token) => {
      if (!currentToken) return;
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as {
          id: string;
          email: string;
          role: AdminRole;
          permissions: AdminPermission[];
        };
        setAdminProfile(data);
      } catch {
        /* ignore */
      }
    },
    [token, handleUnauthorized]
  );

  useEffect(() => {
    const stored = localStorage.getItem("adminToken");
    if (stored) setToken(stored);
  }, []);

  const loadThemeSettings = useCallback(
    async (currentToken = token) => {
      if (!currentToken) return;
      try {
        const response = await fetch(`${API_URL}/cms/theme-settings`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as Partial<SiteThemeSettings>;
        setThemeForm({ ...defaultSiteTheme, ...data });
      } catch {
        /* ignore */
      }
    },
    [token, handleUnauthorized]
  );

  const loadPaymentSettings = useCallback(
    async (currentToken = token) => {
      if (!currentToken) return;
      try {
        const response = await fetch(`${API_URL}/cms/payment-settings`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as {
          vietqrImageUrl?: string;
          vietqrInstructionsVi?: string;
          vietqrInstructionsEn?: string;
          paypalUnlockUrl?: string;
          paypalQrImageUrl?: string;
          aspectUnlockPriceVnd?: number;
          aspectUnlockPriceUsd?: number;
          envFallbackQrUrl?: string;
          envFallbackPaypalUrl?: string;
        };
        setPaymentForm({
          vietqrImageUrl: data.vietqrImageUrl ?? "",
          vietqrInstructionsVi: data.vietqrInstructionsVi ?? "",
          vietqrInstructionsEn: data.vietqrInstructionsEn ?? "",
          paypalUnlockUrl: data.paypalUnlockUrl ?? "",
          paypalQrImageUrl: data.paypalQrImageUrl ?? "",
          envFallbackQrUrl: data.envFallbackQrUrl ?? "",
          envFallbackPaypalUrl: data.envFallbackPaypalUrl ?? "",
          aspectUnlockPriceVnd: typeof data.aspectUnlockPriceVnd === "number" ? data.aspectUnlockPriceVnd : 0,
          aspectUnlockPriceUsd: typeof data.aspectUnlockPriceUsd === "number" ? data.aspectUnlockPriceUsd : 0
        });
      } catch {
        /* ignore */
      }
    },
    [token, handleUnauthorized]
  );

  const loadAdminUsers = useCallback(
    async (currentToken = token) => {
      if (!currentToken) return;
      setAdminUsersLoading(true);
      try {
        const response = await fetch(`${API_URL}/cms/admin-users`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) {
          setAdminUserMessage(bi("Could not load admin accounts.", "Không tải được danh sách tài khoản admin."));
          return;
        }
        const data = (await response.json()) as {
          users?: Array<{
            id: string;
            email: string;
            password: string;
            role: AdminRole;
            permissions?: AdminPermission[];
            createdAt: string | null;
          }>;
        };
        setAdminUsers(
          Array.isArray(data.users)
            ? data.users.map((user) => ({
                ...user,
                permissions: Array.isArray(user.permissions) ? user.permissions : defaultMemberPermissions()
              }))
            : []
        );
      } catch {
        setAdminUserMessage(bi("Could not load admin accounts.", "Không tải được danh sách tài khoản admin."));
      } finally {
        setAdminUsersLoading(false);
      }
    },
    [token, handleUnauthorized]
  );

  function refreshMeanings() {
    setRefreshing(true);
    setCmsRefreshSignal((n) => n + 1);
    setTimeout(() => {
      setRefreshing(false);
      setMessage(bi("Refreshed latest data.", "Đã tải lại dữ liệu mới nhất."));
    }, 300);
  }

  useEffect(() => {
    if (!token) return;
    void loadAdminProfile(token);
  }, [token, loadAdminProfile]);

  useEffect(() => {
    if (!token || !adminProfile) return;
    const perms = adminProfile.permissions;
    const role = adminProfile.role;
    if (hasPermission(perms, "theme:read", role)) void loadThemeSettings(token);
    if (hasPermission(perms, "payment:manage", role)) void loadPaymentSettings(token);
    if (hasPermission(perms, "admin:manage", role)) void loadAdminUsers(token);
  }, [token, adminProfile, loadPaymentSettings, loadThemeSettings, loadAdminUsers]);

  useEffect(() => {
    if (!token) return;
    const refreshProfile = () => void loadAdminProfile(token);
    window.addEventListener("focus", refreshProfile);
    return () => window.removeEventListener("focus", refreshProfile);
  }, [token, loadAdminProfile]);

  useEffect(() => {
    if (token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/setup-status`);
        const data = (await response.json().catch(() => null)) as { setupAvailable?: boolean } | null;
        if (!cancelled && data && typeof data.setupAvailable === "boolean") {
          setSetupAvailable(data.setupAvailable);
        }
      } catch {
        if (!cancelled) setSetupAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function createAdminUserAccount() {
    const em = newAdminEmail.trim();
    const pw = newAdminPassword;
    if (!em) {
      setAdminUserMessage(bi("Enter an email.", "Nhập email."));
      return;
    }
    if (pw.trim().length < 6) {
      setAdminUserMessage(bi("Password must be at least 6 characters.", "Mật khẩu tối thiểu 6 ký tự."));
      return;
    }
    if (adminUserBusy || !token) return;
    setAdminUserBusy(true);
    setAdminUserMessage("");
    try {
      const response = await fetch(`${API_URL}/cms/admin-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: em,
          password: pw,
          role: newAdminRole,
          permissions: newAdminRole === "admin" ? [] : newAdminPermissions
        })
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        const errText =
          typeof payload?.error === "string"
            ? payload.error
            : bi("Could not create admin account.", "Không tạo được tài khoản admin.");
        setAdminUserMessage(errText);
        return;
      }
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminRole("member");
      setNewAdminPermissions(defaultMemberPermissions());
      setAdminUserMessage(bi("Admin account created.", "Đã tạo tài khoản admin."));
      await loadAdminUsers(token);
    } catch {
      setAdminUserMessage(bi("Network error.", "Lỗi mạng."));
    } finally {
      setAdminUserBusy(false);
    }
  }

  async function updateAdminUserAccess(
    id: string,
    role: AdminRole,
    permissions: AdminPermission[]
  ) {
    if (!token || adminUserBusy) return;
    setAdminUserBusy(true);
    setAdminUserMessage("");
    try {
      const response = await fetch(`${API_URL}/cms/admin-users/${id}/access`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role,
          permissions: role === "admin" ? [] : permissions
        })
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        const errText =
          typeof payload?.error === "string"
            ? payload.error
            : bi("Could not update access.", "Không cập nhật được phân quyền.");
        setAdminUserMessage(errText);
        return;
      }
      setAdminUserMessage(bi("Access updated.", "Đã cập nhật phân quyền."));
      await loadAdminUsers(token);
    } catch {
      setAdminUserMessage(bi("Network error.", "Lỗi mạng."));
    } finally {
      setAdminUserBusy(false);
    }
  }

  function patchAdminUserDraft(
    id: string,
    patch: Partial<{ role: AdminRole; permissions: AdminPermission[] }>
  ) {
    setAdminUsers((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        const role = patch.role ?? row.role;
        const permissions =
          role === "admin"
            ? []
            : patch.permissions ?? (patch.role === "member" ? defaultMemberPermissions() : row.permissions);
        return { ...row, role, permissions };
      })
    );
  }

  async function removeAdminUserAccount(id: string) {
    if (!token || adminUserBusy) return;
    setAdminUserBusy(true);
    setAdminUserMessage("");
    try {
      const response = await fetch(`${API_URL}/cms/admin-users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        const errText =
          typeof payload?.error === "string"
            ? payload.error
            : bi("Could not delete admin account.", "Không xóa được tài khoản admin.");
        setAdminUserMessage(errText);
        return;
      }
      setAdminUserMessage(bi("Admin account deleted.", "Đã xóa tài khoản admin."));
      await loadAdminUsers(token);
    } catch {
      setAdminUserMessage(bi("Network error.", "Lỗi mạng."));
    } finally {
      setAdminUserBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error || bi("Login failed.", "Đăng nhập thất bại."));
      return;
    }
    const data = await response.json();
    localStorage.setItem("adminToken", data.token);
    setToken(data.token);
    if (data.role && Array.isArray(data.permissions)) {
      setAdminProfile({
        id: "",
        email: email.trim(),
        role: data.role,
        permissions: data.permissions
      });
    }
  }

  async function exportJson() {
    if (!can("backup:manage")) {
      setMessage(bi("You do not have permission to export data.", "Bạn không có quyền xuất dữ liệu."));
      return;
    }
    const response = await fetch(`${API_URL}/cms/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cms-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function uploadLogoFile(file: File | null) {
    if (!file || !token) return;
    setLogoUploadBusy(true);
    setThemeMessage("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const response = await fetch(`${API_URL}/cms/upload-logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        logoUrl?: string;
        theme?: SiteThemeSettings;
        error?: string;
      } | null;
      if (!response.ok) {
        setThemeMessage(data?.error ?? bi("Upload failed.", "Tải lên thất bại."));
        return;
      }
      if (data?.theme) {
        setThemeForm({ ...defaultSiteTheme, ...data.theme });
      } else if (data?.logoUrl) {
        setThemeForm((t) => ({ ...t, logoUrl: data.logoUrl! }));
      }
      setThemeMessage(bi("Logo uploaded and saved to theme.", "Đã tải và lưu logo vào theme."));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("astro-theme-updated"));
      }
    } catch {
      setThemeMessage(bi("Upload failed (network).", "Tải lên thất bại (lỗi mạng)."));
    } finally {
      setLogoUploadBusy(false);
    }
  }

  async function uploadVietQrFile(file: File | null) {
    if (!file || !token) return;
    setVietqrUploadBusy(true);
    setPaymentMessage("");
    try {
      const fd = new FormData();
      fd.append("vietqr", file);
      const response = await fetch(`${API_URL}/cms/upload-vietqr`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        vietqrImageUrl?: string;
        paymentSettings?: typeof paymentForm;
        error?: string;
      } | null;
      if (!response.ok) {
        setPaymentMessage(data?.error ?? bi("Upload failed.", "Tải lên thất bại."));
        return;
      }
      if (data?.paymentSettings) {
        setPaymentForm((prev) => ({
          ...prev,
          vietqrImageUrl: data.paymentSettings!.vietqrImageUrl ?? prev.vietqrImageUrl,
          vietqrInstructionsVi: data.paymentSettings!.vietqrInstructionsVi ?? prev.vietqrInstructionsVi,
          vietqrInstructionsEn: data.paymentSettings!.vietqrInstructionsEn ?? prev.vietqrInstructionsEn,
          paypalUnlockUrl: data.paymentSettings!.paypalUnlockUrl ?? prev.paypalUnlockUrl,
          paypalQrImageUrl: data.paymentSettings!.paypalQrImageUrl ?? prev.paypalQrImageUrl,
          aspectUnlockPriceVnd: data.paymentSettings!.aspectUnlockPriceVnd ?? prev.aspectUnlockPriceVnd,
          aspectUnlockPriceUsd: data.paymentSettings!.aspectUnlockPriceUsd ?? prev.aspectUnlockPriceUsd
        }));
      } else if (data?.vietqrImageUrl) {
        setPaymentForm((p) => ({ ...p, vietqrImageUrl: data.vietqrImageUrl! }));
      }
      setPaymentMessage(bi("VietQR image uploaded and saved.", "Đã tải và lưu ảnh mã QR VietQR."));
    } catch {
      setPaymentMessage(bi("Upload failed (network).", "Tải lên thất bại (lỗi mạng)."));
    } finally {
      setVietqrUploadBusy(false);
      if (vietqrFileInputRef.current) vietqrFileInputRef.current.value = "";
    }
  }

  async function uploadPaypalQrFile(file: File | null) {
    if (!file || !token) return;
    setPaypalQrUploadBusy(true);
    setPaymentMessage("");
    try {
      const fd = new FormData();
      fd.append("paypalQr", file);
      const response = await fetch(`${API_URL}/cms/upload-paypal-qr`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        paypalQrImageUrl?: string;
        paymentSettings?: typeof paymentForm;
        error?: string;
      } | null;
      if (!response.ok) {
        setPaymentMessage(data?.error ?? bi("Upload failed.", "Tải lên thất bại."));
        return;
      }
      if (data?.paymentSettings) {
        setPaymentForm((prev) => ({
          ...prev,
          paypalQrImageUrl: data.paymentSettings!.paypalQrImageUrl ?? prev.paypalQrImageUrl,
          vietqrImageUrl: data.paymentSettings!.vietqrImageUrl ?? prev.vietqrImageUrl,
          vietqrInstructionsVi: data.paymentSettings!.vietqrInstructionsVi ?? prev.vietqrInstructionsVi,
          vietqrInstructionsEn: data.paymentSettings!.vietqrInstructionsEn ?? prev.vietqrInstructionsEn,
          paypalUnlockUrl: data.paymentSettings!.paypalUnlockUrl ?? prev.paypalUnlockUrl,
          aspectUnlockPriceVnd: data.paymentSettings!.aspectUnlockPriceVnd ?? prev.aspectUnlockPriceVnd,
          aspectUnlockPriceUsd: data.paymentSettings!.aspectUnlockPriceUsd ?? prev.aspectUnlockPriceUsd
        }));
      } else if (data?.paypalQrImageUrl) {
        setPaymentForm((p) => ({ ...p, paypalQrImageUrl: data.paypalQrImageUrl! }));
      }
      setPaymentMessage(bi("PayPal QR image uploaded and saved.", "Đã tải và lưu ảnh QR PayPal."));
    } catch {
      setPaymentMessage(bi("Upload failed (network).", "Tải lên thất bại (lỗi mạng)."));
    } finally {
      setPaypalQrUploadBusy(false);
      if (paypalQrFileInputRef.current) paypalQrFileInputRef.current.value = "";
    }
  }

  async function uploadBackgroundFile(file: File | null) {
    if (!file || !token) return;
    setBackgroundUploadBusy(true);
    setThemeMessage("");
    try {
      const fd = new FormData();
      fd.append("background", file);
      const response = await fetch(`${API_URL}/cms/upload-background`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        backgroundImageUrl?: string;
        theme?: SiteThemeSettings;
        error?: string;
      } | null;
      if (!response.ok) {
        setThemeMessage(data?.error ?? bi("Upload failed.", "Tải lên thất bại."));
        return;
      }
      if (data?.theme) {
        setThemeForm({ ...defaultSiteTheme, ...data.theme });
      } else if (data?.backgroundImageUrl) {
        setThemeForm((t) => ({ ...t, backgroundImageUrl: data.backgroundImageUrl! }));
      }
      setThemeMessage(bi("Background image uploaded and saved.", "Đã tải và lưu ảnh nền."));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("astro-theme-updated"));
      }
    } catch {
      setThemeMessage(bi("Upload failed (network).", "Tải lên thất bại (lỗi mạng)."));
    } finally {
      setBackgroundUploadBusy(false);
    }
  }

  async function saveThemeSettings(event: React.FormEvent) {
    event.preventDefault();
    setThemeMessage("");
    const response = await fetch(`${API_URL}/cms/theme-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(themeForm)
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      setThemeMessage(bi("Save failed.", "Lưu thất bại."));
      return;
    }
    const saved = (await response.json()) as SiteThemeSettings;
    setThemeForm({ ...defaultSiteTheme, ...saved });
    setThemeMessage(bi("Branding & theme saved.", "Đã lưu giao diện & thương hiệu."));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("astro-theme-updated"));
    }
  }

  async function savePaymentSettings(event: React.FormEvent) {
    event.preventDefault();
    setPaymentMessage("");
    const response = await fetch(`${API_URL}/cms/payment-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        vietqrImageUrl: paymentForm.vietqrImageUrl,
        vietqrInstructionsVi: paymentForm.vietqrInstructionsVi,
        vietqrInstructionsEn: paymentForm.vietqrInstructionsEn,
        paypalUnlockUrl: paymentForm.paypalUnlockUrl,
        paypalQrImageUrl: paymentForm.paypalQrImageUrl,
        aspectUnlockPriceVnd: paymentForm.aspectUnlockPriceVnd,
        aspectUnlockPriceUsd: paymentForm.aspectUnlockPriceUsd
      })
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!response.ok) {
      setPaymentMessage(bi("Save failed.", "Lưu thất bại."));
      return;
    }
    setPaymentMessage(bi("Payment display settings saved.", "Đã lưu cấu hình hiển thị thanh toán."));
    await loadPaymentSettings();
  }

  async function importFromJson() {
    if (!can("backup:manage")) {
      setMessage(bi("You do not have permission to import data.", "Bạn không có quyền nhập dữ liệu."));
      return;
    }
    if (!importJson.trim()) {
      setMessage(bi("Paste JSON payload before importing.", "Hãy dán nội dung JSON trước khi nhập."));
      return;
    }
    try {
      setImporting(true);
      setMessage("");
      const parsed = JSON.parse(importJson);
      const importResponse = await fetch(`${API_URL}/cms/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(parsed)
      });
      if (importResponse.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!importResponse.ok) {
        const payload = (await importResponse.json().catch(() => null)) as { error?: unknown } | null;
        const textError =
          typeof payload?.error === "string"
            ? payload.error
            : bi("Import failed. Invalid payload.", "Nhập thất bại. Payload JSON không hợp lệ.");
        setMessage(textError);
        return;
      }
      // Re-fetch to also detect auth failure after import call.
      const verify = await fetch(`${API_URL}/cms/meanings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (verify.status === 401) {
        handleUnauthorized();
        return;
      }
      setImportJson("");
      setCmsRefreshSignal((n) => n + 1);
      setMessage(bi("Imported.", "Đã nhập xong."));
    } catch {
      setMessage(bi("Invalid JSON import payload.", "Payload JSON không hợp lệ."));
    } finally {
      setImporting(false);
    }
  }

  async function backupBackendData() {
    if (!can("backup:manage")) {
      setMessage(bi("You do not have permission to backup data.", "Bạn không có quyền sao lưu dữ liệu."));
      return;
    }
    if (!token || backupBusy) return;
    setBackupBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/cms/backup`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        setMessage(bi("Backup failed.", "Sao lưu thất bại."));
        return;
      }
      const data = await response.json();
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `astro-backup-backend-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(bi("Backend backup downloaded.", "Đã tải file backup backend."));
    } catch {
      setMessage(bi("Backup failed (network).", "Sao lưu thất bại (lỗi mạng)."));
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackendBackupFile(file: File | null) {
    if (!can("backup:manage")) {
      setMessage(bi("You do not have permission to import backup.", "Bạn không có quyền nhập backup."));
      return;
    }
    if (!file || !token || importBackupBusy) return;
    setImportBackupBusy(true);
    setMessage("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const response = await fetch(`${API_URL}/cms/backup/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(parsed)
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        const errText =
          typeof payload?.error === "string"
            ? payload.error
            : bi("Import backup failed.", "Nhập backup thất bại.");
        setMessage(errText);
        return;
      }
      setCmsRefreshSignal((n) => n + 1);
      await loadPaymentSettings(token);
      await loadThemeSettings(token);
      setMessage(bi("Backend backup imported.", "Đã nhập backup backend."));
    } catch {
      setMessage(bi("Invalid backup JSON file.", "File backup JSON không hợp lệ."));
    } finally {
      setImportBackupBusy(false);
      if (backendBackupInputRef.current) backendBackupInputRef.current.value = "";
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md rounded-2xl border border-amber-500/35 bg-black/85 p-8 shadow-[0_8px_48px_rgba(0,0,0,0.65)] backdrop-blur-md">
        <h1 className="mb-1 text-xl font-semibold text-white">{bi("Admin login", "Đăng nhập quản trị")}</h1>
        <p className="mb-4 text-sm text-amber-200">{bi("Sign in with your admin email and password.", "Đăng nhập bằng email và mật khẩu quản trị.")}</p>
        <form className="space-y-3" onSubmit={login}>
          <div>
            <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Email", "Email")}</label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Password", "Mật khẩu")}</label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500" type="submit">
            {bi("Sign in", "Đăng nhập")}
          </button>
          {message && <p className={`text-xs ${adminNoticeClass(message)}`}>{message}</p>}
          {setupAvailable && (
            <p className="text-xs text-amber-200">
              {bi("No admin yet?", "Chưa có admin?")}{" "}
              <Link href="/admin/setup" className="font-medium text-amber-400 underline hover:text-amber-300">
                {bi("Create first admin account", "Tạo tài khoản admin đầu tiên")}
              </Link>
            </p>
          )}
        </form>
      </main>
    );
  }

  const themeReadOnly = !can("theme:write");
  const cmsReadOnly = !can("cms:write");

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-black/80 px-4 py-3 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div>
          <h1 className="text-lg font-semibold text-white">{bi("Admin panel", "Trang quản trị")}</h1>
          {adminProfile && (
            <p className="mt-1 text-xs text-amber-200">
              {adminProfile.email} · {bi(roleLabel(adminProfile.role).en, roleLabel(adminProfile.role).vi)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded border border-zinc-500 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-500/50 hover:bg-zinc-800"
        >
          {bi("Log out", "Đăng xuất")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-amber-500/35 bg-black/80 p-2 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => setAdminTab("manage")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            adminTab === "manage"
              ? "bg-amber-600 text-white"
              : "border border-zinc-600 text-amber-100 hover:bg-zinc-900"
          }`}
        >
          {bi("CMS & settings", "Quản trị CMS")}
        </button>
        {can("preview:access") && (
        <button
          type="button"
          onClick={() => setAdminTab("preview")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            adminTab === "preview"
              ? "bg-amber-600 text-white"
              : "border border-zinc-600 text-amber-100 hover:bg-zinc-900"
          }`}
        >
          {bi("Storefront preview", "Xem trước storefront")}
        </button>
        )}
      </div>

      {adminTab === "preview" && can("preview:access") ? (
        <BirthChartApp unlockAspects adminToken={token} />
      ) : !adminProfile ? (
        <p className="rounded-xl border border-amber-500/35 bg-black/80 p-4 text-sm text-amber-200">
          {bi("Loading permissions…", "Đang tải phân quyền…")}
        </p>
      ) : (
        <>
      {can("theme:read") && (
      <section className="rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white">
          {bi("Branding & theme", "Giao diện & thương hiệu")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-200">
          {bi(
            "Set logo URL, page and panel colors, text colors (body, headings, labels, links, warnings, errors), and fonts per role. The storefront loads these via the public endpoint",
            "Đặt URL logo, màu trang và khối, màu chữ (nội dung, tiêu đề, nhãn, link, cảnh báo, lỗi) và font theo từng vai trò. Trang chủ tải qua API công khai"
          )}{" "}
          <code className="rounded bg-zinc-900 px-1 font-mono text-[11px] text-amber-200">GET /theme-settings</code>.
        </p>
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-zinc-950/95 px-3 py-2 text-xs leading-relaxed text-amber-200">
          {bi(
            "Scope: public storefront only. These colors and fonts do not theme this admin UI (admin stays on the fixed slate layout). The API only stores and serves settings for the front end.",
            "Phạm vi: chỉ trang chủ / storefront công khai. Màu và font này không đổi giao diện quản trị (admin vẫn dùng bố cục slate cố định). API chỉ lưu và phục vụ cấu hình cho front end."
          )}
        </p>
        <form className="mt-4 space-y-4" onSubmit={saveThemeSettings}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white">
              {bi(
                "Logo — external URL or upload a file below",
                "Logo — dán URL ảnh hoặc tải file từ máy bên dưới"
              )}
            </label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={themeForm.logoUrl}
              onChange={(e) => setThemeForm((t) => ({ ...t, logoUrl: e.target.value }))}
              placeholder={bi("https://cdn.example.com/logo.png or /api/uploads/… after upload", "https://… hoặc /api/uploads/… sau khi upload")}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="sr-only"
                  disabled={logoUploadBusy}
                  onChange={(e) => void uploadLogoFile(e.target.files?.[0] ?? null)}
                />
                {logoUploadBusy ? bi("Uploading…", "Đang tải…") : bi("Choose logo file", "Chọn file logo")}
              </label>
              <span className="text-xs text-amber-200">
                {bi("PNG, JPG, GIF, WebP, SVG · max 2 MB · stored under data/uploads on the API server", "PNG, JPG, GIF, WebP, SVG · tối đa 2 MB · lưu trong data/uploads trên server API")}
              </span>
            </div>
            {themeForm.logoUrl.trim() ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-zinc-700 bg-zinc-950/80 p-2">
                <span className="text-xs font-medium text-amber-100">{bi("Preview", "Xem trước")}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveThemeAssetUrl(themeForm.logoUrl)}
                  alt=""
                  className="max-h-14 max-w-[200px] object-contain"
                  onError={(ev) => {
                    (ev.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white">
              {bi(
                "Background image — URL or upload (full-page cover behind content)",
                "Ảnh nền — dán URL hoặc tải file (phủ toàn trang phía sau nội dung)"
              )}
            </label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={themeForm.backgroundImageUrl}
              onChange={(e) => setThemeForm((t) => ({ ...t, backgroundImageUrl: e.target.value }))}
              placeholder={bi(
                "Leave empty for built-in default, or https://… or /api/uploads/…",
                "Để trống dùng ảnh mặc định, hoặc https://… hoặc /api/uploads/…"
              )}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded border border-zinc-600 bg-zinc-950 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="sr-only"
                  disabled={backgroundUploadBusy}
                  onChange={(e) => void uploadBackgroundFile(e.target.files?.[0] ?? null)}
                />
                {backgroundUploadBusy ? bi("Uploading…", "Đang tải…") : bi("Choose background file", "Chọn ảnh nền")}
              </label>
              <span className="text-xs text-amber-200">
                {bi("PNG, JPG, GIF, WebP, SVG · max 4 MB", "PNG, JPG, GIF, WebP, SVG · tối đa 4 MB")}
              </span>
            </div>
            {themeForm.backgroundImageUrl.trim() ? (
              <div className="mt-3 overflow-hidden rounded border border-zinc-700 bg-zinc-950/80">
                <span className="block border-b border-zinc-700 px-2 py-1 text-xs font-medium text-amber-100">
                  {bi("Preview (crop)", "Xem trước (cắt)")}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveBackgroundImageUrl(themeForm.backgroundImageUrl)}
                  alt=""
                  className="h-28 w-full object-cover"
                  onError={(ev) => {
                    (ev.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-200">
                {bi(
                  "Empty = storefront uses the default image from site CSS (see globals.css).",
                  "Để trống = trang dùng ảnh mặc định trong CSS (xem globals.css)."
                )}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-white">
              {bi("Site title (main heading)", "Tiêu đề trang / tên thương hiệu")}
            </label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={themeForm.siteTitle}
              onChange={(e) => setThemeForm((t) => ({ ...t, siteTitle: e.target.value }))}
              placeholder="Blogchiemtinh.com"
            />
            <p className="mt-1 text-xs text-amber-200">
              {bi(
                "Shown as the large title on the home page (next to the logo) and as the browser tab title.",
                "Hiển thị làm tiêu đề lớn trên trang chủ (bên cạnh logo) và làm tiêu đề tab trình duyệt."
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["backgroundColor", bi("Page background", "Nền trang")],
                ["surfaceColor", bi("Panel color (blended on storefront)", "Màu khối / panel (pha trên storefront)")],
                ["panelBorderColor", bi("Borders", "Viền ô")],
                ["bodyTextColor", bi("Main body text", "Chữ nội dung chính")],
                ["mutedTextColor", bi("Secondary / labels", "Chữ phụ / nhãn")],
                ["headingTextColor", bi("Headings", "Tiêu đề")],
                ["linkColor", bi("Links", "Liên kết")],
                ["linkHoverColor", bi("Links on hover", "Liên kết khi hover")],
                ["warningTextColor", bi("Warnings / emphasis", "Cảnh báo / nhấn mạnh")],
                ["errorTextColor", bi("Errors / validation", "Lỗi / validation")]
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-amber-100">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-10 w-14 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-0"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(themeForm[key])
                        ? themeForm[key]
                        : themeForm[key].length === 4 && themeForm[key].startsWith("#")
                          ? `#${themeForm[key][1]}${themeForm[key][1]}${themeForm[key][2]}${themeForm[key][2]}${themeForm[key][3]}${themeForm[key][3]}`
                          : "#000000"
                    }
                    onChange={(e) => setThemeForm((t) => ({ ...t, [key]: e.target.value }))}
                  />
                  <input
                    className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-950 p-2 font-mono text-xs text-white"
                    value={themeForm[key]}
                    onChange={(e) => setThemeForm((t) => ({ ...t, [key]: e.target.value }))}
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["fontBody", bi("Font — body paragraphs", "Font — đoạn văn")],
                ["fontHeading", bi("Font — headings", "Font — tiêu đề")],
                ["fontUi", bi("Font — form labels / small UI", "Font — nhãn form / UI nhỏ")],
                ["fontLink", bi("Font — hyperlinks", "Font — liên kết")],
                ["fontWarning", bi("Font — warnings & errors", "Font — cảnh báo & lỗi")],
                ["fontCode", bi("Font — code / monospace", "Font — code / monospace")]
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-amber-100">{label}</label>
                <select
                  className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white [color-scheme:dark]"
                  value={themeForm[key]}
                  onChange={(e) => setThemeForm((t) => ({ ...t, [key]: e.target.value }))}
                >
                  {themeFontSelectOptions(themeForm[key]).map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/25 bg-zinc-950/60 p-3">
            <h3 className="text-sm font-semibold text-white">
              {bi("Natal chart wheel", "Bánh xe lá số natal")}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-200">
              {bi(
                "Customize aspect line colors and fonts for zodiac sign glyphs (♈♉…) and planet glyphs (☉☽☿…) on the chart wheel.",
                "Tùy chỉnh màu đường aspect và font ký hiệu cung (♈♉…) cùng hành tinh (☉☽☿…) trên bánh xe lá số."
              )}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["aspectColorConjunction", bi("Conjunction ☌", "Hợp ☌")],
                  ["aspectColorSextile", bi("Sextile ✶", "Lục hợp ✶")],
                  ["aspectColorSquare", bi("Square □", "Vuông □")],
                  ["aspectColorTrine", bi("Trine △", "Tam hợp △")],
                  ["aspectColorOpposition", bi("Opposition ☍", "Đối ☍")]
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-amber-100">{label}</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className="h-10 w-14 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-0"
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(themeForm[key])
                          ? themeForm[key]
                          : themeForm[key].length === 4 && themeForm[key].startsWith("#")
                            ? `#${themeForm[key][1]}${themeForm[key][1]}${themeForm[key][2]}${themeForm[key][2]}${themeForm[key][3]}${themeForm[key][3]}`
                            : "#000000"
                      }
                      onChange={(e) => setThemeForm((t) => ({ ...t, [key]: e.target.value }))}
                    />
                    <input
                      className="min-w-0 flex-1 rounded border border-zinc-600 bg-zinc-950 p-2 font-mono text-xs text-white"
                      value={themeForm[key]}
                      onChange={(e) => setThemeForm((t) => ({ ...t, [key]: e.target.value }))}
                      placeholder="#RRGGBB"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-100">
                  {bi("Font — zodiac sign glyphs", "Font — ký hiệu cung hoàng đạo")}
                </label>
                <select
                  className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white [color-scheme:dark]"
                  value={themeForm.fontChartSign}
                  onChange={(e) => setThemeForm((t) => ({ ...t, fontChartSign: e.target.value }))}
                >
                  {chartGlyphFontSelectOptions(themeForm.fontChartSign).map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-amber-300/90">
                  {bi("Preview:", "Xem trước:")}{" "}
                  <span
                    className="text-lg text-white"
                    style={{ fontFamily: `'${themeForm.fontChartSign}', serif` }}
                  >
                    ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓
                  </span>
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-amber-100">
                  {bi("Font — planet glyphs", "Font — ký hiệu hành tinh")}
                </label>
                <select
                  className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white [color-scheme:dark]"
                  value={themeForm.fontChartPlanet}
                  onChange={(e) => setThemeForm((t) => ({ ...t, fontChartPlanet: e.target.value }))}
                >
                  {chartGlyphFontSelectOptions(themeForm.fontChartPlanet).map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[11px] text-amber-300/90">
                  {bi("Preview:", "Xem trước:")}{" "}
                  <span
                    className="text-lg text-white"
                    style={{ fontFamily: `'${themeForm.fontChartPlanet}', serif` }}
                  >
                    ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ☊ ☋
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={themeReadOnly}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
          >
            {bi("Save branding & theme", "Lưu giao diện & thương hiệu")}
          </button>
          {themeReadOnly && (
            <p className="text-xs text-amber-300">
              {bi("View-only — you cannot edit theme settings.", "Chỉ xem — bạn không có quyền chỉnh giao diện.")}
            </p>
          )}
          {themeMessage && <p className={`text-xs ${adminNoticeClass(themeMessage)}`}>{themeMessage}</p>}
        </form>
      </section>
      )}

      {can("payment:manage") && (
      <section className="rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white">
          {bi("Payment — VietQR & PayPal", "Thanh toán — VietQR & PayPal")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-200">
          {bi(
            "Configure VietQR display, unlock prices (VND / USD reference), and PayPal hosted-button URL.",
            "Cấu hình hiển thị VietQR, giá mở khóa (VND / tham chiếu USD) và URL PayPal (hosted checkout)."
          )}
        </p>
        <form className="mt-3 space-y-3" onSubmit={savePaymentSettings}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">
                {bi("Unlock amount (VND)", "Số tiền mở khóa (VND)")}
              </label>
              <input
                type="number"
                min={0}
                step={1}
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
                value={paymentForm.aspectUnlockPriceVnd}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, aspectUnlockPriceVnd: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">
                {bi("Reference amount (USD) for PayPal", "Số tham chiếu (USD) cho PayPal")}
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
                value={paymentForm.aspectUnlockPriceUsd}
                onChange={(e) =>
                  setPaymentForm((p) => ({ ...p, aspectUnlockPriceUsd: Math.max(0, Number(e.target.value) || 0) }))
                }
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-amber-100">
              {bi("VietQR code image", "Ảnh mã QR VietQR")}
            </label>
            <input
              ref={vietqrFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              disabled={vietqrUploadBusy}
              onChange={(e) => void uploadVietQrFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={vietqrUploadBusy}
              onClick={() => vietqrFileInputRef.current?.click()}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {vietqrUploadBusy
                ? bi("Uploading…", "Đang tải lên…")
                : bi("Upload QR image", "Tải ảnh QR lên")}
            </button>
            <p className="mt-2 text-xs text-amber-200">
              {bi(
                "PNG, JPG, GIF, WebP, SVG · max 2 MB · stored on the API server",
                "PNG, JPG, GIF, WebP, SVG · tối đa 2 MB · lưu trên server API"
              )}
            </p>
            {paymentForm.vietqrImageUrl.trim() ? (
              <div className="mt-3 space-y-2 rounded border border-zinc-700 bg-zinc-950/80 p-2">
                <span className="text-xs font-medium text-amber-100">{bi("Preview", "Xem trước")}</span>
                <div className="flex justify-center rounded border border-zinc-700 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveThemeAssetUrl(paymentForm.vietqrImageUrl)}
                    alt={bi("VietQR preview", "Xem trước VietQR")}
                    className="max-h-48 max-w-full object-contain"
                    onError={(ev) => {
                      (ev.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <p className="text-[11px] font-mono text-amber-200/90">{paymentForm.vietqrImageUrl}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-300">
                {bi("No QR image uploaded yet.", "Chưa tải ảnh QR.")}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-amber-100">
              {bi("Instructions (Vietnamese)", "Hướng dẫn (Tiếng Việt)")}
            </label>
            <textarea
              className="h-24 w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={paymentForm.vietqrInstructionsVi}
              onChange={(e) => setPaymentForm((p) => ({ ...p, vietqrInstructionsVi: e.target.value }))}
              placeholder="Số TK, tên chủ TK, ngân hàng…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-amber-100">
              {bi("Instructions (English)", "Hướng dẫn (English)")}
            </label>
            <textarea
              className="h-24 w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={paymentForm.vietqrInstructionsEn}
              onChange={(e) => setPaymentForm((p) => ({ ...p, vietqrInstructionsEn: e.target.value }))}
              placeholder="Bank name, account holder…"
            />
          </div>
          <p className="text-sm text-amber-200">
            {bi("Env fallback QR URL:", "Biến môi trường dự phòng QR:")}{" "}
            <span className="font-mono text-emerald-200">{paymentForm.envFallbackQrUrl || bi("(none)", "(không)")}</span>
          </p>

          <div className="border-t border-amber-500/20 pt-3">
            <p className="text-sm font-semibold text-white">{bi("PayPal (global unlock)", "PayPal (mở khóa toàn cầu)")}</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-200">
              {bi(
                "PayPal hosted checkout URL. The app calls",
                "URL nút thanh toán PayPal (hosted). Ứng dụng gọi"
              )}{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                /api/payments/aspect/paypal/start
              </code>
              ;{" "}
              {bi(
                "the server redirects to your URL with return/cancel parameters.",
                "server redirect tới URL bạn nhập và gắn return/cancel."
              )}
            </p>
            <label className="mt-3 mb-1 block text-xs font-medium text-amber-100">
              {bi("PayPal hosted URL (https://…)", "URL PayPal hosted (https://…)")}
            </label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={paymentForm.paypalUnlockUrl}
              onChange={(e) => setPaymentForm((p) => ({ ...p, paypalUnlockUrl: e.target.value }))}
              placeholder="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=..."
            />
            <label className="mt-3 mb-1 block text-xs font-medium text-amber-100">
              {bi("PayPal QR image", "Ảnh QR PayPal")}
            </label>
            <input
              ref={paypalQrFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              className="hidden"
              disabled={paypalQrUploadBusy}
              onChange={(e) => void uploadPaypalQrFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={paypalQrUploadBusy}
              onClick={() => paypalQrFileInputRef.current?.click()}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paypalQrUploadBusy
                ? bi("Uploading…", "Đang tải lên…")
                : bi("Upload PayPal QR image", "Tải ảnh QR PayPal lên")}
            </button>
            {paymentForm.paypalQrImageUrl.trim() ? (
              <div className="mt-3 space-y-2 rounded border border-zinc-700 bg-zinc-950/80 p-2">
                <span className="text-xs font-medium text-amber-100">{bi("Preview", "Xem trước")}</span>
                <div className="flex justify-center rounded border border-zinc-700 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveThemeAssetUrl(paymentForm.paypalQrImageUrl)}
                    alt={bi("PayPal QR preview", "Xem trước QR PayPal")}
                    className="max-h-48 max-w-full object-contain"
                    onError={(ev) => {
                      (ev.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <p className="text-[11px] font-mono text-amber-200/90">{paymentForm.paypalQrImageUrl}</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-300">
                {bi("No PayPal QR image uploaded yet.", "Chưa tải ảnh QR PayPal.")}
              </p>
            )}
            <p className="mt-2 text-sm text-amber-200">
              {bi("Env fallback", "Biến môi trường dự phòng")}{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">PAYPAL_UNLOCK_URL</code>
              : <span className="font-mono text-emerald-200">{paymentForm.envFallbackPaypalUrl || bi("(none)", "(không)")}</span>
            </p>
          </div>

          <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            {bi("Save payment display", "Lưu hiển thị thanh toán")}
          </button>
          {paymentMessage && <p className={`text-xs ${adminNoticeClass(paymentMessage)}`}>{paymentMessage}</p>}
        </form>
      </section>
      )}

      {can("admin:manage") && (
      <section className="rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white">{bi("Admin accounts", "Tài khoản quản trị")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-200">
          {bi(
            "Create email and password accounts for CMS sign-in. Stored in MongoDB when connected, otherwise in backend/data/admin-users.json.",
            "Tạo tài khoản email và mật khẩu để đăng nhập CMS. Lưu MongoDB khi có kết nối, không thì lưu file backend/data/admin-users.json."
          )}
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-amber-500/25 bg-zinc-950/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_12rem_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Email", "Email")}</label>
              <input
                type="email"
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">
                {bi("Password (min 6 characters)", "Mật khẩu (tối thiểu 6 ký tự)")}
              </label>
              <input
                type="text"
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white font-mono"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Account type", "Loại tài khoản")}</label>
              <select
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white [color-scheme:dark]"
                value={newAdminRole}
                onChange={(e) => {
                  const role = e.target.value as AdminRole;
                  setNewAdminRole(role);
                  if (role === "member" && newAdminPermissions.length === 0) {
                    setNewAdminPermissions(defaultMemberPermissions());
                  }
                }}
              >
                {ADMIN_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-zinc-950 text-white">
                    {bi(option.labelEn, option.labelVi)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={adminUserBusy}
              onClick={() => void createAdminUserAccount()}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:bg-zinc-700"
            >
              {adminUserBusy ? bi("Saving…", "Đang lưu…") : bi("Create account", "Tạo tài khoản")}
            </button>
          </div>
          {newAdminRole === "member" && (
            <div className="rounded border border-zinc-700 bg-zinc-950/80 p-3">
              <p className="mb-2 text-xs font-medium text-amber-100">
                {bi("Member permissions", "Quyền thành viên")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MEMBER_PERMISSION_OPTIONS.map((option) => (
                  <label key={option.id} className="flex cursor-pointer items-start gap-2 text-xs text-amber-200">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={newAdminPermissions.includes(option.id)}
                      onChange={() =>
                        setNewAdminPermissions((current) => toggleMemberPermission(current, option.id))
                      }
                    />
                    <span>{bi(option.labelEn, option.labelVi)}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-amber-300/90">
                {bi(
                  "Payment, import/export, and account management are admin-only.",
                  "Thanh toán, nhập/xuất dữ liệu và quản lý tài khoản chỉ dành cho admin."
                )}
              </p>
            </div>
          )}
        </div>
        {adminUserMessage && <p className={`mt-2 text-xs ${adminNoticeClass(adminUserMessage)}`}>{adminUserMessage}</p>}
        {adminUsersLoading && (
          <p className="mt-2 text-xs text-amber-300">{bi("Loading accounts…", "Đang tải tài khoản…")}</p>
        )}
        <div className="mt-3 max-h-[28rem] overflow-auto rounded border border-amber-500/25">
          <table className="w-full text-left text-xs text-amber-200">
            <thead className="sticky top-0 bg-zinc-950 text-amber-300">
              <tr>
                <th className="p-2 whitespace-nowrap">{bi("Created", "Ngày tạo")}</th>
                <th className="p-2">{bi("Email", "Email")}</th>
                <th className="p-2">{bi("Password", "Mật khẩu")}</th>
                <th className="p-2">{bi("Type", "Loại")}</th>
                <th className="p-2 min-w-[14rem]">{bi("Permissions", "Phân quyền")}</th>
                <th className="p-2 whitespace-nowrap">{bi("Remove", "Xóa")}</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800/80 align-top">
                  <td className="p-2 whitespace-nowrap text-[11px] text-amber-100/95">
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "—"}
                  </td>
                  <td className="p-2 text-[11px] text-amber-100">{row.email}</td>
                  <td className="p-2 font-mono text-[11px] tracking-wide text-emerald-200/95">
                    {row.password || "—"}
                  </td>
                  <td className="p-2">
                    <select
                      className="rounded border border-zinc-600 bg-zinc-950 p-1.5 text-[11px] text-white [color-scheme:dark]"
                      value={row.role}
                      disabled={adminUserBusy}
                      onChange={(e) => {
                        const role = e.target.value as AdminRole;
                        const permissions =
                          role === "member"
                            ? row.permissions.length > 0
                              ? row.permissions
                              : defaultMemberPermissions()
                            : [];
                        patchAdminUserDraft(row.id, { role, permissions });
                        if (role === "admin") {
                          void updateAdminUserAccess(row.id, role, permissions);
                        }
                      }}
                    >
                      {ADMIN_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="bg-zinc-950 text-white">
                          {bi(option.labelEn.split(" — ")[0], option.labelVi.split(" — ")[0])}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-amber-300/80">{bi(roleLabel(row.role).en, roleLabel(row.role).vi)}</p>
                  </td>
                  <td className="p-2">
                    {row.role === "admin" ? (
                      <span className="text-[11px] text-emerald-300">
                        {bi("Full access (payment & accounts included)", "Toàn quyền (gồm thanh toán & tài khoản)")}
                      </span>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid gap-1.5">
                          {MEMBER_PERMISSION_OPTIONS.map((option) => (
                            <label
                              key={option.id}
                              className="flex cursor-pointer items-start gap-1.5 text-[11px] text-amber-200"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                disabled={adminUserBusy}
                                checked={row.permissions.includes(option.id)}
                                onChange={() => {
                                  const permissions = toggleMemberPermission(row.permissions, option.id);
                                  patchAdminUserDraft(row.id, { permissions });
                                  void updateAdminUserAccess(row.id, row.role, permissions);
                                }}
                              />
                              <span>{bi(option.labelEn, option.labelVi)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    {row.role === "admin" ? (
                      <span className="text-[11px] text-amber-400/90" title={bi("Admin accounts cannot be deleted.", "Tài khoản admin không thể xóa.")}>
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={adminUserBusy}
                        onClick={() => void removeAdminUserAccount(row.id)}
                        className="text-rose-400 hover:text-rose-300 hover:underline disabled:opacity-50"
                      >
                        {bi("Remove", "Xóa")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!adminUsersLoading && adminUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-3 text-amber-400">
                    {bi("No admin accounts yet.", "Chưa có tài khoản admin.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {can("cms:read") && (
      <div className={`grid gap-6 ${can("backup:manage") ? "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]" : ""}`}>
      <section className="rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h1 className="text-xl font-semibold text-white">{bi("CMS meanings", "Nội dung CMS (ý nghĩa)")}</h1>
        <p className="mt-1 text-sm text-amber-200">
          {bi("Edit planet, house, and aspect explanations shown on the public chart.", "Chỉnh giải thích hành tinh, nhà và aspect hiển thị trên lá số công khai.")}
        </p>
        <div className="mt-4">
          <CmsMeaningsBulkEditor
            token={token}
            refreshSignal={cmsRefreshSignal}
            readOnly={cmsReadOnly}
            onMessage={setMessage}
            onUnauthorized={handleUnauthorized}
          />
        </div>
        {message && <p className={`mt-3 text-xs ${adminNoticeClass(message)}`}>{message}</p>}
      </section>

      {can("backup:manage") && (
      <section className="space-y-4 rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-sm font-semibold text-white">{bi("Import / export", "Nhập / xuất")}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-zinc-700 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-zinc-800"
            onClick={refreshMeanings}
            disabled={refreshing}
          >
            {refreshing ? bi("Refreshing…", "Đang tải…") : bi("Refresh", "Tải lại")}
          </button>
          <button
            type="button"
            className="rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-sky-900"
            onClick={() => void backupBackendData()}
            disabled={backupBusy}
          >
            {backupBusy ? bi("Backing up…", "Đang sao lưu…") : bi("Backup backend", "Backup backend")}
          </button>
          <button
            type="button"
            className="rounded bg-violet-700 px-3 py-2 text-sm text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:bg-violet-900"
            onClick={() => backendBackupInputRef.current?.click()}
            disabled={importBackupBusy}
          >
            {importBackupBusy ? bi("Importing…", "Đang nhập…") : bi("Import backend", "Import backend")}
          </button>
          <input
            ref={backendBackupInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => void importBackendBackupFile(e.target.files?.[0] ?? null)}
          />
          <button className="rounded bg-indigo-600 px-3 py-2 text-sm text-white" onClick={exportJson}>
            {bi("Export JSON", "Xuất JSON")}
          </button>
        </div>
        {(refreshing || importing) && (
          <p className="text-xs text-amber-300">
            {refreshing ? bi("Refreshing data…", "Đang tải dữ liệu…") : bi("Importing data…", "Đang nhập dữ liệu…")}
          </p>
        )}
        <textarea
          className="h-32 w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white placeholder:text-zinc-500"
          placeholder={bi("Paste JSON here to import…", "Dán JSON vào đây để nhập…")}
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
        />
        <button
          type="button"
          className="w-full rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
          onClick={importFromJson}
          disabled={importing}
        >
          {importing ? bi("Importing…", "Đang nhập…") : bi("Import JSON", "Nhập JSON")}
        </button>
      </section>
      )}
      </div>
      )}
        </>
      )}
    </main>
  );
}
