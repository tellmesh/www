#!/usr/bin/env python3
"""Monitor arbitrary URL availability (HTTP 200 + optional text match).

Usage:
  python scripts/www/monitor_url.py --url http://localhost:8788/health
  MONITOR_WEBHOOK_URL=https://hooks.example/... python scripts/www/monitor_url.py --url ... --notify

Exit codes:
  0 — reachable (and optional text found)
  1 — down, non-200, or missing expected text
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from monitor_notify import emit_alert  # noqa: E402
from repo_root import hypervisor_root  # noqa: E402

ROOT = hypervisor_root()


def fetch(url: str, timeout: float) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "taskinity-monitor/0.1"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, body


def main() -> int:
    parser = argparse.ArgumentParser(description="Monitor URL availability")
    parser.add_argument("--url", required=True)
    parser.add_argument("--contains", help="Require substring in response body")
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--notify", action="store_true", help="Emit alerts (stdout + optional webhook)")
    parser.add_argument("--webhook", help="Webhook URL (overrides MONITOR_WEBHOOK_URL)")
    args = parser.parse_args()

    try:
        status, body = fetch(args.url, args.timeout)
    except Exception as exc:  # noqa: BLE001
        emit_alert(
            "PAGE_DOWN",
            f"PAGE_DOWN url={args.url} error={exc}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
        )
        return 1

    if status != 200:
        emit_alert(
            "PAGE_DOWN",
            f"PAGE_DOWN url={args.url} status={status}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
            extra={"status_code": status},
        )
        return 1

    if args.contains and args.contains not in body:
        emit_alert(
            "CONTENT_MISMATCH",
            f"CONTENT_MISMATCH url={args.url} missing={args.contains!r}",
            url=args.url,
            notify=args.notify,
            webhook=args.webhook,
            extra={"expected": args.contains},
        )
        return 1

    print(f"OK url={args.url} status={status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
