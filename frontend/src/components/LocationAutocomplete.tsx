"use client";

import { useEffect, useState } from "react";
import { bi } from "@/lib/bilingual";
import { LocationOption } from "@/types/chart";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: LocationOption) => void;
}

export function LocationAutocomplete({ value, onChange, onSelect }: LocationAutocompleteProps) {
  const [results, setResults] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const query = value.trim();

  useEffect(() => {
    if (query.length < 2) {
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        const mapped: LocationOption[] = (data.results ?? []).map((item: Record<string, unknown>) => ({
          id: `${item.id ?? ""}`,
          city: String(item.name ?? ""),
          country: String(item.country ?? ""),
          latitude: Number(item.latitude ?? 0),
          longitude: Number(item.longitude ?? 0),
          timezone: String(item.timezone ?? "UTC")
        }));
        setResults(mapped);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3 text-sm text-[var(--theme-body)] font-[family:var(--font-theme-ui)] outline-none focus:border-[var(--theme-link)]"
        placeholder={bi("City, country", "Thành phố, quốc gia")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {loading && (
        <p className="mt-1 text-xs text-[var(--theme-muted)] font-[family:var(--font-theme-ui)]">
          {bi("Searching…", "Đang tìm…")}
        </p>
      )}
      {query.length >= 2 && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-bg)] shadow-lg">
          {results.map((option) => (
            <button
              key={option.id}
              type="button"
              className="w-full border-b border-[var(--theme-border)] px-3 py-2 text-left text-sm text-[var(--theme-link)] underline underline-offset-2 font-[family:var(--font-theme-link)] hover:bg-[var(--theme-panel)] hover:text-[var(--theme-link-hover)]"
              onClick={() => {
                onChange(`${option.city}, ${option.country}`);
                onSelect(option);
                setResults([]);
              }}
            >
              {option.city}, {option.country}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
