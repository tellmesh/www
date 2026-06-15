/**
 * Shared URI flow session view for TellMesh Chat and Flow Chat.
 */
(function () {
  "use strict";

  const uriHelpers = window.TaskinityChatUri || {};
  const { collectUris } = uriHelpers;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function schemeOf(uri) {
    const match = String(uri || "").match(/^([a-z][a-z0-9+.-]*):/i);
    return match ? match[1] : "uri";
  }

  function nodeClass(uri, status) {
    if (status === "failed") return "flow-node--failed";
    if (status === "executed") return "flow-node--executed";
    if (schemeOf(uri) === "workflow") return "flow-node--workflow";
    return "flow-node--planned";
  }

  function plannerTurnFromAsk(result) {
    const data = result.data || {};
    const batchActions = Array.isArray(data.actions)
      ? data.actions
      : Array.isArray(data.commands)
        ? data.commands
        : [];
    if (data.batch && batchActions.length) {
      return {
        role: "planner",
        batch: true,
        plans: batchActions.map((cmd) => ({
          kind: cmd.detected_kind || cmd.kind,
          subtype: cmd.detected_subtype || cmd.subtype,
          deployment: cmd.deployment_id,
          nl: cmd.prompt || cmd.text,
          uris: cmd.planned_uris || cmd.uris || [],
        })),
      };
    }
    return {
      role: "planner",
      kind: data.detected_kind,
      subtype: data.detected_subtype,
      deployment: data.deployment_id,
      nl: data.prompt,
      uris: data.planned_uris || data.uris || collectUris(data),
    };
  }

  function executorTurnFromCall(uri, result) {
    const data = result.data || {};
    const plan = data.plan || {};
    const manifest = plan.manifest || {};
    const graphNodes = manifest.uri_graph && manifest.uri_graph.nodes;
    const stepsFromGraph = Array.isArray(graphNodes)
      ? graphNodes.map((s) => ({
          id: s.id,
          uri: s.uri,
          payload: s.payload,
        }))
      : [];
    const steps = Array.isArray(plan.steps)
      ? plan.steps.map((s) => ({
          id: s.id,
          uri: s.uri,
          payload: s.payload || (s.manifest && s.manifest.payload),
        }))
      : stepsFromGraph;
    const summaryParts = [];
    if (result.result_type) summaryParts.push(result.result_type);
    if (data.title) summaryParts.push(data.title);
    if (data.graph_id || plan.graph_id) summaryParts.push(plan.graph_id || data.graph_id);
    if (result.service_result_status) summaryParts.push(result.service_result_status);
    return {
      role: "executor",
      uri,
      ok: result.ok !== false,
      result_type: result.result_type || "result",
      summary: summaryParts.join(" · ") || undefined,
      workflow_steps: steps.length ? steps : undefined,
    };
  }

  function rebuildNodes(session) {
    const seen = new Map();
    for (const turn of session.turns) {
      if (turn.role === "user" && turn.uri) {
        if (!seen.has(turn.uri)) {
          seen.set(turn.uri, { uri: turn.uri, status: "planned", summary: "nl input" });
        }
      }
      if (turn.role === "planner") {
        const plans = turn.batch ? turn.plans || [] : [{ uris: turn.uris || [] }];
        for (const plan of plans) {
          for (const u of plan.uris || []) {
            if (!seen.has(u)) seen.set(u, { uri: u, status: "planned" });
          }
        }
      }
      if (turn.role === "executor") {
        const u = turn.uri;
        if (u) {
          seen.set(u, {
            uri: u,
            status: turn.ok === false ? "failed" : "executed",
            summary: turn.summary,
          });
        }
        for (const step of turn.workflow_steps || []) {
          if (step.uri) {
            seen.set(step.uri, {
              uri: step.uri,
              status: turn.ok === false ? "failed" : "executed",
              summary: step.id,
              payload: step.payload,
            });
          }
        }
      }
    }
    session.nodes = [...seen.values()];
  }

  function renderGraphHtml(session) {
    rebuildNodes(session);
    if (!session.nodes.length) {
      return '<p class="flow-empty">Brak węzłów URI — wyślij NL lub URI.</p>';
    }
    const parts = [];
    session.nodes.forEach((node, index) => {
      if (index > 0) parts.push('<div class="flow-arrow" aria-hidden="true">→</div>');
      parts.push(`
        <div class="flow-node ${nodeClass(node.uri, node.status)}" title="${escapeHtml(node.summary || "")}">
          <div class="flow-node__scheme">${escapeHtml(schemeOf(node.uri))}</div>
          <div class="flow-node__uri">${escapeHtml(node.uri)}</div>
        </div>
      `);
    });
    return `<div class="flow-graph">${parts.join("")}</div>`;
  }

  function renderCompactYaml(session) {
    rebuildNodes(session);
    if (!session.nodes.length) {
      return "# do: [] — pojawi się po planie";
    }
    const lines = ["flow:", "  id: tellmesh-session", "  description: URI exchange session", "", "do:"];
    for (const node of session.nodes) {
      if (node.payload && Object.keys(node.payload).length) {
        lines.push(`  - ${node.uri}:`);
        for (const [key, val] of Object.entries(node.payload)) {
          lines.push(`      ${key}: ${val}`);
        }
      } else {
        lines.push(`  - ${node.uri}`);
      }
    }
    lines.push("", "# uri2flow expand → uri3 run-workflow");
    return lines.join("\n");
  }

  function renderTurnHtml(turn, index, onRunUri) {
    if (turn.role === "user") {
      return `
        <article class="flow-turn">
          <div class="flow-turn__head">
            <span class="flow-turn__badge flow-turn__badge--user">You</span>
            <span>Turn ${index + 1} · natural language</span>
          </div>
          <div class="flow-turn__body">
            <p class="flow-turn__nl">${escapeHtml(turn.nl).replace(/\n/g, "<br>")}</p>
            ${turn.uri ? `<p class="flow-turn__uri"><code>${escapeHtml(turn.uri)}</code></p>` : ""}
          </div>
        </article>
      `;
    }

    if (turn.role === "planner") {
      const cards = (turn.batch ? turn.plans : [{ uris: turn.uris, kind: turn.kind, subtype: turn.subtype, deployment: turn.deployment, nl: turn.nl }])
        .map((plan) => {
          const uris = (plan.uris || [])
            .map(
              (u) => `
              <li>
                <code>${escapeHtml(u)}</code>
                <button type="button" class="flow-run-uri" data-uri="${escapeHtml(u)}">Run</button>
              </li>`,
            )
            .join("");
          return `
            <div class="flow-plan-card">
              <div class="flow-plan-card__meta">
                <span>${escapeHtml(plan.subtype || plan.kind || "plan")}</span>
                ${plan.deployment ? `<span>${escapeHtml(plan.deployment)}</span>` : ""}
              </div>
              ${plan.nl ? `<p class="flow-turn__nl" style="margin-bottom:0.45rem">${escapeHtml(plan.nl)}</p>` : ""}
              <ul class="flow-uri-list">${uris}</ul>
            </div>`;
        })
        .join("");
      return `
        <article class="flow-turn">
          <div class="flow-turn__head">
            <span class="flow-turn__badge flow-turn__badge--planner">Planner</span>
            <span>Turn ${index + 1} · NL → planned_uris</span>
          </div>
          <div class="flow-turn__body">
            <div class="flow-plan-grid">${cards}</div>
          </div>
        </article>
      `;
    }

    if (turn.role === "executor") {
      const steps = (turn.workflow_steps || [])
        .map(
          (s) =>
            `<li><code>${escapeHtml(s.uri)}</code> <span class="flow-step-id">${escapeHtml(s.id || "")}</span></li>`,
        )
        .join("");
      return `
        <article class="flow-turn">
          <div class="flow-turn__head">
            <span class="flow-turn__badge flow-turn__badge--executor">Executor</span>
            <span>Turn ${index + 1} · ${escapeHtml(turn.result_type || "result")} · ${turn.ok === false ? "failed" : "ok"}</span>
          </div>
          <div class="flow-turn__body">
            <ul class="flow-uri-list">
              <li><code>${escapeHtml(turn.uri)}</code></li>
            </ul>
            ${turn.summary ? `<p class="flow-turn__nl">${escapeHtml(turn.summary)}</p>` : ""}
            ${steps ? `<p class="flow-subhead">Workflow graph steps</p><ul class="flow-uri-list">${steps}</ul>` : ""}
          </div>
        </article>
      `;
    }
    return "";
  }

  function renderLanesHtml(session) {
    if (!session.turns.length) {
      return '<p class="flow-empty">Wpisz NL lub URI — zobaczysz plan jako flow.</p>';
    }
    return session.turns.map((turn, index) => renderTurnHtml(turn, index)).join("");
  }

  function createSession() {
    return { turns: [], nodes: [] };
  }

  window.TaskinityFlowView = {
    createSession,
    plannerTurnFromAsk,
    executorTurnFromCall,
    rebuildNodes,
    renderGraphHtml,
    renderCompactYaml,
    renderLanesHtml,
    renderTurnHtml,
    escapeHtml,
    schemeOf,
  };
})();
