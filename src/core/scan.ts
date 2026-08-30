import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { matchesConfigPath, type ResolvedYomConfig } from "./config.js";

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

export type SiteIndexOptions = Pick<
  ResolvedYomConfig,
  "include" | "exclude" | "initialPage" | "order"
>;

export async function buildSiteIndex(
  root: string,
  options?: SiteIndexOptions,
): Promise<SiteIndexSnapshot> {
  const resolvedRoot = path.resolve(root);
  const existingPaths = await listExistingPaths(resolvedRoot);
  return buildSiteIndexFromPaths(resolvedRoot, existingPaths, options);
}

export function buildSiteIndexFromPaths(
  root: string,
  existingPaths: Iterable<string>,
  options?: SiteIndexOptions,
): SiteIndexSnapshot {
  const resolvedRoot = path.resolve(root);
  const tree: TreeNode = {
    name: path.basename(resolvedRoot),
    path: "",
    type: "directory",
    children: [],
  };

  for (const markdownPath of existingPaths) {
    if (path.posix.extname(markdownPath).toLowerCase() !== ".md") {
      continue;
    }
    if (options && !matchesConfigPath(markdownPath, options)) continue;
    addMarkdownPath(tree, markdownPath);
  }
  sortTree(tree, options?.order ?? []);
  const discoveredFirstPath = findFirstPath(tree);
  const firstPath = options?.initialPage ?? discoveredFirstPath;
  if (options?.initialPage && !treeContainsPath(tree, options.initialPage)) {
    throw new Error(
      `invalid yom config: initialPage not found: ${options.initialPage}`,
    );
  }

  return {
    root: resolvedRoot,
    firstPath,
    tree,
  };
}

function addMarkdownPath(tree: TreeNode, markdownPath: string): void {
  const parts = markdownPath.split("/").filter(Boolean);
  let parent = tree;
  for (const [index, name] of parts.entries()) {
    const nodePath = parts.slice(0, index + 1).join("/");
    if (index === parts.length - 1) {
      parent.children.push({
        name,
        path: nodePath,
        type: "file",
        children: [],
      });
      return;
    }
    let directory = parent.children.find(
      (child) => child.type === "directory" && child.name === name,
    );
    if (directory === undefined) {
      directory = {
        name,
        path: nodePath,
        type: "directory",
        children: [],
      };
      parent.children.push(directory);
    }
    parent = directory;
  }
}

function sortTree(node: TreeNode, order: string[]): void {
  node.children.sort((left, right) => {
    const leftOrder = configuredOrder(left, order);
    const rightOrder = configuredOrder(right, order);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
  });
  for (const child of node.children) {
    if (child.type === "directory") sortTree(child, order);
  }
}

function configuredOrder(node: TreeNode, order: string[]): number {
  const index = order.findIndex(
    (value) => value === node.path || value === node.name,
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function treeContainsPath(node: TreeNode, targetPath: string): boolean {
  if (node.type === "file") return node.path === targetPath;
  return node.children.some((child) => treeContainsPath(child, targetPath));
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

export function isGitIgnored(root: string, relativePath: string): boolean {
  const result = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--", relativePath],
    {
      cwd: path.resolve(root),
      encoding: "utf-8",
    },
  );
  return result.status === 0;
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
