#!/usr/bin/env bash

set -euo pipefail

python3 -m compileall src tests
uv run ruff check .
uv run ruff format --check .
XDG_CACHE_HOME="$PWD/.cache" pnpx prettier@3 --check "src/yom/assets/*.{html,css,js}"
uv run pytest
