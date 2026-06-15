#!/usr/bin/env bash
# Run www monitors (prices + uptime). Use from cron or manually.
set -euo pipefail

# shellcheck source=paths.sh
source "$(cd "$(dirname "$0")" && pwd)/paths.sh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$HYPERVISOR_ROOT"

BASE="${WWW_BASE:-http://localhost:8788}"
NOTIFY="${MONITOR_NOTIFY:-}"
WEBHOOK="${MONITOR_WEBHOOK_URL:-${WEBHOOK_URL:-}}"
LOG="${MONITOR_LOG:-/tmp/taskinity-monitor.log}"
ARGS=()

if [[ "${NOTIFY}" == "1" || "${NOTIFY}" == "true" ]]; then
  ARGS+=(--notify)
fi
if [[ -n "${WEBHOOK}" ]]; then
  export MONITOR_WEBHOOK_URL="${WEBHOOK}"
fi

mkdir -p "$(dirname "${LOG}")"
touch "${LOG}"

run_step() {
  local label="$1"
  shift
  echo "→ ${label}"
  echo "→ ${label}" >> "${LOG}"
  "$@" 2>&1 | tee -a "${LOG}"
}

{
  echo ""
  echo "=== $(date -Is) monitors ${BASE} ==="
} >> "${LOG}"

run_step "monitor_url ${BASE}/www/" \
  python3 "$SCRIPT_DIR/monitor_url.py" --url "${BASE}/www/" --contains Taskinity "${ARGS[@]}"

run_step "monitor_url ${BASE}/health" \
  python3 "$SCRIPT_DIR/monitor_url.py" --url "${BASE}/health" --contains hypervisor-dashboard "${ARGS[@]}"

run_step "monitor_landing prices" \
  python3 "$SCRIPT_DIR/monitor_landing.py" --url "${BASE}/www/" "${ARGS[@]}"

echo "monitors ok — ${BASE}"
echo "monitors ok — ${BASE}" >> "${LOG}"
