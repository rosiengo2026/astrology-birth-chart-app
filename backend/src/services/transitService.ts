import { calculateTransits } from "celestine";
import { ChartData, ChartPointName } from "../types";
import { calculateJulianDay, generateNatalChart } from "./chartService";

export type NatalChartInput = {
  date: string;
  time: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type TransitAspectType = "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition";

export interface NatalTransitHit {
  transiting: string;
  natal: string;
  type: TransitAspectType;
  orb: number;
  phase: "applying" | "exact" | "separating";
  strength: number;
  isRetrograde: boolean;
  symbol: string;
}

export interface NatalTransitsResult {
  natal: ChartData;
  transitMoment: {
    date: string;
    time: string;
    timezone: string;
    julianDay: number;
  };
  transitLocation: {
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  /** Current sky at the transit location for the transit moment. */
  transitSky: ChartData;
  transits: NatalTransitHit[];
}

type NatalPointType = "planet" | "luminary" | "angle" | "node" | "lot" | "asteroid";

const ANGLE_POINTS: Array<{ name: string; longitude: (chart: ChartData) => number }> = [
  { name: "ASC", longitude: (chart) => chart.ascendant },
  { name: "MC", longitude: (chart) => chart.midheaven },
  { name: "DC", longitude: (chart) => chart.descendant },
  { name: "IC", longitude: (chart) => chart.imumCoeli }
];

function mapNatalPointType(name: ChartPointName | string): NatalPointType {
  if (name === "Sun" || name === "Moon") return "luminary";
  if (name === "North Node" || name === "South Node") return "node";
  if (name.startsWith("Part of")) return "lot";
  if (name === "Ceres" || name === "Pallas" || name === "Juno" || name === "Vesta" || name === "Chiron") {
    return "asteroid";
  }
  if (
    name === "Lilith" ||
    name === "Priapus" ||
    name === "Cupido" ||
    name === "Hades" ||
    name === "Zeus" ||
    name === "Kronos" ||
    name === "Apollon" ||
    name === "Admetos" ||
    name === "Vulkanus" ||
    name === "Poseidon"
  ) {
    return "lot";
  }
  return "planet";
}

function chartToNatalPoints(chart: ChartData) {
  const points: Array<{
    name: string;
    longitude: number;
    type: NatalPointType;
    house?: number;
  }> = chart.planets.map((planet) => ({
    name: planet.planet,
    longitude: planet.longitude,
    type: mapNatalPointType(planet.planet),
    house: planet.house
  }));

  for (const angle of ANGLE_POINTS) {
    points.push({
      name: angle.name,
      longitude: angle.longitude(chart),
      type: "angle"
    });
  }

  return points;
}

function capitalizeAspectType(type: string): TransitAspectType {
  const normalized = type.toLowerCase();
  switch (normalized) {
    case "conjunction":
      return "Conjunction";
    case "sextile":
      return "Sextile";
    case "square":
      return "Square";
    case "trine":
      return "Trine";
    case "opposition":
      return "Opposition";
    default:
      return "Conjunction";
  }
}

export function calculateNatalTransits(input: {
  natal: NatalChartInput;
  transitDate: string;
  transitTime: string;
  transitTimezone?: string;
  transitCity?: string;
  transitCountry?: string;
  transitLatitude?: number;
  transitLongitude?: number;
}): NatalTransitsResult {
  const natalChart = generateNatalChart(input.natal);
  const transitLocation = {
    city: input.transitCity?.trim() || input.natal.city,
    country: input.transitCountry?.trim() || input.natal.country,
    latitude: input.transitLatitude ?? input.natal.latitude,
    longitude: input.transitLongitude ?? input.natal.longitude,
    timezone: input.transitTimezone?.trim() || input.natal.timezone
  };
  const julianDay = calculateJulianDay(input.transitDate, input.transitTime, transitLocation.timezone);

  const natalPoints = chartToNatalPoints(natalChart);
  const transitResult = calculateTransits(natalPoints, julianDay);

  const transits: NatalTransitHit[] = transitResult.transits
    .map((hit) => ({
      transiting: hit.transitingBody,
      natal: hit.natalPoint,
      type: capitalizeAspectType(hit.aspectType),
      orb: Number(hit.deviation.toFixed(4)),
      phase: hit.phase,
      strength: Number(hit.strength.toFixed(1)),
      isRetrograde: hit.isRetrograde,
      symbol: hit.symbol
    }))
    .sort((a, b) => a.orb - b.orb);

  const transitSky = generateNatalChart({
    date: input.transitDate,
    time: input.transitTime,
    city: transitLocation.city,
    country: transitLocation.country,
    latitude: transitLocation.latitude,
    longitude: transitLocation.longitude,
    timezone: transitLocation.timezone
  });

  return {
    natal: natalChart,
    transitMoment: {
      date: input.transitDate,
      time: input.transitTime,
      timezone: transitLocation.timezone,
      julianDay: Number(julianDay.toFixed(5))
    },
    transitLocation,
    transitSky,
    transits
  };
}
