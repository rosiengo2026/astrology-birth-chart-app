"use client";

import { useMemo } from "react";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { getChartObjectGlyph } from "@/lib/chartObjectGlyphs";
import { chartPlanetFontStack } from "@/lib/siteTheme";

interface ChartObjectGlyphProps {
  objectId: string;
  size?: "sm" | "md";
  className?: string;
}

export function ChartObjectGlyph({ objectId, size = "md", className = "" }: ChartObjectGlyphProps) {
  const theme = useSiteTheme();
  const fontFamily = useMemo(() => chartPlanetFontStack(theme), [theme]);
  const glyph = getChartObjectGlyph(objectId);
  const sizeClass = size === "sm" ? "text-[13px]" : "text-base";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center leading-none text-[var(--theme-heading)] ${sizeClass} ${className}`}
      style={{ fontFamily, minWidth: "1.15em" }}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
