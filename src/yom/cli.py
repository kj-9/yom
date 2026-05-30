from __future__ import annotations

import argparse
import errno
from pathlib import Path

from yom.server import serve


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
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        parser.error(f"ディレクトリが存在しません: {root}")
    if not root.is_dir():
        parser.error(f"ディレクトリではありません: {root}")
    try:
        serve(
            root=root,
            host=args.host,
            port=args.port,
            interval=args.interval,
            watch=not args.no_watch,
            title=args.title,
            open_browser=not args.no_open,
        )
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            parser.error(
                f"ポート {args.port} はすでに使用中です。`--port` で別の番号を指定してください。"
            )
        raise
    return 0
