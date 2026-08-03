/** Always visible on the natal chart — matches the current default wheel. */
export const DEFAULT_VISIBLE_CHART_OBJECTS = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn"
] as const;

export type DefaultVisibleChartObject = (typeof DEFAULT_VISIBLE_CHART_OBJECTS)[number];

export type ObjectSettingsCategoryId =
  | "default_planets"
  | "outer_planets"
  | "asteroids"
  | "fictitious_points"
  | "uranian_planets"
  | "arabic_parts";

export interface ChartObjectDefinition {
  id: string;
  label: { en: string; vi: string };
  description: { en: string; vi: string };
  /** When false, shown in settings but cannot be enabled yet. */
  available: boolean;
}

export interface ObjectSettingsCategory {
  id: ObjectSettingsCategoryId;
  title: { en: string; vi: string };
  description: { en: string; vi: string };
  /** Informational rows only — always on the chart, no checkbox. */
  informational?: boolean;
  objects: readonly string[];
}

export const CHART_OBJECT_DEFINITIONS: ChartObjectDefinition[] = [
  {
    id: "Sun",
    label: { en: "Sun", vi: "Mặt Trời (Sun)" },
    description: {
      en: "Ego, identity, consciousness, and life force.",
      vi: "Bản ngã, cái tôi, ý thức và năng lượng sống."
    },
    available: true
  },
  {
    id: "Moon",
    label: { en: "Moon", vi: "Mặt Trăng (Moon)" },
    description: {
      en: "Emotions, inner world, instincts, and need for safety.",
      vi: "Cảm xúc, nội tâm, bản năng và nhu cầu an toàn."
    },
    available: true
  },
  {
    id: "Mercury",
    label: { en: "Mercury", vi: "Thủy Tinh (Mercury)" },
    description: {
      en: "Thinking, communication, learning, and mental patterns.",
      vi: "Tư duy, giao tiếp, học tập và cách suy nghĩ."
    },
    available: true
  },
  {
    id: "Venus",
    label: { en: "Venus", vi: "Kim Tinh (Venus)" },
    description: {
      en: "Love, personal values, harmony, and aesthetics.",
      vi: "Tình yêu, giá trị cá nhân, sự hòa hợp và thẩm mỹ."
    },
    available: true
  },
  {
    id: "Mars",
    label: { en: "Mars", vi: "Hỏa Tinh (Mars)" },
    description: {
      en: "Action, drive, decisiveness, and how anger is expressed.",
      vi: "Hành động, động lực, sự quyết đoán và cách giận dữ."
    },
    available: true
  },
  {
    id: "Jupiter",
    label: { en: "Jupiter", vi: "Mộc Tinh (Jupiter)" },
    description: {
      en: "Luck, expansion, wisdom, and faith.",
      vi: "Sự may mắn, mở rộng, trí tuệ và niềm tin."
    },
    available: true
  },
  {
    id: "Saturn",
    label: { en: "Saturn", vi: "Thổ Tinh (Saturn)" },
    description: {
      en: "Discipline, challenges, responsibility, and maturity lessons.",
      vi: "Kỷ luật, thử thách, trách nhiệm và bài học trưởng thành."
    },
    available: true
  },
  {
    id: "Uranus",
    label: { en: "Uranus", vi: "Thiên Vương Tinh (Uranus)" },
    description: {
      en: "Breakthroughs, rebellion, surprise, and innovation.",
      vi: "Sự đột phá, nổi loạn, bất ngờ và đổi mới."
    },
    available: true
  },
  {
    id: "Neptune",
    label: { en: "Neptune", vi: "Hải Vương Tinh (Neptune)" },
    description: {
      en: "Dreams, intuition, illusion, and spirituality.",
      vi: "Giấc mơ, trực giác, sự ảo ảnh và tâm linh."
    },
    available: true
  },
  {
    id: "Pluto",
    label: { en: "Pluto", vi: "Diêm Vương Tinh (Pluto)" },
    description: {
      en: "Deep transformation, power, and rebirth.",
      vi: "Sự biến đổi sâu sắc, quyền lực và sự tái sinh."
    },
    available: true
  },
  {
    id: "Chiron",
    label: { en: "Chiron", vi: "Chiron" },
    description: {
      en: "The deepest wound and the capacity to heal.",
      vi: "Vết thương sâu thẳm nhất và khả năng chữa lành."
    },
    available: true
  },
  {
    id: "Ceres",
    label: { en: "Ceres", vi: "Ceres" },
    description: {
      en: "Nurturing energy, care, and sustenance.",
      vi: "Năng lượng dưỡng dục, sự chăm sóc và nuôi dưỡng."
    },
    available: true
  },
  {
    id: "Pallas",
    label: { en: "Pallas", vi: "Pallas" },
    description: {
      en: "Strategic wisdom, logic, and visual arts.",
      vi: "Trí tuệ chiến lược, logic và nghệ thuật thị giác."
    },
    available: true
  },
  {
    id: "Juno",
    label: { en: "Juno", vi: "Juno" },
    description: {
      en: "Committed relationships, marriage, and fairness.",
      vi: "Mối quan hệ cam kết, hôn nhân và sự công bằng."
    },
    available: true
  },
  {
    id: "Vesta",
    label: { en: "Vesta", vi: "Vesta" },
    description: {
      en: "Focus, devotion, and the inner spiritual flame.",
      vi: "Sự tập trung, cống hiến và ngọn lửa tâm linh bên trong."
    },
    available: true
  },
  {
    id: "Lilith",
    label: { en: "Black Moon Lilith", vi: "Lilith (Black Moon Lilith)" },
    description: {
      en: "The shadow, repressed desire, rebellion, and wild instinct.",
      vi: "Mặt tối, dục vọng bị đè nén, sự nổi loạn và bản năng hoang dã."
    },
    available: true
  },
  {
    id: "Priapus",
    label: { en: "Priapus (White Moon)", vi: "Priapus (White Moon)" },
    description: {
      en: "Opposite Lilith — excess, temptation, or redemption.",
      vi: "Điểm đối đỉnh với Lilith, đại diện cho sự phóng đãng, cám dỗ hoặc sự chuộc lỗi."
    },
    available: true
  },
  {
    id: "North Node",
    label: { en: "North Node", vi: "North Node (La Hầu)" },
    description: {
      en: "Life path, soul lessons, and direction to grow toward.",
      vi: "Con đường định mệnh, bài học cuộc đời và mục tiêu cần hướng tới."
    },
    available: true
  },
  {
    id: "South Node",
    label: { en: "South Node", vi: "South Node (Kế Đô)" },
    description: {
      en: "Karma, old habits, comfort zones, and what to release.",
      vi: "Nghiệp quả, thói quen cũ, vùng an toàn và những điều cần buông bỏ."
    },
    available: true
  },
  {
    id: "Cupido",
    label: { en: "Cupido", vi: "Cupido" },
    description: {
      en: "Hamburg Uranian planet — family bonds and intimate unions.",
      vi: "Hành tinh Uranian — gia đình và liên kết thân mật."
    },
    available: true
  },
  {
    id: "Hades",
    label: { en: "Hades", vi: "Hades" },
    description: {
      en: "Hamburg Uranian planet — depth, the underworld, and hidden matters.",
      vi: "Hành tinh Uranian — chiều sâu, thế giới ngầm và điều ẩn giấu."
    },
    available: true
  },
  {
    id: "Zeus",
    label: { en: "Zeus", vi: "Zeus" },
    description: {
      en: "Hamburg Uranian planet — leadership, vitality, and creative force.",
      vi: "Hành tinh Uranian — lãnh đạo, sinh lực và sức sáng tạo."
    },
    available: true
  },
  {
    id: "Kronos",
    label: { en: "Kronos", vi: "Kronos" },
    description: {
      en: "Hamburg Uranian planet — authority, structure, and long cycles.",
      vi: "Hành tinh Uranian — quyền uy, cấu trúc và chu kỳ dài."
    },
    available: true
  },
  {
    id: "Apollon",
    label: { en: "Apollon", vi: "Apollon" },
    description: {
      en: "Hamburg Uranian planet — expansion, success, and breadth.",
      vi: "Hamburg Uranian — mở rộng, thành công và phạm vi ảnh hưởng."
    },
    available: true
  },
  {
    id: "Admetos",
    label: { en: "Admetos", vi: "Admetos" },
    description: {
      en: "Hamburg Uranian planet — endings, compression, and stillness.",
      vi: "Hành tinh Uranian — kết thúc, thu hẹp và sự tĩnh lặng."
    },
    available: true
  },
  {
    id: "Vulkanus",
    label: { en: "Vulkanus", vi: "Vulkanus" },
    description: {
      en: "Hamburg Uranian planet — intense force and volcanic power.",
      vi: "Hành tinh Uranian — sức mạnh dồn nén và năng lượng bùng nổ."
    },
    available: true
  },
  {
    id: "Poseidon",
    label: { en: "Poseidon", vi: "Poseidon" },
    description: {
      en: "Hamburg Uranian planet — inspiration, ideals, and spiritual waves.",
      vi: "Hành tinh Uranian — cảm hứng, lý tưởng và sóng tâm linh."
    },
    available: true
  },
  {
    id: "Part of Fortune",
    label: { en: "Part of Fortune", vi: "Part of Fortune (Điểm May Mắn)" },
    description: {
      en: "Prosperity, material success, and where joy is found.",
      vi: "Sự thịnh vượng, thành công vật chất và nơi bạn dễ tìm thấy niềm vui."
    },
    available: true
  },
  {
    id: "Part of Spirit",
    label: { en: "Part of Spirit", vi: "Part of Spirit (Điểm Tinh Thần)" },
    description: {
      en: "Will, soul purpose, vocation, and self-directed action.",
      vi: "Ý chí, mục đích linh hồn, sự nghiệp và hành động tự chủ."
    },
    available: true
  },
  {
    id: "Part of Eros",
    label: { en: "Part of Eros", vi: "Part of Eros (Điểm Tình Dục)" },
    description: {
      en: "Erotic longing, passion, and sexual magnetism.",
      vi: "Khao khát ái tình, đam mê và sự hấp dẫn giới tính."
    },
    available: true
  },
  {
    id: "Part of Marriage",
    label: { en: "Part of Marriage", vi: "Part of Marriage (Điểm Hôn Nhân)" },
    description: {
      en: "Qualities of a partner and circumstances of marriage.",
      vi: "Đặc điểm của người bạn đời và hoàn cảnh diễn ra hôn nhân."
    },
    available: true
  },
  {
    id: "Part of Calamity",
    label: { en: "Part of Calamity", vi: "Part of Calamity (Điểm Tai Họa)" },
    description: {
      en: "Major trials, risk, or where wounding is more likely.",
      vi: "Những thử thách lớn, rủi ro hoặc nơi bạn dễ gặp tổn thương."
    },
    available: true
  }
];

const definitionById = new Map(CHART_OBJECT_DEFINITIONS.map((item) => [item.id, item]));

export const OBJECT_SETTINGS_CATEGORIES: ObjectSettingsCategory[] = [
  {
    id: "default_planets",
    title: { en: "Main planets (always shown)", vi: "Các hành tinh chính (luôn hiển thị)" },
    description: {
      en: "The seven classical planets shown by default on every natal chart.",
      vi: "7 hành tinh cổ điển luôn hiển thị mặc định trên lá số."
    },
    informational: true,
    objects: [...DEFAULT_VISIBLE_CHART_OBJECTS]
  },
  {
    id: "outer_planets",
    title: { en: "Outer planets", vi: "Hành tinh xa" },
    description: {
      en: "Transpersonal planets — enable to add them to the wheel.",
      vi: "Hành tinh siêu cá nhân — bật để thêm vào lá số."
    },
    objects: ["Uranus", "Neptune", "Pluto"]
  },
  {
    id: "asteroids",
    title: { en: "Main asteroids", vi: "Các tiểu hành tinh chính" },
    description: {
      en: "Minor bodies used in modern chart work.",
      vi: "Các thiên thể nhỏ trong luận giải hiện đại."
    },
    objects: ["Chiron", "Ceres", "Pallas", "Juno", "Vesta"]
  },
  {
    id: "fictitious_points",
    title: { en: "Fictitious points", vi: "Các điểm giả định chính" },
    description: {
      en: "Calculated points including Lilith and the lunar nodes.",
      vi: "Điểm tính toán gồm Lilith và các giao điểm Mặt Trăng."
    },
    objects: ["Lilith", "Priapus", "North Node", "South Node"]
  },
  {
    id: "uranian_planets",
    title: { en: "Uranian planets (Hamburg school)", vi: "Hành tinh Uranian (trường phái Hamburg)" },
    description: {
      en: "Eight hypothetical planets for advanced interpretation.",
      vi: "8 hành tinh giả định dùng trong luận giải chuyên sâu."
    },
    objects: ["Cupido", "Hades", "Zeus", "Kronos", "Apollon", "Admetos", "Vulkanus", "Poseidon"]
  },
  {
    id: "arabic_parts",
    title: { en: "Arabic parts", vi: "Các điểm Ả Rập phổ biến" },
    description: {
      en: "Traditional lots derived from the chart.",
      vi: "Các Arabic parts truyền thống tính từ lá số."
    },
    objects: [
      "Part of Fortune",
      "Part of Spirit",
      "Part of Eros",
      "Part of Marriage",
      "Part of Calamity"
    ]
  }
];

export const OPTIONAL_CHART_OBJECTS = OBJECT_SETTINGS_CATEGORIES.filter((category) => !category.informational).flatMap(
  (category) => category.objects
);

export type OptionalChartObject = (typeof OPTIONAL_CHART_OBJECTS)[number];

export const CHART_OBJECT_STORAGE_KEY = "astroscope-chart-objects";
const LEGACY_OPTIONAL_POINT_STORAGE_KEY = "astroscope-optional-points";

const allowedOptionalObjects = new Set<string>(OPTIONAL_CHART_OBJECTS);

export function getChartObjectDefinition(id: string): ChartObjectDefinition | undefined {
  return definitionById.get(id);
}

export function isChartObjectAvailable(id: string): boolean {
  return definitionById.get(id)?.available ?? false;
}

export function isDefaultVisibleChartObject(name: string): boolean {
  return (DEFAULT_VISIBLE_CHART_OBJECTS as readonly string[]).includes(name);
}

export function isOptionalChartObject(name: string): boolean {
  return allowedOptionalObjects.has(name);
}

export function loadEnabledChartObjects(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw =
      localStorage.getItem(CHART_OBJECT_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_OPTIONAL_POINT_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((item): item is string => typeof item === "string" && allowedOptionalObjects.has(item))
    );
  } catch {
    return new Set();
  }
}

export function saveEnabledChartObjects(enabled: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHART_OBJECT_STORAGE_KEY, JSON.stringify([...enabled]));
}

export function isChartObjectVisible(name: string, enabledOptional: Set<string>): boolean {
  if (isDefaultVisibleChartObject(name)) return true;
  return enabledOptional.has(name);
}

const NATAL_ANGLE_POINTS = ["ASC", "MC", "DC", "IC"] as const;

export function isTransitNatalPointVisible(name: string, enabledOptional: Set<string>): boolean {
  if ((NATAL_ANGLE_POINTS as readonly string[]).includes(name)) return true;
  return isChartObjectVisible(name, enabledOptional);
}

export function isSynastryPointVisible(name: string, enabledOptional: Set<string>): boolean {
  return isTransitNatalPointVisible(name, enabledOptional);
}

export function filterVisiblePlanets<T extends { planet: string }>(
  planets: T[],
  enabledOptional: Set<string>
): T[] {
  return planets.filter((item) => isChartObjectVisible(item.planet, enabledOptional));
}

export function filterVisibleAspects<T extends { between: [string, string] }>(
  aspects: T[],
  enabledOptional: Set<string>
): T[] {
  return aspects.filter(
    (aspect) =>
      isChartObjectVisible(aspect.between[0], enabledOptional) &&
      isChartObjectVisible(aspect.between[1], enabledOptional)
  );
}

/** @deprecated use CHART_OBJECT_DEFINITIONS */
export const CHART_OBJECT_LABELS = Object.fromEntries(
  CHART_OBJECT_DEFINITIONS.map((item) => [item.id, { en: item.label.en, labelVi: item.label.vi }])
);

/** @deprecated use DEFAULT_VISIBLE_CHART_OBJECTS */
export const PRIMARY_CHART_POINTS = DEFAULT_VISIBLE_CHART_OBJECTS;

/** @deprecated use OPTIONAL_CHART_OBJECTS */
export const OPTIONAL_CHART_POINTS = OPTIONAL_CHART_OBJECTS;

/** @deprecated use CHART_OBJECT_STORAGE_KEY */
export const OPTIONAL_POINT_STORAGE_KEY = CHART_OBJECT_STORAGE_KEY;

/** @deprecated use OPTIONAL_CHART_OBJECTS labels via getChartObjectDefinition */
export const OPTIONAL_POINT_LABELS = CHART_OBJECT_LABELS;

/** @deprecated use isOptionalChartObject */
export function isOptionalChartPoint(name: string): boolean {
  return isOptionalChartObject(name);
}

/** @deprecated use loadEnabledChartObjects */
export function loadEnabledOptionalPoints(): Set<string> {
  return loadEnabledChartObjects();
}

/** @deprecated use saveEnabledChartObjects */
export function saveEnabledOptionalPoints(enabled: Set<string>): void {
  saveEnabledChartObjects(enabled);
}

/** @deprecated use isChartObjectVisible */
export function isChartPointVisible(name: string, enabledOptional: Set<string>): boolean {
  return isChartObjectVisible(name, enabledOptional);
}
