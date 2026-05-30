#!/usr/bin/env bash

set -euo pipefail

uv run python -m compileall src tests
uv run ruff check .
uv run ruff format --check .
pnpx prettier@3 --check "src/yom/assets/*.{html,css,js}"
uv run pytest
