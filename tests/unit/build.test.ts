import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildStaticSite } from "../../src/cli/build";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("buildStaticSite", () => {
  it("writes docs pages, assets, and index redirect", async () => {
    const root = createTempRoot();
    const outDir = path.join(root, ".out");

    await write(
      root,
      "guide.md",
      "# Guide\n\n[Read more](docs/page.md)\n\n![img](images/map.png)",
    );
    await write(root, "docs/page.md", "# Page");
    await write(root, "images/map.png", "png");

    await buildStaticSite({ root, outDir });

    await expect(
      readFile(path.join(outDir, "docs/guide.html"), "utf-8"),
    ).resolves.toContain('href="/docs/docs/page.html"');
    await expect(
      readFile(path.join(outDir, "docs/guide.html"), "utf-8"),
    ).resolves.toContain(
      'class="tree-link" href="/docs/guide.html" data-active="true"',
    );
    await expect(
      readFile(path.join(outDir, "docs/guide.html"), "utf-8"),
    ).resolves.toContain('src="/assets/images/map.png"');
    await expect(
      readFile(path.join(outDir, "docs/docs/page.html"), "utf-8"),
    ).resolves.toContain("<h1>Page</h1>");
    await expect(
      readFile(path.join(outDir, "assets/images/map.png"), "utf-8"),
    ).resolves.toBe("png");
    await expect(
      readFile(path.join(outDir, "index.html"), "utf-8"),
    ).resolves.toContain("/docs/docs/page.html");
  });
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
