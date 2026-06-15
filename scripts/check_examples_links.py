#!/usr/bin/env python3
"""Verify navigational links in www/docs/examples.html."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))
from repo_root import hypervisor_root, www_dir  # noqa: E402

ROOT = hypervisor_root()

DEFAULT_PAGE = www_dir() / "docs" / "examples.html"
WWW_DIR = www_dir()
MALFORMED = re.compile(r"\.\[\./\]")
HREF_RE = re.compile(r"""href=(["'])(.*?)\1""", re.IGNORECASE)


def _iter_hrefs(block: str) -> list[str]:
    return [match.group(2) for match in HREF_RE.finditer(block)]


def _collect_anchor_ids(html: str) -> set[str]:
    return set(re.findall(r'\bid="([^"]+)"', html))


def _extract_block(html: str, pattern: str) -> str:
    match = re.search(pattern, html, flags=re.DOTALL | re.IGNORECASE)
    return match.group(0) if match else ""


def _check_href(href: str, *, page: Path, anchor_ids: set[str], require_anchor: bool) -> str | None:
    if MALFORMED.search(href):
        return "malformed rewrite placeholder"
    if href.startswith("#"):
        if require_anchor and href[1:] not in anchor_ids:
            return "missing section anchor"
        return None
    if href.startswith(("http://", "https://", "mailto:")):
        return None
    if href.startswith("/"):
        target = ROOT / href.lstrip("/")
        if not target.exists():
            return f"missing absolute path {href}"
        return None
    if href.startswith("../") or href.startswith("./"):
        path_only = href.split("#", 1)[0]
        target = (page.parent / path_only).resolve()
        try:
            target.relative_to(WWW_DIR)
        except ValueError:
            return f"escapes www/: {href}"
        if not target.exists():
            return f"missing www path {href}"
        return None
    return None


def check_examples_links(page: Path = DEFAULT_PAGE) -> list[str]:
    html = page.read_text(encoding="utf-8")
    anchor_ids = _collect_anchor_ids(html)
    errors: list[str] = []

    if MALFORMED.search(html):
        errors.append("page contains malformed rewrite placeholders (.[./])")

    toc = _extract_block(html, r'<ul class="docs-toc"[^>]*>.*?</ul>')
    for href in _iter_hrefs(toc):
        issue = _check_href(href, page=page, anchor_ids=anchor_ids, require_anchor=True)
        if issue:
            errors.append(f"toc href={href!r}: {issue}")

    for block_name, pattern in (
        ("nav", r'<nav class="site-nav"[^>]*>.*?</nav>'),
        ("footer", r'<footer class="site-footer"[^>]*>.*?</footer>'),
    ):
        block = _extract_block(html, pattern)
        for href in _iter_hrefs(block):
            issue = _check_href(href, page=page, anchor_ids=anchor_ids, require_anchor=False)
            if issue:
                errors.append(f"{block_name} href={href!r}: {issue}")

    stylesheet = re.search(r'<link rel="stylesheet" href="([^"]+)"', html)
    if stylesheet:
        issue = _check_href(stylesheet.group(1), page=page, anchor_ids=anchor_ids, require_anchor=False)
        if issue:
            errors.append(f"stylesheet href={stylesheet.group(1)!r}: {issue}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--page", type=Path, default=DEFAULT_PAGE)
    args = parser.parse_args()
    errors = check_examples_links(args.page)
    if errors:
        print(f"LINK CHECK FAILED ({len(errors)} issues) in {args.page}", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1
    print(f"OK: {args.page} navigational links verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
