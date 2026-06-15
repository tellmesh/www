const client = new TaskinityApiClient(window.TASKINITY_CONFIG);

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("chatForm"),
  prompt: document.getElementById("promptInput"),
  jsonOut: document.getElementById("jsonOut"),
  currentUri: document.getElementById("currentUri"),
  uriBadge: document.getElementById("uriBadge"),
  resultBadge: document.getElementById("resultBadge"),
  miniGraph: document.getElementById("miniGraph"),
  apiState: document.getElementById("apiState"),
  apiBaseLabel: document.getElementById("apiBaseLabel"),
  apiBaseInput: document.getElementById("apiBaseInput")
};

init();

function init() {
  updateApiLabels();
  addAssistantWelcome();

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = els.prompt.value.trim();
    if (!prompt) return;
    els.prompt.value = "";
    await handlePrompt(prompt);
  });

  document.querySelectorAll("[data-prompt]").forEach(btn => {
    btn.addEventListener("click", () => handlePrompt(btn.dataset.prompt));
  });

  document.getElementById("saveApiBtn").addEventListener("click", () => {
    client.setBaseUrl(els.apiBaseInput.value);
    updateApiLabels();
    addAssistantMessage("Połączono z API", `Ustawiono backend: ${client.apiBaseUrl}. Od teraz chat będzie próbował wywoływać realne endpointy API.`);
  });

  document.getElementById("mockBtn").addEventListener("click", () => {
    client.useMock();
    updateApiLabels();
    addAssistantMessage("Tryb mock", "Przełączono na runtime mock w przeglądarce.");
  });

  document.getElementById("healthBtn").addEventListener("click", async () => {
    const result = await client.health();
    renderResult(result);
    addAssistantFromResult("API health", result, null);
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    els.messages.innerHTML = "";
    addAssistantWelcome();
  });
}

function updateApiLabels() {
  const mock = client.isMock();
  els.apiState.textContent = mock ? "mock" : "real API";
  els.apiBaseLabel.textContent = mock ? "local mock" : client.apiBaseUrl;
  els.apiBaseInput.value = mock ? "" : client.apiBaseUrl;
}

function addAssistantWelcome() {
  addAssistantMessage(
    "Cześć, jestem dashboardem Taskinity.",
    "Napisz naturalnie, np. „pokaż proces agenta weather-map-agent.local”, „zdiagnozuj agenta” albo „utwórz ticket z incydentu”. Zamienię to na URI, wywołam runtime i pokażę wynik jako prostą rozmowę."
  );
  renderGraph("view://process/agent/weather-map-agent.local/latest");
}

async function handlePrompt(prompt) {
  addUserMessage(prompt);

  const planResult = await client.ask(prompt);
  renderResult(planResult);

  if (!planResult.ok) {
    addAssistantFromResult("Nie udało się zaplanować polecenia", planResult, null);
    return;
  }

  const plan = planResult.data || {};
  const uri = plan.uri || "view://process/agent/weather-map-agent.local/latest";

  addAssistantMessage(
    "Rozpoznałem intencję",
    `${plan.explanation || "Polecenie zostało zamienione na URI."}`,
    [{ label: "URI", value: uri }, { label: "Intent", value: plan.intent || planResult.result_type }]
  );

  const callResult = await client.call(uri, { prompt });
  renderResult(callResult);
  addAssistantFromResult("Wynik runtime", callResult, uri);
}

function addUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "msg user";
  msg.innerHTML = `<div class="bubble">${escapeHtml(text)}</div><div class="meta">user · natural language command</div>`;
  els.messages.appendChild(msg);
  scrollMessages();
}

function addAssistantMessage(title, text, cards = []) {
  const msg = document.createElement("div");
  msg.className = "msg assistant";
  msg.innerHTML = `
    <div class="bubble">
      <b>${escapeHtml(title)}</b><br>
      ${escapeHtml(text)}
      ${cards && cards.length ? `<div class="cards">${cards.map(c => `<div class="card"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(String(c.value))}</span></div>`).join("")}</div>` : ""}
    </div>
    <div class="meta">assistant · taskinity dashboard</div>
  `;
  els.messages.appendChild(msg);
  scrollMessages();
}

function addAssistantFromResult(title, result, uri) {
  const data = result.data || {};
  const cards = [
    { label: "Status", value: result.service_result_status },
    { label: "Result type", value: result.result_type },
    { label: "Runtime", value: result.meta && result.meta.runtime ? result.meta.runtime : "unknown" }
  ];

  let text = humanizeResult(result);
  const msg = document.createElement("div");
  msg.className = "msg assistant";
  msg.innerHTML = `
    <div class="bubble">
      <b>${escapeHtml(title)}</b><br>
      ${escapeHtml(text)}
      ${uri ? `<br><span class="uri-line" data-uri="${escapeHtml(uri)}">${escapeHtml(uri)}</span>` : ""}
      <div class="cards">${cards.map(c => `<div class="card"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(String(c.value))}</span></div>`).join("")}</div>
      ${actionButtons(result)}
    </div>
    <div class="meta">runtime · service result envelope</div>
  `;
  els.messages.appendChild(msg);

  msg.querySelectorAll("[data-uri]").forEach(el => {
    el.addEventListener("click", async () => {
      const target = el.dataset.uri;
      const r = await client.call(target, {});
      renderResult(r);
      addAssistantFromResult("Akcja URI", r, target);
    });
  });

  scrollMessages();
}

const HUMANIZE_HANDLERS = {
  process_view(result) {
    const d = result.data || {};
    return `${d.what_happened || "Zbudowano widok procesu"} Dlaczego to ważne: ${d.why_it_matters || "Status procesu trzeba odróżnić od health usługi."}`;
  },
  health(result) {
    const d = result.data || {};
    return result.ok
      ? "Health check przeszedł poprawnie. Agent odpowiada."
      : `Health check nie przeszedł. ${d.message || "Usługa nie odpowiada."}`;
  },
  diagnosis(result) {
    const d = result.data || {};
    return `Diagnoza: ${(d.classification || []).join(", ")}. Pewność: ${d.confidence || "n/a"}.`;
  },
  repair_result(result) {
    return result.ok
      ? "Naprawa została wykonana. Sprawdź health, aby potwierdzić stan."
      : "Naprawa nie powiodła się.";
  },
  ticket(result) {
    const d = result.data || {};
    return `Utworzono lub zaplanowano ticket: ${d.uri || d.id || "ticket"}.`;
  },
  evolution_proposal() {
    return "Utworzono proposal zmiany. Wymaga weryfikacji i approval.";
  },
  api_error(result) {
    const d = result.data || {};
    return d.hint || d.error || "Błąd połączenia z API.";
  },
};

function humanizeResult(result) {
  const handler = HUMANIZE_HANDLERS[result.result_type];
  if (handler) return handler(result);
  return result.ok ? "Operacja zakończona poprawnie." : "Operacja zakończyła się błędem.";
}

function actionButtons(result) {
  const d = result.data || {};
  const actions = [];

  if (result.result_type === "process_view") {
    actions.push(["Pokaż health", "health://agent/weather-map-agent.local"]);
    actions.push(["Diagnozuj", "repair://agent/weather-map-agent.local/diagnose"]);
    actions.push(["Ticket", "ticket://bug/from-incident/inc_20260614_001"]);
  }
  if (result.result_type === "diagnosis") {
    actions.push(["Napraw", "repair://agent/weather-map-agent.local/apply"]);
    actions.push(["Ticket", "ticket://bug/from-incident/inc_20260614_001"]);
  }
  if (result.result_type === "ticket") {
    actions.push(["Proposal", "evolution://proposal/from-ticket/PL-1"]);
  }

  if (!actions.length) return "";
  return `<div class="actions">${actions.map(([label, uri]) => `<button class="secondary" data-uri="${escapeHtml(uri)}">${escapeHtml(label)}</button>`).join("")}</div>`;
}

function renderResult(result) {
  els.jsonOut.textContent = JSON.stringify(result, null, 2);
  els.resultBadge.textContent = result.service_result_status || "unknown";
  els.resultBadge.style.background = result.ok ? "rgba(52,211,153,.18)" : "rgba(251,113,133,.18)";
  const uri = result.meta && result.meta.target ? result.meta.target : (result.data && result.data.uri ? result.data.uri : "—");
  els.currentUri.textContent = uri;
  els.uriBadge.textContent = result.result_type || "result";
  renderGraph(uri);
}

function renderGraph(uri) {
  const rows = graphForUri(uri);
  els.miniGraph.innerHTML = rows.map(r => `
    <div class="gnode ${r.status}">
      <div class="ico">${r.icon}</div>
      <div>
        <b>${escapeHtml(r.title)}</b>
        <span>${escapeHtml(r.text)}</span>
      </div>
    </div>
  `).join("");
}

function graphForUri(uri) {
  if (!uri || uri === "—") uri = "view://process/agent/weather-map-agent.local/latest";
  return [
    { icon: "1", status: "ok", title: "User", text: "Wpisuje proste polecenie w chacie." },
    { icon: "2", status: "ok", title: "NL → URI", text: `System wybiera URI: ${uri}` },
    { icon: "3", status: uri.startsWith("repair://") ? "warn" : "ok", title: "Runtime API", text: "API wywołuje urish / uri2run / hypervisor albo mock." },
    { icon: "4", status: uri.includes("ticket") || uri.includes("evolution") ? "warn" : "ok", title: "Wynik", text: "Chat pokazuje prostą narrację, akcje i envelope." }
  ];
}

function scrollMessages() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
