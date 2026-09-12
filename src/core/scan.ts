import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  matchesConfigPath,
  matchesGlobPath,
  type ResolvedYomConfig,
} from "./config.js";

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
> &
  Partial<Pick<ResolvedYomConfig, "includeIgnored">>;

type DiscoveryOptions = Partial<
  Pick<ResolvedYomConfig, "includeIgnored" | "exclude">
>;

const GIT_IGNORE_BATCH_BYTES = 128 * 1024;

export async function buildSiteIndex(
  root: string,
  options?: SiteIndexOptions,
): Promise<SiteIndexSnapshot> {
  const resolvedRoot = path.resolve(root);
  const existingPaths = await listExistingPaths(resolvedRoot, options);
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

export function isGitIgnored(
  root: string,
  relativePath: string,
  options: DiscoveryOptions = {},
): boolean {
  if (isIncludedIgnored(relativePath, options.includeIgnored ?? [])) {
    return false;
  }
  const result = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--", relativePath],
    {
      cwd: path.resolve(root),
      encoding: "utf-8",
    },
  );
  if (result.error !== undefined)
    throw gitIgnoreError(root, result.error.message);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  if (result.status === 128 && !isGitWorkTree(path.resolve(root))) return false;
  throw gitIgnoreError(root, result.stderr);
}

export async function listExistingPaths(
  root: string,
  options: DiscoveryOptions = {},
): Promise<Set<string>> {
  const resolvedRoot = path.resolve(root);
  const gitManaged = isGitWorkTree(resolvedRoot);
  const collected = await collectExistingPaths(resolvedRoot, resolvedRoot, {
    gitManaged,
    includeIgnored: options.includeIgnored ?? [],
    exclude: options.exclude ?? [],
  });
  return new Set(collected);
}

export async function listAssetFiles(
  root: string,
  options: DiscoveryOptions = {},
): Promise<string[]> {
  const existingPaths = await listExistingPaths(root, options);
  return [...existingPaths]
    .filter(
      (relativePath) =>
        path.posix.extname(relativePath).toLowerCase() !== ".md",
    )
    .sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: "base" }),
    );
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

async function collectExistingPaths(
  current: string,
  base: string,
  options: {
    gitManaged: boolean;
    includeIgnored: string[];
    exclude: string[];
  },
): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const collected: string[] = [];
  const visibleEntries = entries.filter((entry) => !entry.name.startsWith("."));
  const relativePaths = visibleEntries.map((entry) =>
    toPosixPath(path.relative(base, path.join(current, entry.name))),
  );
  const ignoredPaths = options.gitManaged
    ? checkIgnoredPaths(base, relativePaths)
    : new Set<string>();

  for (const [index, entry] of visibleEntries.entries()) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = relativePaths[index];
    const ignored = ignoredPaths.has(relativePath);
    const optedIn = isIncludedIgnored(relativePath, options.includeIgnored);
    const excluded = options.exclude.some((pattern) =>
      matchesGlobPath(relativePath, pattern),
    );

    if (entry.isDirectory()) {
      if (
        excluded ||
        (ignored &&
          !optedIn &&
          !couldContainIncludedIgnored(relativePath, options.includeIgnored))
      ) {
        continue;
      }
      collected.push(
        ...(await collectExistingPaths(absolutePath, base, options)),
      );
      continue;
    }

    if (entry.isFile() && !excluded && (!ignored || optedIn)) {
      collected.push(relativePath);
    }
  }

  return collected;
}

function isGitWorkTree(root: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: root,
    encoding: "utf-8",
  });
  if (result.error !== undefined)
    throw gitIgnoreError(root, result.error.message);
  return result.status === 0 && result.stdout.trim() === "true";
}

function checkIgnoredPaths(root: string, relativePaths: string[]): Set<string> {
  const ignored = new Set<string>();
  for (const batch of batchPaths(relativePaths)) {
    const result = spawnSync("git", ["check-ignore", "--stdin", "-z"], {
      cwd: root,
      input: `${batch.join("\0")}\0`,
      encoding: "utf-8",
      maxBuffer: GIT_IGNORE_BATCH_BYTES * 2,
    });
    if (result.error !== undefined)
      throw gitIgnoreError(root, result.error.message);
    if (![0, 1].includes(result.status ?? -1)) {
      throw gitIgnoreError(root, result.stderr);
    }
    for (const value of result.stdout.split("\0")) {
      if (value.length > 0) ignored.add(value.replace(/\/$/u, ""));
    }
  }
  return ignored;
}

function batchPaths(relativePaths: string[]): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let bytes = 0;
  for (const relativePath of relativePaths) {
    const nextBytes = Buffer.byteLength(relativePath, "utf-8") + 1;
    if (batch.length > 0 && bytes + nextBytes > GIT_IGNORE_BATCH_BYTES) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(relativePath);
    bytes += nextBytes;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function isIncludedIgnored(relativePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlobPath(relativePath, pattern));
}

function couldContainIncludedIgnored(
  directoryPath: string,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => {
    const wildcardIndex = pattern.search(/[*?]/u);
    if (wildcardIndex === -1) {
      return (
        pattern === directoryPath || pattern.startsWith(`${directoryPath}/`)
      );
    }
    const fixed = pattern.slice(0, wildcardIndex);
    const lastSlash = fixed.lastIndexOf("/");
    const fixedDirectory = (
      fixed.endsWith("/") ? fixed.slice(0, -1) : fixed.slice(0, lastSlash)
    ).replace(/\/$/u, "");
    return (
      fixedDirectory.length === 0 ||
      fixedDirectory === directoryPath ||
      fixedDirectory.startsWith(`${directoryPath}/`) ||
      directoryPath.startsWith(`${fixedDirectory}/`)
    );
  });
}

function gitIgnoreError(root: string, detail: string): Error {
  const suffix = detail.trim();
  return new Error(
    `failed to evaluate .gitignore for ${path.resolve(root)}${suffix ? `: ${suffix}` : ""}`,
  );
}
