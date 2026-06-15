/**
 * TellMesh Flow Chat — URI exchange as structural flow (not JSON wall).
 */
(function () {
  "use strict";

  const API = "";
  const uriHelpers = window.TaskinityChatUri || {};
  const flow = window.TaskinityFlowView || {};
  const { looksLikeUri, extractUri, collectUris, buildNlUri, isNlUri, routeUserInput } = uriHelpers;
  const {
    createSession,
    plannerTurnFromAsk,
    executorTurnFromCall,
    renderGraphHtml,
    renderCompactYaml,
    renderLanesHtml,
  } = flow;

  const lanesEl = document.getElementById("flow-lanes");
  const liveGraphEl = document.getElementById("live-graph");
  const compactYamlEl = document.getElementById("compact-yaml");
  const form = document.getElementById("flow-form");
  const promptEl = document.getElementById("prompt");
  const dryRunEl = document.getElementById("dry-run");
  const demoBtn = document.getElementById("demo-btn");
  const clearBtn = document.getElementById("clear-btn");
  const runFlowBtn = document.getElementById("run-flow-btn");
  const statusPill = document.getElementById("status-pill");

  const session = createSession();
  let isBusy = false;

  const DEMO_SESSION = {
    turns: [
      {
        role: "user",
        nl: "pokaż proces agenta weather-map-agent.local\nzdiagnozuj agenta invoices-agent.local\nrob rzuty ekranów stron softreck.com prototypowanie.pl www co 5 minut do folderu usera ~/images/",
      },
      {
        role: "planner",
        batch: true,
        plans: [
          {
            kind: "agent",
            subtype: "process_view",
            deployment: "weather-map-agent.local",
            nl: "pokaż proces agenta weather-map-agent.local",
            uris: ["view://process/agent/weather-map-agent.local/latest"],
          },
          {
            kind: "agent",
            subtype: "diagnose",
            deployment: "invoices-agent.local",
            nl: "zdiagnozuj agenta invoices-agent.local",
            uris: ["repair://agent/invoices-agent.local/diagnose"],
          },
          {
            kind: "workflow",
            subtype: "website_screenshot_schedule",
            nl: "rob rzuty ekranów stron softreck.com prototypowanie.pl www co 5 minut…",
            uris: ["workflow://graph/website-screenshot-schedule/dry-run"],
          },
        ],
      },
      {
        role: "executor",
        uri: "repair://agent/invoices-agent.local/diagnose",
        result_type: "diagnosis",
        ok: true,
        summary: "invoices-agent.local · healthy · pid 66505 · :8123",
      },
      {
        role: "executor",
        uri: "workflow://graph/website-screenshot-schedule/dry-run",
        result_type: "plan",
        ok: true,
        summary: "2 steps: capture_softreck → capture_prototypowanie (browser://)",
        workflow_steps: [
          { id: "capture_softreck", uri: "browser://chrome/page/capture", payload: { url: "https://softreck.com" } },
          { id: "capture_prototypowanie", uri: "browser://chrome/page/capture", payload: { url: "https://prototypowanie.pl" } },
        ],
      },
      {
        role: "executor",
        uri: "view://process/agent/weather-map-agent.local/latest",
        result_type: "view",
        ok: true,
        summary: "Weather Map Agent · healthy · :8105",
      },
    ],
  };

  function bindRunButtons(root) {
    root.querySelectorAll(".flow-run-uri").forEach((btn) => {
      btn.addEventListener("click", () => executeUri(btn.dataset.uri));
    });
  }

  function renderAll() {
    lanesEl.innerHTML = renderLanesHtml(session);
    bindRunButtons(lanesEl);
    liveGraphEl.innerHTML = renderGraphHtml(session);
    compactYamlEl.textContent = renderCompactYaml(session);
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

  async function checkHealth() {
    try {
      const health = await apiFetch("/health");
      statusPill.textContent = `${health.agent} · OK`;
      statusPill.className = "pill pill--ok";
    } catch (_err) {
      statusPill.textContent = "offline · demo OK";
      statusPill.className = "pill pill--warn";
    }
  }

  async function planNl(text, nlUri) {
    const routed = nlUri ? { kind: "nl", uri: nlUri, nl: text } : routeUserInput(text);
    const uri = routed?.uri || buildNlUri(text);
    session.turns.push({ role: "user", nl: text, uri });
    renderAll();
    const result = await apiFetch("/api/uri/call", {
      method: "POST",
      body: JSON.stringify({
        uri,
        dry_run: dryRunEl.checked,
        approved: !dryRunEl.checked,
        policy: "dev",
      }),
    });
    session.turns.push(plannerTurnFromAsk(result));
    renderAll();
  }

  async function executeUri(uri, { echo = true } = {}) {
    if (isBusy) return;
    isBusy = true;
    try {
      if (echo) session.turns.push({ role: "user", nl: uri });
      const result = await apiFetch("/api/uri/call", {
        method: "POST",
        body: JSON.stringify({
          uri,
          dry_run: dryRunEl.checked,
          approved: !dryRunEl.checked,
          policy: "dev",
        }),
      });
      session.turns.push(executorTurnFromCall(uri, result));
      renderAll();
    } catch (err) {
      session.turns.push({
        role: "executor",
        uri,
        ok: false,
        result_type: "error",
        summary: String(err),
      });
      renderAll();
    } finally {
      isBusy = false;
    }
  }

  async function runWholeFlow() {
    flow.rebuildNodes(session);
    const uris = session.nodes.filter((n) => n.status === "planned").map((n) => n.uri);
    for (const u of uris) {
      await executeUri(u, { echo: false });
    }
  }

  function loadDemo() {
    session.turns = JSON.parse(JSON.stringify(DEMO_SESSION.turns));
    renderAll();
  }

  function clearSession() {
    session.turns.length = 0;
    session.nodes.length = 0;
    renderAll();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isBusy) return;
    const text = promptEl.value.trim();
    if (!text) return;
    promptEl.value = "";
    isBusy = true;
    try {
      const routed = routeUserInput(text);
      if (!routed) return;
      if (routed.kind === "uri") {
        await executeUri(routed.uri);
        return;
      }
      await planNl(routed.nl, routed.uri);
    } finally {
      isBusy = false;
    }
  }

  form.addEventListener("submit", handleSubmit);
  demoBtn.addEventListener("click", loadDemo);
  clearBtn.addEventListener("click", clearSession);
  runFlowBtn.addEventListener("click", runWholeFlow);

  checkHealth();
  loadDemo();
})();
