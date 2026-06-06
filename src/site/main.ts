import "./styles.css";
import { relativePathFromDocRoute } from "../core/routes";

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

let currentPath: string | null = null;
let lastTreeSignature = "";

void bootstrap();

async function bootstrap(): Promise<void> {
  app.innerHTML = renderShell();

  const snapshot = await fetchJson<SiteSnapshot>("/api/tree");
  lastTreeSignature = JSON.stringify(snapshot.tree);
  const initialPath = readCurrentPath() ?? snapshot.firstPath;

  bindTree(snapshot.tree);

  if (initialPath !== null) {
    await openDocument(initialPath);
  } else {
    renderEmptyState("No Markdown files found.");
  }

  window.addEventListener("hashchange", () => {
    const nextPath = readCurrentPath();
    if (nextPath !== null) {
      void openDocument(nextPath);
    }
  });

  requireElement<HTMLElement>("[data-content]").addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (link === null) {
        return;
      }

      const href = link.getAttribute("href");
      if (href === null) {
        return;
      }

      const relativePath = relativePathFromDocRoute(href);
      if (relativePath === null) {
        return;
      }

      event.preventDefault();
      void openDocument(relativePath);
    },
  );

  window.setInterval(() => {
    void refreshContent();
  }, 2000);
}

function bindTree(tree: TreeNode): void {
  const nav = requireElement<HTMLElement>("[data-tree]");
  nav.replaceChildren(renderTree(tree));
}

async function openDocument(
  relativePath: string,
  options?: { silent?: boolean },
): Promise<void> {
  const normalized = relativePath.replace(/^#?\/?/u, "");
  currentPath = normalized;
  writeCurrentPath(normalized);
  if (!options?.silent) {
    setStatus("Loading…");
  }

  try {
    const payload = await fetchJson<DocumentPayload>(
      `/api/doc?path=${encodeURIComponent(normalized)}`,
    );
    renderDocument(payload);
    highlightActivePath(normalized);
    setStatus(payload.path);
  } catch (error) {
    renderEmptyState(
      error instanceof Error ? error.message : "Failed to load document.",
    );
    setStatus("Load failed");
  }
}

async function refreshContent(): Promise<void> {
  try {
    const snapshot = await fetchJson<SiteSnapshot>("/api/tree");
    const nextSignature = JSON.stringify(snapshot.tree);
    if (nextSignature !== lastTreeSignature) {
      lastTreeSignature = nextSignature;
      bindTree(snapshot.tree);
    }

    const nextPath = currentPath ?? snapshot.firstPath;
    if (nextPath !== null) {
      await openDocument(nextPath, { silent: true });
    }
  } catch {
    setStatus("Refresh failed");
  }
}

function renderDocument(payload: DocumentPayload): void {
  const heading = requireElement<HTMLElement>("[data-title]");
  const article = requireElement<HTMLElement>("[data-content]");
  heading.textContent = payload.path;
  article.innerHTML = payload.html;
}

function renderEmptyState(message: string): void {
  const heading = requireElement<HTMLElement>("[data-title]");
  const article = requireElement<HTMLElement>("[data-content]");
  heading.textContent = "yom";
  article.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
}

function renderTree(node: TreeNode): DocumentFragment {
  const fragment = document.createDocumentFragment();

  for (const child of node.children) {
    if (child.type === "file") {
      const link = document.createElement("a");
      link.className = "tree-link";
      link.href = `#/${child.path}`;
      link.dataset.path = child.path;
      link.textContent = child.name;
      fragment.append(link);
      continue;
    }

    const details = document.createElement("details");
    details.className = "tree-group";
    details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = child.name;
    details.append(summary);

    const group = document.createElement("div");
    group.className = "tree-children";
    group.append(renderTree(child));
    details.append(group);
    fragment.append(details);
  }

  return fragment;
}

function highlightActivePath(relativePath: string): void {
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    ".tree-link",
  )) {
    link.dataset.active = link.dataset.path === relativePath ? "true" : "false";
  }
}

function renderShell(): string {
  return `
    <div class="layout">
      <aside class="sidebar">
        <p class="eyebrow">yom dev</p>
        <h1>Markdown tree</h1>
        <p class="lead">Bun + Vite で Markdown ツリーをそのまま閲覧します。</p>
        <nav class="tree" data-tree></nav>
      </aside>
      <main class="content-shell">
        <header class="content-header">
          <p class="status" data-status>Ready</p>
          <h2 data-title>yom</h2>
        </header>
        <article class="content" data-content></article>
      </main>
    </div>
  `;
}

function readCurrentPath(): string | null {
  const hash = window.location.hash.replace(/^#\/?/u, "");
  return hash.length > 0 ? decodeURIComponent(hash) : null;
}

function writeCurrentPath(relativePath: string): void {
  const nextHash = `#/${encodeURIComponent(relativePath)}`;
  if (window.location.hash !== nextHash) {
    history.replaceState(null, "", nextHash);
  }
}

function setStatus(text: string): void {
  requireElement<HTMLElement>("[data-status]").textContent = text;
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
