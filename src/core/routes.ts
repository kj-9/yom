export function docRouteFromRelativePath(relativePath: string): string {
  const normalized = toPosixPath(relativePath).replace(/^\//u, "");
  const withoutExtension = normalized.replace(/\.md$/iu, "");
  return `/docs/${withoutExtension}.html`;
}

export function assetRouteFromRelativePath(relativePath: string): string {
  return `/assets/${toPosixPath(relativePath).replace(/^\//u, "")}`;
}

export function relativePathFromDocRoute(route: string): string | null {
  const normalized = toPosixPath(route).trim();
  if (!normalized.startsWith("/docs/") || !normalized.endsWith(".html")) {
    return null;
  }

  return normalized.replace(/^\/docs\//u, "").replace(/\.html$/u, ".md");
}

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}
