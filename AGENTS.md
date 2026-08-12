# Repository Guidelines

## Project Structure & Module Organization

The CLI entrypoint and command orchestration live in `src/cli/`. Markdown scanning,
rendering, link rewriting, routes, and static page generation live in `src/core/`.
Development-server middleware is in `src/dev/`, while the browser application and
styles are in `src/site/`. The executable wrapper is `bin/yom`, and Vite integration
is configured in `vite.config.ts`.

Tests live in `tests/unit/` and are grouped by behavior. Project-wide checks are
collected in `scripts/check.sh`. Product direction and sequencing are documented in
`ROADMAP.md`.

## Build, Test, and Development Commands

Install the local environment with `bun install`. Run the current directory with
`bun run dev --root .`, generate a static site with
`bun run build --root . --out-dir dist`, and inspect it with `bun run preview`.

Use `bun run test` for Vitest, `bun run check` for TypeScript, and `bun run format`
for Prettier verification. Install the E2E browser with
`bunx playwright install chromium chromium-headless-shell`, then run
`bun run test:e2e`. Use `bun run benchmark` for the guarded 100/1,000/10,000-file
tree scenarios. Run `./scripts/check.sh` before committing; it is the canonical full
local verification command. `bun.lock` is the canonical dependency lockfile.

## Coding Style & Naming Conventions

Use TypeScript with strict types, small focused functions, and explicit public types
where they clarify module boundaries. Use lower-case module names and hyphen-free
TypeScript filenames. Tests should use behavior-focused descriptions and `*.test.ts`
filenames. Keep browser code compatible with Prettier and avoid unnecessary DOM
replacement during live updates.

## Testing Guidelines

Add tests under `tests/unit/` next to the closest existing behavior area. Prefer
temporary directories, isolated ports, and explicit assertions over shared mutable
fixtures. CLI changes should be exercised from a caller directory outside this
repository. Distribution-sensitive changes should eventually be tested through a
packed and installed package, rather than only through source imports.

When changing file watching or live refresh, cover add, change, remove, reconnect,
and unchanged-content behavior as applicable. Run `./scripts/check.sh` after every
implementation slice.

## Commit & Pull Request Guidelines

Use short imperative commit subjects such as `Use event-driven Markdown refresh in
dev server`. Keep commits behavior-focused. Pull requests should summarize
user-visible changes, include verification notes, and link a relevant issue when one
exists. Include screenshots or a short recording for visible browser UI changes.

## Documentation Maintenance

Keep `README.md` and `README.ja.md` aligned when changing usage, options, setup,
publishing, or developer workflow. Update `ROADMAP.md` when a phase is completed or
its scope changes materially.

## Contributor Notes

Preserve unrelated changes already present in the worktree. The CLI must work when
invoked from another project and must not load that project's Vite configuration.
The default document language is `und`; do not infer a language from Markdown body
text.
