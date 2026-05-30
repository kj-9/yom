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
from html.parser import HTMLParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    import markdown as markdown_lib
except ModuleNotFoundError:  # pragma: no cover
    markdown_lib = None

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except ModuleNotFoundError:  # pragma: no cover
    FileSystemEventHandler = None
    Observer = None


HTML_SHELL = files("yom").joinpath("assets/shell.html").read_text(encoding="utf-8")
APP_STYLE = files("yom").joinpath("assets/style.css").read_text(encoding="utf-8")
APP_SCRIPT = files("yom").joinpath("assets/app.js").read_text(encoding="utf-8")


def render_html_shell(title: str) -> str:
    return HTML_SHELL.format(
        title=html.escape(title),
        style=APP_STYLE,
        script=APP_SCRIPT,
    )


DEFAULT_MARKDOWN_EXTENSIONS = ["fenced_code", "tables", "toc", "sane_lists"]


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

    def resolve_relative(self, source: Path, raw_path: str) -> Path:
        relative_path = raw_path.strip()
        if not relative_path:
            raise FileNotFoundError(raw_path)
        candidate = (source.parent / Path(posixpath.normpath(relative_path))).resolve()
        if self.root not in candidate.parents and candidate != self.root:
            raise ValueError("invalid path")
        if not candidate.exists() or not candidate.is_file():
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
        return Node(
            name=current.name,
            path=current.relative_to(base).as_posix() if current != base else "",
            type="directory",
            children=children,
        )

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


class WatchdogEventHandler(FileSystemEventHandler):  # type: ignore[misc]
    def __init__(self, root: Path, index: SiteIndex, broker: WatchBroker) -> None:
        self.root = root
        self.index = index
        self.broker = broker

    def on_any_event(self, event: object) -> None:
        src_path = getattr(event, "src_path", None)
        if src_path is None:
            return
        path = Path(src_path)
        if path.suffix.lower() != ".md":
            return
        try:
            relative_parts = path.resolve().relative_to(self.root).parts
        except ValueError:
            return
        if any(part.startswith(".") for part in relative_parts):
            return
        self.index.refresh()
        self.broker.publish({"version": self.index.version, "timestamp": time.time()})


def create_watcher(
    root: Path, index: SiteIndex, broker: WatchBroker, interval: float, mode: str
) -> tuple[object | None, str]:
    if mode not in {"auto", "poll", "watchdog", "off"}:
        raise ValueError(f"unsupported watch mode: {mode}")
    if mode == "off":
        return None, "off"
    if mode in {"auto", "watchdog"} and Observer is not None and FileSystemEventHandler is not None:
        event_handler = WatchdogEventHandler(root=root, index=index, broker=broker)
        observer = Observer()
        observer.schedule(event_handler, str(root), recursive=True)
        return observer, "watchdog"
    if mode == "watchdog":
        raise RuntimeError("watchdog is not installed")
    return PollingWatcher(root=root, index=index, broker=broker, interval=interval), "poll"


def stop_watcher(watcher: object) -> None:
    watcher.stop()
    join = getattr(watcher, "join", None)
    if callable(join):
        join(timeout=1)


def render_markdown(text: str, *, extensions: list[str] | None = None) -> str:
    if markdown_lib is not None:
        return markdown_lib.markdown(
            text,
            extensions=DEFAULT_MARKDOWN_EXTENSIONS if extensions is None else extensions,
            output_format="html5",
        )
    escaped = html.escape(text)
    return f"<pre><code>{escaped}</code></pre>"


def is_local_relative_url(value: str) -> bool:
    stripped = value.strip()
    if not stripped or stripped.startswith(("#", "http://", "https://", "mailto:", "data:")):
        return False
    return not stripped.startswith("/")


class RelativeLinkRewriter(HTMLParser):
    def __init__(self, source: Path, index: SiteIndex) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.index = index
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(self._render_tag(tag, attrs, closing=False))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.parts.append(self._render_tag(tag, attrs, closing=True))

    def handle_endtag(self, tag: str) -> None:
        self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")

    def handle_comment(self, data: str) -> None:
        self.parts.append(f"<!--{data}-->")

    def handle_decl(self, decl: str) -> None:
        self.parts.append(f"<!{decl}>")

    def rewrite(self, content: str) -> str:
        self.feed(content)
        self.close()
        return "".join(self.parts)

    def _render_tag(self, tag: str, attrs: list[tuple[str, str | None]], *, closing: bool) -> str:
        rendered: list[str] = []
        for key, value in attrs:
            if value is None:
                rendered.append(key)
                continue
            rewritten = self._rewrite_attr(tag, key, value)
            rendered.append(f'{key}="{html.escape(rewritten, quote=True)}"')
        suffix = " /" if closing else ""
        return f"<{tag}{(' ' + ' '.join(rendered)) if rendered else ''}{suffix}>"

    def _rewrite_attr(self, tag: str, key: str, value: str) -> str:
        if tag == "img" and key == "src":
            return self._rewrite_path(value, asset_mode=True)
        if tag == "a" and key == "href":
            return self._rewrite_path(value, asset_mode=False)
        return value

    def _rewrite_path(self, value: str, *, asset_mode: bool) -> str:
        if not is_local_relative_url(value):
            return value
        try:
            target = self.index.resolve_relative(self.source, value)
        except (ValueError, FileNotFoundError):
            return value
        relative = target.relative_to(self.index.root).as_posix()
        if not asset_mode and target.suffix.lower() == ".md":
            return f"/?path={relative}"
        return f"/assets?path={relative}"


def rewrite_relative_links(content: str, *, source: Path, index: SiteIndex) -> str:
    return RelativeLinkRewriter(source=source, index=index).rewrite(content)


def make_handler(
    root: Path,
    index: SiteIndex,
    broker: WatchBroker,
    title: str,
    markdown_extensions: list[str] | None,
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/":
                return self._send_html(render_html_shell(title))
            if parsed.path == "/api/tree":
                return self._send_json(index.snapshot())
            if parsed.path == "/api/doc":
                return self._handle_doc(parsed.query)
            if parsed.path == "/assets":
                return self._handle_asset(parsed.query)
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
                "html": rewrite_relative_links(
                    render_markdown(source, extensions=markdown_extensions),
                    source=target,
                    index=index,
                ),
            }
            self._send_json(payload)

        def _handle_asset(self, query: str) -> None:
            params = parse_qs(query)
            raw_path = params.get("path", [""])[0]
            try:
                target = index.resolve_relative(root / "_index.md", raw_path)
            except ValueError:
                self.send_error(HTTPStatus.BAD_REQUEST, "invalid path")
                return
            except FileNotFoundError:
                self.send_error(HTTPStatus.NOT_FOUND, "missing asset file")
                return

            content_type, _ = mimetypes.guess_type(target.name)
            data = target.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

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
    markdown_extensions: list[str] | None = None,
    watch_mode: str = "auto",
) -> None:
    index = SiteIndex(root)
    broker = WatchBroker()
    watcher, active_watch_mode = create_watcher(
        root=root,
        index=index,
        broker=broker,
        interval=interval,
        mode="off" if not watch else watch_mode,
    )
    handler = make_handler(
        root=root,
        index=index,
        broker=broker,
        title=title,
        markdown_extensions=markdown_extensions,
    )
    server = ThreadingHTTPServer((host, port), handler)
    if watcher is not None:
        watcher.start()
    url = f"http://{host}:{port}"
    print(f"yom serving {root} at {url} (watch: {active_watch_mode})")
    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if watcher is not None:
            stop_watcher(watcher)
        server.server_close()
