(function () {
  "use strict";

  const sidebar = document.getElementById("docs-sidebar");
  const toggle = document.getElementById("docs-sidebar-toggle");
  const search = document.getElementById("docs-search");
  const toc = document.getElementById("docs-toc");
  const sections = Array.from(document.querySelectorAll(".docs-section"));

  function closeSidebar() {
    sidebar?.classList.remove("is-open");
  }

  toggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-open");
  });

  document.addEventListener("click", (ev) => {
    if (!sidebar?.classList.contains("is-open")) return;
    if (ev.target.closest(".docs-sidebar") || ev.target.closest(".docs-sidebar-toggle")) return;
    closeSidebar();
  });

  toc?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeSidebar());
  });

  function filterSections(query) {
    const q = query.trim().toLowerCase();
    sections.forEach((section) => {
      const hay = `${section.dataset.title || ""} ${section.textContent}`.toLowerCase();
      section.style.display = !q || hay.includes(q) ? "" : "none";
    });
    toc?.querySelectorAll("li").forEach((item) => {
      const href = item.querySelector("a")?.getAttribute("href") || "";
      const id = href.replace("#", "");
      const section = document.getElementById(id);
      item.style.display = section && section.style.display !== "none" ? "" : "none";
    });
  }

  search?.addEventListener("input", () => filterSections(search.value));

  if ("IntersectionObserver" in window && sections.length) {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          toc?.querySelectorAll("a").forEach((a) => {
            a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`);
          });
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s));
  }
})();
