from __future__ import annotations

import subprocess
from pathlib import Path

from yom.server import (
    DEFAULT_MARKDOWN_EXTENSIONS,
    PollingWatcher,
    SiteIndex,
    WatchBroker,
    create_watcher,
    render_html_shell,
    render_markdown,
    rewrite_relative_links,
)


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


def test_site_index_ignores_gitignored_markdown_by_default(tmp_path: Path) -> None:
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    write(tmp_path / ".gitignore", "ignored/\nignored.md\n")
    write(tmp_path / "visible.md", "# Visible")
    write(tmp_path / "ignored.md", "# Ignored")
    write(tmp_path / "ignored" / "nested.md", "# Nested")

    snapshot = SiteIndex(tmp_path).snapshot()

    assert snapshot["first_path"] == "visible.md"
    assert snapshot["tree"] == {
        "name": tmp_path.name,
        "path": "",
        "type": "directory",
        "children": [
            {
                "name": "visible.md",
                "path": "visible.md",
                "type": "file",
                "children": [],
            }
        ],
    }


def test_polling_watcher_scan_ignores_gitignored_paths(tmp_path: Path) -> None:
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    write(tmp_path / ".gitignore", "ignored.md\n")
    write(tmp_path / "visible.md", "# Visible")
    write(tmp_path / "ignored.md", "# Ignored")

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
    html = render_html_shell("docs portal")
    assert "scrollActiveNodeIntoView" in html
    assert "firstPath" in html
    assert "window.mermaid" in html


def test_render_markdown_keeps_mermaid_fence_as_code_block() -> None:
    html = render_markdown("```mermaid\ngraph TD\n  A-->B\n```")

    assert "language-mermaid" in html
    assert "graph TD" in html


def test_render_markdown_uses_configured_extensions() -> None:
    html = render_markdown("| a |\n| - |\n| b |", extensions=["tables"])
    assert "<table>" in html

    plain_html = render_markdown("| a |\n| - |\n| b |", extensions=[])
    assert "<table>" not in plain_html
    assert DEFAULT_MARKDOWN_EXTENSIONS


def test_rewrite_relative_links_rewrites_markdown_and_assets(tmp_path: Path) -> None:
    write(tmp_path / "guide.md", "# Guide")
    write(tmp_path / "docs" / "page.md", "# Page")
    write(tmp_path / "docs" / "image.png", "png")
    index = SiteIndex(tmp_path)

    rewritten = rewrite_relative_links(
        '<p><a href="../guide.md">guide</a> <img src="image.png" alt="img"></p>',
        source=tmp_path / "docs" / "page.md",
        index=index,
    )

    assert 'href="/?path=guide.md"' in rewritten
    assert 'src="/assets?path=docs/image.png"' in rewritten


def test_rewrite_relative_links_leaves_invalid_or_external_links(tmp_path: Path) -> None:
    write(tmp_path / "docs" / "page.md", "# Page")
    index = SiteIndex(tmp_path)

    rewritten = rewrite_relative_links(
        (
            '<p><a href="https://example.com">ext</a> '
            '<a href="../missing.md">missing</a> '
            '<img src="../secret.png"></p>'
        ),
        source=tmp_path / "docs" / "page.md",
        index=index,
    )

    assert 'href="https://example.com"' in rewritten
    assert 'href="../missing.md"' in rewritten
    assert 'src="../secret.png"' in rewritten


def test_create_watcher_returns_polling_when_requested(tmp_path: Path) -> None:
    watcher, mode = create_watcher(tmp_path, SiteIndex(tmp_path), WatchBroker(), 0.1, "poll")

    assert isinstance(watcher, PollingWatcher)
    assert mode == "poll"


def test_create_watcher_disables_watch_when_off(tmp_path: Path) -> None:
    watcher, mode = create_watcher(tmp_path, SiteIndex(tmp_path), WatchBroker(), 0.1, "off")

    assert watcher is None
    assert mode == "off"
