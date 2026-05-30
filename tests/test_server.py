from __future__ import annotations

from pathlib import Path

from yom.server import PollingWatcher, SiteIndex, WatchBroker, render_html_shell


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_site_index_builds_markdown_tree(tmp_path: Path) -> None:
    write(tmp_path / "guide.md", "# Guide")
    write(tmp_path / "notes" / "intro.md", "# Intro")
    write(tmp_path / "notes" / "draft.txt", "skip")
    write(tmp_path / ".hidden" / "secret.md", "# Secret")
    write(tmp_path / "empty" / "ignored.txt", "skip")

    index = SiteIndex(tmp_path)
    snapshot = index.snapshot()

    assert snapshot["first_path"] == "notes/intro.md"
    assert snapshot["tree"] == {
        "name": tmp_path.name,
        "path": "",
        "type": "directory",
        "children": [
            {
                "name": "notes",
                "path": "notes",
                "type": "directory",
                "children": [
                    {
                        "name": "intro.md",
                        "path": "notes/intro.md",
                        "type": "file",
                        "children": [],
                    }
                ],
            },
            {
                "name": "guide.md",
                "path": "guide.md",
                "type": "file",
                "children": [],
            },
        ],
    }


def test_resolve_rejects_paths_outside_root(tmp_path: Path) -> None:
    write(tmp_path / "docs" / "page.md", "# Page")
    index = SiteIndex(tmp_path)

    assert index.resolve("docs/page.md") == (tmp_path / "docs" / "page.md").resolve()

    for raw_path in ("../outside.md", "/../outside.md", "docs/missing.md", "docs"):
        try:
            index.resolve(raw_path)
        except (ValueError, FileNotFoundError):
            pass
        else:
            raise AssertionError(f"{raw_path!r} should not resolve")


def test_polling_watcher_scan_ignores_hidden_paths(tmp_path: Path) -> None:
    write(tmp_path / "visible.md", "# Visible")
    write(tmp_path / ".hidden" / "secret.md", "# Secret")

    watcher = PollingWatcher(
        root=tmp_path,
        index=SiteIndex(tmp_path),
        broker=WatchBroker(),
        interval=0.1,
    )

    snapshot = watcher._scan()

    assert list(snapshot) == ["visible.md"]


def test_make_handler_injects_custom_title(tmp_path: Path) -> None:
    assert "<title>docs portal</title>" in render_html_shell("docs portal")
    assert "<title>&lt;docs&gt;</title>" in render_html_shell("<docs>")
