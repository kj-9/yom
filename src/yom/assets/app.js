const state = {
  tree: null,
  currentPath: null,
  version: 0,
  firstPath: null,
  collapsed: new Set(),
  currentHtml: "",
  currentRaw: "",
  viewMode: "rendered",
  loadRequestId: 0,
};
const rootLabel = document.getElementById("rootLabel");
const treeRoot = document.getElementById("treeRoot");
const docRoot = document.getElementById("docRoot");
const rawRoot = document.getElementById("rawRoot");
const rawCode = rawRoot.querySelector("code");
const docMeta = document.getElementById("docMeta");
const statusText = document.getElementById("statusText");
const statusBadge = document.getElementById("statusBadge");
const treeSearch = document.getElementById("treeSearch");
const treeContextMenu = document.getElementById("treeContextMenu");
const contextMenuOpen = document.getElementById("contextMenuOpen");
const contextMenuCopyPath = document.getElementById("contextMenuCopyPath");
const contextMenuOpenTab = document.getElementById("contextMenuOpenTab");
const mobileNavToggle = document.getElementById("mobileNavToggle");
const themeToggle = document.getElementById("themeToggle");
const paletteSelect = document.getElementById("paletteSelect");
const settingsPanel = document.querySelector(".settings-panel");
const collapseTree = document.getElementById("collapseTree");
const expandTree = document.getElementById("expandTree");
const sidebarResizer = document.getElementById("sidebarResizer");
const layout = document.querySelector(".layout");
const renderedMode = document.getElementById("renderedMode");
const rawMode = document.getElementById("rawMode");

const THEME_KEY = "yom-theme";
const PALETTE_KEY = "yom-palette";
const SIDEBAR_WIDTH_KEY = "yom-sidebar-width";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 304;
const CONTEXT_COPY_LABEL = "Copy path";
const CONTEXT_COPY_SUCCESS_LABEL = "Copied";
const CONTEXT_COPY_ERROR_LABEL = "Copy failed";

let contextMenuPath = null;
let contextMenuResetTimer = null;
let mermaidInitialized = false;

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}

function applyPalette(palette) {
  document.body.dataset.palette = palette;
  paletteSelect.value = palette;
}

function initializeTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function initializePalette() {
  const saved = localStorage.getItem(PALETTE_KEY);
  applyPalette(saved || "paper");
}

function initializeViewMode() {
  setViewMode("rendered", { skipRender: true });
}

function clampSidebarWidth(width) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

function applySidebarWidth(width) {
  const nextWidth = clampSidebarWidth(width);
  document.documentElement.style.setProperty(
    "--sidebar-width",
    `${nextWidth}px`,
  );
  sidebarResizer.setAttribute("aria-valuenow", String(nextWidth));
  return nextWidth;
}

function initializeSidebarWidth() {
  const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  applySidebarWidth(Number.isFinite(saved) ? saved : SIDEBAR_DEFAULT_WIDTH);
}

function setStatus(text, state = "ready") {
  statusText.textContent = text;
  statusBadge.dataset.state = state;
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(input);
  if (!copied) {
    throw new Error("copy failed");
  }
}

function resetContextMenuCopyLabel() {
  if (contextMenuResetTimer) {
    clearTimeout(contextMenuResetTimer);
    contextMenuResetTimer = null;
  }
  if (contextMenuCopyPath) {
    contextMenuCopyPath.textContent = CONTEXT_COPY_LABEL;
  }
}

function closeTreeContextMenu() {
  if (!treeContextMenu) {
    return;
  }
  treeContextMenu.hidden = true;
  contextMenuPath = null;
  resetContextMenuCopyLabel();
}

function openTreeContextMenu(path, x, y) {
  if (!treeContextMenu) {
    return;
  }

  contextMenuPath = path;
  resetContextMenuCopyLabel();
  treeContextMenu.hidden = false;

  const { innerWidth, innerHeight } = window;
  const menuRect = treeContextMenu.getBoundingClientRect();
  const left = Math.min(x, innerWidth - menuRect.width - 12);
  const top = Math.min(y, innerHeight - menuRect.height - 12);

  treeContextMenu.style.left = `${Math.max(12, left)}px`;
  treeContextMenu.style.top = `${Math.max(12, top)}px`;
}

async function copyPath(path, button) {
  if (!path) {
    return;
  }

  try {
    await writeClipboardText(path);
    if (button) {
      button.textContent = CONTEXT_COPY_SUCCESS_LABEL;
      contextMenuResetTimer = window.setTimeout(() => {
        if (button.isConnected) {
          button.textContent = CONTEXT_COPY_LABEL;
        }
      }, 1600);
    }
  } catch {
    if (button) {
      button.textContent = CONTEXT_COPY_ERROR_LABEL;
      contextMenuResetTimer = window.setTimeout(() => {
        if (button.isConnected) {
          button.textContent = CONTEXT_COPY_LABEL;
        }
      }, 2200);
    }
  }
}

function currentPathFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("path");
}

function updateUrl(path) {
  const url = new URL(window.location.href);
  if (path) {
    url.searchParams.set("path", path);
  } else {
    url.searchParams.delete("path");
  }
  history.replaceState({}, "", url);
}

function isCollapsed(path) {
  if (!path) {
    return false;
  }
  return state.collapsed.has(path);
}

function toggleDirectory(path) {
  if (state.collapsed.has(path)) {
    state.collapsed.delete(path);
  } else {
    state.collapsed.add(path);
  }
  if (state.tree) {
    renderTree(state.tree);
  }
}

function collectDirectoryPaths(node, paths = []) {
  if (node.type !== "directory") {
    return paths;
  }
  if (node.path) {
    paths.push(node.path);
  }
  for (const child of node.children) {
    collectDirectoryPaths(child, paths);
  }
  return paths;
}

function collapseAllDirectories() {
  if (!state.tree) {
    return;
  }
  state.collapsed = new Set(collectDirectoryPaths(state.tree));
  renderTree(state.tree);
}

function expandAllDirectories() {
  state.collapsed.clear();
  if (state.tree) {
    renderTree(state.tree);
  }
}

function matchesSearch(node) {
  const query = treeSearch.value.trim().toLowerCase();
  if (!query) {
    return true;
  }
  if (
    node.name.toLowerCase().includes(query) ||
    node.path.toLowerCase().includes(query)
  ) {
    return true;
  }
  if (node.type === "directory") {
    return node.children.some(matchesSearch);
  }
  return false;
}

function renderTreeNode(node) {
  if (!matchesSearch(node)) {
    return null;
  }
  if (node.type === "directory") {
    const wrapper = document.createElement("li");
    wrapper.className = "tree-item";
    if (isCollapsed(node.path)) {
      wrapper.classList.add("collapsed");
    }
    const label = document.createElement("button");
    label.className = "folder";
    label.type = "button";
    label.onclick = () => toggleDirectory(node.path);
    const caret = document.createElement("span");
    caret.className = "folder-caret";
    caret.textContent = "▾";
    const text = document.createElement("span");
    text.textContent = node.name;
    label.append(caret, text);
    wrapper.appendChild(label);
    const list = document.createElement("ul");
    for (const child of node.children) {
      const childNode = renderTreeNode(child);
      if (childNode) {
        list.appendChild(childNode);
      }
    }
    if (!list.childNodes.length) {
      return null;
    }
    wrapper.appendChild(list);
    return wrapper;
  }
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.className = "node";
  if (node.path === state.currentPath) {
    button.classList.add("active");
  }
  button.textContent = node.name;
  button.onclick = () => loadDoc(node.path);
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openTreeContextMenu(node.path, event.clientX, event.clientY);
  });
  item.appendChild(button);
  return item;
}

function renderTree(tree) {
  treeRoot.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "tree";
  for (const child of tree.children) {
    const childNode = renderTreeNode(child);
    if (childNode) {
      list.appendChild(childNode);
    }
  }
  if (!list.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = "No matching items.";
    treeRoot.appendChild(empty);
  } else {
    treeRoot.appendChild(list);
  }
  scrollActiveNodeIntoView();
}

function renderCurrentDocument() {
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
  renderMermaidDiagrams();
}

function initializeMermaid() {
  if (mermaidInitialized || typeof window.mermaid === "undefined") {
    return;
  }
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: document.body.dataset.theme === "dark" ? "dark" : "default",
  });
  mermaidInitialized = true;
}

function restoreMermaidCodeBlocks() {
  for (const graph of docRoot.querySelectorAll(".mermaid")) {
    const wrapper = graph.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      continue;
    }
    const fallback = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.textContent = graph.textContent || "";
    fallback.appendChild(code);
    wrapper.replaceWith(fallback);
  }
}

function renderMermaidDiagrams() {
  if (typeof window.mermaid === "undefined") {
    return;
  }

  initializeMermaid();
  const blocks = docRoot.querySelectorAll("pre > code.language-mermaid");
  if (!blocks.length) {
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
    graph.textContent = block.textContent || "";
    wrapper.appendChild(graph);
    container.replaceWith(wrapper);
  }

  window.mermaid
    .run({ nodes: docRoot.querySelectorAll(".mermaid") })
    .catch(() => {
      restoreMermaidCodeBlocks();
    });
}

function renderLoadingState(path) {
  if (docMeta) {
    docMeta.textContent = path;
  }
  if (state.viewMode === "raw") {
    docRoot.hidden = true;
    rawRoot.hidden = false;
    rawCode.textContent = "Loading...";
    return;
  }
  rawRoot.hidden = true;
  docRoot.className = "empty";
  docRoot.hidden = false;
  docRoot.textContent = "Loading...";
}

function renderLoadError(path) {
  if (docMeta) {
    docMeta.textContent = path;
  }
  if (state.viewMode === "raw") {
    docRoot.hidden = true;
    rawRoot.hidden = false;
    rawCode.textContent = "Could not load the item.";
    return;
  }
  rawRoot.hidden = true;
  docRoot.className = "empty";
  docRoot.hidden = false;
  docRoot.textContent = "Could not load the item.";
}

function setViewMode(mode, options = {}) {
  state.viewMode = mode;
  renderedMode.classList.toggle("active", mode === "rendered");
  rawMode.classList.toggle("active", mode === "raw");
  renderedMode.setAttribute("aria-pressed", String(mode === "rendered"));
  rawMode.setAttribute("aria-pressed", String(mode === "raw"));
  if (!options.skipRender && state.currentPath) {
    renderCurrentDocument();
  }
}

function scrollActiveNodeIntoView() {
  const activeNode = treeRoot.querySelector(".node.active");
  if (activeNode) {
    activeNode.scrollIntoView({ block: "nearest" });
  }
}

async function refreshTree(preferredPath = null) {
  const response = await fetch("/api/tree");
  const payload = await response.json();
  state.tree = payload.tree;
  state.version = payload.version;
  state.firstPath = payload.first_path;
  rootLabel.textContent = payload.root;
  const target = preferredPath ?? state.currentPath ?? payload.first_path;
  if (target) {
    await loadDoc(target, { skipTree: true });
    renderTree(payload.tree);
  } else {
    renderTree(payload.tree);
  }
}

async function loadDoc(path, options = {}) {
  const requestId = state.loadRequestId + 1;
  state.loadRequestId = requestId;
  renderLoadingState(path);
  const response = await fetch(`/api/doc?path=${encodeURIComponent(path)}`);
  if (requestId !== state.loadRequestId) {
    return;
  }
  if (!response.ok) {
    if (!options.fallbackPathTried && state.tree) {
      const fallbackPath = state.firstPath ?? state.currentPath;
      if (fallbackPath && fallbackPath !== path) {
        return loadDoc(fallbackPath, { ...options, fallbackPathTried: true });
      }
    }
    renderLoadError(path);
    return;
  }
  const payload = await response.json();
  if (requestId !== state.loadRequestId) {
    return;
  }
  state.currentPath = payload.path;
  state.currentHtml = payload.html;
  state.currentRaw = payload.raw;
  updateUrl(payload.path);
  if (docMeta) {
    docMeta.textContent = payload.path;
  }
  renderCurrentDocument();
  if (window.innerWidth <= 900) {
    document.body.classList.remove("nav-open");
    mobileNavToggle.setAttribute("aria-expanded", "false");
  }
  if (!options.skipTree && state.tree) {
    renderTree(state.tree);
  }
}

function pathFromInAppLink(link) {
  const href = link.getAttribute("href");
  if (!href) {
    return null;
  }
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname !== "/") {
    return null;
  }
  return url.searchParams.get("path");
}

const events = new EventSource("/events");
events.onmessage = async (event) => {
  const payload = JSON.parse(event.data);
  setStatus(
    `Updated ${new Date(payload.timestamp * 1000).toLocaleTimeString()}`,
    "updated",
  );
  await refreshTree(state.currentPath);
};
events.onerror = () => {
  setStatus("Reconnecting", "reconnecting");
};

window.addEventListener("popstate", () => {
  const path = currentPathFromUrl();
  if (path) {
    loadDoc(path);
  }
});

treeSearch.addEventListener("input", () => {
  if (state.tree) {
    renderTree(state.tree);
  }
});

treeSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    treeSearch.value = "";
    if (state.tree) {
      renderTree(state.tree);
    }
  }
});

docRoot.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }
  const path = pathFromInAppLink(link);
  if (!path) {
    return;
  }
  event.preventDefault();
  loadDoc(path);
});

document.addEventListener("click", (event) => {
  if (!treeContextMenu || treeContextMenu.hidden) {
    return;
  }
  if (treeContextMenu.contains(event.target)) {
    return;
  }
  closeTreeContextMenu();
});

document.addEventListener(
  "scroll",
  () => {
    if (!treeContextMenu?.hidden) {
      closeTreeContextMenu();
    }
  },
  true,
);

mobileNavToggle.addEventListener("click", () => {
  const nextOpen = !document.body.classList.contains("nav-open");
  document.body.classList.toggle("nav-open", nextOpen);
  mobileNavToggle.setAttribute("aria-expanded", String(nextOpen));
  mobileNavToggle.textContent = nextOpen ? "Close" : "Contents";
});

document.addEventListener("click", (event) => {
  if (!settingsPanel?.open) {
    return;
  }
  if (!settingsPanel.contains(event.target)) {
    settingsPanel.open = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !treeContextMenu?.hidden) {
    closeTreeContextMenu();
    return;
  }
  if (event.key === "Escape" && settingsPanel?.open) {
    settingsPanel.open = false;
  }
});

contextMenuOpen?.addEventListener("click", () => {
  if (!contextMenuPath) {
    return;
  }
  loadDoc(contextMenuPath);
  closeTreeContextMenu();
});

contextMenuCopyPath?.addEventListener("click", async () => {
  if (!contextMenuPath) {
    return;
  }
  await copyPath(contextMenuPath, contextMenuCopyPath);
  window.setTimeout(closeTreeContextMenu, 300);
});

contextMenuOpenTab?.addEventListener("click", () => {
  if (!contextMenuPath) {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("path", contextMenuPath);
  window.open(url.toString(), "_blank", "noopener");
  closeTreeContextMenu();
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
  mermaidInitialized = false;
  if (state.viewMode === "rendered" && state.currentPath) {
    renderCurrentDocument();
  }
});

paletteSelect.addEventListener("change", () => {
  localStorage.setItem(PALETTE_KEY, paletteSelect.value);
  applyPalette(paletteSelect.value);
});

collapseTree.addEventListener("click", collapseAllDirectories);
expandTree.addEventListener("click", expandAllDirectories);
renderedMode.addEventListener("click", () => setViewMode("rendered"));
rawMode.addEventListener("click", () => setViewMode("raw"));

sidebarResizer.addEventListener("pointerdown", (event) => {
  if (window.innerWidth <= 900) {
    return;
  }
  event.preventDefault();
  document.body.classList.add("resizing-sidebar");
  sidebarResizer.setPointerCapture(event.pointerId);
});

sidebarResizer.addEventListener("pointermove", (event) => {
  if (!document.body.classList.contains("resizing-sidebar")) {
    return;
  }
  const layoutLeft = layout.getBoundingClientRect().left;
  applySidebarWidth(event.clientX - layoutLeft);
});

function stopSidebarResize(event) {
  if (!document.body.classList.contains("resizing-sidebar")) {
    return;
  }
  document.body.classList.remove("resizing-sidebar");
  const width = sidebarResizer.getAttribute("aria-valuenow");
  localStorage.setItem(SIDEBAR_WIDTH_KEY, width);
  if (event.pointerId !== undefined) {
    sidebarResizer.releasePointerCapture(event.pointerId);
  }
}

sidebarResizer.addEventListener("pointerup", stopSidebarResize);
sidebarResizer.addEventListener("pointercancel", stopSidebarResize);
sidebarResizer.addEventListener("dblclick", () => {
  const width = applySidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
});

sidebarResizer.addEventListener("keydown", (event) => {
  const currentWidth = Number(sidebarResizer.getAttribute("aria-valuenow"));
  let nextWidth = currentWidth;
  if (event.key === "ArrowLeft") {
    nextWidth = currentWidth - 16;
  } else if (event.key === "ArrowRight") {
    nextWidth = currentWidth + 16;
  } else if (event.key === "Home") {
    nextWidth = SIDEBAR_MIN_WIDTH;
  } else if (event.key === "End") {
    nextWidth = SIDEBAR_MAX_WIDTH;
  } else {
    return;
  }
  event.preventDefault();
  const width = applySidebarWidth(nextWidth);
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
});

initializeTheme();
initializePalette();
initializeViewMode();
initializeSidebarWidth();
setStatus("Watching", "ready");
refreshTree(currentPathFromUrl());
