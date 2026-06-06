
.PHONY: help sync install install-dev lint format typecheck test ci-check check web-check web-build build sdist wheel clean distclean publish

UV ?= uv
WEB ?= bun
UV_CACHE_DIR ?= $(CURDIR)/.cache/uv
UV_SYNC ?= $(UV) sync --frozen --group dev
UV_RUN ?= $(UV) run --frozen

export UV_CACHE_DIR

help:
	@printf "Available targets: sync install install-dev format lint typecheck test ci-check check web-check web-build build sdist wheel clean distclean publish\n"

sync:
	$(UV_SYNC)


format:
	$(UV_RUN) ruff format .

lint:
	$(UV_RUN) ruff check . --fix

typecheck:
	$(UV_RUN) ty check

test:
	$(UV_RUN) pytest

ci-check:
	$(UV_RUN) ruff format . --check
	$(UV_RUN) ruff check .
	$(UV_RUN) ty check

check:
	$(MAKE) -j format lint typecheck

web-check:
	$(WEB) run check
	$(WEB) run format
	$(WEB) run test

web-build:
	$(WEB) run build

build:
	$(UV) build


clean:
	rm -rf build dist *.egg-info .pytest_cache __pycache__ .coverage

distclean: clean
	rm -rf .venv

publish: build
	$(UV_RUN) publish
