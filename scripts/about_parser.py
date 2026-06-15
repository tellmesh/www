"""Parse examples/*/ABOUT.md — YAML frontmatter + markdown/HTML body."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)


def split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return {}, text
    raw = match.group(1)
    body = text[match.end() :]
    data = yaml.safe_load(raw) or {}
    if not isinstance(data, dict):
        raise ValueError("ABOUT.md frontmatter must be a mapping")
    return data, body


def load_about(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    meta, body = split_frontmatter(text)
    example_id = path.parent.name
    landing = meta.get("landing") or {}
    cards_raw = landing.get("cards")
    if cards_raw is None and landing:
        cards_raw = [landing]
    cards: list[dict[str, Any]] = []
    for item in cards_raw or []:
        if not isinstance(item, dict):
            continue
        card = dict(item)
        card.setdefault("example", example_id)
        card.setdefault("source", str(path.relative_to(path.parents[2])))
        cards.append(card)
    return {
        "example_id": example_id,
        "path": path,
        "meta": meta,
        "body": body.strip(),
        "cards": cards,
    }


def iter_about_files(examples_root: Path) -> list[Path]:
    paths = [p for p in examples_root.glob("*/ABOUT.md") if p.is_file()]
    return sorted(paths, key=lambda p: p.parent.name)
