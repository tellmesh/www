/**
 * URI extraction and validation helpers for Taskinity Chat.
 */
(function () {
  "use strict";

  const INTERNAL_URI_SCHEMES = new Set([
    "view",
    "repair",
    "health",
    "runtime",
    "workflow",
    "flow",
    "log",
    "agent",
    "agent-factory",
    "resource",
    "ticket",
    "hypervisor",
    "browser",
    "dom",
    "device",
    "file",
    "readiness",
    "schema",
    "proposal",
    "ecosystem",
    "evolution",
    "artifact",
    "incident",
    "cron",
    "robot",
    "chat",
    "nl",
  ]);

  function httpHostLooksValid(host) {
    if (!host || host.length < 3) return false;
    if (host === "localhost") return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
    if (host.startsWith("local") && host !== "localhost") return false;
    return host.includes(".") && !host.endsWith(".");
  }

  function extractUri(text) {
    const match = text.match(/([a-z][a-z0-9+.-]*:\/\/[^\s`'")\]:]+(?:\/[^\s`'")\]]*)?)/i);
    const candidate = match ? match[1].replace(/[.,;]+$/, "") : null;
    return candidate && isPlausibleUri(candidate) ? candidate : null;
  }

  function extractUriFromCode(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    const direct = trimmed.match(/^([a-z][a-z0-9+.-]*:\/\/[^\s`'")\]:]+(?:\/[^\s`'")\]]*)?)/i);
    if (direct) {
      const uri = direct[1].replace(/[.,;]+$/, "");
      if (isPlausibleUri(uri)) return uri;
    }
    for (const line of trimmed.split("\n")) {
      const candidate = line.trim();
      const uri = extractUri(candidate);
      if (uri && (candidate === uri || candidate.endsWith(uri))) return uri;
    }
    return extractUri(trimmed);
  }

  function extractUrisFromCodeBlocks(root) {
    const uris = [];
    root.querySelectorAll("pre > code, code.uri-link").forEach((codeEl) => {
      const uri = extractUriFromCode(codeEl.textContent || "");
      if (uri) uris.push(uri);
    });
    return uris;
  }

  function collectUris(data) {
    if (!data || typeof data !== "object") return [];
    const uris = [];
    if (Array.isArray(data.actions)) {
      data.actions.forEach((action) => {
        uris.push(...collectUris(action));
      });
    }
    for (const key of ["planned_uris", "uris"]) {
      if (Array.isArray(data[key])) uris.push(...data[key]);
    }
    if (typeof data.uri === "string") uris.push(data.uri);
    if (Array.isArray(data.actions)) {
      data.actions.forEach((action) => {
        if (action && typeof action.uri === "string") uris.push(action.uri);
      });
    }
    return [...new Set(uris.filter((uri) => typeof uri === "string" && uri.includes("://")))];
  }

  function isPlausibleUri(uri) {
    const trimmed = String(uri || "").trim();
    const match = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i);
    if (!match) return false;
    const scheme = match[1].toLowerCase();
    const authority = match[2];
    if (scheme === "http" || scheme === "https") {
      const host = authority.split(":")[0];
      return httpHostLooksValid(host);
    }
    return INTERNAL_URI_SCHEMES.has(scheme);
  }

  function looksLikeUri(text) {
    const trimmed = text.trim();
    if (!/[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return false;
    const uri = extractUri(trimmed) || trimmed;
    return isPlausibleUri(uri);
  }

  function uriImpliesDryRun(uri) {
    const normalized = String(uri || "").replace(/^`|`$/g, "").trim();
    return /\/dry-run\/?$/i.test(normalized);
  }

  function buildNlUri(text, app = "ask") {
    const params = new URLSearchParams();
    params.set("text", text);
    if (app === "ask") {
      return `nl://ask?${params.toString()}`;
    }
    return `nl://${app}/ask?${params.toString()}`;
  }

  function isNlUri(value) {
    return /^nl:\/\//i.test(String(value || "").trim());
  }

  function routeUserInput(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return null;
    if (looksLikeUri(trimmed) && !isNlUri(trimmed)) {
      return {
        kind: "uri",
        uri: extractUri(trimmed) || trimmed.split("\n")[0].trim(),
        nl: trimmed,
      };
    }
    if (isNlUri(trimmed)) {
      return { kind: "nl", uri: trimmed, nl: trimmed };
    }
    return { kind: "nl", uri: buildNlUri(trimmed), nl: trimmed };
  }

  function agentsForSidebar(agents) {
    const byRef = new Map();
    const rank = (agent) => {
      const id = agent.id || "";
      if (id.endsWith(".local")) return 3;
      if (id.endsWith(".local-dev")) return 2;
      if (id.endsWith(".docker") || id.endsWith(".ssh-dev")) return 0;
      return 1;
    };
    for (const agent of agents) {
      const ref = agent.agent_ref || agent.id;
      const existing = byRef.get(ref);
      if (!existing || rank(agent) > rank(existing)) {
        byRef.set(ref, agent);
      }
    }
    return [...byRef.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  window.TaskinityChatUri = {
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
  };
})();
