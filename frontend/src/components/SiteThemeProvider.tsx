"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applySiteThemeToDocument, defaultSiteTheme, type SiteThemeSettings } from "@/lib/siteTheme";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const SiteThemeContext = createContext<SiteThemeSettings>(defaultSiteTheme);

export function useSiteTheme(): SiteThemeSettings {
  return useContext(SiteThemeContext);
}

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SiteThemeSettings>(defaultSiteTheme);

  useEffect(() => {
    let cancelled = false;
    async function loadFromApi() {
      try {
        const response = await fetch(`${API_URL}/theme-settings`);
        const data = (await response.json().catch(() => null)) as Partial<SiteThemeSettings> | null;
        if (cancelled || !data || typeof data !== "object") return;
        const merged: SiteThemeSettings = { ...defaultSiteTheme, ...data };
        setTheme(merged);
      } catch {
        /* keep defaults */
      }
    }
    void loadFromApi();
    function onAdminSaved() {
      void loadFromApi();
    }
    window.addEventListener("astro-theme-updated", onAdminSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("astro-theme-updated", onAdminSaved);
    };
  }, []);

  useEffect(() => {
    applySiteThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    const t = theme.siteTitle.trim();
    if (t) {
      document.title = t;
    }
  }, [theme.siteTitle]);

  return <SiteThemeContext.Provider value={theme}>{children}</SiteThemeContext.Provider>;
}
