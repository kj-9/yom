import { docRouteFromRelativePath } from "./routes";
import type { TreeNode } from "./scan";

export function renderStaticDocumentPage(options: {
  title: string;
  content: string;
  tree: TreeNode;
  activePath: string;
}): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)} | yom</title>
    <style>${sharedStyles()}</style>
  </head>
  <body>
    <div class="layout">
      <aside class="sidebar">
        <p class="eyebrow">yom build</p>
        <h1>Markdown tree</h1>
        <p class="lead">静的出力されたドキュメントをそのまま配布できます。</p>
        <nav class="tree">${renderStaticTree(options.tree, options.activePath)}</nav>
      </aside>
      <main class="content-shell">
        <header class="content-header">
          <p class="status">${escapeHtml(options.activePath)}</p>
          <h2>${escapeHtml(options.title)}</h2>
        </header>
        <article class="content">${options.content}</article>
      </main>
    </div>
  </body>
</html>
`;
}

export function renderStaticIndexPage(firstPath: string | null): string {
  const target =
    firstPath === null ? "/docs/" : docRouteFromRelativePath(firstPath);

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>yom</title>
  </head>
  <body>
    <p><a href="${target}">Open generated docs</a></p>
  </body>
</html>
`;
}

function renderStaticTree(node: TreeNode, activePath: string): string {
  return node.children
    .map((child) => {
      if (child.type === "file") {
        const active = child.path === activePath ? ' data-active="true"' : "";
        return `<a class="tree-link" href="${docRouteFromRelativePath(child.path)}"${active}>${escapeHtml(child.name)}</a>`;
      }

      return `<details class="tree-group" open><summary>${escapeHtml(child.name)}</summary><div class="tree-children">${renderStaticTree(child, activePath)}</div></details>`;
    })
    .join("");
}

function sharedStyles(): string {
  return `
    :root {
      color-scheme: light;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
      line-height: 1.5;
      font-weight: 400;
      background:
        radial-gradient(circle at top, rgba(231, 214, 185, 0.85), transparent 45%),
        linear-gradient(180deg, #f4ecdf 0%, #efe5d5 42%, #e5d7c1 100%);
      color: #2d241a;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    .layout {
      display: grid;
      grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
      min-height: 100vh;
    }
    .sidebar {
      padding: 32px 24px 48px;
      border-right: 1px solid rgba(81, 59, 36, 0.14);
      background: rgba(255, 249, 240, 0.7);
      backdrop-filter: blur(12px);
    }
    .content-shell { padding: 32px; }
    .content-header { margin-bottom: 24px; }
    .eyebrow, .status {
      margin: 0 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.78rem;
      color: #8a5a2f;
    }
    h1, h2 { margin: 0; line-height: 1.02; }
    h1 { font-size: clamp(2rem, 4vw, 3.5rem); }
    h2 { font-size: clamp(1.8rem, 3vw, 2.6rem); }
    .lead { margin: 16px 0 24px; max-width: 28ch; font-size: 1rem; }
    .tree { display: grid; gap: 8px; }
    .tree-group summary, .tree-link {
      display: block;
      color: inherit;
      text-decoration: none;
      padding: 8px 10px;
      border-radius: 10px;
    }
    .tree-group summary { cursor: pointer; font-weight: 600; }
    .tree-link[data-active="true"], .tree-link:hover, .tree-group summary:hover {
      background: rgba(141, 94, 44, 0.12);
    }
    .tree-children { display: grid; gap: 6px; margin: 6px 0 0 14px; }
    .content {
      width: min(960px, 100%);
      padding: 32px;
      border: 1px solid rgba(81, 59, 36, 0.16);
      border-radius: 24px;
      background: rgba(255, 249, 240, 0.82);
      box-shadow: 0 24px 80px rgba(78, 58, 39, 0.12);
      backdrop-filter: blur(8px);
    }
    .content img { max-width: 100%; }
    .content pre { overflow: auto; padding: 16px; border-radius: 12px; background: #efe4d2; }
    .content code { font-family: "SFMono-Regular", "Menlo", monospace; }
    @media (max-width: 640px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { border-right: 0; border-bottom: 1px solid rgba(81, 59, 36, 0.14); }
      .content-shell { padding: 20px 12px 32px; }
      .content { padding: 24px 18px; }
    }
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
