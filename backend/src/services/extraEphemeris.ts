import { getPosition, CelestialBody } from "celestine";
import { ChartPointName, PlanetPosition } from "../types";
import { ZODIAC_SIGNS } from "../constants";

const J2000_JD = 2451545.0;

const URANIAN_PLANETS: Array<{ name: ChartPointName; epochLon: number; ratePerYear: number }> = [
  { name: "Cupido", epochLon: 174.79, ratePerYear: 1.371 },
  { name: "Hades", epochLon: 108.44, ratePerYear: 0.998 },
  { name: "Zeus", epochLon: 60.5, ratePerYear: 0.791 },
  { name: "Kronos", epochLon: 88.95, ratePerYear: 0.69 },
  { name: "Apollon", epochLon: 26.68, ratePerYear: 0.625 },
  { name: "Admetos", epochLon: 19.35, ratePerYear: 0.577 },
  { name: "Vulkanus", epochLon: 16.1, ratePerYear: 0.543 },
  { name: "Poseidon", epochLon: 26.37, ratePerYear: 0.486 }
];

const ASTEROIDS: Array<{ name: ChartPointName; body: CelestialBody }> = [
  { name: "Ceres", body: CelestialBody.Ceres },
  { name: "Pallas", body: CelestialBody.Pallas },
  { name: "Juno", body: CelestialBody.Juno },
  { name: "Vesta", body: CelestialBody.Vesta }
];

function normalizeDegree(degree: number): number {
  const normalized = degree % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function signFromLongitude(longitude: number) {
  return ZODIAC_SIGNS[Math.floor(normalizeDegree(longitude) / 30)];
}

function houseFromLongitude(
  longitude: number,
  houses: Array<{ house: number; cuspLongitude: number }>
): number {
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

function uranianLongitude(julianDay: number, epochLon: number, ratePerYear: number): number {
  const tropicalYears = (julianDay - J2000_JD) / 365.25;
  return normalizeDegree(epochLon + ratePerYear * tropicalYears);
}

function makePoint(
  name: ChartPointName,
  longitude: number,
  houses: Array<{ house: number; cuspLongitude: number }>,
  type: PlanetPosition["type"] = "point"
): PlanetPosition {
  const normalized = normalizeDegree(longitude);
  return {
    planet: name,
    longitude: Number(normalized.toFixed(4)),
    sign: signFromLongitude(normalized),
    house: houseFromLongitude(normalized, houses),
    type
  };
}

export function computeExtraEphemerisPoints(
  julianDay: number,
  houses: Array<{ house: number; cuspLongitude: number }>
): PlanetPosition[] {
  const points: PlanetPosition[] = [];

  for (const asteroid of ASTEROIDS) {
    const position = getPosition(asteroid.body, julianDay);
    points.push(makePoint(asteroid.name, position.longitude, houses, "planet"));
  }

  for (const uranian of URANIAN_PLANETS) {
    points.push(
      makePoint(
        uranian.name,
        uranianLongitude(julianDay, uranian.epochLon, uranian.ratePerYear),
        houses,
        "point"
      )
    );
  }

  return points;
}
