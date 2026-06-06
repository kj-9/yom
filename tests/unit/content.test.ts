import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadDocument, resolveAssetPath } from "../../src/core/content";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("loadDocument", () => {
  it("renders markdown and rewrites local references", async () => {
    const root = createTempRoot();
    await write(
      root,
      "docs/page.md",
      "# Page\n\n[Guide](../guide.md)\n\n![img](image.png)",
    );
    await write(root, "guide.md", "# Guide");
    await write(root, "docs/image.png", "png");

    await expect(loadDocument(root, "docs/page.md")).resolves.toMatchObject({
      path: "docs/page.md",
      raw: expect.stringContaining("# Page"),
      html: expect.stringContaining('href="/docs/guide.html"'),
    });
    await expect(loadDocument(root, "docs/page.md")).resolves.toMatchObject({
      html: expect.stringContaining('src="/assets/docs/image.png"'),
    });
  });
});

describe("resolveAssetPath", () => {
  it("resolves non-markdown files inside root", async () => {
    const root = createTempRoot();
    await write(root, "docs/image.png", "png");

    const assetPath = await resolveAssetPath(root, "docs/image.png");
    await expect(readFile(assetPath, "utf-8")).resolves.toBe("png");
  });

  it("rejects markdown and outside paths", async () => {
    const root = createTempRoot();
    await write(root, "docs/page.md", "# Page");

    await expect(resolveAssetPath(root, "docs/page.md")).rejects.toThrow();
    await expect(resolveAssetPath(root, "../secret.png")).rejects.toThrow();
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "yom-content-"));
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
