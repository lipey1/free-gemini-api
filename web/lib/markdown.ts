/**
 * Minimal Markdown → HTML for Gemini replies.
 *
 * Gemini answers with **bold**, *italic*, `code`, fenced blocks, and lists,
 * a handful of constructs, not the whole spec. A ~90-line renderer beats
 * pulling in a parser plus a sanitiser for that.
 *
 * Safety: every input is HTML-escaped BEFORE any tag is produced, so the model
 * cannot emit markup that survives into the DOM. The only tags in the output
 * are the ones this file writes.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline spans. Input must already be escaped. */
function inline(s: string): string {
  return (
    s
      // `code` first so its contents are not re-processed for emphasis
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>")
      // [label](https://…) for http(s) only. Everything else stays literal text.
      .replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      )
  );
}

export function renderMarkdown(src: string): string {
  const lines = escapeHtml(src.replace(/\r\n/g, "\n")).split("\n");
  const out: string[] = [];

  let inFence = false;
  let fenceBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let paraBuf: string[] = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  const closePara = () => {
    if (paraBuf.length) {
      out.push(`<p>${inline(paraBuf.join(" "))}</p>`);
      paraBuf = [];
    }
  };

  const flush = () => {
    closePara();
    closeList();
  };

  for (const line of lines) {
    // ── fenced code ──────────────────────────────────────
    if (/^\s*```/.test(line)) {
      if (inFence) {
        out.push(`<pre><code>${fenceBuf.join("\n")}</code></pre>`);
        fenceBuf = [];
        inFence = false;
      } else {
        flush();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(line);
      continue;
    }

    // ── blank line ───────────────────────────────────────
    if (!line.trim()) {
      flush();
      continue;
    }

    // ── heading ──────────────────────────────────────────
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length + 2, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    // ── list items ───────────────────────────────────────
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      closePara();
      const want: "ul" | "ol" = bullet ? "ul" : "ol";
      if (listType !== want) {
        closeList();
        out.push(`<${want}>`);
        listType = want;
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
      continue;
    }

    // ── horizontal rule ──────────────────────────────────
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      out.push("<hr />");
      continue;
    }

    // ── paragraph text ───────────────────────────────────
    closeList();
    paraBuf.push(line.trim());
  }

  if (inFence && fenceBuf.length) {
    out.push(`<pre><code>${fenceBuf.join("\n")}</code></pre>`);
  }
  flush();

  return out.join("");
}
