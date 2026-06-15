#!/usr/bin/env python3
"""Monitor www landing: availability + pricing snapshot diff.

Usage:
  python scripts/www/monitor_landing.py
  python scripts/www/monitor_landing.py --url http://localhost:8788/www/ --notify
  MONITOR_WEBHOOK_URL=https://hooks.example/... python scripts/www/monitor_landing.py --notify

Exit codes:
  0 — page up, prices unchanged (or baseline created)
  1 — page unreachable / non-200
  2 — prices changed vs baseline
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from monitor_notify import emit_alert  # noqa: E402
from repo_root import hypervisor_root  # noqa: E402

ROOT = hypervisor_root()

DEFAULT_BASELINE = ROOT / "output" / "monitoring" / "www-prices.json"
PRICE_RE = re.compile(r'<(?:p|div) class="price">([^<]+)(?:<span|<small)', re.I)


def fetch_html(url: str, timeout: float = 10.0) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "tellmesh-monitor/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status != 200:
            raise urllib.error.HTTPError(url, resp.status, resp.reason, resp.headers, None)
        return resp.read().decode("utf-8", errors="replace")


def extract_prices(html: str) -> list[str]:
    prices = [match.group(1).strip() for match in PRICE_RE.finditer(html)]
    if not prices:
        raise ValueError("no .price elements found — page layout may have changed")
    return prices


def load_baseline(path: Path) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_baseline(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Monitor www landing prices and availability")
    parser.add_argument("--url", default="http://localhost:8788/www/")
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--notify", action="store_true", help="Emit alerts (stdout + optional webhook)")
    parser.add_argument("--webhook", help="Webhook URL (overrides MONITOR_WEBHOOK_URL)")
    parser.add_argument("--reset-baseline", action="store_true")
    args = parser.parse_args()

    try:
        html = fetch_html(args.url)
    except Exception as exc:  # noqa: BLE001 — CLI boundary
        emit_alert(
            "PAGE_DOWN",
            f"PAGE_DOWN url={args.url} error={exc}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
        )
        return 1

    try:
        prices = extract_prices(html)
    except ValueError as exc:
        emit_alert(
            "PARSE_ERROR",
            f"PARSE_ERROR url={args.url} error={exc}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
        )
        return 1

    snapshot = {
        "url": args.url,
        "checked_at": datetime.now(UTC).isoformat(),
        "prices": prices,
        "titles": re.findall(r'<article class="price-card[^"]*">\s*<h3>([^<]+)</h3>', html),
    }

    if args.reset_baseline or load_baseline(args.baseline) is None:
        save_baseline(args.baseline, snapshot)
        emit_alert(
            "BASELINE_CREATED",
            f"BASELINE_CREATED prices={prices}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
            extra={"prices": prices},
        )
        return 0

    baseline = load_baseline(args.baseline)
    assert baseline is not None
    if baseline.get("prices") != prices:
        emit_alert(
            "PRICE_CHANGED",
            f"PRICE_CHANGED old={baseline.get('prices')} new={prices} url={args.url}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
            extra={"old_prices": baseline.get("prices"), "prices": prices},
        )
        save_baseline(args.baseline, snapshot)
        return 2

    print(f"OK url={args.url} prices={prices}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
