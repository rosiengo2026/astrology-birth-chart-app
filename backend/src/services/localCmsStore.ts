import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { MeaningCategory } from "../types";

interface LocalMeaning {
  _id: string;
  category: MeaningCategory;
  key: string;
  title: { en: string; vi: string };
  content: { en: string; vi: string };
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "cms-meanings.json");

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readAll(): Promise<LocalMeaning[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw) as LocalMeaning[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeAll(items: LocalMeaning[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export async function listLocalMeanings(filter?: {
  category?: string;
  keys?: string[];
}): Promise<LocalMeaning[]> {
  const items = await readAll();
  return items
    .filter((item) => {
      if (filter?.category && item.category !== filter.category) return false;
      if (filter?.keys?.length && !filter.keys.includes(item.key)) return false;
      return true;
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}

export async function createLocalMeaning(input: {
  category: MeaningCategory;
  key: string;
  title: { en: string; vi: string };
  content: { en: string; vi: string };
}): Promise<LocalMeaning> {
  const items = await readAll();
  const now = new Date().toISOString();
  const existingIndex = items.findIndex((item) => item.category === input.category && item.key === input.key);
  const record: LocalMeaning = {
    _id: existingIndex >= 0 ? items[existingIndex]._id : randomUUID(),
    category: input.category,
    key: input.key,
    title: input.title,
    content: input.content,
    createdAt: existingIndex >= 0 ? items[existingIndex].createdAt : now,
    updatedAt: now
  };

  if (existingIndex >= 0) {
    items[existingIndex] = record;
  } else {
    items.push(record);
  }
  await writeAll(items);
  return record;
}

export async function updateLocalMeaning(
  id: string,
  input: {
    category: MeaningCategory;
    key: string;
    title: { en: string; vi: string };
    content: { en: string; vi: string };
  }
): Promise<LocalMeaning | null> {
  const items = await readAll();
  const index = items.findIndex((item) => item._id === id);
  if (index < 0) return null;

  const updated: LocalMeaning = {
    ...items[index],
    ...input,
    updatedAt: new Date().toISOString()
  };
  items[index] = updated;
  await writeAll(items);
  return updated;
}

export async function deleteLocalMeaning(id: string): Promise<boolean> {
  const items = await readAll();
  const next = items.filter((item) => item._id !== id);
  if (next.length === items.length) return false;
  await writeAll(next);
  return true;
}

export async function replaceLocalMeanings(
  meanings: Array<{
    category: MeaningCategory;
    key: string;
    title: { en: string; vi: string };
    content: { en: string; vi: string };
  }>
): Promise<void> {
  const now = new Date().toISOString();
  const normalized: LocalMeaning[] = meanings.map((item) => ({
    _id: randomUUID(),
    ...item,
    createdAt: now,
    updatedAt: now
  }));
  await writeAll(normalized);
}
