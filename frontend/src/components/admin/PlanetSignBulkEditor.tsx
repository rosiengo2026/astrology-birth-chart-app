"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bi } from "@/lib/bilingual";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const CMS_PLANET_TABS = [
  { key: "sun", label: "Sun" },
  { key: "moon", label: "Moon" },
  { key: "mercury", label: "Mercury" },
  { key: "venus", label: "Venus" },
  { key: "mars", label: "Mars" },
  { key: "jupiter", label: "Jupiter" },
  { key: "saturn", label: "Saturn" },
  { key: "uranus", label: "Uranus" },
  { key: "neptune", label: "Neptune" },
  { key: "pluto", label: "Pluto" },
  { key: "lilith", label: "Black Moon Lilith" },
  { key: "north_node", label: "North Node" }
] as const;

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
] as const;

const SIGN_LABELS: Record<(typeof SIGN_KEYS)[number], string> = {
  aries: "Aries",
  taurus: "Taurus",
  gemini: "Gemini",
  cancer: "Cancer",
  leo: "Leo",
  virgo: "Virgo",
  libra: "Libra",
  scorpio: "Scorpio",
  sagittarius: "Sagittarius",
  capricorn: "Capricorn",
  aquarius: "Aquarius",
  pisces: "Pisces"
};

const PLANET_LABELS: Record<string, string> = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  lilith: "Lilith",
  north_node: "North Node",
  south_node: "South Node",
  part_of_fortune: "Part of Fortune"
};

type Meaning = {
  _id: string;
  category: "planet_sign";
  key: string;
  title: { en: string; vi: string };
  content: { en: string; vi: string };
};

type SignRowDraft = {
  sign: (typeof SIGN_KEYS)[number];
  key: string;
  _id: string | null;
  content: string;
};

type PlanetSignBulkEditorProps = {
  token: string;
  meanings: Meaning[];
  onReload: () => Promise<boolean>;
  onMessage: (text: string) => void;
  onUnauthorized: () => void;
};

function buildRowLabel(planetKey: string, sign: (typeof SIGN_KEYS)[number]): string {
  const planet = PLANET_LABELS[planetKey] ?? planetKey;
  const signName = SIGN_LABELS[sign];
  return `${planet} in ${signName}`;
}

function buildDefaultTitle(planetKey: string, sign: (typeof SIGN_KEYS)[number]): { en: string; vi: string } {
  const label = buildRowLabel(planetKey, sign);
  return { en: label, vi: label };
}

export function PlanetSignBulkEditor({
  token,
  meanings,
  onReload,
  onMessage,
  onUnauthorized
}: PlanetSignBulkEditorProps) {
  const [selectedPlanet, setSelectedPlanet] = useState<string>(CMS_PLANET_TABS[0].key);
  const [rows, setRows] = useState<SignRowDraft[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const planetMeanings = useMemo(
    () => meanings.filter((m) => m.category === "planet_sign" && m.key.startsWith(`${selectedPlanet}_`)),
    [meanings, selectedPlanet]
  );

  const meaningByKey = useMemo(() => {
    const map = new Map<string, Meaning>();
    planetMeanings.forEach((m) => map.set(m.key, m));
    return map;
  }, [planetMeanings]);

  useEffect(() => {
    setRows(
      SIGN_KEYS.map((sign) => {
        const key = `${selectedPlanet}_${sign}`;
        const existing = meaningByKey.get(key);
        const content = [existing?.content.en?.trim(), existing?.content.vi?.trim()].filter(Boolean).join("\n\n");
        return {
          sign,
          key,
          _id: existing?._id ?? null,
          content
        };
      })
    );
  }, [selectedPlanet, meaningByKey]);

  const selectedPlanetLabel = CMS_PLANET_TABS.find((p) => p.key === selectedPlanet)?.label ?? selectedPlanet;

  const saveRow = useCallback(
    async (row: SignRowDraft) => {
      const existing = meaningByKey.get(row.key);
      const title = existing?.title ?? buildDefaultTitle(selectedPlanet, row.sign);
      const payload = {
        category: "planet_sign" as const,
        key: row.key,
        title,
        content: { en: row.content.trim(), vi: row.content.trim() }
      };
      const url = row._id ? `${API_URL}/cms/meanings/${row._id}` : `${API_URL}/cms/meanings`;
      const method = row._id ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (response.status === 401) {
        onUnauthorized();
        return false;
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        onMessage(data?.error ?? bi(`Save failed for ${row.key}.`, `Lưu thất bại: ${row.key}.`));
        return false;
      }
      return true;
    },
    [meaningByKey, onMessage, onUnauthorized, selectedPlanet, token]
  );

  async function handleSaveRow(row: SignRowDraft) {
    if (!row.content.trim()) {
      onMessage(bi("Content is empty — nothing to save.", "Nội dung trống — không có gì để lưu."));
      return;
    }
    setSavingKey(row.key);
    const ok = await saveRow(row);
    setSavingKey(null);
    if (ok) {
      onMessage(bi(`Saved ${buildRowLabel(selectedPlanet, row.sign)}.`, `Đã lưu ${buildRowLabel(selectedPlanet, row.sign)}.`));
      await onReload();
    }
  }

  async function handleSaveAll() {
    const toSave = rows.filter((r) => r.content.trim());
    if (toSave.length === 0) {
      onMessage(bi("No content to save.", "Không có nội dung để lưu."));
      return;
    }
    setSavingAll(true);
    let saved = 0;
    for (const row of toSave) {
      const ok = await saveRow(row);
      if (ok) saved += 1;
    }
    setSavingAll(false);
    onMessage(
      bi(`Saved ${saved} of ${toSave.length} entries.`, `Đã lưu ${saved}/${toSave.length} mục.`)
    );
    await onReload();
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-x-1 gap-y-1 border-b border-amber-500/30 pb-3 text-sm">
        {CMS_PLANET_TABS.map((planet, index) => (
          <span key={planet.key} className="inline-flex items-center">
            {index > 0 && <span className="mx-1 text-amber-600/60">|</span>}
            <button
              type="button"
              onClick={() => setSelectedPlanet(planet.key)}
              className={
                selectedPlanet === planet.key
                  ? "font-bold text-white underline decoration-amber-400 decoration-2 underline-offset-4"
                  : "text-amber-300 hover:text-white hover:underline"
              }
            >
              {planet.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">
          {bi("Interpretations for natal", "Diễn giải")} {selectedPlanetLabel}{" "}
          {bi("in the signs", "trong các cung")}
        </h2>
        <button
          type="button"
          onClick={() => void handleSaveAll()}
          disabled={savingAll}
          className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700"
        >
          {savingAll ? bi("Saving all…", "Đang lưu tất cả…") : bi("Save all signs", "Lưu tất cả cung")}
        </button>
      </div>

      <p className="text-xs text-amber-300/90">
        {bi(
          "One large text box per sign — paste English, Vietnamese, or both. Line breaks are preserved.",
          "Mỗi cung một ô lớn — dán tiếng Anh, tiếng Việt hoặc cả hai. Giữ nguyên xuống dòng."
        )}
      </p>

      <div className="space-y-0 divide-y divide-amber-500/20 rounded-lg border border-amber-500/25 bg-zinc-950/70">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-3 p-3 sm:grid-cols-[minmax(9rem,11rem)_1fr] sm:items-start"
          >
            <label htmlFor={`content-${row.key}`} className="pt-2 text-sm font-medium text-amber-100">
              {buildRowLabel(selectedPlanet, row.sign)}
              {row._id ? (
                <span className="mt-1 block text-[10px] font-normal text-emerald-400/90">
                  {bi("saved", "đã lưu")}
                </span>
              ) : (
                <span className="mt-1 block text-[10px] font-normal text-amber-500/80">
                  {bi("new", "mới")}
                </span>
              )}
            </label>
            <div className="space-y-2">
              <textarea
                id={`content-${row.key}`}
                className="min-h-[10rem] w-full resize-y rounded border border-zinc-600 bg-white p-3 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400"
                placeholder={bi(
                  `Paste interpretation for ${buildRowLabel(selectedPlanet, row.sign)}…`,
                  `Dán nội dung ${buildRowLabel(selectedPlanet, row.sign)}…`
                )}
                value={row.content}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) => (r.key === row.key ? { ...r, content: e.target.value } : r))
                  )
                }
              />
              <button
                type="button"
                onClick={() => void handleSaveRow(row)}
                disabled={savingKey === row.key || savingAll}
                className="rounded bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingKey === row.key
                  ? bi("Saving…", "Đang lưu…")
                  : bi("Save this sign", "Lưu cung này")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
