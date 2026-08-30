import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readExternalDocs } from "../../src/external-docs-loader";

describe("readExternalDocs", () => {
  it("loads an arbitrary root with nested documents, H1 title fallback, and und language", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "yom-astro-external-"));
    await mkdir(path.join(root, "guide"));
    await writeFile(path.join(root, "index.md"), "# Untitled document\n\nBody text.\n");
    await writeFile(
      path.join(root, "guide", "nested.md"),
      "---\ntitle: Frontmatter title\nlang: ja\n---\n\nNested body.\n"
    );

    const docs = await readExternalDocs(root);

    expect(docs).toMatchObject([
      {
        id: "guide/nested",
        title: "Frontmatter title",
        language: "ja",
        body: "\nNested body.\n"
      },
      {
        id: "index",
        title: "Untitled document",
        language: "und",
        body: "Body text.\n"
      }
    ]);
  });
});
