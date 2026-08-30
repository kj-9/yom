import path from "node:path";

import { assetRouteFromRelativePath } from "./routes.js";

export function rewriteRelativeLinks(
  content: string,
  options: {
    sourcePath: string;
    existingPaths: ReadonlySet<string>;
    mode?: "static" | "dev";
    basePath?: string;
    onMissingReference?: (value: string, tag: string) => void;
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
        mode: options.mode ?? "static",
        basePath: options.basePath ?? "/",
        onMissingReference: options.onMissingReference,
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
    existingPaths: ReadonlySet<string>;
    mode: "static" | "dev";
    basePath: string;
    onMissingReference?: (value: string, tag: string) => void;
  },
): string {
  if (!isLocalRelativeUrl(value)) {
    return value;
  }

  const { pathname, suffix } = splitUrlSuffix(value);
  const resolvedRelativePath = resolveRelativePath(
    options.sourcePath,
    pathname,
  );
  if (resolvedRelativePath === null) {
    options.onMissingReference?.(value, options.tag);
    return value;
  }

  if (!options.existingPaths.has(resolvedRelativePath)) {
    options.onMissingReference?.(value, options.tag);
    return value;
  }

  if (
    options.tag === "a" &&
    resolvedRelativePath.toLowerCase().endsWith(".md")
  ) {
    if (options.mode === "dev") {
      return appendUrlSuffix(`/?path=${resolvedRelativePath}`, suffix);
    }
    return appendUrlSuffix(
      `${options.basePath}?path=${resolvedRelativePath}`,
      suffix,
    );
  }

  if (options.mode === "dev") {
    return appendUrlSuffix(`/assets?path=${resolvedRelativePath}`, suffix);
  }
  return appendUrlSuffix(
    assetRouteFromRelativePath(resolvedRelativePath, options.basePath),
    suffix,
  );
}

function splitUrlSuffix(value: string): { pathname: string; suffix: string } {
  const suffixIndex = value.search(/[?#]/u);
  if (suffixIndex === -1) return { pathname: value, suffix: "" };
  return {
    pathname: value.slice(0, suffixIndex),
    suffix: value.slice(suffixIndex),
  };
}

function appendUrlSuffix(route: string, suffix: string): string {
  if (!suffix.startsWith("?")) return `${route}${suffix}`;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}${suffix.slice(1)}`;
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
