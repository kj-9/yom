#!/usr/bin/env bash

set -euo pipefail

uv run python -m compileall src tests
uv run ruff check .
uv run ruff format --check .
bunx prettier --check "src/yom/assets/*.{html,css,js}"
bun run check
bun run format
bun run test
uv run pytest
