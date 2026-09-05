# yom

`yom` is a Node.js-compatible local web viewer and static site builder for Markdown trees.
It scans a directory, renders `.md` files, and serves them in a sidebar-based browser UI
with live reload.

Bun is used for repository development and tests. The published CLI is compiled ESM and
requires Node.js 22.12 or newer; Bun is not required at runtime.

## Features

- Recursively discovers Markdown files
- Shows a file tree in the sidebar
- Renders Markdown as HTML
- Renders Mermaid code fences as diagrams in the browser
- Resolves relative links and image paths inside Markdown
- Watches for file changes and updates the browser automatically
- Builds a static site from the same content tree
- Searches file names, titles, and Markdown body text
- Shows a scroll-aware heading outline and previous/next navigation
- Reads simple front matter for page titles and metadata
- Provides heading-link and code-block copy actions
- Supports keyboard navigation and print-friendly output

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
yom build --root /path/to/docs --out-dir dist --base /
```

```bash
yom preview --host 127.0.0.1 --port 4173 --base / --out-dir dist
```

Options available through `yom --help`:

- `dev`: start the Vite development server
- `build`: build the static site into the output directory
- `preview`: preview the built site with Vite
- `--root`: root directory to serve or build
- `--out-dir`: output directory for build artifacts
- `--host`: bind host for dev or preview
- `--port`: bind port for dev or preview
- `--base`: public base path used by build and preview
- `--config`: explicit path to `yom.config.ts`

## Configuration

Place `yom.config.ts` in the caller directory or the Markdown root. CLI options
override the corresponding configuration values.

```ts
import { defineConfig } from "@kj-9/yom";

export default defineConfig({
  title: "Project docs",
  lang: "ja",
  include: ["README.md", "docs/**/*.md"],
  exclude: ["docs/drafts/**"],
  initialPage: "README.md",
  order: ["README.md", "docs"],
  base: "/project/",
  theme: "system",
  palette: "paper",
  fontSize: "medium",
  contentWidth: "comfortable",
  outline: true,
  outDir: "dist",
  open: false,
});
```

Without a config file, the document language remains `und`; yom does not infer a
language from Markdown body text. Invalid or unknown configuration values stop the
command with an explanatory error.

`bun run build` bundles the same browser app used by dev, writes rendered document data
to `dist/data/`, creates direct route shells in `dist/docs/`, copies referenced files to
`dist/assets/`, and writes `dist/tree.json` and `dist/404.html`. Use `--base /project/`
when the site is hosted below a subpath such as GitHub Pages.

`bun run dev` serves:

- `/api/tree`: scanned Markdown tree
- `/api/doc?path=...`: rendered HTML payload for one Markdown file
- `/assets/...`: local referenced assets

## Relative Paths

- Markdown links such as `./other.md` and `../guide.md` are converted into in-app navigation
- Image paths such as `./image.png` are served as local assets
- References that point outside the scanned directory tree are left unresolved

## Reading controls

- Press `/` to focus full-text search
- Press `[` or `]` to open the previous or next document
- Press `Escape` to leave a search or form control
- Use the `#` action beside a heading to copy its URL
- Use the copy action on fenced code blocks to copy their contents
- The page outline stays visible while a long document scrolls
- Display settings include system/light/dark themes, palette, text size, page
  width, and outline visibility; browser choices are saved locally
- Use **Reset display settings** to return to the `yom.config.ts` defaults
- Front matter supports simple scalar values and inline arrays such as
  `tags: [one, two]`

## Development

Install dependencies:

```bash
bun install
bunx playwright install chromium chromium-headless-shell
```

Run the main checks:

```bash
bun run check
bun run compile
bun run format
bun run test
bun run test:e2e
bun run benchmark
bun run build
```

You can also use the helper script:

```bash
./scripts/check.sh
```

Frontend files live in [src/site](src/site). The CLI entrypoint is
[src/cli/index.ts](src/cli/index.ts). Planned work is tracked in
[ROADMAP.md](ROADMAP.md).

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

Inspect the files that would be packed without creating a tarball:

```bash
npm pack --dry-run
```

Releases are published from `.github/workflows/publish.yml` with npm trusted
publishing. Configure the `@kj-9/yom` trusted publisher on npm once with:

- repository: `kj-9/yom`
- workflow: `publish.yml`
- environment: `release`
- allowed action: `npm publish`

To publish, update `package.json`, push the release commit, then publish a GitHub
release whose tag exactly matches `v<version>` (for example,
`v0.1.0-alpha.4`; mark alpha and beta releases as prereleases). CI verifies the
package before publishing it. The registry tag is selected automatically: `alpha`,
`beta`, or `latest`.

The workflow uses short-lived OIDC credentials and does not require an npm token in
GitHub Secrets. Running `bun run release` locally still requires an authenticated npm
session.

The published CLI runs on Node.js 22.12 or later; Bun is only required for
repository development and tests.
