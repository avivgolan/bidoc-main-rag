import { resolveToolUrl, TOOL_NAMES } from "./config.js";

export const INTERNAL_PROJECT_TOOLS = ["data_query", "meeting_evidence_search"];
const ALL_PROJECT_TOOLS = [...TOOL_NAMES, ...INTERNAL_PROJECT_TOOLS];

export function isInternalProjectTool(toolName) {
  return INTERNAL_PROJECT_TOOLS.includes(String(toolName || ""));
}

const URL_PATTERN = /https?:\/\/[^\s)"'<>\]]+/g;

// Many indexed source tables (safety_reports, meetings, consultants_reports,
// other_documents, ...) never had an external URL to begin with — only
// emails and financial_transactions do (see indexSourceUrl() in indexing.js).
// Rather than citing those records with no link at all, point at the bidoc
// web app's unified search page pre-filled with the record's title, which
// reliably surfaces the same record without requiring any DB migration or
// backfill (it works retroactively on already-indexed rows).
export function buildInternalSourceUrl(config, row) {
  const base = String(config?.bidocWebAppUrl || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  const query = String(row?.title || row?.summary || "").trim();
  if (!query) return "";
  return `${base}/search?q=${encodeURIComponent(query)}`;
}

function isRowLike(value) {
  return Boolean(value) && typeof value === "object" && ("source_table" in value || "source_id" in value || "title" in value);
}

// Extracts a clickable source per retrieved record. When `value` is an array
// of data_index rows (the shape hybrid_search/reranker return), each row is
// resolved to its own {url, title, date} instead of scanning the whole blob
// for any URL — that used to silently attribute one email's link to an
// unrelated safety report just because it happened to be JSON.stringify'd
// next to it. Falls back to the old blob-wide scan for any other shape.
export function extractLinks(value, config = null) {
  const rows = Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : null;
  if (rows && rows.length && rows.some(isRowLike)) {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      const rowUrls = JSON.stringify(row).match(URL_PATTERN) || [];
      const url = row.source_url || row.url || row.metadata?.source_url || row.metadata?.url || row.metadata?.data_link || rowUrls[0] || buildInternalSourceUrl(config, row);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({
        url,
        label: row.title || "צפייה במקור",
        title: row.title || null,
        date: extractPrimaryDate(row)
      });
    }
    return out;
  }
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  const urls = text.match(URL_PATTERN) || [];
  return [...new Set(urls)].map((url) => ({ url, label: "צפייה במקור" }));
}

// data_index rows don't return primary_date as its own column (see the RPC
// signature in migration 027) — the date lives inline inside the formatted
// index_text/content block (buildIndexText in indexing.js writes "תאריך: ...").
function extractPrimaryDate(row) {
  const text = String(row?.content || row?.index_text || "");
  const match = text.match(/תאריך[^:]*:\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
  return match ? match[1] : null;
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
    const configuredTimeout = Number(config?.n8n?.runtime?.timeoutMs);
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? Math.max(100, Math.min(configuredTimeout, 120_000))
      : 30_000;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, date_filter: dateFilter, date_from: dateFrom, date_to: dateTo, session_id: sessionId }),
      signal: AbortSignal.timeout(timeoutMs)
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
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return {
      toolName,
      ok: false,
      error: timedOut ? "Tool request timed out" : error.message,
      data: null,
      sources: []
    };
  }
}

export function buildToolOrder(classification, hintedTools) {
  const ordered = [];
  const add = (tool) => {
    if (ALL_PROJECT_TOOLS.includes(tool) && !ordered.includes(tool)) ordered.push(tool);
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
