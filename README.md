# yom

`yom` is a local web viewer for Markdown files. It scans a directory tree, renders `.md` files, and serves them through a sidebar-based browser UI with live reload.

## Features

- Recursively discovers Markdown files
- Shows a file tree in the sidebar
- Renders Markdown as HTML
- Resolves relative links and image paths inside Markdown
- Watches for file changes and updates the browser automatically
- Starts a local server with a single command

## Getting Started

This repository is assumed to be cloned at `~/work/repos/yom` and to have `uv` available.

```bash
cd ~/work/repos/yom
uv sync
```

Minimal verification during development:

```bash
cd ~/work/repos/yom
./scripts/check.sh
```

To run formatting and lint checks separately:

```bash
cd ~/work/repos/yom
uv run ruff check .
uv run ruff format --check .
XDG_CACHE_HOME="$PWD/.cache" pnpx prettier@3 --check "src/yom/assets/*.{html,css,js}"
```

To format frontend assets:

```bash
cd ~/work/repos/yom
XDG_CACHE_HOME="$PWD/.cache" pnpx prettier@3 --write "src/yom/assets/*.{html,css,js}"
```

The UI templates live in [src/yom/assets](src/yom/assets). Edit that directory when you want to adjust appearance or client-side behavior.

## Usage

To browse the repository root:

```bash
cd ~/work/repos/yom
uv run yom .
```

To browse the sample `work/` directory:

```bash
cd ~/work/repos/yom
uv run yom work
```

By default, `yom` opens `http://127.0.0.1:8000` in your browser.

## Options

```bash
uv run yom ~/work/repos/yom/work --host 127.0.0.1 --port 8000 --interval 0.7 --title "yom docs"
```

Options available through `yom --help`:

- `root`: directory to scan
- `--host`: bind host
- `--port`: bind port
- `--interval`: polling interval for change detection, in seconds
- `--no-watch`: disable file watching
- `--watch-mode {auto,poll,watchdog}`: choose the watch backend
- `--title`: browser window title
- `--no-open`: disable automatic browser launch on startup
- `--markdown-extension NAME`: enable an additional Markdown extension
- `--no-default-extensions`: disable the built-in Markdown extensions

To switch Markdown extensions:

```bash
cd ~/work/repos/yom
uv run yom work --markdown-extension admonition
```

To try the app with the minimal Markdown configuration:

```bash
cd ~/work/repos/yom
uv run yom work --no-default-extensions
```

Relative link behavior:

- Markdown links such as `./other.md` and `../guide.md` are converted into in-app navigation
- Image paths such as `./image.png` are served as local assets
- References that point outside the directory tree are left unresolved and cannot be used to read external files

## Watch Verification

Quickest way to confirm file watching locally:

```bash
cd ~/work/repos/yom
uv run yom work
```

1. Open `http://127.0.0.1:8000` in the browser
2. Open one Markdown file under `work/`
3. Modify that file from another terminal
4. Confirm that the content and watch status update within a few seconds

To run without watching:

```bash
cd ~/work/repos/yom
uv run yom work --no-watch
```

To force `watchdog`:

```bash
cd ~/work/repos/yom
uv run yom work --watch-mode watchdog
```

To disable automatic browser opening:

```bash
cd ~/work/repos/yom
uv run yom work --no-open
```

## Japanese README

The Japanese translation is available at [README.ja.md](README.ja.md).
