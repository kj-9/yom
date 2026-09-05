import type { ComponentChildren } from "preact";

import type { DocumentPayload, SiteSnapshot } from "../core/sitepayload.js";
import { DocumentTree, DocumentView, Outline } from "./components.js";
import { SettingsPanel } from "./components.js";
import { defaultReadingPreferences, type ReadingPreferences } from "./state.js";

export type StaticSitePageProps = {
  snapshot: SiteSnapshot;
  document: DocumentPayload | null;
  title: string;
  mode: "dev" | "static";
  notFound?: boolean;
  preferences?: ReadingPreferences;
  onPreferencesChange?: (patch: Partial<ReadingPreferences>) => void;
  viewMode?: "rendered" | "raw";
  onViewModeChange?: (viewMode: "rendered" | "raw") => void;
  activeHeading?: string | null;
  onSelectHeading?: (id: string, event: MouseEvent) => void;
  collapsedPaths?: ReadonlySet<string>;
  onToggleDirectory?: (path: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  statusText?: string;
};

export function StaticSitePage(props: StaticSitePageProps): ComponentChildren {
  const {
    snapshot,
    document,
    title,
    mode,
    notFound = false,
    preferences = defaultReadingPreferences,
    onPreferencesChange = () => {},
    viewMode = "rendered",
    onViewModeChange,
    activeHeading,
    onSelectHeading,
    collapsedPaths,
    onToggleDirectory,
    searchQuery = "",
    onSearchQueryChange,
    statusText,
  } = props;
  const selectedDocument = resolveSelectedDocument(
    snapshot,
    document,
    notFound,
  );
  return (
    <>
      <a class="skip-link" href="#docRoot">
        Skip to document
      </a>
      <div class="layout">
        <aside id="sidebar">
          <div class="sidebar-header">
            <h1 class="brand">{title}</h1>
            <div class="sidebar-meta">
              <div class="status" data-state="ready" aria-live="polite">
                <span class="dot" />
                <span id="statusText">
                  {statusText ?? (mode === "dev" ? "Watching" : "Static")}
                </span>
              </div>
            </div>
          </div>
          <SettingsPanel
            preferences={preferences}
            onChange={onPreferencesChange}
          />
          <label class="search">
            <span class="search-label">Filter</span>
            <input
              id="treeSearch"
              type="search"
              aria-label="Filter"
              value={searchQuery}
              onInput={(event) =>
                onSearchQueryChange?.(event.currentTarget.value)
              }
              placeholder="Search titles and content"
            />
          </label>
          <nav aria-label="Documents" id="treeRoot">
            <DocumentTree
              node={filterTree(snapshot, searchQuery)}
              currentPath={selectedDocument?.path ?? null}
              basePath={snapshot.basePath}
              collapsedPaths={collapsedPaths}
              onToggleDirectory={onToggleDirectory}
            />
          </nav>
        </aside>
        <div id="sidebarResizer" class="sidebar-resizer" aria-hidden="true" />
        <main id="mainContent">
          <div class="reader-shell">
            <article class="content-panel">
              {selectedDocument === null ? (
                <p id="docRoot">
                  {notFound ? "Page not found." : "No Markdown files found."}
                </p>
              ) : (
                <DocumentView
                  key={selectedDocument.path}
                  document={selectedDocument}
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange}
                />
              )}
            </article>
            {selectedDocument === null || viewMode === "raw" ? null : (
              <Outline
                document={selectedDocument}
                activeHeading={activeHeading}
                onSelectHeading={onSelectHeading}
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}

function resolveSelectedDocument(
  snapshot: SiteSnapshot,
  document: DocumentPayload | null,
  notFound: boolean,
): DocumentPayload | null {
  if (notFound) return null;
  if (document !== null) {
    const current = snapshot.documents.find(
      (candidate) => candidate.path === document.path,
    );
    if (current !== undefined) return current;
    const adjacentPath =
      document.pagination.next?.path ?? document.pagination.previous?.path;
    const adjacent = snapshot.documents.find(
      (candidate) => candidate.path === adjacentPath,
    );
    if (adjacent !== undefined) return adjacent;
  }
  return (
    snapshot.documents.find(
      (candidate) => candidate.path === snapshot.firstPath,
    ) ?? null
  );
}

function filterTree(
  snapshot: SiteSnapshot,
  query: string,
): SiteSnapshot["tree"] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return snapshot.tree;
  const matches = new Set(
    snapshot.documents
      .filter((document) =>
        `${document.path}\n${document.metadata.title}\n${document.raw}`
          .toLowerCase()
          .includes(normalized),
      )
      .map((document) => document.path),
  );
  const filter = (node: SiteSnapshot["tree"]): SiteSnapshot["tree"] | null => {
    if (node.type === "file") return matches.has(node.path) ? node : null;
    const children = node.children
      .map(filter)
      .filter((node): node is NonNullable<typeof node> => node !== null);
    return children.length || node.path === "" ? { ...node, children } : null;
  };
  return filter(snapshot.tree) ?? { ...snapshot.tree, children: [] };
}
