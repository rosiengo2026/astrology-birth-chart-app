"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bi } from "@/lib/bilingual";
import {
  ASPECT_NAV,
  CMS_CATEGORY_TABS,
  defaultTitlesForKey,
  HOUSE_NUMBERS,
  PLANET_NAV,
  POINT_KEYS,
  rowLabelForKey,
  SIGN_KEYS,
  type MeaningCategory
} from "@/lib/cmsMeaningsMeta";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export type CmsMeaning = {
  _id: string;
  category: MeaningCategory;
  key: string;
  title: { en: string; vi: string };
  content: { en: string; vi: string };
};

type RowDraft = {
  id?: string;
  titleEn: string;
  titleVi: string;
  contentEn: string;
  contentVi: string;
};

type CmsMeaningsBulkEditorProps = {
  token: string;
  refreshSignal?: number;
  readOnly?: boolean;
  onUnauthorized: () => void;
  onMessage: (message: string) => void;
};

function emptyRow(): RowDraft {
  return { titleEn: "", titleVi: "", contentEn: "", contentVi: "" };
}

export function CmsMeaningsBulkEditor({
  token,
  refreshSignal = 0,
  readOnly = false,
  onUnauthorized,
  onMessage
}: CmsMeaningsBulkEditorProps) {
  const [category, setCategory] = useState<MeaningCategory>("planet_sign");
  const [selectedPoint, setSelectedPoint] = useState<(typeof PLANET_NAV)[number]["key"]>("sun");
  const [selectedAspect, setSelectedAspect] = useState<(typeof ASPECT_NAV)[number]["key"]>("conjunction");
  const [selectedHouse, setSelectedHouse] = useState<number>(1);
  const [meanings, setMeanings] = useState<CmsMeaning[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const [saving, setSaving] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

  const loadCategoryMeanings = useCallback(async () => {
    if (!token) return false;
    setLoading(true);
    try {
      const params = new URLSearchParams({ category });
      const response = await fetch(`${API_URL}/cms/meanings?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) {
        onUnauthorized();
        return false;
      }
      if (!response.ok) return false;
      const data = (await response.json()) as CmsMeaning[];
      setMeanings(data);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, category, onUnauthorized]);

  useEffect(() => {
    void loadCategoryMeanings();
  }, [loadCategoryMeanings, refreshSignal]);

  const rowKeys = useMemo(() => {
    if (category === "planet_sign") {
      return SIGN_KEYS.map((sign) => `${selectedPoint}_${sign}`);
    }
    if (category === "planet_house") {
      return HOUSE_NUMBERS.map((house) => `${selectedPoint}_${house}`);
    }
    if (category === "house") {
      return HOUSE_NUMBERS.map((house) => `house_${house}`);
    }
    if (category === "house_sign") {
      return SIGN_KEYS.map((sign) => `house_${selectedHouse}_${sign}`);
    }
    const leftIdx = POINT_KEYS.indexOf(selectedPoint);
    if (leftIdx < 0) return [];
    return POINT_KEYS.slice(leftIdx + 1).map((right) => `${selectedPoint}_${selectedAspect}_${right}`);
  }, [category, selectedPoint, selectedAspect, selectedHouse]);

  useEffect(() => {
    const next: Record<string, RowDraft> = {};
    for (const key of rowKeys) {
      const found = meanings.find((m) => m.category === category && m.key === key);
      next[key] = found
        ? {
            id: found._id,
            titleEn: found.title.en,
            titleVi: found.title.vi,
            contentEn: found.content.en,
            contentVi: found.content.vi
          }
        : emptyRow();
    }
    setRows(next);
  }, [category, meanings, rowKeys]);

  const headingPlanet = PLANET_NAV.find((p) => p.key === selectedPoint) ?? PLANET_NAV[0];
  const headingAspect = ASPECT_NAV.find((a) => a.key === selectedAspect) ?? ASPECT_NAV[0];

  const sectionHeading = useMemo(() => {
    if (category === "planet_sign") {
      return bi(
        `Interpretations For Natal ${headingPlanet.label} in The Signs`,
        `Diễn giải ${headingPlanet.labelVi} natal trong 12 cung`
      );
    }
    if (category === "planet_house") {
      return bi(
        `Interpretations For Natal ${headingPlanet.label} in The Houses`,
        `Diễn giải ${headingPlanet.labelVi} natal trong 12 nhà`
      );
    }
    if (category === "aspect") {
      return bi(
        `${headingAspect.label} aspects from ${headingPlanet.label}`,
        `Aspect ${headingAspect.labelVi} từ ${headingPlanet.labelVi}`
      );
    }
    if (category === "house") {
      return bi("Interpretations For The Twelve Houses", "Diễn giải 12 nhà astrologic");
    }
    return bi(
      `Interpretations For House ${selectedHouse} in The Signs`,
      `Diễn giải Nhà ${selectedHouse} trong 12 cung`
    );
  }, [category, headingPlanet, headingAspect, selectedHouse]);

  async function saveRow(key: string, draft: RowDraft): Promise<boolean> {
    const hasContent = draft.contentVi.trim() || draft.contentEn.trim();
    if (!hasContent && !draft.id) return true;

    const defaults = defaultTitlesForKey(category, key);
    const titleEn = draft.titleEn.trim() || defaults.en;
    const titleVi = draft.titleVi.trim() || defaults.vi;

    const url = draft.id ? `${API_URL}/cms/meanings/${draft.id}` : `${API_URL}/cms/meanings`;
    const method = draft.id ? "PUT" : "POST";
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        category,
        key,
        title: { en: titleEn, vi: titleVi },
        content: { en: draft.contentEn, vi: draft.contentVi }
      })
    });
    if (response.status === 401) {
      onUnauthorized();
      return false;
    }
    return response.ok;
  }

  async function saveAll() {
    if (saving) return;
    setSaving(true);
    onMessage("");
    let saved = 0;
    let failed = 0;
    for (const key of rowKeys) {
      const draft = rows[key] ?? emptyRow();
      const hasContent = draft.contentVi.trim() || draft.contentEn.trim();
      if (!hasContent && !draft.id) continue;
      const ok = await saveRow(key, draft);
      if (ok) saved += 1;
      else failed += 1;
    }
    await loadCategoryMeanings();
    setSaving(false);
    if (failed > 0) {
      onMessage(bi(`Saved ${saved} row(s), ${failed} failed.`, `Đã lưu ${saved} mục, ${failed} lỗi.`));
    } else {
      onMessage(bi(`Saved ${saved} row(s).`, `Đã lưu ${saved} mục.`));
    }
  }

  async function saveOne(key: string) {
    if (saving) return;
    setSaving(true);
    onMessage("");
    const draft = rows[key] ?? emptyRow();
    const ok = await saveRow(key, draft);
    await loadCategoryMeanings();
    setSaving(false);
    onMessage(ok ? bi("Saved.", "Đã lưu.") : bi("Save failed.", "Lưu thất bại."));
  }

  function updateRow(key: string, patch: Partial<RowDraft>) {
    setRows((current) => ({
      ...current,
      [key]: { ...(current[key] ?? emptyRow()), ...patch }
    }));
  }

  const saveAllLabel = useMemo(() => {
    if (category === "planet_sign") {
      return bi(`Save all ${headingPlanet.label} signs`, `Lưu cả 12 cung ${headingPlanet.labelVi}`);
    }
    if (category === "planet_house") {
      return bi(`Save all ${headingPlanet.label} houses`, `Lưu cả 12 nhà ${headingPlanet.labelVi}`);
    }
    if (category === "aspect") {
      return bi(`Save all ${headingAspect.label} rows`, `Lưu tất cả aspect ${headingAspect.labelVi}`);
    }
    if (category === "house") {
      return bi("Save all 12 houses", "Lưu cả 12 nhà");
    }
    return bi(`Save all House ${selectedHouse} signs`, `Lưu cả 12 cung Nhà ${selectedHouse}`);
  }, [category, headingPlanet, headingAspect, selectedHouse]);

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-x-1 gap-y-2 border-b border-amber-500/40 pb-0">
        {CMS_CATEGORY_TABS.map((tab) => {
          const active = tab.id === category;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "border-b-2 border-amber-400 font-bold text-white"
                  : "text-amber-300/80 hover:text-amber-100"
              }`}
            >
              {bi(tab.labelEn, tab.labelVi)}
            </button>
          );
        })}
      </nav>

      {(category === "planet_sign" || category === "planet_house" || category === "aspect") && (
        <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-amber-500/20 pb-3">
          {PLANET_NAV.map((planet) => {
            const active = planet.key === selectedPoint;
            return (
              <button
                key={planet.key}
                type="button"
                onClick={() => setSelectedPoint(planet.key)}
                className={`text-sm transition-colors ${
                  active
                    ? "font-bold text-white underline decoration-amber-400 decoration-2 underline-offset-4"
                    : "text-amber-300/80 hover:text-amber-100"
                }`}
              >
                {planet.label}
              </button>
            );
          })}
        </nav>
      )}

      {category === "aspect" && (
        <nav className="flex flex-wrap gap-x-4 gap-y-2 border-b border-amber-500/20 pb-3">
          {ASPECT_NAV.map((aspect) => {
            const active = aspect.key === selectedAspect;
            return (
              <button
                key={aspect.key}
                type="button"
                onClick={() => setSelectedAspect(aspect.key)}
                className={`text-sm transition-colors ${
                  active
                    ? "font-bold text-white underline decoration-sky-400 decoration-2 underline-offset-4"
                    : "text-sky-300/80 hover:text-sky-100"
                }`}
              >
                {bi(aspect.label, aspect.labelVi)}
              </button>
            );
          })}
        </nav>
      )}

      {category === "house_sign" && (
        <nav className="flex flex-wrap gap-x-3 gap-y-2 border-b border-amber-500/20 pb-3">
          {HOUSE_NUMBERS.map((house) => {
            const active = house === selectedHouse;
            return (
              <button
                key={house}
                type="button"
                onClick={() => setSelectedHouse(house)}
                className={`text-sm transition-colors ${
                  active
                    ? "font-bold text-white underline decoration-violet-400 decoration-2 underline-offset-4"
                    : "text-violet-300/80 hover:text-violet-100"
                }`}
              >
                {bi(`House ${house}`, `Nhà ${house}`)}
              </button>
            );
          })}
        </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{sectionHeading}</h2>
        <label className="flex items-center gap-2 text-xs text-amber-200">
          <input
            type="checkbox"
            checked={showEnglish}
            onChange={(e) => setShowEnglish(e.target.checked)}
            className="rounded border-zinc-600"
          />
          {bi("Show English fields", "Hiện trường tiếng Anh")}
        </label>
      </div>

      {loading && (
        <p className="text-xs text-amber-300">{bi("Loading content…", "Đang tải nội dung…")}</p>
      )}

      {readOnly && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100">
          {bi("View-only — you cannot edit CMS content.", "Chỉ xem — bạn không có quyền chỉnh nội dung CMS.")}
        </p>
      )}

      <p className="text-xs leading-relaxed text-amber-200/90">
        {bi(
          "Paste or type directly in each box. Line breaks are preserved. Use ## for headings and **bold** if you like — shown as-is on the chart.",
          "Nhập trực tiếp vào từng ô. Xuống dòng được giữ nguyên. Có thể dùng ## tiêu đề và **in đậm** — hiển thị đúng như bạn nhập."
        )}
      </p>

      <div className="space-y-5">
        {rowKeys.map((key) => {
          const draft = rows[key] ?? emptyRow();
          const label = rowLabelForKey(category, key);
          const hasData = Boolean(draft.contentVi.trim() || draft.contentEn.trim());

          return (
            <div
              key={key}
              className="grid gap-3 border-b border-zinc-800/80 pb-5 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] lg:items-start"
            >
              <div className="pt-2">
                <p className="text-sm font-semibold leading-snug text-amber-100">{label}</p>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">{key}</p>
                {hasData ? (
                  <span className="mt-2 inline-block rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    {bi("Has content", "Đã có nội dung")}
                  </span>
                ) : (
                  <span className="mt-2 inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {bi("Empty", "Trống")}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <textarea
                  className="min-h-[10rem] w-full resize-y rounded border border-zinc-600 bg-zinc-950 p-3 text-sm leading-relaxed text-white placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder={bi(
                    "Nội dung tiếng Việt… (## tiêu đề, xuống dòng thoải mái)",
                    "Vietnamese content…"
                  )}
                  value={draft.contentVi}
                  disabled={readOnly}
                  onChange={(e) => updateRow(key, { contentVi: e.target.value })}
                />
                {showEnglish && (
                  <textarea
                    className="min-h-[8rem] w-full resize-y rounded border border-zinc-700 bg-zinc-950/80 p-3 text-sm leading-relaxed text-amber-100 placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder={bi("English content (optional)…", "Nội dung tiếng Anh (tuỳ chọn)…")}
                    value={draft.contentEn}
                    disabled={readOnly}
                    onChange={(e) => updateRow(key, { contentEn: e.target.value })}
                  />
                )}
                {!readOnly && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveOne(key)}
                    className="rounded bg-zinc-700 px-3 py-1 text-xs text-white hover:bg-zinc-600 disabled:opacity-50"
                  >
                    {bi("Save this row", "Lưu dòng này")}
                  </button>
                </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
      <button
        type="button"
        disabled={saving || loading}
        onClick={() => void saveAll()}
        className="rounded bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
      >
        {saving ? bi("Saving all…", "Đang lưu tất cả…") : saveAllLabel}
      </button>
      )}
    </div>
  );
}
