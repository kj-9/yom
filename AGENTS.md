# Repository Guidelines

## Project Structure & Module Organization
Core Python code lives in `src/yom/`. Use `cli.py` for argument parsing and startup flow, and `server.py` for indexing, Markdown rendering, file watching, and HTTP handling. Browser assets are kept in `src/yom/assets/` (`shell.html`, `style.css`, `app.js`). Tests live in `tests/` and mirror behavior by area with `test_cli.py` and `test_server.py`. Utility checks are in `scripts/check.sh`.

## Build, Test, and Development Commands
Set up the local environment with `uv sync --group dev`. Run the app locally with `uv run yom .` or target a sample tree with `uv run yom work --no-open`. Use `make test` to run `pytest`, and `make ci-check` to run formatting, lint, and type checks together. `./scripts/check.sh` is the quickest full verification pass because it also compiles `src` and `tests` and checks frontend assets with Prettier.

## Coding Style & Naming Conventions
Follow Python 3.11 conventions with 4-space indentation, type hints, and small focused functions. Keep module names lowercase with underscores only when needed; tests should use `test_<behavior>` names. Format Python with `uv run ruff format .`, lint with `uv run ruff check .`, and type-check with `uv run ty check`. For frontend files under `src/yom/assets/`, use Prettier-compatible formatting.

## Testing Guidelines
This project uses `pytest`. Add tests in `tests/test_cli.py` for CLI flags and startup behavior, and in `tests/test_server.py` for indexing, rendering, path resolution, and watcher behavior. Prefer temporary directories and explicit assertions over shared fixtures. Run `make test` during development and `./scripts/check.sh` before opening a PR.

## Commit & Pull Request Guidelines
Recent commits use short imperative subjects such as `Add settings panel for theme and palette selection` and `Fix typing for optional watchdog imports`. Keep commit messages concise, specific, and behavior-focused. PRs should include a clear summary, linked issue when applicable, and notes on user-visible changes. Include screenshots or a short screen recording for UI changes in `src/yom/assets/`.

## Documentation Maintenance
Keep `README.md` and `README.ja.md` aligned when changing usage, options, setup, or developer workflow. If one README gains new commands or behavior notes, update the other in the same change unless the difference is intentionally language-specific.

## Contributor Notes
Preserve user changes already present in the worktree, especially unrelated edits such as existing `README.md` modifications.
