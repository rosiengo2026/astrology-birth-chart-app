export const POINT_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "north_node",
  "south_node",
  "lilith",
  "part_of_fortune"
] as const;

export const SIGN_KEYS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces"
] as const;

export const ASPECT_KEYS = ["conjunction", "sextile", "square", "trine", "opposition"] as const;

export const HOUSE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type MeaningCategory = "planet_sign" | "planet_house" | "aspect" | "house" | "house_sign";

export const CMS_CATEGORY_TABS: Array<{
  id: MeaningCategory;
  labelEn: string;
  labelVi: string;
}> = [
  { id: "planet_sign", labelEn: "In Signs", labelVi: "Trong cung" },
  { id: "planet_house", labelEn: "In Houses", labelVi: "Trong nhà" },
  { id: "aspect", labelEn: "Aspects", labelVi: "Aspect" },
  { id: "house", labelEn: "House meaning", labelVi: "Ý nghĩa nhà" },
  { id: "house_sign", labelEn: "House in sign", labelVi: "Nhà trong cung" }
];

export const ASPECT_NAV: Array<{ key: (typeof ASPECT_KEYS)[number]; label: string; labelVi: string }> = [
  { key: "conjunction", label: "Conjunction", labelVi: "Hợp (0°)" },
  { key: "sextile", label: "Sextile", labelVi: "Lục hợp (60°)" },
  { key: "square", label: "Square", labelVi: "Vuông (90°)" },
  { key: "trine", label: "Trine", labelVi: "Tam hợp (120°)" },
  { key: "opposition", label: "Opposition", labelVi: "Đối lập (180°)" }
];

export const PLANET_NAV: Array<{ key: (typeof POINT_KEYS)[number]; label: string; labelVi: string }> = [
  { key: "sun", label: "Sun", labelVi: "Mặt Trời" },
  { key: "moon", label: "Moon", labelVi: "Mặt Trăng" },
  { key: "mercury", label: "Mercury", labelVi: "Sao Thủy" },
  { key: "venus", label: "Venus", labelVi: "Sao Kim" },
  { key: "mars", label: "Mars", labelVi: "Sao Hỏa" },
  { key: "jupiter", label: "Jupiter", labelVi: "Sao Mộc" },
  { key: "saturn", label: "Saturn", labelVi: "Sao Thổ" },
  { key: "uranus", label: "Uranus", labelVi: "Sao Thiên Vương" },
  { key: "neptune", label: "Neptune", labelVi: "Sao Hải Vương" },
  { key: "pluto", label: "Pluto", labelVi: "Sao Diêm Vương" },
  { key: "lilith", label: "Black Moon Lilith", labelVi: "Lilith" },
  { key: "north_node", label: "North Node", labelVi: "Bắc Giao" },
  { key: "south_node", label: "South Node", labelVi: "Nam Giao" },
  { key: "part_of_fortune", label: "Part of Fortune", labelVi: "Part of Fortune" }
];

const SIGN_LABEL: Record<(typeof SIGN_KEYS)[number], { en: string; vi: string }> = {
  aries: { en: "Aries", vi: "Bạch Dương" },
  taurus: { en: "Taurus", vi: "Kim Ngưu" },
  gemini: { en: "Gemini", vi: "Song Tử" },
  cancer: { en: "Cancer", vi: "Cự Giải" },
  leo: { en: "Leo", vi: "Sư Tử" },
  virgo: { en: "Virgo", vi: "Xử Nữ" },
  libra: { en: "Libra", vi: "Thiên Bình" },
  scorpio: { en: "Scorpio", vi: "Bọ Cạp" },
  sagittarius: { en: "Sagittarius", vi: "Nhân Mã" },
  capricorn: { en: "Capricorn", vi: "Ma Kết" },
  aquarius: { en: "Aquarius", vi: "Bảo Bình" },
  pisces: { en: "Pisces", vi: "Song Ngư" }
};

function titleCaseKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function planetLabel(pointKey: string): { en: string; vi: string } {
  const found = PLANET_NAV.find((p) => p.key === pointKey);
  if (found) return { en: found.label, vi: found.labelVi };
  return { en: titleCaseKey(pointKey), vi: titleCaseKey(pointKey) };
}

export function signLabel(signKey: string): { en: string; vi: string } {
  const found = SIGN_LABEL[signKey as (typeof SIGN_KEYS)[number]];
  if (found) return found;
  return { en: titleCaseKey(signKey), vi: titleCaseKey(signKey) };
}

export function defaultTitlesForPlanetSign(pointKey: string, signKey: string) {
  const planet = planetLabel(pointKey);
  const sign = signLabel(signKey);
  return {
    en: `${planet.en} in ${sign.en}`,
    vi: `${planet.vi} trong ${sign.vi}`
  };
}

export function defaultTitlesForPlanetHouse(pointKey: string, houseNum: number) {
  const planet = planetLabel(pointKey);
  return {
    en: `${planet.en} in House ${houseNum}`,
    vi: `${planet.vi} trong Nhà ${houseNum}`
  };
}

export function rowLabelPlanetSign(pointKey: string, signKey: string): string {
  const planet = planetLabel(pointKey);
  const sign = signLabel(signKey);
  return `${planet.en} in ${sign.en} · ${planet.vi} trong ${sign.vi}`;
}

export function rowLabelPlanetHouse(pointKey: string, houseNum: number): string {
  const planet = planetLabel(pointKey);
  return `${planet.en} in House ${houseNum} · ${planet.vi} — Nhà ${houseNum}`;
}

export function rowLabelHouse(houseNum: number): string {
  return `House ${houseNum} · Nhà ${houseNum}`;
}

export function rowLabelHouseSign(houseNum: number, signKey: string): string {
  const sign = signLabel(signKey);
  return `House ${houseNum} in ${sign.en} · Nhà ${houseNum} trong ${sign.vi}`;
}

export function rowLabelAspect(leftKey: string, aspectKey: string, rightKey: string): string {
  const left = planetLabel(leftKey);
  const right = planetLabel(rightKey);
  const aspect = ASPECT_NAV.find((a) => a.key === aspectKey);
  const aspectEn = aspect?.label ?? titleCaseKey(aspectKey);
  const aspectVi = aspect?.labelVi ?? titleCaseKey(aspectKey);
  return `${left.en} ${aspectEn} ${right.en} · ${left.vi} ${aspectVi} ${right.vi}`;
}

export function defaultTitlesForHouse(houseNum: number) {
  return {
    en: `House ${houseNum}`,
    vi: `Nhà ${houseNum}`
  };
}

export function defaultTitlesForHouseSign(houseNum: number, signKey: string) {
  const sign = signLabel(signKey);
  return {
    en: `House ${houseNum} in ${sign.en}`,
    vi: `Nhà ${houseNum} trong ${sign.vi}`
  };
}

export function defaultTitlesForAspect(leftKey: string, aspectKey: string, rightKey: string) {
  const left = planetLabel(leftKey);
  const right = planetLabel(rightKey);
  const aspect = ASPECT_NAV.find((a) => a.key === aspectKey);
  const aspectEn = aspect?.label ?? titleCaseKey(aspectKey);
  const aspectVi = aspect?.labelVi ?? titleCaseKey(aspectKey);
  return {
    en: `${left.en} ${aspectEn} ${right.en}`,
    vi: `${left.vi} ${aspectVi} ${right.vi}`
  };
}

export function cmsKeyPlanetSign(pointKey: string, signKey: string): string {
  return `${pointKey}_${signKey}`;
}

export function cmsKeyPlanetHouse(pointKey: string, houseNum: number): string {
  return `${pointKey}_${houseNum}`;
}

export function cmsKeyHouse(houseNum: number): string {
  return `house_${houseNum}`;
}

export function cmsKeyHouseSign(houseNum: number, signKey: string): string {
  return `house_${houseNum}_${signKey}`;
}

export function cmsKeyAspect(leftKey: string, aspectKey: string, rightKey: string): string {
  return `${leftKey}_${aspectKey}_${rightKey}`;
}

export function rowLabelForKey(category: MeaningCategory, key: string): string {
  if (category === "planet_sign") {
    const [point, sign] = key.split("_");
    const pointKey = POINT_KEYS.find((p) => key.startsWith(`${p}_`)) ?? point;
    const signKey = key.slice(pointKey.length + 1);
    return rowLabelPlanetSign(pointKey, signKey);
  }
  if (category === "planet_house") {
    const pointKey = POINT_KEYS.find((p) => key.startsWith(`${p}_`)) ?? key.split("_")[0];
    const houseNum = Number(key.slice(pointKey.length + 1));
    return rowLabelPlanetHouse(pointKey, houseNum);
  }
  if (category === "house") {
    return rowLabelHouse(Number(key.replace("house_", "")));
  }
  if (category === "house_sign") {
    const match = key.match(/^house_(\d+)_(.+)$/);
    if (match) return rowLabelHouseSign(Number(match[1]), match[2]);
    return key;
  }
  const parts = key.split("_");
  const aspectIdx = parts.findIndex((p) => (ASPECT_KEYS as readonly string[]).includes(p));
  if (aspectIdx > 0 && aspectIdx < parts.length - 1) {
    const aspectKey = parts[aspectIdx];
    const leftKey = parts.slice(0, aspectIdx).join("_");
    const rightKey = parts.slice(aspectIdx + 1).join("_");
    return rowLabelAspect(leftKey, aspectKey, rightKey);
  }
  return key;
}

export function defaultTitlesForKey(category: MeaningCategory, key: string): { en: string; vi: string } {
  if (category === "planet_sign") {
    const pointKey = POINT_KEYS.find((p) => key.startsWith(`${p}_`)) ?? "sun";
    const signKey = key.slice(pointKey.length + 1);
    return defaultTitlesForPlanetSign(pointKey, signKey);
  }
  if (category === "planet_house") {
    const pointKey = POINT_KEYS.find((p) => key.startsWith(`${p}_`)) ?? "sun";
    const houseNum = Number(key.slice(pointKey.length + 1));
    return defaultTitlesForPlanetHouse(pointKey, houseNum);
  }
  if (category === "house") {
    return defaultTitlesForHouse(Number(key.replace("house_", "")));
  }
  if (category === "house_sign") {
    const match = key.match(/^house_(\d+)_(.+)$/);
    if (match) return defaultTitlesForHouseSign(Number(match[1]), match[2]);
    return { en: key, vi: key };
  }
  const parts = key.split("_");
  const aspectIdx = parts.findIndex((p) => (ASPECT_KEYS as readonly string[]).includes(p));
  if (aspectIdx > 0) {
    const aspectKey = parts[aspectIdx];
    const leftKey = parts.slice(0, aspectIdx).join("_");
    const rightKey = parts.slice(aspectIdx + 1).join("_");
    return defaultTitlesForAspect(leftKey, aspectKey, rightKey);
  }
  return { en: key, vi: key };
}
