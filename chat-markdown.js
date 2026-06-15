/**
 * Markdown rendering helpers for Taskinity Chat.
 */
(function () {
  "use strict";

  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  function renderBasicText(text) {
    return text
      .split(/\n{2,}/)
      .map((paragraph) => {
        const lines = paragraph.trim().split("\n");
        if (!paragraph.trim()) return "";
        if (lines[0].startsWith("## ")) {
          return `<h2>${inlineMarkdown(lines[0].slice(3))}</h2>`;
        }
        if (lines.every((line) => line.startsWith("- "))) {
          return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.slice(2))}</li>`).join("")}</ul>`;
        }
        return `<p>${inlineMarkdown(lines.join("\n")).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  function renderBasicMarkdown(text) {
    const blocks = [];
    const pattern = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        blocks.push(renderBasicText(text.slice(lastIndex, match.index)));
      }
      blocks.push(`<pre><code>${escapeHtml(match[2].trim())}</code></pre>`);
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
      blocks.push(renderBasicText(text.slice(lastIndex)));
    }
    return blocks.join("");
  }

  function renderMarkdown(text) {
    if (window.marked && window.DOMPurify) {
      const raw = marked.parse(text || "");
      return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    }
    return renderBasicMarkdown(text || "");
  }

  function htmlToPlainText(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return (div.innerText || div.textContent || "").trim();
  }

  window.TaskinityChatMarkdown = {
    escapeHtml,
    renderMarkdown,
    htmlToPlainText,
  };
})();
