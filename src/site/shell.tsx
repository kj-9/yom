import type { ComponentChildren } from "preact";

export type ShellProps = {
  title: string;
  mode: "dev" | "static";
  sidebar?: ComponentChildren;
  main?: ComponentChildren;
  outline?: ComponentChildren;
};

/**
 * Stable page chrome shared by server rendering and browser hydration.
 * Feature components supply the navigation, document, and outline contents.
 */
export function Shell({
  title,
  mode,
  sidebar,
  main,
  outline,
}: ShellProps): ComponentChildren {
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
                <span>{mode === "dev" ? "Watching" : "Static"}</span>
              </div>
            </div>
          </div>
          {sidebar}
        </aside>
        <div id="sidebarResizer" class="sidebar-resizer" aria-hidden="true" />
        <main id="mainContent">
          <div class="reader-shell">
            <article class="content-panel">{main}</article>
            {outline}
          </div>
        </main>
      </div>
    </>
  );
}
