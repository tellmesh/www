#!/usr/bin/env python3
"""Build www/generated/examples-manifest.js from examples/*/README.md (+ ABOUT.md)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))
from repo_root import hypervisor_root, www_dir  # noqa: E402

ROOT = hypervisor_root()
_root = str(ROOT)
if _root in sys.path:
    sys.path.remove(_root)
sys.path.insert(0, _root)

EXAMPLES = ROOT / "examples"
OUT = www_dir() / "generated" / "examples-manifest.js"
OFFICE_CHAINS = EXAMPLES / "office_chains.yaml"

from about_parser import load_about  # noqa: E402

import yaml  # noqa: E402


def natural_key(name: str) -> list:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def extract_title(readme: Path, fallback: str) -> str:
    if not readme.is_file():
        return fallback
    for line in readme.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip().split("—", 1)[-1].strip()
    return fallback


# Declarative category rules (lowers CC; order matters, first match wins).
_CATEGORY_RULES: list[tuple[callable, str]] = [
    (lambda n: "office" in n or n.startswith("31_") or n.startswith("33_"), "office"),
    (lambda n: "browser" in n or "android" in n or "pcwin" in n or "playwright" in n, "operator"),
    (lambda n: "workflow" in n or "flow" in n or "graph" in n or n.startswith("14_"), "workflow"),
    (lambda n: "touri" in n or "voice" in n or "markpact" in n, "touri"),
    (lambda n: "tutorial" in n or "quickstart" in n or "golden" in n, "tutorial"),
    (lambda n: "agent" in n or n.startswith("0"), "agents"),
]

def category_for(name: str) -> str:
    for predicate, cat in _CATEGORY_RULES:
        if predicate(name):
            return cat
    return "workflow"


def _build_office_chain(chain: dict) -> dict | None:
    """Pure builder for one office chain dict; returns None if invalid."""
    if not isinstance(chain, dict):
        return None
    steps = [str(step) for step in chain.get("steps") or [] if str(step).strip()]
    if not steps:
        return None
    return {
        "id": str(chain.get("id") or "-".join(steps[:2])),
        "title": str(chain.get("title") or chain.get("id") or "Office chain"),
        "chat": str(chain.get("chat") or ""),
        "steps": steps,
        "i18n": chain.get("i18n") if isinstance(chain.get("i18n"), dict) else {},
    }

def load_office_chains() -> list[dict]:
    if not OFFICE_CHAINS.is_file():
        return []
    raw = yaml.safe_load(OFFICE_CHAINS.read_text(encoding="utf-8"))
    chains = raw.get("chains") if isinstance(raw, dict) else None
    if not isinstance(chains, list):
        return []
    out = []
    for chain in chains:
        built = _build_office_chain(chain)
        if built:
            out.append(built)
    return out


def test_summary() -> dict:
    from tests.examples.catalog import ALL_EXAMPLES, RUN_SH_EXAMPLES

    return {
        "pytest": f"{len(ALL_EXAMPLES)} catalogued · see pytest tests/examples",
        "runSh": f"{len(RUN_SH_EXAMPLES)} run.sh · bash scripts/test-all-examples.sh",
        "testedAt": "generated",
    }


def build_manifest() -> dict:
    items = []
    for path in sorted(EXAMPLES.iterdir(), key=lambda p: natural_key(p.name)):
        if not path.is_dir():
            continue
        readme = path / "README.md"
        run_sh = path / "run.sh"
        if not readme.is_file() and not run_sh.is_file():
            continue
        about = path / "ABOUT.md"
        office = None
        if about.is_file():
            loaded = load_about(about)
            for card in loaded["cards"]:
                tag = ((card.get("i18n") or {}).get("en") or {}).get("tag")
                if tag:
                    office = tag
                    break
        num = path.name.split("_", 1)[0]
        cmd = f"bash examples/{path.name}/run.sh" if run_sh.is_file() else f"# see examples/{path.name}/README.md"
        items.append(
            {
                "id": path.name,
                "num": num,
                "category": category_for(path.name),
                "title": extract_title(readme, path.name),
                "desc": extract_title(readme, path.name),
                "cmd": cmd,
                "uris": [],
                "office": office,
            }
        )
    return {
        "testSummary": test_summary(),
        "examples": items,
        "officeChains": load_office_chains(),
        "categoryLabels": {
            "all": "All",
            "agents": "Agents",
            "operator": "Operator (Web · Android · Windows)",
            "workflow": "Workflow",
            "office": "Office",
            "touri": "Touri / capability",
            "tutorial": "Tutorial",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    manifest = build_manifest()
    content = f"window.__EXAMPLES_MANIFEST__ = {json.dumps(manifest, ensure_ascii=False, indent=2)};\n"
    OUT.parent.mkdir(parents=True, exist_ok=True)

    if args.check and OUT.is_file() and OUT.read_text(encoding="utf-8") == content:
        print(f"OK unchanged: {OUT}")
        return 0
    if args.check:
        print(f"STALE: {OUT}", file=sys.stderr)
        return 1

    OUT.write_text(content, encoding="utf-8")
    print(f"Wrote {OUT} ({len(manifest['examples'])} examples)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
