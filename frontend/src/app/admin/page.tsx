"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bi } from "@/lib/bilingual";
import {
  defaultSiteTheme,
  resolveBackgroundImageUrl,
  resolveThemeAssetUrl,
  THEME_FONT_CHOICES,
  type SiteThemeSettings
} from "@/lib/siteTheme";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const MANUAL_LICENSES_STORAGE_KEY = "astrology-admin-manual-licenses";
const POINT_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "north_node",
  "south_node",
  "lilith",
  "part_of_fortune"
];
const SIGN_KEYS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
];
const ASPECT_KEYS = ["conjunction", "sextile", "square", "trine", "opposition"];

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

type Meaning = {
  _id: string;
  category: "planet_sign" | "planet_house" | "aspect" | "house" | "house_sign";
  key: string;
  title: { en: string; vi: string };
  content: { en: string; vi: string };
};

type MeaningFormValues = {
  category: Meaning["category"];
  key: string;
};

type MeaningForm = {
  category: Meaning["category"];
  key: string;
  titleEn: string;
  titleVi: string;
  contentEn: string;
  contentVi: string;
};

function themeFontSelectOptions(current: string) {
  const base = [...THEME_FONT_CHOICES];
  if (current.trim() && !base.some((o) => o.value === current)) {
    base.push({ value: current, label: `${current} (saved · đã lưu)` });
  }
  return base;
}

const emptyForm: MeaningForm = {
  category: "planet_sign",
  key: "sun_aries",
  titleEn: "",
  titleVi: "",
  contentEn: "",
  contentVi: ""
};

export default function AdminPage() {
  /** Must match server first paint — read localStorage in useEffect to avoid hydration mismatch. */
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin12345");
  const [meanings, setMeanings] = useState<Meaning[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importJson, setImportJson] = useState("");
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importBackupBusy, setImportBackupBusy] = useState(false);
  const [frontendBackupBusy, setFrontendBackupBusy] = useState(false);
  const [frontendImportBusy, setFrontendImportBusy] = useState(false);
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
  const [backgroundUploadBusy, setBackgroundUploadBusy] = useState(false);
  const [manualLicenses, setManualLicenses] = useState<
    Array<{
      id: string;
      licenseKey: string;
      email: string;
      password: string;
      issuedAt: string | null;
      source: "manual";
    }>
  >([]);
  const [manualLicenseKeyInput, setManualLicenseKeyInput] = useState("");
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [manualPasswordInput, setManualPasswordInput] = useState("");
  const [manualLicenseHydrated, setManualLicenseHydrated] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState("");
  const backendBackupInputRef = useRef<HTMLInputElement | null>(null);
  const frontendBackupInputRef = useRef<HTMLInputElement | null>(null);
  const latestLoadMeaningsSeq = useRef(0);
  const lastLoadMeaningSignature = useRef("");

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("adminToken");
    setToken("");
    setMeanings([]);
    setMessage(bi("Session expired or invalid token. Please sign in again.", "Phiên hết hạn hoặc token không hợp lệ. Vui lòng đăng nhập lại."));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminToken");
    setToken("");
    setMeanings([]);
    setMessage("");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("adminToken");
    if (stored) setToken(stored);
  }, []);

  const keyOptions = useMemo(() => {
    if (form.category === "planet_sign") {
      return POINT_KEYS.flatMap((point) => SIGN_KEYS.map((sign) => `${point}_${sign}`));
    }
    if (form.category === "planet_house") {
      return POINT_KEYS.flatMap((point) => Array.from({ length: 12 }, (_, i) => `${point}_${i + 1}`));
    }
    if (form.category === "house") {
      return Array.from({ length: 12 }, (_, i) => `house_${i + 1}`);
    }
    if (form.category === "house_sign") {
      return Array.from({ length: 12 }, (_, i) => {
        const house = i + 1;
        return SIGN_KEYS.map((sign) => `house_${house}_${sign}`);
      }).flat();
    }
    return POINT_KEYS.flatMap((left, i) =>
      POINT_KEYS.slice(i + 1).flatMap((right) => ASPECT_KEYS.map((aspect) => `${left}_${aspect}_${right}`))
    );
  }, [form.category]);

  const selectedMeaning = useMemo(
    () => meanings.find((item) => item.category === form.category && item.key === form.key.trim()),
    [meanings, form.category, form.key]
  );
  const displayedMeanings = useMemo(() => {
    const key = form.key.trim();
    if (key) {
      return meanings.filter((item) => item.category === form.category && item.key === key);
    }
    return meanings.filter((item) => item.category === form.category);
  }, [meanings, form.category, form.key]);

  const applyMeaningToForm = useCallback(
    (
      category: Meaning["category"],
      key: string,
      meaning?: Meaning
    ) => {
      setForm((current) => {
        const next = {
          ...current,
          category,
          key,
          titleEn: meaning?.title.en ?? "",
          titleVi: meaning?.title.vi ?? "",
          contentEn: meaning?.content.en ?? "",
          contentVi: meaning?.content.vi ?? ""
        };
        if (
          current.category === next.category &&
          current.key === next.key &&
          current.titleEn === next.titleEn &&
          current.titleVi === next.titleVi &&
          current.contentEn === next.contentEn &&
          current.contentVi === next.contentVi
        ) {
          return current;
        }
        return next;
      });
      setEditingId(meaning?._id ?? null);
    },
    []
  );

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

  const loadMeanings = useCallback(
    async (currentToken = token, context?: MeaningFormValues) => {
      if (!currentToken) return false;
      const activeCategory = context?.category ?? form.category;
      const activeKey = (context?.key ?? form.key).trim();
      const signature = `${currentToken}|${activeCategory}|${activeKey}`;
      if (lastLoadMeaningSignature.current === signature) {
        return true;
      }
      lastLoadMeaningSignature.current = signature;
      const seq = ++latestLoadMeaningsSeq.current;
      try {
        const params = new URLSearchParams({ category: activeCategory });
        const response = await fetch(`${API_URL}/cms/meanings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${currentToken}` }
        });
        if (response.status === 401) {
          handleUnauthorized();
          return false;
        }
        if (!response.ok) {
          if (latestLoadMeaningsSeq.current === seq) {
            lastLoadMeaningSignature.current = "";
          }
          return false;
        }
        const data = (await response.json()) as Meaning[];
        if (latestLoadMeaningsSeq.current !== seq) {
          return false;
        }
        setMeanings(data);
        const matchingMeaning = data.find((item) => item.category === activeCategory && item.key === activeKey);
        applyMeaningToForm(activeCategory, activeKey, matchingMeaning);
        return true;
      } catch {
        if (latestLoadMeaningsSeq.current === seq) {
          lastLoadMeaningSignature.current = "";
        }
        return false;
      }
    },
    [token, handleUnauthorized, form.category, form.key, applyMeaningToForm]
  );

  async function refreshMeanings() {
    setRefreshing(true);
    const ok = await loadMeanings();
    await new Promise((resolve) => setTimeout(resolve, 300));
    setRefreshing(false);
    setMessage(
      ok
        ? bi("Refreshed latest data.", "Đã tải lại dữ liệu mới nhất.")
        : bi("Refresh failed. Check backend/API connection.", "Tải lại thất bại. Kiểm tra kết nối API/backend.")
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(MANUAL_LICENSES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
        if (Array.isArray(parsed)) {
          const rows = parsed
            .map((r) => {
              const rec = r as Record<string, unknown>;
              const id = String(rec.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2)}`);
              const issuedAt = typeof rec.issuedAt === "string" ? rec.issuedAt : null;
              const email = typeof rec.email === "string" ? rec.email.trim() : "";
              const password = typeof rec.password === "string" ? rec.password : "";
              const noteKey = typeof rec.noteKey === "string" ? rec.noteKey.trim() : "";
              const lk = typeof rec.licenseKey === "string" ? rec.licenseKey.trim() : "";
              const licenseKey = lk || noteKey;
              if (!licenseKey && !email && !password) {
                return null;
              }
              if (!licenseKey) {
                return {
                  id,
                  licenseKey: "",
                  email,
                  password,
                  issuedAt,
                  source: "manual" as const
                };
              }
              return {
                id,
                licenseKey,
                email,
                password,
                issuedAt,
                source: "manual" as const
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .filter((r) => r.licenseKey.length > 0 || r.email.length > 0 || r.password.length > 0);
          setManualLicenses(rows);
        }
      }
    } catch {
      /* ignore */
    }
    setManualLicenseHydrated(true);
  }, []);

  useEffect(() => {
    if (!manualLicenseHydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(MANUAL_LICENSES_STORAGE_KEY, JSON.stringify(manualLicenses));
    } catch {
      /* ignore */
    }
  }, [manualLicenses, manualLicenseHydrated]);

  function addManualLicenseRow() {
    const key = manualLicenseKeyInput.trim();
    const em = manualEmailInput.trim();
    const pw = manualPasswordInput;
    if (!key) {
      setLicenseMessage(bi("Enter a license key.", "Nhập mã license."));
      return;
    }
    if (!em) {
      setLicenseMessage(bi("Enter an email.", "Nhập email."));
      return;
    }
    if (!pw.trim()) {
      setLicenseMessage(bi("Enter a password.", "Nhập mật khẩu."));
      return;
    }
    setManualLicenses((prev) => [
      {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        licenseKey: key,
        email: em,
        password: pw,
        issuedAt: new Date().toISOString(),
        source: "manual"
      },
      ...prev
    ]);
    setManualLicenseKeyInput("");
    setManualEmailInput("");
    setManualPasswordInput("");
    setLicenseMessage("");
  }

  function removeManualLicenseRow(id: string) {
    setManualLicenses((prev) => prev.filter((r) => r.id !== id));
  }

  useEffect(() => {
    if (!token) return;
    const context: MeaningFormValues = { category: form.category, key: form.key };
    void loadMeanings(token, context);
  }, [form.category, form.key, token, loadMeanings]);

  useEffect(() => {
    if (!token) return;
    void loadPaymentSettings(token);
    void loadThemeSettings(token);
  }, [token, loadPaymentSettings, loadThemeSettings]);

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
  }

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const url = editingId ? `${API_URL}/cms/meanings/${editingId}` : `${API_URL}/cms/meanings`;
      const method = editingId ? "PUT" : "POST";
      const payload = {
        category: form.category,
        key: form.key.trim(),
        title: { en: form.titleEn, vi: form.titleVi },
        content: { en: form.contentEn, vi: form.contentVi }
      };
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        const textError =
          typeof payload?.error === "string"
            ? payload.error
            : bi("Create/update failed. Check required fields.", "Tạo/cập nhật thất bại. Kiểm tra các trường bắt buộc.");
        setMessage(textError);
        return;
      }
      setMessage(
        editingId
          ? bi("Updated successfully.", "Cập nhật thành công.")
          : bi("Created successfully.", "Tạo mục thành công.")
      );
      setForm(emptyForm);
      setEditingId(null);
      setUseCustomKey(false);
      lastLoadMeaningSignature.current = "";
      await loadMeanings();
    } finally {
      setLoading(false);
    }
  }

  async function removeMeaning(id: string) {
    setMessage("");
    const response = await fetch(`${API_URL}/cms/meanings/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    setMessage(bi("Deleted.", "Đã xóa."));
    await loadMeanings();
  }

  async function exportJson() {
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
      await loadMeanings();
      setMessage(bi("Imported.", "Đã nhập xong."));
    } catch {
      setMessage(bi("Invalid JSON import payload.", "Payload JSON không hợp lệ."));
    } finally {
      setImporting(false);
    }
  }

  async function backupBackendData() {
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
      lastLoadMeaningSignature.current = "";
      await loadMeanings(token, { category: form.category, key: form.key });
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

  function backupFrontendData() {
    if (frontendBackupBusy) return;
    setFrontendBackupBusy(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        source: "frontend-local",
        manualLicenses
      };
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `astro-backup-frontend-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLicenseMessage(bi("Frontend backup downloaded.", "Đã tải file backup frontend."));
    } finally {
      setFrontendBackupBusy(false);
    }
  }

  async function importFrontendBackupFile(file: File | null) {
    if (!file || frontendImportBusy) return;
    setFrontendImportBusy(true);
    setLicenseMessage("");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { manualLicenses?: unknown };
      if (!Array.isArray(parsed.manualLicenses)) {
        setLicenseMessage(bi("Invalid frontend backup format.", "Định dạng backup frontend không hợp lệ."));
        return;
      }
      const normalized = parsed.manualLicenses
        .map((item) => {
          if (typeof item !== "object" || item === null) return null;
          const rec = item as Record<string, unknown>;
          const id = String(rec.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
          const licenseKey = typeof rec.licenseKey === "string" ? rec.licenseKey.trim() : "";
          const email = typeof rec.email === "string" ? rec.email.trim() : "";
          const password = typeof rec.password === "string" ? rec.password : "";
          const issuedAt = typeof rec.issuedAt === "string" ? rec.issuedAt : null;
          if (!licenseKey && !email && !password) return null;
          return { id, licenseKey, email, password, issuedAt, source: "manual" as const };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      setManualLicenses(normalized);
      setLicenseMessage(bi("Frontend backup imported.", "Đã nhập backup frontend."));
    } catch {
      setLicenseMessage(bi("Invalid frontend backup JSON.", "Backup frontend JSON không hợp lệ."));
    } finally {
      setFrontendImportBusy(false);
      if (frontendBackupInputRef.current) frontendBackupInputRef.current.value = "";
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
          <p className="text-xs text-amber-400">
            {bi("Default (dev, with Mongo):", "Mặc định (dev, có Mongo):")} admin@example.com / admin12345
          </p>
          <p className="text-xs text-amber-200">
            {bi("Have a product license?", "Có license sản phẩm?")}{" "}
            <Link href="/admin/setup" className="font-medium text-amber-400 underline hover:text-amber-300">
              {bi("Create admin via license", "Tạo admin bằng license")}
            </Link>
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-black/80 px-4 py-3 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h1 className="text-lg font-semibold text-white">{bi("Admin panel", "Trang quản trị")}</h1>
        <button
          type="button"
          onClick={logout}
          className="rounded border border-zinc-500 bg-zinc-900/80 px-4 py-2 text-sm font-medium text-amber-100 hover:border-amber-500/50 hover:bg-zinc-800"
        >
          {bi("Log out", "Đăng xuất")}
        </button>
      </div>
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
          <button type="submit" className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500">
            {bi("Save branding & theme", "Lưu giao diện & thương hiệu")}
          </button>
          {themeMessage && <p className={`text-xs ${adminNoticeClass(themeMessage)}`}>{themeMessage}</p>}
        </form>
      </section>

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
              {bi("QR image URL (https://…)", "URL ảnh mã QR (https://…)")}
            </label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={paymentForm.vietqrImageUrl}
              onChange={(e) => setPaymentForm((p) => ({ ...p, vietqrImageUrl: e.target.value }))}
              placeholder="https://example.com/vietqr.png"
            />
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
              {bi("PayPal QR image URL (https://…)", "URL ảnh QR PayPal (https://…)")}
            </label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
              value={paymentForm.paypalQrImageUrl}
              onChange={(e) => setPaymentForm((p) => ({ ...p, paypalQrImageUrl: e.target.value }))}
              placeholder="/api/uploads/paypal-qr-default.png"
            />
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

      <section className="rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h2 className="text-lg font-semibold text-white">{bi("Licenses", "Quản lý license")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-amber-200">
          {bi(
            "Enter license key, email, and password below — saved only in this browser for your records. Product signup:",
            "Nhập mã license, email và mật khẩu bên dưới — chỉ lưu trên trình duyệt này để bạn ghi chú. Đăng ký:"
          )}{" "}
          <Link href="/admin/setup" className="font-medium text-amber-400 underline hover:text-amber-300">
            /admin/setup
          </Link>
          .
        </p>
        <p
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-100"
          role="note"
        >
          {bi(
            "Important: rows here do not create a server account. Sign-in only accepts users stored in the API database — created via /admin/setup with a valid license key (when MongoDB has that license), or the ADMIN_EMAIL / ADMIN_PASSWORD from environment when no DB user matches.",
            "Lưu ý: các dòng ở đây không tạo tài khoản trên server. Đăng nhập chỉ chấp nhận user có trong CSDL API — tạo qua /admin/setup với mã license hợp lệ (MongoDB đã có license đó), hoặc ADMIN_EMAIL / ADMIN_PASSWORD trong biến môi trường khi chưa có user trùng trong DB."
          )}
        </p>
        <div className="mt-4 space-y-2 rounded-lg border border-amber-500/25 bg-zinc-950/60 p-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600 disabled:bg-sky-900"
              onClick={backupFrontendData}
              disabled={frontendBackupBusy}
            >
              {frontendBackupBusy ? bi("Backing up…", "Đang sao lưu…") : bi("Backup frontend", "Backup frontend")}
            </button>
            <button
              type="button"
              className="rounded bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-600 disabled:bg-violet-900"
              onClick={() => frontendBackupInputRef.current?.click()}
              disabled={frontendImportBusy}
            >
              {frontendImportBusy ? bi("Importing…", "Đang nhập…") : bi("Import frontend", "Import frontend")}
            </button>
            <input
              ref={frontendBackupInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => void importFrontendBackupFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-amber-100">{bi("License key", "Mã license")}</label>
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white font-mono"
              value={manualLicenseKeyInput}
              onChange={(e) => setManualLicenseKeyInput(e.target.value)}
              placeholder="ASL-…"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Email", "Email")}</label>
              <input
                type="email"
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white"
                value={manualEmailInput}
                onChange={(e) => setManualEmailInput(e.target.value)}
                placeholder="you@example.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-amber-100">{bi("Password", "Mật khẩu")}</label>
              <input
                type="text"
                className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white font-mono"
                value={manualPasswordInput}
                onChange={(e) => setManualPasswordInput(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={addManualLicenseRow}
              className="rounded bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
            >
              {bi("Add row", "Thêm dòng")}
            </button>
          </div>
        </div>
        {licenseMessage && <p className={`mt-2 text-xs ${adminNoticeClass(licenseMessage)}`}>{licenseMessage}</p>}
        <div className="mt-3 max-h-56 overflow-auto rounded border border-amber-500/25">
          <table className="w-full text-left text-xs text-amber-200">
            <thead className="sticky top-0 bg-zinc-950 text-amber-300">
              <tr>
                <th className="p-2 whitespace-nowrap">{bi("Issued", "Ngày cấp")}</th>
                <th className="p-2">{bi("License key", "Mã license")}</th>
                <th className="p-2">{bi("Email", "Email")}</th>
                <th className="p-2">{bi("Password", "Mật khẩu")}</th>
                <th className="p-2 whitespace-nowrap">{bi("Remove", "Xóa")}</th>
              </tr>
            </thead>
            <tbody>
              {manualLicenses.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800/80">
                  <td className="p-2 whitespace-nowrap text-[11px] text-amber-100/95">
                    {row.issuedAt
                      ? new Date(row.issuedAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })
                      : "—"}
                  </td>
                  <td className="p-2 font-mono text-[11px] text-amber-100">{row.licenseKey || "—"}</td>
                  <td className="p-2 text-[11px] text-amber-100">{row.email || "—"}</td>
                  <td className="p-2 font-mono text-[11px] tracking-wide text-emerald-200/95">{row.password || "—"}</td>
                  <td className="p-2">
                    <button
                      type="button"
                      onClick={() => removeManualLicenseRow(row.id)}
                      className="text-rose-400 hover:text-rose-300 hover:underline"
                    >
                      {bi("Remove", "Xóa")}
                    </button>
                  </td>
                </tr>
              ))}
              {manualLicenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-amber-400">
                    {bi(
                      "No rows yet. Add license key, email, and password above.",
                      "Chưa có dòng. Thêm mã license, email và mật khẩu phía trên."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <h1 className="text-xl font-semibold text-white">{bi("CMS meanings", "Nội dung CMS (ý nghĩa)")}</h1>
        <p className="mt-1 text-sm text-amber-200">
          {bi("Edit planet, house, and aspect explanations shown on the public chart.", "Chỉnh giải thích hành tinh, nhà và aspect hiển thị trên lá số công khai.")}
        </p>
        <form
          className="mt-4 space-y-2 rounded-lg border border-amber-500/25 bg-zinc-950/70 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <select
            className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white [color-scheme:dark]"
            value={form.category}
            onChange={(e) => {
              const nextCategory = e.target.value as Meaning["category"];
              const nextDefaultKey = (() => {
                if (nextCategory === "planet_sign") return "sun_aries";
                if (nextCategory === "planet_house") return "sun_1";
                if (nextCategory === "aspect") return "sun_conjunction_moon";
                if (nextCategory === "house") return "house_1";
                return "house_1_aries";
              })();
              const matchingMeaning = meanings.find((item) => item.category === nextCategory && item.key === nextDefaultKey);
              applyMeaningToForm(nextCategory, nextDefaultKey, matchingMeaning);
              setUseCustomKey(false);
            }}
          >
            <option value="planet_sign" className="bg-zinc-950 text-white">
              {bi("Planet in sign", "Hành tinh trong cung")}
            </option>
            <option value="planet_house" className="bg-zinc-950 text-white">
              {bi("Planet in house", "Hành tinh trong nhà")}
            </option>
            <option value="aspect" className="bg-zinc-950 text-white">
              {bi("Aspect", "Aspect (góc)")}
            </option>
            <option value="house" className="bg-zinc-950 text-white">
              {bi("House meaning", "Ý nghĩa nhà")}
            </option>
            <option value="house_sign" className="bg-zinc-950 text-white">
              {bi("House in sign", "Nhà trong cung")}
            </option>
          </select>
          {!useCustomKey ? (
            <select
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-sm text-white [color-scheme:dark]"
              value={form.key || keyOptions[0]}
              onChange={(e) => {
                const nextKey = e.target.value;
                const matchingMeaning = meanings.find((item) => item.category === form.category && item.key === nextKey);
                applyMeaningToForm(form.category, nextKey, matchingMeaning);
              }}
            >
              {keyOptions.map((key) => (
                <option key={key} value={key} className="bg-zinc-950 text-white">
                  {key}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
              placeholder={bi("Key (e.g. sun_aries)", "Khóa (vd. sun_aries)")}
              value={form.key}
              onChange={(e) => {
                const nextKey = e.target.value;
                const matchingMeaning = meanings.find((item) => item.category === form.category && item.key === nextKey.trim());
                applyMeaningToForm(form.category, nextKey, matchingMeaning);
              }}
            />
          )}
          <p className={`text-xs ${selectedMeaning ? "text-emerald-400" : "text-amber-400"}`}>
            {selectedMeaning
              ? bi("This key already has content — you are editing it.", "Khóa này đã có nội dung — bạn đang chỉnh sửa.")
              : bi("No content for this key yet — saving will create a new entry.", "Chưa có nội dung — lưu sẽ tạo mục mới.")}
          </p>
          <button
            type="button"
            className="text-left text-xs text-amber-400 underline hover:text-amber-300"
            onClick={() => {
              const next = !useCustomKey;
              setUseCustomKey(next);
              if (!next && !form.key && keyOptions[0]) {
                setForm({ ...form, key: keyOptions[0] });
              }
            }}
          >
            {useCustomKey ? bi("Use dropdown keys", "Chọn khóa từ danh sách") : bi("Type custom key manually", "Nhập khóa tùy chỉnh")}
          </button>
          <input
            className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
            placeholder={bi("Title (English)", "Tiêu đề (English)")}
            value={form.titleEn}
            onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
          />
          <input
            className="w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
            placeholder={bi("Title (Vietnamese)", "Tiêu đề (Tiếng Việt)")}
            value={form.titleVi}
            onChange={(e) => setForm({ ...form, titleVi: e.target.value })}
          />
          <textarea
            className="h-28 w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
            placeholder={bi("Content (English)", "Nội dung (English)")}
            value={form.contentEn}
            onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
          />
          <textarea
            className="h-28 w-full rounded border border-zinc-600 bg-zinc-950 p-2 text-white placeholder:text-zinc-500"
            placeholder={bi("Content (Vietnamese)", "Nội dung (Tiếng Việt)")}
            value={form.contentVi}
            onChange={(e) => setForm({ ...form, contentVi: e.target.value })}
          />
          <button
            className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
            type="button"
            onClick={() => void handleCreate()}
            disabled={loading}
          >
            {loading
              ? bi("Saving…", "Đang lưu…")
              : editingId
                ? bi("Update meaning", "Cập nhật nội dung")
                : bi("Create meaning", "Tạo nội dung")}
          </button>
          {message && <p className={`text-xs ${adminNoticeClass(message)}`}>{message}</p>}
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-amber-500/35 bg-black/80 p-4 shadow-[0_4px_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="flex gap-2">
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
          className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-emerald-900"
          onClick={importFromJson}
          disabled={importing}
        >
          {importing ? bi("Importing…", "Đang nhập…") : bi("Import JSON", "Nhập JSON")}
        </button>

        <div className="space-y-2">
          {displayedMeanings.map((meaning) => (
            <article key={meaning._id} className="rounded border border-amber-500/25 bg-zinc-950/85 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-300">{meaning.category}</p>
              <h3 className="font-semibold text-white">{meaning.title.en}</h3>
              <p className="text-xs text-amber-200">{meaning.title.vi}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white">{meaning.content.en}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-amber-200">{meaning.content.vi}</p>
              <div className="mt-2 flex gap-2 text-xs">
                <button
                  className="rounded bg-zinc-700 px-2 py-1 text-white hover:bg-zinc-600"
                  onClick={() => {
                    setEditingId(meaning._id);
                    setForm({
                      category: meaning.category,
                      key: meaning.key,
                      titleEn: meaning.title.en,
                      titleVi: meaning.title.vi,
                      contentEn: meaning.content.en,
                      contentVi: meaning.content.vi
                    });
                    setUseCustomKey(false);
                  }}
                >
                  {bi("Edit", "Sửa")}
                </button>
                <button
                  className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-500"
                  onClick={() => removeMeaning(meaning._id)}
                >
                  {bi("Delete", "Xóa")}
                </button>
              </div>
            </article>
          ))}
          {displayedMeanings.length === 0 && (
            <p className="text-sm text-amber-300">
              {bi("No entries for key", "Không có mục cho khóa")}{" "}
              <span className="text-amber-100">{form.key.trim() || bi("(empty)", "(trống)")}</span>{" "}
              {bi("in category", "trong loại")} <span className="text-amber-100">{form.category}</span>.
            </p>
          )}
        </div>
      </section>
      </div>
    </main>
  );
}
