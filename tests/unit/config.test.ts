import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  loadYomConfig,
  matchesConfigPath,
  resolveConfig,
} from "../../src/core/config";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("yom config", () => {
  it("uses explicit defaults without inferring a language", () => {
    expect(resolveConfig({})).toMatchObject({
      title: "yom",
      lang: "und",
      basePath: "/",
      theme: "system",
      palette: "paper",
      fontSize: "medium",
      contentWidth: "comfortable",
      outline: true,
      outDir: "dist",
      open: false,
    });
  });

  it("loads a TypeScript config from the caller directory", async () => {
    const root = await createRoot();
    await writeFile(
      path.join(root, "yom.config.ts"),
      'export default { title: "Docs", lang: "ja", base: "/manual/", initialPage: "guide.md" };\n',
    );
    await expect(loadYomConfig({ cwd: root, root })).resolves.toMatchObject({
      title: "Docs",
      lang: "ja",
      basePath: "/manual/",
      initialPage: "guide.md",
      configPath: path.join(root, "yom.config.ts"),
    });
  });

  it("rejects unknown and invalid values", () => {
    expect(() => resolveConfig({ language: "ja" })).toThrow("unknown option");
    expect(() => resolveConfig({ lang: "Japanese" })).toThrow("language tag");
    expect(() => resolveConfig({ initialPage: "../outside.md" })).toThrow(
      "initialPage",
    );
    expect(() => resolveConfig({ fontSize: "huge" })).toThrow("fontSize");
    expect(() => resolveConfig({ contentWidth: "fluid" })).toThrow(
      "contentWidth",
    );
    expect(() => resolveConfig({ outline: "yes" })).toThrow("outline");
  });

  it("matches include and exclude globs", () => {
    const config = resolveConfig({
      include: ["docs/**/*.md", "README.md"],
      exclude: ["docs/drafts/**"],
    });
    expect(matchesConfigPath("README.md", config)).toBe(true);
    expect(matchesConfigPath("docs/guide.md", config)).toBe(true);
    expect(matchesConfigPath("docs/drafts/note.md", config)).toBe(false);
    expect(matchesConfigPath("other.md", config)).toBe(false);
  });
});

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "yom-config-"));
  roots.push(root);
  return root;
}
