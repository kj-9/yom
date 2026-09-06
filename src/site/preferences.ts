import { defaultReadingPreferences, type ReadingPreferences } from "./state.js";

const keys: Array<keyof ReadingPreferences> = [
  "theme",
  "palette",
  "fontSize",
  "contentWidth",
  "outline",
  "sidebarWidth",
];

export function readingDefaults(
  config: Partial<ReadingPreferences>,
): ReadingPreferences {
  return Object.fromEntries(
    keys.map((key) => [key, config[key] ?? defaultReadingPreferences[key]]),
  ) as ReadingPreferences;
}

export function readReadingPreferences(
  storage: Storage | undefined,
): Partial<ReadingPreferences> {
  if (storage === undefined) return {};
  const values: Partial<ReadingPreferences> = {};
  for (const key of keys) {
    const raw = storage.getItem(
      `yom-${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`,
    );
    if (raw === null) continue;
    if (key === "outline") {
      if (raw === "true" || raw === "false") values.outline = raw === "true";
    } else if (key === "sidebarWidth") {
      const width = Number(raw);
      if (Number.isFinite(width)) values.sidebarWidth = width;
    } else if (raw.length > 0) {
      values[key] = raw as never;
    }
  }
  return values;
}

export function writeReadingPreferences(
  storage: Storage | undefined,
  patch: Partial<ReadingPreferences>,
): void {
  if (storage === undefined) return;
  for (const [key, value] of Object.entries(patch) as Array<
    [keyof ReadingPreferences, ReadingPreferences[keyof ReadingPreferences]]
  >) {
    const storageKey = `yom-${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
    storage.setItem(storageKey, String(value));
  }
}

export function mergeReadingPreferences(
  storage: Storage | undefined,
): ReadingPreferences {
  return { ...defaultReadingPreferences, ...readReadingPreferences(storage) };
}
