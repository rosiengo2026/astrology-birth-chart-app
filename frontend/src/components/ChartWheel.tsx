import { RefObject, useMemo } from "react";
import { useSiteTheme } from "@/components/SiteThemeProvider";
import { chartAspectColorMap, chartPlanetFontStack, chartSignFontStack } from "@/lib/siteTheme";
import { getChartObjectGlyph } from "@/lib/chartObjectGlyphs";
import { filterVisibleAspects, filterVisiblePlanets } from "@/lib/chartPoints";
import { ChartResponse } from "@/types/chart";

type ChartPlanet = ChartResponse["chart"]["planets"][number];

const EMPTY_OPTIONAL_POINTS = new Set<string>();

const CHART_OVERLAY_COLOR = "#7c3aed";
/** Place overlay glyphs outside the zodiac band (sign glyphs sit at its center). */
const CHART_OVERLAY_BEYOND_ZODIAC = 12;
const CHART_BASE_INNER_OFFSET = 8;

interface ChartWheelProps {
  chart: ChartResponse["chart"];
  /** When set, only aspect lines of this type are drawn (links on the wheel). */
  aspectTypeFilter?: string | null;
  /** Optional points (outer planets, nodes, etc.) enabled by the user. */
  enabledOptionalPoints?: Set<string>;
  /** Overlay planets (synastry partner or transiting sky) drawn in purple on this wheel. */
  overlayPlanets?: ChartPlanet[];
  /** Source chart for overlay angles (synastry partner). */
  overlayChart?: ChartResponse["chart"];
  /** Cross-chart aspects between base wheel and overlay (synastry). */
  overlayAspects?: Array<{ base: string; overlay: string; type: string }>;
  /** Label for overlay planets (tooltip). */
  overlayLabel?: string;
  onPointClick?: (point: ChartPlanet) => void;
  svgRef?: RefObject<SVGSVGElement | null>;
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

function AspectMarker({
  type,
  x,
  y,
  color
}: {
  type: string;
  x: number;
  y: number;
  color: string;
}) {
  if (type === "Conjunction") {
    return (
      <g pointerEvents="none">
        <circle cx={x} cy={y} r={3.6} fill="#ffffff" stroke={color} strokeWidth={1.1} opacity={0.98} />
        <circle cx={x} cy={y} r={1.6} fill={color} opacity={0.95} />
      </g>
    );
  }

  const symbol = {
    Sextile: "✶",
    Square: "□",
    Trine: "△",
    Opposition: "☍"
  }[type] ?? "•";

  return (
    <text
      x={x}
      y={y + 4}
      textAnchor="middle"
      fontSize="11"
      fill={color}
      fontWeight="700"
      stroke="#ffffff"
      strokeWidth={2.5}
      paintOrder="stroke fill"
      pointerEvents="none"
    >
      {symbol}
    </text>
  );
}

function placePointsOnRing(
  planets: ChartPlanet[],
  displayAngle: (longitude: number) => number,
  baseRadius: number,
  options?: { laneOutwardOnly?: boolean }
) {
  const laneOutwardOnly = options?.laneOutwardOnly ?? false;
  return [...planets]
    .map((planet) => ({ planet, angle: displayAngle(planet.longitude) }))
    .sort((a, b) => a.angle - b.angle)
    .map((entry, index, arr) => {
      const prev = arr[index - 1];
      const next = arr[index + 1];
      const prevGap = prev ? Math.abs(entry.angle - prev.angle) : 999;
      const nextGap = next ? Math.abs(next.angle - entry.angle) : 999;
      const minGap = Math.min(prevGap, nextGap);
      const lane = index % 3;
      const laneOffset = lane === 0 ? -9 : lane === 1 ? 0 : 9;
      const crowdedOffset = minGap < 8 ? (laneOutwardOnly ? Math.max(0, laneOffset) : laneOffset) : 0;
      return {
        ...entry,
        renderRadius: baseRadius + crowdedOffset
      };
    });
}

function lookupLongitude(
  name: string,
  chart: ChartResponse["chart"],
  planets: ChartPlanet[]
): number | null {
  const planet = planets.find((point) => point.planet === name);
  if (planet) return planet.longitude;
  if (name === "ASC") return chart.ascendant;
  if (name === "MC") return chart.midheaven;
  if (name === "DC") return chart.descendant;
  if (name === "IC") return chart.imumCoeli;
  return null;
}

export function ChartWheel({
  chart,
  onPointClick,
  aspectTypeFilter = null,
  enabledOptionalPoints,
  overlayPlanets,
  overlayChart,
  overlayAspects,
  overlayLabel,
  svgRef
}: ChartWheelProps) {
  const theme = useSiteTheme();
  const aspectColor = useMemo(() => chartAspectColorMap(theme), [theme]);
  const signFontFamily = useMemo(() => chartSignFontStack(theme), [theme]);
  const planetFontFamily = useMemo(() => chartPlanetFontStack(theme), [theme]);
  const aspectLineColor = (type: string) => aspectColor[type as keyof typeof aspectColor] ?? "#64748b";
  const optionalSet = enabledOptionalPoints ?? EMPTY_OPTIONAL_POINTS;

  const visiblePlanets = useMemo(
    () => filterVisiblePlanets(chart.planets, optionalSet),
    [chart.planets, optionalSet]
  );

  const visibleOverlayPlanets = useMemo(
    () => (overlayPlanets ? filterVisiblePlanets(overlayPlanets, optionalSet) : []),
    [overlayPlanets, optionalSet]
  );

  const overlayChartData = overlayChart ?? chart;

  const visibleAspects = useMemo(() => {
    if (visibleOverlayPlanets.length > 0) return [];
    const byVisibility = filterVisibleAspects(chart.aspects, optionalSet);
    if (aspectTypeFilter == null || aspectTypeFilter === "") {
      return byVisibility;
    }
    return byVisibility.filter((a) => a.type === aspectTypeFilter);
  }, [chart.aspects, aspectTypeFilter, optionalSet, visibleOverlayPlanets.length]);

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

  const aspectStrokeStyle: Record<string, { strokeWidth: number }> = {
    Conjunction: { strokeWidth: 1.55 },
    Sextile: { strokeWidth: 1.15 },
    Square: { strokeWidth: 1.35 },
    Trine: { strokeWidth: 1.15 },
    Opposition: { strokeWidth: 1.45 }
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

  const axisMarkers = [
    { key: "AC", longitude: chart.ascendant, color: "#f97316" },
    { key: "DC", longitude: chart.descendant, color: "#0ea5e9" },
    { key: "MC", longitude: chart.midheaven, color: "#8b5cf6" },
    { key: "IC", longitude: chart.imumCoeli, color: "#10b981" }
  ];

  const hasOverlay = visibleOverlayPlanets.length > 0;
  const basePointRadius = hasOverlay ? pointRadius - CHART_BASE_INNER_OFFSET : pointRadius;
  const overlayPointRadius = zodiacOuterRadius + CHART_OVERLAY_BEYOND_ZODIAC;

  const placedPoints = placePointsOnRing(visiblePlanets, displayAngle, basePointRadius);
  const placedOverlayPoints = placePointsOnRing(
    visibleOverlayPlanets,
    displayAngle,
    overlayPointRadius,
    { laneOutwardOnly: true }
  );

  return (
    <svg
      ref={svgRef}
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
            fontFamily={signFontFamily}
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
        const fromLon = lookupLongitude(aspect.between[0], chart, visiblePlanets);
        const toLon = lookupLongitude(aspect.between[1], chart, visiblePlanets);
        if (fromLon == null || toLon == null) return null;
        const p1 = polarToCartesian(center, aspectRadius, displayAngle(fromLon));
        const p2 = polarToCartesian(center, aspectRadius, displayAngle(toLon));
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const color = aspectLineColor(aspect.type);
        const isConjunction = aspect.type === "Conjunction";
        return (
          <g key={`${aspect.between[0]}-${aspect.between[1]}-${index}`}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={color}
              strokeWidth={aspectStrokeStyle[aspect.type]?.strokeWidth ?? 1.05}
              opacity={isConjunction ? 0.95 : 0.88}
            />
            {isConjunction ? (
              <AspectMarker type={aspect.type} x={midX} y={midY} color={color} />
            ) : (
              <>
                <AspectMarker type={aspect.type} x={p1.x + (p2.x - p1.x) * 0.35} y={p1.y + (p2.y - p1.y) * 0.35} color={color} />
                <AspectMarker type={aspect.type} x={p1.x + (p2.x - p1.x) * 0.65} y={p1.y + (p2.y - p1.y) * 0.65} color={color} />
              </>
            )}
          </g>
        );
      })}

      {overlayAspects?.map((aspect, index) => {
        const baseLon = lookupLongitude(aspect.base, chart, visiblePlanets);
        const overlayLon = lookupLongitude(aspect.overlay, overlayChartData, visibleOverlayPlanets);
        if (baseLon == null || overlayLon == null) return null;
        if (aspectTypeFilter && aspect.type !== aspectTypeFilter) return null;

        const basePlaced = placedPoints.find((p) => p.planet.planet === aspect.base);
        const overlayPlaced = placedOverlayPoints.find((p) => p.planet.planet === aspect.overlay);
        const basePoint = polarToCartesian(
          center,
          basePlaced?.renderRadius ?? basePointRadius,
          displayAngle(baseLon)
        );
        const overlayPoint = polarToCartesian(
          center,
          overlayPlaced?.renderRadius ?? overlayPointRadius,
          displayAngle(overlayLon)
        );
        const color = aspectLineColor(aspect.type);
        return (
          <g key={`overlay-aspect-${aspect.base}-${aspect.overlay}-${aspect.type}-${index}`}>
            <line
              x1={basePoint.x}
              y1={basePoint.y}
              x2={overlayPoint.x}
              y2={overlayPoint.y}
              stroke={color}
              strokeWidth={1}
              opacity={0.55}
              strokeDasharray="3 4"
            />
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
              fontFamily={planetFontFamily}
              pointerEvents="none"
            >
              {getChartObjectGlyph(planet.planet)}
            </text>
          </g>
        );
      })}

      {placedOverlayPoints.map(({ planet, renderRadius }) => {
        const point = polarToCartesian(center, renderRadius, displayAngle(planet.longitude));
        const titlePrefix = overlayLabel ? `${overlayLabel}: ` : "";
        return (
          <g key={`overlay-${planet.planet}`}>
            <title>{`${titlePrefix}${planet.planet} in ${planet.sign}`}</title>
            <text
              x={point.x}
              y={point.y + 4}
              textAnchor="middle"
              fontSize="13.5"
              fill={CHART_OVERLAY_COLOR}
              fontWeight="600"
              opacity="0.92"
              fontFamily={planetFontFamily}
              pointerEvents="none"
            >
              {getChartObjectGlyph(planet.planet)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
