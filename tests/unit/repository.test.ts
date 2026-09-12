import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { DevContentRepository } from "../../src/dev/repository";
import { buildSiteSnapshot } from "../../src/core/sitepayload";
import { resolveConfig } from "../../src/core/config";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("DevContentRepository", () => {
  it("uses the same initial navigation order as static builds", async () => {
    const root = await createRoot();
    for (const file of ["z.md", "README.md", "guides/nested.md", "a.md"]) {
      await write(root, file, `# ${file}\n`);
    }
    const config = resolveConfig({});
    const dev = await new DevContentRepository(root, config).getSiteSnapshot();
    const built = await buildSiteSnapshot(root, { config, mode: "static" });
    expect(
      dev.documents.map(({ path, pagination }) => ({ path, pagination })),
    ).toEqual(
      built.documents.map(({ path, pagination }) => ({ path, pagination })),
    );
  });
  it("updates its cached paths from watcher events", async () => {
    const root = await createRoot();
    await write(root, "README.md", "# Initial\n");
    const repository = new DevContentRepository(root);

    await expect(repository.getDocument("README.md")).resolves.toMatchObject({
      raw: "# Initial\n",
    });

    await write(root, "guide.md", "# Guide\n");
    await expect(
      repository.apply({ kind: "document", action: "add", path: "guide.md" }),
    ).resolves.toBe(true);
    await expect(repository.getSnapshot()).resolves.toMatchObject({
      firstPath: "guide.md",
    });
    await expect(repository.getDocument("guide.md")).resolves.toMatchObject({
      raw: "# Guide\n",
    });

    await rm(path.join(root, "README.md"));
    await expect(
      repository.apply({
        kind: "document",
        action: "remove",
        path: "README.md",
      }),
    ).resolves.toBe(true);
    await expect(repository.getDocument("README.md")).rejects.toThrow(
      "missing markdown file",
    );
    await expect(repository.getSiteSnapshot()).resolves.toMatchObject({
      documents: [expect.objectContaining({ path: "guide.md" })],
    });
  });

  it("rejects newly added gitignored paths and reloads ignore changes", async () => {
    const root = await createRoot();
    initGit(root);
    await write(root, ".gitignore", "ignored.md\n");
    await write(root, "visible.md", "# Visible\n");
    const repository = new DevContentRepository(root);

    await write(root, "ignored.md", "# Ignored\n");
    await expect(
      repository.apply({
        kind: "document",
        action: "add",
        path: "ignored.md",
      }),
    ).resolves.toBe(false);

    await write(root, ".gitignore", "visible.md\n");
    await repository.reload();
    const snapshot = await repository.getSnapshot();
    expect(snapshot.tree.children).toEqual([
      expect.objectContaining({ name: "ignored.md" }),
    ]);
  });

  it("tracks opted-in ignored documents across add, change, remove, and ignore reload", async () => {
    const root = await createRoot();
    initGit(root);
    await write(root, ".gitignore", "generated/\n");
    const repository = new DevContentRepository(
      root,
      resolveConfig({ includeIgnored: ["generated/keep.md"] }),
    );

    await write(root, "generated/keep.md", "# First\n");
    await expect(
      repository.apply({
        kind: "document",
        action: "add",
        path: "generated/keep.md",
      }),
    ).resolves.toBe(true);
    await write(root, "generated/keep.md", "# Changed\n");
    await expect(
      repository.apply({
        kind: "document",
        action: "change",
        path: "generated/keep.md",
      }),
    ).resolves.toBe(true);
    await expect(
      repository.getDocument("generated/keep.md"),
    ).resolves.toMatchObject({ raw: "# Changed\n" });

    await write(root, ".gitignore", "generated/\nvisible.md\n");
    await repository.reload();
    await expect(
      repository.getDocument("generated/keep.md"),
    ).resolves.toMatchObject({ path: "generated/keep.md" });

    await rm(path.join(root, "generated/keep.md"));
    await expect(
      repository.apply({
        kind: "document",
        action: "remove",
        path: "generated/keep.md",
      }),
    ).resolves.toBe(true);
    await expect(repository.getDocument("generated/keep.md")).rejects.toThrow(
      "missing markdown file",
    );
  });

  it("does not serve documents excluded by configuration", async () => {
    const root = await createRoot();
    await write(root, "visible.md", "# Visible\n");
    await write(root, "draft.md", "# Draft\n");
    const repository = new DevContentRepository(root, {
      ...resolveConfig({}),
      exclude: ["draft.md"],
    });
    await expect(repository.getDocument("visible.md")).resolves.toMatchObject({
      path: "visible.md",
    });
    await expect(repository.getDocument("draft.md")).rejects.toThrow(
      "missing markdown file",
    );
  });

  it("searches titles and Markdown body text and invalidates changed content", async () => {
    const root = await createRoot();
    await write(
      root,
      "guide.md",
      "---\ntitle: Searchable guide\n---\nA distinctive phrase lives here.\n",
    );
    const repository = new DevContentRepository(root);
    await expect(repository.search("distinctive phrase")).resolves.toEqual([
      expect.objectContaining({ path: "guide.md", title: "Searchable guide" }),
    ]);

    await write(root, "guide.md", "# Guide\n\nReplacement content.\n");
    await repository.apply({
      kind: "document",
      action: "change",
      path: "guide.md",
    });
    await expect(repository.search("distinctive")).resolves.toEqual([]);
    await expect(repository.search("replacement")).resolves.toEqual([
      expect.objectContaining({ path: "guide.md" }),
    ]);
  });
});

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "yom-repository-"));
  roots.push(root);
  return root;
}

async function write(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

function initGit(root: string): void {
  const result = spawnSync("git", ["init", "--quiet"], { cwd: root });
  if (result.status !== 0) throw new Error("git init failed");
}
