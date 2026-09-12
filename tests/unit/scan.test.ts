import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSiteIndex,
  listAssetFiles,
  listExistingPaths,
} from "../../src/core/scan";

const tempRoots: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("opts specific ignored descendants in while exclude still wins", async () => {
    const root = createTempRoot();
    initGitRepo(root);
    await write(root, ".gitignore", "generated/\n");
    await write(root, "visible.md", "# Visible");
    await write(root, "generated/keep.md", "# Keep");
    await write(root, "generated/drop.md", "# Drop");
    await write(root, "generated/image.png", "png");
    await write(root, "generated/private/secret.md", "# Secret");

    const options = {
      include: ["**/*.md"],
      includeIgnored: ["generated/keep.md", "generated/image.png"],
      exclude: ["generated/private/**", "generated/image.png"],
      initialPage: null,
      order: [],
    };
    await expect(listExistingPaths(root, options)).resolves.toEqual(
      new Set(["generated/keep.md", "visible.md"]),
    );
    await expect(listAssetFiles(root, options)).resolves.toEqual([]);
    await expect(buildSiteIndex(root, options)).resolves.toMatchObject({
      firstPath: "generated/keep.md",
    });
  });

  it("handles nested ignore rules and a large ignored entry set in bounded batches", async () => {
    const root = createTempRoot();
    initGitRepo(root);
    await write(root, ".gitignore", "ignored-*.md\nnested/*.md\n");
    await write(root, "visible.md", "# Visible");
    await write(root, "nested/ignored.md", "# Ignored");
    await write(root, "nested/visible.txt", "visible");
    await Promise.all(
      Array.from({ length: 5_500 }, (_, index) =>
        write(
          root,
          `ignored-${index.toString().padStart(4, "0")}-${"x".repeat(180)}.md`,
          "# Ignored",
        ),
      ),
    );

    await expect(listExistingPaths(root)).resolves.toEqual(
      new Set(["nested/visible.txt", "visible.md"]),
    );
  }, 20_000);

  it("reports git ignore command failures with the scanned root", async () => {
    const root = createTempRoot();
    initGitRepo(root);
    await write(root, "visible.md", "# Visible");
    vi.stubEnv("PATH", "");

    await expect(listExistingPaths(root)).rejects.toThrow(
      `failed to evaluate .gitignore for ${root}`,
    );
  });

  it("applies configured filters, initial page, and order", async () => {
    const root = createTempRoot();
    await write(root, "README.md", "# Readme");
    await write(root, "guide.md", "# Guide");
    await write(root, "draft.md", "# Draft");

    const snapshot = await buildSiteIndex(root, {
      include: ["*.md"],
      exclude: ["draft.md"],
      initialPage: "README.md",
      order: ["README.md", "guide.md"],
    });
    expect(snapshot.firstPath).toBe("README.md");
    expect(snapshot.tree.children.map((child) => child.name)).toEqual([
      "README.md",
      "guide.md",
    ]);
  });

  it("rejects an initial page excluded from the tree", async () => {
    const root = createTempRoot();
    await write(root, "README.md", "# Readme");
    await expect(
      buildSiteIndex(root, {
        include: ["*.md"],
        exclude: ["README.md"],
        initialPage: "README.md",
        order: [],
      }),
    ).rejects.toThrow("initialPage not found");
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
