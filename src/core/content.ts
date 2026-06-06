import { readFile } from "node:fs/promises";
import path from "node:path";

import { rewriteRelativeLinks } from "./links";
import { renderMarkdown } from "./markdown";
import { buildSiteIndex, listExistingPaths } from "./scan";

export type DocumentPayload = {
  path: string;
  raw: string;
  html: string;
};

export async function loadSiteSnapshot(root: string) {
  return buildSiteIndex(root);
}

export async function loadDocument(
  root: string,
  relativePath: string,
  options?: { mode?: "static" | "dev" },
): Promise<DocumentPayload> {
  const resolvedRoot = path.resolve(root);
  const normalizedPath = normalizeMarkdownPath(relativePath);
  const sourcePath = path.join(resolvedRoot, normalizedPath);
  const existingPaths = await listExistingPaths(resolvedRoot);

  if (!existingPaths.has(normalizedPath)) {
    throw new Error("missing markdown file");
  }

  const raw = await readFile(sourcePath, "utf-8");
  return {
    path: normalizedPath,
    raw,
    html: rewriteRelativeLinks(renderMarkdown(raw), {
      sourcePath: normalizedPath,
      existingPaths,
      mode: options?.mode ?? "static",
    }),
  };
}

export async function resolveAssetPath(
  root: string,
  relativePath: string,
): Promise<string> {
  const resolvedRoot = path.resolve(root);
  const normalizedPath = normalizeRelativePath(relativePath);
  const existingPaths = await listExistingPaths(resolvedRoot);

  if (
    !existingPaths.has(normalizedPath) ||
    normalizedPath.toLowerCase().endsWith(".md")
  ) {
    throw new Error("missing asset file");
  }

  return path.join(resolvedRoot, normalizedPath);
}

function normalizeMarkdownPath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized.toLowerCase().endsWith(".md")) {
    throw new Error("invalid markdown path");
  }
  return normalized;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = path.posix.normalize(
    relativePath.trim().replaceAll("\\", "/"),
  );
  if (
    normalized.length === 0 ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    normalized.startsWith("/")
  ) {
    throw new Error("invalid path");
  }
  return normalized;
}
