import type { ComponentChildren } from "preact";
import type {
  DocumentPayload,
  DocumentReference,
  TreeNode,
} from "../core/sitepayload.js";
import { defaultReadingPreferences, type ReadingPreferences } from "./state.js";

export function DocumentTree(props: {
  node: TreeNode;
  currentPath: string | null;
  basePath?: string;
  collapsedPaths?: ReadonlySet<string>;
  onToggleDirectory?: (path: string) => void;
}): ComponentChildren {
  return (
    <ul>
      {props.node.children.map((node) =>
        node.type === "directory" ? (
          <li key={node.path}>
            <button
              type="button"
              class="folder"
              aria-expanded={!props.collapsedPaths?.has(node.path)}
              onClick={() => props.onToggleDirectory?.(node.path)}
            >
              {node.name}
            </button>
            {props.collapsedPaths?.has(node.path) ? null : (
              <DocumentTree
                node={node}
                currentPath={props.currentPath}
                basePath={props.basePath}
                collapsedPaths={props.collapsedPaths}
                onToggleDirectory={props.onToggleDirectory}
              />
            )}
          </li>
        ) : (
          <li key={node.path}>
            <a
              role="button"
              href={
                node.path === props.currentPath
                  ? "#docRoot"
                  : documentHref(node.path, props.basePath)
              }
              aria-current={
                node.path === props.currentPath ? "page" : undefined
              }
            >
              {node.name}
            </a>
          </li>
        ),
      )}
    </ul>
  );
}

export function DocumentView(props: {
  document: DocumentPayload;
  viewMode?: "rendered" | "raw";
  onViewModeChange?: (viewMode: "rendered" | "raw") => void;
}): ComponentChildren {
  const { document, viewMode = "rendered", onViewModeChange } = props;
  return (
    <div id="documentPane">
      <div class="doc-meta">{document.path}</div>
      <h2 id="documentTitle" class="document-title">
        {document.metadata.title}
      </h2>
      <div class="view-toggle" role="group" aria-label="Document view">
        <button
          id="renderedMode"
          type="button"
          aria-pressed={viewMode === "rendered"}
          onClick={() => onViewModeChange?.("rendered")}
        >
          Rendered
        </button>
        <button
          id="rawMode"
          type="button"
          aria-pressed={viewMode === "raw"}
          onClick={() => onViewModeChange?.("raw")}
        >
          Raw
        </button>
      </div>
      <details
        id="frontMatter"
        class="front-matter"
        hidden={Object.keys(document.metadata.frontMatter).length === 0}
      >
        <summary>Metadata</summary>
        <dl id="frontMatterValues">
          {Object.entries(document.metadata.frontMatter).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </details>
      {viewMode === "raw" ? (
        <pre id="rawRoot">
          <code>{document.raw}</code>
        </pre>
      ) : (
        <div
          id="docRoot"
          dangerouslySetInnerHTML={{ __html: documentHtml(document) }}
        />
      )}
      <Pagination
        previous={document.pagination.previous}
        next={document.pagination.next}
      />
    </div>
  );
}

export function Outline({
  document,
  activeHeading,
  onSelectHeading,
}: {
  document: DocumentPayload;
  activeHeading?: string | null;
  onSelectHeading?: (id: string, event: MouseEvent) => void;
}): ComponentChildren {
  return (
    <aside id="outlinePanel" class="outline-panel" aria-label="On this page">
      <h2 class="outline-title">On this page</h2>
      <ul id="outlineList" class="outline-list">
        {document.outline.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              class={activeHeading === heading.id ? "active" : undefined}
              data-heading-id={heading.id}
              onClick={(event) => onSelectHeading?.(heading.id, event)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function Pagination(props: {
  previous: DocumentReference | null;
  next: DocumentReference | null;
}): ComponentChildren {
  return (
    <nav aria-label="Pagination" class="document-pagination">
      {props.previous ? (
        <a
          id="previousDocument"
          data-path={props.previous.path}
          href={props.previous.route}
        >
          Previous
        </a>
      ) : null}
      {props.next ? (
        <a
          id="nextDocument"
          data-path={props.next.path}
          href={props.next.route}
        >
          Next
        </a>
      ) : null}
    </nav>
  );
}

export function SettingsPanel(props: {
  preferences: ReadingPreferences;
  onChange: (patch: Partial<ReadingPreferences>) => void;
}): ComponentChildren {
  const { preferences, onChange } = props;
  return (
    <details class="settings-panel">
      <summary
        class="settings-toggle"
        id="settingsToggle"
        aria-label="Display settings"
      >
        <span aria-hidden="true">⚙</span>
      </summary>
      <section class="settings-card" aria-label="Display settings">
        <div class="settings-grid">
          <label class="settings-control">
            <span class="settings-label">Theme</span>
            <select
              id="themeSelect"
              value={preferences.theme}
              onChange={(event) =>
                onChange({
                  theme: (event.currentTarget as HTMLSelectElement)
                    .value as ReadingPreferences["theme"],
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label class="settings-control">
            <span class="settings-label">Palette</span>
            <select
              id="paletteSelect"
              value={preferences.palette}
              onChange={(event) =>
                onChange({
                  palette: (event.currentTarget as HTMLSelectElement)
                    .value as ReadingPreferences["palette"],
                })
              }
            >
              <option value="paper">Paper</option>
              <option value="forest">Forest</option>
              <option value="sea">Sea</option>
            </select>
          </label>
          <label class="settings-control">
            <span class="settings-label">Text size</span>
            <select
              id="fontSizeSelect"
              value={preferences.fontSize}
              onChange={(event) =>
                onChange({
                  fontSize: (event.currentTarget as HTMLSelectElement)
                    .value as ReadingPreferences["fontSize"],
                })
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label class="settings-control">
            <span class="settings-label">Page width</span>
            <select
              id="contentWidthSelect"
              value={preferences.contentWidth}
              onChange={(event) =>
                onChange({
                  contentWidth: (event.currentTarget as HTMLSelectElement)
                    .value as ReadingPreferences["contentWidth"],
                })
              }
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="wide">Wide</option>
            </select>
          </label>
        </div>
        <label class="switch-control">
          <span>
            <strong>Page outline</strong>
            <small>Keep headings beside the page</small>
          </span>
          <input
            id="outlineToggle"
            type="checkbox"
            checked={preferences.outline}
            onChange={(event) =>
              onChange({
                outline: (event.currentTarget as HTMLInputElement).checked,
              })
            }
          />
        </label>
        <button
          class="settings-reset"
          id="resetDisplaySettings"
          type="button"
          onClick={() => onChange(defaultReadingPreferences)}
        >
          Reset display settings
        </button>
      </section>
    </details>
  );
}

function documentHref(path: string, basePath = "/"): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return `${base}docs/${path.replace(/\.md$/u, ".html")}`;
}

function documentHtml(document: DocumentPayload): string {
  let html = document.html;
  for (const heading of document.outline) {
    const pattern = new RegExp(
      `(<h${heading.level}\\b[^>]*\\bid="${escapeRegExp(heading.id)}"[^>]*>)([\\s\\S]*?)(</h${heading.level}>)`,
      "u",
    );
    html = html.replace(
      pattern,
      `$1$2<button type="button" class="heading-link" aria-label="${escapeHtmlAttribute(`Copy link to ${heading.text}`)}"></button>$3`,
    );
  }
  return html.replace(
    /<pre>(<code\b[^>]*>[\s\S]*?<\/code>)<\/pre>/gu,
    (fullMatch, code: string) =>
      /\blanguage-mermaid\b/u.test(code)
        ? fullMatch
        : `<pre>${code}<button type="button" class="code-copy" aria-label="Copy code block">Copy</button></pre>`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
