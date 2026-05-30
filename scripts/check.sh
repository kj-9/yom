#!/usr/bin/env bash

set -euo pipefail

python3 -m compileall src tests
uv run ruff check .
uv run ruff format --check .
uv run pytest
