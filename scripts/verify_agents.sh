#!/usr/bin/env bash
# Verify new agents are registered, callable via URI, and repairable by hypervisor.
set -euo pipefail

BASE="${1:-http://localhost:8788}"
AGENTS=(user-agent.local invoices-agent.local)

echo "→ GET $BASE/api/agents"
payload="$(curl -fsS "$BASE/api/agents")"
for agent in "${AGENTS[@]}"; do
  echo "$payload" | grep -q "\"id\":\"$agent\""
done

for agent in "${AGENTS[@]}"; do
  echo "→ POST $BASE/api/uri/call health://agent/$agent"
  curl -fsS -X POST "$BASE/api/uri/call" \
    -H "Content-Type: application/json" \
    -d "{\"uri\":\"health://agent/$agent\",\"policy\":\"dev\"}" \
    | grep -q '"result_type":"health"'

  echo "→ POST $BASE/api/uri/call repair://agent/$agent/diagnose"
  curl -fsS -X POST "$BASE/api/uri/call" \
    -H "Content-Type: application/json" \
    -d "{\"uri\":\"repair://agent/$agent/diagnose\",\"dry_run\":true,\"policy\":\"dev\"}" \
    | grep -q '"result_type":"diagnosis"'

  echo "→ POST $BASE/api/uri/call repair dry-run $agent"
  curl -fsS -X POST "$BASE/api/uri/call" \
    -H "Content-Type: application/json" \
    -d "{\"uri\":\"repair://agent/$agent/apply\",\"dry_run\":true,\"policy\":\"dev\"}" \
    | grep -q '"result_type":"repair"'
done

echo "verify_agents ok — ${AGENTS[*]} @ $BASE"
