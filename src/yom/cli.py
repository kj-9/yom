from __future__ import annotations

import argparse
import errno
from pathlib import Path

from yom.server import DEFAULT_MARKDOWN_EXTENSIONS, serve


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="yom",
        description="Markdown ファイルツリーをローカルサイトとして表示します。",
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=".",
        help="探索対象ディレクトリ",
    )
    parser.add_argument("--host", default="127.0.0.1", help="待受ホスト")
    parser.add_argument("--port", default=8000, type=int, help="待受ポート")
    parser.add_argument(
        "--interval",
        default=0.7,
        type=float,
        help="更新監視のポーリング間隔(秒)",
    )
    parser.add_argument(
        "--no-watch",
        action="store_true",
        help="ファイル更新監視を無効にする",
    )
    parser.add_argument(
        "--title",
        default="yom",
        help="ブラウザのタイトルバーに表示する文字列",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="起動時のブラウザ自動オープンを無効にする",
    )
    parser.add_argument(
        "--markdown-extension",
        action="append",
        default=[],
        metavar="NAME",
        help="追加で有効化する Markdown 拡張機能。複数回指定可",
    )
    parser.add_argument(
        "--no-default-extensions",
        action="store_true",
        help="既定の Markdown 拡張機能を無効にする",
    )
    parser.add_argument(
        "--watch-mode",
        choices=["auto", "poll", "watchdog"],
        default="auto",
        help="監視方式。auto は watchdog 優先、未導入時は poll にフォールバック",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        parser.error(f"ディレクトリが存在しません: {root}")
    if not root.is_dir():
        parser.error(f"ディレクトリではありません: {root}")
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
                f"ポート {args.port} はすでに使用中です。`--port` で別の番号を指定してください。"
            )
        raise
    return 0
