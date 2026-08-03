import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { MeaningModel } from "../models/Meaning";
import { slugify } from "../lib/slugify";
import { listLocalMeanings } from "./localCmsStore";
import { ChartData, MeaningCategory } from "../types";

type Localized = { en: string; vi: string };

export type ChartInterpretationRef = {
  category: MeaningCategory;
  key: string;
  label: Localized;
  aspectReverseKey?: string;
};

export type ChartInterpretationEntry = {
  category: MeaningCategory;
  key: string;
  label: Localized;
  title: Localized;
  content: Localized;
  hasContent: boolean;
};

export type ChartInterpretationExport = {
  exportedAt: string;
  birth: ChartData["birth"];
  summary: {
    sunSign: string;
    moonSign: string;
    risingSign: string;
  };
  entries: ChartInterpretationEntry[];
  missingCount: number;
};

function normalizeLocalized(value: unknown): Localized {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return { en: trimmed, vi: trimmed };
  }
  if (value && typeof value === "object") {
    const record = value as { en?: string; vi?: string };
    const en = String(record.en ?? "").trim();
    const vi = String(record.vi ?? "").trim();
    return { en: en || vi, vi: vi || en };
  }
  return { en: "", vi: "" };
}

function hasMeaningContent(content: Localized): boolean {
  return content.en.trim().length > 0 || content.vi.trim().length > 0;
}

export function collectChartInterpretationRefs(chart: ChartData): ChartInterpretationRef[] {
  const refs: ChartInterpretationRef[] = [];
  const seen = new Set<string>();

  function add(category: MeaningCategory, key: string, label: Localized, aspectReverseKey?: string) {
    const id = `${category}:${key}`;
    if (seen.has(id)) return;
    seen.add(id);
    refs.push({ category, key, label, aspectReverseKey });
  }

  chart.planets.forEach((item) => {
    add("planet_sign", `${slugify(item.planet)}_${slugify(item.sign)}`, {
      en: `${item.planet} in ${item.sign}`,
      vi: `${item.planet} trong ${item.sign}`
    });
    add("planet_house", `${slugify(item.planet)}_${item.house}`, {
      en: `${item.planet} in House ${item.house}`,
      vi: `${item.planet} trong Nhà ${item.house}`
    });
  });

  chart.houses.forEach((house) => {
    add("house", `house_${house.house}`, {
      en: `House ${house.house}`,
      vi: `Nhà ${house.house}`
    });
    add("house_sign", `house_${house.house}_${slugify(house.sign)}`, {
      en: `House ${house.house} in ${house.sign}`,
      vi: `Nhà ${house.house} trong ${house.sign}`
    });
  });

  chart.aspects.forEach((aspect) => {
    const directKey = `${slugify(aspect.between[0])}_${slugify(aspect.type)}_${slugify(aspect.between[1])}`;
    const reverseKey = `${slugify(aspect.between[1])}_${slugify(aspect.type)}_${slugify(aspect.between[0])}`;
    add(
      "aspect",
      directKey,
      {
        en: `${aspect.between[0]} ${aspect.type} ${aspect.between[1]} (orb ${aspect.orb})`,
        vi: `${aspect.between[0]} ${aspect.type} ${aspect.between[1]} (sai số ${aspect.orb})`
      },
      reverseKey
    );
  });

  return refs;
}

type MeaningRecord = {
  category: MeaningCategory;
  key: string;
  title: Localized;
  content: Localized;
};

async function loadMeaningRecords(dbReady: boolean): Promise<Map<string, MeaningRecord>> {
  const mapped = new Map<string, MeaningRecord>();

  if (dbReady) {
    const items = await MeaningModel.find().sort({ category: 1, key: 1 });
    items.forEach((item) => {
      mapped.set(`${item.category}:${item.key}`, {
        category: item.category as MeaningCategory,
        key: item.key,
        title: normalizeLocalized(item.title),
        content: normalizeLocalized(item.content)
      });
    });
    return mapped;
  }

  const items = await listLocalMeanings();
  items.forEach((item) => {
    mapped.set(`${item.category}:${item.key}`, {
      category: item.category,
      key: item.key,
      title: normalizeLocalized(item.title),
      content: normalizeLocalized(item.content)
    });
  });
  return mapped;
}

function resolveMeaning(
  meanings: Map<string, MeaningRecord>,
  ref: ChartInterpretationRef
): MeaningRecord | null {
  const direct = meanings.get(`${ref.category}:${ref.key}`);
  if (direct) return direct;
  if (ref.category === "aspect" && ref.aspectReverseKey) {
    return meanings.get(`aspect:${ref.aspectReverseKey}`) ?? null;
  }
  return null;
}

const CATEGORY_ORDER: MeaningCategory[] = [
  "planet_sign",
  "planet_house",
  "house",
  "house_sign",
  "aspect"
];

const CATEGORY_LABEL: Record<MeaningCategory, { en: string; vi: string }> = {
  planet_sign: { en: "Planet in sign", vi: "Hành tinh trong cung" },
  planet_house: { en: "Planet in house", vi: "Hành tinh trong nhà" },
  house: { en: "House", vi: "Nhà" },
  house_sign: { en: "House in sign", vi: "Nhà trong cung" },
  aspect: { en: "Aspect", vi: "Aspect" }
};

export type ChartInterpretationExportOptions = {
  includeAspects?: boolean;
};

export async function buildChartInterpretationExport(
  chart: ChartData,
  dbReady: boolean,
  options: ChartInterpretationExportOptions = {}
): Promise<ChartInterpretationExport> {
  const includeAspects = options.includeAspects !== false;
  const refs = collectChartInterpretationRefs(chart).filter(
    (ref) => includeAspects || ref.category !== "aspect"
  );
  const meanings = await loadMeaningRecords(dbReady);

  const entries: ChartInterpretationEntry[] = refs.map((ref) => {
    const found = resolveMeaning(meanings, ref);
    const title = found?.title ?? ref.label;
    const content = found?.content ?? { en: "", vi: "" };
    return {
      category: ref.category,
      key: ref.key,
      label: ref.label,
      title,
      content,
      hasContent: Boolean(found && hasMeaningContent(content))
    };
  });

  entries.sort((a, b) => {
    const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.label.en.localeCompare(b.label.en);
  });

  return {
    exportedAt: new Date().toISOString(),
    birth: chart.birth,
    summary: {
      sunSign: chart.sunSign,
      moonSign: chart.moonSign,
      risingSign: chart.risingSign
    },
    entries,
    missingCount: entries.filter((entry) => !entry.hasContent).length
  };
}

export function buildExportFilename(birthDate: string): string {
  const safeDate = birthDate.replace(/[^\d-]/g, "") || "chart";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `chart-interpretations-${safeDate}-${stamp}.pdf`;
}

function resolvePdfFontPath(): string {
  const candidates = [
    path.join(__dirname, "../../assets/fonts/DejaVuSans.ttf"),
    path.join(process.cwd(), "assets/fonts/DejaVuSans.ttf"),
    path.join(process.cwd(), "backend/assets/fonts/DejaVuSans.ttf")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("PDF font not found. Add backend/assets/fonts/DejaVuSans.ttf on the server.");
}

function ensurePdfSpace(doc: InstanceType<typeof PDFDocument>, height: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

function decodeChartImage(chartImageBase64?: string | null): Buffer | null {
  if (!chartImageBase64?.trim()) return null;
  try {
    const base64 = chartImageBase64.replace(/^data:image\/\w+;base64,/, "").trim();
    if (!base64) return null;
    const buffer = Buffer.from(base64, "base64");
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

export async function formatChartInterpretationPdf(
  exportData: ChartInterpretationExport,
  chartImageBase64?: string | null
): Promise<Buffer> {
  const fontPath = resolvePdfFontPath();
  const chartImageBuffer = decodeChartImage(chartImageBase64);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Body", fontPath);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const { birth, summary } = exportData;

    doc.font("Body").fontSize(16).text("LÁ SỐ TỬ VI · NATAL CHART INTERPRETATIONS", {
      align: "center",
      width: pageWidth
    });
    doc.moveDown(0.8);
    doc.fontSize(10);
    doc.text(`Ngày sinh / Date of birth: ${birth.date}`);
    doc.text(`Giờ sinh / Time of birth: ${birth.time}`);
    doc.text(`Địa điểm / Location: ${birth.city}, ${birth.country}`);
    doc.text(`Múi giờ / Timezone: ${birth.timezone}`);
    doc.moveDown(0.4);
    doc.text(`Mặt trời / Sun: ${summary.sunSign}`);
    doc.text(`Mặt trăng / Moon: ${summary.moonSign}`);
    doc.text(`Cung mọc / Rising: ${summary.risingSign}`);
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor("#555555").text(`Xuất lúc / Exported at: ${exportData.exportedAt}`);
    doc.fillColor("#000000");
    doc.moveDown(1);

    if (chartImageBuffer) {
      ensurePdfSpace(doc, 280);
      doc.fontSize(11).text("Natal chart · Lá số tử vi", { width: pageWidth });
      doc.moveDown(0.3);
      doc.image(chartImageBuffer, {
        fit: [pageWidth, 250],
        align: "center"
      });
      doc.moveDown(0.8);
    }

    let currentCategory: MeaningCategory | null = null;
    exportData.entries.forEach((entry) => {
      if (entry.category !== currentCategory) {
        currentCategory = entry.category;
        ensurePdfSpace(doc, 36);
        doc.moveDown(0.5);
        const heading = CATEGORY_LABEL[entry.category];
        doc.fontSize(12).text(`${heading.vi} · ${heading.en}`, { underline: true, width: pageWidth });
        doc.moveDown(0.4);
        doc.fontSize(10);
      }

      ensurePdfSpace(doc, 48);
      doc.fontSize(11).text(entry.label.vi, { width: pageWidth });
      doc.fontSize(10).fillColor("#444444").text(entry.label.en, { width: pageWidth });
      doc.fillColor("#000000");

      if (entry.hasContent) {
        if (entry.content.vi.trim()) {
          doc.moveDown(0.25);
          doc.fontSize(9).fillColor("#666666").text("Tiếng Việt", { width: pageWidth });
          doc.fillColor("#000000");
          doc.fontSize(10).text(entry.content.vi.trim(), { width: pageWidth, align: "left" });
        }
        if (entry.content.en.trim()) {
          doc.moveDown(0.25);
          doc.fontSize(9).fillColor("#666666").text("English", { width: pageWidth });
          doc.fillColor("#000000");
          doc.fontSize(10).text(entry.content.en.trim(), { width: pageWidth, align: "left" });
        }
      } else {
        doc.moveDown(0.15);
        doc.fontSize(9).fillColor("#888888").text("(Chưa có nội dung CMS · No CMS content yet)", { width: pageWidth });
        doc.fillColor("#000000");
      }
      doc.moveDown(0.7);
    });

    ensurePdfSpace(doc, 24);
    doc.moveDown(0.5);
    doc.fontSize(9).text(
      `Tổng: ${exportData.entries.length} mục · ${exportData.entries.filter((e) => e.hasContent).length} có nội dung · ${exportData.missingCount} thiếu`,
      { width: pageWidth }
    );
    doc.text(
      `Total: ${exportData.entries.length} items · ${exportData.entries.filter((e) => e.hasContent).length} with content · ${exportData.missingCount} missing`,
      { width: pageWidth }
    );

    doc.end();
  });
}
