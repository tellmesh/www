#!/usr/bin/env bash
# Install or preview crontab entry for www monitors.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MARKER="# taskinity-www-monitor"
INTERVAL="${MONITOR_CRON_INTERVAL:-*/5}"
LOG="${MONITOR_LOG:-/tmp/taskinity-monitor.log}"
BASE="${WWW_BASE:-http://localhost:8788}"
WEBHOOK=""
USE_ENV_WEBHOOK=0
INSTALL=0
UPDATE=0
REMOVE=0
STATUS=0

is_placeholder_webhook() {
  case "${1,,}" in
    *example*|*twoja-instancja*|*twoj-*|*twoj_*|*twoj.*|*abc123*|*/webhook/...*) return 0 ;;
    *) return 1 ;;
  esac
}

prepare_log_file() {
  mkdir -p "$(dirname "${LOG}")"
  touch "${LOG}"
}

current_crontab() {
  crontab -l 2>/dev/null || true
}

usage() {
  cat <<EOF
Usage: bash scripts/www/install-cron.sh [options]

Options:
  --install          Append cron job to user crontab (skips if marker exists)
  --update           Replace existing cron job (use after changing --webhook etc.)
  --remove           Remove cron job with marker from user crontab
  --interval '*/5'   Cron interval (default: */5 = every 5 minutes)
  --log PATH         Log file (default: /tmp/taskinity-monitor.log)
  --webhook URL      MONITOR_WEBHOOK_URL embedded in cron (explicit only)
  --use-env-webhook  Use MONITOR_WEBHOOK_URL from current shell env
  --base URL         WWW_BASE (default: http://localhost:8788)
  --status           Show whether cron entry is installed

Examples:
  bash scripts/www/install-cron.sh
  bash scripts/www/install-cron.sh --install
  bash scripts/www/install-cron.sh --install --webhook https://hooks.n8n.cloud/webhook/abc
  bash scripts/www/install-cron.sh --update --webhook https://hooks.n8n.cloud/webhook/new
  bash scripts/www/install-cron.sh --remove
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install) INSTALL=1; shift ;;
    --update) UPDATE=1; INSTALL=1; shift ;;
    --remove) REMOVE=1; shift ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --log) LOG="$2"; shift 2 ;;
    --webhook) WEBHOOK="$2"; shift 2 ;;
    --use-env-webhook) USE_ENV_WEBHOOK=1; shift ;;
    --base) BASE="$2"; shift 2 ;;
    --status) STATUS=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "${USE_ENV_WEBHOOK}" -eq 1 && -z "${WEBHOOK}" ]]; then
  WEBHOOK="${MONITOR_WEBHOOK_URL:-${WEBHOOK_URL:-}}"
fi

if [[ "${STATUS}" -eq 1 ]]; then
  if crontab -l 2>/dev/null | grep -q "${MARKER}"; then
    echo "Cron: installed"
    crontab -l | grep "${MARKER}"
  else
    echo "Cron: not installed"
  fi
  if [[ -f "${LOG}" ]]; then
    echo "Log: ${LOG} ($(wc -l < "${LOG}") lines)"
    tail -n 3 "${LOG}" || true
  else
    echo "Log: ${LOG} (not created yet — run: make www-monitor)"
  fi
  exit 0
fi

if [[ -n "${WEBHOOK}" ]]; then
  if is_placeholder_webhook "${WEBHOOK}"; then
    echo "Warning: webhook looks like a placeholder; monitors will skip webhook POSTs until you configure a real URL." >&2
  fi
fi
WEBHOOK_PART=""
if [[ -n "${WEBHOOK}" ]]; then
  WEBHOOK_PART="MONITOR_WEBHOOK_URL=${WEBHOOK} "
fi

CRON_LINE="${INTERVAL} * * * * cd ${ROOT} && MONITOR_NOTIFY=1 WWW_BASE=${BASE} MONITOR_LOG=${LOG} ${WEBHOOK_PART}bash scripts/www/run_monitors.sh >/dev/null 2>> ${LOG} ${MARKER}"

if [[ "${REMOVE}" -eq 1 ]]; then
  if ! crontab -l 2>/dev/null | grep -q "${MARKER}"; then
    echo "No taskinity monitor cron entry found."
    exit 0
  fi
  crontab -l 2>/dev/null | grep -v "${MARKER}" | crontab -
  echo "Removed cron entry (${MARKER})."
  exit 0
fi

echo "Cron line to add:"
echo "${CRON_LINE}"
echo
echo "Preview (do NOT paste into bash — use crontab -e or --install):"
echo "  crontab -e"
echo
echo "Log tail:"
echo "  tail -f ${LOG}"

if [[ "${INSTALL}" -eq 0 ]]; then
  echo
  echo "Dry-run only. Use --install to append to crontab."
  exit 0
fi

prepare_log_file

if crontab -l 2>/dev/null | grep -q "${MARKER}"; then
  if [[ "${UPDATE}" -eq 1 ]]; then
    current_crontab | grep -v "${MARKER}" | { cat; echo "${CRON_LINE}"; } | crontab -
    echo "Updated cron entry."
    crontab -l | grep "${MARKER}"
    echo "Log file ready: ${LOG}"
    exit 0
  fi
  echo "Cron entry already installed (${MARKER})."
  crontab -l | grep "${MARKER}"
  echo "Log file ready: ${LOG}"
  echo "Use --update to replace (e.g. add or change --webhook)." >&2
  exit 0
fi

{ current_crontab; echo "${CRON_LINE}"; } | crontab -
echo "Installed cron entry."
crontab -l | grep "${MARKER}"
echo "Log file ready: ${LOG}"
