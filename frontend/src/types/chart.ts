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
