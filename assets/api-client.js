class TaskinityApiClient {
  constructor(config) {
    this.config = config;
    this.apiBaseUrl = localStorage.getItem("TASKINITY_API_BASE") || config.apiBaseUrl || "";
  }

  setBaseUrl(url) {
    this.apiBaseUrl = (url || "").trim().replace(/\/$/, "");
    localStorage.setItem("TASKINITY_API_BASE", this.apiBaseUrl);
  }

  useMock() {
    this.apiBaseUrl = "";
    localStorage.removeItem("TASKINITY_API_BASE");
  }

  isMock() {
    return !this.apiBaseUrl;
  }

  async health() {
    if (this.isMock()) {
      return mockEnvelope(true, "health", { status: "mock", message: "Browser mock runtime active." });
    }
    try {
      const res = await fetch(this.apiBaseUrl + this.config.endpoints.health);
      const data = await safeJson(res);
      return mockEnvelope(res.ok, "health", data, { apiBaseUrl: this.apiBaseUrl });
    } catch (err) {
      return mockEnvelope(false, "health", { error: String(err), hint: "API niedostępne. Przełączono logikę UI na mock." });
    }
  }

  async call(uri, payload = {}) {
    if (this.isMock()) return mockRoute(uri, payload);

    try {
      const res = await fetch(this.apiBaseUrl + this.config.endpoints.call, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uri, payload })
      });
      const data = await safeJson(res);
      if (data && data.workflow_status && data.service_result_status) return data;
      return mockEnvelope(res.ok, "api_result", data, { target: uri, apiBaseUrl: this.apiBaseUrl });
    } catch (err) {
      return mockEnvelope(false, "api_error", {
        uri,
        error: String(err),
        hint: "Nie udało się połączyć z API. Sprawdź bridge albo użyj trybu mock."
      }, { target: uri, apiBaseUrl: this.apiBaseUrl });
    }
  }

  async ask(prompt) {
    if (this.isMock()) {
      const plan = nlToUri(prompt);
      return mockEnvelope(true, "nl_plan", plan, { prompt });
    }

    try {
      const res = await fetch(this.apiBaseUrl + this.config.endpoints.ask, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await safeJson(res);
      if (data && data.workflow_status) return data;
      return mockEnvelope(res.ok, "nl_plan", data, { prompt });
    } catch (err) {
      return mockEnvelope(false, "api_error", { error: String(err), prompt }, { prompt });
    }
  }
}

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { text }; }
}

function mockEnvelope(ok, resultType, data, meta = {}) {
  return {
    ok,
    workflow_status: ok ? "completed" : "completed_with_service_error",
    execution_status: "completed",
    service_result_status: ok ? "succeeded" : "failed",
    result_type: resultType,
    data,
    meta: {
      runtime: "taskinity-browser-mock",
      transport: "browser",
      duration_ms: Math.floor(Math.random() * 10) + 1,
      ...meta
    }
  };
}

function nlToUri(prompt) {
  const p = prompt.toLowerCase();
  const agent = extractAgent(prompt) || window.TASKINITY_CONFIG.defaultAgent;

  if (p.includes("health") || p.includes("zdrow") || p.includes("sprawdź")) {
    return {
      intent: "check_health",
      uri: `health://agent/${agent}`,
      explanation: "Polecenie wygląda jak sprawdzenie health agenta."
    };
  }
  if (p.includes("diagnoz")) {
    return {
      intent: "diagnose_agent",
      uri: `repair://agent/${agent}/diagnose`,
      explanation: "Polecenie wygląda jak diagnoza agenta."
    };
  }
  if (p.includes("napraw")) {
    return {
      intent: "repair_agent",
      uri: `repair://agent/${agent}/apply`,
      explanation: "Polecenie wygląda jak próba naprawy. Ta akcja powinna wymagać approval."
    };
  }
  if (p.includes("ticket")) {
    const inc = extractIncident(prompt) || "inc_20260614_001";
    return {
      intent: "create_ticket",
      uri: `ticket://bug/from-incident/${inc}`,
      explanation: "Polecenie wygląda jak utworzenie ticketu z incydentu."
    };
  }
  if (p.includes("proposal") || p.includes("ewoluc") || p.includes("zmian")) {
    const ticket = extractTicket(prompt) || "PL-1";
    return {
      intent: "create_evolution_proposal",
      uri: `evolution://proposal/from-ticket/${ticket}`,
      explanation: "Polecenie wygląda jak wygenerowanie proposal z ticketu."
    };
  }
  return {
    intent: "show_process",
    uri: `view://process/agent/${agent}/latest`,
    explanation: "Domyślnie pokazuję proces agenta w formie widoku."
  };
}

function extractAgent(text) {
  const m = text.match(/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+/);
  return m ? m[0] : null;
}

function extractIncident(text) {
  const m = text.match(/inc_[a-zA-Z0-9_-]+/);
  return m ? m[0] : null;
}

function extractTicket(text) {
  const m = text.match(/[A-Z]{2,}-\d+/);
  return m ? m[0] : null;
}

function mockRoute(uri, payload = {}) {
  if (uri.startsWith("view://")) {
    return mockEnvelope(true, "process_view", {
      uri,
      title: "Proces agenta",
      status: "degraded",
      what_happened: "Agent został znaleziony, runtime state wskazuje drift portu, a health check wymaga uwagi.",
      why_it_matters: "Proces running nie oznacza automatycznie, że usługa jest gotowa.",
      next_actions: [
        "log://hypervisor?grep=weather-map-agent.local&level=ERROR",
        "repair://agent/weather-map-agent.local/diagnose",
        "ticket://bug/from-incident/inc_20260614_001"
      ]
    }, { target: uri });
  }
  if (uri.startsWith("health://")) {
    return mockEnvelope(false, "health", {
      uri,
      status: "failed",
      endpoint: "http://localhost:8105/health",
      message: "connection refused"
    }, { target: uri });
  }
  if (uri.startsWith("repair://") && uri.endsWith("/diagnose")) {
    return mockEnvelope(true, "diagnosis", {
      uri,
      classification: ["HEALTH_TIMEOUT", "HEALTH_URI_DRIFT"],
      confidence: 0.86,
      next: "repair://agent/weather-map-agent.local/apply"
    }, { target: uri });
  }
  if (uri.startsWith("repair://") && uri.endsWith("/apply")) {
    return mockEnvelope(true, "repair_result", {
      uri,
      repaired: true,
      final_status: "healthy"
    }, { target: uri });
  }
  if (uri.startsWith("ticket://")) {
    return mockEnvelope(true, "ticket", {
      uri: "ticket://bug/PL-1",
      title: "Health failed after dynamic port rebound",
      status: "planned"
    }, { target: uri });
  }
  if (uri.startsWith("evolution://")) {
    return mockEnvelope(true, "evolution_proposal", {
      uri,
      source: "ticket://bug/PL-1",
      creates: ["repair://case/health-timeout-after-dynamic-port"],
      requires_approval: true
    }, { target: uri });
  }
  return mockEnvelope(true, "generic", { uri, payload }, { target: uri });
}
