import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { buildSiteIndex, scanMarkdownMtimes } from "../../src/core/scan";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("buildSiteIndex", () => {
  it("builds a markdown tree and picks the first markdown path", async () => {
    const root = createTempRoot();
    await write(root, "guide.md", "# Guide");
    await write(root, "notes/intro.md", "# Intro");
    await write(root, "notes/draft.txt", "skip");
    await write(root, ".hidden/secret.md", "# Secret");
    await write(root, "empty/ignored.txt", "skip");

    await expect(buildSiteIndex(root)).resolves.toEqual({
      root,
      firstPath: "notes/intro.md",
      tree: {
        name: path.basename(root),
        path: "",
        type: "directory",
        children: [
          {
            name: "notes",
            path: "notes",
            type: "directory",
            children: [
              {
                name: "intro.md",
                path: "notes/intro.md",
                type: "file",
                children: [],
              },
            ],
          },
          {
            name: "guide.md",
            path: "guide.md",
            type: "file",
            children: [],
          },
        ],
      },
    });
  });

  it("ignores gitignored markdown files by default", async () => {
    const root = createTempRoot();
    initGitRepo(root);
    await write(root, ".gitignore", "ignored/\nignored.md\n");
    await write(root, "visible.md", "# Visible");
    await write(root, "ignored.md", "# Ignored");
    await write(root, "ignored/nested.md", "# Nested");

    await expect(buildSiteIndex(root)).resolves.toEqual({
      root,
      firstPath: "visible.md",
      tree: {
        name: path.basename(root),
        path: "",
        type: "directory",
        children: [
          {
            name: "visible.md",
            path: "visible.md",
            type: "file",
            children: [],
          },
        ],
      },
    });
  });
});

describe("scanMarkdownMtimes", () => {
  it("ignores hidden paths", async () => {
    const root = createTempRoot();
    await write(root, "visible.md", "# Visible");
    await write(root, ".hidden/secret.md", "# Secret");

    await expect(scanMarkdownMtimes(root)).resolves.toMatchObject({
      "visible.md": expect.any(Array),
    });
    await expect(scanMarkdownMtimes(root)).resolves.not.toHaveProperty(
      ".hidden/secret.md",
    );
  });

  it("ignores gitignored markdown files", async () => {
    const root = createTempRoot();
    initGitRepo(root);
    await write(root, ".gitignore", "ignored.md\n");
    await write(root, "visible.md", "# Visible");
    await write(root, "ignored.md", "# Ignored");

    await expect(scanMarkdownMtimes(root)).resolves.toMatchObject({
      "visible.md": expect.any(Array),
    });
    await expect(scanMarkdownMtimes(root)).resolves.not.toHaveProperty(
      "ignored.md",
    );
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "yom-scan-"));
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

function initGitRepo(root: string): void {
  const result = spawnSync("git", ["init"], {
    cwd: root,
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(`git init failed: ${result.stderr}`);
  }
}
