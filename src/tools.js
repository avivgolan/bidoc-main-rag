import { resolveToolUrl, TOOL_NAMES } from "./config.js";

export function extractLinks(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  const urls = text.match(/https?:\/\/[^\s)"'<>\]]+/g) || [];
  return [...new Set(urls)].map((url) => ({ url, label: "צפייה במקור" }));
}

export async function callN8nTool({ toolName, query, dateFilter = "", dateFrom = null, dateTo = null, sessionId, config }) {
  if (!TOOL_NAMES.includes(toolName)) throw new Error(`Unknown tool: ${toolName}`);
  const url = resolveToolUrl(toolName, config);
  if (!url) {
    return {
      toolName,
      ok: false,
      skipped: true,
      error: "Tool webhook is not configured",
      data: null,
      sources: []
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, date_filter: dateFilter, date_from: dateFrom, date_to: dateTo, session_id: sessionId })
    });
    const text = await response.text();
    const data = tryJson(text);
    if (!response.ok) throw new Error(typeof data === "object" ? data.message || text : text);
    return {
      toolName,
      ok: true,
      data,
      sources: extractLinks(data)
    };
  } catch (error) {
    return {
      toolName,
      ok: false,
      error: error.message,
      data: null,
      sources: []
    };
  }
}

export function buildToolOrder(classification, hintedTools) {
  const ordered = [];
  const add = (tool) => {
    if (TOOL_NAMES.includes(tool) && !ordered.includes(tool)) ordered.push(tool);
  };

  if (classification.urgency === "HIGH") {
    add("safety_report");
    add("alert");
  }
  for (const tool of hintedTools) add(tool);
  if (!ordered.length) {
    if (classification.complexity === "GENERAL") {
      add("alert");
      add("whatsapp_messages");
    } else {
      add("alert");
    }
  }
  return ordered;
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
