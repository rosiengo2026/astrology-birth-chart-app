import { ChartData } from "../types";
import { computeSynastryAspects, generateNatalChart } from "./chartService";
import { NatalChartInput } from "./transitService";

export interface SynastryPersonResult {
  label: string;
  chart: ChartData;
}

export interface SynastryAspectHit {
  personA: string;
  personB: string;
  type: "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition";
  orb: number;
}

export interface SynastryResult {
  personA: SynastryPersonResult;
  personB: SynastryPersonResult;
  aspects: SynastryAspectHit[];
}

export function calculateSynastry(input: {
  personA: NatalChartInput & { label?: string };
  personB: NatalChartInput & { label?: string };
}): SynastryResult {
  const chartA = generateNatalChart(input.personA);
  const chartB = generateNatalChart(input.personB);

  return {
    personA: {
      label: input.personA.label?.trim() || "Person A",
      chart: chartA
    },
    personB: {
      label: input.personB.label?.trim() || "Person B",
      chart: chartB
    },
    aspects: computeSynastryAspects(chartA, chartB)
  };
}
