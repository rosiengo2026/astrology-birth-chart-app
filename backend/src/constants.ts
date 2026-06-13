import { ChartPointName, ZodiacSign } from "./types";

export const ZODIAC_SIGNS: ZodiacSign[] = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
];

export const PLANETS: Array<{ name: ChartPointName; id: number }> = [
  { name: "Sun", id: 0 },
  { name: "Moon", id: 1 },
  { name: "Mercury", id: 2 },
  { name: "Venus", id: 3 },
  { name: "Mars", id: 4 },
  { name: "Jupiter", id: 5 },
  { name: "Saturn", id: 6 },
  { name: "Uranus", id: 7 },
  { name: "Neptune", id: 8 },
  { name: "Pluto", id: 9 }
];

export const EXTRA_POINTS: ChartPointName[] = ["North Node", "South Node", "Lilith", "Part of Fortune"];

export const ASPECT_DEGREES: Record<
  "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition",
  number
> = {
  Conjunction: 0,
  Sextile: 60,
  Square: 90,
  Trine: 120,
  Opposition: 180
};
