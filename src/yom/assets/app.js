const state = {
  tree: null,
  currentPath: null,
  version: 0,
  firstPath: null,
  collapsed: new Set(),
};
const rootLabel = document.getElementById("rootLabel");
const treeRoot = document.getElementById("treeRoot");
const docRoot = document.getElementById("docRoot");
const docMeta = document.getElementById("docMeta");
const docTitle = document.getElementById("docTitle");
const docOpen = document.getElementById("docOpen");
const docJumpList = document.getElementById("docJumpList");
const outlineRoot = document.getElementById("outlineRoot");
const outlineSection = document.getElementById("outlineSection");
const statusText = document.getElementById("statusText");
const statusBadge = document.getElementById("statusBadge");
const treeSearch = document.getElementById("treeSearch");
const mobileNavToggle = document.getElementById("mobileNavToggle");
const themeToggle = document.getElementById("themeToggle");
const paletteSelect = document.getElementById("paletteSelect");
const docCount = document.getElementById("docCount");
const visibleCount = document.getElementById("visibleCount");

const THEME_KEY = "yom-theme";
const PALETTE_KEY = "yom-palette";

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

function ancestorDirectoryPaths(path) {
  if (!path) {
    return [];
  }
  const parts = path.split("/");
  const directories = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    directories.push(parts.slice(0, index + 1).join("/"));
  }
  return directories;
}

function isCollapsed(path) {
  if (!path) {
    return false;
  }
  return (
    state.collapsed.has(path) &&
    !ancestorDirectoryPaths(state.currentPath).includes(path)
  );
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

function countFiles(node) {
  if (node.type === "file") {
    return 1;
  }
  return node.children.reduce((total, child) => total + countFiles(child), 0);
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
  let visibleFiles = 0;
  for (const child of tree.children) {
    const childNode = renderTreeNode(child);
    if (childNode) {
      list.appendChild(childNode);
      visibleFiles += countFiles(child);
    }
  }
  docCount.textContent = String(countFiles(tree));
  visibleCount.textContent = String(visibleFiles);
  if (!list.childNodes.length) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = "一致する項目がありません。";
    treeRoot.appendChild(empty);
  } else {
    treeRoot.appendChild(list);
  }
  scrollActiveNodeIntoView();
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
  docTitle.textContent = "読み込み中...";
  const response = await fetch(`/api/doc?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    if (!options.fallbackPathTried && state.tree) {
      const fallbackPath = state.firstPath ?? state.currentPath;
      if (fallbackPath && fallbackPath !== path) {
        return loadDoc(fallbackPath, { ...options, fallbackPathTried: true });
      }
    }
    docMeta.textContent = path;
    docTitle.textContent = "読み込み失敗";
    docOpen.hidden = true;
    docJumpList.hidden = true;
    outlineSection.hidden = true;
    docRoot.className = "empty";
    docRoot.textContent = "項目を読み込めませんでした。";
    return;
  }
  const payload = await response.json();
  state.currentPath = payload.path;
  updateUrl(payload.path);
  docMeta.textContent = payload.path;
  docTitle.textContent =
    payload.path
      .split("/")
      .pop()
      .replace(/\.[^./]+$/, "") || payload.path;
  docOpen.hidden = false;
  docOpen.href = `/?path=${encodeURIComponent(payload.path)}`;
  docOpen.textContent = "この項目へのリンク";
  docRoot.className = "";
  docRoot.innerHTML = payload.html;
  renderOutline();
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
  outlineRoot.innerHTML = "";
  docJumpList.innerHTML = "";
  const headings = ensureHeadingIds();
  const outlineHeadings = Array.from(headings).filter(
    (heading) => heading.tagName !== "H1",
  );
  if (!outlineHeadings.length) {
    outlineSection.hidden = true;
    docJumpList.hidden = true;
    return;
  }
  for (const heading of outlineHeadings) {
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.dataset.level = heading.tagName.slice(1);
    outlineRoot.appendChild(link);
  }
  for (const heading of outlineHeadings.slice(0, 4)) {
    const chip = document.createElement("a");
    chip.href = `#${heading.id}`;
    chip.textContent = heading.textContent;
    docJumpList.appendChild(chip);
  }
  docJumpList.hidden = !docJumpList.childNodes.length;
  outlineSection.hidden = false;
}

const events = new EventSource("/events");
events.onmessage = async (event) => {
  const payload = JSON.parse(event.data);
  setStatus(
    `更新 ${new Date(payload.timestamp * 1000).toLocaleTimeString()}`,
    "updated",
  );
  await refreshTree(state.currentPath);
};
events.onerror = () => {
  setStatus("接続を再試行中", "reconnecting");
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
  mobileNavToggle.textContent = nextOpen ? "閉じる" : "コンテンツ一覧";
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

initializeTheme();
initializePalette();
setStatus("監視中", "ready");
refreshTree(currentPathFromUrl());
