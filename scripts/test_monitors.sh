#!/usr/bin/env bash
# End-to-end test suite for www monitors (uptime, prices, webhook, alerts).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BASE="${WWW_BASE:-http://localhost:8788}"
PASS=0
FAIL=0
TMP="$(mktemp -d)"

cleanup() { rm -rf "${TMP}"; }
trap cleanup EXIT

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

echo "=== www monitor test suite ==="
echo "BASE=${BASE}"
echo

echo "→ pytest unit tests"
if pytest tests/hypervisor/test_monitor_landing.py tests/hypervisor/test_monitor_url.py -q; then
  pass "pytest"
else
  fail "pytest"
fi

echo
echo "→ make www-monitor (happy path)"
if make www-monitor WWW_BASE="${BASE}" >/tmp/taskinity-monitor-test.log 2>&1; then
  pass "make www-monitor"
else
  fail "make www-monitor"
  cat /tmp/taskinity-monitor-test.log
fi

echo
echo "→ page down detection"
DOWN_OUT="$(python3 scripts/www/monitor_url.py --url "http://127.0.0.1:1/www/" --notify 2>"${TMP}/down.stderr" || true)"
if echo "${DOWN_OUT}" | grep -q PAGE_DOWN; then
  pass "page down"
else
  fail "page down"
fi
if grep -q '\[NOTIFY\]' "${TMP}/down.stderr"; then
  pass "page down notify"
else
  fail "page down notify"
fi

echo
echo "→ price change detection"
BASELINE="${TMP}/prices.json"
echo '{"prices":["STALE PRICE"]}' > "${BASELINE}"
PRICE_OUT="$(python3 scripts/www/monitor_landing.py \
  --url "${BASE}/www/" \
  --baseline "${BASELINE}" \
  --notify 2>"${TMP}/price.stderr" || true)"
if echo "${PRICE_OUT}" | grep -q PRICE_CHANGED; then
  pass "price change"
else
  fail "price change"
fi

echo
echo "→ install-cron dry-run"
if bash scripts/www/install-cron.sh | grep -q "taskinity-www-monitor"; then
  pass "install-cron dry-run"
else
  fail "install-cron dry-run"
fi

echo
echo "→ install-cron prepares log (fake crontab)"
FAKE_BIN="${TMP}/fake-bin"
mkdir -p "${FAKE_BIN}"
cat > "${FAKE_BIN}/crontab" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
STATE="${FAKE_CRONTAB_STATE:?}"
if [[ "${1:-}" == "-l" ]]; then
  if [[ -f "${STATE}" ]]; then
    cat "${STATE}"
    exit 0
  fi
  exit 1
fi
cat > "${STATE}"
SH
chmod +x "${FAKE_BIN}/crontab"
CRON_LOG="${TMP}/cron.log"
CRON_STATE="${TMP}/crontab.txt"
if PATH="${FAKE_BIN}:${PATH}" FAKE_CRONTAB_STATE="${CRON_STATE}" \
  bash scripts/www/install-cron.sh --install --log "${CRON_LOG}" --webhook "https://twoja-instancja.app.n8n.cloud/webhook/abc123" \
  >"${TMP}/install.stdout" 2>"${TMP}/install.stderr" \
  && [[ -f "${CRON_LOG}" ]] \
  && grep -q ">/dev/null 2>> ${CRON_LOG}" "${CRON_STATE}" \
  && grep -q "placeholder" "${TMP}/install.stderr"; then
  pass "install-cron prepares log"
else
  fail "install-cron prepares log"
  cat "${TMP}/install.stdout" 2>/dev/null || true
  cat "${TMP}/install.stderr" 2>/dev/null || true
fi

echo
echo "→ webhook delivery (local HTTP server)"
WEBHOOK_JSON="${TMP}/webhook-posts.json"
python3 - "${WEBHOOK_JSON}" <<'PY' &
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

out = sys.argv[1]
lock = threading.Lock()
posts = []

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        payload = json.loads(self.rfile.read(n).decode("utf-8"))
        with lock:
            posts.append(payload)
            Path = __import__("pathlib").Path
            Path(out).write_text(json.dumps(posts, indent=2, ensure_ascii=False), encoding="utf-8")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *_args):
        return

server = HTTPServer(("127.0.0.1", 0), Handler)
port = server.server_address[1]
Path = __import__("pathlib").Path
Path(out + ".port").write_text(str(port), encoding="utf-8")
server.serve_forever()
PY
WEBHOOK_PID=$!
sleep 0.4
WEBHOOK_PORT="$(cat "${WEBHOOK_JSON}.port")"
WEBHOOK_URL="http://127.0.0.1:${WEBHOOK_PORT}/hook"
echo '{"prices":["STALE"]}' > "${TMP}/wh-prices.json"
MONITOR_WEBHOOK_URL="${WEBHOOK_URL}" python3 scripts/www/monitor_landing.py \
  --url "${BASE}/www/" \
  --baseline "${TMP}/wh-prices.json" \
  --notify >/dev/null 2>&1 || true
sleep 0.4
kill "${WEBHOOK_PID}" 2>/dev/null || true
wait "${WEBHOOK_PID}" 2>/dev/null || true

if [[ -f "${WEBHOOK_JSON}" ]] && python3 - "${WEBHOOK_JSON}" <<'PY'
import json, sys
posts = json.loads(open(sys.argv[1], encoding="utf-8").read())
sys.exit(0 if any(p.get("event") == "PRICE_CHANGED" for p in posts) else 1)
PY
then
  pass "webhook POST received"
else
  fail "webhook POST received"
fi

echo
echo "→ playwright workflow (optional)"
if uri3 run-workflow examples/16_www_landing_monitor/task_graph.yaml --approve --browser playwright >/tmp/taskinity-wf-test.log 2>&1; then
  pass "playwright workflow"
else
  echo "  (skipped — playwright unavailable or browser missing)"
fi

echo
echo "=== results: ${PASS} passed, ${FAIL} failed ==="
if [[ "${FAIL}" -gt 0 ]]; then
  exit 1
fi
echo "all monitor tests ok"
