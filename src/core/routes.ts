export function normalizeBasePath(basePath = "/"): string {
  const trimmed = toPosixPath(basePath.trim());
  if (trimmed.includes("?") || trimmed.includes("#")) {
    throw new Error("invalid base path");
  }
  const withLeadingSlash = `/${trimmed.replace(/^\/+|\/+$/gu, "")}`;
  return withLeadingSlash === "/" ? "/" : `${withLeadingSlash}/`;
}

export function docRouteFromRelativePath(
  relativePath: string,
  basePath = "/",
): string {
  const normalized = toPosixPath(relativePath).replace(/^\//u, "");
  const withoutExtension = normalized.replace(/\.md$/iu, "");
  return `${normalizeBasePath(basePath)}docs/${withoutExtension}.html`;
}

export function dataRouteFromRelativePath(
  relativePath: string,
  basePath = "/",
): string {
  return `${normalizeBasePath(basePath)}data/${toPosixPath(relativePath).replace(/^\//u, "")}.json`;
}

export function assetRouteFromRelativePath(
  relativePath: string,
  basePath = "/",
): string {
  return `${normalizeBasePath(basePath)}assets/${toPosixPath(relativePath).replace(/^\//u, "")}`;
}

export function relativePathFromDocRoute(
  route: string,
  basePath = "/",
): string | null {
  const normalized = toPosixPath(route).trim();
  const docsPrefix = `${normalizeBasePath(basePath)}docs/`;
  if (!normalized.startsWith(docsPrefix) || !normalized.endsWith(".html")) {
    return null;
  }

  return normalized.slice(docsPrefix.length).replace(/\.html$/u, ".md");
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}
