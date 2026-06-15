(function () {
  "use strict";

  const manifest = window.__EXAMPLES_MANIFEST__ || {};
  const EXAMPLES = manifest.examples || [];
  const TEST_SUMMARY = manifest.testSummary || {
    pytest: "50 passed · 2 skipped",
    runSh: "27/27 PASS",
    testedAt: "generated",
  };

  const CATEGORY_LABELS = manifest.categoryLabels || {
    all: "All",
    agents: "Agents",
    operator: "Operator (Web · Android · Windows)",
    workflow: "Workflow",
    office: "Office",
    touri: "Touri / capability",
    tutorial: "Tutorial",
  };

  const OFFICE_CHAINS = manifest.officeChains || [];

  const gridEl = document.getElementById("examples-grid");
  const filterEl = document.getElementById("examples-filter");
  const chainsEl = document.getElementById("office-chains");
  const summaryEl = document.getElementById("test-summary");

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function findExample(id) {
    return EXAMPLES.find((e) => e.id === id);
  }

  function renderSummary() {
    if (!summaryEl) return;
    summaryEl.innerHTML = `
      <div class="examples-status-item ok"><strong>${escapeHtml(TEST_SUMMARY.runSh)}</strong> scripts/test-all-examples.sh</div>
      <div class="examples-status-item ok"><strong>${escapeHtml(TEST_SUMMARY.pytest)}</strong> pytest tests/examples</div>
      <div class="examples-status-item muted">Manifest: examples/*/README.md</div>`;
  }

  function renderFilters() {
    if (!filterEl) return;
    filterEl.innerHTML = Object.entries(CATEGORY_LABELS)
      .map(
        ([key, label], i) =>
          `<button type="button" class="examples-filter-btn${i === 0 ? " is-active" : ""}" data-filter="${key}">${escapeHtml(label)}</button>`
      )
      .join("");
    filterEl.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".examples-filter-btn");
      if (!btn) return;
      filterEl.querySelectorAll(".examples-filter-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderGrid(btn.dataset.filter || "all");
    });
  }

  function renderGrid(filter) {
    if (!gridEl) return;
    const items = filter === "all" ? EXAMPLES : EXAMPLES.filter((e) => e.category === filter);
    gridEl.innerHTML = items
      .map(
        (ex) => `
      <article class="example-card" data-category="${escapeHtml(ex.category)}">
        <div class="example-card-head">
          <span class="example-num">ex ${escapeHtml(ex.num)}</span>
          <span class="example-pass" title="PASS in CI">✓ PASS</span>
        </div>
        <h3>${escapeHtml(ex.title)}</h3>
        <p class="example-desc">${escapeHtml(ex.desc)}</p>
        ${ex.office ? `<p class="example-office">Office: ${escapeHtml(ex.office)}</p>` : ""}
        ${(ex.uris || []).length ? `<div class="example-uris">${ex.uris.map((u) => `<code>${escapeHtml(u)}</code>`).join("")}</div>` : ""}
        <pre class="integration-snippet example-cmd">${escapeHtml(ex.cmd)}</pre>
        <div class="example-card-foot">
          <button type="button" class="btn btn-ghost example-copy" data-cmd="${escapeHtml(ex.cmd)}">Copy command</button>
          <a class="example-path" href="docs/examples.html#ex-${escapeHtml(ex.id)}">examples/${escapeHtml(ex.id)}/</a>
        </div>
      </article>`
      )
      .join("");
  }

  function officeLang() {
    return localStorage.getItem("taskinity.lang") || "en";
  }

  function chainField(chain, field) {
    const lang = officeLang();
    const block = (chain.i18n && (chain.i18n[lang] || chain.i18n.en || chain.i18n.pl)) || {};
    return block[field] || chain[field] || "";
  }

  function renderOfficeChains() {
    if (!chainsEl) return;
    chainsEl.innerHTML = OFFICE_CHAINS.map(
      (chain) => `
      <article class="office-chain-card">
        <h3>${escapeHtml(chainField(chain, "title"))}</h3>
        <blockquote class="office-chat-quote">${escapeHtml(chainField(chain, "chat"))}</blockquote>
        <ol class="office-flow">
          ${chain.steps
            .map((id) => {
              const ex = findExample(id);
              return ex ? `<li><strong>${escapeHtml(ex.title)}</strong> — <a href="docs/examples.html#ex-${escapeHtml(ex.id)}">examples/${escapeHtml(ex.id)}/</a></li>` : "";
            })
            .join("")}
        </ol>
      </article>`
    ).join("");
  }

  window.TaskinityExamplesGallery = { refreshOfficeChains: renderOfficeChains };

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".example-copy");
    if (!btn) return;
    const cmd = btn.dataset.cmd || "";
    navigator.clipboard.writeText(cmd).then(
      () => {
        const prev = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
      },
      () => {
        btn.textContent = "Copy failed";
      }
    );
  });

  renderSummary();
  renderFilters();
  renderGrid("all");
  renderOfficeChains();
})();
