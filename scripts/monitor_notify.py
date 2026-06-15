"""Shared alert delivery for www monitors."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime
from typing import Any


def webhook_url(explicit: str | None = None) -> str | None:
    return explicit or os.environ.get("MONITOR_WEBHOOK_URL") or os.environ.get("WEBHOOK_URL")


WEBHOOK_EVENTS = frozenset({"PAGE_DOWN", "PRICE_CHANGED", "PARSE_ERROR", "CONTENT_MISMATCH"})
PLACEHOLDER_WEBHOOK_MARKERS = (
    "example",
    "twoja-instancja",
    "twoj-",
    "twoj_",
    "twoj.",
    "abc123",
    "/webhook/...",
)


def is_placeholder_webhook(url: str) -> bool:
    normalized = url.lower()
    return any(marker in normalized for marker in PLACEHOLDER_WEBHOOK_MARKERS)


def is_supported_webhook(url: str) -> bool:
    return url.startswith(("http://", "https://"))


def emit_alert(
    event: str,
    message: str,
    *,
    url: str | None = None,
    notify: bool = False,
    webhook: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    print(message)
    if not notify:
        return

    print(f"[NOTIFY] {message}", file=sys.stderr)
    if event not in WEBHOOK_EVENTS:
        return

    target = webhook_url(webhook)
    if not target:
        return
    if is_placeholder_webhook(target):
        print("[WEBHOOK_SKIPPED] placeholder webhook URL — configure a real MONITOR_WEBHOOK_URL", file=sys.stderr)
        return
    if not is_supported_webhook(target):
        print("[WEBHOOK_SKIPPED] webhook URL must start with http:// or https://", file=sys.stderr)
        return

    payload = {
        "event": event,
        "message": message,
        "url": url,
        "checked_at": datetime.now(UTC).isoformat(),
        **(extra or {}),
    }
    post_webhook(target, payload)


def post_webhook(url: str, payload: dict[str, Any], *, timeout: float = 10.0) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "taskinity-monitor/0.1"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status >= 400:
                raise urllib.error.HTTPError(url, resp.status, resp.reason, resp.headers, None)
    except Exception as exc:  # noqa: BLE001 — alert path must not crash monitor
        print(f"[WEBHOOK_FAILED] {exc}", file=sys.stderr)
