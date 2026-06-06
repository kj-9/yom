# yom

`yom` is a Bun-powered local web viewer and static site builder for Markdown trees.
It scans a directory, renders `.md` files, and serves them in a sidebar-based browser UI
with live reload.

## Features

- Recursively discovers Markdown files
- Shows a file tree in the sidebar
- Renders Markdown as HTML
- Renders Mermaid code fences as diagrams in the browser
- Resolves relative links and image paths inside Markdown
- Watches for file changes and updates the browser automatically
- Builds a static site from the same content tree

## Quick Start

Install dependencies:

```bash
bun install
```

Start the dev server for the current directory:

```bash
bun run dev --root .
```

Build a static site:

```bash
bun run build --root . --out-dir dist
```

Preview the built site:

```bash
bun run preview
```

You can also invoke the linked CLI directly:

```bash
bun link
yom dev --root .
```

## Usage

```bash
yom dev --root /path/to/docs --host 127.0.0.1 --port 4173
```

```bash
yom build --root /path/to/docs --out-dir dist
```

```bash
yom preview --host 127.0.0.1 --port 4173
```

Options available through `yom --help`:

- `dev`: start the Vite development server
- `build`: build the static site into the output directory
- `preview`: preview the built site with Vite
- `--root`: root directory to serve or build
- `--out-dir`: output directory for build artifacts
- `--host`: bind host for dev or preview
- `--port`: bind port for dev or preview

`bun run build` generates static document pages into `dist/docs/`, copies non-Markdown
assets into `dist/assets/`, and writes `dist/tree.json`.

`bun run dev` serves:

- `/api/tree`: scanned Markdown tree
- `/api/doc?path=...`: rendered HTML payload for one Markdown file
- `/assets/...`: local referenced assets

## Relative Paths

- Markdown links such as `./other.md` and `../guide.md` are converted into in-app navigation
- Image paths such as `./image.png` are served as local assets
- References that point outside the scanned directory tree are left unresolved

## Development

Install dependencies:

```bash
bun install
```

Run the main checks:

```bash
bun run check
bun run format
bun run test
bun run build
```

You can also use the helper script:

```bash
./scripts/check.sh
```

Frontend files live in [src/site](/Users/kh03/work/repos/yom/src/site). The CLI entrypoint is
[src/cli/index.ts](/Users/kh03/work/repos/yom/src/cli/index.ts).

Equivalent npm scripts remain available for compatibility:

```bash
npm run dev -- --root .
npm run build -- --root . --out-dir dist
npm run preview
npm run test
```

The Japanese translation is available at [README.ja.md](README.ja.md).

## Publishing

Install the CLI locally from this repository:

```bash
bun install
bun link
```

Check the package contents:

```bash
npm pack
```

Dry-run a publish:

```bash
bun run dryrun-publish
```

Publish an alpha release:

```bash
bun publish --tag alpha --access public
```

This package expects `bun` to be available at runtime.
