import type { ComponentChildren } from "preact";

import type { DocumentPayload, SiteSnapshot } from "../core/sitepayload.js";
import { DocumentTree, DocumentView, Outline } from "./components.js";
import { SettingsPanel } from "./components.js";
import { defaultReadingPreferences, type ReadingPreferences } from "./state.js";

export function StaticSitePage(props: {
  snapshot: SiteSnapshot;
  document: DocumentPayload | null;
  title: string;
  mode: "dev" | "static";
  preferences?: ReadingPreferences;
  onPreferencesChange?: (patch: Partial<ReadingPreferences>) => void;
  viewMode?: "rendered" | "raw";
  onViewModeChange?: (viewMode: "rendered" | "raw") => void;
  activeHeading?: string | null;
  onSelectHeading?: (id: string, event: MouseEvent) => void;
}): ComponentChildren {
  const {
    snapshot,
    document,
    title,
    mode,
    preferences = defaultReadingPreferences,
    onPreferencesChange = () => {},
    viewMode = "rendered",
    onViewModeChange,
    activeHeading,
    onSelectHeading,
  } = props;
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
                  {mode === "dev" ? "Watching" : "Static"}
                </span>
              </div>
            </div>
          </div>
          <SettingsPanel
            preferences={preferences}
            onChange={onPreferencesChange}
          />
          <nav aria-label="Documents" id="treeRoot">
            <DocumentTree
              node={snapshot.tree}
              currentPath={document?.path ?? null}
              basePath={snapshot.basePath}
            />
          </nav>
        </aside>
        <div id="sidebarResizer" class="sidebar-resizer" aria-hidden="true" />
        <main id="mainContent">
          <div class="reader-shell">
            <article class="content-panel">
              {document === null ? (
                <p id="docRoot">No Markdown files found.</p>
              ) : (
                <DocumentView
                  document={document}
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange}
                />
              )}
            </article>
            {document === null || viewMode === "raw" ? null : (
              <Outline
                document={document}
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
