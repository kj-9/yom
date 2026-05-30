
.PHONY: help venv install install-dev lint format typecheck test ci-check check build sdist wheel clean distclean publish

# Prefer using `uv` when available (CI uses astral-sh/setup-uv)
UV_RUN ?= uv run --frozen

help:
	@printf "Available targets: venv install install-dev format lint typecheck test ci-check check build sdist wheel clean distclean publish\n"

venv:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip

install: venv
	.venv/bin/pip install -e .

install-dev: install
	.venv/bin/pip install pytest ruff build ty

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

build:
	uv build

sdist: venv
	.venv/bin/python -m build --sdist

wheel: venv
	.venv/bin/python -m build --wheel

clean:
	rm -rf build dist *.egg-info .pytest_cache __pycache__ .coverage

distclean: clean
	rm -rf .venv

publish: build
	.venv/bin/pip install --upgrade twine
	.venv/bin/python -m twine upload dist/*
