import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveConfig } from "../../src/core/config";
import {
  buildSiteSnapshot,
  serializeSitePayload,
} from "../../src/core/sitepayload";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("buildSiteSnapshot", () => {
  it("builds serializable route, metadata, outline, and pagination payloads", async () => {
    const root = createTempRoot();
    await write(
      root,
      "guide/first.md",
      "---\ntitle: First page\ntags: [start, docs]\n---\n# Introduction\n\n## Details",
    );
    await write(root, "guide/second.md", "# Next page");

    const snapshot = await buildSiteSnapshot(root, {
      config: resolveConfig({ base: "/notes", lang: "und" }),
    });

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.lang).toBe("und");
    expect(snapshot.firstPath).toBe("guide/first.md");
    expect(snapshot.documents).toEqual([
      expect.objectContaining({
        path: "guide/first.md",
        route: "/notes/docs/guide/first.html",
        metadata: {
          title: "First page",
          lang: "und",
          frontMatter: { title: "First page", tags: ["start", "docs"] },
        },
        outline: [
          { id: "introduction", text: "Introduction", level: 1 },
          { id: "details", text: "Details", level: 2 },
        ],
        pagination: {
          previous: null,
          next: {
            path: "guide/second.md",
            route: "/notes/docs/guide/second.html",
            title: "Next page",
          },
        },
      }),
      expect.objectContaining({
        path: "guide/second.md",
        pagination: {
          previous: {
            path: "guide/first.md",
            route: "/notes/docs/guide/first.html",
            title: "First page",
          },
          next: null,
        },
      }),
    ]);
  });
});

describe("serializeSitePayload", () => {
  it("escapes script boundary and line separator characters", () => {
    const serialized = serializeSitePayload({ value: "</script>\u2028\u2029" });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u2028\\u2029");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "yom-sitepayload-"));
  tempRoots.push(root);
  return root;
}

async function write(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
