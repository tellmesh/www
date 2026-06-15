#!/usr/bin/env bash
# Smoke test for www chat API + static UI.
set -euo pipefail

BASE="${1:-http://localhost:8788}"

echo "→ GET $BASE/health"
curl -fsS "$BASE/health" | grep -q '"agent":"hypervisor-dashboard"'

echo "→ GET $BASE/www/"
WWW_HTML="$(curl -fsS "$BASE/www/")"
CHAT_HTML="$(curl -fsS "$BASE/www/chat.html")"
grep -q "TellMesh" <<<"$WWW_HTML"
grep -q "Text2Ops" <<<"$WWW_HTML"
grep -q 'id="control-plane"' <<<"$WWW_HTML"
grep -q 'id="deploy-gate"' <<<"$WWW_HTML"
grep -q "scenario-tabs" <<<"$WWW_HTML"
grep -q "demo-terminal" <<<"$WWW_HTML"
grep -q "TellMesh Chat" <<<"$CHAT_HTML"
grep -q "copy-chat-btn" <<<"$CHAT_HTML"

echo "→ POST $BASE/api/ask"
curl -fsS -X POST "$BASE/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"stwórz dashboard agenta hypervisor"}' \
  | grep -q "dashboard-agent"

echo "→ POST $BASE/api/uri/call (workflow dry-run)"
curl -fsS -X POST "$BASE/api/uri/call" \
  -H "Content-Type: application/json" \
  -d '{"uri":"workflow://bank/batch-transfer/dry-run","dry_run":true}' \
  | grep -q '"ok":true'

echo "smoke ok — $BASE/www/"
