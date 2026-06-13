import OpenAI from "openai";
import { config } from "../config";
import { ChartData } from "../types";

const openai = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

function fallbackInterpretation(chart: ChartData): string {
  const topAspects = chart.aspects.slice(0, 3).map((aspect) => `${aspect.between[0]} ${aspect.type} ${aspect.between[1]}`);
  return [
    `Your core identity shines through a ${chart.sunSign} Sun, while your emotions are guided by a ${chart.moonSign} Moon and a ${chart.risingSign} Rising persona.`,
    `In relationships, your Venus in ${chart.planets.find((planet) => planet.planet === "Venus")?.sign} suggests how you bond and what makes you feel valued.`,
    `For career and growth, focus on house themes where Mars and Saturn are placed to balance ambition with discipline.`,
    topAspects.length ? `Notable energetic patterns include: ${topAspects.join(", ")}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateInterpretation(chart: ChartData): Promise<string> {
  if (!openai) {
    return fallbackInterpretation(chart);
  }

  const prompt = [
    "You are an expert astrologer.",
    "Create a concise but insightful natal chart interpretation.",
    "Include sections: personality, love, and career.",
    "Use this structured chart JSON:",
    JSON.stringify(chart)
  ].join("\n");

  const completion = await openai.responses.create({
    model: config.openAiModel,
    input: prompt
  });

  return completion.output_text || fallbackInterpretation(chart);
}
