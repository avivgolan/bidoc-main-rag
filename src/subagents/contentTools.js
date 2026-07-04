// Specialist Content Agents (spec B2, docs/n8n-agents-migration-spec.md).
// Each agent runs on ITS OWN Content-DB table (user-editable in the Subagents
// card): vector search via the table's match_<table> RPC UNIONed with an ilike
// text leg (covers unembedded rows), date filtering on the table's own date
// column, deterministic domain analysis (contentAnalysis.js), and an
// LLM-phrased answer (default ON). The main agent cross-references the
// per-agent answers. data_index is NOT used here — it serves the main RAG.

import { chatCompletion, createEmbedding } from "../openrouter.js";
import { DEFAULT_CONTENT_TOOL_SETTINGS } from "../config.js";
import { contentSupabaseConfig, contentSupabaseRequest } from "../supabase.js";
import { analyzeEmails, analyzeFinancial, analyzeGeneric, analyzeMeetings, analyzeSafety, analyzeWhatsapp } from "./contentAnalysis.js";
import { extractSearchTerms, mergeRetrievalRows, resolveTableRoles } from "./contentRetrieval.js";
import { toDateOnly } from "./indexing.js";

const DEFAULT_TOP_K = 12;
const SAFE_TABLE_NAME = /^[A-Za-z0-9_]+$/;
const ROW_TEXT_LIMIT = 500;

export const CONTENT_TOOL_SPECS = {
  meetings: {
    defaultTable: "meetings",
    label: "סוכן פגישות פנימי",
    roles: {
      idColumn: "id",
      dateColumn: "meeting_date",
      textColumns: ["subject", "summary", "decisions_made", "content"],
      embeddingColumn: "embedding",
      selectColumns: ["id", "meeting_date", "meeting_hour", "subject", "summary", "decisions_made", "attendances", "status", "item_status", "hashtags", "document_filename"]
    },
    titleField: "subject",
    analyze: analyzeMeetings
  },
  emails: {
    defaultTable: "emails",
    label: "סוכן מיילים פנימי",
    roles: {
      idColumn: "id",
      dateColumn: "received_date",
      textColumns: ["subject", "summary", "mail_summarize", "mail_body"],
      embeddingColumn: "embedding",
      selectColumns: ["id", "received_date", "subject", "summary", "mail_summarize", "sender_name", "sender_mail", "other_recipients", "mail_category", "direction", "has_attachments", "item_status", "hashtags", "mail_id"]
    },
    // The n8n indexing rule, preserved: only project-classified mails count.
    // Applied ONLY when the agent runs on its default table.
    extraFilter: "relevance_status=in.(project_related,multi_project)",
    titleField: "subject",
    analyze: analyzeEmails
  },
  // Historical n8n tool name; the default store is the per-conversation
  // analyses table. The date lives on the joined conversation row.
  whatsapp_messages: {
    defaultTable: "whatsapp_analysis",
    label: "סוכן וואטסאפ פנימי",
    roles: {
      idColumn: "id",
      dateColumn: null,
      textColumns: ["summary", "content"],
      embeddingColumn: "embedding",
      selectColumns: ["id", "conversation_id", "summary", "item_status", "hashtags", "tasks_json", "decisions_json", "deadlines_json", "people_involved_json"]
    },
    dateJoin: { table: "whatsapp_conversations", sourceKey: "conversation_id", dateColumn: "conversation_start" },
    titleField: "summary",
    analyze: analyzeWhatsapp
  },
  financial_transactions: {
    defaultTable: "financial_transactions",
    label: "סוכן פיננסי פנימי",
    roles: {
      idColumn: "id",
      dateColumn: "transaction_date",
      textColumns: ["topic", "summary", "short_description", "content"],
      embeddingColumn: "embedding",
      selectColumns: ["id", "transaction_date", "topic", "summary", "vendor_name", "transaction_type", "category", "status", "item_status", "amount_numeric", "currency", "total", "transaction_submitter", "data_link", "hashtags"]
    },
    titleField: "topic",
    analyze: analyzeFinancial
  },
  // n8n singular tool name over the plural table.
  safety_report: {
    defaultTable: "safety_reports",
    label: "סוכן בטיחות פנימי",
    roles: {
      idColumn: "id",
      dateColumn: "report_date",
      textColumns: ["summary", "defect_details", "content", "site_location"],
      embeddingColumn: "embedding",
      selectColumns: ["id", "report_date", "site_location", "risk_level", "site_grade", "total_workers", "life_threatening_defects", "severe_defects", "medium_defects", "minor_defects", "resolved", "project_manager", "site_manager", "document_filename", "summary", "item_status", "hashtags"]
    },
    titleField: "summary",
    analyze: analyzeSafety
  }
};

// Default synthesis prompts — each agent's phrasing style. Editable per tool
// from the Subagents card; synthesis is ON by default (spec B2).
const SYNTHESIS_BASE = [
  "אתה סוכן משנה מומחה בפרויקט בנייה. קיבלת: query (השאלה), analysis (ניתוח דטרמיניסטי של הממצאים שלך), ו-results (השורות הגולמיות מהמאגר שלך).",
  "בסס את התשובה אך ורק על analysis ו-results. אל תמציא עובדות, תאריכים, אנשים או סכומים.",
  "פתח בשורת שורה תחתונה אחת מתוך ה-analysis, ואז רשימה קצרה מהחדש לישן עם תאריך בכל שורה כשקיים.",
  "אם אין תוצאות רלוונטיות: כתוב \"לא נמצאו תוצאות רלוונטיות.\""
].join("\n");
export const DEFAULT_TOOL_PROMPTS = {
  meetings: `${SYNTHESIS_BASE}\nההתמחות שלך: פגישות והחלטות. לכל פגישה: תאריך, נושא, החלטות, סטטוס ומשתתפים. הדגש החלטות פתוחות (by_status ב-analysis).`,
  emails: `${SYNTHESIS_BASE}\nההתמחות שלך: תכתובת מייל. לכל מייל: תאריך, שולח, נושא ותמצית. השתמש ב-top_senders/by_category מה-analysis לזיהוי דפוסים.`,
  whatsapp_messages: `${SYNTHESIS_BASE}\nההתמחות שלך: שיחות שטח. הדגש משימות פתוחות ודדליינים (open_tasks/upcoming_deadlines ב-analysis), ואז תמציות שיחה עם משתתפים.`,
  financial_transactions: `${SYNTHESIS_BASE}\nההתמחות שלך: כספים. פתח בסכום הכולל ובפילוח לפי סוג (total_amount/sum_by_type ב-analysis). לכל עסקה: תאריך, ספק, סוג, סכום וסטטוס.`,
  safety_report: `${SYNTHESIS_BASE}\nההתמחות שלך: בטיחות. פתח בסיכום הליקויים לפי חומרה וברמת הסיכון הגרועה (defect_totals/worst_risk_level ב-analysis). הדגש ליקויים מסכני חיים/חמורים.`
};

export function isInternalContentTool(toolName, config) {
  return Boolean(CONTENT_TOOL_SPECS[toolName])
    && config?.n8n?.runtime?.internalTools === true
    && config?.contentTools?.perTool?.[toolName]?.enabled !== false;
}

// Effective settings for one tool: saved settings merged with per-call draft
// overrides (the settings card tests drafts before saving).
export function contentToolSettings(config, toolName, overrides = null) {
  const saved = config?.contentTools?.perTool?.[toolName] || DEFAULT_CONTENT_TOOL_SETTINGS;
  const draft = overrides && typeof overrides === "object" ? overrides : {};
  const draftTable = typeof draft.table === "string" ? draft.table.trim() : null;
  const savedTable = typeof saved.table === "string" ? saved.table.trim() : "";
  const table = draftTable !== null && draftTable !== "" ? draftTable : savedTable;
  return {
    enabled: draft.enabled ?? saved.enabled !== false,
    topK: Number(draft.topK) > 0 ? Math.min(Number(draft.topK), 50) : saved.topK || DEFAULT_TOP_K,
    answerSynthesis: draft.answerSynthesis ?? saved.answerSynthesis !== false,
    model: (typeof draft.model === "string" && draft.model) || saved.model || "",
    prompt: (typeof draft.prompt === "string" && draft.prompt.trim()) || saved.prompt || "",
    table: SAFE_TABLE_NAME.test(table) ? table : ""
  };
}

export function contentToolRowDate(row) {
  return row?.date || null;
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
  const table = settings.table || spec.defaultTable;
  const isDefaultTable = table === spec.defaultTable;
  const warnings = [];
  const roles = isDefaultTable ? spec.roles : await resolveTableRoles({ config, table });
  const idColumn = roles.idColumn || "id";
  const effectiveTopK = Math.max(1, Math.min(Number(topK) || settings.topK || DEFAULT_TOP_K, 50));
  const searchQuery = String(query || "").trim() || spec.label;

  if (!roles.embeddingColumn) warnings.push("no_embedding_column");

  const [vectorRows, textRows] = await Promise.all([
    roles.embeddingColumn
      ? vectorLeg({ config, spec, table, roles, isDefaultTable, searchQuery, effectiveTopK, hasDates: Boolean(dateFrom || dateTo), warnings, cacheContext, telemetry })
      : Promise.resolve([]),
    textLeg({ config, spec, table, roles, isDefaultTable, searchQuery, effectiveTopK, dateFrom, dateTo, warnings })
  ]);

  let rows = mergeRetrievalRows({ vectorRows, textRows, topK: effectiveTopK * 2, idColumn });
  await attachRowDates({ config, spec, roles, isDefaultTable, rows });
  rows = filterContentRowsByDate(rows, dateFrom, dateTo).slice(0, effectiveTopK);
  rows = rows.map((row) => truncateRowStrings(row));

  const analysis = isDefaultTable ? spec.analyze(rows) : analyzeGeneric(rows, roles);

  const output = {
    tool: toolName,
    mode: "internal",
    table,
    query: searchQuery,
    dateFrom,
    dateTo,
    retrieval: {
      vectorCount: vectorRows.length,
      textCount: textRows.length,
      mergedCount: rows.length,
      warnings
    },
    resultsCount: rows.length,
    results: rows,
    analysis
  };

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
          { role: "user", content: JSON.stringify({ query: searchQuery, date_from: dateFrom, date_to: dateTo, analysis, results: rows }) }
        ]
      });
      output.synthesis = { model: settings.model || config.models?.lite || null, prompt_overridden: Boolean(settings.prompt) };
    } catch (error) {
      output.synthesisError = error.message;
    }
  }
  return output;
}

// Vector leg: embed the query and call the table's own match_<table> RPC.
// Enriches RPC hits (id/content/metadata/similarity only) with real columns.
async function vectorLeg({ config, spec, table, roles, isDefaultTable, searchQuery, effectiveTopK, hasDates, warnings, cacheContext, telemetry }) {
  try {
    const embedding = await createEmbedding({
      apiKey: config.openRouterApiKey,
      model: config.models.embedding,
      input: searchQuery,
      cacheContext,
      telemetry
    });
    const matches = await contentSupabaseRequest({
      config,
      path: `/rest/v1/rpc/match_${table}`,
      options: {
        method: "POST",
        body: JSON.stringify({
          query_embedding: embedding,
          match_count: effectiveTopK * (hasDates ? 4 : 2),
          filter: {},
          match_threshold: 0
        })
      }
    });
    const bySimilarity = new Map((Array.isArray(matches) ? matches : []).map((match) => [String(match.id), match.similarity ?? null]));
    if (!bySimilarity.size) return [];
    const select = selectParam(roles);
    const params = [
      `select=${select}`,
      `${roles.idColumn || "id"}=in.(${[...bySimilarity.keys()].join(",")})`,
      isDefaultTable && spec.extraFilter ? spec.extraFilter : null
    ].filter(Boolean).join("&");
    const rows = await contentSupabaseRequest({ config, path: `/rest/v1/${table}?${params}` });
    return (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, similarity: bySimilarity.get(String(row[roles.idColumn || "id"])) ?? null }));
  } catch (error) {
    warnings.push(/function|schema cache|PGRST202|could not find/i.test(error.message) ? "vector_rpc_missing" : `vector_leg_failed: ${error.message.slice(0, 120)}`);
    return [];
  }
}

// Text leg: ilike over the table's text columns (covers unembedded rows).
// With no usable search terms it degrades to "most recent rows".
async function textLeg({ config, spec, table, roles, isDefaultTable, searchQuery, effectiveTopK, dateFrom, dateTo, warnings }) {
  try {
    const terms = extractSearchTerms(searchQuery);
    const textColumns = roles.textColumns || [];
    const filters = [];
    if (terms.length && textColumns.length) {
      const clauses = [];
      for (const column of textColumns) {
        for (const term of terms) clauses.push(`${column}.ilike.*${encodeURIComponent(term)}*`);
      }
      filters.push(`or=(${clauses.join(",")})`);
    }
    if (isDefaultTable && spec.extraFilter) filters.push(spec.extraFilter);
    if (roles.dateColumn && dateFrom) filters.push(`${roles.dateColumn}=gte.${encodeURIComponent(dateFrom)}`);
    if (roles.dateColumn && dateTo) filters.push(`${roles.dateColumn}=lte.${encodeURIComponent(dateTo)}`);
    const order = roles.dateColumn ? `order=${roles.dateColumn}.desc.nullslast` : null;
    const params = [`select=${selectParam(roles)}`, ...filters, order, `limit=${effectiveTopK * 2}`].filter(Boolean).join("&");
    const rows = await contentSupabaseRequest({ config, path: `/rest/v1/${table}?${params}` });
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    warnings.push(`text_leg_failed: ${error.message.slice(0, 120)}`);
    return [];
  }
}

function selectParam(roles) {
  const columns = Array.isArray(roles.selectColumns) && roles.selectColumns.length ? roles.selectColumns : ["*"];
  return encodeURIComponent(columns.join(","));
}

// Sets row.date from the table's own date column, or from the joined
// conversation for the default whatsapp table.
async function attachRowDates({ config, spec, roles, isDefaultTable, rows }) {
  if (isDefaultTable && spec.dateJoin) {
    const { table, sourceKey, dateColumn } = spec.dateJoin;
    const joinIds = [...new Set(rows.map((row) => row?.[sourceKey]).filter((id) => id != null).map(String))];
    if (joinIds.length) {
      try {
        const joinRows = await contentSupabaseRequest({
          config,
          path: `/rest/v1/${table}?select=id,${dateColumn}&id=in.(${joinIds.join(",")})`
        });
        const byId = new Map((Array.isArray(joinRows) ? joinRows : []).map((row) => [String(row.id), row[dateColumn]]));
        for (const row of rows) row.date = toDateOnly(byId.get(String(row?.[sourceKey]))) || null;
        return;
      } catch {
        // Join is best-effort; rows stay undated.
      }
    }
    for (const row of rows) row.date = null;
    return;
  }
  for (const row of rows) row.date = roles.dateColumn ? toDateOnly(row?.[roles.dateColumn]) : null;
}

function truncateRowStrings(row, limit = ROW_TEXT_LIMIT) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    typeof value === "string" && value.length > limit ? `${value.slice(0, limit)}…` : value
  ]));
}

// Bounds jsonb list fields (kept for callers/tests; analyzeWhatsapp bounds its
// own output).
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

// Adapts the specialist result to the callN8nTool response contract so chat,
// insights, workflow logs, and QA keep working; `analysis` is additive.
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
        .map((row) => rowSource(toolName, row))
        .filter(Boolean)
        .slice(0, 8)
    };
  } catch (error) {
    return { toolName, ok: false, internal: true, error: error.message, data: null, sources: [] };
  }
}

function rowSource(toolName, row) {
  const spec = CONTENT_TOOL_SPECS[toolName];
  const label = String(row?.[spec?.titleField] || row?.title || "צפייה במקור").slice(0, 120);
  if (row?.data_link) return { url: row.data_link, label };
  if (toolName === "emails" && row?.mail_id) {
    return { url: `https://outlook.office.com/mail/inbox/id/${encodeURIComponent(row.mail_id)}`, label };
  }
  return null;
}
