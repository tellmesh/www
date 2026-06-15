window.TASKINITY_CONFIG = {
  // Leave empty to use browser mock runtime.
  // Set to "http://localhost:8788" or another backend that exposes /api/uri/call.
  apiBaseUrl: "",
  endpoints: {
    health: "/health",
    call: "/api/uri/call",
    explain: "/api/uri/explain",
    ask: "/api/ask",
    events: "/api/events"
  },
  defaultAgent: "weather-map-agent.local"
};
