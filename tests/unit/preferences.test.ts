import { describe, expect, it } from "vitest";
import {
  mergeReadingPreferences,
  readingDefaults,
  writeReadingPreferences,
} from "../../src/site/preferences";

describe("reading preferences persistence", () => {
  it("uses explicit site defaults while filling unspecified settings", () => {
    expect(
      readingDefaults({
        theme: "dark",
        palette: "forest",
        outline: false,
        fontSize: "large",
        contentWidth: "wide",
      }),
    ).toEqual({
      theme: "dark",
      palette: "forest",
      outline: false,
      fontSize: "large",
      contentWidth: "wide",
      sidebarWidth: 304,
    });
    expect(readingDefaults({ outline: undefined }).outline).toBe(true);
  });
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
