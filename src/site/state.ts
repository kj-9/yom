import type { SiteSnapshot } from "../core/sitepayload.js";

export type ViewMode = "rendered" | "raw";

export type ReadingPreferences = {
  theme: "system" | "light" | "dark";
  palette: "paper" | "forest" | "sea";
  fontSize: "small" | "medium" | "large";
  contentWidth: "compact" | "comfortable" | "wide";
  outline: boolean;
  sidebarWidth: number;
};

export type SiteState = {
  snapshot: SiteSnapshot;
  currentPath: string | null;
  viewMode: ViewMode;
  collapsedPaths: ReadonlySet<string>;
  preferences: ReadingPreferences;
};

export type SiteAction =
  | {
      type: "snapshot-received";
      snapshot: SiteSnapshot;
      currentPath?: string | null;
    }
  | {
      type: "dev-event";
      event: {
        action: "add" | "change" | "remove";
        path: string;
        kind: "document" | "asset";
      };
      snapshot?: SiteSnapshot;
      currentPath?: string | null;
    }
  | { type: "navigate"; path: string }
  | { type: "set-view-mode"; viewMode: ViewMode }
  | { type: "toggle-directory"; path: string }
  | { type: "set-preferences"; preferences: Partial<ReadingPreferences> };

export const defaultReadingPreferences: ReadingPreferences = {
  theme: "system",
  palette: "paper",
  fontSize: "medium",
  contentWidth: "comfortable",
  outline: true,
  sidebarWidth: 304,
};

export function createSiteState(
  snapshot: SiteSnapshot,
  options: {
    currentPath?: string | null;
    preferences?: Partial<ReadingPreferences>;
  } = {},
): SiteState {
  return {
    snapshot,
    currentPath: selectedPath(snapshot, options.currentPath),
    viewMode: "rendered",
    collapsedPaths: new Set(),
    preferences: { ...defaultReadingPreferences, ...options.preferences },
  };
}

export function siteReducer(state: SiteState, action: SiteAction): SiteState {
  switch (action.type) {
    case "dev-event":
      return action.snapshot === undefined
        ? state
        : siteReducer(state, {
            type: "snapshot-received",
            snapshot: action.snapshot,
            currentPath: action.currentPath,
          });
    case "snapshot-received": {
      const currentPath = selectedPath(
        action.snapshot,
        action.currentPath ?? state.currentPath,
      );
      if (
        siteSnapshotsEqual(state.snapshot, action.snapshot) &&
        currentPath === state.currentPath
      ) {
        return state;
      }
      return {
        ...state,
        snapshot: action.snapshot,
        currentPath,
      };
    }
    case "navigate":
      if (
        action.path === state.currentPath ||
        !hasDocument(state.snapshot, action.path)
      ) {
        return state;
      }
      return { ...state, currentPath: action.path };
    case "set-view-mode":
      return action.viewMode === state.viewMode
        ? state
        : { ...state, viewMode: action.viewMode };
    case "toggle-directory": {
      const collapsedPaths = new Set(state.collapsedPaths);
      if (collapsedPaths.has(action.path)) {
        collapsedPaths.delete(action.path);
      } else {
        collapsedPaths.add(action.path);
      }
      return { ...state, collapsedPaths };
    }
    case "set-preferences": {
      const preferences = { ...state.preferences, ...action.preferences };
      return readingPreferencesEqual(state.preferences, preferences)
        ? state
        : { ...state, preferences };
    }
  }
}

export function siteSnapshotsEqual(
  left: SiteSnapshot,
  right: SiteSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function selectedPath(
  snapshot: SiteSnapshot,
  requestedPath: string | null | undefined,
): string | null {
  return requestedPath !== undefined &&
    requestedPath !== null &&
    hasDocument(snapshot, requestedPath)
    ? requestedPath
    : snapshot.firstPath;
}

function hasDocument(snapshot: SiteSnapshot, path: string): boolean {
  return snapshot.documents.some((document) => document.path === path);
}

function readingPreferencesEqual(
  left: ReadingPreferences,
  right: ReadingPreferences,
): boolean {
  return (
    left.theme === right.theme &&
    left.palette === right.palette &&
    left.fontSize === right.fontSize &&
    left.contentWidth === right.contentWidth &&
    left.outline === right.outline &&
    left.sidebarWidth === right.sidebarWidth
  );
}
