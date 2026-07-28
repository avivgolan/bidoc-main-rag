function escapeChatHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function markdownTableCells(line) {
  return String(line).trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function countCharacters(value, character) {
  return [...String(value || "")].filter((item) => item === character).length;
}

function renderEscapedInlineLabel(value) {
  return escapeChatHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

export function cleanChatUrl(rawUrl) {
  let url = String(rawUrl || "").trim();
  let suffix = "";
  if (/[\u0000-\u001f\u007f]/.test(url)) return { url: "", suffix: "" };
  while (/[.,;:!?]$/.test(url)) {
    suffix = url.slice(-1) + suffix;
    url = url.slice(0, -1);
  }
  if (url.endsWith(")") && countCharacters(url, "(") < countCharacters(url, ")")) {
    suffix = ")" + suffix;
    url = url.slice(0, -1);
  }
  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      return { url: "", suffix: "" };
    }
    return { url: parsed.href, suffix };
  } catch {
    return { url: "", suffix: "" };
  }
}

export function renderChatMarkdown(value) {
  const codeBlocks = [];
  let text = String(value || "").replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, language, code) => {
    const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre><code data-language="${escapeChatHtml(language || "text")}">${escapeChatHtml(code.trim())}</code></pre>`);
    return token;
  });

  const markdownLinks = [];
  text = text.replace(
    /\[([^\]\n]+)\]\(<(https?:\/\/[^\s<>]+)>\)|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (match, angleLabel, angleUrl, plainLabel, plainUrl) => {
      const label = angleLabel || plainLabel;
      const cleaned = cleanChatUrl(angleUrl || plainUrl).url;
      if (!cleaned) return label;
      const token = `@@CHAT_MARKDOWN_LINK_${markdownLinks.length}@@`;
      markdownLinks.push(
        `<a href="${escapeChatHtml(cleaned)}" target="_blank" rel="noopener noreferrer">${renderEscapedInlineLabel(label)}</a>`
      );
      return token;
    }
  );

  text = escapeChatHtml(text);
  text = text.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, prefix, rawUrl) => {
    const { url, suffix } = cleanChatUrl(rawUrl);
    return url ? `${prefix}<a href="${escapeChatHtml(url)}" target="_blank" rel="noopener noreferrer">פתיחת מקור</a>${escapeChatHtml(suffix)}` : `${prefix}${rawUrl}`;
  });
  text = text
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
  const lines = text.split("\n");
  const output = [];
  let listType = "";
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const tableSeparator = lines[lineIndex + 1];
    if (line.includes("|") && /^\s*\|?[\s:-]+(?:\|[\s:-]+)+\|?\s*$/.test(tableSeparator || "")) {
      if (listType) {
        output.push(`</${listType}>`);
        listType = "";
      }
      const headers = markdownTableCells(line);
      const rows = [];
      lineIndex += 2;
      while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
        rows.push(markdownTableCells(lines[lineIndex]));
        lineIndex += 1;
      }
      lineIndex -= 1;
      output.push(`<div class="messageTableWrap"><table><thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)/);
    const nextType = bullet ? "ul" : numbered ? "ol" : "";
    if (nextType) {
      if (listType !== nextType) {
        if (listType) output.push(`</${listType}>`);
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${bullet?.[1] || numbered?.[1]}</li>`);
      continue;
    }
    if (listType) {
      output.push(`</${listType}>`);
      listType = "";
    }
    if (!line.trim()) continue;
    if (/^@@CODE_BLOCK_\d+@@$/.test(line) || /^<(h[2-4]|blockquote|pre)/.test(line)) output.push(line);
    else output.push(`<p>${line}</p>`);
  }
  if (listType) output.push(`</${listType}>`);
  return output.join("")
    .replace(/@@CODE_BLOCK_(\d+)@@/g, (_, index) => codeBlocks[Number(index)] || "")
    .replace(/@@CHAT_MARKDOWN_LINK_(\d+)@@/g, (_, index) => markdownLinks[Number(index)] || "");
}
