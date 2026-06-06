from __future__ import annotations

import argparse
import errno
from pathlib import Path

from yom import __version__
from yom.server import DEFAULT_MARKDOWN_EXTENSIONS, serve


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="yom",
        description="Serve a Markdown file tree as a local website.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=".",
        help="Directory to scan",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", default=8000, type=int, help="Bind port")
    parser.add_argument(
        "--interval",
        default=0.7,
        type=float,
        help="Polling interval for change detection, in seconds",
    )
    parser.add_argument(
        "--no-watch",
        action="store_true",
        help="Disable file watching",
    )
    parser.add_argument(
        "--title",
        default="yom",
        help="Browser window title",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="Disable automatic browser launch on startup",
    )
    parser.add_argument(
        "--markdown-extension",
        action="append",
        default=[],
        metavar="NAME",
        help="Enable an additional Markdown extension. May be specified multiple times",
    )
    parser.add_argument(
        "--no-default-extensions",
        action="store_true",
        help="Disable the built-in Markdown extensions",
    )
    parser.add_argument(
        "--watch-mode",
        choices=["auto", "poll", "watchdog"],
        default="auto",
        help="Watch backend. auto prefers watchdog and falls back to poll if unavailable",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        parser.error(f"Directory does not exist: {root}")
    if not root.is_dir():
        parser.error(f"Not a directory: {root}")
    markdown_extensions = [] if args.no_default_extensions else list(DEFAULT_MARKDOWN_EXTENSIONS)
    markdown_extensions.extend(args.markdown_extension)
    try:
        serve(
            root=root,
            host=args.host,
            port=args.port,
            interval=args.interval,
            watch=not args.no_watch,
            title=args.title,
            open_browser=not args.no_open,
            markdown_extensions=markdown_extensions,
            watch_mode=args.watch_mode,
        )
    except RuntimeError as exc:
        parser.error(str(exc))
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            parser.error(
                f"Port {args.port} is already in use. Choose a different one with `--port`."
            )
        raise
    return 0
