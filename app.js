const API = "";

const uri = window.TaskinityChatUri || {};
const md = window.TaskinityChatMarkdown || {};
const {
  extractUri,
  extractUriFromCode,
  extractUrisFromCodeBlocks,
  collectUris,
  isPlausibleUri,
  looksLikeUri,
  uriImpliesDryRun,
  buildNlUri,
  isNlUri,
  routeUserInput,
  agentsForSidebar,
} = uri;
const { escapeHtml, renderMarkdown, htmlToPlainText } = md;


const QUICK_PROMPTS = [
  {
    label: "WWW · CSV report",
    prompt:
      "Wejdź na stronę dostawcy, pobierz raport CSV za ten miesiąc i zapisz w rozliczeniach.",
  },
  {
    label: "Portal · ZUS form",
    prompt:
      "Zaloguj się do portalu klienta, uzupełnij formularz ZUS i wyślij — najpierw pokaż podgląd.",
  },
  {
    label: "Subiekt · ERP window",
    prompt: "Otwórz Subiekta, wklej dane z Excela do faktury i zapisz jako szkic.",
  },
  {
    label: "Invoices · WooCommerce",
    prompt:
      "Wystaw faktury za zamówienia z WooCommerce, pokaż listę do akceptacji i wyślij tylko zatwierdzone.",
  },
  {
    label: "Bank · batch transfer",
    prompt: "Przygotuj przelewy do dostawców z listy — zatrzymaj się przed autoryzacją.",
  },
  {
    label: "Android · 2FA token",
    prompt: "Bank czeka na potwierdzenie w aplikacji — pokaż mi ekran telefonu.",
  },
];

const INTRO_MARKDOWN =
  "## TellMesh Chat\n\n" +
  "NL → URI → result in one view. Pick a quick prompt or type your own command.\n\n" +
  "Paste **one command per line** for batch planning:\n\n" +
  "```bash\n" +
  "pokaż proces agenta weather-map-agent.local\n" +
  "zdiagnozuj agenta invoices-agent.local\n" +
  "rob rzuty ekranów stron softreck.com prototypowanie.pl www co 5 minut do folderu usera ~/images/\n" +
  "```";

const conversationLog = [];
let isBusy = false;

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const promptEl = document.getElementById("prompt");
const dryRunEl = document.getElementById("dry-run");
const speakSummaryEl = document.getElementById("speak-summary");
const sendBtn = document.getElementById("send-btn");
const statusPill = document.getElementById("status-pill");
const apiDetail = document.getElementById("api-detail");
const refreshBtn = document.getElementById("refresh-btn");
const copyChatBtn = document.getElementById("copy-chat-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const quickPromptsEl = document.getElementById("quick-prompts");
const agentListEl = document.getElementById("agent-list");
const eventListEl = document.getElementById("event-list");
const micBtn = document.getElementById("mic-btn");
const voiceEngineEl = document.getElementById("voice-engine");
const workspaceEl = document.getElementById("workspace");
const flowPanelEl = document.getElementById("flow-panel");
const inlineFlowGraphEl = document.getElementById("inline-flow-graph");
const inlineFlowYamlEl = document.getElementById("inline-flow-yaml");
const inlineFlowLanesEl = document.getElementById("inline-flow-lanes");
const viewNlBtn = document.getElementById("view-nl-btn");
const viewSplitBtn = document.getElementById("view-split-btn");
const viewFlowBtn = document.getElementById("view-flow-btn");

const flowView = window.TaskinityFlowView || {};
const flowSession = flowView.createSession ? flowView.createSession() : { turns: [], nodes: [] };
const FLOW_VIEW_KEY = "taskinity.chatView";

function setChatView(mode) {
  const allowed = new Set(["nl", "split", "flow"]);
  const selected = allowed.has(mode) ? mode : "nl";
  workspaceEl.classList.remove("view-nl", "view-split", "view-flow");
  workspaceEl.classList.add(`view-${selected}`);
  flowPanelEl.hidden = selected === "nl";
  viewNlBtn.classList.toggle("is-active", selected === "nl");
  viewSplitBtn.classList.toggle("is-active", selected === "split");
  viewFlowBtn.classList.toggle("is-active", selected === "flow");
  try {
    localStorage.setItem(FLOW_VIEW_KEY, selected);
  } catch (_err) {
    // Ignore blocked storage.
  }
}

function renderInlineFlowPanel() {
  if (!flowView.renderGraphHtml) return;
  inlineFlowGraphEl.innerHTML = flowView.renderGraphHtml(flowSession);
  inlineFlowYamlEl.textContent = flowView.renderCompactYaml(flowSession);
  inlineFlowLanesEl.innerHTML = flowView.renderLanesHtml(flowSession);
  inlineFlowLanesEl.querySelectorAll(".flow-run-uri").forEach((btn) => {
    btn.addEventListener("click", () => callUri(btn.dataset.uri));
  });
}

function recordFlowUser(text, uri) {
  const turn = { role: "user", nl: text };
  if (uri) turn.uri = uri;
  flowSession.turns.push(turn);
  renderInlineFlowPanel();
}

function recordFlowPlanner(result) {
  if (!flowView.plannerTurnFromAsk) return;
  flowSession.turns.push(flowView.plannerTurnFromAsk(result));
  renderInlineFlowPanel();
}

function recordFlowExecutor(uri, result) {
  if (!flowView.executorTurnFromCall) return;
  flowSession.turns.push(flowView.executorTurnFromCall(uri, result));
  renderInlineFlowPanel();
}

function buildConversationMarkdown() {
  const lines = ["# TellMesh Chat", ""];
  conversationLog.forEach((entry) => {
    lines.push(`## ${entry.role === "user" ? "You" : "Assistant"}`);
    lines.push("");
    lines.push(entry.text);
    lines.push("");
  });
  return lines.join("\n").trim();
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

function flashButtonFeedback(button, okLabel = "Copied") {
  if (!button) return;
  const original = button.textContent;
  button.textContent = okLabel;
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1400);
}

async function copyConversation() {
  const markdown = buildConversationMarkdown();
  if (!markdown || conversationLog.length === 0) {
    flashButtonFeedback(copyChatBtn, "Nothing to copy");
    return;
  }
  try {
    await copyToClipboard(markdown);
    flashButtonFeedback(copyChatBtn);
  } catch (err) {
    flashButtonFeedback(copyChatBtn, "Copy failed");
    console.error(err);
  }
}

function appendMessage(role, bodyHtml, { text, error = false, uris = [] } = {}) {
  const bodyText = text ?? htmlToPlainText(bodyHtml);
  conversationLog.push({ role, text: bodyText });
  if (role === "user" && bodyText) {
    recordFlowUser(bodyText);
  }
  const wrap = document.createElement("article");
  wrap.className = `msg msg--${role}${error ? " msg--error" : ""}`;
  wrap.innerHTML = `
    <div class="msg-role">${role === "user" ? "You" : "Assistant"}</div>
    <div class="msg-body">${bodyHtml}</div>
  `;
  messagesEl.appendChild(wrap);
  enhanceBlocks(wrap);
  appendUriActions(wrap, uris);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function enhanceBlocks(root) {
  root.querySelectorAll("pre > code").forEach((codeEl) => {
    const text = codeEl.textContent || "";
    const uri = extractUriFromCode(text);
    const actions = document.createElement("div");
    actions.className = "block-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      try {
        await copyToClipboard(text.trim());
        flashButtonFeedback(copyBtn);
      } catch (err) {
        console.error(err);
      }
    });
    actions.appendChild(copyBtn);

    if (uri) {
      actions.appendChild(actionButton("Preview URI", () => previewUri(uri)));
      actions.appendChild(
        actionButton("Dry-run URI", () => callUri(uri, { dryRun: true })),
      );
      actions.appendChild(
        actionButton("Run real", () => callUri(uri, { approved: true, dryRun: false })),
      );
    }

    codeEl.parentElement?.insertAdjacentElement("afterend", actions);
  });
}

function appendPlanActions(root, askResult) {
  const data = askResult?.data || {};
  const planUris = Array.isArray(data.planned_uris)
    ? data.planned_uris.filter((uri) => typeof uri === "string" && uri.includes("://"))
    : collectUris(data);
  const displayUris = collectUris(data);
  if (!planUris.length && !displayUris.length) return;

  const actions = document.createElement("div");
  actions.className = "plan-actions";
  if (planUris.length) {
    actions.appendChild(
      actionButton("Run plan (dry-run)", () =>
        runPlan(planUris, { dryRun: true, approved: false }),
      ),
    );
    actions.appendChild(
      actionButton("Run plan (approve)", () =>
        runPlan(planUris, { dryRun: false, approved: true }),
      ),
    );
  }
  displayUris.slice(0, 4).forEach((uri) => {
    actions.appendChild(actionButton(shortUri(uri), () => previewUri(uri), "uri-chip"));
  });
  root.appendChild(actions);
}

function planRunPayload(uris, { dryRun = true, approved = false } = {}) {
  return {
    planned_uris: uris,
    dry_run: dryRun,
    approved,
    policy: "dev",
    stop_on_error: true,
    auto_repair: true,
    retry_after_repair: true,
    speak_summary: Boolean(speakSummaryEl?.checked),
  };
}

async function runPlan(uris, { dryRun = true, approved = false } = {}) {
  if (isBusy || !uris.length) return;
  setBusy(true);
  appendMessage(
    "user",
    `<p>Run plan (${uris.length} URI, ${approved ? "approve" : "dry-run"})</p>`,
    { text: `Run plan (${uris.length} URI)` },
  );
  try {
    const result = await apiFetch("/api/plan/run", {
      method: "POST",
      body: JSON.stringify(planRunPayload(uris, { dryRun, approved })),
    });
    const md = result.message_markdown || "```json\n" + JSON.stringify(result, null, 2) + "\n```";
    appendMessage("assistant", renderMarkdown(md), {
      uris: collectUris(result),
      text: md,
    });
    for (const step of result.results || []) {
      if (step.message_markdown || step.presentation_markdown || step.html) {
        const stepMd =
          step.presentation_markdown ||
          step.message_markdown ||
          "```json\n" + JSON.stringify(step, null, 2) + "\n```";
        const stepWrap = appendMessage("assistant", renderMarkdown(stepMd), {
          uris: collectUris(step),
          text: stepMd,
        });
        appendPresentationHtml(stepWrap, step);
      }
    }
    if (result.speech) {
      await playSpeechResult(result.speech);
    }
    await loadSystemState();
  } catch (err) {
    appendMessage("assistant", `<p><strong>Plan run error</strong></p><p>${escapeHtml(String(err))}</p>`, {
      error: true,
    });
  } finally {
    setBusy(false);
  }
}

function renderEvents(events) {
  if (!events.length) {
    eventListEl.className = "list list--empty";
    eventListEl.textContent = "brak zdarzeń";
    return;
  }
  eventListEl.className = "list";
  eventListEl.innerHTML = "";
  events.slice(0, 8).forEach((event) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "list-item";
    const summary = event.summary || event.status || "";
    const badge = event.level ? `${event.level} · ` : "";
    item.innerHTML = `<strong>${escapeHtml(event.type)}</strong><span>${escapeHtml(badge + (event.agent_id || summary || event.uri || ""))}</span>`;
    const targetUri = event.view_uri || event.uri;
    if (targetUri && String(targetUri).includes("://")) {
      item.addEventListener("click", () => callUri(targetUri));
    }
    eventListEl.appendChild(item);
  });
}

function startEventStream() {
  if (eventStream || typeof EventSource === "undefined") return;
  try {
    eventStream = new EventSource(`${API}/api/events/stream?limit=12&interval_s=8`);
    eventStream.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data);
        renderEvents(payload.events || []);
      } catch (_err) {
        // Ignore malformed SSE payloads.
      }
    };
    eventStream.onerror = () => {
      if (eventStream) {
        eventStream.close();
        eventStream = null;
      }
    };
  } catch (_err) {
    eventStream = null;
  }
}

function appendUriActions(root, uris) {
  const uniqueUris = [...new Set([...(uris || []), ...extractUrisFromCodeBlocks(root)])];
  if (!uniqueUris.length) return;

  const actions = document.createElement("div");
  actions.className = "uri-actions";
  uniqueUris.slice(0, 6).forEach((uri) => {
    const group = document.createElement("div");
    group.className = "uri-action-group";
    group.appendChild(actionButton(shortUri(uri), () => previewUri(uri), "uri-chip"));
    group.appendChild(actionButton("Dry-run", () => callUri(uri, { dryRun: true })));
    group.appendChild(actionButton("Run real", () => callUri(uri, { approved: true, dryRun: false })));
    actions.appendChild(group);
  });
  root.appendChild(actions);
}

function actionButton(label, handler, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function shortUri(uri) {
  return uri.length > 46 ? `${uri.slice(0, 43)}...` : uri;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = payload.detail || payload.error || res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return payload;
}

async function checkHealth({ silent = false } = {}) {
  try {
    const health = await apiFetch("/health");
    statusPill.textContent = `${health.agent} · OK`;
    statusPill.className = "pill pill--ok";
    apiDetail.textContent = `${health.version || "dev"} · ${API || "same-origin"}`;
    return health;
  } catch (err) {
    statusPill.textContent = "brak API";
    statusPill.className = "pill pill--warn";
    apiDetail.textContent = "offline";
    if (!silent) {
      appendMessage(
        "assistant",
        `<p>Brak połączenia z API. Uruchom serwer:</p><pre><code>urish www serve</code></pre><p>${escapeHtml(String(err))}</p>`,
        { error: true },
      );
    }
    return null;
  }
}

async function loadSystemState() {
  await checkHealth({ silent: true });
  await Promise.all([loadAgents(), loadEvents()]);
}

async function loadAgents() {
  try {
    const payload = await apiFetch("/api/agents");
    const agents = agentsForSidebar(payload.agents || []);
    if (!agents.length) {
      agentListEl.className = "list list--empty";
      agentListEl.textContent = "brak wpisów";
      return;
    }
    agentListEl.className = "list";
    agentListEl.innerHTML = "";
    agents.slice(0, 6).forEach((agent) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-item";
      item.innerHTML = `<strong>${escapeHtml(agent.id)}</strong><span>${escapeHtml(agent.status || "unknown")}</span>`;
      item.addEventListener("click", () => callUri(agent.view_uri || `view://process/agent/${agent.id}/latest`));
      agentListEl.appendChild(item);
    });
  } catch (err) {
    agentListEl.className = "list list--empty";
    agentListEl.textContent = "API niedostępne";
  }
}

async function loadEvents() {
  try {
    const payload = await apiFetch("/api/events?limit=12");
    renderEvents(payload.events || []);
  } catch (err) {
    eventListEl.className = "list list--empty";
    eventListEl.textContent = "API niedostępne";
  }
}


async function askPrompt(text, nlUri) {
  const uri = nlUri || buildNlUri(text);
  return apiFetch("/api/ask", {
    method: "POST",
    body: JSON.stringify({
      uri,
      dry_run: dryRunEl.checked,
      llm: false,
    }),
  });
}

async function previewUri(uri) {
  if (isBusy) return;
  appendMessage("user", `<p>Preview <code>${escapeHtml(uri)}</code></p>`, {
    text: `Preview \`${uri}\``,
  });
  setBusy(true);
  try {
    const result = await apiFetch("/api/uri/preview", {
      method: "POST",
      body: JSON.stringify({
        uri,
        dry_run: true,
        policy: "dev",
      }),
    });
    appendMessage("assistant", renderMarkdown(formatPreviewMarkdown(result)), {
      uris: [uri],
      text: formatPreviewMarkdown(result),
    });
  } catch (err) {
    appendMessage("assistant", `<p><strong>Preview error</strong></p><p>${escapeHtml(String(err))}</p>`, {
      error: true,
    });
  } finally {
    setBusy(false);
  }
}

function formatPreviewMarkdown(result) {
  const approval = result.requires_approval ? "yes" : "no";
  const dryRunAllowed = result.dry_run_allowed ? "allowed" : "blocked";
  const execute = result.execute_allowed_with_approval ? "yes" : "no";
  const mode = dryRunEl.checked ? "dry-run (checkbox on)" : "real execution (checkbox off)";
  return [
    "## URI preview",
    `URI: \`${result.uri}\``,
    `Mode: **${mode}** · dry-run policy: **${dryRunAllowed}** · requires approval: **${approval}** · execute after approval: **${execute}**`,
    "",
    "```json",
    JSON.stringify(result, null, 2),
    "```",
  ].join("\n");
}

function appendPresentationHtml(root, result) {
  const html = result.html || (result.data && result.data.html);
  if (!html || typeof html !== "string") return;
  const wrap = document.createElement("div");
  wrap.className = "html-preview";
  wrap.dataset.html = html;
  wrap.innerHTML = `
    <div class="html-preview__label">HTML · ${escapeHtml(result.source_uri || result.view_uri || result.uri || "view")}</div>
    <iframe class="html-preview__frame" sandbox="allow-same-origin" title="URI HTML preview"></iframe>
  `;
  const body = root.querySelector(".msg-body");
  if (body) body.appendChild(wrap);
  const frame = wrap.querySelector(".html-preview__frame");
  if (frame) frame.srcdoc = html;
}

async function callUri(uri, { approved = false, echoUser = true, dryRun = null } = {}) {
  if (isBusy) return;
  if (echoUser) {
    appendMessage("user", `<p><code>${escapeHtml(uri)}</code></p>`, { text: `\`${uri}\`` });
  }
  setBusy(true);
  try {
    const impliedDryRun = uriImpliesDryRun(uri);
    const effectiveDryRun =
      dryRun === null ? (dryRunEl.checked && !approved) || impliedDryRun : dryRun;
    const result = await apiFetch("/api/uri/call", {
      method: "POST",
      body: JSON.stringify({
        uri,
        dry_run: effectiveDryRun,
        approved: approved && !impliedDryRun,
        policy: "dev",
      }),
    });
    recordFlowExecutor(uri, result);
    const md =
      result.presentation_markdown ||
      result.message_markdown ||
      "```json\n" + JSON.stringify(result, null, 2) + "\n```";
    const wrap = appendMessage("assistant", renderMarkdown(md), {
      uris: collectUris(result.data),
      text: md,
    });
    appendPresentationHtml(wrap, result);
    await loadSystemState();
  } catch (err) {
    recordFlowExecutor(uri, {
      ok: false,
      result_type: "error",
      service_result_status: "failed",
      data: { title: String(err) },
    });
    appendMessage("assistant", `<p><strong>URI error</strong></p><p>${escapeHtml(String(err))}</p>`, {
      error: true,
    });
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  isBusy = busy;
  sendBtn.disabled = busy;
  promptEl.disabled = busy;
  refreshBtn.disabled = busy;
  if (copyChatBtn) copyChatBtn.disabled = busy;
  if (clearChatBtn) clearChatBtn.disabled = busy;
  if (micBtn) micBtn.disabled = busy;
}


async function handleSubmit(event) {
  event.preventDefault();
  if (isBusy) return;
  const text = promptEl.value.trim();
  if (!text) return;

  promptEl.value = "";
  const routed = routeUserInput(text);
  if (!routed) return;

  appendMessage("user", `<p>${escapeHtml(routed.nl)}</p>`, { text: routed.nl });
  if (routed.kind === "nl") {
    recordFlowUser(routed.nl, routed.uri);
  }

  if (routed.kind === "uri") {
    if (/[a-z][a-z0-9+.-]*:\/\//i.test(text) && !isPlausibleUri(text)) {
      appendMessage(
        "assistant",
        `<p>To wygląda na ucięty URL lub niepełny adres — nie uruchamiam go jako URI.</p><p>Jeśli chodziło o health agenta, użyj:</p><pre><code>view://process/agent/weather-map-agent.local/latest</code></pre>`,
        { error: true },
      );
      return;
    }
    await callUri(routed.uri, { echoUser: false });
    return;
  }

  setBusy(true);
  try {
    const result = await askPrompt(routed.nl, routed.uri);
    recordFlowPlanner(result);
    const md = result.message_markdown || "_No response._";
    const wrap = appendMessage("assistant", renderMarkdown(md), {
      uris: collectUris(result.data),
      text: md,
    });
    appendPlanActions(wrap, result);
    await maybeSpeakAssistantReply(md);
  } catch (err) {
    appendMessage("assistant", `<p><strong>Ask error</strong></p><p>${escapeHtml(String(err))}</p>`, {
      error: true,
    });
  } finally {
    setBusy(false);
  }
}

function resetConversation() {
  conversationLog.length = 0;
  flowSession.turns.length = 0;
  flowSession.nodes.length = 0;
  messagesEl.innerHTML = "";
  appendMessage("assistant", renderMarkdown(INTRO_MARKDOWN), { text: INTRO_MARKDOWN });
  renderInlineFlowPanel();
}

function renderQuickPrompts() {
  quickPromptsEl.innerHTML = "";
  QUICK_PROMPTS.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.dataset.prompt = item.prompt;
    button.addEventListener("click", () => {
      promptEl.value = item.prompt;
      promptEl.focus();
    });
    quickPromptsEl.appendChild(button);
  });
}


const voice = (window.TaskinityChatVoice || {}).create({
  apiFetch,
  appendMessage,
  setBusy,
  isBusy: () => isBusy,
  promptEl,
  form,
  micBtn,
  voiceEngineEl,
  speakSummaryEl,
  escapeHtml,
});
const { playSpeechResult, maybeSpeakAssistantReply, toggleVoiceCapture } = voice;

form.addEventListener("submit", handleSubmit);
refreshBtn.addEventListener("click", () => loadSystemState());
micBtn?.addEventListener("click", toggleVoiceCapture);
copyChatBtn?.addEventListener("click", () => copyConversation());
clearChatBtn?.addEventListener("click", resetConversation);
viewNlBtn?.addEventListener("click", () => setChatView("nl"));
viewSplitBtn?.addEventListener("click", () => setChatView("split"));
viewFlowBtn?.addEventListener("click", () => setChatView("flow"));
promptEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    form.requestSubmit();
  }
});

renderQuickPrompts();
resetConversation();
try {
  setChatView(localStorage.getItem(FLOW_VIEW_KEY) || "nl");
} catch (_err) {
  setChatView("nl");
}
loadSystemState();
startEventStream();

const CHAT_PROMPT_KEY = "taskinity.chatPrompt";
try {
  const pendingPrompt = localStorage.getItem(CHAT_PROMPT_KEY);
  if (pendingPrompt) {
    localStorage.removeItem(CHAT_PROMPT_KEY);
    promptEl.value = pendingPrompt;
    promptEl.focus();
  }
} catch (_err) {
  // Ignore blocked storage.
}
