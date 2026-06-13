export type SiteThemeSettings = {
  logoUrl: string;
  /** Full-page background image URL (empty = CSS default under `public/branding/`) */
  backgroundImageUrl: string;
  /** Brand name shown as main heading on the home page */
  siteTitle: string;
  backgroundColor: string;
  surfaceColor: string;
  panelBorderColor: string;
  bodyTextColor: string;
  mutedTextColor: string;
  headingTextColor: string;
  linkColor: string;
  linkHoverColor: string;
  warningTextColor: string;
  errorTextColor: string;
  fontBody: string;
  fontHeading: string;
  fontUi: string;
  fontLink: string;
  fontWarning: string;
  fontCode: string;
};

const DEFAULT_API_BASE = "http://localhost:4000/api";

/**
 * Build a browser-usable URL for theme assets. Relative paths like `/api/uploads/...` are
 * resolved against the API host from `NEXT_PUBLIC_API_URL` so the Next.js site (port 3000)
 * can load files served by the Express API (port 4000).
 */
export function resolveThemeAssetUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const apiBase = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || DEFAULT_API_BASE;
  const normalized = apiBase.replace(/\/$/, "");
  const origin = normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized.replace(/\/api$/i, "");
  const pathOnly = u.startsWith("/") ? u : `/${u}`;
  return `${origin}${pathOnly}`;
}

/**
 * Background images may be served by the Next app (`/public/...`), the API (`/api/uploads/...`), or absolute URLs.
 */
export function resolveBackgroundImageUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (typeof window !== "undefined") {
    if (u.startsWith("/api/")) {
      return resolveThemeAssetUrl(u);
    }
    if (u.startsWith("/")) {
      return `${window.location.origin}${u}`;
    }
  }
  return resolveThemeAssetUrl(u);
}

export const defaultSiteTheme: SiteThemeSettings = {
  logoUrl: "",
  backgroundImageUrl: "",
  siteTitle: "AstroScope",
  backgroundColor: "#020617",
  surfaceColor: "#0f172a",
  panelBorderColor: "#1e293b",
  /** High contrast: white on dark / amber on gray panels */
  bodyTextColor: "#ffffff",
  mutedTextColor: "#fbbf24",
  headingTextColor: "#ffffff",
  linkColor: "#38bdf8",
  linkHoverColor: "#7dd3fc",
  warningTextColor: "#fcd34d",
  errorTextColor: "#fb7185",
  fontBody: "Inter",
  fontHeading: "Inter",
  fontUi: "Inter",
  fontLink: "Inter",
  fontWarning: "Inter",
  fontCode: "JetBrains Mono"
};

export const THEME_FONT_CHOICES: { value: string; label: string }[] = [
  { value: "system-ui", label: "System UI (OS default)" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Source Sans 3", label: "Source Sans 3" },
  { value: "Nunito", label: "Nunito" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "Noto Sans", label: "Noto Sans" },
  { value: "Noto Serif", label: "Noto Serif" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" }
];

export function fontCSSStack(choice: string): string {
  const t = choice.trim();
  if (!t || t === "system-ui") {
    return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  }
  const safe = t.replace(/\\/g, "").replace(/"/g, "'");
  return `'${safe}', system-ui, sans-serif`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const t = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(t)) {
    return `rgba(15, 23, 42, ${alpha})`;
  }
  const n = parseInt(t, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const LINK_ID = "site-theme-google-fonts";

export function buildGoogleFontsHref(fonts: string[]): string | null {
  const names = [...new Set(fonts.map((f) => f.trim()).filter((f) => f && f !== "system-ui"))];
  if (names.length === 0) return null;
  const q = names
    .map((name) => `family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export function applySiteThemeToDocument(theme: SiteThemeSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const bgResolved = resolveBackgroundImageUrl(theme.backgroundImageUrl ?? "");
  if (bgResolved) {
    const safe = bgResolved.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    root.style.setProperty("--site-bg-image", `url("${safe}")`);
  } else {
    root.style.removeProperty("--site-bg-image");
  }
  root.style.setProperty("--theme-bg", theme.backgroundColor);
  root.style.setProperty("--theme-panel", hexToRgba(theme.surfaceColor, 0.72));
  root.style.setProperty("--theme-border", theme.panelBorderColor);
  root.style.setProperty("--theme-body", theme.bodyTextColor);
  root.style.setProperty("--theme-muted", theme.mutedTextColor);
  root.style.setProperty("--theme-heading", theme.headingTextColor);
  root.style.setProperty("--theme-link", theme.linkColor);
  root.style.setProperty("--theme-link-hover", theme.linkHoverColor);
  root.style.setProperty("--theme-warning", theme.warningTextColor);
  root.style.setProperty("--theme-error", theme.errorTextColor);
  root.style.setProperty("--font-theme-body", fontCSSStack(theme.fontBody));
  root.style.setProperty("--font-theme-heading", fontCSSStack(theme.fontHeading));
  root.style.setProperty("--font-theme-ui", fontCSSStack(theme.fontUi));
  root.style.setProperty("--font-theme-link", fontCSSStack(theme.fontLink));
  root.style.setProperty("--font-theme-warning", fontCSSStack(theme.fontWarning));
  root.style.setProperty("--font-theme-code", fontCSSStack(theme.fontCode));

  const href = buildGoogleFontsHref([
    theme.fontBody,
    theme.fontHeading,
    theme.fontUi,
    theme.fontLink,
    theme.fontWarning,
    theme.fontCode
  ]);
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!href) {
    existing?.remove();
    return;
  }
  const link = existing ?? document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  if (!existing) {
    document.head.appendChild(link);
  }
}
