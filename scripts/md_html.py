"""Markdown → HTML with optional mtime cache."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


def _import_markdown():
    try:
        import markdown  # type: ignore
    except ImportError as exc:
        raise SystemExit("pip install markdown") from exc
    return markdown


def md_to_html(text: str) -> str:
    if not text.strip():
        return ""
    md = _import_markdown()
    return md.markdown(
        text,
        extensions=["fenced_code", "tables", "sane_lists", "toc"],
        output_format="html5",
    )


def cache_key(source: Path, body: str) -> str:
    stat = source.stat()
    payload = f"{stat.st_mtime_ns}:{stat.st_size}:{body}"
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def cached_html(source: Path, body: str, cache_dir: Path) -> str:
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = cache_key(source, body)
    cache_file = cache_dir / f"{source.parent.name}-{key}.html"
    meta_file = cache_dir / f"{source.parent.name}-{key}.json"
    if cache_file.is_file() and meta_file.is_file():
        return cache_file.read_text(encoding="utf-8")
    html = md_to_html(body)
    cache_file.write_text(html, encoding="utf-8")
    meta_file.write_text(
        json.dumps({"source": str(source), "key": key}, indent=2),
        encoding="utf-8",
    )
    return html
