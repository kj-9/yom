import "./styles.css";

const app = requireElement<HTMLDivElement>("#app");

type TreeNode = {
  name: string;
  path: string;
  type: "directory" | "file";
  children: TreeNode[];
};

type SiteSnapshot = {
  root: string;
  firstPath: string | null;
  tree: TreeNode;
};

type DocumentPayload = {
  path: string;
  raw: string;
  html: string;
};

const state = {
  tree: null as TreeNode | null,
  currentPath: null as string | null,
  firstPath: null as string | null,
  currentHtml: "",
  currentRaw: "",
  lastTreeSignature: "",
  collapsed: new Set<string>(),
  viewMode: "rendered" as "rendered" | "raw",
  loadRequestId: 0,
};

const THEME_KEY = "yom-theme";
const PALETTE_KEY = "yom-palette";
const SIDEBAR_WIDTH_KEY = "yom-sidebar-width";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 304;
const CONTEXT_COPY_LABEL = "Copy path";
const CONTEXT_COPY_SUCCESS_LABEL = "Copied";
const CONTEXT_COPY_ERROR_LABEL = "Copy failed";

let mermaidInitialized = false;
let mermaidModule: (typeof import("mermaid"))["default"] | null = null;
let contextMenuPath: string | null = null;
let contextMenuResetTimer: number | null = null;

void bootstrap();

async function bootstrap(): Promise<void> {
  app.innerHTML = renderShell();
  initializeTheme();
  initializePalette();
  initializeSidebarWidth();
  bindControls();

  const snapshot = await fetchJson<SiteSnapshot>("/api/tree");
  state.tree = snapshot.tree;
  state.firstPath = snapshot.firstPath;
  state.lastTreeSignature = JSON.stringify(snapshot.tree);
  requireElement<HTMLElement>("#rootLabel").textContent = snapshot.root;
  renderTree(snapshot.tree);

  const initialPath = readCurrentPath() ?? snapshot.firstPath;
  if (initialPath !== null) {
    await openDocument(initialPath);
  } else {
    renderEmptyState("No Markdown files found.");
  }

  window.addEventListener("popstate", () => {
    const nextPath = readCurrentPath();
    if (nextPath !== null) {
      void openDocument(nextPath);
    }
  });

  window.setInterval(() => {
    void refreshContent();
  }, 2000);

  const events = new EventSource("/events");
  events.onmessage = async (event) => {
    const payload = JSON.parse(event.data) as { timestamp: number };
    setStatus(
      `Updated ${new Date(payload.timestamp * 1000).toLocaleTimeString()}`,
      "updated",
    );
    await refreshContent();
  };
  events.onerror = () => {
    setStatus("Reconnecting", "reconnecting");
  };

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("treeContextMenu");
    if (menu === null || menu.hidden) {
      return;
    }
    if (menu.contains(event.target as Node)) {
      return;
    }
    closeTreeContextMenu();
  });
}

function bindControls(): void {
  requireElement<HTMLInputElement>("#treeSearch").addEventListener(
    "input",
    () => {
      if (state.tree !== null) {
        renderTree(state.tree);
      }
    },
  );

  requireElement<HTMLButtonElement>("#collapseTree").addEventListener(
    "click",
    () => {
      if (state.tree === null) {
        return;
      }
      state.collapsed = new Set(collectDirectoryPaths(state.tree));
      renderTree(state.tree);
    },
  );

  requireElement<HTMLButtonElement>("#expandTree").addEventListener(
    "click",
    () => {
      state.collapsed.clear();
      if (state.tree !== null) {
        renderTree(state.tree);
      }
    },
  );

  requireElement<HTMLButtonElement>("#renderedMode").addEventListener(
    "click",
    () => {
      setViewMode("rendered");
    },
  );

  requireElement<HTMLButtonElement>("#rawMode").addEventListener(
    "click",
    () => {
      setViewMode("raw");
    },
  );

  requireElement<HTMLButtonElement>("#themeToggle").addEventListener(
    "click",
    () => {
      const nextTheme =
        document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.dataset.theme = nextTheme;
      localStorage.setItem(THEME_KEY, nextTheme);
      updateThemeToggleLabel(nextTheme);
    },
  );

  requireElement<HTMLSelectElement>("#paletteSelect").addEventListener(
    "change",
    (event) => {
      const palette = (event.target as HTMLSelectElement).value;
      document.body.dataset.palette = palette;
      localStorage.setItem(PALETTE_KEY, palette);
    },
  );

  requireElement<HTMLButtonElement>("#mobileNavToggle").addEventListener(
    "click",
    () => {
      const nextOpen = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", nextOpen);
    },
  );

  bindSidebarResize();

  requireElement<HTMLButtonElement>("#contextMenuOpen").addEventListener(
    "click",
    () => {
      if (contextMenuPath === null) {
        return;
      }
      void openDocument(contextMenuPath);
      closeTreeContextMenu();
    },
  );

  requireElement<HTMLButtonElement>("#contextMenuCopyPath").addEventListener(
    "click",
    async () => {
      if (contextMenuPath === null) {
        return;
      }
      await copyPath(contextMenuPath);
      window.setTimeout(closeTreeContextMenu, 300);
    },
  );

  requireElement<HTMLButtonElement>("#contextMenuOpenTab").addEventListener(
    "click",
    () => {
      if (contextMenuPath === null) {
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set("path", contextMenuPath);
      window.open(url.toString(), "_blank", "noopener");
      closeTreeContextMenu();
    },
  );

  requireElement<HTMLElement>("#docRoot").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest<HTMLAnchorElement>("a[href]");
    if (link === null) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== "/") {
      return;
    }

    const nextPath = url.searchParams.get("path");
    if (nextPath === null) {
      return;
    }

    event.preventDefault();
    void openDocument(nextPath);
  });
}

async function openDocument(
  relativePath: string,
  options?: { silent?: boolean },
): Promise<void> {
  const normalized = relativePath.replace(/^#?\/?/u, "");
  state.currentPath = normalized;
  writeCurrentPath(normalized);

  if (!options?.silent) {
    setStatus("Loading…");
    renderLoadingState(normalized);
  }

  const requestId = state.loadRequestId + 1;
  state.loadRequestId = requestId;
  const response = await fetch(
    `/api/doc?path=${encodeURIComponent(normalized)}`,
  );

  if (requestId !== state.loadRequestId) {
    return;
  }

  if (!response.ok) {
    renderLoadError(normalized);
    setStatus("Load failed");
    return;
  }

  const payload = (await response.json()) as DocumentPayload;
  state.currentPath = payload.path;
  state.currentHtml = payload.html;
  state.currentRaw = payload.raw;
  renderCurrentDocument(payload.path);
  setStatus(payload.path);

  if (state.tree !== null) {
    renderTree(state.tree);
  }
}

async function refreshContent(): Promise<void> {
  try {
    const snapshot = await fetchJson<SiteSnapshot>("/api/tree");
    const signature = JSON.stringify(snapshot.tree);
    if (signature !== state.lastTreeSignature) {
      state.lastTreeSignature = signature;
      state.tree = snapshot.tree;
      state.firstPath = snapshot.firstPath;
      requireElement<HTMLElement>("#rootLabel").textContent = snapshot.root;
      renderTree(snapshot.tree);
    }

    const nextPath = state.currentPath ?? snapshot.firstPath;
    if (nextPath !== null) {
      await openDocument(nextPath, { silent: true });
    }
  } catch {
    setStatus("Refresh failed");
  }
}

function renderCurrentDocument(path: string): void {
  const docMeta = document.getElementById("docMeta");
  if (docMeta !== null) {
    docMeta.textContent = path;
  }

  const docRoot = requireElement<HTMLElement>("#docRoot");
  const rawRoot = requireElement<HTMLElement>("#rawRoot");
  const rawCode = requireElement<HTMLElement>("#rawRoot code");

  if (state.viewMode === "raw") {
    docRoot.hidden = true;
    rawRoot.hidden = false;
    rawCode.textContent = state.currentRaw;
    return;
  }

  rawRoot.hidden = true;
  docRoot.hidden = false;
  docRoot.className = "";
  docRoot.innerHTML = state.currentHtml;
  void renderMermaidDiagrams();
}

function renderLoadingState(path: string): void {
  const docMeta = document.getElementById("docMeta");
  if (docMeta !== null) {
    docMeta.textContent = path;
  }
  const docRoot = requireElement<HTMLElement>("#docRoot");
  const rawRoot = requireElement<HTMLElement>("#rawRoot");
  const rawCode = requireElement<HTMLElement>("#rawRoot code");

  if (state.viewMode === "raw") {
    docRoot.hidden = true;
    rawRoot.hidden = false;
    rawCode.textContent = "Loading...";
    return;
  }

  rawRoot.hidden = true;
  docRoot.hidden = false;
  docRoot.className = "empty";
  docRoot.textContent = "Loading...";
}

function renderLoadError(path: string): void {
  const docMeta = document.getElementById("docMeta");
  if (docMeta !== null) {
    docMeta.textContent = path;
  }
  const docRoot = requireElement<HTMLElement>("#docRoot");
  const rawRoot = requireElement<HTMLElement>("#rawRoot");
  const rawCode = requireElement<HTMLElement>("#rawRoot code");

  if (state.viewMode === "raw") {
    docRoot.hidden = true;
    rawRoot.hidden = false;
    rawCode.textContent = "Could not load the item.";
    return;
  }

  rawRoot.hidden = true;
  docRoot.hidden = false;
  docRoot.className = "empty";
  docRoot.textContent = "Could not load the item.";
}

function renderEmptyState(message: string): void {
  const docRoot = requireElement<HTMLElement>("#docRoot");
  const rawRoot = requireElement<HTMLElement>("#rawRoot");
  docRoot.hidden = false;
  rawRoot.hidden = true;
  docRoot.className = "empty";
  docRoot.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function renderTree(tree: TreeNode): void {
  const root = requireElement<HTMLElement>("#treeRoot");
  root.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "tree";
  for (const child of tree.children) {
    const node = renderTreeNode(child);
    if (node !== null) {
      list.appendChild(node);
    }
  }
  root.appendChild(list);
}

function renderTreeNode(node: TreeNode): HTMLLIElement | null {
  if (!matchesSearch(node)) {
    return null;
  }

  if (node.type === "directory") {
    const item = document.createElement("li");
    item.className = "tree-item";
    if (state.collapsed.has(node.path)) {
      item.classList.add("collapsed");
    }

    const button = document.createElement("button");
    button.className = "folder";
    button.type = "button";
    button.innerHTML = `<span class="folder-caret">▾</span><span>${escapeHtml(node.name)}</span>`;
    button.addEventListener("click", () => {
      toggleDirectory(node.path);
    });
    item.appendChild(button);

    const list = document.createElement("ul");
    for (const child of node.children) {
      const childNode = renderTreeNode(child);
      if (childNode !== null) {
        list.appendChild(childNode);
      }
    }
    if (list.childElementCount === 0) {
      return null;
    }
    item.appendChild(list);
    return item;
  }

  const item = document.createElement("li");
  const button = document.createElement("button");
  button.className = "node";
  if (node.path === state.currentPath) {
    button.classList.add("active");
  }
  button.textContent = node.name;
  button.addEventListener("click", () => {
    void openDocument(node.path);
  });
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openTreeContextMenu(node.path, event.clientX, event.clientY);
  });
  item.appendChild(button);
  return item;
}

function matchesSearch(node: TreeNode): boolean {
  const query = requireElement<HTMLInputElement>("#treeSearch")
    .value.trim()
    .toLowerCase();
  if (query.length === 0) {
    return true;
  }

  if (
    node.name.toLowerCase().includes(query) ||
    node.path.toLowerCase().includes(query)
  ) {
    return true;
  }

  return node.type === "directory" && node.children.some(matchesSearch);
}

function toggleDirectory(path: string): void {
  if (state.collapsed.has(path)) {
    state.collapsed.delete(path);
  } else {
    state.collapsed.add(path);
  }

  if (state.tree !== null) {
    renderTree(state.tree);
  }
}

function collectDirectoryPaths(
  node: TreeNode,
  values: string[] = [],
): string[] {
  if (node.type !== "directory") {
    return values;
  }
  if (node.path.length > 0) {
    values.push(node.path);
  }
  for (const child of node.children) {
    collectDirectoryPaths(child, values);
  }
  return values;
}

function setViewMode(mode: "rendered" | "raw"): void {
  state.viewMode = mode;
  requireElement<HTMLButtonElement>("#renderedMode").classList.toggle(
    "active",
    mode === "rendered",
  );
  requireElement<HTMLButtonElement>("#rawMode").classList.toggle(
    "active",
    mode === "raw",
  );
  if (state.currentPath !== null) {
    renderCurrentDocument(state.currentPath);
  }
}

function initializeTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  const theme =
    saved === "light" || saved === "dark"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.body.dataset.theme = theme;
  updateThemeToggleLabel(theme);
}

function initializePalette(): void {
  const palette = localStorage.getItem(PALETTE_KEY) ?? "paper";
  document.body.dataset.palette = palette;
  requireElement<HTMLSelectElement>("#paletteSelect").value = palette;
}

function initializeSidebarWidth(): void {
  const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  applySidebarWidth(Number.isFinite(saved) ? saved : SIDEBAR_DEFAULT_WIDTH);
}

function updateThemeToggleLabel(theme: string): void {
  requireElement<HTMLButtonElement>("#themeToggle").textContent =
    theme === "dark" ? "Light mode" : "Dark mode";
}

function applySidebarWidth(width: number): void {
  const next = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
  document.documentElement.style.setProperty("--sidebar-width", `${next}px`);
}

function bindSidebarResize(): void {
  const layout = requireElement<HTMLElement>(".layout");
  const resizer = requireElement<HTMLElement>("#sidebarResizer");

  resizer.addEventListener("pointerdown", (event) => {
    if (window.innerWidth <= 900) {
      return;
    }
    event.preventDefault();
    document.body.classList.add("resizing-sidebar");
    resizer.setPointerCapture(event.pointerId);
  });

  resizer.addEventListener("pointermove", (event) => {
    if (!document.body.classList.contains("resizing-sidebar")) {
      return;
    }
    const layoutLeft = layout.getBoundingClientRect().left;
    applySidebarWidth(event.clientX - layoutLeft);
  });

  const stopResize = (event: PointerEvent) => {
    if (!document.body.classList.contains("resizing-sidebar")) {
      return;
    }
    document.body.classList.remove("resizing-sidebar");
    resizer.releasePointerCapture(event.pointerId);
    const width = getComputedStyle(document.documentElement).getPropertyValue(
      "--sidebar-width",
    );
    localStorage.setItem(
      SIDEBAR_WIDTH_KEY,
      Number.parseInt(width, 10).toString(),
    );
  };

  resizer.addEventListener("pointerup", stopResize);
  resizer.addEventListener("pointercancel", stopResize);
}

async function initializeMermaid(): Promise<
  (typeof import("mermaid"))["default"] | null
> {
  if (mermaidInitialized) {
    return mermaidModule;
  }
  const module = await import("mermaid");
  mermaidModule = module.default;
  mermaidModule.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: document.body.dataset.theme === "dark" ? "dark" : "default",
  });
  mermaidInitialized = true;
  return mermaidModule;
}

async function renderMermaidDiagrams(): Promise<void> {
  const docRoot = requireElement<HTMLElement>("#docRoot");
  const blocks = docRoot.querySelectorAll("pre > code.language-mermaid");
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await initializeMermaid();
  if (mermaid === null) {
    return;
  }

  for (const block of blocks) {
    const container = block.parentElement;
    if (!(container instanceof HTMLElement)) {
      continue;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "mermaid-block";
    const graph = document.createElement("div");
    graph.className = "mermaid";
    graph.textContent = block.textContent ?? "";
    wrapper.appendChild(graph);
    container.replaceWith(wrapper);
  }

  void mermaid
    .run({ nodes: docRoot.querySelectorAll(".mermaid") })
    .catch(() => {
      restoreMermaidCodeBlocks();
    });
}

function restoreMermaidCodeBlocks(): void {
  const docRoot = requireElement<HTMLElement>("#docRoot");
  for (const graph of docRoot.querySelectorAll(".mermaid")) {
    const wrapper = graph.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      continue;
    }
    const fallback = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.textContent = graph.textContent ?? "";
    fallback.appendChild(code);
    wrapper.replaceWith(fallback);
  }
}

function openTreeContextMenu(path: string, x: number, y: number): void {
  const menu = requireElement<HTMLElement>("#treeContextMenu");
  contextMenuPath = path;
  resetContextMenuCopyLabel();
  menu.hidden = false;

  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - menuRect.width - 12);
  const top = Math.min(y, window.innerHeight - menuRect.height - 12);
  menu.style.left = `${Math.max(12, left)}px`;
  menu.style.top = `${Math.max(12, top)}px`;
}

function closeTreeContextMenu(): void {
  const menu = document.getElementById("treeContextMenu");
  if (!(menu instanceof HTMLElement)) {
    return;
  }
  menu.hidden = true;
  contextMenuPath = null;
  resetContextMenuCopyLabel();
}

async function copyPath(path: string): Promise<void> {
  const button = requireElement<HTMLButtonElement>("#contextMenuCopyPath");

  try {
    if (navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(path);
    } else {
      const input = document.createElement("textarea");
      input.value = path;
      input.setAttribute("readonly", "");
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    button.textContent = CONTEXT_COPY_SUCCESS_LABEL;
  } catch {
    button.textContent = CONTEXT_COPY_ERROR_LABEL;
  }

  contextMenuResetTimer = window.setTimeout(() => {
    resetContextMenuCopyLabel();
  }, 1600);
}

function resetContextMenuCopyLabel(): void {
  const button = document.getElementById("contextMenuCopyPath");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  if (contextMenuResetTimer !== null) {
    window.clearTimeout(contextMenuResetTimer);
    contextMenuResetTimer = null;
  }
  button.textContent = CONTEXT_COPY_LABEL;
}

function readCurrentPath(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("path");
}

function writeCurrentPath(relativePath: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("path", relativePath);
  history.replaceState({}, "", url);
}

function setStatus(text: string, stateName = "ready"): void {
  requireElement<HTMLElement>("#statusText").textContent = text;
  requireElement<HTMLElement>("#statusBadge").setAttribute(
    "data-state",
    stateName,
  );
}

function renderShell(): string {
  return `
    <button class="mobile-nav-toggle" id="mobileNavToggle" type="button">Contents</button>
    <div class="layout">
      <aside id="sidebar">
        <div class="sidebar-header">
          <div>
            <h1 class="brand">yom</h1>
            <p class="sub" id="rootLabel"></p>
          </div>
          <div class="sidebar-meta">
            <div class="status" id="statusBadge" data-state="ready">
              <span class="dot"></span><span id="statusText">Watching</span>
            </div>
            <details class="settings-panel">
              <summary class="settings-toggle" id="settingsToggle">
                <span aria-hidden="true">&#9881;</span>
              </summary>
              <div class="settings-card">
                <button class="theme-toggle" id="themeToggle" type="button">Dark mode</button>
                <div class="settings-group">
                  <span class="settings-label">View</span>
                  <div class="view-mode" role="group">
                    <button class="active" id="renderedMode" type="button">Rendered</button>
                    <button id="rawMode" type="button">Raw</button>
                  </div>
                </div>
                <label class="palette-picker">
                  <span class="settings-label">Palette</span>
                  <select id="paletteSelect">
                    <option value="paper">Paper</option>
                    <option value="forest">Forest</option>
                    <option value="sea">Sea</option>
                  </select>
                </label>
              </div>
            </details>
          </div>
        </div>
        <label class="search">
          <span class="search-label">Filter</span>
          <input id="treeSearch" type="search" placeholder="Filter items" />
        </label>
        <div class="tree-toolbar">
          <div class="tree-label">Contents</div>
          <div class="tree-actions">
            <button id="collapseTree" type="button">Collapse</button>
            <button id="expandTree" type="button">Expand</button>
          </div>
        </div>
        <div id="treeRoot"></div>
      </aside>
      <div class="sidebar-resizer" id="sidebarResizer"></div>
      <main>
        <div class="reader-shell">
          <article class="content-panel">
            <div id="docMeta" class="doc-meta"></div>
            <div id="docRoot" class="empty">Select an item from the list on the left.</div>
            <pre id="rawRoot" class="raw-view" hidden><code></code></pre>
          </article>
        </div>
      </main>
    </div>
    <div
      id="treeContextMenu"
      class="context-menu"
      hidden
      role="menu"
      aria-label="File actions"
    >
      <button id="contextMenuOpen" type="button" role="menuitem">Open</button>
      <button id="contextMenuCopyPath" type="button" role="menuitem">Copy path</button>
      <button id="contextMenuOpenTab" type="button" role="menuitem">Open in new tab</button>
    </div>
  `;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
