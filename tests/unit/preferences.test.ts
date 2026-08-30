import { describe, expect, it } from "vitest";
import {
  mergeReadingPreferences,
  writeReadingPreferences,
} from "../../src/site/preferences";

describe("reading preferences persistence", () => {
  it("round-trips supported settings without a browser", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    } as Storage;
    writeReadingPreferences(storage, {
      theme: "dark",
      outline: false,
      sidebarWidth: 420,
    });
    expect(mergeReadingPreferences(storage)).toMatchObject({
      theme: "dark",
      outline: false,
      sidebarWidth: 420,
    });
  });
});
