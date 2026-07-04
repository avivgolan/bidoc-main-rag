// Internal Content Tool Agent (docs/n8n-agents-migration-spec.md, Task B1).
// Replaces the dead n8n query webhooks with direct retrieval from the Kapaim
// content data: embed the query -> `match_data_index` RPC filtered by
// p_source_table -> date filter -> enrich hits with fields from the source row.
// match_data_index is the backbone (not the per-table match_* functions): the
// match_* family filters `metadata @> filter`, and the content tables store
// metadata as a jsonb STRING, so even an empty filter matches nothing.
//
// First registered source: meetings — the only query-tool table that is both
// content-rich and fully embedded (508/508). Other sources join as their data
// fills in (see the spec's B1 priority order).

import { createEmbedding } from "../openrouter.js";
import { contentSupabaseConfig, contentSupabaseRequest } from "../supabase.js";

const MATCH_RPC = "match_data_index";
const DEFAULT_TOP_K = 12;

export const CONTENT_TOOL_SPECS = {
  meetings: {
    sourceTable: "meetings",
    label: "סוכן פגישות פנימי",
    sourceSelect: "id,meeting_date,meeting_hour,subject,decisions_made,attendances,status,document_filename",
    enrichRow(row, sourceRow) {
      if (!sourceRow) return row;
      return {
        ...row,
        meeting_date: sourceRow.meeting_date || null,
        meeting_hour: sourceRow.meeting_hour || null,
        decisions_made: sourceRow.decisions_made || null,
        attendances: sourceRow.attendances || null,
        status: sourceRow.status || null,
        document_filename: sourceRow.document_filename || null
      };
    }
  }
};

export function isInternalContentTool(toolName, config) {
  return Boolean(CONTENT_TOOL_SPECS[toolName]) && config?.n8n?.runtime?.internalTools === true;
}

// Local date filter over the index dates the indexing agent maintains:
// event_date wins, then document_date, then primary_date.
export function contentToolRowDate(row) {
  return row?.event_date || row?.document_date || (row?.primary_date ? String(row.primary_date).slice(0, 10) : null);
}

export function filterContentRowsByDate(rows = [], dateFrom = null, dateTo = null) {
  if (!dateFrom && !dateTo) return rows;
  return rows.filter((row) => {
    const date = contentToolRowDate(row);
    if (!date) return false;
    if (dateFrom && date < String(dateFrom).slice(0, 10)) return false;
    if (dateTo && date > String(dateTo).slice(0, 10)) return false;
    return true;
  });
}

export async function runContentToolAgent({
  config,
  toolName,
  query,
  dateFrom = null,
  dateTo = null,
  topK = null,
  cacheContext = null,
  telemetry = null
}) {
  const spec = CONTENT_TOOL_SPECS[toolName];
  if (!spec) throw new Error(`No internal content tool is registered for: ${toolName}`);
  const contentConfig = contentSupabaseConfig(config);
  if (!contentConfig.supabaseUrl || !contentConfig.supabaseServiceRoleKey) {
    throw new Error("Content Supabase is not configured");
  }
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");

  const searchQuery = String(query || "").trim() || spec.label;
  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: searchQuery,
    cacheContext,
    telemetry
  });
  const matchCount = Math.max(1, Math.min(Number(topK) || DEFAULT_TOP_K, 50));
  const matches = await contentSupabaseRequest({
    config,
    path: `/rest/v1/rpc/${MATCH_RPC}`,
    options: {
      method: "POST",
      body: JSON.stringify({
        query_embedding: embedding,
        // Over-fetch so the local date filter still leaves matchCount rows.
        match_count: dateFrom || dateTo ? matchCount * 4 : matchCount,
        filter: {},
        p_source_table: spec.sourceTable
      })
    }
  });

  const rows = (Array.isArray(matches) ? matches : []).map((match) => ({
    index_id: match.id,
    source_table: match.source_table,
    source_id: match.source_id,
    title: match.title || null,
    summary: match.summary || null,
    similarity: match.similarity ?? null
  }));

  // One extra fetch brings the index dates + link, so date filtering uses the
  // event_date/document_date columns the internal indexing agent fills.
  if (rows.length) {
    const indexRows = await contentSupabaseRequest({
      config,
      path: `/rest/v1/${contentConfig.indexTable}?select=id,primary_date,event_date,document_date,source_url,hashtags,item_status&id=in.(${rows.map((row) => row.index_id).join(",")})`
    });
    const byId = new Map((Array.isArray(indexRows) ? indexRows : []).map((row) => [row.id, row]));
    for (const row of rows) {
      const indexRow = byId.get(row.index_id) || {};
      row.event_date = indexRow.event_date || null;
      row.document_date = indexRow.document_date || null;
      row.primary_date = indexRow.primary_date || null;
      row.date = contentToolRowDate(row);
      row.source_url = indexRow.source_url || null;
      row.hashtags = indexRow.hashtags || [];
      row.item_status = indexRow.item_status || null;
    }
  }

  let filtered = filterContentRowsByDate(rows, dateFrom, dateTo).slice(0, matchCount);

  // Source-row enrichment: structured fields the index summary does not carry.
  if (filtered.length && spec.sourceSelect) {
    const ids = [...new Set(filtered.map((row) => row.source_id).filter((id) => /^\d+$/.test(String(id))))];
    if (ids.length) {
      const sourceRows = await contentSupabaseRequest({
        config,
        path: `/rest/v1/${spec.sourceTable}?select=${encodeURIComponent(spec.sourceSelect)}&id=in.(${ids.join(",")})`
      });
      const bySourceId = new Map((Array.isArray(sourceRows) ? sourceRows : []).map((row) => [String(row.id), row]));
      filtered = filtered.map((row) => spec.enrichRow(row, bySourceId.get(String(row.source_id)) || null));
    }
  }

  return {
    tool: toolName,
    mode: "internal",
    query: searchQuery,
    dateFrom,
    dateTo,
    resultsCount: filtered.length,
    results: filtered
  };
}

// Adapts the internal result to the callN8nTool response contract so chat,
// insights, workflow logs, and QA see the same shape they always did.
export async function callInternalContentTool({ config, toolName, query, dateFrom = null, dateTo = null, cacheContext = null, telemetry = null }) {
  try {
    const data = await runContentToolAgent({ config, toolName, query, dateFrom, dateTo, cacheContext, telemetry });
    return {
      toolName,
      ok: true,
      internal: true,
      data,
      sources: data.results
        .filter((row) => row.source_url)
        .slice(0, 8)
        .map((row) => ({ url: row.source_url, label: row.title || "צפייה במקור" }))
    };
  } catch (error) {
    return { toolName, ok: false, internal: true, error: error.message, data: null, sources: [] };
  }
}
