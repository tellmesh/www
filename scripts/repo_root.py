"""Resolve hypervisor monorepo root from tellmesh/www scripts."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

_TELLMESH = Path(__file__).resolve().parents[2]
_HYPERVISOR_PATHS = _TELLMESH / "hypervisor" / "hypervisor" / "paths.py"


def hypervisor_root() -> Path:
    env = os.environ.get("HYPERVISOR_REPO_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    candidate = _TELLMESH / "tellmesh"
    if candidate.is_dir() and (candidate / "pyproject.toml").is_file():
        return candidate.resolve()
    legacy = _TELLMESH.parent / "wronai" / "hypervisor"
    if legacy.is_dir():
        return legacy.resolve()
    return Path("/home/tom/github/tellmesh/tellmesh").resolve()


def _resolve_www_dir(start: Path | None = None):
    spec = importlib.util.spec_from_file_location("hypervisor_paths", _HYPERVISOR_PATHS)
    if spec is None or spec.loader is None:
        raise SystemExit(f"missing hypervisor paths module: {_HYPERVISOR_PATHS}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.resolve_www_dir(start)


def www_dir() -> Path:
    resolved = _resolve_www_dir(hypervisor_root())
    if resolved is None or not (resolved / "index.html").is_file():
        tellmesh_www = _TELLMESH / "www"
        raise SystemExit(
            "TellMesh www checkout not found. "
            f"Expected {tellmesh_www}/index.html or set HYPERVISOR_WWW_DIR."
        )
    return resolved
