"""Shared TellMesh site navigation for www subpages."""

from __future__ import annotations

NAV_SECTIONS: tuple[tuple[str, str], ...] = (
    ("problem", "Problem"),
    ("control-plane", "Control plane"),
    ("deploy-gate", "Walidacja"),
    ("demo", "Demo"),
    ("konkurencja", "Konkurencja"),
    ("oferta", "Oferta"),
)

BRAND_LOGO = "assets/tellmesh.png"


def brand_logo_src(prefix: str = "") -> str:
    return f"{prefix}{BRAND_LOGO}"


def render_brand(*, prefix: str = "", home_href: str | None = None) -> str:
    home = home_href or f"{prefix}index.html"
    logo = brand_logo_src(prefix)
    return f"""      <a class="brand" href="{home}" aria-label="TellMesh home">
        <img class="brand-logo" src="{logo}" alt="TellMesh" width="168" height="38" decoding="async">
        <span class="brand-sub">by Prototypowanie.pl</span>
      </a>"""


def render_topbar(*, prefix: str = "", active: str | None = None, extra_actions: str = "") -> str:
    """Render the TellMesh top bar.

    prefix: '' for www root, '../' for docs/
    active: 'examples' | 'gallery' | 'chat' | 'flow_chat' | None
    """

    home = f"{prefix}index.html"
    examples_href = f"{prefix}docs/examples.html"
    chat_href = f"{prefix}chat.html"
    flow_chat_href = f"{prefix}flow-chat.html"

    nav_links = "\n        ".join(
        f'<a href="{home}#{slug}">{label}</a>' for slug, label in NAV_SECTIONS
    )

    examples_active = " is-active" if active == "examples" else ""
    chat_active = " is-active" if active == "chat" else ""
    flow_active = " is-active" if active == "flow_chat" else ""

    return f"""  <header class="topbar">
    <div class="container nav" aria-label="Główna nawigacja">
{render_brand(prefix=prefix, home_href=home)}
      <nav class="nav-links" aria-label="Sekcje">
        {nav_links}
      </nav>
      <div class="nav-actions">
        <a class="btn btn-ghost{examples_active}" href="{examples_href}">Przykłady</a>
        <a class="btn btn-ghost{chat_active}" href="{chat_href}">NL Chat</a>
        <a class="btn btn-primary{flow_active}" href="{flow_chat_href}">Flow Chat</a>
        {extra_actions}
      </div>
    </div>
  </header>"""


def render_footer(*, prefix: str = "") -> str:
    home = f"{prefix}index.html"
    gallery = f"{prefix}przyklady.html"
    chat = f"{prefix}chat.html"
    flow_chat = f"{prefix}flow-chat.html"
    examples = f"{prefix}docs/examples.html"

    return f"""  <footer class="site-footer">
    <div class="container">
      <p>TellMesh · Prototypowanie.pl · <a href="{home}">Home</a> · <a href="{gallery}">Integration lab</a> · <a href="{examples}">Docs</a> · <a href="{chat}">NL Chat</a> · <a href="{flow_chat}">Flow Chat</a></p>
    </div>
  </footer>"""
