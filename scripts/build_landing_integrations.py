#!/usr/bin/env python3
"""Build #integracje cards from examples/*/ABOUT.md → www/generated/."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))
from repo_root import hypervisor_root, www_dir  # noqa: E402

ROOT = hypervisor_root()
EXAMPLES = ROOT / "examples"

WWW = www_dir()
GENERATED = WWW / "generated"
CACHE = GENERATED / "cache" / "about"
INDEX = WWW / "index.html"
START_CONNECTORS = "<!-- @integrations-connectors:start -->"
END_CONNECTORS = "<!-- @integrations-connectors:end -->"
START_GRID = "<!-- @integrations-grid:start -->"
END_GRID = "<!-- @integrations-grid:end -->"

sys.path.insert(0, str(ROOT / "scripts" / "www"))
from about_parser import iter_about_files, load_about  # noqa: E402
from md_html import cached_html  # noqa: E402


def _esc(value: str) -> str:
    return html.escape(value, quote=True)


def _i18n_values(card: dict[str, Any], field: str) -> dict[str, str]:
    i18n = card.get("i18n") or {}
    out: dict[str, str] = {}
    for lang in ("pl", "en", "de"):
        block = i18n.get(lang) or {}
        if field in block:
            out[lang] = str(block[field])
    if "en" not in out and i18n.get("pl", {}).get(field):
        out.setdefault("en", str(i18n["pl"][field]))
    return out


def _cta_i18n_values(card: dict[str, Any], field: str) -> dict[str, str]:
    key = f"cta_{field}"
    out = _i18n_values(card, key)
    if out:
        return out
    cta = card.get("cta") or {}
    legacy = cta.get(field)
    if legacy:
        return {"pl": str(legacy)}
    return {}


def _spotlight_body_html(card: dict[str, Any], source: Path, fallback_html: str) -> str:
    i18n = card.get("i18n") or {}
    langs_with_body = {
        lang: str(block.get("body") or "").strip()
        for lang, block in i18n.items()
        if isinstance(block, dict) and str(block.get("body") or "").strip()
    }
    if not langs_with_body:
        return f'<div class="docs-md">{fallback_html}</div>'

    parts: list[str] = []
    default_lang = "en" if "en" in langs_with_body else next(iter(langs_with_body))
    for lang, body_text in langs_with_body.items():
        html_body = cached_html(source, f"[{lang}]\n{body_text}", CACHE)
        hidden = "" if lang == default_lang else " hidden"
        parts.append(
            f'<div class="docs-md integration-i18n" data-i18n-lang="{lang}"{hidden}>{html_body}</div>'
        )
    return "".join(parts)


def _render_cta_links(href: str, values: dict[str, str]) -> str:
    if not values:
        return f'<a class="btn btn-secondary" href="{href}">Try in chat</a>'
    parts: list[str] = []
    default_lang = "en" if "en" in values else next(iter(values))
    for lang, text in values.items():
        hidden = "" if lang == default_lang else " hidden"
        parts.append(
            f'<a class="btn btn-secondary integration-i18n" data-i18n-lang="{lang}" href="{href}"{hidden}>{_esc(text)}</a>'
        )
    return "".join(parts)


def _render_i18n_spans(values: dict[str, str], *, extra_class: str = "") -> str:
    if not values:
        return ""
    parts: list[str] = []
    default_lang = "en" if "en" in values else next(iter(values))
    cls = f"integration-i18n {extra_class}".strip()
    for lang, text in values.items():
        hidden = "" if lang == default_lang else " hidden"
        parts.append(
            f'<span class="{cls}" data-i18n-lang="{lang}" data-i18n-field="tag"{hidden}>{_esc(text)}</span>'
        )
    return "".join(parts)


def _render_i18n(field: str, values: dict[str, str], *, tag: str, raw_html: bool = False) -> str:
    if not values:
        return ""
    parts: list[str] = []
    default_lang = "en" if "en" in values else next(iter(values))
    for lang, text in values.items():
        hidden = "" if lang == default_lang else " hidden"
        if raw_html:
            parts.append(
                f'<{tag} class="integration-i18n" data-i18n-lang="{lang}"{hidden}>{text}</{tag}>'
            )
        else:
            parts.append(
                f'<{tag} class="integration-i18n" data-i18n-lang="{lang}"{hidden}>{_esc(text)}</{tag}>'
            )
    return "".join(parts)


def _snippet_block(card: dict[str, Any]) -> str:
    snippet = str(card.get("snippet") or "").strip()
    if not snippet:
        return ""
    return f'<pre class="integration-snippet">{_esc(snippet)}</pre>'


def render_connector(card: dict[str, Any]) -> str:
    card_id = card.get("id") or card.get("example")
    logo = _esc(str(card.get("logo") or "EX"))
    tag_html = _render_i18n_spans(_i18n_values(card, "tag"), extra_class="integration-tag")
    title_html = _render_i18n("title", _i18n_values(card, "title"), tag="h3")
    lead_html = _render_i18n("lead", _i18n_values(card, "lead"), tag="p", raw_html=True)
    docs = card.get("docs") or f"docs/examples.html#ex-{card.get('example')}"
    return f"""
        <article class="connector-card" data-integration-card="{_esc(str(card_id))}" data-example="{_esc(str(card.get('example')))}">
          <div class="connector-card-top">
            <span class="connector-logo">{logo}</span>
            <div>
              {tag_html}
              {title_html}
            </div>
          </div>
          {lead_html}
          {_snippet_block(card)}
          <p class="integration-card-link"><a href="{_esc(str(docs))}">example · {_esc(str(card.get('example')))}</a></p>
        </article>"""


def render_card(card: dict[str, Any], body_html: str) -> str:
    card_id = card.get("id") or card.get("example")
    tag_html = _render_i18n_spans(_i18n_values(card, "tag"), extra_class="integration-tag")
    title_html = _render_i18n("title", _i18n_values(card, "title"), tag="h3")
    return f"""
        <article class="integration-card" data-integration-card="{_esc(str(card_id))}" data-example="{_esc(str(card.get('example')))}">
          <div class="integration-card-head">
            {tag_html}
            {title_html}
          </div>
          <div class="integration-card-body docs-md">{body_html}</div>
          {_snippet_block(card)}
        </article>"""


def _render_inline_i18n(values: dict[str, str], *, tag: str, class_name: str = "integration-i18n") -> str:
    if not values:
        return ""
    parts: list[str] = []
    default_lang = "en" if "en" in values else next(iter(values))
    for lang, text in values.items():
        hidden = "" if lang == default_lang else " hidden"
        parts.append(
            f'<{tag} class="{class_name}" data-i18n-lang="{lang}"{hidden}>{_esc(text)}</{tag}>'
        )
    return "".join(parts)


def render_spotlight(card: dict[str, Any], body_html: str) -> str:
    title_html = _render_i18n("title", _i18n_values(card, "title"), tag="h3")
    cta = card.get("cta") or {}
    cta_href = _esc(str(cta.get("href") or "chat.html"))
    label_html = _render_cta_links(cta_href, _cta_i18n_values(card, "label"))
    hint_html = _render_inline_i18n(_cta_i18n_values(card, "hint"), tag="span")
    return f"""
      <div class="integration-example tech-block" data-integration-card="{_esc(str(card.get('id') or 'spotlight'))}">
        {title_html}
        {body_html}
        <p class="integration-example-cta">
          {label_html}
          {hint_html}
        </p>
      </div>"""


def _card_body_html(card: dict[str, Any], source: Path, shared_html: str) -> str:
    custom = str(card.get("body") or "").strip()
    if custom:
        return cached_html(source, f"[card:{card.get('id')}]\n{custom}", CACHE)
    return shared_html


def collect_cards() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    all_cards: list[dict[str, Any]] = []
    i18n_export: dict[str, Any] = {"cards": {}}
    for path in iter_about_files(EXAMPLES):
        about = load_about(path)
        body_html = ""
        if about["body"]:
            body_html = cached_html(path, about["body"], CACHE)
        for card in about["cards"]:
            card = dict(card)
            layout = card.get("layout")
            card["_body_html"] = ""
            if layout == "card":
                card["_body_html"] = _card_body_html(card, path, body_html)
            elif layout == "spotlight":
                card["_body_html"] = _spotlight_body_html(card, path, body_html)
            card.setdefault("order", 100)
            all_cards.append(card)
            card_id = str(card.get("id") or f"{card.get('example')}-{card.get('layout')}")
            i18n_export["cards"][card_id] = card.get("i18n") or {}
    all_cards.sort(key=lambda c: (int(c.get("order") or 100), str(c.get("id") or "")))
    return all_cards, i18n_export


def build_sections(cards: list[dict[str, Any]]) -> tuple[str, str]:
    connectors = [c for c in cards if c.get("layout") == "connector"]
    grid = [c for c in cards if c.get("layout") == "card"]
    spotlights = [c for c in cards if c.get("layout") == "spotlight"]

    connector_html = f"""
      <div class="connector-board" aria-label="Gotowe receptury integracji">
{"".join(render_connector(c) for c in connectors)}
      </div>
"""
    grid_html = f"""
      <div class="integration-grid">
{"".join(render_card(c, c.get("_body_html") or "") for c in grid)}
      </div>
{"".join(render_spotlight(c, c.get("_body_html") or "") for c in spotlights)}
"""
    return connector_html, grid_html


def splice_index(connectors_html: str, grid_html: str) -> str:
    text = INDEX.read_text(encoding="utf-8")
    for start, end, replacement in (
        (START_CONNECTORS, END_CONNECTORS, connectors_html),
        (START_GRID, END_GRID, grid_html),
    ):
        if start not in text or end not in text:
            raise SystemExit(f"Missing integration markers {start} in {INDEX}")
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
        text = pattern.sub(f"{start}\n{replacement}\n      {end}", text)
    return text


def write_i18n_js(i18n_export: dict[str, Any]) -> None:
    GENERATED.mkdir(parents=True, exist_ok=True)
    path = GENERATED / "integrations-i18n.js"
    payload = json.dumps(i18n_export, ensure_ascii=False, indent=2)
    path.write_text(f"window.__INTEGRATIONS_I18N__ = {payload};\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--index-only", action="store_true", help="Skip writing index.html")
    args = parser.parse_args()

    cards, i18n_export = collect_cards()
    if not cards:
        print("WARNING: no examples/*/ABOUT.md cards found", file=sys.stderr)

    connectors_html, grid_html = build_sections(cards)
    fragment_path = GENERATED / "integrations.fragment.html"
    fragment_path.parent.mkdir(parents=True, exist_ok=True)
    combined = connectors_html + "\n" + grid_html

    index_html = splice_index(connectors_html, grid_html)
    write_i18n_js(i18n_export)

    stale = False
    if fragment_path.is_file() and fragment_path.read_text(encoding="utf-8") != combined:
        stale = True
    if INDEX.is_file() and INDEX.read_text(encoding="utf-8") != index_html:
        stale = True
    i18n_path = GENERATED / "integrations-i18n.js"
    new_i18n = f"window.__INTEGRATIONS_I18N__ = {json.dumps(i18n_export, ensure_ascii=False, indent=2)};\n"
    if i18n_path.is_file() and i18n_path.read_text(encoding="utf-8") != new_i18n:
        stale = True

    if args.check:
        if stale:
            print("STALE: run build_landing_integrations.py", file=sys.stderr)
            return 1
        print(f"OK unchanged ({len(cards)} integration cards)")
        return 0

    fragment_path.write_text(combined, encoding="utf-8")
    write_i18n_js(i18n_export)
    if not args.index_only:
        INDEX.write_text(index_html, encoding="utf-8")
    print(f"Wrote {fragment_path} ({len(cards)} cards) + integrations-i18n.js")
    if not args.index_only:
        print(f"Updated {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
