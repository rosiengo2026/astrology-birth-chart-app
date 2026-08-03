import * as Astronomy from "astronomy-engine";
import { DateTime } from "luxon";
import { ZODIAC_SIGNS } from "../constants";
import { ChartData, ChartPointName, PlanetPosition } from "../types";
import { computeExtraEphemerisPoints } from "./extraEphemeris";
// This engine provides tropical zodiac + Placidus houses + nodes/lilith.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Origin, Horoscope } = require("circular-natal-horoscope-js") as {
  Origin: new (args: Record<string, number>) => unknown;
  Horoscope: new (args: Record<string, unknown>) => any;
};

function normalizeDegree(degree: number): number {
  const normalized = degree % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function signFromLongitude(longitude: number) {
  return ZODIAC_SIGNS[Math.floor(normalizeDegree(longitude) / 30)];
}

function parseBirthTime(time: string): { hour: number; minute: number } {
  const normalized = time.trim().toUpperCase();
  const twelveHourMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (twelveHourMatch) {
    const rawHour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3];
    if (Number.isNaN(rawHour) || Number.isNaN(minute) || rawHour < 1 || rawHour > 12 || minute < 0 || minute > 59) {
      throw new Error("Invalid time format. Use HH:mm or hh:mm AM/PM.");
    }
    const hour = (rawHour % 12) + (meridiem === "PM" ? 12 : 0);
    return { hour, minute };
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2]);
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error("Invalid time format. Use HH:mm or hh:mm AM/PM.");
    }
    return { hour, minute };
  }

  throw new Error("Invalid time format. Use HH:mm or hh:mm AM/PM.");
}

function parseBirthDate(date: string): { year: number; month: number; day: number } {
  const normalized = date.trim();
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  const localMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (localMatch) {
    const day = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const year = Number(localMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  throw new Error("Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.");
}

export function calculateJulianDay(date: string, time: string, timezone: string): number {
  const { year, month, day } = parseBirthDate(date);
  const { hour, minute } = parseBirthTime(time);
  const isoTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const local = DateTime.fromISO(`${isoDate}T${isoTime}`, { zone: timezone });
  if (!local.isValid) {
    throw new Error("Invalid date/time/timezone values.");
  }
  const utc = local.toUTC();
  return Astronomy.MakeTime(utc.toJSDate()).ut + 2451545.0;
}

function mapBodyKeyToName(key: string): ChartPointName | null {
  const map: Record<string, ChartPointName> = {
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
    chiron: "Chiron",
    northnode: "North Node",
    southnode: "South Node",
    lilith: "Lilith"
  };
  return map[key] ?? null;
}

function isDiurnalChart(sunLongitude: number, ascendant: number): boolean {
  return normalizeDegree(sunLongitude - ascendant) < 180;
}

function makeCalculatedPoint(
  name: ChartPointName,
  longitude: number,
  houses: Array<{ house: number; cuspLongitude: number }>
): PlanetPosition {
  const normalized = normalizeDegree(longitude);
  return {
    planet: name,
    longitude: Number(normalized.toFixed(4)),
    sign: signFromLongitude(normalized),
    house: houseFromLongitude(normalized, houses),
    type: "point"
  };
}
function houseFromLongitude(longitude: number, houses: Array<{ house: number; cuspLongitude: number }>): number {
  const sorted = [...houses].sort((a, b) => a.house - b.house);
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const span = normalizeDegree(next.cuspLongitude - current.cuspLongitude);
    const dist = normalizeDegree(longitude - current.cuspLongitude);
    if (dist < span) {
      return current.house;
    }
  }
  return 1;
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return diff > 180 ? 360 - diff : diff;
}

function isLuminaryName(name: ChartPointName): boolean {
  return name === "Sun" || name === "Moon";
}

function isNodeName(name: ChartPointName): boolean {
  return name === "North Node" || name === "South Node";
}

function isLilithName(name: ChartPointName): boolean {
  return name === "Lilith";
}

function isOuterPlanetName(name: ChartPointName): boolean {
  return name === "Jupiter" || name === "Saturn" || name === "Uranus" || name === "Neptune" || name === "Pluto";
}

/**
 * Major aspects from ecliptic longitudes with conservative orbs (closer to
 * standard aspect tables than circular-natal-horoscope-js, which can label
 * ~126° as a trine because of very wide default orbs).
 */
function maxOrbForAspect(
  aspectType: ChartData["aspects"][number]["type"],
  left: ChartPointName,
  right: ChartPointName
): number {
  const lum = isLuminaryName(left) || isLuminaryName(right);
  const node = isNodeName(left) || isNodeName(right);
  const lilith = isLilithName(left) || isLilithName(right);
  const outer = isOuterPlanetName(left) || isOuterPlanetName(right);

  // Lilith + slow planets: much tighter orbs than generic planet–planet (avoids false trines ~124–127°).
  if (lilith && outer) {
    switch (aspectType) {
      case "Conjunction":
        return 6;
      case "Opposition":
        return 6;
      case "Square":
        return 4;
      case "Trine":
        return 4;
      case "Sextile":
        return 3;
      default:
        return 4;
    }
  }

  // Sun or Moon with Lilith (e.g. Sun–Lilith trine ~4–5° from exact).
  if (lilith && lum) {
    switch (aspectType) {
      case "Conjunction":
        return 10;
      case "Opposition":
        return 9;
      case "Trine":
        return 8;
      case "Square":
        return 7;
      case "Sextile":
        return 6;
      default:
        return 6;
    }
  }

  const nodeOrLilith = node || lilith;

  switch (aspectType) {
    case "Conjunction":
      return lum || nodeOrLilith ? 10 : 8;
    case "Opposition":
      if (lum) return 10;
      if (nodeOrLilith) return 9;
      return 8;
    case "Trine":
      return lum ? 8 : 6;
    case "Square":
      return lum ? 8 : 6;
    case "Sextile":
      return lum ? 6 : 4;
    default:
      return 6;
  }
}

function shouldSkipAspectPair(left: ChartPointName, right: ChartPointName): boolean {
  return (
    (left === "North Node" && right === "South Node") || (left === "South Node" && right === "North Node")
  );
}

function computeMajorAspectsFromLongitudes(points: PlanetPosition[]): ChartData["aspects"] {
  const defs: Array<{ type: ChartData["aspects"][number]["type"]; angle: number }> = [
    { type: "Conjunction", angle: 0 },
    { type: "Opposition", angle: 180 },
    { type: "Square", angle: 90 },
    { type: "Trine", angle: 120 },
    { type: "Sextile", angle: 60 }
  ];

  const aspects: ChartData["aspects"] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const left = points[i];
      const right = points[j];
      if (shouldSkipAspectPair(left.planet, right.planet)) continue;

      const separation = angularDistance(left.longitude, right.longitude);
      let best: { type: ChartData["aspects"][number]["type"]; delta: number } | null = null;

      for (const def of defs) {
        const delta = Math.abs(separation - def.angle);
        const maxOrb = maxOrbForAspect(def.type, left.planet, right.planet);
        if (delta <= maxOrb + 1e-6 && (!best || delta < best.delta - 1e-9)) {
          best = { type: def.type, delta };
        }
      }

      if (best) {
        aspects.push({
          between: [left.planet, right.planet],
          type: best.type,
          orb: Number(best.delta.toFixed(4))
        });
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

export function collectSynastryPoints(chart: ChartData): Array<{ name: string; longitude: number }> {
  const points: Array<{ name: string; longitude: number }> = chart.planets.map((planet) => ({
    name: planet.planet,
    longitude: planet.longitude
  }));
  points.push(
    { name: "ASC", longitude: chart.ascendant },
    { name: "MC", longitude: chart.midheaven },
    { name: "DC", longitude: chart.descendant },
    { name: "IC", longitude: chart.imumCoeli }
  );
  return points;
}

export function computeSynastryAspects(
  chartA: ChartData,
  chartB: ChartData
): Array<{ personA: string; personB: string; type: ChartData["aspects"][number]["type"]; orb: number }> {
  const defs: Array<{ type: ChartData["aspects"][number]["type"]; angle: number }> = [
    { type: "Conjunction", angle: 0 },
    { type: "Opposition", angle: 180 },
    { type: "Square", angle: 90 },
    { type: "Trine", angle: 120 },
    { type: "Sextile", angle: 60 }
  ];

  const pointsA = collectSynastryPoints(chartA);
  const pointsB = collectSynastryPoints(chartB);
  const aspects: Array<{ personA: string; personB: string; type: ChartData["aspects"][number]["type"]; orb: number }> =
    [];

  for (const left of pointsA) {
    for (const right of pointsB) {
      const separation = angularDistance(left.longitude, right.longitude);
      let best: { type: ChartData["aspects"][number]["type"]; delta: number } | null = null;

      for (const def of defs) {
        const delta = Math.abs(separation - def.angle);
        const maxOrb = maxOrbForAspect(
          def.type,
          left.name as ChartPointName,
          right.name as ChartPointName
        );
        if (delta <= maxOrb + 1e-6 && (!best || delta < best.delta - 1e-9)) {
          best = { type: def.type, delta };
        }
      }

      if (best) {
        aspects.push({
          personA: left.name,
          personB: right.name,
          type: best.type,
          orb: Number(best.delta.toFixed(4))
        });
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

export function generateNatalChart(input: {
  date: string;
  time: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}): ChartData {
  const julianDay = calculateJulianDay(input.date, input.time, input.timezone);
  const { year, month, day } = parseBirthDate(input.date);
  const { hour, minute } = parseBirthTime(input.time);

  const origin = new Origin({
    year,
    month: month - 1,
    date: day,
    hour,
    minute,
    latitude: input.latitude,
    longitude: input.longitude
  });
  const horoscope = new Horoscope({
    origin,
    zodiac: "tropical",
    houseSystem: "placidus",
    aspectTypes: ["major"],
    aspectPoints: ["bodies", "points"],
    aspectWithPoints: ["bodies", "points"],
    language: "en"
  });

  const ascendant = normalizeDegree(horoscope.Ascendant.ChartPosition.Ecliptic.DecimalDegrees);
  const midheaven = normalizeDegree(horoscope.Midheaven.ChartPosition.Ecliptic.DecimalDegrees);
  const descendant = normalizeDegree(ascendant + 180);
  const imumCoeli = normalizeDegree(midheaven + 180);

  const bodies = horoscope.CelestialBodies?.all ?? [];
  const points = horoscope.CelestialPoints?.all ?? [];
  const houses = (horoscope.Houses ?? [])
    .filter((house: any) => house?.id && house?.ChartPosition?.StartPosition?.Ecliptic?.DecimalDegrees != null)
    .map((house: any) => {
      const cuspLongitude = normalizeDegree(house.ChartPosition.StartPosition.Ecliptic.DecimalDegrees);
      return {
        house: Number(house.id),
        cuspLongitude: Number(cuspLongitude.toFixed(4)),
        sign: signFromLongitude(cuspLongitude)
      };
    });

  const mappedBodies: PlanetPosition[] = bodies
    .map((body: any) => {
      const name = mapBodyKeyToName(body.key);
      if (!name) return null;
      const longitude = normalizeDegree(body.ChartPosition.Ecliptic.DecimalDegrees);
      return {
        planet: name,
        longitude: Number(longitude.toFixed(4)),
        sign: signFromLongitude(longitude),
        house: Number(body.House?.id) || houseFromLongitude(longitude, houses),
        type: "planet" as const
      };
    })
    .filter(Boolean) as PlanetPosition[];

  const mappedPoints: PlanetPosition[] = points
    .map((point: any) => {
      const name = mapBodyKeyToName(point.key);
      if (!name) return null;
      const longitude = normalizeDegree(point.ChartPosition.Ecliptic.DecimalDegrees);
      return {
        planet: name,
        longitude: Number(longitude.toFixed(4)),
        sign: signFromLongitude(longitude),
        house: Number(point.House?.id) || houseFromLongitude(longitude, houses),
        type: "point" as const
      };
    })
    .filter(Boolean) as PlanetPosition[];

  const moon = mappedBodies.find((planet) => planet.planet === "Moon");
  const sun = mappedBodies.find((planet) => planet.planet === "Sun");
  const venus = mappedBodies.find((planet) => planet.planet === "Venus");
  const mars = mappedBodies.find((planet) => planet.planet === "Mars");
  const jupiter = mappedBodies.find((planet) => planet.planet === "Jupiter");
  const saturn = mappedBodies.find((planet) => planet.planet === "Saturn");
  const lilith = mappedPoints.find((point) => point.planet === "Lilith");

  const diurnal = isDiurnalChart(sun?.longitude ?? 0, ascendant);
  const asc = ascendant;
  const sunLon = sun?.longitude ?? 0;
  const moonLon = moon?.longitude ?? 0;
  const venusLon = venus?.longitude ?? 0;
  const marsLon = mars?.longitude ?? 0;
  const jupiterLon = jupiter?.longitude ?? 0;
  const saturnLon = saturn?.longitude ?? 0;

  const calculatedPoints: PlanetPosition[] = [
    makeCalculatedPoint(
      "Part of Fortune",
      diurnal ? asc + moonLon - sunLon : asc + sunLon - moonLon,
      houses
    ),
    makeCalculatedPoint(
      "Part of Spirit",
      diurnal ? asc + sunLon - moonLon : asc + moonLon - sunLon,
      houses
    ),
    makeCalculatedPoint(
      "Part of Eros",
      diurnal ? asc + venusLon - sunLon : asc + sunLon - venusLon,
      houses
    ),
    makeCalculatedPoint(
      "Part of Marriage",
      diurnal ? asc + venusLon - jupiterLon : asc + jupiterLon - venusLon,
      houses
    ),
    makeCalculatedPoint("Part of Calamity", asc + marsLon - saturnLon, houses)
  ];

  if (lilith) {
    calculatedPoints.push(makeCalculatedPoint("Priapus", lilith.longitude + 180, houses));
  }

  const extraEphemerisPoints = computeExtraEphemerisPoints(julianDay, houses);

  const allPoints = [...mappedBodies, ...mappedPoints, ...calculatedPoints, ...extraEphemerisPoints];
  const aspectPoints = [...mappedBodies, ...mappedPoints, ...calculatedPoints, ...extraEphemerisPoints];
  const aspects = computeMajorAspectsFromLongitudes(aspectPoints);

  return {
    birth: input,
    julianDay: Number(julianDay.toFixed(5)),
    ascendant: Number(ascendant.toFixed(4)),
    descendant: Number(descendant.toFixed(4)),
    midheaven: Number(midheaven.toFixed(4)),
    imumCoeli: Number(imumCoeli.toFixed(4)),
    sunSign: sun?.sign ?? "Aries",
    moonSign: moon?.sign ?? "Aries",
    risingSign: signFromLongitude(ascendant),
    planets: allPoints,
    houses,
    aspects
  };
}
