import { useMemo } from "react";
import { ChartResponse } from "@/types/chart";

type ChartPlanet = ChartResponse["chart"]["planets"][number];

interface ChartWheelProps {
  chart: ChartResponse["chart"];
  /** When set, only aspect lines of this type are drawn (links on the wheel). */
  aspectTypeFilter?: string | null;
  onPointClick?: (point: ChartPlanet) => void;
}

function polarToCartesian(center: number, radius: number, angle: number) {
  const radians = (angle - 90) * (Math.PI / 180);
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians)
  };
}

function normalize(deg: number) {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

function formatDegreeInSign(longitude: number): string {
  const normalized = normalize(longitude);
  const signDegree = normalized % 30;
  const degrees = Math.floor(signDegree);
  const minutes = Math.floor((signDegree - degrees) * 60);
  return `${String(degrees).padStart(2, "0")}°${String(minutes).padStart(2, "0")}'`;
}

export function ChartWheel({ chart, onPointClick, aspectTypeFilter = null }: ChartWheelProps) {
  const visibleAspects = useMemo(() => {
    if (aspectTypeFilter == null || aspectTypeFilter === "") {
      return chart.aspects;
    }
    return chart.aspects.filter((a) => a.type === aspectTypeFilter);
  }, [chart.aspects, aspectTypeFilter]);

  const size = 420;
  const padding = 30;
  const center = size / 2;
  const outerRadius = 194;
  const zodiacOuterRadius = 172;
  const zodiacInnerRadius = 146;
  const houseInnerRadius = 96;
  const pointRadius = 132;
  const aspectRadius = houseInnerRadius - 3;
  const houseLabelRadius = outerRadius + 13;
  const signLabelRadius = (zodiacOuterRadius + zodiacInnerRadius) / 2;

  // Match classic chart orientation: AC at left, DC at right, MC near top (house 10 sector).
  const displayAngle = (longitude: number) => normalize(270 - (longitude - chart.ascendant));
  const signGlyphByName: Record<string, string> = {
    Aries: "♈",
    Taurus: "♉",
    Gemini: "♊",
    Cancer: "♋",
    Leo: "♌",
    Virgo: "♍",
    Libra: "♎",
    Scorpio: "♏",
    Sagittarius: "♐",
    Capricorn: "♑",
    Aquarius: "♒",
    Pisces: "♓"
  };
  const romanByHouse = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  const labelMap: Record<string, string> = {
    Sun: "☉",
    Moon: "☽",
    Mercury: "☿",
    Venus: "♀",
    Mars: "♂",
    Jupiter: "♃",
    Saturn: "♄",
    Uranus: "♅",
    Neptune: "♆",
    Pluto: "♇",
    "North Node": "☊",
    "South Node": "☋",
    Lilith: "⚸",
    "Part of Fortune": "⊗"
  };

  const aspectColor: Record<string, string> = {
    Conjunction: "#6b7280",
    Sextile: "#2563eb",
    Square: "#ef4444",
    Trine: "#2563eb",
    Opposition: "#ef4444"
  };
  const aspectStrokeStyle: Record<string, { strokeWidth: number; strokeDasharray?: string }> = {
    Conjunction: { strokeWidth: 1.25 },
    Sextile: { strokeWidth: 1.15, strokeDasharray: "2.8 2.2" },
    Square: { strokeWidth: 1.35 },
    Trine: { strokeWidth: 1.15, strokeDasharray: "4 2" },
    Opposition: { strokeWidth: 1.45 }
  };
  const aspectSymbol: Record<string, string> = {
    Conjunction: "☌",
    Sextile: "✶",
    Square: "□",
    Trine: "△",
    Opposition: "☍"
  };

  const zodiacGlyphs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  const zodiacColors = [
    "#dc2626",
    "#16a34a",
    "#d97706",
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#d97706",
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#d97706",
    "#2563eb"
  ];

  const pointsByName = new Map(chart.planets.map((point) => [point.planet, point]));
  const axisMarkers = [
    { key: "AC", longitude: chart.ascendant, color: "#f97316" },
    { key: "DC", longitude: chart.descendant, color: "#0ea5e9" },
    { key: "MC", longitude: chart.midheaven, color: "#8b5cf6" },
    { key: "IC", longitude: chart.imumCoeli, color: "#10b981" }
  ];

  const placedPoints = [...chart.planets]
    .map((planet) => ({ planet, angle: displayAngle(planet.longitude) }))
    .sort((a, b) => a.angle - b.angle)
    .map((entry, index, arr) => {
      const prev = arr[index - 1];
      const next = arr[index + 1];
      const prevGap = prev ? Math.abs(entry.angle - prev.angle) : 999;
      const nextGap = next ? Math.abs(next.angle - entry.angle) : 999;
      const minGap = Math.min(prevGap, nextGap);

      // When multiple points are close in longitude, push each one slightly
      // in/out by lane to avoid overlap while keeping the same house sector.
      const lane = index % 3;
      const laneOffset = lane === 0 ? -9 : lane === 1 ? 0 : 9;
      const crowdedOffset = minGap < 8 ? laneOffset : 0;

      return {
        ...entry,
        renderRadius: pointRadius + crowdedOffset
      };
    });

  return (
    <svg
      viewBox={`${-padding} ${-padding} ${size + padding * 2} ${size + padding * 2}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <circle cx={center} cy={center} r={outerRadius} fill="#efefef" stroke="#1f2937" strokeWidth="1" />
      <circle cx={center} cy={center} r={zodiacOuterRadius} fill="none" stroke="#1f2937" strokeWidth="1" />
      <circle cx={center} cy={center} r={zodiacInnerRadius} fill="none" stroke="#1f2937" strokeWidth="1" />
      <circle cx={center} cy={center} r={houseInnerRadius} fill="#f8f8f8" stroke="#1f2937" strokeWidth="1" />

      {Array.from({ length: 360 }, (_, degree) => {
        const angle = displayAngle(degree);
        const isMajor = degree % 30 === 0;
        const isMedium = degree % 5 === 0;
        const startRadius = isMajor ? zodiacInnerRadius - 6 : isMedium ? zodiacInnerRadius - 4 : zodiacInnerRadius - 2.5;
        const endRadius = zodiacInnerRadius;
        const p1 = polarToCartesian(center, startRadius, angle);
        const p2 = polarToCartesian(center, endRadius, angle);
        return (
          <line
            key={`tick-${degree}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#111827"
            strokeWidth={isMajor ? "0.85" : "0.5"}
            opacity={isMajor ? "0.9" : "0.65"}
          />
        );
      })}

      {Array.from({ length: 12 }, (_, i) => {
        const cuspLongitude = i * 30;
        const angle = displayAngle(cuspLongitude);
        const p1 = polarToCartesian(center, zodiacInnerRadius, angle);
        const p2 = polarToCartesian(center, zodiacOuterRadius, angle);
        return (
          <line
            key={`sign-boundary-${i}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="#374151"
            strokeWidth="1.2"
            opacity="0.9"
          />
        );
      })}

      {chart.houses.map((house) => {
        const angle = displayAngle(house.cuspLongitude);
        const outer = polarToCartesian(center, zodiacOuterRadius, angle);
        const inner = polarToCartesian(center, houseInnerRadius, angle);
        return (
          <line
            key={`cusp-${house.house}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#dc2626"
            strokeWidth="1.35"
            opacity="0.95"
          />
        );
      })}

      {chart.houses.map((house) => {
        const nextHouse = chart.houses[house.house % 12];
        const midLongitude = normalize(house.cuspLongitude + normalize(nextHouse.cuspLongitude - house.cuspLongitude) / 2);
        const point = polarToCartesian(center, houseLabelRadius, displayAngle(midLongitude));
        return (
          <g key={house.house}>
            <text x={point.x} y={point.y - 2} textAnchor="middle" fontSize="11" fill="#111827" fontWeight="700">
              {romanByHouse[house.house - 1]}
            </text>
            <text x={point.x} y={point.y + 10} textAnchor="middle" fontSize="9.5" fill="#374151" fontWeight="500">
              {formatDegreeInSign(house.cuspLongitude)}
            </text>
          </g>
        );
      })}

      {zodiacGlyphs.map((glyph, index) => {
        const longitude = index * 30 + 15;
        const point = polarToCartesian(center, signLabelRadius, displayAngle(longitude));
        return (
          <text
            key={`zodiac-${glyph}`}
            x={point.x}
            y={point.y + 5}
            className="[font-variant-emoji:text]"
            textAnchor="middle"
            fontSize="18"
            fill={zodiacColors[index]}
            fontFamily="'Times New Roman','Noto Sans Symbols 2','Segoe UI Symbol','Symbola',serif"
          >
            {`${glyph}\uFE0E`}
          </text>
        );
      })}

      {axisMarkers.map((axis) => {
        const angle = displayAngle(axis.longitude);
        const inner = polarToCartesian(center, houseInnerRadius - 3, angle);
        const outer = polarToCartesian(center, outerRadius + 6, angle);
        const label = polarToCartesian(center, outerRadius + 20, angle);
        return (
          <g key={axis.key}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={axis.color}
              strokeWidth="2.4"
              opacity="0.95"
            />
            <circle cx={outer.x} cy={outer.y} r={3.2} fill={axis.color} />
            <text
              x={label.x}
              y={label.y + 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={axis.color}
            >
              {axis.key}
            </text>
          </g>
        );
      })}

      {visibleAspects.map((aspect, index) => {
        const from = pointsByName.get(aspect.between[0]);
        const to = pointsByName.get(aspect.between[1]);
        if (!from || !to) return null;
        const p1 = polarToCartesian(center, aspectRadius, displayAngle(from.longitude));
        const p2 = polarToCartesian(center, aspectRadius, displayAngle(to.longitude));
        const sx1 = p1.x + (p2.x - p1.x) * 0.35;
        const sy1 = p1.y + (p2.y - p1.y) * 0.35;
        const sx2 = p1.x + (p2.x - p1.x) * 0.65;
        const sy2 = p1.y + (p2.y - p1.y) * 0.65;
        return (
          <g key={`${aspect.between[0]}-${aspect.between[1]}-${index}`}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={aspectColor[aspect.type] ?? "#64748b"}
              strokeWidth={aspectStrokeStyle[aspect.type]?.strokeWidth ?? 1.05}
              strokeDasharray={aspectStrokeStyle[aspect.type]?.strokeDasharray}
              opacity="0.88"
            />
            <text x={sx1} y={sy1 + 4} textAnchor="middle" fontSize="10.5" fill={aspectColor[aspect.type] ?? "#64748b"} fontWeight="700">
              {aspectSymbol[aspect.type] ?? "•"}
            </text>
            <text x={sx2} y={sy2 + 4} textAnchor="middle" fontSize="10.5" fill={aspectColor[aspect.type] ?? "#64748b"} fontWeight="700">
              {aspectSymbol[aspect.type] ?? "•"}
            </text>
          </g>
        );
      })}

      {placedPoints.map(({ planet, renderRadius }) => {
        const point = polarToCartesian(center, renderRadius, displayAngle(planet.longitude));
        const color = "#111827";
        return (
          <g
            key={planet.planet}
            className={onPointClick ? "cursor-pointer" : ""}
            role={onPointClick ? "button" : undefined}
            tabIndex={onPointClick ? 0 : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onPointClick?.(planet);
            }}
            onKeyDown={
              onPointClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPointClick(planet);
                    }
                  }
                : undefined
            }
          >
            {onPointClick && (
              <title>{`${planet.planet} in ${planet.sign} — click for meaning`}</title>
            )}
            <circle cx={point.x} cy={point.y} r={16} fill="transparent" pointerEvents="all" />
            <text
              x={point.x}
              y={point.y + 4.5}
              textAnchor="middle"
              fontSize="14.5"
              fill={color}
              fontWeight="500"
              opacity="0.95"
              fontFamily="'Noto Sans Symbols 2','Segoe UI Symbol','Apple Symbols','Symbola',serif"
              pointerEvents="none"
            >
              {labelMap[planet.planet] ?? planet.planet.slice(0, 2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
