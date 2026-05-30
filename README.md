# yom

`yom` is a local web viewer for Markdown trees. It scans a directory, renders `.md` files, and serves them in a sidebar-based browser UI with live reload.

## Features

- Recursively discovers Markdown files
- Shows a file tree in the sidebar
- Renders Markdown as HTML
- Resolves relative links and image paths inside Markdown
- Watches for file changes and updates the browser automatically
- Starts a local server with a single command

## Installation

Install from PyPI:

```bash
pip install yom
```

If you use `uv`, you can also run it without a manual virtual environment step:

```bash
uv tool install yom
```

## Quick Start

Serve the current directory:

```bash
yom .
```

Serve a specific directory:

```bash
yom /path/to/docs
```

By default, `yom` starts a local server on `http://127.0.0.1:8000` and opens it in your browser.

## Usage

```bash
yom /path/to/docs --host 127.0.0.1 --port 8000 --interval 0.7 --title "My docs"
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

Enable an extra Markdown extension:

```bash
yom /path/to/docs --markdown-extension admonition
```

Run with the minimal Markdown configuration:

```bash
yom /path/to/docs --no-default-extensions
```

## Relative Paths

- Markdown links such as `./other.md` and `../guide.md` are converted into in-app navigation
- Image paths such as `./image.png` are served as local assets
- References that point outside the scanned directory tree are left unresolved

## Watch Behavior

To disable file watching:

```bash
yom /path/to/docs --no-watch
```

To force the `watchdog` backend:

```bash
yom /path/to/docs --watch-mode watchdog
```

To disable automatic browser opening:

```bash
yom /path/to/docs --no-open
```

## Development

For local development with the repository checked out:

```bash
uv sync --group dev
make test
make ci-check
```

The Japanese translation is available at [README.ja.md](README.ja.md).
