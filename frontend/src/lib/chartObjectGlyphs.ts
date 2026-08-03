/** Wheel / UI glyphs for chart objects — keep in sync with the natal wheel. */
export const CHART_OBJECT_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Chiron: "⚷",
  Ceres: "⚳",
  Pallas: "⚴",
  Juno: "⚵",
  Vesta: "⚶",
  "North Node": "☊",
  "South Node": "☋",
  Lilith: "⚸",
  Priapus: "⚪",
  Cupido: "Cu",
  Hades: "Ha",
  Zeus: "Ze",
  Kronos: "Kr",
  Apollon: "Ap",
  Admetos: "Ad",
  Vulkanus: "Vu",
  Poseidon: "Po",
  "Part of Fortune": "⊗",
  "Part of Spirit": "◎",
  "Part of Eros": "♡",
  "Part of Marriage": "⚭",
  "Part of Calamity": "⚠"
};

export function getChartObjectGlyph(objectId: string): string {
  return CHART_OBJECT_GLYPHS[objectId] ?? objectId.slice(0, 2);
}
