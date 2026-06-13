"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartWheel } from "@/components/ChartWheel";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { UnlockSection } from "@/components/UnlockSection";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { ChartResponse, LocationOption, MeaningItem } from "@/types/chart";
import { bi } from "@/lib/bilingual";
import { getAspectAccessToken } from "@/lib/aspectAccess";
import { resolveThemeAssetUrl } from "@/lib/siteTheme";
import { slugify } from "@/lib/slugify";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
/** Default brand mark in `public/branding/` when no logo URL is set in theme. */
const DEFAULT_BRAND_LOGO = "/branding/blogchiemtinh-logo.png";
const CHART_STATE_STORAGE_KEY = "astroscope-chart-state";
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

export default function Home() {
  const siteTheme = useSiteTheme();
  const brandLogoSrc = useMemo(() => {
    const raw = siteTheme.logoUrl?.trim();
    if (raw) return resolveThemeAssetUrl(raw);
    return DEFAULT_BRAND_LOGO;
  }, [siteTheme.logoUrl]);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [locationText, setLocationText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChartResponse | null>(null);
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

  const displayChart = useMemo(() => result ?? demoChartResult, [result, demoChartResult]);

  const canSubmit = useMemo(() => Boolean(date && time && locationText.trim().length > 1), [date, time, locationText]);

  const filteredAspects = useMemo(() => {
    if (!displayChart) return [];
    if (!aspectLinkFilter) return displayChart.chart.aspects;
    return displayChart.chart.aspects.filter((a) => a.type === aspectLinkFilter);
  }, [displayChart, aspectLinkFilter]);

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
    setAspectLinkFilter(null);
  }, [displayChart]);

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

  useEffect(() => {
    const syncToken = () => setAspectAccessToken(getAspectAccessToken());
    syncToken();
    window.addEventListener("aspect-access-changed", syncToken);
    return () => window.removeEventListener("aspect-access-changed", syncToken);
  }, []);

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
        const items = (await response.json()) as MeaningItem[];
        const mapped: Record<string, MeaningItem> = {};
        items.forEach((item) => {
          mapped[`${item.category}:${item.key}`] = item;
        });
        setMeaningsByKey(mapped);
      })
      .catch(() => setMeaningsByKey({}));
  }, [displayChart, aspectAccessToken]);

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

            {error && (
              <p className="text-sm font-[family:var(--font-theme-warning)] text-[var(--theme-error)]">{error}</p>
            )}
          </form>

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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center">
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Sun", "Mặt trời")}
                  </p>
                  <p className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {displayChart.chart.sunSign}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center">
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Moon", "Mặt trăng")}
                  </p>
                  <p className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {displayChart.chart.moonSign}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-center">
                  <p className="text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                    {bi("Rising (Ascendant)", "Cung mọc (Ascendant)")}
                  </p>
                  <p className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                    {displayChart.chart.risingSign}
                  </p>
                </div>
              </div>

              <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-2 sm:p-3">
                <ChartWheel
                  chart={displayChart.chart}
                  aspectTypeFilter={aspectLinkFilter}
                  onPointClick={(point) =>
                    openMeaning(
                      "planet_sign",
                      `${slugify(point.planet)}_${slugify(point.sign)}`,
                      { en: `${point.planet} in ${point.sign}`, vi: `${point.planet} trong ${point.sign}` }
                    )
                  }
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                  {bi("12 Houses", "12 nhà")}
                </h2>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {displayChart.chart.houses.map((house) => (
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
                  {bi("Planets & mathematical points", "Hành tinh & điểm tính toán")}
                </h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {displayChart.chart.planets.map((item) => (
                    <div
                      key={item.planet}
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-2 text-xs text-[var(--theme-body)] font-[family:var(--font-theme-body)]"
                    >
                      <span className="font-semibold text-[var(--theme-heading)]">{item.planet}</span>: {item.sign}{" "}
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
              </div>

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
                          : bi(
                              "No aspects of this type for the current filter.",
                              "Không có aspect loại này với bộ lọc hiện tại."
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
              return (
                <>
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--theme-border)] pb-3">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs uppercase tracking-wide text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                        {meaningCategoryLabel(activeMeaning.category)}
                      </p>
                      <h3 className="text-lg font-semibold text-[var(--theme-heading)] font-[family:var(--font-theme-heading)]">
                        {title.vi}
                      </h3>
                      <p className="text-sm text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">{title.en}</p>
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
                    <div>
                      <p className="mb-1 text-xs uppercase text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                        {bi("Vietnamese", "Tiếng Việt")}
                      </p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                        {content.vi}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
                        {bi("English", "Tiếng Anh")}
                      </p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--theme-body)] font-[family:var(--font-theme-body)]">
                        {content.en}
                      </p>
                    </div>
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
