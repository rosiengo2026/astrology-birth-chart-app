export interface ChartResponse {
  chart: {
    birth: {
      date: string;
      time: string;
      city: string;
      country: string;
      latitude: number;
      longitude: number;
      timezone: string;
    };
    ascendant: number;
    descendant: number;
    midheaven: number;
    imumCoeli: number;
    sunSign: string;
    moonSign: string;
    risingSign: string;
    planets: Array<{
      planet: string;
      longitude: number;
      sign: string;
      house: number;
      type: "planet" | "point";
    }>;
    houses: Array<{
      house: number;
      cuspLongitude: number;
      sign: string;
    }>;
    aspects: Array<{
      between: [string, string];
      type: string;
      orb: number;
    }>;
  };
}

export interface MeaningItem {
  _id: string;
  category: "planet_sign" | "planet_house" | "aspect" | "house" | "house_sign";
  key: string;
  title: { en: string; vi: string } | string;
  content: { en: string; vi: string } | string;
}

export interface LocationOption {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export type TransitPhase = "applying" | "exact" | "separating";

export interface NatalTransitHit {
  transiting: string;
  natal: string;
  type: string;
  orb: number;
  phase: TransitPhase;
  strength: number;
  isRetrograde: boolean;
  symbol: string;
}

export interface TransitsResponse {
  natal: ChartResponse["chart"];
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
  transitSky: ChartResponse["chart"];
  transits: NatalTransitHit[];
}

export interface SynastryAspectHit {
  personA: string;
  personB: string;
  type: string;
  orb: number;
}

export interface SynastryResponse {
  personA: {
    label: string;
    chart: ChartResponse["chart"];
  };
  personB: {
    label: string;
    chart: ChartResponse["chart"];
  };
  aspects: SynastryAspectHit[];
}
