from __future__ import annotations

import errno
from pathlib import Path

import pytest

import yom.cli as cli
from yom.cli import build_parser


def test_parser_supports_title_and_no_watch() -> None:
    parser = build_parser()

    args = parser.parse_args(["docs", "--no-watch", "--title", "My Docs"])

    assert args.root == "docs"
    assert args.no_watch is True
    assert args.title == "My Docs"
    assert args.host == "127.0.0.1"
    assert args.port == 8000
    assert args.interval == 0.7
    assert args.no_open is False


def test_parser_supports_no_open() -> None:
    parser = build_parser()

    args = parser.parse_args(["docs", "--no-open"])

    assert args.no_open is True


def test_parser_supports_markdown_extension_options() -> None:
    parser = build_parser()

    args = parser.parse_args(
        ["docs", "--markdown-extension", "admonition", "--markdown-extension", "nl2br", "--no-default-extensions"]
    )

    assert args.markdown_extension == ["admonition", "nl2br"]
    assert args.no_default_extensions is True


def test_parser_supports_watch_mode() -> None:
    parser = build_parser()

    args = parser.parse_args(["docs", "--watch-mode", "poll"])

    assert args.watch_mode == "poll"


def test_main_shows_helpful_message_when_port_is_in_use(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def fake_serve(**_: object) -> None:
        raise OSError(errno.EADDRINUSE, "Address already in use")

    monkeypatch.setattr(cli, "serve", fake_serve)
    monkeypatch.setattr(cli, "Path", Path)
    monkeypatch.setattr("sys.argv", ["yom", str(tmp_path), "--port", "8000"])

    with pytest.raises(SystemExit) as excinfo:
        cli.main()

    assert excinfo.value.code == 2


def test_main_opens_browser_by_default(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    def fake_serve(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(cli, "serve", fake_serve)
    monkeypatch.setattr(cli, "Path", Path)
    monkeypatch.setattr("sys.argv", ["yom", str(tmp_path)])

    assert cli.main() == 0
    assert captured["open_browser"] is True


def test_main_can_disable_browser_open(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    def fake_serve(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(cli, "serve", fake_serve)
    monkeypatch.setattr(cli, "Path", Path)
    monkeypatch.setattr("sys.argv", ["yom", str(tmp_path), "--no-open"])

    assert cli.main() == 0
    assert captured["open_browser"] is False


def test_main_passes_markdown_extensions(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    def fake_serve(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(cli, "serve", fake_serve)
    monkeypatch.setattr(cli, "Path", Path)
    monkeypatch.setattr(
        "sys.argv",
        ["yom", str(tmp_path), "--markdown-extension", "admonition", "--no-default-extensions"],
    )

    assert cli.main() == 0
    assert captured["markdown_extensions"] == ["admonition"]


def test_main_passes_watch_mode(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    captured: dict[str, object] = {}

    def fake_serve(**kwargs: object) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(cli, "serve", fake_serve)
    monkeypatch.setattr(cli, "Path", Path)
    monkeypatch.setattr("sys.argv", ["yom", str(tmp_path), "--watch-mode", "poll"])

    assert cli.main() == 0
    assert captured["watch_mode"] == "poll"
