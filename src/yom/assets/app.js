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
const docToc = document.getElementById("docToc");
const docTocRoot = document.getElementById("docTocRoot");
const tocCount = document.getElementById("tocCount");
const statusText = document.getElementById("statusText");
const statusBadge = document.getElementById("statusBadge");
const treeSearch = document.getElementById("treeSearch");
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
const VIEW_MODE_KEY = "yom-view-mode";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 304;

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
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  setViewMode(saved === "raw" ? "raw" : "rendered", { skipRender: true });
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
    docToc.hidden = true;
    return;
  }
  rawRoot.hidden = true;
  docRoot.hidden = false;
  docRoot.className = "";
  docRoot.innerHTML = state.currentHtml;
  renderOutline();
}

function renderLoadingState(path) {
  docMeta.textContent = path;
  docToc.hidden = true;
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
  docMeta.textContent = path;
  docToc.hidden = true;
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
  localStorage.setItem(VIEW_MODE_KEY, mode);
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
  docMeta.textContent = payload.path;
  docRoot.className = "";
  docRoot.innerHTML = state.currentHtml;
  rawCode.textContent = state.currentRaw;
  renderCurrentDocument();
  if (window.innerWidth <= 900) {
    document.body.classList.remove("nav-open");
    mobileNavToggle.setAttribute("aria-expanded", "false");
  }
  if (!options.skipTree && state.tree) {
    renderTree(state.tree);
  }
}

function ensureHeadingIds() {
  const headings = docRoot.querySelectorAll("h1, h2, h3, h4");
  for (const heading of headings) {
    if (heading.id) {
      continue;
    }
    const id = heading.textContent
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    heading.id = id || "section";
  }
  return headings;
}

function renderOutline() {
  docTocRoot.innerHTML = "";
  const headings = ensureHeadingIds();
  const outlineHeadings = Array.from(headings).filter(
    (heading) => heading.tagName !== "H1",
  );
  if (!outlineHeadings.length) {
    docToc.hidden = true;
    return;
  }
  for (const heading of outlineHeadings) {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.dataset.level = heading.tagName.slice(1);
    docTocRoot.appendChild(link);
  }
  tocCount.textContent = String(outlineHeadings.length);
  docToc.hidden = false;
  docToc.open = false;
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
  if (event.key === "Escape" && settingsPanel?.open) {
    settingsPanel.open = false;
  }
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
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
