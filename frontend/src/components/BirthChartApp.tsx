"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartWheel } from "@/components/ChartWheel";
import { ChartObjectGlyph } from "@/components/ChartObjectGlyph";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { UnlockSection } from "@/components/UnlockSection";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { ChartResponse, LocationOption, MeaningItem, SynastryResponse, TransitsResponse } from "@/types/chart";
import { bi } from "@/lib/bilingual";
import { getAspectAccessToken } from "@/lib/aspectAccess";
import { svgElementToPngDataUrl } from "@/lib/chartImageExport";
import { resolveThemeAssetUrl } from "@/lib/siteTheme";
import { slugify } from "@/lib/slugify";
import {
  filterVisibleAspects,
  filterVisiblePlanets,
  loadEnabledChartObjects,
  saveEnabledChartObjects,
  OBJECT_SETTINGS_CATEGORIES,
  OPTIONAL_CHART_OBJECTS,
  getChartObjectDefinition,
  isSynastryPointVisible,
  isChartObjectVisible
} from "@/lib/chartPoints";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
/** Default brand mark in `public/branding/` when no logo URL is set in theme. */
const DEFAULT_BRAND_LOGO = "/branding/blogchiemtinh-logo.png";
const CHART_STATE_STORAGE_KEY = "astroscope-chart-state";
const INTERPRETATION_LANG_STORAGE_KEY = "astroscope-interpretation-lang";

type ChartViewMode = "natal" | "transit" | "synastry";

const TRANSIT_PHASE_LABELS: Record<string, { en: string; vi: string }> = {
  applying: { en: "applying", vi: "đang vào" },
  exact: { en: "exact", vi: "chính xác" },
  separating: { en: "separating", vi: "đang rời" }
};

type InterpretationLangPrefs = {
  vi: boolean;
  en: boolean;
};

function defaultInterpretationLangPrefs(): InterpretationLangPrefs {
  return { vi: true, en: false };
}

function loadInterpretationLangPrefs(): InterpretationLangPrefs {
  if (typeof window === "undefined") return defaultInterpretationLangPrefs();
  try {
    const raw = localStorage.getItem(INTERPRETATION_LANG_STORAGE_KEY);
    if (!raw) return defaultInterpretationLangPrefs();
    const parsed = JSON.parse(raw) as Partial<InterpretationLangPrefs>;
    const vi = parsed.vi !== false;
    const en = Boolean(parsed.en);
    if (!vi && !en) return defaultInterpretationLangPrefs();
    return { vi, en };
  } catch {
    return defaultInterpretationLangPrefs();
  }
}
const ASPECT_META: Record<string, { symbol: string; label: string; color: string }> = {
  Conjunction: { symbol: "☌", label: bi("Conjunction", "Hợp"), color: "text-slate-200" },
  Sextile: { symbol: "✶", label: bi("Sextile 60°", "Lục hợp 60°"), color: "text-sky-300" },
  Square: { symbol: "□", label: bi("Square 90°", "Vuông góc 90°"), color: "text-rose-300" },
  Trine: { symbol: "△", label: bi("Trine 120°", "Tam hợp 120°"), color: "text-sky-300" },
  Opposition: { symbol: "☍", label: bi("Opposition 180°", "Đối lập 180°"), color: "text-rose-300" }
};
const ASPECT_TYPE_ORDER = ["Conjunction", "Sextile", "Square", "Trine", "Opposition"] as const;
async function resolveLocationFromText(locationText: string): Promise<LocationOption | null> {
  const query = locationText.trim();
  if (query.length < 2) return null;

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  const data = await response.json();
  const first = (data.results ?? [])[0] as
    | {
        id?: string | number;
        name?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
        timezone?: string;
      }
    | undefined;

  if (!first) return null;
  return {
    id: String(first.id ?? `${first.name ?? ""}-${first.country ?? ""}`),
    city: String(first.name ?? ""),
    country: String(first.country ?? ""),
    latitude: Number(first.latitude ?? 0),
    longitude: Number(first.longitude ?? 0),
    timezone: String(first.timezone ?? "UTC")
  };
}

type NowPreviewLocation = LocationOption & { id: string; label: string };

/** Preset places for the “NOW” wheel before the user generates a birth chart. */
const NOW_PREVIEW_LOCATIONS: NowPreviewLocation[] = [
  {
    id: "perth",
    label: "Perth, Western Australia 6000 (Mặc định / Default)",
    city: "Perth",
    country: "Australia",
    latitude: -31.9523,
    longitude: 115.8613,
    timezone: "Australia/Perth"
  },
  {
    id: "sydney",
    label: "Sydney, Australia (Úc)",
    city: "Sydney",
    country: "Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: "Australia/Sydney"
  },
  {
    id: "melbourne",
    label: "Melbourne, Australia (Úc)",
    city: "Melbourne",
    country: "Australia",
    latitude: -37.8136,
    longitude: 144.9631,
    timezone: "Australia/Melbourne"
  },
  {
    id: "ho-chi-minh",
    label: "Ho Chi Minh City, Vietnam (TP.HCM, Việt Nam)",
    city: "Ho Chi Minh City",
    country: "Vietnam",
    latitude: 10.8231,
    longitude: 106.6297,
    timezone: "Asia/Ho_Chi_Minh"
  },
  {
    id: "hanoi",
    label: "Hanoi, Vietnam (Hà Nội, Việt Nam)",
    city: "Hanoi",
    country: "Vietnam",
    latitude: 21.0278,
    longitude: 105.8342,
    timezone: "Asia/Ho_Chi_Minh"
  },
  {
    id: "singapore",
    label: "Singapore (Singapore)",
    city: "Singapore",
    country: "Singapore",
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: "Asia/Singapore"
  },
  {
    id: "bangkok",
    label: "Bangkok, Thailand (Bangkok, Thái Lan)",
    city: "Bangkok",
    country: "Thailand",
    latitude: 13.7563,
    longitude: 100.5018,
    timezone: "Asia/Bangkok"
  },
  {
    id: "tokyo",
    label: "Tokyo, Japan (Tokyo, Nhật Bản)",
    city: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: "Asia/Tokyo"
  },
  {
    id: "seoul",
    label: "Seoul, South Korea (Seoul, Hàn Quốc)",
    city: "Seoul",
    country: "South Korea",
    latitude: 37.5665,
    longitude: 126.978,
    timezone: "Asia/Seoul"
  },
  {
    id: "auckland",
    label: "Auckland, New Zealand (Auckland, NZ)",
    city: "Auckland",
    country: "New Zealand",
    latitude: -36.8485,
    longitude: 174.7633,
    timezone: "Pacific/Auckland"
  },
  {
    id: "london",
    label: "London, United Kingdom (Luân Đôn, Anh)",
    city: "London",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: "Europe/London"
  },
  {
    id: "paris",
    label: "Paris, France (Paris, Pháp)",
    city: "Paris",
    country: "France",
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: "Europe/Paris"
  },
  {
    id: "dubai",
    label: "Dubai, UAE (Dubai, Các Tiểu Vương Quốc Ả Rập)",
    city: "Dubai",
    country: "United Arab Emirates",
    latitude: 25.2048,
    longitude: 55.2708,
    timezone: "Asia/Dubai"
  },
  {
    id: "new-delhi",
    label: "New Delhi, India (New Delhi, Ấn Độ)",
    city: "New Delhi",
    country: "India",
    latitude: 28.6139,
    longitude: 77.209,
    timezone: "Asia/Kolkata"
  },
  {
    id: "los-angeles",
    label: "Los Angeles, CA, USA (Mỹ)",
    city: "Los Angeles",
    country: "United States",
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: "America/Los_Angeles"
  },
  {
    id: "new-york",
    label: "New York, NY, USA (Mỹ)",
    city: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York"
  },
  {
    id: "toronto",
    label: "Toronto, Canada",
    city: "Toronto",
    country: "Canada",
    latitude: 43.6532,
    longitude: -79.3832,
    timezone: "America/Toronto"
  },
  {
    id: "sao-paulo",
    label: "Sao Paulo, Brazil (São Paulo, Brazil)",
    city: "Sao Paulo",
    country: "Brazil",
    latitude: -23.5505,
    longitude: -46.6333,
    timezone: "America/Sao_Paulo"
  },
  {
    id: "johannesburg",
    label: "Johannesburg, South Africa",
    city: "Johannesburg",
    country: "South Africa",
    latitude: -26.2041,
    longitude: 28.0473,
    timezone: "Africa/Johannesburg"
  }
];

/** Wall-clock “now” in the given IANA timezone (for chart input). */
function getNowDateTimeInTimezone(timeZone: string): { date: string; time: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPart["type"]) => parts.find((p) => p.type === type)?.value ?? "";
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = get("hour");
  const min = get("minute");
  return { date: `${y}-${m}-${d}`, time: `${h}:${min}` };
}

function storedChartAfterPaymentReturn(): ChartResponse | null {
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("success") !== "true") return null;
  try {
    const raw = sessionStorage.getItem(CHART_STATE_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { result?: ChartResponse | null };
    return saved?.result ?? null;
  } catch {
    return null;
  }
}

async function requestBirthChart(input: {
  date: string;
  time: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}): Promise<ChartResponse> {
  const response = await fetch(`${API_URL}/generate-chart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || bi("Unable to generate chart.", "Không tạo được lá số."));
  }
  return (await response.json()) as ChartResponse;
}

async function requestNatalTransits(input: {
  date: string;
  time: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  transitDate: string;
  transitTime: string;
  transitTimezone?: string;
  transitCity?: string;
  transitCountry?: string;
  transitLatitude?: number;
  transitLongitude?: number;
}): Promise<TransitsResponse> {
  const response = await fetch(`${API_URL}/transits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || bi("Unable to calculate transits.", "Không tính được transit."));
  }
  return (await response.json()) as TransitsResponse;
}

async function requestSynastry(input: {
  personA: {
    label?: string;
    date: string;
    time: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  personB: {
    label?: string;
    date: string;
    time: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
}): Promise<SynastryResponse> {
  const response = await fetch(`${API_URL}/synastry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || bi("Unable to calculate synastry.", "Không tính được synastry."));
  }
  return (await response.json()) as SynastryResponse;
}

function toLocalized(value: MeaningItem["title"]): { en: string; vi: string } {
  if (typeof value === "string") {
    return { en: value, vi: value };
  }
  return value;
}

function withContentFallback(content: MeaningItem["content"]): { en: string; vi: string } {
  const localized = toLocalized(content);
  const hasEn = localized.en.trim().length > 0;
  const hasVi = localized.vi.trim().length > 0;
  if (hasEn || hasVi) {
    return {
      en: hasEn ? localized.en : localized.vi,
      vi: hasVi ? localized.vi : localized.en
    };
  }
  return {
    en: "No CMS content for this item yet. You can add it in /admin.",
    vi: "Chưa có nội dung trong CMS cho mục này. Bạn có thể thêm ở trang /admin."
  };
}

function meaningCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    planet_sign: bi("Planet in sign", "Hành tinh trong cung"),
    planet_house: bi("Planet in house", "Hành tinh trong nhà"),
    aspect: bi("Aspect", "Aspect"),
    house: bi("House", "Nhà"),
    house_sign: bi("House in sign", "Nhà trong cung")
  };
  return labels[category] ?? category;
}

export type BirthChartAppProps = {
  /** Admin preview: show full aspect list and meanings without payment. */
  unlockAspects?: boolean;
  adminToken?: string | null;
};

export function BirthChartApp({ unlockAspects = false, adminToken = null }: BirthChartAppProps) {
  const siteTheme = useSiteTheme();
  const brandLogoSrc = useMemo(() => {
    const raw = siteTheme.logoUrl?.trim();
    if (raw) return resolveThemeAssetUrl(raw);
    return DEFAULT_BRAND_LOGO;
  }, [siteTheme.logoUrl]);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [locationText, setLocationText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChartResponse | null>(null);
  const [resultB, setResultB] = useState<ChartResponse | null>(null);
  const [loadingB, setLoadingB] = useState(false);
  const [errorB, setErrorB] = useState("");
  const [activeChartPerson, setActiveChartPerson] = useState<"A" | "B">("A");
  /** “NOW” preview chart when the user has not generated a personal chart yet. */
  const [demoChartResult, setDemoChartResult] = useState<ChartResponse | null>(null);
  const [demoChartLoading, setDemoChartLoading] = useState(true);
  const [demoChartError, setDemoChartError] = useState("");
  const [nowPreviewLocationId, setNowPreviewLocationId] = useState(NOW_PREVIEW_LOCATIONS[0].id);
  const [meaningsByKey, setMeaningsByKey] = useState<Record<string, MeaningItem>>({});
  const [aspectAccessToken, setAspectAccessToken] = useState<string | null>(null);
  const [activeMeaning, setActiveMeaning] = useState<MeaningItem | null>(null);
  /** `null` = show every aspect link; otherwise only that aspect type on the wheel + list. */
  const [aspectLinkFilter, setAspectLinkFilter] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [interpretationLang, setInterpretationLang] = useState<InterpretationLangPrefs>(defaultInterpretationLangPrefs);
  const [interpretationLangHydrated, setInterpretationLangHydrated] = useState(false);
  const [enabledChartObjects, setEnabledChartObjects] = useState<Set<string>>(() => new Set());
  const [chartObjectsHydrated, setChartObjectsHydrated] = useState(false);
  const [objectsSettingsOpen, setObjectsSettingsOpen] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>("natal");
  const [transitDate, setTransitDate] = useState("");
  const [transitTime, setTransitTime] = useState("");
  const [transitLocationText, setTransitLocationText] = useState("");
  const [transitSelectedLocation, setTransitSelectedLocation] = useState<LocationOption | null>(null);
  const [transitsData, setTransitsData] = useState<TransitsResponse | null>(null);
  const [transitLoading, setTransitLoading] = useState(false);
  const [transitError, setTransitError] = useState("");
  const [synastryLabelA, setSynastryLabelA] = useState(() => bi("You", "Bạn"));
  const [synastryLabelB, setSynastryLabelB] = useState(() => bi("Partner", "Đối phương"));
  const [synastryDate, setSynastryDate] = useState("");
  const [synastryTime, setSynastryTime] = useState("");
  const [synastryLocationText, setSynastryLocationText] = useState("");
  const [synastrySelectedLocation, setSynastrySelectedLocation] = useState<LocationOption | null>(null);
  const [synastryData, setSynastryData] = useState<SynastryResponse | null>(null);
  const [synastryLoading, setSynastryLoading] = useState(false);
  const [synastryError, setSynastryError] = useState("");

  const activePersonalChart = useMemo(() => {
    if (chartViewMode === "synastry") {
      if (activeChartPerson === "B" && resultB) return resultB;
      if (result) return result;
      return null;
    }
    if (result) return result;
    return null;
  }, [chartViewMode, activeChartPerson, result, resultB]);

  const displayChart = useMemo(() => activePersonalChart ?? demoChartResult, [activePersonalChart, demoChartResult]);

  const activeWheelChart = useMemo(() => {
    if (chartViewMode === "synastry") {
      if (synastryData) {
        return {
          chart: activeChartPerson === "A" ? synastryData.personA.chart : synastryData.personB.chart
        };
      }
      const chartA = result?.chart;
      const chartB = resultB?.chart;
      if (activeChartPerson === "B" && chartB) return { chart: chartB };
      if (chartA) return { chart: chartA };
    }
    if (chartViewMode === "transit") {
      const natalChart = transitsData?.natal ?? result?.chart;
      if (natalChart) return { chart: natalChart };
    }
    return displayChart;
  }, [chartViewMode, synastryData, activeChartPerson, result, resultB, transitsData, displayChart]);

  const synastryOverlayChart = useMemo(() => {
    if (chartViewMode !== "synastry" || !synastryData) return undefined;
    return activeChartPerson === "A" ? synastryData.personB.chart : synastryData.personA.chart;
  }, [chartViewMode, synastryData, activeChartPerson]);

  const synastryOverlayPlanets = useMemo(() => {
    if (!synastryOverlayChart) return undefined;
    return synastryOverlayChart.planets;
  }, [synastryOverlayChart]);

  const canSubmit = useMemo(() => Boolean(date && time && locationText.trim().length > 1), [date, time, locationText]);

  const canSubmitPersonB = useMemo(
    () => Boolean(synastryDate && synastryTime && synastryLocationText.trim().length > 1),
    [synastryDate, synastryTime, synastryLocationText]
  );

  function chartPersonLabel(person: "A" | "B"): string {
    if (person === "A") {
      return synastryData?.personA.label ?? (synastryLabelA.trim() || bi("You", "Bạn"));
    }
    return synastryData?.personB.label ?? (synastryLabelB.trim() || bi("Partner", "Đối phương"));
  }

  const visiblePlanets = useMemo(() => {
    if (!activeWheelChart) return [];
    return filterVisiblePlanets(activeWheelChart.chart.planets, enabledChartObjects);
  }, [activeWheelChart, enabledChartObjects]);

  const filteredAspects = useMemo(() => {
    if (chartViewMode !== "natal" || !displayChart) return [];
    const byVisibility = filterVisibleAspects(displayChart.chart.aspects, enabledChartObjects);
    if (!aspectLinkFilter) return byVisibility;
    return byVisibility.filter((a) => a.type === aspectLinkFilter);
  }, [displayChart, aspectLinkFilter, enabledChartObjects, chartViewMode]);

  const filteredTransits = useMemo(() => {
    if (!transitsData) return [];
    return transitsData.transits
      .filter(
        (hit) =>
          isSynastryPointVisible(hit.natal, enabledChartObjects) &&
          isChartObjectVisible(hit.transiting, enabledChartObjects)
      )
      .filter((hit) => !aspectLinkFilter || hit.type === aspectLinkFilter);
  }, [transitsData, enabledChartObjects, aspectLinkFilter]);

  const filteredSynastryAspects = useMemo(() => {
    if (!synastryData) return [];
    return synastryData.aspects
      .filter(
        (hit) =>
          isSynastryPointVisible(hit.personA, enabledChartObjects) &&
          isSynastryPointVisible(hit.personB, enabledChartObjects)
      )
      .filter((hit) => !aspectLinkFilter || hit.type === aspectLinkFilter);
  }, [synastryData, enabledChartObjects, aspectLinkFilter]);

  const synastryWheelAspects = useMemo(() => {
    if (chartViewMode !== "synastry" || !synastryData || !aspectLinkFilter) return undefined;
    return filteredSynastryAspects.map((hit) => ({
      base: activeChartPerson === "A" ? hit.personA : hit.personB,
      overlay: activeChartPerson === "A" ? hit.personB : hit.personA,
      type: hit.type
    }));
  }, [chartViewMode, synastryData, filteredSynastryAspects, activeChartPerson, aspectLinkFilter]);

  const synastryOverlayLabel = useMemo(() => {
    if (chartViewMode !== "synastry" || !synastryOverlayPlanets) return undefined;
    return activeChartPerson === "A" ? chartPersonLabel("B") : chartPersonLabel("A");
  }, [chartViewMode, activeChartPerson, synastryOverlayPlanets, synastryLabelA, synastryLabelB, synastryData]);

  const transitOverlayPlanets = useMemo(() => {
    if (chartViewMode !== "transit" || !transitsData) return undefined;
    return transitsData.transitSky.planets;
  }, [chartViewMode, transitsData]);

  const wheelOverlayPlanets = useMemo(() => {
    if (chartViewMode === "synastry") return synastryOverlayPlanets;
    if (chartViewMode === "transit") return transitOverlayPlanets;
    return undefined;
  }, [chartViewMode, synastryOverlayPlanets, transitOverlayPlanets]);

  const wheelOverlayLabel = useMemo(() => {
    if (chartViewMode === "synastry") return synastryOverlayLabel;
    if (chartViewMode === "transit" && transitsData) return bi("Transit", "Transit");
    return undefined;
  }, [chartViewMode, synastryOverlayLabel, transitsData]);

  const visibleTransitPlanets = useMemo(() => {
    if (chartViewMode !== "transit" || !transitsData) return [];
    return filterVisiblePlanets(transitsData.transitSky.planets, enabledChartObjects);
  }, [chartViewMode, transitsData, enabledChartObjects]);

  const visibleSynastryOverlayPlanets = useMemo(() => {
    if (chartViewMode !== "synastry" || !synastryOverlayPlanets) return [];
    return filterVisiblePlanets(synastryOverlayPlanets, enabledChartObjects);
  }, [chartViewMode, synastryOverlayPlanets, enabledChartObjects]);

  useEffect(() => {
    setInterpretationLang(loadInterpretationLangPrefs());
    setInterpretationLangHydrated(true);
    setEnabledChartObjects(loadEnabledChartObjects());
    setChartObjectsHydrated(true);
  }, []);

  useEffect(() => {
    if (!interpretationLangHydrated || typeof window === "undefined") return;
    localStorage.setItem(INTERPRETATION_LANG_STORAGE_KEY, JSON.stringify(interpretationLang));
  }, [interpretationLang, interpretationLangHydrated]);

  useEffect(() => {
    if (!chartObjectsHydrated || typeof window === "undefined") return;
    saveEnabledChartObjects(enabledChartObjects);
  }, [enabledChartObjects, chartObjectsHydrated]);

  function toggleChartObject(name: string, checked: boolean) {
    setEnabledChartObjects((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  function selectAllChartObjects() {
    setEnabledChartObjects(new Set(OPTIONAL_CHART_OBJECTS));
  }

  function unselectAllChartObjects() {
    setEnabledChartObjects(new Set());
  }

  function formatPlace(city: string, country: string): string {
    return `${city}, ${country}`;
  }

  async function calculateTransits() {
    if (!result) return;
    const birth = result.chart.birth;
    const transitLocation =
      transitSelectedLocation ?? (await resolveLocationFromText(transitLocationText));
    if (!transitLocation) {
      setTransitError(
        bi("Could not resolve transit location. Please choose a city from suggestions.", "Không xác định được địa điểm transit. Hãy chọn một thành phố trong gợi ý.")
      );
      return;
    }

    setTransitLoading(true);
    setTransitError("");
    try {
      const data = await requestNatalTransits({
        date: birth.date,
        time: birth.time,
        city: birth.city,
        country: birth.country,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone,
        transitDate,
        transitTime,
        transitTimezone: transitLocation.timezone,
        transitCity: transitLocation.city,
        transitCountry: transitLocation.country,
        transitLatitude: transitLocation.latitude,
        transitLongitude: transitLocation.longitude
      });
      setTransitsData(data);
    } catch (err) {
      setTransitsData(null);
      setTransitError(
        err instanceof Error ? err.message : bi("Unable to calculate transits.", "Không tính được transit.")
      );
    } finally {
      setTransitLoading(false);
    }
  }

  async function calculateSynastryChart() {
    if (!result || !resultB) {
      setSynastryError(
        bi("Generate both natal charts first (Person A and Person B).", "Tạo cả hai lá số natal trước (Người A và Người B).")
      );
      return;
    }
    const birthA = result.chart.birth;
    const birthB = resultB.chart.birth;

    setSynastryLoading(true);
    setSynastryError("");
    try {
      const data = await requestSynastry({
        personA: {
          label: synastryLabelA.trim() || bi("You", "Bạn"),
          date: birthA.date,
          time: birthA.time,
          city: birthA.city,
          country: birthA.country,
          latitude: birthA.latitude,
          longitude: birthA.longitude,
          timezone: birthA.timezone
        },
        personB: {
          label: synastryLabelB.trim() || bi("Partner", "Đối phương"),
          date: birthB.date,
          time: birthB.time,
          city: birthB.city,
          country: birthB.country,
          latitude: birthB.latitude,
          longitude: birthB.longitude,
          timezone: birthB.timezone
        }
      });
      setSynastryData(data);
      setActiveChartPerson("A");
    } catch (err) {
      setSynastryData(null);
      setSynastryError(
        err instanceof Error ? err.message : bi("Unable to calculate synastry.", "Không tính được synastry.")
      );
    } finally {
      setSynastryLoading(false);
    }
  }

  function setInterpretationLangOption(lang: keyof InterpretationLangPrefs, checked: boolean) {
    setInterpretationLang((current) => {
      const next = { ...current, [lang]: checked };
      if (!next.vi && !next.en) {
        return current;
      }
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldRestore = new URLSearchParams(window.location.search).get("success") === "true";
    if (!shouldRestore) {
      sessionStorage.removeItem(CHART_STATE_STORAGE_KEY);
      return;
    }
    const raw = sessionStorage.getItem(CHART_STATE_STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        date?: string;
        time?: string;
        locationText?: string;
        selectedLocation?: LocationOption | null;
        result?: ChartResponse | null;
      };
      if (saved.date) setDate(saved.date);
      if (saved.time) setTime(saved.time);
      if (saved.locationText) setLocationText(saved.locationText);
      if (saved.selectedLocation) setSelectedLocation(saved.selectedLocation);
      if (saved.result) setResult(saved.result);
    } catch {
      sessionStorage.removeItem(CHART_STATE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (chartViewMode !== "synastry") {
      setActiveChartPerson("A");
    }
  }, [chartViewMode]);

  useEffect(() => {
    setAspectLinkFilter(null);
  }, [displayChart, chartViewMode]);

  useEffect(() => {
    if (!result) {
      setChartViewMode("natal");
      setActiveChartPerson("A");
      setTransitsData(null);
      setTransitError("");
      setSynastryData(null);
      setSynastryError("");
      return;
    }
    const now = getNowDateTimeInTimezone(result.chart.birth.timezone);
    setTransitDate(now.date);
    setTransitTime(now.time);
    setTransitLocationText(formatPlace(result.chart.birth.city, result.chart.birth.country));
    setTransitSelectedLocation({
      id: "natal-birth",
      city: result.chart.birth.city,
      country: result.chart.birth.country,
      latitude: result.chart.birth.latitude,
      longitude: result.chart.birth.longitude,
      timezone: result.chart.birth.timezone
    });
    setTransitsData(null);
    setTransitError("");
    setSynastryData(null);
    setSynastryError("");
  }, [result]);

  useEffect(() => {
    setSynastryData(null);
    setSynastryError("");
  }, [resultB]);

  useEffect(() => {
    if (!activePersonalChart) return;
    const now = getNowDateTimeInTimezone(activePersonalChart.chart.birth.timezone);
    setTransitDate(now.date);
    setTransitTime(now.time);
    setTransitsData(null);
    setTransitError("");
  }, [activeChartPerson, activePersonalChart?.chart.birth.timezone]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldPersist = new URLSearchParams(window.location.search).get("success") === "true";
    if (!shouldPersist && !result) {
      return;
    }
    const snapshot = {
      date,
      time,
      locationText,
      selectedLocation,
      result
    };
    sessionStorage.setItem(CHART_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  }, [date, time, locationText, selectedLocation, result]);

  useEffect(() => {
    if (storedChartAfterPaymentReturn()) {
      setDemoChartLoading(false);
      return;
    }
    if (result) {
      setDemoChartLoading(false);
      return;
    }
    const location = NOW_PREVIEW_LOCATIONS.find((loc) => loc.id === nowPreviewLocationId) ?? NOW_PREVIEW_LOCATIONS[0];
    const { date: demoDate, time: demoTime } = getNowDateTimeInTimezone(location.timezone);
    let cancelled = false;
    setDemoChartLoading(true);
    setDemoChartError("");
    (async () => {
      try {
        const data = await requestBirthChart({
          date: demoDate,
          time: demoTime,
          city: location.city,
          country: location.country,
          latitude: location.latitude,
          longitude: location.longitude,
          timezone: location.timezone
        });
        if (!cancelled) {
          setDemoChartResult(data);
        }
      } catch (err) {
        if (!cancelled) {
          setDemoChartResult(null);
          setDemoChartError(
            err instanceof Error
              ? bi(err.message, "Không tạo được lá số xem trước. Kiểm tra API.")
              : bi("Preview chart failed.", "Không tạo được lá số xem trước.")
          );
        }
      } finally {
        if (!cancelled) setDemoChartLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nowPreviewLocationId, result]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setError(bi("Please complete date, time, and city/country.", "Vui lòng nhập đủ ngày, giờ và thành phố/quốc gia."));
      return;
    }
    setError("");
    setLoading(true);

    try {
      const location = selectedLocation ?? (await resolveLocationFromText(locationText));
      if (!location) {
        throw new Error(
          bi("Could not resolve location. Please choose a city from suggestions.", "Không xác định được địa điểm. Hãy chọn một thành phố trong gợi ý.")
        );
      }

      const data = await requestBirthChart({
        date,
        time,
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone
      });
      setResult(data);
      setActiveMeaning(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? bi(err.message, "Không tạo được lá số. Kiểm tra dữ liệu và thử lại.")
          : bi("Failed to generate chart. Please try again.", "Tạo lá số thất bại. Vui lòng thử lại.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitPersonB(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmitPersonB) {
      setErrorB(
        bi("Please complete partner date, time, and city/country.", "Vui lòng nhập đủ ngày, giờ và thành phố/quốc gia của đối phương.")
      );
      return;
    }
    setErrorB("");
    setLoadingB(true);

    try {
      const location =
        synastrySelectedLocation ?? (await resolveLocationFromText(synastryLocationText));
      if (!location) {
        throw new Error(
          bi("Could not resolve partner location. Please choose a city from suggestions.", "Không xác định được nơi sinh đối phương. Hãy chọn một thành phố trong gợi ý.")
        );
      }

      const data = await requestBirthChart({
        date: synastryDate,
        time: synastryTime,
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone
      });
      setResultB(data);
    } catch (err) {
      setErrorB(
        err instanceof Error
          ? err.message
          : bi("Failed to generate partner chart. Please try again.", "Tạo lá số đối phương thất bại. Vui lòng thử lại.")
      );
    } finally {
      setLoadingB(false);
    }
  }

  useEffect(() => {
    if (unlockAspects) return;
    const syncToken = () => setAspectAccessToken(getAspectAccessToken());
    syncToken();
    window.addEventListener("aspect-access-changed", syncToken);
    return () => window.removeEventListener("aspect-access-changed", syncToken);
  }, [unlockAspects]);

  useEffect(() => {
    if (!displayChart) {
      setMeaningsByKey({});
      return;
    }

    const keys = new Set<string>();
    displayChart.chart.planets.forEach((item) => {
      keys.add(`${slugify(item.planet)}_${slugify(item.sign)}`);
      keys.add(`${slugify(item.planet)}_${item.house}`);
    });
    displayChart.chart.houses.forEach((house) => {
      keys.add(`house_${house.house}`);
      keys.add(`house_${house.house}_${slugify(house.sign)}`);
    });
    displayChart.chart.aspects.forEach((aspect) => {
      keys.add(`${slugify(aspect.between[0])}_${slugify(aspect.type)}_${slugify(aspect.between[1])}`);
      keys.add(`${slugify(aspect.between[1])}_${slugify(aspect.type)}_${slugify(aspect.between[0])}`);
    });

    const mapItems = (items: MeaningItem[]) => {
      const mapped: Record<string, MeaningItem> = {};
      items.forEach((item) => {
        if (keys.has(item.key)) {
          mapped[`${item.category}:${item.key}`] = item;
        }
      });
      setMeaningsByKey(mapped);
    };

    if (unlockAspects && adminToken) {
      fetch(`${API_URL}/cms/meanings`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
        .then(async (response) => {
          if (!response.ok) {
            setMeaningsByKey({});
            return;
          }
          mapItems((await response.json()) as MeaningItem[]);
        })
        .catch(() => setMeaningsByKey({}));
      return;
    }

    const queryParams = new URLSearchParams({ keys: [...keys].join(",") });
    if (aspectAccessToken) {
      queryParams.set("aspectAccessToken", aspectAccessToken);
    }
    fetch(`${API_URL}/meanings/public?${queryParams.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          setMeaningsByKey({});
          return;
        }
        mapItems((await response.json()) as MeaningItem[]);
      })
      .catch(() => setMeaningsByKey({}));
  }, [displayChart, aspectAccessToken, unlockAspects, adminToken]);

  function openMeaning(category: MeaningItem["category"], key: string, fallbackTitle: string | { en: string; vi: string }) {
    const found = meaningsByKey[`${category}:${key}`];
    if (found) {
      setActiveMeaning({
        ...found,
        content: withContentFallback(found.content)
      });
      return;
    }
    const title =
      typeof fallbackTitle === "string" ? { en: fallbackTitle, vi: fallbackTitle } : fallbackTitle;
    setActiveMeaning({
      _id: `missing-${category}-${key}`,
      category,
      key,
      title,
      content: {
        en: "No CMS content for this item yet. You can add it in /admin.",
        vi: "Chưa có nội dung trong CMS cho mục này. Bạn có thể thêm ở trang /admin."
      }
    });
  }

  async function exportInterpretationsPdf() {
    if (!displayChart) return;
    const birth = displayChart.chart.birth;
    const useAdminApi = Boolean(unlockAspects && adminToken);
    if (!useAdminApi && !result) return;

    setExportBusy(true);
    setExportMessage("");
    try {
      let chartImage: string | undefined;
      if (chartSvgRef.current) {
        chartImage = await svgElementToPngDataUrl(chartSvgRef.current);
      }

      const endpoint = useAdminApi
        ? `${API_URL}/cms/charts/export-interpretations`
        : `${API_URL}/charts/export-interpretations-pdf`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (useAdminApi && adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
      }

      const body: Record<string, unknown> = {
        date: birth.date,
        time: birth.time,
        city: birth.city,
        country: birth.country,
        latitude: birth.latitude,
        longitude: birth.longitude,
        timezone: birth.timezone,
        chartImage
      };
      if (!useAdminApi && aspectAccessToken) {
        body.aspectAccessToken = aspectAccessToken;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        const errText =
          payload?.error && typeof payload.error === "string"
            ? payload.error
            : bi("Export failed.", "Xuất lời giải thất bại.");
        throw new Error(errText);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? "chart-interpretations.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportMessage(bi("PDF exported.", "Đã xuất file PDF."));
    } catch (err) {
      setExportMessage(
        err instanceof Error ? err.message : bi("Export failed.", "Xuất lời giải thất bại.")
      );
    } finally {
      setExportBusy(false);
    }
  }

  const canExportNatalChartPdf = Boolean(result || (unlockAspects && adminToken));

  function renderExportNatalChartPdfBlock() {
    if (!canExportNatalChartPdf) return null;
    return (
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
        <p className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
          {bi("Export your natal chart (PDF)", "Xuất lá số tử vi (PDF)")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi(
            "Download a PDF with your chart wheel image and CMS interpretations (aspects included when unlocked).",
            "Tải file PDF gồm ảnh vòng lá số và lời giải CMS (có aspect nếu đã mở khóa)."
          )}
        </p>
        <button
          type="button"
          disabled={exportBusy}
          onClick={() => void exportInterpretationsPdf()}
          className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {exportBusy
            ? bi("Exporting PDF…", "Đang xuất PDF…")
            : bi("Export your natal chart (PDF)", "Xuất lá số tử vi (PDF)")}
        </button>
        {exportMessage && (
          <p className="mt-2 text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">{exportMessage}</p>
        )}
      </div>
    );
  }

  function renderInterpretationLanguageBlock() {
    return (
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/80 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi("Interpretation language", "Ngôn ngữ diễn giải")}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi(
            "Choose which language(s) to show when you open planet, house, or aspect explanations.",
            "Chọn ngôn ngữ hiển thị khi bạn mở giải thích hành tinh, nhà hoặc aspect."
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={interpretationLang.vi}
              onChange={(e) => setInterpretationLangOption("vi", e.target.checked)}
              className="rounded border-[var(--theme-border)]"
            />
            <span>{bi("Vietnamese", "Tiếng Việt")}</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={interpretationLang.en}
              onChange={(e) => setInterpretationLangOption("en", e.target.checked)}
              className="rounded border-[var(--theme-border)]"
            />
            <span>{bi("English", "Tiếng Anh")}</span>
          </label>
        </div>
      </div>
    );
  }

  function renderPersonChartToggle(options?: { inline?: boolean }) {
    if (chartViewMode !== "synastry" || !result) return null;

    const wrapperClass = options?.inline
      ? "flex flex-wrap items-center gap-2"
      : "flex flex-wrap items-center gap-2 border-t border-[var(--theme-border)] pt-3";

    return (
      <div className={wrapperClass}>
        <span className="text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi("Wheel base:", "Nền vòng:")}
        </span>
        <button
          type="button"
          aria-pressed={activeChartPerson === "A"}
          onClick={() => setActiveChartPerson("A")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors font-[family:var(--font-theme-ui)] ${
            activeChartPerson === "A"
              ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
              : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
          }`}
        >
          {chartPersonLabel("A")}
        </button>
        {resultB ? (
          <button
            type="button"
            aria-pressed={activeChartPerson === "B"}
            onClick={() => setActiveChartPerson("B")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors font-[family:var(--font-theme-ui)] ${
              activeChartPerson === "B"
                ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
                : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
            }`}
          >
            {chartPersonLabel("B")}
          </button>
        ) : null}
      </div>
    );
  }

  function renderChartViewControls() {
    if (!result) return null;

    return (
      <div className="space-y-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/80 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={chartViewMode === "natal"}
            onClick={() => setChartViewMode("natal")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors font-[family:var(--font-theme-ui)] ${
              chartViewMode === "natal"
                ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
                : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
            }`}
          >
            {bi("Natal", "Natal")}
          </button>
          <button
            type="button"
            aria-pressed={chartViewMode === "transit"}
            onClick={() => setChartViewMode("transit")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors font-[family:var(--font-theme-ui)] ${
              chartViewMode === "transit"
                ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
                : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
            }`}
          >
            {bi("Transits", "Transit")}
          </button>
          <button
            type="button"
            aria-pressed={chartViewMode === "synastry"}
            onClick={() => setChartViewMode("synastry")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors font-[family:var(--font-theme-ui)] ${
              chartViewMode === "synastry"
                ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
                : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
            }`}
          >
            {bi("Synastry", "Synastry")}
          </button>
        </div>

        {chartViewMode === "transit" ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi(
                "Transiting planets (purple) overlay your natal wheel. Choose where and when you are for the transit sky.",
                "Hành tinh transit (tím) lồng lên vòng natal của bạn. Chọn địa điểm và thời điểm transit."
              )}
            </p>
            {renderTransitLocationSummary()}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                  {bi("Transit date", "Ngày transit")}
                </label>
                <input
                  type="date"
                  value={transitDate}
                  onChange={(e) => setTransitDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-2.5 text-sm text-[var(--theme-body)] [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                  {bi("Transit time", "Giờ transit")}
                </label>
                <input
                  type="time"
                  value={transitTime}
                  onChange={(e) => setTransitTime(e.target.value)}
                  className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-2.5 text-sm text-[var(--theme-body)] [color-scheme:dark]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Transit location (city + country)", "Địa điểm transit (thành phố + quốc gia)")}
              </label>
              <LocationAutocomplete
                value={transitLocationText}
                onChange={(text) => {
                  setTransitLocationText(text);
                  if (!text.includes(",")) {
                    setTransitSelectedLocation(null);
                  }
                  setTransitsData(null);
                }}
                onSelect={(location) => {
                  setTransitSelectedLocation(location);
                  setTransitsData(null);
                }}
              />
            </div>
            <button
              type="button"
              disabled={
                transitLoading ||
                !transitDate ||
                !transitTime ||
                !result ||
                transitLocationText.trim().length < 2
              }
              onClick={() => void calculateTransits()}
              className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-[var(--theme-muted)] ring-1 ring-[var(--theme-border)] hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {transitLoading
                ? bi("Calculating transits…", "Đang tính transit…")
                : bi("Calculate transits", "Tính transit")}
            </button>
            {transitError ? (
              <p className="text-xs text-[var(--theme-error)] font-[family:var(--font-theme-warning)]">{transitError}</p>
            ) : null}
          </div>
        ) : chartViewMode === "synastry" ? (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi(
                "Choose the base wheel, then calculate to overlay both charts (black = base, purple = partner, dashed lines = synastry aspects).",
                "Chọn nền vòng, rồi bấm Tính synastry để lồng cả hai lá số (đen = nền, tím = đối phương, nét đứt = aspect synastry)."
              )}
            </p>
            {!resultB ? (
              <p className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi(
                  "Fill in Person B on the left and generate their chart.",
                  "Nhập Người B bên trái và tạo lá số."
                )}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {renderPersonChartToggle({ inline: true })}
              <button
                type="button"
                disabled={synastryLoading || !resultB}
                onClick={() => void calculateSynastryChart()}
                className="rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-[var(--theme-muted)] ring-1 ring-[var(--theme-border)] hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {synastryLoading
                  ? bi("Calculating synastry…", "Đang tính synastry…")
                  : bi("Calculate synastry", "Tính synastry")}
              </button>
            </div>
            {synastryData ? (
              <p className="text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi(
                  "Both charts are overlaid on the wheel. Switch base to reverse the overlay direction.",
                  "Cả hai lá số đã lồng trên vòng. Đổi nền vòng để xem chiều ngược."
                )}
              </p>
            ) : null}
            {synastryError ? (
              <p className="text-xs text-[var(--theme-error)] font-[family:var(--font-theme-warning)]">{synastryError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderTransitLocationSummary() {
    if (!result) return null;

    const natalPlace = formatPlace(result.chart.birth.city, result.chart.birth.country);
    const activeTransitPlace = transitsData
      ? formatPlace(transitsData.transitLocation.city, transitsData.transitLocation.country)
      : transitSelectedLocation
        ? formatPlace(transitSelectedLocation.city, transitSelectedLocation.country)
        : transitLocationText.trim() || natalPlace;

    return (
      <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
        <p>
          <span className="font-semibold text-[var(--theme-heading)]">{bi("Natal chart:", "Lá số natal:")}</span>{" "}
          {natalPlace}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-violet-700">{bi("Transit location:", "Địa điểm transit:")}</span>{" "}
          {activeTransitPlace}
          {transitsData ? (
            <span className="text-[var(--theme-muted)]">
              {" "}
              · {transitsData.transitMoment.date} {transitsData.transitMoment.time} ({transitsData.transitMoment.timezone})
            </span>
          ) : transitDate && transitTime ? (
            <span className="text-[var(--theme-muted)]">
              {" "}
              · {transitDate} {transitTime}
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  function renderTransitHitsBlock() {
    const natalLabel = result ? chartPersonLabel("A") : null;

    return (
      <div>
        <h2 className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
          {natalLabel
            ? bi(`Transits to ${natalLabel}`, `Transit tới ${natalLabel}`)
            : bi("Transits to natal", "Transit tới natal")}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi(
            "Transiting planets aspecting your natal chart. Filter by aspect type using the buttons below.",
            "Hành tinh transit tạo aspect với lá số natal. Lọc theo loại aspect bằng các nút bên dưới."
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {ASPECT_TYPE_ORDER.map((type) => {
            const meta = ASPECT_META[type];
            const active = aspectLinkFilter === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setAspectLinkFilter((prev) => (prev === type ? null : type))}
                className={`rounded border px-2 py-1 font-medium transition-colors ${
                  active
                    ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
                    : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
                }`}
              >
                <span className={meta.color}>{meta.symbol}</span> {meta.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
          {!transitsData ? (
            <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("Choose a date/time and calculate transits.", "Chọn ngày/giờ và bấm Tính transit.")}
            </p>
          ) : filteredTransits.length === 0 ? (
            <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("No major transits in orb for the current filter.", "Không có transit chính nào trong orb với bộ lọc hiện tại.")}
            </p>
          ) : (
            filteredTransits.map((hit, index) => {
              const meta = ASPECT_META[hit.type] ?? { symbol: hit.symbol, label: hit.type, color: "text-slate-300" };
              const phase = TRANSIT_PHASE_LABELS[hit.phase] ?? { en: hit.phase, vi: hit.phase };
              return (
                <p key={`${hit.transiting}-${hit.natal}-${hit.type}-${index}`} className="text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--theme-heading)]">
                    <ChartObjectGlyph objectId={hit.transiting} size="sm" />
                    <span>{hit.transiting}</span>
                  </span>{" "}
                  <span className={meta.color}>
                    {meta.symbol} {meta.label}
                  </span>{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--theme-heading)]">
                    <ChartObjectGlyph objectId={hit.natal} size="sm" />
                    <span>{hit.natal}</span>
                  </span>{" "}
                  ({bi("orb", "sai số")} {hit.orb}, {bi(phase.en, phase.vi)}
                  {hit.isRetrograde ? `, ${bi("Rx", "nghịch hành")}` : ""})
                </p>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function renderSynastryHitsBlock() {
    const labelA = synastryData?.personA.label ?? synastryLabelA;
    const labelB = synastryData?.personB.label ?? synastryLabelB;

    return (
      <div>
        <h2 className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
          {bi("Synastry aspects", "Aspect synastry")}
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi(
            "Major aspects between two natal charts. Filter by aspect type using the buttons below.",
            "Các aspect chính giữa hai lá số natal. Lọc theo loại aspect bằng các nút bên dưới."
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {ASPECT_TYPE_ORDER.map((type) => {
            const meta = ASPECT_META[type];
            const active = aspectLinkFilter === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setAspectLinkFilter((prev) => (prev === type ? null : type))}
                className={`rounded border px-2 py-1 font-medium transition-colors ${
                  active
                    ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)]"
                    : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:bg-[var(--theme-panel)]"
                }`}
              >
                <span className={meta.color}>{meta.symbol}</span> {meta.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
          {!synastryData ? (
            <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi(
                "Generate both natal charts, then calculate synastry.",
                "Tạo cả hai lá số natal, rồi bấm Tính synastry."
              )}
            </p>
          ) : filteredSynastryAspects.length === 0 ? (
            <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("No major synastry aspects in orb for the current filter.", "Không có aspect synastry chính nào trong orb với bộ lọc hiện tại.")}
            </p>
          ) : (
            filteredSynastryAspects.map((hit, index) => {
              const meta = ASPECT_META[hit.type] ?? { symbol: "•", label: hit.type, color: "text-slate-300" };
              return (
                <p key={`${hit.personA}-${hit.personB}-${hit.type}-${index}`} className="text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                  <span className="font-semibold text-[var(--theme-heading)]">{labelA}</span>{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--theme-heading)]">
                    <ChartObjectGlyph objectId={hit.personA} size="sm" />
                    <span>{hit.personA}</span>
                  </span>{" "}
                  <span className={meta.color}>
                    {meta.symbol} {meta.label}
                  </span>{" "}
                  <span className="font-semibold text-[var(--theme-heading)]">{labelB}</span>{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--theme-heading)]">
                    <ChartObjectGlyph objectId={hit.personB} size="sm" />
                    <span>{hit.personB}</span>
                  </span>{" "}
                  ({bi("orb", "sai số")} {hit.orb})
                </p>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function renderObjectsSettingsBlock() {
    const enabledCount = enabledChartObjects.size;
    const totalOptional = OPTIONAL_CHART_OBJECTS.length;
    const allSelected = enabledCount >= totalOptional;
    const noneSelected = enabledCount === 0;

    return (
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/80">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
          onClick={() => setObjectsSettingsOpen((open) => !open)}
          aria-expanded={objectsSettingsOpen}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("Objects settings", "Objects settings")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi(
                "The seven classical planets stay on the chart by default. Enable extra planets, points, and Arabic parts when you need them.",
                "7 hành tinh cổ điển luôn hiển thị mặc định. Bật thêm hành tinh, điểm toán tử và Arabic parts khi cần."
              )}
            </p>
          </div>
          <span className="shrink-0 text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
            {objectsSettingsOpen
              ? bi("Hide", "Ẩn")
              : enabledCount > 0
                ? bi(`${enabledCount} enabled`, `${enabledCount} đã bật`)
                : bi("Show", "Hiện")}
          </span>
        </button>

        {objectsSettingsOpen ? (
          <div className="space-y-4 border-t border-[var(--theme-border)] px-3 pb-3 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={allSelected}
                onClick={selectAllChartObjects}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-body)] hover:bg-[var(--theme-bg)] disabled:cursor-not-allowed disabled:opacity-50 font-[family:var(--font-theme-ui)]"
              >
                {bi("Select all", "Chọn tất cả")}
              </button>
              <button
                type="button"
                disabled={noneSelected}
                onClick={unselectAllChartObjects}
                className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--theme-body)] hover:bg-[var(--theme-bg)] disabled:cursor-not-allowed disabled:opacity-50 font-[family:var(--font-theme-ui)]"
              >
                {bi("Unselect all", "Bỏ chọn tất cả")}
              </button>
              <span className="text-[11px] text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi(`${enabledCount} / ${totalOptional} optional objects`, `${enabledCount} / ${totalOptional} điểm tùy chọn`)}
              </span>
            </div>
            {OBJECT_SETTINGS_CATEGORIES.map((category) => (
              <div key={category.id}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--theme-heading)] font-[family:var(--font-theme-ui)]">
                  {bi(category.title.en, category.title.vi)}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                  {bi(category.description.en, category.description.vi)}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {category.objects.map((name) => {
                    const def = getChartObjectDefinition(name);
                    if (!def) return null;

                    if (category.informational) {
                      return (
                        <div
                          key={name}
                          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/40 px-2.5 py-2 text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]"
                        >
                          <p className="flex items-center gap-1.5 font-medium">
                            <ChartObjectGlyph objectId={name} size="sm" />
                            <span>{bi(def.label.en, def.label.vi)}</span>
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-muted)]">
                            {bi(def.description.en, def.description.vi)}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <label
                        key={name}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-panel)]/60 px-2.5 py-2 text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-[var(--theme-border)]"
                          checked={enabledChartObjects.has(name)}
                          onChange={(e) => toggleChartObject(name, e.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="font-medium inline-flex items-center gap-1.5">
                            <ChartObjectGlyph objectId={name} size="sm" />
                            <span>{bi(def.label.en, def.label.vi)}</span>
                          </span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-[var(--theme-muted)]">
                            {bi(def.description.en, def.description.vi)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 text-[var(--theme-body)] sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 lg:col-span-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
              {siteTheme.siteTitle.trim() || "AstroScope"}
            </h1>
            <p className="mt-1 text-sm text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi(
                "Generate a modern, mobile-friendly natal chart in seconds.",
                "Tạo lá số tử vi hiện đại, thân thiện mobile trong vài giây."
              )}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {chartViewMode === "synastry" ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-heading)] font-[family:var(--font-theme-ui)]">
                  {bi("Person A", "Người A")}
                </p>
                <div>
                  <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Label (optional)", "Nhãn (tùy chọn)")}
                  </label>
                  <input
                    type="text"
                    value={synastryLabelA}
                    onChange={(e) => setSynastryLabelA(e.target.value)}
                    placeholder={bi("You", "Bạn")}
                    className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-sm text-[var(--theme-body)] outline-none focus:border-[var(--theme-muted)]"
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Date of birth", "Ngày sinh")}
              </label>
              <div className="relative">
                <input
                  ref={dateInputRef}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 pr-12 text-sm text-[var(--theme-body)] outline-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden focus:border-[var(--theme-muted)]"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={bi("Open date picker", "Mở lịch ngày")}
                  className="absolute right-2 top-1/2 z-20 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-heading)] shadow-sm hover:opacity-90"
                  onClick={() => {
                    const input = dateInputRef.current as HTMLInputElement | null;
                    if (!input) return;
                    if (typeof input.showPicker === "function") {
                      input.showPicker();
                    } else {
                      input.focus();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Time of birth", "Giờ sinh")}
              </label>
              <div className="relative">
                <input
                  ref={timeInputRef}
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 pr-12 text-sm text-[var(--theme-body)] outline-none [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden focus:border-[var(--theme-muted)]"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={bi("Open time picker", "Mở chọn giờ")}
                  className="absolute right-2 top-1/2 z-20 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] text-[var(--theme-heading)] shadow-sm hover:opacity-90"
                  onClick={() => {
                    const input = timeInputRef.current as HTMLInputElement | null;
                    if (!input) return;
                    if (typeof input.showPicker === "function") {
                      input.showPicker();
                    } else {
                      input.focus();
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6l4 2" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("City + country", "Thành phố + quốc gia")}
              </label>
              <LocationAutocomplete
                value={locationText}
                onChange={(text) => {
                  setLocationText(text);
                  if (!text.includes(",")) {
                    setSelectedLocation(null);
                  }
                }}
                onSelect={setSelectedLocation}
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="w-full rounded-full bg-zinc-950 p-3 text-sm font-semibold text-[var(--theme-muted)] shadow-inner ring-1 ring-[var(--theme-border)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? bi("Generating…", "Đang tạo…")
                : bi("Generate birth chart", "Tạo lá số tử vi")}
            </button>

            <div className="mt-4">{renderExportNatalChartPdfBlock()}</div>

            {error && (
              <p className="text-sm font-[family:var(--font-theme-warning)] text-[var(--theme-error)]">{error}</p>
            )}
          </form>

          {chartViewMode === "synastry" ? (
          <form className="mt-8 space-y-4 border-t border-[var(--theme-border)] pt-6" onSubmit={onSubmitPersonB}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--theme-heading)] font-[family:var(--font-theme-ui)]">
              {bi("Person B", "Người B")}
            </p>
            <p className="text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi(
                "Partner birth data for synastry comparison.",
                "Dữ liệu sinh đối phương để so sánh synastry."
              )}
            </p>
            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Label (optional)", "Nhãn (tùy chọn)")}
              </label>
              <input
                type="text"
                value={synastryLabelB}
                onChange={(e) => setSynastryLabelB(e.target.value)}
                placeholder={bi("Partner", "Đối phương")}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-sm text-[var(--theme-body)] outline-none focus:border-[var(--theme-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Date of birth", "Ngày sinh")}
              </label>
              <input
                type="date"
                value={synastryDate}
                onChange={(e) => setSynastryDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-sm text-[var(--theme-body)] outline-none [color-scheme:dark] focus:border-[var(--theme-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Time of birth", "Giờ sinh")}
              </label>
              <input
                type="time"
                value={synastryTime}
                onChange={(e) => setSynastryTime(e.target.value)}
                className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-sm text-[var(--theme-body)] outline-none [color-scheme:dark] focus:border-[var(--theme-muted)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("City + country", "Thành phố + quốc gia")}
              </label>
              <LocationAutocomplete
                value={synastryLocationText}
                onChange={(text) => {
                  setSynastryLocationText(text);
                  if (!text.includes(",")) {
                    setSynastrySelectedLocation(null);
                  }
                }}
                onSelect={setSynastrySelectedLocation}
              />
            </div>
            <button
              type="submit"
              disabled={!canSubmitPersonB || loadingB}
              className="w-full rounded-full bg-zinc-950 p-3 text-sm font-semibold text-[var(--theme-muted)] shadow-inner ring-1 ring-[var(--theme-border)] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingB
                ? bi("Generating partner chart…", "Đang tạo lá số đối phương…")
                : resultB
                  ? bi("Regenerate partner chart", "Tạo lại lá số đối phương")
                  : bi("Generate partner chart", "Tạo lá số đối phương")}
            </button>
            {errorB ? (
              <p className="text-sm font-[family:var(--font-theme-warning)] text-[var(--theme-error)]">{errorB}</p>
            ) : null}
            {resultB ? (
              <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                {bi("Partner chart ready.", "Lá số đối phương đã sẵn sàng.")}
              </p>
            ) : null}
          </form>
          ) : null}

          <figure className="mt-6 border-t border-[var(--theme-border)] pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogoSrc}
              alt={bi("Brand logo", "Logo thương hiệu")}
              className="mx-auto block h-auto w-full max-w-md object-contain object-center sm:max-w-lg"
              loading="lazy"
              decoding="async"
            />
          </figure>
        </section>

        <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 lg:col-span-3">
          {demoChartLoading && !displayChart && (
            <p className="text-sm text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("Loading NOW preview chart…", "Đang tải lá số NOW (thời điểm hiện tại)…")}
            </p>
          )}
          {demoChartError && !displayChart && (
            <p className="text-sm font-[family:var(--font-theme-warning)] text-[var(--theme-error)]">{demoChartError}</p>
          )}
          {!displayChart && !demoChartLoading && !demoChartError && (
            <p className="text-sm text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
              {bi("Preview chart could not be displayed.", "Không hiển thị được biểu đồ xem trước.")}
            </p>
          )}
          {displayChart && (
            <div className="space-y-6">
              {!result && (
                <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)]/80 p-3 text-xs text-[var(--theme-body)]">
                  <p className="font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {bi("NOW — current-time chart", "NOW — biểu đồ thời điểm hiện tại")}
                  </p>
                  <p className="mt-1 font-[family:var(--font-theme-body)]">
                    {bi(
                      "Date/time uses the timezone of your selected place (default: Perth, Western Australia 6000). Enter your birth data on the left to view your natal chart.",
                      "Ngày và giờ theo múi giờ địa điểm bạn chọn (mặc định Perth, Tây Úc 6000). Nhập ngày giờ sinh bên trái để xem lá số cá nhân."
                    )}
                  </p>
                  <label
                    htmlFor="now-preview-location"
                    className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]"
                  >
                    {bi("Display location", "Địa điểm hiển thị")}
                  </label>
                  <select
                    id="now-preview-location"
                    className="mt-1 w-full max-w-md rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                    value={nowPreviewLocationId}
                    onChange={(e) => setNowPreviewLocationId(e.target.value)}
                  >
                    {NOW_PREVIEW_LOCATIONS.map((loc) => (
                      <option key={loc.id} value={loc.id} className="bg-[var(--theme-bg)] text-white">
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {renderChartViewControls()}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center">
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Sun", "Mặt trời")}
                  </p>
                  <p className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {activeWheelChart?.chart.sunSign}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center">
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Moon", "Mặt trăng")}
                  </p>
                  <p className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {activeWheelChart?.chart.moonSign}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center">
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Rising (Ascendant)", "Cung mọc (Ascendant)")}
                  </p>
                  <p className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {activeWheelChart?.chart.risingSign}
                  </p>
                </div>
              </div>

              {activeWheelChart && (
              <div className="mx-auto w-full max-w-2xl space-y-2 rounded-xl bg-white p-2 sm:p-3">
                {chartViewMode === "transit" ? renderTransitLocationSummary() : null}
                {(chartViewMode === "synastry" && synastryData) ||
                (chartViewMode === "transit" && transitsData) ? (
                  <p className="text-center text-[11px] text-slate-600 font-[family:var(--font-theme-ui)]">
                    {chartViewMode === "transit" && transitsData ? (
                      bi(
                        `${chartPersonLabel("A")} — black glyphs · Transit — purple glyphs`,
                        `${chartPersonLabel("A")} — glyph đen · Transit — glyph tím`
                      )
                    ) : (
                      bi(
                        `${chartPersonLabel(activeChartPerson)} — black glyphs · ${synastryOverlayLabel ?? chartPersonLabel(activeChartPerson === "A" ? "B" : "A")} — purple glyphs · tap an aspect type below to show links on the wheel`,
                        `${chartPersonLabel(activeChartPerson)} — glyph đen · ${synastryOverlayLabel ?? chartPersonLabel(activeChartPerson === "A" ? "B" : "A")} — glyph tím · chọn loại aspect bên dưới để hiện đường nối trên vòng`
                      )
                    )}
                  </p>
                ) : null}
                <ChartWheel
                  chart={activeWheelChart.chart}
                  svgRef={chartSvgRef}
                  aspectTypeFilter={
                    chartViewMode === "natal" || (chartViewMode === "synastry" && synastryData)
                      ? aspectLinkFilter
                      : null
                  }
                  enabledOptionalPoints={enabledChartObjects}
                  overlayPlanets={wheelOverlayPlanets}
                  overlayChart={synastryOverlayChart}
                  overlayAspects={synastryWheelAspects}
                  overlayLabel={wheelOverlayLabel}
                  onPointClick={(point) =>
                    openMeaning(
                      "planet_sign",
                      `${slugify(point.planet)}_${slugify(point.sign)}`,
                      { en: `${point.planet} in ${point.sign}`, vi: `${point.planet} trong ${point.sign}` }
                    )
                  }
                />
              </div>
              )}

              {renderObjectsSettingsBlock()}

              {renderInterpretationLanguageBlock()}

              <div>
                <h2 className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                  {bi("12 Houses", "12 nhà")}
                  {chartViewMode === "transit" && transitsData ? (
                    <span className="ml-1 text-[11px] font-normal text-[var(--theme-muted)]">
                      ({chartPersonLabel("A")})
                    </span>
                  ) : chartViewMode === "synastry" && synastryData ? (
                    <span className="ml-1 text-[11px] font-normal text-[var(--theme-muted)]">
                      ({chartPersonLabel(activeChartPerson)} + {chartPersonLabel(activeChartPerson === "A" ? "B" : "A")})
                    </span>
                  ) : null}
                </h2>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(activeWheelChart ?? displayChart).chart.houses.map((house) => (
                    <div
                      key={house.house}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-2 text-xs"
                    >
                      <p className="text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                        {bi(`House ${house.house}: ${house.sign}`, `Nhà ${house.house}: ${house.sign}`)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)] font-[family:var(--font-theme-link)]"
                          onClick={() =>
                            openMeaning("house", `house_${house.house}`, {
                              en: `House ${house.house}`,
                              vi: `Nhà ${house.house}`
                            })
                          }
                        >
                          {bi(`House ${house.house}`, `Nhà ${house.house}`)}
                        </button>
                        <button
                          type="button"
                          className="text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)] font-[family:var(--font-theme-link)]"
                          onClick={() =>
                            openMeaning(
                              "house_sign",
                              `house_${house.house}_${slugify(house.sign)}`,
                              {
                                en: `House ${house.house} in ${house.sign}`,
                                vi: `Nhà ${house.house} trong ${house.sign}`
                              }
                            )
                          }
                        >
                          {bi(`House ${house.house} in ${house.sign}`, `Nhà ${house.house} trong ${house.sign}`)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                  {chartViewMode === "transit"
                    ? bi(
                        `${chartPersonLabel("A")} — natal · Transit — purple on wheel`,
                        `${chartPersonLabel("A")} — natal · Transit — tím trên vòng`
                      )
                    : chartViewMode === "synastry" && synastryData
                      ? bi(
                          `${chartPersonLabel(activeChartPerson)} — natal · ${chartPersonLabel(activeChartPerson === "A" ? "B" : "A")} — purple on wheel`,
                          `${chartPersonLabel(activeChartPerson)} — natal · ${chartPersonLabel(activeChartPerson === "A" ? "B" : "A")} — tím trên vòng`
                        )
                      : chartViewMode === "synastry" && resultB
                        ? bi("Preview base chart — calculate synastry to overlay both", "Xem trước nền vòng — bấm Tính synastry để lồng cả hai")
                      : bi("Planets & mathematical points", "Hành tinh & điểm tính toán")}
                </h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {visiblePlanets.map((item) => (
                    <div
                      key={item.planet}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-2 text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]"
                    >
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--theme-heading)]">
                        <ChartObjectGlyph objectId={item.planet} size="sm" />
                        <span>{item.planet}</span>
                      </span>
                      : {item.sign}{" "}
                      ({bi(`H${item.house}`, `Nhà ${item.house}`)})
                      <div className="mt-1 flex gap-3">
                        <button
                          type="button"
                          className="text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)] font-[family:var(--font-theme-link)]"
                          onClick={() =>
                            openMeaning(
                              "planet_sign",
                              `${slugify(item.planet)}_${slugify(item.sign)}`,
                              { en: `${item.planet} in ${item.sign}`, vi: `${item.planet} trong ${item.sign}` }
                            )
                          }
                        >
                          {bi(`${item.planet} in ${item.sign}`, `${item.planet} trong ${item.sign}`)}
                        </button>
                        <button
                          type="button"
                          className="text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)] font-[family:var(--font-theme-link)]"
                          onClick={() =>
                            openMeaning("planet_house", `${slugify(item.planet)}_${item.house}`, {
                              en: `${item.planet} in House ${item.house}`,
                              vi: `${item.planet} trong Nhà ${item.house}`
                            })
                          }
                        >
                          {bi(`${item.planet} in House ${item.house}`, `${item.planet} trong Nhà ${item.house}`)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {chartViewMode === "transit" && visibleTransitPlanets.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 font-[family:var(--font-theme-ui)]">
                      {bi("Transiting planets (purple on wheel)", "Hành tinh transit (tím trên vòng)")}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {visibleTransitPlanets.map((item) => (
                        <div
                          key={`transit-${item.planet}`}
                          className="rounded-lg border border-violet-300/60 bg-violet-50 p-2 text-xs text-violet-950 font-[family:var(--font-theme-body)]"
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700">
                            <ChartObjectGlyph objectId={item.planet} size="sm" />
                            <span>{item.planet}</span>
                          </span>
                          : {item.sign}{" "}
                          ({bi(`H${item.house}`, `Nhà ${item.house}`)})
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {chartViewMode === "synastry" && visibleSynastryOverlayPlanets.length > 0 && synastryData ? (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 font-[family:var(--font-theme-ui)]">
                      {bi(
                        `${synastryOverlayLabel ?? chartPersonLabel(activeChartPerson === "A" ? "B" : "A")} — purple on wheel`,
                        `${synastryOverlayLabel ?? chartPersonLabel(activeChartPerson === "A" ? "B" : "A")} — tím trên vòng`
                      )}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {visibleSynastryOverlayPlanets.map((item) => (
                        <div
                          key={`synastry-overlay-${item.planet}`}
                          className="rounded-lg border border-violet-300/60 bg-violet-50 p-2 text-xs text-violet-950 font-[family:var(--font-theme-body)]"
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold text-violet-700">
                            <ChartObjectGlyph objectId={item.planet} size="sm" />
                            <span>{item.planet}</span>
                          </span>
                          : {item.sign}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {chartViewMode === "transit" ? (
                renderTransitHitsBlock()
              ) : chartViewMode === "synastry" ? (
                renderSynastryHitsBlock()
              ) : (
              <div>
                <h2 className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                  {bi("Aspects (links)", "Aspect (liên kết)")}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                  {bi(
                    "Click a type to show only that aspect on the wheel; click again to show all aspects.",
                    "Bấm một loại để chỉ hiện liên kết đó trên vòng; bấm lại để hiện tất cả."
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {ASPECT_TYPE_ORDER.map((type) => {
                    const meta = ASPECT_META[type];
                    const active = aspectLinkFilter === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={active}
                        title={
                          active
                            ? bi("Show all aspects on the wheel", "Hiện tất cả aspect trên vòng")
                            : bi(`Show only ${type} aspects`, `Chỉ hiện aspect ${type}`)
                        }
                        onClick={() => setAspectLinkFilter((prev) => (prev === type ? null : type))}
                        className={`rounded border px-2 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-link)]/50 ${
                          active
                            ? "border-[var(--theme-link)] bg-[var(--theme-panel)] text-[var(--theme-heading)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--theme-link)_35%,transparent)]"
                            : "border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--theme-body)] hover:border-[var(--theme-muted)] hover:bg-[var(--theme-panel)]"
                        }`}
                      >
                        <span className={meta.color}>{meta.symbol}</span> {meta.label}
                      </button>
                    );
                  })}
                </div>
                <UnlockSection
                  forceUnlocked={unlockAspects}
                  buttonLabel={bi("Unlock full aspects", "Mở khóa đầy đủ aspect")}
                  preview={
                    <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
                      {filteredAspects.slice(0, 6).map((aspect, index) => {
                        const meta = ASPECT_META[aspect.type] ?? {
                          symbol: "•",
                          label: aspect.type,
                          color: "text-slate-300"
                        };
                        return (
                          <p
                            key={`${aspect.between[0]}-${aspect.between[1]}-${index}`}
                            className="text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]"
                          >
                            <span className={meta.color}>
                              {meta.symbol} {meta.label}
                            </span>{" "}
                            - {aspect.between[0]} / {aspect.between[1]} ({bi("orb", "sai số")} {aspect.orb})
                          </p>
                        );
                      })}
                    </div>
                  }
                >
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
                    {filteredAspects.length === 0 && (
                      <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                        {displayChart.chart.aspects.length === 0
                          ? bi("No major aspects found.", "Không có aspect chính nào.")
                          : aspectLinkFilter
                            ? bi(
                                "No aspects of this type for the current filter.",
                                "Không có aspect loại này với bộ lọc hiện tại."
                              )
                            : bi(
                                "No aspects visible — enable extra points or generate a chart with more links.",
                                "Không có aspect hiển thị — bật thêm điểm phụ hoặc tạo lá số có nhiều liên kết hơn."
                              )}
                      </p>
                    )}
                    {filteredAspects.map((aspect, index) => {
                      const directKey = `${slugify(aspect.between[0])}_${slugify(aspect.type)}_${slugify(aspect.between[1])}`;
                      const reverseKey = `${slugify(aspect.between[1])}_${slugify(aspect.type)}_${slugify(aspect.between[0])}`;
                      const hasDirect = Boolean(meaningsByKey[`aspect:${directKey}`]);
                      const key = hasDirect ? directKey : reverseKey;
                      const meta = ASPECT_META[aspect.type] ?? {
                        symbol: "•",
                        label: aspect.type,
                        color: "text-slate-300"
                      };
                      return (
                        <button
                          key={`${aspect.between[0]}-${aspect.between[1]}-${index}`}
                          type="button"
                          className="block text-left text-xs text-[var(--theme-link)] underline hover:text-[var(--theme-link-hover)] font-[family:var(--font-theme-link)]"
                          onClick={() =>
                            openMeaning("aspect", key, {
                              en: `${aspect.between[0]} ${aspect.type} ${aspect.between[1]}`,
                              vi: `${aspect.between[0]} ${aspect.type} ${aspect.between[1]}`
                            })
                          }
                        >
                          <span className={meta.color}>
                            {meta.symbol} {meta.label}
                          </span>{" "}
                          - {aspect.between[0]} / {aspect.between[1]} ({bi("orb", "sai số")} {aspect.orb})
                        </button>
                      );
                    })}
                  </div>
                </UnlockSection>
              </div>
              )}
            </div>
          )}
        </section>
      </div>

      {activeMeaning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-auto flex w-full max-w-xl max-h-[min(85vh,100dvh-2rem)] flex-col rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 shadow-xl backdrop-blur-sm">
            {(() => {
              const title = toLocalized(activeMeaning.title);
              const content = toLocalized(activeMeaning.content);
              const showVi = interpretationLang.vi;
              const showEn = interpretationLang.en;
              const primaryTitle = showVi ? title.vi : title.en;
              const secondaryTitle = showVi && showEn && title.en.trim() && title.en !== title.vi ? title.en : null;
              return (
                <>
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--theme-border)] pb-3">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs uppercase tracking-wide text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                        {meaningCategoryLabel(activeMeaning.category)}
                      </p>
                      <h3 className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                        {primaryTitle}
                      </h3>
                      {secondaryTitle && (
                        <p className="text-sm text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">{secondaryTitle}</p>
                      )}
                      {!showVi && showEn && title.vi.trim() && title.vi !== title.en && (
                        <p className="text-sm text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">{title.vi}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-1 text-xs text-[var(--theme-body)] hover:opacity-90"
                      onClick={() => setActiveMeaning(null)}
                    >
                      {bi("Close", "Đóng")}
                    </button>
                  </div>
                  <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]">
                    {showVi && (
                      <div>
                        {showEn && (
                          <p className="mb-1 text-xs uppercase text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                            {bi("Vietnamese", "Tiếng Việt")}
                          </p>
                        )}
                        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                          {content.vi}
                        </p>
                      </div>
                    )}
                    {showEn && (
                      <div>
                        {showVi && (
                          <p className="mb-1 text-xs uppercase text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                            {bi("English", "Tiếng Anh")}
                          </p>
                        )}
                        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                          {content.en}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
