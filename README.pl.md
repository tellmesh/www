# Taskinity WWW (`www/`)

Strona produktowa + interfejs czatu podłączony do API dashboardu (`agents/system/hypervisor_dashboard`).

## Strony

| URL | Plik | Opis |
|-----|------|------|
| `/www/` | `index.html` | **Landing** — prezentacja, integracje, biuro, oferta |
| `/www/chat.html` | `chat.html` | **Chat na żywo** — NL → plan URI, wywołania API |
| `/www/przyklady.html` | `przyklady.html` | **Lab integracji** — karty PASS + filtry |
| `/www/docs/examples.html` | `docs/examples.html` | **Docs examples** — pełna zawartość `examples/*/*` |
| `/www/demo.html` | `demo.html` | Demo techniczne URI (statyczne) |

**Indeks repo:** [`docs/README.md`](../docs/README.md) · [`examples/README.md`](../examples/README.md) · [`TODO.md`](../TODO.md) · [`CHANGELOG.md`](../CHANGELOG.md)

## Uruchomienie

### Docker (zalecane)

```bash
make start          # build + uruchom kontener
make www-smoke      # test health / www / chat / api/ask
make stop           # zatrzymaj kontener
make www-logs       # logi
```

- Landing: http://localhost:8788/www/
- Chat: http://localhost:8788/www/chat.html

Compose działa z siecią i PID-ami hosta oraz montuje katalogi runtime z hosta
(patrz `docker-compose.yml`). `deployments/` i `output/` są zapisywalne, żeby
zatwierdzony real-run repair mógł przepiąć port, utrwalić runtime state i pokazać
logi procesu w czacie.

### Lokalnie (bez Docker)

```bash
urish www serve
# lub
urish www open
```

## Landing page

Pliki:

- `index.html` — struktura sekcji (hero, problem, tour, oferta, FAQ)
- `landing.css` — styl, animacje, responsywność
- `landing.js` — interaktywna prezentacja 6 kroków (autoplay, pauza, nawigacja)

Sekcja **„Jak to działa w praktyce”** pokazuje scenariusz faktur → ERP 401 → chat → incident → ticket → proof techniczny.

Sekcja **„Integracje w 3 krokach”** pokazuje prosty wzorzec podłączenia istniejących systemów:
WordPress, WooCommerce, BaseLinker, Allegro.pl, ERP/CRM i portale WWW. Każdy przykład ma prompt NL,
docelowe URI oraz punkt health/repair.

Landing ma przełączniki preferencji w nawigacji:

- język: `PL`, `EN`, `DE`,
- motyw: `Warm`, `Dark`, `Light`.

Wybór zapisuje się lokalnie w `localStorage` (`taskinity.lang`, `taskinity.theme`) i działa bez backendu.

Scenariusze biurowe są rozwinięte w [`../examples/31_office_day/`](../examples/31_office_day/) (pełny mock dzień) oraz [`../examples/33_office_workflows/`](../examples/33_office_workflows/) (karta landing → URI Touri).

Copy marketingowe: [`../market/LANDING_COPY.md`](../market/LANDING_COPY.md)

## Docs examples (`docs/examples.html`)

Pełna dokumentacja katalogu `examples/` — generowana ze źródeł repo:

```bash
make www-docs
# lub
python3 scripts/www/build_examples_docs.py
```

Zawartość: `examples/README.md`, każde `examples/*/README.md` oraz pliki YAML/TXT/SH (run.sh, task.*, prompt.txt).

URL: http://localhost:8788/www/docs/examples.html

## Chat (`chat.html`)

**Przepływ:** NL albo głos → `POST /api/ask` (plan) → użytkownik klika URI / Run plan albo uruchamia odpowiednik w CLI. Chat **nie** wykonuje pełnego workflow po Enter.

| Akcja | Endpoint |
|-------|----------|
| Prompt NL (pojedynczy lub batch) | `POST /api/ask` |
| Preview URI | `POST /api/uri/preview` |
| URI | `POST /api/uri/call` |
| Sekwencja zaplanowanych URI | `POST /api/plan/run` |
| Transkrypcja głosu | `POST /api/voice/transcribe` |
| Agenci | `GET /api/agents` |
| Snapshot zdarzeń | `GET /api/events` |
| Live feed zdarzeń | `GET /api/events/stream` |

Funkcje:

- **Quick prompts** — sześć scenariuszy biurowych (te same cytaty co karty landing)
- **Batch** — wklej jedną komendę na linię → `Detected N commands`
- **Klik karty biurowej** → wstawia prompt do czatu przez `localStorage.taskinity.chatPrompt`
- **Run plan** — wykonuje wszystkie zaplanowane URI w dry-run albo approved przez policy gate
- **Panel live** — agenci oraz zdarzenia incident/monitor/health przez SSE
- **Głos** — mikrofon w przeglądarce → mock/Whisper STT → zwykła ścieżka planowania NL
- Domyślnie **English** UI; karty biurowe i18n PL/EN/DE przez `office-cards-i18n.js`
- Cache-busted `app.js` — twardy refresh po aktualizacjach

Pliki: `app.js`, `styles.css`. Pełny przewodnik: [`docs/CHAT_AND_WORKFLOWS.md`](../docs/CHAT_AND_WORKFLOWS.md)

```bash
curl -s -X POST http://localhost:8788/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"pokaż proces agenta weather-map-agent.local","dry_run":true}'

curl -s -X POST http://localhost:8788/api/plan/run \
  -H 'Content-Type: application/json' \
  -d '{"planned_uris":["health://agent/invoices-agent.local"],"dry_run":true}'

curl -s -X POST http://localhost:8788/api/voice/transcribe \
  -H 'Content-Type: application/json' \
  -d '{"engine":"mock","text":"zdiagnozuj agenta invoices-agent.local"}'
```

## Montowanie Docker

Compose działa z `network_mode: host` i `pid: host`, a potem bind-mountuje `www/`,
`packages/`, `agents/generated/`, `deployments/`, `output/` itd., więc kod API, probe,
porty i wygenerowani agenci odpowiadają repo na hoście bez rebuildu. `deployments/`
jest zapisywalne celowo dla zatwierdzonych napraw; do planowania bez zmian używaj
dry-run/preview.

## Tworzenie przez NL (CLI)

```bash
urish ask "stwórz dashboard agenta hypervisor"
urish www create "stwórz prosty chat markdown połączony z API systemu" --plan-only
```

## Monitoring landingu

```bash
make www-monitor       # uruchom sprawdzenia teraz
make www-monitor-test  # testy monitoringu, webhooka i crona
make www-monitor-reset # nowa baseline cen po celowej zmianie
```

Cron:

```bash
bash scripts/www/install-cron.sh            # podgląd wpisu
bash scripts/www/install-cron.sh --install  # instalacja co 5 min
bash scripts/www/install-cron.sh --status   # status + ostatnie linie logu
bash scripts/www/install-cron.sh --remove   # usunięcie wpisu
```

`--install` przygotowuje `/tmp/taskinity-monitor.log`, więc `tail -f /tmp/taskinity-monitor.log`
nie powinien padać przed pierwszym przebiegiem crona. Dla n8n/Slack/Make podaj prawdziwy URL:

```bash
bash scripts/www/install-cron.sh --update --webhook "https://hooks.n8n.cloud/webhook/real-token"
```

Adresy przykładowe typu `twoja-instancja...`, `hooks.example...` albo `abc123` są traktowane jako placeholder i nie są wysyłane do webhooka.
