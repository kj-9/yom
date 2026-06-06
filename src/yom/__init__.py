from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version
from pathlib import Path

__all__ = ["__version__"]


def _load_version() -> str:
    try:
        return version("yom")
    except PackageNotFoundError:
        pyproject_path = Path(__file__).resolve().parents[2] / "pyproject.toml"
        for line in pyproject_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("version = "):
                return line.split('"', maxsplit=2)[1]
        msg = "Could not determine package version from pyproject.toml"
        raise RuntimeError(msg)


__version__ = _load_version()
