import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildStaticSite } from "../../src/cli/build";
import { resolveConfig } from "../../src/core/config";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("buildStaticSite", () => {
  it("writes the shared app, document data, routes, and assets", async () => {
    const root = createTempRoot();
    const outDir = path.join(root, ".out");

    await write(
      root,
      "guide.md",
      "# Guide\n\n[Read more](docs/page.md#page)\n\n[Missing](missing.md)\n\n![img](images/map.png)",
    );
    await write(root, "docs/page.md", "# Page");
    await write(root, "images/map.png", "png");

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await buildStaticSite({
      root,
      outDir,
      basePath: "/project/",
      config: resolveConfig({
        title: "Project docs",
        lang: "ja",
        theme: "dark",
        palette: "forest",
      }),
    });

    await expect(
      readFile(path.join(outDir, "docs/guide.html"), "utf-8"),
    ).resolves.toContain('<html lang="ja">');
    await expect(
      readFile(path.join(outDir, "docs/guide.html"), "utf-8"),
    ).resolves.toContain('"initialPath":"guide.md"');
    await expect(
      readFile(path.join(outDir, "docs/guide.html"), "utf-8"),
    ).resolves.toContain("<title>Project docs</title>");
    const guidePayload = JSON.parse(
      await readFile(path.join(outDir, "data/guide.md.json"), "utf-8"),
    ) as { html: string };
    expect(guidePayload.html).toContain(
      'href="/project/?path=docs/page.md#page"',
    );
    expect(guidePayload.html).toContain('src="/project/assets/images/map.png"');
    const pagePayload = JSON.parse(
      await readFile(path.join(outDir, "data/docs/page.md.json"), "utf-8"),
    ) as { html: string };
    expect(pagePayload.html).toContain('<h1 id="page">Page</h1>');
    const searchIndex = JSON.parse(
      await readFile(path.join(outDir, "search.json"), "utf-8"),
    ) as Array<{ path: string; title: string }>;
    expect(searchIndex).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "guide.md", title: "Guide" }),
      ]),
    );
    const tree = JSON.parse(
      await readFile(path.join(outDir, "tree.json"), "utf-8"),
    ) as { root: string };
    expect(tree.root).toBe(".");
    await expect(
      readFile(path.join(outDir, "assets/images/map.png"), "utf-8"),
    ).resolves.toBe("png");
    await expect(
      readFile(path.join(outDir, "index.html"), "utf-8"),
    ).resolves.toContain('<html lang="ja">');
    await expect(
      readFile(path.join(outDir, "index.html"), "utf-8"),
    ).resolves.toContain('"initialPath":"docs/page.md"');
    await expect(
      readFile(path.join(outDir, "index.html"), "utf-8"),
    ).resolves.toMatch(/src="\/project\/_yom\/index-[^"]+\.js"/u);
    await expect(
      readFile(path.join(outDir, "404.html"), "utf-8"),
    ).resolves.toContain('"notFound":true');
    expect(result.warnings).toEqual([
      "guide.md: unresolved reference missing.md",
    ]);
    expect(warn).toHaveBeenCalledWith(
      "[yom] guide.md: unresolved reference missing.md",
    );
    warn.mockRestore();
  }, 15_000);
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "yom-build-"));
  tempRoots.push(root);
  return root;
}

async function write(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf-8");
}
