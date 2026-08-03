export type ZodiacSign =
  | "Aries"
  | "Taurus"
  | "Gemini"
  | "Cancer"
  | "Leo"
  | "Virgo"
  | "Libra"
  | "Scorpio"
  | "Sagittarius"
  | "Capricorn"
  | "Aquarius"
  | "Pisces";

export type ChartPointName =
  | "Sun"
  | "Moon"
  | "Mercury"
  | "Venus"
  | "Mars"
  | "Jupiter"
  | "Saturn"
  | "Uranus"
  | "Neptune"
  | "Pluto"
  | "Chiron"
  | "Ceres"
  | "Pallas"
  | "Juno"
  | "Vesta"
  | "North Node"
  | "South Node"
  | "Lilith"
  | "Priapus"
  | "Cupido"
  | "Hades"
  | "Zeus"
  | "Kronos"
  | "Apollon"
  | "Admetos"
  | "Vulkanus"
  | "Poseidon"
  | "Part of Fortune"
  | "Part of Spirit"
  | "Part of Eros"
  | "Part of Marriage"
  | "Part of Calamity";

export interface PlanetPosition {
  planet: ChartPointName;
  longitude: number;
  sign: ZodiacSign;
  house: number;
  type: "planet" | "point";
}

export interface HouseData {
  house: number;
  cuspLongitude: number;
  sign: ZodiacSign;
}

export interface ChartData {
  birth: {
    date: string;
    time: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  julianDay: number;
  ascendant: number;
  descendant: number;
  midheaven: number;
  imumCoeli: number;
  sunSign: ZodiacSign;
  moonSign: ZodiacSign;
  risingSign: ZodiacSign;
  planets: PlanetPosition[];
  houses: HouseData[];
  aspects: Array<{
    between: [ChartPointName, ChartPointName];
    type: "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition";
    orb: number;
  }>;
}

export type MeaningCategory = "planet_sign" | "planet_house" | "aspect" | "house" | "house_sign";
