import path from "node:path";

import { assetRouteFromRelativePath, docRouteFromRelativePath } from "./routes";

export function rewriteRelativeLinks(
  content: string,
  options: {
    sourcePath: string;
    existingPaths: Set<string>;
  },
): string {
  const sourcePath = normalizeRelativePath(options.sourcePath);

  return content.replace(
    /<(a|img)\b([^>]*?)\s(href|src)="([^"]+)"([^>]*)>/giu,
    (
      fullMatch,
      tag: string,
      before: string,
      attr: string,
      value: string,
      after: string,
    ) => {
      const rewritten = rewritePath(value, {
        tag,
        sourcePath,
        existingPaths: options.existingPaths,
      });

      return `<${tag}${before} ${attr}="${escapeHtmlAttribute(rewritten)}"${after}>`;
    },
  );
}

export function isLocalRelativeUrl(value: string): boolean {
  const stripped = value.trim();
  if (
    stripped.length === 0 ||
    stripped.startsWith("#") ||
    stripped.startsWith("/") ||
    stripped.startsWith("http://") ||
    stripped.startsWith("https://") ||
    stripped.startsWith("mailto:") ||
    stripped.startsWith("data:")
  ) {
    return false;
  }

  return true;
}

function rewritePath(
  value: string,
  options: {
    tag: string;
    sourcePath: string;
    existingPaths: Set<string>;
  },
): string {
  if (!isLocalRelativeUrl(value)) {
    return value;
  }

  const resolvedRelativePath = resolveRelativePath(options.sourcePath, value);
  if (resolvedRelativePath === null) {
    return value;
  }

  if (!options.existingPaths.has(resolvedRelativePath)) {
    return value;
  }

  if (
    options.tag === "a" &&
    resolvedRelativePath.toLowerCase().endsWith(".md")
  ) {
    return docRouteFromRelativePath(resolvedRelativePath);
  }

  return assetRouteFromRelativePath(resolvedRelativePath);
}

function resolveRelativePath(
  sourcePath: string,
  targetPath: string,
): string | null {
  const sourceDirectory = path.posix.dirname(sourcePath);
  const resolved = path.posix.normalize(
    path.posix.join(sourceDirectory, targetPath),
  );

  if (resolved.startsWith("../") || resolved === "..") {
    return null;
  }

  const normalized = normalizeRelativePath(resolved);
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join(path.posix.sep).replace(/^\/+/u, "");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
