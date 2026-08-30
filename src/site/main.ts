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
  title: string;
  headings: Array<{ id: string; text: string; level: number }>;
  frontMatter: Record<string, string | number | boolean | string[]>;
};

type DevFileEvent = {
  kind: "document" | "asset";
  action: "add" | "change" | "remove";
  path: string;
};

type SearchEntry = {
  path: string;
  title: string;
  text?: string;
  excerpt?: string;
};

type YomConfig = {
  mode: "dev" | "static";
  basePath: string;
  initialPath?: string | null;
  notFound?: boolean;
  title?: string;
  lang?: string;
  theme?: "system" | "light" | "dark";
  palette?: "paper" | "forest" | "sea";
  fontSize?: "small" | "medium" | "large";
  contentWidth?: "compact" | "comfortable" | "wide";
  outline?: boolean;
};

const config = readConfig();

const state = {
  tree: null as TreeNode | null,
  currentPath: null as string | null,
  firstPath: null as string | null,
  currentHtml: "",
  currentRaw: "",
  currentTitle: "",
  currentHeadings: [] as DocumentPayload["headings"],
  currentFrontMatter: {} as DocumentPayload["frontMatter"],
  lastTreeSignature: "",
  collapsed: new Set<string>(),
  viewMode: "rendered" as "rendered" | "raw",
  loadRequestId: 0,
  searchMatches: null as Set<string> | null,
  searchRequestId: 0,
};

const THEME_KEY = "yom-theme";
const PALETTE_KEY = "yom-palette";
const FONT_SIZE_KEY = "yom-font-size";
const CONTENT_WIDTH_KEY = "yom-content-width";
const OUTLINE_KEY = "yom-outline";
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
let headingObserver: IntersectionObserver | null = null;
let searchTimer: number | null = null;
let staticSearchIndex: SearchEntry[] | null = null;

void bootstrap();

async function bootstrap(): Promise<void> {
  document.title = config.title ?? "yom";
  document.documentElement.lang = config.lang ?? "und";
  app.innerHTML = renderShell();
  initializeTheme();
  initializePalette();
  initializeReadingPreferences();
  initializeSidebarWidth();
  bindControls();
  bindKeyboardNavigation();

  const snapshot = await fetchJson<SiteSnapshot>(
    config.mode === "dev" ? "/api/tree" : appUrl("tree.json"),
  );
  state.tree = snapshot.tree;
  state.firstPath = snapshot.firstPath;
  state.lastTreeSignature = JSON.stringify(snapshot.tree);
  renderTree(snapshot.tree);

  const initialPath = config.notFound
    ? null
    : (readCurrentPath() ?? config.initialPath ?? snapshot.firstPath);
  if (initialPath !== null) {
    await openDocument(initialPath, { hash: window.location.hash });
  } else {
    renderEmptyState(
      config.notFound ? "Page not found." : "No Markdown files found.",
    );
  }

  window.addEventListener("popstate", () => {
    const nextPath = readCurrentPath();
    if (nextPath !== null) {
      void openDocument(nextPath, { hash: window.location.hash });
    }
  });

  if (config.mode === "dev") bindDevEvents();

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

function bindDevEvents(): void {
  const events = new EventSource("/events");
  let hasConnected = false;
  events.onopen = () => {
    if (hasConnected) void refreshContent();
    hasConnected = true;
    setStatus("Watching");
  };
  events.onmessage = async (event) => {
    const payload = JSON.parse(event.data) as DevFileEvent;
    setStatus(`Updated ${new Date().toLocaleTimeString()}`, "updated");
    await handleFileEvent(payload);
  };
  events.onerror = () => {
    setStatus("Reconnecting", "reconnecting");
  };
}

async function handleFileEvent(event: DevFileEvent): Promise<void> {
  if (event.kind === "asset") {
    if (state.currentPath === null) {
      return;
    }
    if (event.action !== "change") {
      await openDocument(state.currentPath, { silent: true });
    }
    refreshRenderedAsset(event.path);
    return;
  }

  if (event.action === "change" && event.path === state.currentPath) {
    await openDocument(event.path, { silent: true });
    return;
  }

  if (event.action === "change") {
    return;
  }

  await refreshContent({
    removedPath: event.action === "remove" ? event.path : null,
  });
}

function bindControls(): void {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (
        requireElement<HTMLSelectElement>("#themeSelect").value === "system"
      ) {
        applyThemePreference("system");
      }
    });

  requireElement<HTMLInputElement>("#treeSearch").addEventListener(
    "input",
    () => {
      if (searchTimer !== null) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => void updateSearch(), 160);
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

  requireElement<HTMLSelectElement>("#themeSelect").addEventListener(
    "change",
    (event) => {
      const theme = (event.target as HTMLSelectElement).value as
        | "system"
        | "light"
        | "dark";
      localStorage.setItem(THEME_KEY, theme);
      applyThemePreference(theme);
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

  requireElement<HTMLSelectElement>("#fontSizeSelect").addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      document.body.dataset.fontSize = value;
      localStorage.setItem(FONT_SIZE_KEY, value);
    },
  );

  requireElement<HTMLSelectElement>("#contentWidthSelect").addEventListener(
    "change",
    (event) => {
      const value = (event.target as HTMLSelectElement).value;
      document.body.dataset.contentWidth = value;
      localStorage.setItem(CONTENT_WIDTH_KEY, value);
    },
  );

  requireElement<HTMLInputElement>("#outlineToggle").addEventListener(
    "change",
    (event) => {
      const visible = (event.target as HTMLInputElement).checked;
      document.body.dataset.outline = visible ? "visible" : "hidden";
      localStorage.setItem(OUTLINE_KEY, String(visible));
    },
  );

  requireElement<HTMLButtonElement>("#resetDisplaySettings").addEventListener(
    "click",
    () => {
      for (const key of [
        THEME_KEY,
        PALETTE_KEY,
        FONT_SIZE_KEY,
        CONTENT_WIDTH_KEY,
        OUTLINE_KEY,
        SIDEBAR_WIDTH_KEY,
      ]) {
        localStorage.removeItem(key);
      }
      initializeTheme();
      initializePalette();
      initializeReadingPreferences();
      applySidebarWidth(SIDEBAR_DEFAULT_WIDTH);
    },
  );

  requireElement<HTMLButtonElement>("#mobileNavToggle").addEventListener(
    "click",
    (event) => {
      const nextOpen = !document.body.classList.contains("nav-open");
      document.body.classList.toggle("nav-open", nextOpen);
      (event.currentTarget as HTMLButtonElement).setAttribute(
        "aria-expanded",
        String(nextOpen),
      );
    },
  );

  bindSidebarResize();

  for (const selector of ["#previousDocument", "#nextDocument"]) {
    requireElement<HTMLButtonElement>(selector).addEventListener(
      "click",
      (event) => {
        const path = (event.currentTarget as HTMLButtonElement).dataset.path;
        if (path) void openDocument(path);
      },
    );
  }

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
      const url = new URL(config.basePath, window.location.origin);
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
    if (
      url.origin !== window.location.origin ||
      url.pathname !== config.basePath
    ) {
      return;
    }

    const nextPath = url.searchParams.get("path");
    if (nextPath === null) {
      return;
    }

    event.preventDefault();
    void openDocument(nextPath, { hash: url.hash });
  });
}

async function openDocument(
  relativePath: string,
  options?: { silent?: boolean; hash?: string },
): Promise<void> {
  const normalized = relativePath.replace(/^#?\/?/u, "");
  state.currentPath = normalized;
  writeCurrentPath(normalized, options?.hash);

  if (!options?.silent) {
    setStatus("Loading…");
    renderLoadingState(normalized);
  }

  const requestId = state.loadRequestId + 1;
  state.loadRequestId = requestId;
  const response = await fetch(documentUrl(normalized));

  if (requestId !== state.loadRequestId) {
    return;
  }

  if (!response.ok) {
    renderLoadError(normalized);
    setStatus("Load failed");
    return;
  }

  const payload = (await response.json()) as DocumentPayload;
  const unchanged =
    options?.silent === true &&
    state.currentPath === payload.path &&
    state.currentHtml === payload.html &&
    state.currentRaw === payload.raw;

  state.currentPath = payload.path;
  state.currentHtml = payload.html;
  state.currentRaw = payload.raw;
  state.currentTitle = payload.title;
  state.currentHeadings = payload.headings;
  state.currentFrontMatter = payload.frontMatter;

  if (unchanged) {
    return;
  }

  renderCurrentDocument(payload.path);
  setStatus(config.mode === "dev" ? "Watching" : "Static");

  if (state.tree !== null) {
    renderTree(state.tree);
  }
  scrollToHash(options?.hash);
}

async function refreshContent(
  options: { removedPath?: string | null } = {},
): Promise<void> {
  try {
    const snapshot = await fetchJson<SiteSnapshot>(
      config.mode === "dev" ? "/api/tree" : appUrl("tree.json"),
    );
    const signature = JSON.stringify(snapshot.tree);
    if (signature !== state.lastTreeSignature) {
      state.lastTreeSignature = signature;
      state.tree = snapshot.tree;
      state.firstPath = snapshot.firstPath;
      renderTree(snapshot.tree);
      if (state.currentPath !== null) {
        renderPagination(state.currentPath);
      }
    }

    const nextPath =
      options.removedPath === state.currentPath
        ? snapshot.firstPath
        : (state.currentPath ?? snapshot.firstPath);
    if (nextPath !== null) {
      await openDocument(nextPath, { silent: true });
    } else {
      state.currentPath = null;
      state.currentHtml = "";
      state.currentRaw = "";
      renderEmptyState("No Markdown files found.");
    }
  } catch {
    setStatus("Refresh failed");
  }
}

function assetUrl(relativePath: string): string {
  return `/assets?path=${relativePath}`;
}

function documentUrl(relativePath: string): string {
  if (config.mode === "dev") {
    return `/api/doc?path=${encodeURIComponent(relativePath)}`;
  }
  const encodedPath = relativePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return appUrl(`data/${encodedPath}.json`);
}

function appUrl(relativePath: string): string {
  return `${config.basePath}${relativePath.replace(/^\//u, "")}`;
}

function refreshRenderedAsset(relativePath: string): void {
  const docRoot = requireElement<HTMLElement>("#docRoot");
  for (const element of docRoot.querySelectorAll<HTMLElement>(
    "[src], [href]",
  )) {
    const attribute = element.hasAttribute("src") ? "src" : "href";
    const value = element.getAttribute(attribute);
    if (value === null) {
      continue;
    }
    const url = new URL(value, window.location.href);
    if (
      url.pathname !== "/assets" ||
      url.searchParams.get("path") !== relativePath
    ) {
      continue;
    }
    url.searchParams.set("v", String(Date.now()));
    element.setAttribute(attribute, `${url.pathname}${url.search}`);
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
    renderDocumentChrome(path);
    return;
  }

  rawRoot.hidden = true;
  docRoot.hidden = false;
  docRoot.className = "";
  docRoot.innerHTML = state.currentHtml;
  renderDocumentChrome(path);
  decorateHeadings();
  decorateCodeBlocks();
  void renderMermaidDiagrams();
}

function renderDocumentChrome(path: string): void {
  const title = requireElement<HTMLElement>("#documentTitle");
  title.textContent = state.currentTitle;
  title.hidden =
    state.currentTitle.length === 0 ||
    state.currentHeadings.some(
      (heading) => heading.level === 1 && heading.text === state.currentTitle,
    );
  renderFrontMatter();
  renderOutline();
  renderPagination(path);
}

function renderFrontMatter(): void {
  const details = requireElement<HTMLDetailsElement>("#frontMatter");
  const list = requireElement<HTMLElement>("#frontMatterValues");
  const entries = Object.entries(state.currentFrontMatter);
  details.hidden = entries.length === 0;
  list.innerHTML = entries
    .map(
      ([key, value]) =>
        `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(Array.isArray(value) ? value.join(", ") : String(value))}</dd></div>`,
    )
    .join("");
}

function renderOutline(): void {
  const panel = requireElement<HTMLElement>("#outlinePanel");
  const list = requireElement<HTMLElement>("#outlineList");
  headingObserver?.disconnect();
  if (state.currentHeadings.length < 2 || state.viewMode === "raw") {
    panel.hidden = true;
    list.innerHTML = "";
    return;
  }
  panel.hidden = false;
  list.innerHTML = state.currentHeadings
    .map(
      (heading) =>
        `<a href="#${encodeURIComponent(heading.id)}" data-heading-id="${escapeHtml(heading.id)}" style="--heading-level:${heading.level}">${escapeHtml(heading.text)}</a>`,
    )
    .join("");
  for (const link of list.querySelectorAll<HTMLAnchorElement>("a")) {
    link.addEventListener("click", (event) => {
      const id = link.dataset.headingId;
      if (!id) return;
      event.preventDefault();
      updateCurrentHash(id);
      scrollToHeading(id);
    });
  }
  observeHeadings();
}

function observeHeadings(): void {
  const headings = state.currentHeadings
    .map((heading) => document.getElementById(heading.id))
    .filter((heading): heading is HTMLElement => heading !== null);
  if (headings.length === 0) return;
  headingObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (!(visible?.target instanceof HTMLElement)) return;
      setActiveOutlineHeading(visible.target.id);
    },
    { rootMargin: "-10% 0px -75% 0px" },
  );
  for (const heading of headings) headingObserver.observe(heading);
}

function decorateHeadings(): void {
  const docRoot = requireElement<HTMLElement>("#docRoot");
  for (const heading of docRoot.querySelectorAll<HTMLElement>(
    "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]",
  )) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "heading-link";
    button.setAttribute(
      "aria-label",
      `Copy link to ${heading.textContent ?? "heading"}`,
    );
    button.addEventListener("click", async () => {
      updateCurrentHash(heading.id);
      await copyText(window.location.href);
      button.dataset.copied = "true";
      window.setTimeout(() => delete button.dataset.copied, 1200);
    });
    heading.appendChild(button);
  }
}

function decorateCodeBlocks(): void {
  const docRoot = requireElement<HTMLElement>("#docRoot");
  for (const pre of [...docRoot.querySelectorAll("pre")]) {
    if (pre.querySelector("code.language-mermaid")) continue;
    if (pre.parentElement?.classList.contains("code-block")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    pre.replaceWith(wrapper);
    wrapper.appendChild(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", "Copy code block");
    button.addEventListener("click", async () => {
      await copyText(pre.textContent ?? "");
      button.textContent = "Copied";
      window.setTimeout(() => (button.textContent = "Copy"), 1200);
    });
    wrapper.appendChild(button);
  }
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
  clearDocumentState();
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
  clearDocumentState();
  const docRoot = requireElement<HTMLElement>("#docRoot");
  const rawRoot = requireElement<HTMLElement>("#rawRoot");
  docRoot.hidden = false;
  rawRoot.hidden = true;
  docRoot.className = "empty";
  docRoot.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function clearDocumentState(): void {
  state.currentHtml = "";
  state.currentRaw = "";
  state.currentTitle = "";
  state.currentHeadings = [];
  state.currentFrontMatter = {};
  headingObserver?.disconnect();
  const title = document.getElementById("documentTitle");
  if (title) title.hidden = true;
  const frontMatter = document.getElementById("frontMatter");
  if (frontMatter) frontMatter.hidden = true;
  const outline = document.getElementById("outlinePanel");
  if (outline) outline.hidden = true;
}

function renderTree(tree: TreeNode): void {
  const root = requireElement<HTMLElement>("#treeRoot");
  root.innerHTML = "";

  const list = document.createElement("ul");
  list.className = "tree";
  list.setAttribute("role", "tree");
  for (const child of tree.children) {
    const node = renderTreeNode(child);
    if (node !== null) {
      list.appendChild(node);
    }
  }
  root.appendChild(list);
  if (list.childElementCount === 0) {
    const empty = document.createElement("p");
    empty.className = "tree-empty";
    empty.textContent = "No matching documents.";
    root.appendChild(empty);
  }
}

function renderTreeNode(node: TreeNode): HTMLLIElement | null {
  if (!matchesSearch(node)) {
    return null;
  }

  if (node.type === "directory") {
    const item = document.createElement("li");
    item.className = "tree-item";
    item.setAttribute("role", "treeitem");
    item.setAttribute("aria-expanded", String(!state.collapsed.has(node.path)));
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
    list.setAttribute("role", "group");
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
  item.setAttribute("role", "treeitem");
  const button = document.createElement("button");
  button.className = "node";
  if (node.path === state.currentPath) {
    button.classList.add("active");
    button.setAttribute("aria-current", "page");
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

  if (node.type === "file" && state.searchMatches?.has(node.path)) return true;

  return node.type === "directory" && node.children.some(matchesSearch);
}

async function updateSearch(): Promise<void> {
  const query = requireElement<HTMLInputElement>("#treeSearch").value.trim();
  const requestId = state.searchRequestId + 1;
  state.searchRequestId = requestId;
  if (query.length < 2) {
    state.searchMatches = null;
    if (state.tree) renderTree(state.tree);
    return;
  }
  try {
    const entries = await searchDocuments(query);
    if (requestId !== state.searchRequestId) return;
    state.searchMatches = new Set(entries.map((entry) => entry.path));
    if (state.tree) renderTree(state.tree);
  } catch {
    if (requestId === state.searchRequestId)
      setStatus("Search failed", "error");
  }
}

async function searchDocuments(query: string): Promise<SearchEntry[]> {
  if (config.mode === "dev") {
    return fetchJson<SearchEntry[]>(
      `/api/search?q=${encodeURIComponent(query)}`,
    );
  }
  staticSearchIndex ??= await fetchJson<SearchEntry[]>(appUrl("search.json"));
  const terms = query.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return staticSearchIndex
    .filter((entry) => {
      const haystack =
        `${entry.path}\n${entry.title}\n${entry.text ?? ""}`.toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 100);
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

function collectDocumentPaths(node: TreeNode, values: string[] = []): string[] {
  if (node.type === "file") {
    values.push(node.path);
    return values;
  }
  for (const child of node.children) collectDocumentPaths(child, values);
  return values;
}

function renderPagination(path: string): void {
  const previous = requireElement<HTMLButtonElement>("#previousDocument");
  const next = requireElement<HTMLButtonElement>("#nextDocument");
  const paths = state.tree === null ? [] : collectDocumentPaths(state.tree);
  const index = paths.indexOf(path);
  configureNavigationButton(previous, paths[index - 1], "Previous");
  configureNavigationButton(next, paths[index + 1], "Next");
}

function configureNavigationButton(
  button: HTMLButtonElement,
  path: string | undefined,
  label: string,
): void {
  button.disabled = path === undefined;
  button.dataset.path = path ?? "";
  button.textContent = path === undefined ? label : `${label}: ${path}`;
}

function bindKeyboardNavigation(): void {
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      if (event.key === "Escape") target.blur();
      return;
    }
    if (event.key === "/") {
      event.preventDefault();
      requireElement<HTMLInputElement>("#treeSearch").focus();
      return;
    }
    if (event.key === "[" || event.key === "]") {
      const button = requireElement<HTMLButtonElement>(
        event.key === "[" ? "#previousDocument" : "#nextDocument",
      );
      if (!button.disabled) button.click();
    }
  });
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
  requireElement<HTMLButtonElement>("#renderedMode").setAttribute(
    "aria-pressed",
    String(mode === "rendered"),
  );
  requireElement<HTMLButtonElement>("#rawMode").setAttribute(
    "aria-pressed",
    String(mode === "raw"),
  );
  if (state.currentPath !== null) {
    renderCurrentDocument(state.currentPath);
  }
}

function initializeTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  const preference =
    saved === "system" || saved === "light" || saved === "dark"
      ? saved
      : (config.theme ?? "system");
  requireElement<HTMLSelectElement>("#themeSelect").value = preference;
  applyThemePreference(preference);
}

function initializePalette(): void {
  const palette =
    localStorage.getItem(PALETTE_KEY) ?? config.palette ?? "paper";
  document.body.dataset.palette = palette;
  requireElement<HTMLSelectElement>("#paletteSelect").value = palette;
}

function initializeReadingPreferences(): void {
  const savedFontSize = localStorage.getItem(FONT_SIZE_KEY);
  const fontSize =
    savedFontSize === "small" ||
    savedFontSize === "medium" ||
    savedFontSize === "large"
      ? savedFontSize
      : (config.fontSize ?? "medium");
  const savedContentWidth = localStorage.getItem(CONTENT_WIDTH_KEY);
  const contentWidth =
    savedContentWidth === "compact" ||
    savedContentWidth === "comfortable" ||
    savedContentWidth === "wide"
      ? savedContentWidth
      : (config.contentWidth ?? "comfortable");
  const savedOutline = localStorage.getItem(OUTLINE_KEY);
  const outline =
    savedOutline === "true"
      ? true
      : savedOutline === "false"
        ? false
        : (config.outline ?? true);

  document.body.dataset.fontSize = fontSize;
  document.body.dataset.contentWidth = contentWidth;
  document.body.dataset.outline = outline ? "visible" : "hidden";
  requireElement<HTMLSelectElement>("#fontSizeSelect").value = fontSize;
  requireElement<HTMLSelectElement>("#contentWidthSelect").value = contentWidth;
  requireElement<HTMLInputElement>("#outlineToggle").checked = outline;
}

function initializeSidebarWidth(): void {
  const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  applySidebarWidth(Number.isFinite(saved) ? saved : SIDEBAR_DEFAULT_WIDTH);
}

function applyThemePreference(preference: "system" | "light" | "dark"): void {
  document.body.dataset.theme =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : preference;
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
    await copyText(path);
    button.textContent = CONTEXT_COPY_SUCCESS_LABEL;
  } catch {
    button.textContent = CONTEXT_COPY_ERROR_LABEL;
  }

  contextMenuResetTimer = window.setTimeout(() => {
    resetContextMenuCopyLabel();
  }, 1600);
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText !== undefined) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

function updateCurrentHash(id: string): void {
  const url = new URL(window.location.href);
  url.hash = id;
  history.replaceState({}, "", url);
  setActiveOutlineHeading(id);
}

function setActiveOutlineHeading(id: string): void {
  for (const link of document.querySelectorAll("#outlineList a")) {
    link.classList.toggle(
      "active",
      (link as HTMLElement).dataset.headingId === id,
    );
  }
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

function writeCurrentPath(relativePath: string, hash = ""): void {
  const url = new URL(config.basePath, window.location.origin);
  url.searchParams.set("path", relativePath);
  url.hash = hash;
  history.replaceState({}, "", url);
}

function scrollToHash(hash: string | undefined): void {
  if (!hash) return;
  const id = decodeHash(hash);
  if (!id) return;
  scrollToHeading(id);
  setActiveOutlineHeading(id);
}

function decodeHash(hash: string): string | null {
  try {
    return decodeURIComponent(hash.replace(/^#/u, ""));
  } catch {
    return null;
  }
}

function scrollToHeading(id: string): void {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

function readConfig(): YomConfig {
  const element = document.getElementById("yom-config");
  if (element === null || element.textContent === null) {
    return { mode: "dev", basePath: "/" };
  }
  const parsed = JSON.parse(element.textContent) as Partial<YomConfig>;
  const basePath = `/${(parsed.basePath ?? "/").replace(/^\/+|\/+$/gu, "")}`;
  return {
    mode: parsed.mode === "static" ? "static" : "dev",
    basePath: basePath === "/" ? "/" : `${basePath}/`,
    initialPath: parsed.initialPath,
    notFound: parsed.notFound === true,
    title: parsed.title,
    lang: parsed.lang,
    theme: parsed.theme,
    palette: parsed.palette,
    fontSize: parsed.fontSize,
    contentWidth: parsed.contentWidth,
    outline: parsed.outline,
  };
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
    <a class="skip-link" href="#docRoot">Skip to document</a>
    <button class="mobile-nav-toggle" id="mobileNavToggle" type="button" aria-controls="sidebar" aria-expanded="false">Contents</button>
    <div class="layout">
      <aside id="sidebar">
        <div class="sidebar-header">
          <h1 class="brand">${escapeHtml(config.title ?? "yom")}</h1>
          <div class="sidebar-meta">
            <div class="status" id="statusBadge" data-state="ready" aria-live="polite">
              <span class="dot"></span><span id="statusText">${config.mode === "dev" ? "Watching" : "Static"}</span>
            </div>
            <details class="settings-panel">
              <summary class="settings-toggle" id="settingsToggle" aria-label="Display settings">
                <span aria-hidden="true">&#9881;</span>
              </summary>
              <div class="settings-card">
                <div class="settings-group">
                  <span class="settings-label">View</span>
                  <div class="view-mode" role="group">
                    <button class="active" id="renderedMode" type="button">Rendered</button>
                    <button id="rawMode" type="button">Raw</button>
                  </div>
                </div>
                <div class="settings-grid">
                  <label class="settings-control">
                    <span class="settings-label">Theme</span>
                    <select id="themeSelect">
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                  <label class="settings-control palette-picker">
                    <span class="settings-label">Palette</span>
                    <select id="paletteSelect">
                      <option value="paper">Paper</option>
                      <option value="forest">Forest</option>
                      <option value="sea">Sea</option>
                    </select>
                  </label>
                  <label class="settings-control">
                    <span class="settings-label">Text size</span>
                    <select id="fontSizeSelect">
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </label>
                  <label class="settings-control">
                    <span class="settings-label">Page width</span>
                    <select id="contentWidthSelect">
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
                  <input id="outlineToggle" type="checkbox" />
                </label>
                <button class="settings-reset" id="resetDisplaySettings" type="button">Reset display settings</button>
              </div>
            </details>
          </div>
        </div>
        <label class="search">
          <span class="search-label">Filter</span>
          <input id="treeSearch" type="search" placeholder="Search titles and content" />
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
      <main id="mainContent">
        <div class="reader-shell">
          <article class="content-panel">
            <div id="docMeta" class="doc-meta"></div>
            <h1 id="documentTitle" class="document-title" hidden></h1>
            <details id="frontMatter" class="front-matter" hidden>
              <summary>Metadata</summary>
              <dl id="frontMatterValues"></dl>
            </details>
            <div id="docRoot" class="empty">Select an item from the list on the left.</div>
            <pre id="rawRoot" class="raw-view" hidden><code></code></pre>
            <nav class="document-pagination" aria-label="Document navigation">
              <button id="previousDocument" type="button" disabled>Previous</button>
              <button id="nextDocument" type="button" disabled>Next</button>
            </nav>
          </article>
          <nav id="outlinePanel" class="outline-panel" aria-label="On this page" hidden>
            <div class="outline-title">On this page</div>
            <div id="outlineList" class="outline-list"></div>
          </nav>
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
