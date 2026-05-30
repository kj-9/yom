from __future__ import annotations

import argparse
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
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        parser.error(f"ディレクトリが存在しません: {root}")
    if not root.is_dir():
        parser.error(f"ディレクトリではありません: {root}")
    serve(root=root, host=args.host, port=args.port, interval=args.interval)
    return 0
