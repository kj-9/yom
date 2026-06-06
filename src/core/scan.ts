import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type TreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children: TreeNode[];
};

export type SiteIndexSnapshot = {
  root: string;
  firstPath: string | null;
  tree: TreeNode;
};

export async function buildSiteIndex(root: string): Promise<SiteIndexSnapshot> {
  const resolvedRoot = path.resolve(root);
  const ignoredPaths = await gitignoredPaths(resolvedRoot);
  const tree = await buildTree(resolvedRoot, resolvedRoot, ignoredPaths);

  return {
    root: resolvedRoot,
    firstPath: findFirstPath(tree),
    tree,
  };
}

async function buildTree(
  current: string,
  base: string,
  ignoredPaths: Set<string>,
): Promise<TreeNode> {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => {
    if (left.isFile() !== right.isFile()) {
      return left.isFile() ? 1 : -1;
    }

    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });

  const children: TreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    const relativePath = toPosixPath(path.relative(base, absolutePath));

    if (ignoredPaths.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      const subtree = await buildTree(absolutePath, base, ignoredPaths);
      if (subtree.children.length > 0) {
        children.push(subtree);
      }
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      children.push({
        name: entry.name,
        path: relativePath,
        type: "file",
        children: [],
      });
    }
  }

  return {
    name: path.basename(current),
    path: current === base ? "" : toPosixPath(path.relative(base, current)),
    type: "directory",
    children,
  };
}

function findFirstPath(node: TreeNode): string | null {
  for (const child of node.children) {
    if (child.type === "file") {
      return child.path;
    }

    const nested = findFirstPath(child);
    if (nested !== null) {
      return nested;
    }
  }

  return null;
}

async function gitignoredPaths(root: string): Promise<Set<string>> {
  const candidates = await collectCandidates(root, root);
  if (candidates.length === 0) {
    return new Set();
  }

  const result = spawnSync("git", ["check-ignore", "--stdin"], {
    cwd: root,
    input: `${candidates.join("\n")}\n`,
    encoding: "utf-8",
  });

  if (result.error !== undefined) {
    return new Set();
  }

  if (![0, 1].includes(result.status ?? 1)) {
    return new Set();
  }

  return new Set(
    result.stdout
      .split(/\r?\n/u)
      .map((line) => line.trim().replace(/\/$/u, ""))
      .filter((line) => line.length > 0),
  );
}

async function collectCandidates(
  current: string,
  base: string,
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const candidates: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    const relativePath = toPosixPath(path.relative(base, absolutePath));
    candidates.push(relativePath);

    if (entry.isDirectory()) {
      candidates.push(...(await collectCandidates(absolutePath, base)));
    }
  }

  return candidates;
}

export async function scanMarkdownMtimes(
  root: string,
): Promise<Record<string, [number, number]>> {
  const resolvedRoot = path.resolve(root);
  const ignoredPaths = await gitignoredPaths(resolvedRoot);
  const snapshot: Record<string, [number, number]> = {};

  for (const relativePath of await collectMarkdownFiles(
    resolvedRoot,
    resolvedRoot,
  )) {
    if (ignoredPaths.has(relativePath)) {
      continue;
    }

    const absolutePath = path.join(resolvedRoot, relativePath);
    const fileStat = await stat(absolutePath);
    snapshot[relativePath] = [fileStat.mtimeMs, fileStat.size];
  }

  return snapshot;
}

export async function listExistingPaths(root: string): Promise<Set<string>> {
  const resolvedRoot = path.resolve(root);
  const ignoredPaths = await gitignoredPaths(resolvedRoot);
  const collected = await collectExistingPaths(
    resolvedRoot,
    resolvedRoot,
    ignoredPaths,
  );
  return new Set(collected);
}

export async function listAssetFiles(root: string): Promise<string[]> {
  const resolvedRoot = path.resolve(root);
  const ignoredPaths = await gitignoredPaths(resolvedRoot);
  return collectAssetFiles(resolvedRoot, resolvedRoot, ignoredPaths);
}

async function collectMarkdownFiles(
  current: string,
  base: string,
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await collectMarkdownFiles(absolutePath, base)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".md") {
      collected.push(toPosixPath(path.relative(base, absolutePath)));
    }
  }

  collected.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
  return collected;
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

async function collectExistingPaths(
  current: string,
  base: string,
  ignoredPaths: Set<string>,
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    const relativePath = toPosixPath(path.relative(base, absolutePath));
    if (ignoredPaths.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collected.push(
        ...(await collectExistingPaths(absolutePath, base, ignoredPaths)),
      );
      continue;
    }

    if (entry.isFile()) {
      collected.push(relativePath);
    }
  }

  return collected;
}

async function collectAssetFiles(
  current: string,
  base: string,
  ignoredPaths: Set<string>,
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(current, entry.name);
    const relativePath = toPosixPath(path.relative(base, absolutePath));
    if (ignoredPaths.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      collected.push(
        ...(await collectAssetFiles(absolutePath, base, ignoredPaths)),
      );
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() !== ".md") {
      collected.push(relativePath);
    }
  }

  collected.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
  return collected;
}
