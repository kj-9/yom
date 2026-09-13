import { useSettingsPanel } from "./settings.js";
import {
  IconAdjustmentsHorizontal,
  IconArrowLeft,
  IconBook2,
  IconCode,
  IconDeviceDesktop,
  IconMoon,
  IconSun,
} from "@tabler/icons-preact";
import type { ComponentChildren } from "preact";
import type { DocumentPayload, TreeNode } from "../core/sitepayload.js";
import { defaultReadingPreferences, type ReadingPreferences } from "./state.js";
import {
  buildOutlineTree,
  outlineAncestorIds,
  type OutlineNode,
} from "./documentui.js";

export function DocumentTree(props: {
  node: TreeNode;
  currentPath: string | null;
  basePath?: string;
  collapsedPaths?: ReadonlySet<string>;
  onToggleDirectory?: (path: string) => void;
}): ComponentChildren {
  return (
    <ul class="tree">
      {props.node.children.map((node) =>
        node.type === "directory" ? (
          <li class="tree-item" key={node.path}>
            <details
              open={directoryOpen(
                node.path,
                props.currentPath,
                props.collapsedPaths,
              )}
              onToggle={(event) => {
                const expectedOpen = directoryOpen(
                  node.path,
                  props.currentPath,
                  props.collapsedPaths,
                );
                if (event.currentTarget.open !== expectedOpen) {
                  props.onToggleDirectory?.(node.path);
                }
              }}
            >
              <summary class="folder">
                <span>{node.name}</span>
              </summary>
              <DocumentTree
                node={node}
                currentPath={props.currentPath}
                basePath={props.basePath}
                collapsedPaths={props.collapsedPaths}
                onToggleDirectory={props.onToggleDirectory}
              />
            </details>
          </li>
        ) : (
          <li class="tree-item" key={node.path}>
            <div class="tree-document-row">
              <a
                class={`node${node.path === props.currentPath ? " active" : ""}`}
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
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

export function ViewModeControl(props: {
  viewMode: "rendered" | "raw";
  onChange?: (viewMode: "rendered" | "raw") => void;
}): ComponentChildren {
  return (
    <div class="view-mode-control" aria-label="Document view">
      <button
        type="button"
        class={props.viewMode === "rendered" ? "active" : undefined}
        aria-pressed={props.viewMode === "rendered"}
        onClick={() => props.onChange?.("rendered")}
      >
        <IconBook2 aria-hidden="true" size={15} stroke={1.8} />
        Rendered
      </button>
      <button
        type="button"
        class={props.viewMode === "raw" ? "active" : undefined}
        aria-pressed={props.viewMode === "raw"}
        onClick={() => props.onChange?.("raw")}
      >
        <IconCode aria-hidden="true" size={15} stroke={1.8} />
        Source
      </button>
    </div>
  );
}

function directoryOpen(
  directoryPath: string,
  currentPath: string | null,
  collapsedPaths: ReadonlySet<string> | undefined,
): boolean {
  if (collapsedPaths !== undefined) return !collapsedPaths.has(directoryPath);
  return currentPath?.startsWith(`${directoryPath}/`) ?? false;
}

export function DocumentView(props: {
  document: DocumentPayload;
  viewMode?: "rendered" | "raw";
}): ComponentChildren {
  const { document, viewMode = "rendered" } = props;
  const needsPrimaryHeading = !document.outline.some(
    (heading) => heading.level === 1,
  );
  return (
    <div id="documentPane">
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
        <div id="docRoot">
          {needsPrimaryHeading ? (
            <h1 id="documentTitle" class="document-title">
              {document.metadata.title}
            </h1>
          ) : null}
          <div
            class="rendered-document"
            dangerouslySetInnerHTML={{ __html: documentHtml(document) }}
          />
        </div>
      )}
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
  const tree = buildOutlineTree(document.outline);
  const ancestorIds = outlineAncestorIds(tree, activeHeading);
  return (
    <aside id="outlinePanel" class="outline-panel" aria-label="On this page">
      <h2 class="outline-title">On this page</h2>
      <OutlineList
        nodes={tree}
        activeHeading={activeHeading}
        ancestorIds={ancestorIds}
        onSelectHeading={onSelectHeading}
        root
      />
    </aside>
  );
}

function OutlineList(props: {
  nodes: readonly OutlineNode[];
  activeHeading?: string | null;
  ancestorIds: ReadonlySet<string>;
  onSelectHeading?: (id: string, event: MouseEvent) => void;
  root?: boolean;
}): ComponentChildren {
  return (
    <ul id={props.root ? "outlineList" : undefined} class="outline-list">
      {props.nodes.map((node) => {
        const active = props.activeHeading === node.heading.id;
        return (
          <li
            key={node.heading.id}
            class={
              props.ancestorIds.has(node.heading.id)
                ? "outline-ancestor"
                : undefined
            }
          >
            <a
              href={`#${node.heading.id}`}
              class={active ? "active" : undefined}
              aria-current={active ? "location" : undefined}
              data-heading-id={node.heading.id}
              onClick={(event) =>
                props.onSelectHeading?.(node.heading.id, event)
              }
            >
              {node.heading.text}
            </a>
            {node.children.length > 0 ? (
              <OutlineList {...props} nodes={node.children} root={false} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function SettingsPanel(props: {
  preferences: ReadingPreferences;
  onChange: (patch: Partial<ReadingPreferences>) => void;
  defaults?: ReadingPreferences;
  available?: boolean;
}): ComponentChildren {
  const { preferences, onChange, defaults = defaultReadingPreferences } = props;
  const settings = useSettingsPanel(props.available);
  return (
    <details
      class="settings-panel"
      ref={settings.panelRef}
      onToggle={(event) => settings.setOpen(event.currentTarget.open)}
    >
      <summary
        class="settings-toggle"
        id="settingsToggle"
        ref={settings.triggerRef}
        aria-controls="displaySettings"
        aria-expanded={settings.open}
        aria-label="Display settings"
      >
        <IconAdjustmentsHorizontal aria-hidden="true" size={18} stroke={1.8} />
        <span>Display settings</span>
      </summary>
      <section
        id="displaySettings"
        class="settings-card"
        ref={settings.cardRef}
        aria-label="Display settings"
      >
        <div class="settings-heading">
          <button
            type="button"
            class="settings-back"
            onClick={() => settings.close()}
          >
            <IconArrowLeft aria-hidden="true" size={16} stroke={1.8} />
            Documents
          </button>
          <h2>Display</h2>
        </div>
        <div class="appearance-settings">
          <fieldset class="appearance-group">
            <legend>Theme</legend>
            <div class="appearance-grid">
              <AppearanceButton
                label="Auto"
                active={preferences.theme === "system"}
                icon={<IconDeviceDesktop aria-hidden="true" size={17} />}
                onClick={() => onChange({ theme: "system" })}
              />
              <AppearanceButton
                label="Light"
                active={preferences.theme === "light"}
                icon={<IconSun aria-hidden="true" size={17} />}
                onClick={() => onChange({ theme: "light" })}
              />
              <AppearanceButton
                label="Dark"
                active={preferences.theme === "dark"}
                icon={<IconMoon aria-hidden="true" size={17} />}
                onClick={() => onChange({ theme: "dark" })}
              />
            </div>
          </fieldset>
          <fieldset class="appearance-group">
            <legend>Color palette</legend>
            <div class="palette-grid">
              <PaletteButton
                label="Slate"
                value="paper"
                preferences={preferences}
                onChange={onChange}
              />
              <PaletteButton
                label="Ocean"
                value="sea"
                preferences={preferences}
                onChange={onChange}
              />
              <PaletteButton
                label="Forest"
                value="forest"
                preferences={preferences}
                onChange={onChange}
              />
              <PaletteButton
                label="Sand"
                value="sand"
                preferences={preferences}
                onChange={onChange}
              />
              <PaletteButton
                label="Rose"
                value="rose"
                preferences={preferences}
                onChange={onChange}
              />
            </div>
          </fieldset>
          <div class="legacy-settings" aria-hidden="true">
            <select
              id="themeSelect"
              tabIndex={-1}
              value={preferences.theme}
              onChange={(event) =>
                onChange({
                  theme: event.currentTarget
                    .value as ReadingPreferences["theme"],
                })
              }
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <select
              id="paletteSelect"
              tabIndex={-1}
              value={preferences.palette}
              onChange={(event) =>
                onChange({
                  palette: event.currentTarget
                    .value as ReadingPreferences["palette"],
                })
              }
            >
              <option value="paper">Slate</option>
              <option value="sea">Ocean</option>
              <option value="forest">Forest</option>
              <option value="sand">Sand</option>
              <option value="rose">Rose</option>
            </select>
          </div>
        </div>
        <div class="settings-grid">
          <SegmentedSetting
            id="fontSizeSelect"
            label="Text size"
            description="Adjusts body text and headings together."
            value={preferences.fontSize}
            options={[
              ["small", "S"],
              ["medium", "M"],
              ["large", "L"],
            ]}
            onChange={(fontSize) =>
              onChange({ fontSize: fontSize as ReadingPreferences["fontSize"] })
            }
          />
          <SegmentedSetting
            id="contentWidthSelect"
            label="Content width"
            value={preferences.contentWidth}
            options={[
              ["compact", "Compact"],
              ["comfortable", "Default"],
              ["wide", "Spacious"],
            ]}
            onChange={(contentWidth) =>
              onChange({
                contentWidth:
                  contentWidth as ReadingPreferences["contentWidth"],
              })
            }
          />
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
          onClick={() => onChange(defaults)}
        >
          Reset display settings
        </button>
      </section>
    </details>
  );
}

function AppearanceButton(props: {
  label: string;
  icon: ComponentChildren;
  active: boolean;
  onClick: () => void;
}): ComponentChildren {
  return (
    <button
      class={`appearance-option${props.active ? " active" : ""}`}
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function PaletteButton(props: {
  label: string;
  value: ReadingPreferences["palette"];
  preferences: ReadingPreferences;
  onChange: (patch: Partial<ReadingPreferences>) => void;
}): ComponentChildren {
  const active = props.preferences.palette === props.value;
  return (
    <button
      class={`palette-option${active ? " active" : ""}`}
      type="button"
      aria-pressed={active}
      onClick={() => props.onChange({ palette: props.value })}
    >
      <span class={`palette-swatch ${props.value}`} aria-hidden="true" />
      <span>{props.label}</span>
    </button>
  );
}

function SegmentedSetting(props: {
  id: string;
  label: string;
  description?: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}): ComponentChildren {
  return (
    <fieldset class="segmented-setting">
      <legend>{props.label}</legend>
      <div class="segmented-options">
        {props.options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            class={props.value === value ? "active" : undefined}
            aria-pressed={props.value === value}
            onClick={() => props.onChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {props.description ? <small>{props.description}</small> : null}
      <select
        id={props.id}
        class="legacy-settings"
        tabIndex={-1}
        aria-hidden="true"
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
      >
        {props.options.map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
    </fieldset>
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
