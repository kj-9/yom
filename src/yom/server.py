from __future__ import annotations

import html
import json
import mimetypes
import posixpath
import queue
import threading
import time
import webbrowser
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    import markdown as markdown_lib
except ModuleNotFoundError:  # pragma: no cover
    markdown_lib = None


HTML_SHELL = """<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f1e8;
      --panel: #fffaf0;
      --panel-strong: #efe5d0;
      --border: #d4c6aa;
      --text: #24190f;
      --muted: #6b5c4d;
      --accent: #a44a1f;
      --accent-soft: #f4d6bf;
      --code: #2f241d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, #fff4db 0, transparent 28%),
        linear-gradient(180deg, #f7f2e9 0%, #efe4cf 100%);
      min-height: 100vh;
    }
    .layout {
      display: grid;
      grid-template-columns: 320px minmax(0, 1fr);
      min-height: 100vh;
    }
    aside {
      border-right: 1px solid var(--border);
      background: rgba(255, 250, 240, 0.92);
      backdrop-filter: blur(12px);
      padding: 20px 16px;
      overflow: auto;
    }
    main {
      padding: 28px;
      overflow: auto;
    }
    .brand {
      margin: 0 0 8px;
      font-size: 1.7rem;
      letter-spacing: 0.08em;
    }
    .sub {
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .status {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 18px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--panel);
      color: var(--muted);
      font-size: 0.84rem;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #3f8f45;
      box-shadow: 0 0 0 5px rgba(63, 143, 69, 0.15);
    }
    .tree, .tree ul {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }
    .tree ul {
      padding-left: 16px;
      border-left: 1px solid rgba(164, 74, 31, 0.12);
      margin-left: 8px;
    }
    .tree-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin: 16px 0 8px;
    }
    .tree-item {
      margin: 2px 0;
    }
    .node {
      display: block;
      width: 100%;
      border: 0;
      background: transparent;
      text-align: left;
      padding: 8px 10px;
      margin: 2px 0;
      border-radius: 10px;
      color: var(--text);
      cursor: pointer;
      font: inherit;
    }
    .node:hover, .node.active {
      background: var(--accent-soft);
      color: #6b2405;
    }
    .folder {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: 0;
      background: transparent;
      font-weight: 700;
      color: var(--muted);
      padding: 8px 10px 4px;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .folder:hover {
      color: var(--accent);
    }
    .folder-caret {
      display: inline-block;
      width: 0.95rem;
      color: var(--accent);
      transition: transform 140ms ease;
    }
    .tree-item.collapsed > .folder .folder-caret {
      transform: rotate(-90deg);
    }
    .tree-item.collapsed > ul {
      display: none;
    }
    article {
      max-width: 920px;
      margin: 0 auto;
      background: rgba(255, 250, 240, 0.8);
      border: 1px solid rgba(212, 198, 170, 0.7);
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 18px 50px rgba(71, 45, 24, 0.08);
    }
    h1, h2, h3 { line-height: 1.15; }
    pre, code {
      font-family: "SFMono-Regular", "Menlo", monospace;
      color: #fdf6e7;
      background: var(--code);
    }
    code {
      padding: 0.15em 0.35em;
      border-radius: 6px;
    }
    pre {
      padding: 14px;
      border-radius: 16px;
      overflow: auto;
    }
    pre code {
      padding: 0;
      background: transparent;
    }
    blockquote {
      margin: 0;
      padding-left: 16px;
      border-left: 4px solid var(--accent);
      color: var(--muted);
    }
    a { color: var(--accent); }
    .empty {
      color: var(--muted);
      padding: 32px 0;
    }
    .meta {
      margin-bottom: 24px;
      color: var(--muted);
      font-size: 0.95rem;
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--border); }
      main { padding: 16px; }
      article { padding: 22px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside>
      <h1 class="brand">yom</h1>
      <p class="sub" id="rootLabel"></p>
      <div class="status"><span class="dot"></span><span id="statusText">監視中</span></div>
      <div class="tree-label">Markdown Tree</div>
      <div id="treeRoot"></div>
    </aside>
    <main>
      <article>
        <div class="meta" id="docMeta"></div>
        <div id="docRoot" class="empty">Markdown ファイルを選択してください。</div>
      </article>
    </main>
  </div>
  <script>
    const state = { tree: null, currentPath: null, version: 0, collapsed: new Set() };
    const rootLabel = document.getElementById("rootLabel");
    const treeRoot = document.getElementById("treeRoot");
    const docRoot = document.getElementById("docRoot");
    const docMeta = document.getElementById("docMeta");
    const statusText = document.getElementById("statusText");

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
      return state.collapsed.has(path) && !ancestorDirectoryPaths(state.currentPath).includes(path);
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

    function renderTreeNode(node) {
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
          list.appendChild(renderTreeNode(child));
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
        list.appendChild(renderTreeNode(child));
      }
      treeRoot.appendChild(list);
    }

    async function refreshTree(preferredPath = null) {
      const response = await fetch("/api/tree");
      const payload = await response.json();
      state.tree = payload.tree;
      state.version = payload.version;
      rootLabel.textContent = payload.root;
      renderTree(payload.tree);
      const target = preferredPath ?? state.currentPath ?? payload.first_path;
      if (target) {
        await loadDoc(target, { skipTree: true });
      }
    }

    async function loadDoc(path, options = {}) {
      const response = await fetch(`/api/doc?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        docRoot.className = "empty";
        docRoot.textContent = "ファイルを読み込めませんでした。";
        return;
      }
      const payload = await response.json();
      state.currentPath = payload.path;
      updateUrl(payload.path);
      docMeta.textContent = payload.path;
      docRoot.className = "";
      docRoot.innerHTML = payload.html;
      if (!options.skipTree && state.tree) {
        renderTree(state.tree);
      }
    }

    const events = new EventSource("/events");
    events.onmessage = async (event) => {
      const payload = JSON.parse(event.data);
      statusText.textContent = `監視中 / 更新 ${new Date(payload.timestamp * 1000).toLocaleTimeString()}`;
      await refreshTree(state.currentPath);
    };
    events.onerror = () => {
      statusText.textContent = "接続を再試行中";
    };

    window.addEventListener("popstate", () => {
      const path = currentPathFromUrl();
      if (path) {
        loadDoc(path);
      }
    });

    refreshTree(currentPathFromUrl());
  </script>
</body>
</html>
"""


def render_html_shell(title: str) -> str:
    return HTML_SHELL.replace("<title>{title}</title>", f"<title>{html.escape(title)}</title>")


@dataclass
class Node:
    name: str
    path: str
    type: str
    children: list["Node"]

    def as_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "path": self.path,
            "type": self.type,
            "children": [child.as_dict() for child in self.children],
        }


class SiteIndex:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._lock = threading.RLock()
        self.version = 0
        self.tree = Node(name=root.name, path="", type="directory", children=[])
        self.first_path: str | None = None
        self.refresh()

    def refresh(self) -> None:
        with self._lock:
            self.tree = self._build_tree(self.root, base=self.root)
            self.first_path = self._find_first(self.tree)
            self.version += 1

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            return {
                "root": str(self.root),
                "version": self.version,
                "first_path": self.first_path,
                "tree": self.tree.as_dict(),
            }

    def resolve(self, raw_path: str) -> Path:
        relative = Path(posixpath.normpath(raw_path.strip("/")))
        candidate = (self.root / relative).resolve()
        if self.root not in candidate.parents and candidate != self.root:
            raise ValueError("invalid path")
        if candidate.suffix.lower() != ".md" or not candidate.is_file():
            raise FileNotFoundError(raw_path)
        return candidate

    def _build_tree(self, current: Path, base: Path) -> Node:
        children: list[Node] = []
        for entry in sorted(current.iterdir(), key=lambda p: (p.is_file(), p.name.lower())):
            if entry.name.startswith("."):
                continue
            rel = entry.relative_to(base).as_posix()
            if entry.is_dir():
                subtree = self._build_tree(entry, base=base)
                if subtree.children:
                    children.append(subtree)
            elif entry.suffix.lower() == ".md":
                children.append(Node(name=entry.name, path=rel, type="file", children=[]))
        return Node(name=current.name, path=current.relative_to(base).as_posix() if current != base else "", type="directory", children=children)

    def _find_first(self, node: Node) -> str | None:
        for child in node.children:
            if child.type == "file":
                return child.path
            found = self._find_first(child)
            if found:
                return found
        return None


class WatchBroker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: set[queue.Queue[str]] = set()

    def subscribe(self) -> queue.Queue[str]:
        channel: queue.Queue[str] = queue.Queue()
        with self._lock:
            self._subscribers.add(channel)
        return channel

    def unsubscribe(self, channel: queue.Queue[str]) -> None:
        with self._lock:
            self._subscribers.discard(channel)

    def publish(self, payload: dict[str, object]) -> None:
        message = json.dumps(payload, ensure_ascii=False)
        with self._lock:
            for channel in list(self._subscribers):
                channel.put(message)


class PollingWatcher(threading.Thread):
    def __init__(self, root: Path, index: SiteIndex, broker: WatchBroker, interval: float) -> None:
        super().__init__(daemon=True)
        self.root = root
        self.index = index
        self.broker = broker
        self.interval = interval
        self._stop_event = threading.Event()
        self._snapshot = self._scan()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        while not self._stop_event.wait(self.interval):
            latest = self._scan()
            if latest != self._snapshot:
                self._snapshot = latest
                self.index.refresh()
                self.broker.publish(
                    {
                        "version": self.index.version,
                        "timestamp": time.time(),
                    }
                )

    def _scan(self) -> dict[str, tuple[int, int]]:
        snapshot: dict[str, tuple[int, int]] = {}
        for path in self.root.rglob("*.md"):
            if any(part.startswith(".") for part in path.relative_to(self.root).parts):
                continue
            try:
                stat = path.stat()
            except FileNotFoundError:
                continue
            snapshot[path.relative_to(self.root).as_posix()] = (
                stat.st_mtime_ns,
                stat.st_size,
            )
        return snapshot


def render_markdown(text: str) -> str:
    if markdown_lib is not None:
        return markdown_lib.markdown(
            text,
            extensions=["fenced_code", "tables", "toc", "sane_lists"],
            output_format="html5",
        )
    escaped = html.escape(text)
    return f"<pre><code>{escaped}</code></pre>"


def make_handler(root: Path, index: SiteIndex, broker: WatchBroker, title: str) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/":
                return self._send_html(render_html_shell(title))
            if parsed.path == "/api/tree":
                return self._send_json(index.snapshot())
            if parsed.path == "/api/doc":
                return self._handle_doc(parsed.query)
            if parsed.path == "/events":
                return self._handle_events()
            self.send_error(HTTPStatus.NOT_FOUND, "not found")

        def log_message(self, format: str, *args: object) -> None:
            return

        def _handle_doc(self, query: str) -> None:
            params = parse_qs(query)
            raw_path = params.get("path", [""])[0]
            try:
                target = index.resolve(raw_path)
            except ValueError:
                self.send_error(HTTPStatus.BAD_REQUEST, "invalid path")
                return
            except FileNotFoundError:
                self.send_error(HTTPStatus.NOT_FOUND, "missing markdown file")
                return

            source = target.read_text(encoding="utf-8")
            payload = {
                "path": target.relative_to(root).as_posix(),
                "html": render_markdown(source),
            }
            self._send_json(payload)

        def _handle_events(self) -> None:
            channel = broker.subscribe()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(b"retry: 1000\n\n")
            self.wfile.flush()
            try:
                while True:
                    message = channel.get(timeout=15)
                    self.wfile.write(f"data: {message}\n\n".encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, queue.Empty):
                pass
            finally:
                broker.unsubscribe(channel)

        def _send_html(self, content: str) -> None:
            encoded = content.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def _send_json(self, payload: dict[str, object]) -> None:
            encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

    return Handler


def serve(
    root: Path,
    host: str,
    port: int,
    interval: float,
    *,
    watch: bool = True,
    title: str = "yom",
    open_browser: bool = True,
) -> None:
    index = SiteIndex(root)
    broker = WatchBroker()
    watcher = PollingWatcher(root=root, index=index, broker=broker, interval=interval)
    handler = make_handler(root=root, index=index, broker=broker, title=title)
    server = ThreadingHTTPServer((host, port), handler)
    if watch:
        watcher.start()
    url = f"http://{host}:{port}"
    print(f"yom serving {root} at {url}")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if watch:
            watcher.stop()
        server.server_close()
