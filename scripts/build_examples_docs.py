#!/usr/bin/env python3
"""Build www/docs/examples.html from examples/** markdown and source files."""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from repo_root import hypervisor_root, www_dir  # noqa: E402
from site_nav import render_footer, render_topbar  # noqa: E402

ROOT = hypervisor_root()

EXAMPLES = ROOT / "examples"
OUT = www_dir() / "docs" / "examples.html"

TEXT_EXTENSIONS = {".md", ".txt", ".yaml", ".yml", ".sh"}
SKIP_NAMES = {"README.md", "ABOUT.md"}
MAX_EMBED_BYTES = 48_000


def _import_markdown():
    try:
        import markdown  # type: ignore
    except ImportError as exc:
        raise SystemExit("pip install markdown") from exc
    return markdown


def natural_key(name: str) -> list:
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def slug_for_dir(name: str) -> str:
    return f"ex-{name}"


def slug_for_overview() -> str:
    return "overview"


def rewrite_example_links(text: str) -> str:
    """Turn relative example README links into in-page anchors or www-relative URLs."""

    def repl_md(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        return _rewrite_url(label, url) or match.group(0)

    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", repl_md, text)


def _resolve_target(raw_path: str) -> Path | None:
    path_part = raw_path.strip()
    if path_part.startswith("../"):
        return (ROOT / path_part[3:]).resolve()
    if path_part.startswith("./"):
        return (EXAMPLES / path_part[2:]).resolve()
    return (EXAMPLES / path_part).resolve()


def _is_external_or_anchor(raw: str) -> bool:
    return (not raw) or raw.startswith(("http://", "https://", "mailto:")) or raw.startswith("#")


def _rewrite_known_www_target(label: str, target: Path, fragment: str) -> str | None:
    www = www_dir()
    if target == (www / "docs" / "examples.html"):
        return f"[{label}](examples.html{fragment})"
    if target == www / "przyklady.html":
        return f"[{label}](../przyklady.html{fragment})"
    if target.parent == www:
        rel = target.relative_to(www)
        return f"[{label}](../{rel.as_posix()}{fragment})"
    return None


def _rewrite_examples_target(label: str, target: Path, fragment: str) -> str | None:
    if target.is_dir() and target.parent == EXAMPLES:
        return f"[{label}](#{slug_for_dir(target.name)}{fragment})"
    if target.is_file() and target.parent == EXAMPLES and target.suffix == ".md":
        return f"[{label}](#{slug_for_overview()}{fragment})"
    if target.is_file() and target.parent.parent == EXAMPLES:
        file_slug = slug_for_dir(target.parent.name)
        anchor = f"#{file_slug}-{target.name.replace('.', '-')}"
        return f"[{label}]({anchor}{fragment})"
    return None


def _rewrite_url(label: str, url: str) -> str | None:
    raw = url.strip()
    if _is_external_or_anchor(raw):
        if raw.startswith("#"):
            return f"[{label}]({raw})"
        return None

    fragment = ""
    path_only = raw
    if "#" in raw:
        path_only, fragment = raw.split("#", 1)
        fragment = f"#{fragment}"

    target = _resolve_target(path_only)
    if target is None:
        return None
    try:
        target.relative_to(ROOT)
    except ValueError:
        return None

    return (
        _rewrite_known_www_target(label, target, fragment)
        or _rewrite_examples_target(label, target, fragment)
    )


def md_to_html(text: str) -> str:
    markdown = _import_markdown()
    return markdown.markdown(
        text,
        extensions=["fenced_code", "tables", "sane_lists", "toc"],
        output_format="html5",
    )


def extract_title(md_text: str, fallback: str) -> str:
    for line in md_text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def list_example_dirs() -> list[Path]:
    dirs = []
    for p in EXAMPLES.iterdir():
        if not p.is_dir():
            continue
        readme = p / "README.md"
        has_files = any(
            f.is_file() and f.suffix.lower() in TEXT_EXTENSIONS and f.name not in SKIP_NAMES
            for f in p.rglob("*")
        )
        if readme.is_file() or has_files:
            dirs.append(p)
    return sorted(dirs, key=lambda p: natural_key(p.name))


def embeddable_files(example_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(example_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.name in SKIP_NAMES:
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        if path.stat().st_size > MAX_EMBED_BYTES:
            continue
        if path.relative_to(example_dir).parts[0].startswith("."):
            continue
        files.append(path)
    return files


def render_file_block(path: Path, example_dir: Path) -> str:
    rel = path.relative_to(example_dir).as_posix()
    lang = path.suffix.lstrip(".") or "text"
    if lang == "yml":
        lang = "yaml"
    body = html.escape(path.read_text(encoding="utf-8"))
    anchor = f"{slug_for_dir(example_dir.name)}-{rel.replace('/', '-').replace('.', '-')}"
    return f"""
<section class="docs-file" id="{anchor}">
  <details open>
    <summary><code>{html.escape(rel)}</code></summary>
    <pre class="docs-code docs-code-{lang}"><code>{body}</code></pre>
  </details>
</section>"""


def render_example_section(example_dir: Path) -> tuple[str, str, str]:
    slug = slug_for_dir(example_dir.name)
    readme = example_dir / "README.md"
    if readme.is_file():
        md = rewrite_example_links(readme.read_text(encoding="utf-8"))
        title = extract_title(md, example_dir.name)
        body = md_to_html(md)
    else:
        title = example_dir.name
        body = (
            "<p><em>No README.md — source files for this example are listed below.</em></p>"
        )

    extras = embeddable_files(example_dir)
    extras_html = "".join(render_file_block(p, example_dir) for p in extras)
    if extras_html:
        extras_html = f'<div class="docs-files"><h3 class="docs-files-title">Source files</h3>{extras_html}</div>'

    section = f"""
<article class="docs-section" id="{slug}" data-title="{html.escape(title.lower())}">
  <div class="docs-section-head">
    <span class="docs-section-kicker">{html.escape(example_dir.name)}</span>
    <a class="docs-anchor" href="#{slug}" aria-label="Link do sekcji">#</a>
  </div>
  <div class="docs-md">{body}</div>
  {extras_html}
</article>"""
    return slug, title, section


def build_toc(entries: list[tuple[str, str, str]]) -> str:
    items = []
    for slug, title, _ in entries:
        short = title.split("—", 1)[-1].strip() if "—" in title else title
        items.append(f'<li><a href="#{slug}">{html.escape(short)}</a></li>')
    return "\n".join(items)


def build_page(entries: list[tuple[str, str, str]], overview_html: str) -> str:
    toc = build_toc(entries)
    sections = overview_html + "".join(section for _, _, section in entries)
    built_at = "deterministic"

    sidebar_toggle = (
        '<button type="button" class="btn btn-ghost docs-sidebar-toggle" '
        'id="docs-sidebar-toggle">Spis treści</button>'
    )
    topbar = render_topbar(prefix="../", active="examples", extra_actions=sidebar_toggle)
    footer = render_footer(prefix="../")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Examples — TellMesh documentation</title>
  <meta name="description" content="Full documentation for examples/*/* — README and source files from the hypervisor repository.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../landing.css">
  <link rel="stylesheet" href="../site-shell.css">
</head>
<body class="docs-body shell-page">
{topbar}

  <div class="docs-layout container">
    <aside class="docs-sidebar" id="docs-sidebar" aria-label="Table of contents">
      <div class="docs-sidebar-inner">
        <label class="docs-search-label" for="docs-search">Search</label>
        <input id="docs-search" class="docs-search" type="search" placeholder="e.g. browser, invoices, android…" autocomplete="off">
        <nav>
          <ul class="docs-toc" id="docs-toc">
            <li><a href="#overview">examples/ overview</a></li>
            {toc}
          </ul>
        </nav>
        <p class="docs-built">Generated: {built_at}<br><code>scripts/www/build_examples_docs.py</code></p>
      </div>
    </aside>

    <main class="docs-main" id="docs-main">
      <header class="docs-hero">
        <span class="hero-badge">examples/*/* · docs</span>
        <h1>Examples documentation</h1>
        <p class="hero-lead">Full contents of the repository <code>examples/</code> directory — each example README plus YAML, TXT and <code>run.sh</code> scripts.</p>
      </header>
      {sections}
    </main>
  </div>

{footer}

  <script src="../docs-examples.js" defer></script>
</body>
</html>
"""


def build_overview_section() -> str:
    readme = EXAMPLES / "README.md"
    md = rewrite_example_links(readme.read_text(encoding="utf-8"))
    body = md_to_html(md)
    return f"""
<article class="docs-section" id="{slug_for_overview()}" data-title="examples overview">
  <div class="docs-section-head">
    <span class="docs-section-kicker">examples/README.md</span>
    <a class="docs-anchor" href="#{slug_for_overview()}" aria-label="Link do sekcji">#</a>
  </div>
  <div class="docs-md">{body}</div>
</article>"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--check", action="store_true", help="Exit 1 if output would change")
    args = parser.parse_args()

    entries: list[tuple[str, str, str]] = []
    for example_dir in list_example_dirs():
        entries.append(render_example_section(example_dir))

    overview = build_overview_section()
    page = build_page(entries, overview)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.check and args.out.is_file() and args.out.read_text(encoding="utf-8") == page:
        print(f"OK unchanged: {args.out}")
        return 0
    if args.check and args.out.is_file():
        print(f"STALE: {args.out} (run build_examples_docs.py)", file=sys.stderr)
        return 1

    args.out.write_text(page, encoding="utf-8")
    print(f"Wrote {args.out} ({len(entries)} examples + overview)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
