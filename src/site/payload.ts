import type { SiteSnapshot } from "../core/sitepayload.js";

export type ClientPayload = {
  mode?: "dev" | "static";
  title?: string;
  snapshot?: SiteSnapshot;
  documentPath?: string | null;
  notFound?: boolean;
};

export function parseClientPayload(
  text: string | null | undefined,
): ClientPayload {
  if (text === null || text === undefined) return {};
  try {
    return JSON.parse(text) as ClientPayload;
  } catch {
    return {};
  }
}

export function documentFromPayload(payload: ClientPayload) {
  if (payload.snapshot === undefined) return null;
  return (
    payload.snapshot.documents.find(
      (candidate) => candidate.path === payload.documentPath,
    ) ?? null
  );
}

export function documentFromLocation(snapshot: SiteSnapshot, pathname: string) {
  const basePath = snapshot.basePath.endsWith("/")
    ? snapshot.basePath
    : `${snapshot.basePath}/`;
  if (pathname === basePath && snapshot.firstPath !== null) {
    return (
      snapshot.documents.find(
        (candidate) => candidate.path === snapshot.firstPath,
      ) ?? null
    );
  }
  return (
    snapshot.documents.find(
      (candidate) =>
        new URL(candidate.route, "http://yom.local").pathname === pathname,
    ) ?? null
  );
}
