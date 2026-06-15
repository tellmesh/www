/**
 * Taskinity landing — product tour slides, scroll reveal, FAQ
 */
(function () {
  "use strict";

  const THEME_KEY = "taskinity.theme";
  const LANG_KEY = "taskinity.lang";
  const THEMES = ["warm", "dark", "light"];
  const LANGS = ["pl", "en", "de"];
  const i18n = window.TaskinityLandingI18n || {};
  const TRANSLATIONS = i18n.TRANSLATIONS || {};
  const TEXT_BINDINGS = i18n.TEXT_BINDINGS || [];

  const SLIDE_DURATION_MS = 5500;
  const STEPS = [
    {
      id: "prompt",
      title: "Jedna komenda zamiast ręcznego klejenia usług",
      caption: "Operator opisuje cel po polsku. Taskinity zamienia go na plan URI, artefakty i kontrolowany runtime.",
      build: buildSlidePrompt,
    },
    {
      id: "plan",
      title: "NL → plan URI",
      caption: "System rozbija prompt na kroki: generowanie agentów, rejestr deploymentów, start, inspect i supervisor.",
      build: buildSlidePlan,
    },
    {
      id: "agents",
      title: "3 agenci startują mimo zajętych portów",
      caption: "Preferowane porty są zajęte przez inne usługi, więc runtime wybiera wolne porty i zapisuje effective health URI.",
      build: buildSlideAgents,
    },
    {
      id: "failure",
      title: "Jeden agent pada",
      caption: "Proces user-agent zostaje zabity poza hypervisorem. State nadal wskazuje stary PID, więc inspect widzi stale runtime.",
      build: buildSlideFailure,
    },
    {
      id: "repair",
      title: "Supervisor naprawia w pętli",
      caption: "Inspect → klasyfikacja → restart na effective port → ponowny health/card. Po jednej próbie agent wraca do healthy.",
      build: buildSlideRepair,
    },
    {
      id: "proof",
      title: "Dowód: proces, health, card i logi są spójne",
      caption: "Ta sama prawda jest widoczna w Web UI, CLI, API i runtime state. To pozwala systemowi działać autonomicznie.",
      build: buildSlideProof,
    },
  ];
  const SCENARIOS = {
    agents: {
      title: "3 agenci wygenerowani i uruchomieni",
      summary: "Plan NL przechodzi przez generate, rejestr deploymentów i health-check dla każdego agenta.",
      lines: [
        { tone: "info", text: '$ urish ask "stwórz 3 agentów i uruchom lokalnie"' },
        { tone: "ok", text: "plan://run/agents accepted · policy=dry-run" },
        { tone: "ok", text: "generate weather-map-agent.local → agents/generated/weather_map_agent" },
        { tone: "ok", text: "generate user-agent.local → agents/generated/user_agent" },
        { tone: "ok", text: "generate invoices-agent.local → agents/generated/invoices_agent" },
        { tone: "ok", text: "health summary: 3/3 healthy" },
      ],
      metrics: [
        ["Agents", "3 generated"],
        ["Health", "3/3 OK"],
        ["Repair", "none"],
        ["State", "persisted"],
      ],
      focus: ["nl", "uri", "registry", "runtime", "proof"],
    },
    ports: {
      title: "Runtime wybiera port efektywny",
      summary: "Deklarowany port może być zajęty. System zapisuje realny health URI zamiast kończyć działanie błędem.",
      lines: [
        { tone: "info", text: "$ hypervisor run-agent weather-map-agent.local --port 8101" },
        { tone: "warn", text: "port :8101 busy · owner: previous service" },
        { tone: "ok", text: "selected effective port :8110" },
        { tone: "ok", text: "runtime_state.health_uri = http://localhost:8110/health" },
        { tone: "ok", text: "card://agent/weather-map-agent.local → healthy" },
      ],
      metrics: [
        ["Declared", ":8101"],
        ["Effective", ":8110"],
        ["Health URI", "synced"],
        ["Status", "healthy"],
      ],
      focus: ["uri", "registry", "runtime", "proof"],
    },
    repair: {
      title: "Awaria przechodzi przez repair loop",
      summary: "Supervisor rozróżnia proces running od service healthy, czyta state/logi i wykonuje ograniczoną naprawę.",
      lines: [
        { tone: "info", text: "$ hypervisor inspect-agent user-agent.local" },
        { tone: "bad", text: "RUNTIME_STATE_STALE · saved PID not alive" },
        { tone: "warn", text: "health failed on http://localhost:8118/health" },
        { tone: "info", text: "$ hypervisor supervise user-agent.local --repair auto --max-attempts 3" },
        { tone: "ok", text: "strategy restart_agent selected · safe mutation approved" },
        { tone: "ok", text: "verify health OK · card OK · logs clean · attempts=1" },
      ],
      metrics: [
        ["Before", "stale"],
        ["Strategy", "restart"],
        ["Attempts", "1/3"],
        ["After", "healthy"],
      ],
      focus: ["registry", "runtime", "repair", "proof"],
    },
    ecommerce: {
      title: "WooCommerce → Baselinker → ERP w jednym widoku",
      summary: "Webhook ze sklepu, sync magazynu i faktura w ERP — Taskinity rejestruje każdy krok i przy awarii pokazuje incident w chacie.",
      lines: [
        { tone: "info", text: "Woo webhook order.created → workflow://order/new" },
        { tone: "ok", text: "Baselinker getOrders · 12 new · shell://scripts/sync-baselinker.sh OK" },
        { tone: "ok", text: "invoices-agent.local → http://erp.local/api/invoices · 201 Created" },
        { tone: "warn", text: "Allegro OAuth token expires in 2h · refresh scheduled" },
        { tone: "bad", text: "ERP POST 503 · order #4521 stuck in processing" },
        { tone: "info", text: '$ urish ask "zdiagnozuj synchronizację Allegro i pokaż błędy ERP"' },
        { tone: "ok", text: "repair://agent/invoices-agent.local/diagnose · incident opened" },
      ],
      metrics: [
        ["Woo", "webhook OK"],
        ["Baselinker", "sync OK"],
        ["ERP", "503 retry"],
        ["Chat", "diagnose"],
      ],
      focus: ["nl", "uri", "registry", "repair"],
    },
    office: {
      title: "Dzień Marty — portal, faktury, bank, token Android",
      summary: "Biuro opisuje zadanie po polsku. System łączy WWW, ERP, bank online i telefon — zatrzymując się na 2FA i approve.",
      lines: [
        { tone: "info", text: '$ urish ask "pobierz raport VAT z portalu i zapisz w rozliczeniach"' },
        { tone: "ok", text: "browser://portal/vat-report → CSV saved · output/rozliczenia/" },
        { tone: "ok", text: "workflow://invoices/batch/dry-run → 8 PDF · waiting approval" },
        { tone: "info", text: "human://marta/approve/invoices/batch → wyślij zatwierdzone" },
        { tone: "ok", text: "invoices-agent.local → ERP + e-mail · 8/8 sent" },
        { tone: "warn", text: "workflow://bank/batch-transfer · STOP before 2FA" },
        { tone: "info", text: "android://device/pixel-7/screenshot → push shown in chat" },
        { tone: "ok", text: "human://marta/input/bank-token · browser://bank/confirm OK" },
      ],
      metrics: [
        ["Portal", "CSV OK"],
        ["Faktury", "8 sent"],
        ["Bank", "2FA OK"],
        ["Audit", "logged"],
      ],
      focus: ["nl", "uri", "registry", "proof"],
    },
  };

  function storageGet(key) {
    try {
      return window.localStorage?.getItem(key) || "";
    } catch (err) {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage?.setItem(key, value);
    } catch (err) {
      // Preferences are progressive enhancement; ignore blocked storage.
    }
  }

  function normalizeChoice(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  let currentLang = normalizeChoice(storageGet(LANG_KEY) || document.documentElement.lang, LANGS, "en");
  let currentTheme = normalizeChoice(document.documentElement.dataset.theme || storageGet(THEME_KEY), THEMES, "dark");
  let currentStep = 0;
  let autoTimer = null;
  let paused = false;
  let progressRAF = null;
  let progressStart = 0;
  let scenarioTimers = [];

  const stageEl = document.getElementById("tour-slide-host");
  const captionTitle = document.getElementById("tour-caption-title");
  const captionText = document.getElementById("tour-caption-text");
  const progressBar = document.getElementById("tour-progress-bar");
  const countEl = document.getElementById("tour-count");
  const stepButtons = document.querySelectorAll(".tour-step-btn");
  const btnPrev = document.getElementById("tour-prev");
  const btnNext = document.getElementById("tour-next");
  const btnPlay = document.getElementById("tour-play");
  const btnCopyChat = document.getElementById("tour-copy-chat");
  const scenarioTabs = document.querySelectorAll(".scenario-tab");
  const scenarioTerminal = document.getElementById("scenario-terminal");
  const scenarioResult = document.getElementById("scenario-result");
  const scenarioReplay = document.getElementById("scenario-replay");
  const systemMapNodes = document.querySelectorAll(".system-map-node");

  function lookup(key) {
    const langCopy = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    const fallbackCopy = TRANSLATIONS.en;
    const read = (obj) => key.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
    return read(langCopy) ?? read(fallbackCopy) ?? "";
  }

  function getStepCopy(id) {
    const step = STEPS.find((item) => item.id === id);
    return {
      title: lookup(`steps.${id}.title`) || step?.title || "",
      caption: lookup(`steps.${id}.caption`) || step?.caption || "",
    };
  }

  function setNodeText(selector, value, mode) {
    const el = document.querySelector(selector);
    if (!el || value === undefined || value === "") return;
    if (mode === "html") {
      el.innerHTML = value;
      return;
    }
    if (mode === "mixedAfterStrong") {
      const strong = el.querySelector("strong");
      if (strong) el.innerHTML = `<strong>${escapeHtml(strong.textContent || "")}</strong> ${escapeHtml(value)}`;
      return;
    }
    el.textContent = value;
  }

  function applyTheme(theme) {
    currentTheme = normalizeChoice(theme, THEMES, "dark");
    document.documentElement.dataset.theme = currentTheme;
    storageSet(THEME_KEY, currentTheme);
    document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
      const active = btn.getAttribute("data-theme-choice") === currentTheme;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function updatePlayButton() {
    if (!btnPlay) return;
    btnPlay.textContent = paused ? lookup("controls.play") : lookup("controls.pause");
    btnPlay.dataset.state = paused ? "paused" : "playing";
    btnPlay.setAttribute("aria-pressed", paused ? "true" : "false");
  }

  function applyLanguage(lang) {
    currentLang = normalizeChoice(lang, LANGS, "en");
    document.documentElement.lang = currentLang;
    storageSet(LANG_KEY, currentLang);
    const copy = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
    document.title = copy.title || TRANSLATIONS.en.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", copy.metaDescription || TRANSLATIONS.en.metaDescription);

    TEXT_BINDINGS.forEach(([key, selector, mode]) => setNodeText(selector, lookup(key), mode));
    document.querySelectorAll("[data-lang-choice]").forEach((btn) => {
      const active = btn.getAttribute("data-lang-choice") === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll(".tour-step-btn").forEach((btn, index) => {
      const label = lookup("tour.steps")?.[index];
      const labelEl = btn.querySelector(".tour-step-label");
      if (labelEl && label) labelEl.textContent = label;
    });
    document.querySelectorAll(".scenario-tab").forEach((btn, index) => {
      const label = lookup("tour.tabs")?.[index];
      if (label) btn.textContent = label;
    });
    if (btnPrev) btnPrev.textContent = lookup("controls.prev");
    if (btnNext) btnNext.textContent = lookup("controls.next");
    if (btnCopyChat) btnCopyChat.textContent = lookup("controls.copyChat");
    updatePlayButton();

    const activeScenario = document.querySelector(".scenario-tab.is-active")?.getAttribute("data-scenario") || "agents";
    if (scenarioTerminal && scenarioResult) renderScenario(activeScenario, { animate: false });
    if (stageEl?.children.length) renderStep(currentStep);
    window.TaskinityOfficeCards?.apply(currentLang);
    document.querySelectorAll(".integration-i18n").forEach((el) => {
      const elLang = el.getAttribute("data-i18n-lang") || "en";
      el.hidden = elLang !== currentLang;
    });
    window.TaskinityExamplesGallery?.refreshOfficeChains?.();
  }

  function initPreferences() {
    applyTheme(currentTheme);
    document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
      btn.addEventListener("click", () => applyTheme(btn.getAttribute("data-theme-choice") || "dark"));
    });
    document.querySelectorAll("[data-lang-choice]").forEach((btn) => {
      btn.addEventListener("click", () => applyLanguage(btn.getAttribute("data-lang-choice") || "en"));
    });
    applyLanguage(currentLang);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildSlidePrompt(container) {
    container.innerHTML = `
      <div class="demo-command">
        <div class="demo-command-bar">
          <span class="live-dot"></span>
          <span>urish ask</span>
        </div>
        <p>„Wygeneruj 3 agentów: pogodę, użytkowników i faktury. Uruchom lokalnie, sprawdź health i napraw automatycznie, jeśli któryś padnie.”</p>
      </div>
      <div class="flow-diagram flow-diagram-wide" aria-hidden="true">
        <div class="flow-node info" style="animation-delay:0.1s">NL prompt</div>
        <span class="flow-arrow" style="animation-delay:0.2s">→</span>
        <div class="flow-node ok" style="animation-delay:0.3s">plan URI</div>
        <span class="flow-arrow" style="animation-delay:0.4s">→</span>
        <div class="flow-node ok" style="animation-delay:0.5s">generate</div>
        <span class="flow-arrow" style="animation-delay:0.6s">→</span>
        <div class="flow-node ok" style="animation-delay:0.7s">supervise</div>
      </div>
      <div class="demo-note">
        <span class="dot ok"></span>
        <div>
          Użytkownik nie musi znać <code>uvicorn</code>, PID-ów ani portów. System zachowuje artefakty, URI i runtime state.
        </div>
      </div>`;
  }

  function mockShell(activeId, messagesHtml, inputText) {
    const processes = [
      { id: "weather", name: "weather-map-agent", status: "ok", label: "healthy · :8110" },
      { id: "user", name: "user-agent", status: activeId === "user-bad" ? "bad" : "ok", label: activeId === "user-bad" ? "stale · PID dead" : "healthy · :8118" },
      { id: "invoices", name: "invoices-agent", status: "ok", label: "healthy · :8122" },
    ];
    const sidebar = processes
      .map(
        (p) => `
      <div class="mock-process${p.id === activeId ? " is-highlight" : ""}">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="status ${p.status}">${escapeHtml(p.label)}</div>
      </div>`
      )
      .join("");

    return `
      <div class="mock-layout">
        <div class="mock-sidebar">
          <h4>Agenci</h4>
          ${sidebar}
        </div>
        <div class="mock-chat">
          <div class="mock-messages">${messagesHtml}</div>
          <div class="mock-input">
            <span class="${inputText ? "typing-cursor" : ""}">${escapeHtml(inputText || "Napisz pytanie…")}</span>
          </div>
        </div>
      </div>`;
  }

  function buildSlidePlan(container) {
    const html = mockShell(
      "weather",
      `<div class="mock-msg user" style="animation-delay:0.1s">
        <div class="label">Ty</div>
        Wygeneruj 3 agentów, uruchom, sprawdź health i napraw awarię.
      </div>
      <div class="mock-msg bot" style="animation-delay:0.3s">
        <div class="label">Taskinity</div>
        Plan:
        <ol>
          <li><code>urigen generate</code> dla 3 kontraktów</li>
          <li><code>hypervisor run-agent</code> z dynamicznym portem</li>
          <li><code>inspect-agent</code> health/card/logs</li>
          <li><code>supervise --repair auto</code> przy awarii</li>
        </ol>
      </div>`,
      ""
    );
    container.innerHTML = html;
  }

  function buildSlideAgents(container) {
    container.innerHTML = `
      <div class="agent-run-grid">
        ${agentRunCard("weather-map-agent", "8101", "8110", "healthy", "0.1s")}
        ${agentRunCard("user-agent", "8102", "8118", "healthy", "0.25s")}
        ${agentRunCard("invoices-agent", "8103", "8122", "healthy", "0.4s")}
      </div>
      <div class="repair-timeline compact" aria-label="Start agentów">
        <div class="repair-event is-done" style="animation-delay:0.1s"><strong>generate</strong><span>pliki agentów</span></div>
        <div class="repair-event is-done" style="animation-delay:0.25s"><strong>port check</strong><span>8101/8102/8103 zajęte</span></div>
        <div class="repair-event is-done" style="animation-delay:0.4s"><strong>rebind</strong><span>8110/8118/8122</span></div>
        <div class="repair-event is-done" style="animation-delay:0.55s"><strong>health</strong><span>3 healthy</span></div>
      </div>`;
  }

  function agentRunCard(name, declared, effective, state, delay) {
    return `
      <div class="agent-run-card ${state}" style="animation-delay:${delay}">
        <div class="agent-run-top">
          <span class="dot ok"></span>
          <strong>${escapeHtml(name)}</strong>
        </div>
        <div class="agent-run-port">
          <span>declared</span><code>:${escapeHtml(declared)}</code>
          <i>→</i>
          <span>effective</span><code>:${escapeHtml(effective)}</code>
        </div>
        <div class="agent-run-status">health OK · card OK · logs clean</div>
      </div>`;
  }

  function buildSlideFailure(container) {
    container.innerHTML = mockShell(
      "user-bad",
      `<div class="mock-msg bot" style="animation-delay:0.1s">
        <div class="label">Taskinity</div>
        Wykryto awarię:
        <code>readiness://agent/user-agent.local</code>
        <ul>
          <li><strong style="color:#fb7185">RUNTIME_STATE_STALE</strong></li>
          <li>PID zapisany w state nie żyje</li>
          <li>Health/card na <code>:8118</code> nie odpowiada</li>
          <li>Rekomendacja: <code>restart</code></li>
        </ul>
      </div>`,
      ""
    );
  }

  function buildSlideRepair(container) {
    container.innerHTML = `
      <div class="repair-loop" aria-label="Pętla naprawcza">
        <div class="repair-event is-bad" style="animation-delay:0.1s">
          <strong>inspect</strong><span>stale runtime · health failed</span>
        </div>
        <div class="repair-event is-warn" style="animation-delay:0.25s">
          <strong>classify</strong><span>safe repair: restart_agent</span>
        </div>
        <div class="repair-event is-info" style="animation-delay:0.4s">
          <strong>apply</strong><span>start na effective :8118</span>
        </div>
        <div class="repair-event is-done" style="animation-delay:0.55s">
          <strong>verify</strong><span>health OK · card OK · PID nowy</span>
        </div>
      </div>
      <div class="repair-result">
        <div>
          <span>before</span>
          <strong class="bad-text">stale</strong>
        </div>
        <i></i>
        <div>
          <span>attempts</span>
          <strong>1</strong>
        </div>
        <i></i>
        <div>
          <span>after</span>
          <strong class="ok-text">healthy</strong>
        </div>
      </div>
      <pre class="demo-code">hypervisor supervise user-agent.local --repair auto --max-attempts 3
→ strategy: restart
→ port: 8118
→ result: healthy</pre>`;
  }

  function buildSlideProof(container) {
    const items = [
      "Chat layer",
      "Web API",
      "CLI",
      "Runtime",
      "Health",
      "Agent card",
      "Logs",
      "Policy gate",
      "Repair loop",
    ];
    container.innerHTML = `
      <p class="proof-lead">Ten sam agent w każdej warstwie — <code>agent://user-agent</code></p>
      <div class="proof-grid">
        ${items
          .map(
            (label, i) => `
          <div class="proof-item" style="animation-delay:${(i * 0.08).toFixed(2)}s">
            <span>${escapeHtml(label)}</span>
            <span class="ok-badge">OK</span>
          </div>`
          )
          .join("")}
      </div>
      <pre class="demo-code">$ hypervisor inspect-agent user-agent.local
process: running
health:  ok
card:    ok
repair:  none</pre>`;
  }

  function copyTourChat() {
    const slide = stageEl?.querySelector(".tour-slide");
    const messages = slide?.querySelectorAll(".mock-msg");
    if (!messages?.length) {
      flashTourCopy(lookup("controls.noChat"));
      return;
    }
    const lines = ["# Taskinity — demo chat", ""];
    messages.forEach((msg) => {
      const label = msg.querySelector(".label")?.textContent?.trim() || "Wiadomość";
      const clone = msg.cloneNode(true);
      clone.querySelector(".label")?.remove();
      lines.push(`## ${label}`);
      lines.push("");
      lines.push((clone.textContent || "").trim());
      lines.push("");
    });
    const text = lines.join("\n").trim();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => flashTourCopy()).catch(() => flashTourCopy(lookup("controls.error")));
      return;
    }
    flashTourCopy(lookup("controls.noClipboard"));
  }

  function flashTourCopy(label = lookup("controls.copied")) {
    if (!btnCopyChat) return;
    const original = btnCopyChat.textContent;
    btnCopyChat.textContent = label;
    window.setTimeout(() => {
      btnCopyChat.textContent = original;
    }, 1400);
  }

  function clearScenarioTimers() {
    scenarioTimers.forEach((timer) => window.clearTimeout(timer));
    scenarioTimers = [];
  }

  function getScenario(id) {
    return SCENARIOS[id] || SCENARIOS.agents;
  }

  function renderScenarioResult(scenario) {
    if (!scenarioResult) return;
    scenarioResult.innerHTML = `
      <div class="scenario-result-head">
        <span class="live-dot"></span>
        <div>
          <strong>${escapeHtml(scenario.title)}</strong>
          <p>${escapeHtml(scenario.summary)}</p>
        </div>
      </div>
      <div class="scenario-metrics">
        ${scenario.metrics
          .map(
            ([label, value]) => `
          <div class="scenario-metric">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>`
          )
          .join("")}
      </div>`;
  }

  function setSystemMapFocus(focus = []) {
    if (!systemMapNodes.length) return;
    const active = new Set(focus);
    systemMapNodes.forEach((node) => {
      const key = node.getAttribute("data-map-node") || "";
      node.classList.toggle("is-active", active.has(key));
    });
  }

  function appendScenarioLine(line, index) {
    if (!scenarioTerminal) return;
    const row = document.createElement("div");
    row.className = `terminal-line is-${line.tone || "info"}`;
    row.style.animationDelay = `${Math.min(index * 0.04, 0.2)}s`;
    row.innerHTML = `<span class="terminal-caret">›</span><span>${escapeHtml(line.text)}</span>`;
    scenarioTerminal.appendChild(row);
  }

  function renderScenario(id, options = {}) {
    if (!scenarioTerminal || !scenarioResult) return;
    const scenario = getScenario(id);
    const animate = options.animate !== false && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    clearScenarioTimers();
    scenarioTerminal.innerHTML = "";
    renderScenarioResult(scenario);
    setSystemMapFocus(scenario.focus);

    scenario.lines.forEach((line, index) => {
      if (!animate) {
        appendScenarioLine(line, index);
        return;
      }
      const timer = window.setTimeout(() => appendScenarioLine(line, index), index * 260);
      scenarioTimers.push(timer);
    });
  }

  function initScenarioLab() {
    if (!scenarioTerminal || !scenarioResult || !scenarioTabs.length) return;
    scenarioTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-scenario") || "agents";
        scenarioTabs.forEach((item) => {
          const selected = item === tab;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-selected", selected ? "true" : "false");
        });
        renderScenario(id);
      });
    });

    scenarioReplay?.addEventListener("click", () => {
      const active = document.querySelector(".scenario-tab.is-active")?.getAttribute("data-scenario") || "agents";
      renderScenario(active);
    });

    renderScenario("agents", { animate: false });
  }

  function renderStep(index) {
    const step = STEPS[index];
    if (!step || !stageEl) return;
    const stepCopy = getStepCopy(step.id);

    currentStep = index;
    stageEl.innerHTML = "";
    const slide = document.createElement("div");
    slide.className = "tour-slide is-active";
    slide.id = `slide-${step.id}`;
    stageEl.appendChild(slide);
    step.build(slide);

    if (captionTitle) captionTitle.textContent = stepCopy.title;
    if (captionText) captionText.textContent = stepCopy.caption;
    if (countEl) countEl.textContent = `${index + 1} / ${STEPS.length}`;

    stepButtons.forEach((btn, i) => {
      btn.classList.toggle("is-active", i === index);
      btn.setAttribute("aria-current", i === index ? "step" : "false");
    });

    resetProgress();
  }

  function resetProgress() {
    if (!progressBar) return;
    progressStart = performance.now();
    if (progressRAF) cancelAnimationFrame(progressRAF);
    function tick(now) {
      if (paused) {
        progressRAF = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - progressStart;
      const pct = Math.min(100, (elapsed / SLIDE_DURATION_MS) * 100);
      progressBar.style.width = `${pct}%`;
      if (pct < 100) progressRAF = requestAnimationFrame(tick);
    }
    progressRAF = requestAnimationFrame(tick);
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startAuto() {
    stopAuto();
    if (paused) return;
    autoTimer = setInterval(() => {
      goToStep((currentStep + 1) % STEPS.length);
    }, SLIDE_DURATION_MS);
  }

  function goToStep(index) {
    renderStep(index);
    if (!paused) startAuto();
  }

  function pauseTourPlayback() {
    paused = true;
    updatePlayButton();
    stopAuto();
  }

  function bindTourStepButtons() {
    stepButtons.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        pauseTourPlayback();
        goToStep(i);
      });
    });
  }

  function bindTourNavButtons() {
    btnPrev?.addEventListener("click", () => {
      pauseTourPlayback();
      goToStep((currentStep - 1 + STEPS.length) % STEPS.length);
    });
    btnNext?.addEventListener("click", () => {
      pauseTourPlayback();
      goToStep((currentStep + 1) % STEPS.length);
    });
  }

  function bindTourPlayButton() {
    btnPlay?.addEventListener("click", () => {
      paused = !paused;
      updatePlayButton();
      if (paused) {
        stopAuto();
        return;
      }
      resetProgress();
      startAuto();
    });
  }

  function bindTourHoverPause() {
    const tourSection = document.getElementById("tour");
    tourSection?.addEventListener("mouseenter", () => {
      paused = true;
      stopAuto();
    });
    tourSection?.addEventListener("mouseleave", () => {
      if (btnPlay?.dataset.state === "playing") {
        paused = false;
        resetProgress();
        startAuto();
      }
    });
  }

  function initTour() {
    if (!stageEl) return;
    bindTourStepButtons();
    bindTourNavButtons();
    bindTourPlayButton();
    btnCopyChat?.addEventListener("click", copyTourChat);
    bindTourHoverPause();
    renderStep(0);
    startAuto();
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    let done = false;
    let failSafeTimer = null;
    const revealAll = () => {
      if (done) return;
      done = true;
      els.forEach((el) => el.classList.add("is-visible"));
      obs.disconnect();
      if (failSafeTimer) window.clearTimeout(failSafeTimer);
    };
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
        if (Array.from(els).every((el) => el.classList.contains("is-visible"))) {
          revealAll();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => obs.observe(el));
    failSafeTimer = window.setTimeout(revealAll, 1800);
  }

  function initFaq() {
    document.querySelectorAll(".faq-item").forEach((item) => {
      const btn = item.querySelector(".faq-q");
      btn?.addEventListener("click", () => {
        const open = item.classList.contains("is-open");
        document.querySelectorAll(".faq-item.is-open").forEach((o) => o.classList.remove("is-open"));
        if (!open) item.classList.add("is-open");
      });
    });
  }

  function initSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (!id || id === "#") return;
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function initOfficeCards() {
    document.querySelectorAll(".office-use-card").forEach((card) => {
      card.classList.add("office-use-card--clickable");
      card.addEventListener("click", () => {
        const quote = card.querySelector(".office-chat-quote")?.textContent?.trim();
        if (!quote) return;
        const prompt = quote.replace(/^[„""']+|[„""']+$/g, "").trim();
        storageSet("taskinity.chatPrompt", prompt);
        window.location.href = "chat.html";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPreferences();
    initTour();
    initScenarioLab();
    initReveal();
    initFaq();
    initSmoothAnchors();
    initOfficeCards();
  });
})();
