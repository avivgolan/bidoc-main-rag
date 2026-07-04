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

import { chatCompletion, createEmbedding } from "../openrouter.js";
import { DEFAULT_CONTENT_TOOL_SETTINGS } from "../config.js";
import { contentSupabaseConfig, contentSupabaseRequest } from "../supabase.js";

const MATCH_RPC = "match_data_index";
const DEFAULT_TOP_K = 12;

// Default answer-synthesis prompts (Task M2). Editable per tool from the
// Subagents settings card (settings.subagents.contentTools.perTool.<tool>.prompt);
// synthesis itself is OFF by default — the tools stay retrieval-only until the
// user enables it per tool.
const SYNTHESIS_BASE = [
  "אתה סוכן משנה שמנסח תשובה תמציתית מתוצאות אחזור אמיתיות של פרויקט בנייה.",
  "הסתמך אך ורק על התוצאות שסופקו. אל תמציא עובדות, תאריכים, אנשים או סכומים.",
  "פלט רשימה קצרה בעברית, מהחדש לישן, עם תאריך בכל שורה כשקיים.",
  "אם אין תוצאות רלוונטיות: כתוב \"לא נמצאו תוצאות רלוונטיות.\""
].join("\n");
export const DEFAULT_TOOL_PROMPTS = {
  meetings: `${SYNTHESIS_BASE}\nלכל פגישה: תאריך, נושא, החלטות (אם יש), סטטוס ומשתתפים.`,
  emails: `${SYNTHESIS_BASE}\nלכל מייל: תאריך קבלה, שולח, נושא ותמצית. ציין קטגוריה כשקיימת.`,
  whatsapp_messages: `${SYNTHESIS_BASE}\nלכל שיחה: תאריך, משתתפים, תמצית, ומשימות/החלטות פתוחות אם יש.`,
  financial_transactions: `${SYNTHESIS_BASE}\nלכל עסקה: תאריך, ספק, סוג עסקה, סכום וסטטוס.`,
  safety_report: `${SYNTHESIS_BASE}\nלכל דוח: תאריך, אתר, רמת סיכון, וליקויים לפי חומרה. הדגש ליקויים חמורים/מסכני חיים.`
};

// Effective settings for one tool: saved settings (config.contentTools) merged
// with per-call overrides (draft testing from the settings card).
export function contentToolSettings(config, toolName, overrides = null) {
  const saved = config?.contentTools?.perTool?.[toolName] || DEFAULT_CONTENT_TOOL_SETTINGS;
  const draft = overrides && typeof overrides === "object" ? overrides : {};
  return {
    enabled: draft.enabled ?? saved.enabled !== false,
    topK: Number(draft.topK) > 0 ? Math.min(Number(draft.topK), 50) : saved.topK || DEFAULT_TOP_K,
    answerSynthesis: draft.answerSynthesis ?? saved.answerSynthesis === true,
    model: (typeof draft.model === "string" && draft.model) || saved.model || "",
    prompt: (typeof draft.prompt === "string" && draft.prompt.trim()) || saved.prompt || ""
  };
}

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
  },
  emails: {
    sourceTable: "emails",
    label: "סוכן מיילים פנימי",
    sourceSelect: "id,received_date,subject,sender_name,sender_mail,other_recipients,mail_category,direction,has_attachments",
    enrichRow(row, sourceRow) {
      if (!sourceRow) return row;
      return {
        ...row,
        received_date: sourceRow.received_date || null,
        sender: [sourceRow.sender_name, sourceRow.sender_mail].filter(Boolean).join(" / ") || null,
        recipients: Array.isArray(sourceRow.other_recipients) ? sourceRow.other_recipients : null,
        mail_category: sourceRow.mail_category || null,
        direction: sourceRow.direction || null,
        has_attachments: sourceRow.has_attachments ?? null
      };
    }
  },
  financial_transactions: {
    sourceTable: "financial_transactions",
    label: "סוכן פיננסי פנימי",
    sourceSelect: "id,transaction_date,topic,vendor_name,transaction_type,category,status,amount_numeric,currency,total,transaction_submitter,data_link",
    enrichRow(row, sourceRow) {
      if (!sourceRow) return row;
      return {
        ...row,
        transaction_date: sourceRow.transaction_date || null,
        vendor_name: sourceRow.vendor_name || null,
        transaction_type: sourceRow.transaction_type || null,
        category: sourceRow.category || null,
        status: sourceRow.status || null,
        amount: sourceRow.amount_numeric ?? sourceRow.total ?? null,
        currency: sourceRow.currency || null,
        transaction_submitter: sourceRow.transaction_submitter || null,
        source_url: row.source_url || sourceRow.data_link || null
      };
    }
  },
  // Tool name is the historical n8n singular; the table is safety_reports.
  safety_report: {
    sourceTable: "safety_reports",
    label: "סוכן בטיחות פנימי",
    sourceSelect: "id,report_date,site_location,risk_level,site_grade,total_workers,life_threatening_defects,severe_defects,medium_defects,minor_defects,resolved,project_manager,site_manager,document_filename",
    enrichRow(row, sourceRow) {
      if (!sourceRow) return row;
      return {
        ...row,
        report_date: sourceRow.report_date || null,
        site_location: sourceRow.site_location || null,
        risk_level: sourceRow.risk_level || null,
        site_grade: sourceRow.site_grade || null,
        total_workers: sourceRow.total_workers ?? null,
        defects: {
          life_threatening: sourceRow.life_threatening_defects ?? null,
          severe: sourceRow.severe_defects ?? null,
          medium: sourceRow.medium_defects ?? null,
          minor: sourceRow.minor_defects ?? null,
          resolved: sourceRow.resolved ?? null
        },
        project_manager: sourceRow.project_manager || null,
        site_manager: sourceRow.site_manager || null,
        document_filename: sourceRow.document_filename || null
      };
    }
  },
  // The tool keeps its historical n8n name; the indexed source rows are the
  // per-conversation analyses, not raw messages.
  whatsapp_messages: {
    sourceTable: "whatsapp_analysis",
    label: "סוכן וואטסאפ פנימי",
    sourceSelect: "id,conversation_id,people_involved_json,tasks_json,decisions_json,deadlines_json",
    enrichRow(row, sourceRow) {
      if (!sourceRow) return row;
      return {
        ...row,
        conversation_id: sourceRow.conversation_id ?? null,
        participants: Array.isArray(sourceRow.people_involved_json) ? sourceRow.people_involved_json : null,
        tasks: compactJsonList(sourceRow.tasks_json),
        decisions: compactJsonList(sourceRow.decisions_json),
        deadlines: compactJsonList(sourceRow.deadlines_json)
      };
    }
  }
};

// Task/decision/deadline lists in whatsapp_analysis are jsonb arrays of small
// objects — keep the first few, bound the size, and count the rest.
export function compactJsonList(value, limit = 5) {
  if (!Array.isArray(value) || !value.length) return null;
  return {
    total: value.length,
    items: value.slice(0, limit).map((item) =>
      typeof item === "object" && item !== null
        ? Object.fromEntries(Object.entries(item).slice(0, 6).map(([key, entry]) => [key, String(entry ?? "").slice(0, 200)]))
        : String(item).slice(0, 200)
    )
  };
}

export function isInternalContentTool(toolName, config) {
  return Boolean(CONTENT_TOOL_SPECS[toolName])
    && config?.n8n?.runtime?.internalTools === true
    && config?.contentTools?.perTool?.[toolName]?.enabled !== false;
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
  overrides = null,
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
  const settings = contentToolSettings(config, toolName, overrides);

  const searchQuery = String(query || "").trim() || spec.label;
  const embedding = await createEmbedding({
    apiKey: config.openRouterApiKey,
    model: config.models.embedding,
    input: searchQuery,
    cacheContext,
    telemetry
  });
  const matchCount = Math.max(1, Math.min(Number(topK) || settings.topK || DEFAULT_TOP_K, 50));
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

  const output = {
    tool: toolName,
    mode: "internal",
    query: searchQuery,
    dateFrom,
    dateTo,
    resultsCount: filtered.length,
    results: filtered
  };

  // Optional answer synthesis (Task M2): one lite-LLM call phrasing the raw
  // results with the per-tool editable prompt. Raw results are always kept.
  if (settings.answerSynthesis) {
    try {
      output.answer = await chatCompletion({
        apiKey: config.openRouterApiKey,
        model: settings.model || config.models?.lite || config.models?.main,
        temperature: 0.1,
        maxTokens: 1600,
        timeoutMs: 60_000,
        telemetry,
        messages: [
          { role: "system", content: settings.prompt || DEFAULT_TOOL_PROMPTS[toolName] || SYNTHESIS_BASE },
          {
            role: "user",
            content: JSON.stringify({
              query: searchQuery,
              date_from: dateFrom,
              date_to: dateTo,
              results: filtered
            })
          }
        ]
      });
      output.synthesis = { model: settings.model || config.models?.lite || null, prompt_overridden: Boolean(settings.prompt) };
    } catch (error) {
      output.synthesisError = error.message;
    }
  }
  return output;
}

// Adapts the internal result to the callN8nTool response contract so chat,
// insights, workflow logs, and QA see the same shape they always did.
export async function callInternalContentTool({ config, toolName, query, dateFrom = null, dateTo = null, overrides = null, cacheContext = null, telemetry = null }) {
  try {
    const data = await runContentToolAgent({ config, toolName, query, dateFrom, dateTo, overrides, cacheContext, telemetry });
    return {
      toolName,
      ok: true,
      internal: true,
      data,
      ...(data.answer ? { answer: data.answer } : {}),
      sources: data.results
        .filter((row) => row.source_url)
        .slice(0, 8)
        .map((row) => ({ url: row.source_url, label: row.title || "צפייה במקור" }))
    };
  } catch (error) {
    return { toolName, ok: false, internal: true, error: error.message, data: null, sources: [] };
  }
}
