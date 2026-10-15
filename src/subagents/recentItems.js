// "Latest / recent" questions answer by date (ticket 08, ADR 0012).
//
// A vector match returns the items closest in meaning to the question, not the newest
// ones, so "what are the latest emails?" led with an old email. For a recency question
// (see ../recency.js) the chat instead reads the newest items of the asked kind from the
// Project's own Company DB, ordered by THAT kind's own date column (received_date for
// emails, meeting_date for meetings, ...), filtered by project_id, and answers from them.
// With a topic ("the latest emails about waterproofing") the recent window is read by date
// first and then ranked by meaning inside the window.
//
// The reads are plain GETs through the request's content connection (contentSupabaseRequest):
// a Project request reaches only its own Company DB, a Lab request only the Lab dataset in
// MAIN. Nothing here can name another database.
//
// Schemas differ (the 006 template and Kapaim's older tables), so every read is defensive:
// it tries the kind's date-column candidates in order, drops a selected column the table does
// not have, drops an optional filter column the table does not have, and tries the next table
// name for kinds whose table is configurable (alerts). It never drops the project_id filter.
// A read that cannot be made at all fails the route, and the chat falls back to its ordinary
// retrieval.

import { rerankWithLlm } from "../openrouter.js";
import { readLocalSettings } from "../config.js";
import { contentSupabaseConfig, contentSupabaseRequest } from "../supabase.js";
import { projectIdFilterParam, requestProjectId } from "../projectScope.js";
import { companyDbRequiredError, isCompanyDbError } from "../companyDb.js";
import { isLabDatasetEmptyError } from "../labDataset.js";
import { CONTENT_TOOL_SPECS, buildContentRowSource, contentToolSettings } from "./contentTools.js";
import { resolveTableRoles } from "./contentRetrieval.js";
import { toDateOnly } from "./indexing.js";
import { addDaysIso, daysBetweenIso, formatDisplayDate } from "../recency.js";

export const RECENT_ITEMS_TOOL_NAME = "recent_items";
// Rows read per kind when ranking by meaning inside the window.
export const RECENT_SCAN_ROWS = 60;
const MAX_SCAN_ROWS = 100;
const MIN_TOPIC_RELEVANCE = 30;
const SNIPPET_CHARS = 220;
// A newest item older than this gets a "the Project's newest item is from ..." note.
const STALE_AFTER_DAYS = 14;
const SCHEMA_HINT_TTL_MS = 10 * 60 * 1000;

// ── kinds ────────────────────────────────────────────────────────────────────

const KINDS = {
  emails: {
    tool: "emails",
    dateColumns: ["received_date", "received_at", "date", "created_at"],
    he: { latest: "המיילים האחרונים", plain: "המיילים", none: "מיילים", date: "תאריך קבלה" },
    en: { latest: "Latest emails", plain: "emails", date: "received date" }
  },
  meetings: {
    tool: "meetings",
    dateColumns: ["meeting_date", "date", "created_at"],
    he: { latest: "הישיבות האחרונות", plain: "הישיבות", none: "ישיבות", date: "תאריך הישיבה" },
    en: { latest: "Latest meetings", plain: "meetings", date: "meeting date" }
  },
  // Decisions and commitments: the Project's intelligence registry first (what production answered from);
  // for decisions, meetings.decisions_made only when the registry has no rows.
  decisions: {
    tool: "decisions",
    special: "registry",
    registryKind: "decision",
    fallback: "decisions_meetings",
    dateColumns: ["source_date", "created_at"],
    he: { latest: "ההחלטות האחרונות", plain: "ההחלטות", none: "החלטות", date: "תאריך המקור" },
    en: { latest: "Latest decisions", plain: "decisions", date: "source date" }
  },
  commitments: {
    tool: "commitments",
    special: "registry",
    registryKind: "commitment",
    dateColumns: ["source_date", "created_at"],
    he: { latest: "ההתחייבויות האחרונות", plain: "ההתחייבויות", none: "התחייבויות", date: "תאריך המקור" },
    en: { latest: "Latest commitments", plain: "commitments", date: "source date" }
  },
  // Fallback of decisions (never asked for by name): decisions recorded in meetings.
  decisions_meetings: {
    tool: "meetings",
    dateColumns: ["meeting_date", "date", "created_at"],
    filters: [{ param: "decisions_made=not.is.null", column: "decisions_made", droppable: false }],
    he: { latest: "ההחלטות האחרונות (מישיבות)", plain: "ההחלטות מישיבות", none: "החלטות מישיבות", date: "תאריך הישיבה" },
    en: { latest: "Latest decisions (from meetings)", plain: "decisions from meetings", date: "meeting date" }
  },
  whatsapp: {
    tool: "whatsapp_messages",
    special: "whatsapp",
    dateColumns: ["conversation_start", "conversation_end", "created_at"],
    he: { latest: "שיחות הוואטסאפ האחרונות", plain: "שיחות הוואטסאפ", none: "שיחות וואטסאפ", date: "תאריך תחילת השיחה" },
    en: { latest: "Latest WhatsApp conversations", plain: "WhatsApp conversations", date: "conversation start date" }
  },
  alerts: {
    tool: "alert",
    special: "alerts",
    dateColumns: ["data_date", "alert_date", "date", "created_at"],
    selectColumns: ["id", "data_date", "alert_type", "severity_level", "item_status", "data_link", "summary", "alert_description"],
    he: { latest: "ההתראות האחרונות", plain: "ההתראות", none: "התראות", date: "תאריך ההתראה" },
    en: { latest: "Latest alerts", plain: "alerts", date: "alert date" }
  },
  safety: {
    tool: "safety_report",
    dateColumns: ["report_date", "date", "created_at"],
    he: { latest: "דוחות הבטיחות האחרונים", plain: "דוחות הבטיחות", none: "דוחות בטיחות", date: "תאריך הדוח" },
    en: { latest: "Latest safety reports", plain: "safety reports", date: "report date" }
  },
  quality: {
    tool: "quality_control",
    dateColumns: ["inspection_date", "date", "created_at"],
    he: { latest: "ממצאי בקרת האיכות האחרונים", plain: "ממצאי בקרת האיכות", none: "ממצאי בקרת איכות", date: "תאריך הבדיקה" },
    en: { latest: "Latest quality inspections", plain: "quality inspections", date: "inspection date" }
  },
  consultants: {
    tool: "consultants_reports",
    dateColumns: ["report_date", "date", "created_at"],
    he: { latest: "דוחות היועצים האחרונים", plain: "דוחות היועצים", none: "דוחות יועצים", date: "תאריך הדוח" },
    en: { latest: "Latest consultant reports", plain: "consultant reports", date: "report date" }
  },
  exceptions: {
    tool: "exceptions_report",
    dateColumns: ["exception_date", "date", "created_at"],
    he: { latest: "החריגים האחרונים", plain: "החריגים", none: "חריגים", date: "תאריך החריג" },
    en: { latest: "Latest exceptions", plain: "exceptions", date: "exception date" }
  },
  financial: {
    tool: "financial_transactions",
    dateColumns: ["transaction_date", "date", "created_at"],
    he: { latest: "המסמכים הכספיים האחרונים", plain: "המסמכים הכספיים", none: "מסמכים כספיים", date: "תאריך המסמך" },
    en: { latest: "Latest financial documents", plain: "financial documents", date: "document date" }
  }
};

export const RECENT_KIND_NAMES = Object.freeze(Object.keys(KINDS).filter((name) => name !== "decisions_meetings"));

const REGISTRY_TABLE = "project_intelligence_items";
const REGISTRY_SELECT = ["id", "kind", "title", "statement", "summary", "source_date", "due_date", "status", "owner_text", "decision_maker_text", "topic", "created_at"];

const LABELS = {
  he: { owner: "אחראי", decisionMaker: "מחליט", due: "עד", from: "מאת", decisions: "החלטות", risk: "רמת סיכון", status: "סטטוס", noSubject: "(ללא נושא)", noTitle: "פריט" },
  en: { owner: "owner", decisionMaker: "decided by", due: "due", from: "from", decisions: "Decisions", risk: "risk level", status: "status", noSubject: "(no subject)", noTitle: "item" }
};

// ── routing gate ─────────────────────────────────────────────────────────────

// Warnings of the exact Data Query that are deliberate refusals (ingestion time, identity or
// personal-data fields). A recency list must not override those.
const HARD_REFUSAL_WARNING = /ingestion_time|scope_field|identity|pii|attachment_documents|spam|identity_field/i;

// May a recency question take the date-ordered route? Not when the exact Data Query already
// supports the question (it orders by the table's date itself), and not past a deliberate refusal.
export function recentItemsRouteAllowed(routing = null) {
  if (!routing) return true;
  if (routing.supported === true) return false;
  return !HARD_REFUSAL_WARNING.test(String(routing.warning || ""));
}

// Can this request read a Project's content at all? A Company DB (Project mode) or the Lab
// dataset (Lab mode), plus a Project id.
export function hasContentConnectionFor(config) {
  if (!requestProjectId(config)) return false;
  try {
    contentSupabaseConfig(config);
    return true;
  } catch {
    return false;
  }
}

// ── defensive reads ──────────────────────────────────────────────────────────

const schemaHints = new Map(); // `${origin}|${table}` -> { at, dateColumn, dropSelect:Set, dropFilter:Set }

export function clearRecentItemsSchemaHints() {
  schemaHints.clear();
}

function hintKey(config, table) {
  let origin = "";
  try { origin = contentSupabaseConfig(config).supabaseUrl; } catch { /* the read itself refuses */ }
  return `${origin}|${table}`;
}

function freshHint(config, table) {
  const hint = schemaHints.get(hintKey(config, table));
  return hint && Date.now() - hint.at < SCHEMA_HINT_TTL_MS ? hint : null;
}

// A PostgREST error naming a column the table does not have ("column emails.received_at does not exist",
// "Could not find the 'x' column of 't' in the schema cache"), or null.
export function missingColumnOf(error) {
  const message = String(error?.message || "");
  const direct = message.match(/column\s+(?:"?[\w]+"?\.)?"?([\w]+)"?\s+does not exist/i);
  if (direct) return direct[1];
  const cache = message.match(/could not find the ['"]?([\w]+)['"]? column/i);
  return cache ? cache[1] : null;
}

export function isMissingTableError(error) {
  return /could not find the table|relation\s+["'\w.]+\s+does not exist|PGRST205|42P01/i.test(String(error?.message || ""));
}

class ColumnUnavailable extends Error {
  constructor(column, cause) {
    super(`column ${column} is not available`);
    this.code = "recent_column_unavailable";
    this.column = column;
    this.cause = cause;
  }
}

// One GET with the column healing described at the top. `protectedColumns` can never be dropped.
async function healingRead({ config, table, select, filters = [], order = null, limit, protectedColumns = [], hint = null }) {
  let columns = select.filter((column) => !hint?.dropSelect?.has(column));
  let kept = filters.filter((filter) => !hint?.dropFilter?.has(filter.column));
  const dropSelect = new Set(hint?.dropSelect || []);
  const dropFilter = new Set(hint?.dropFilter || []);
  const protectedSet = new Set(["id", "project_id", ...protectedColumns]);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const params = [
      `select=${encodeURIComponent(columns.join(","))}`,
      ...kept.map((filter) => filter.param),
      order,
      `limit=${Math.max(1, Math.min(MAX_SCAN_ROWS, limit))}`
    ].filter(Boolean).join("&");
    try {
      const rows = await contentSupabaseRequest({ config, path: `/rest/v1/${table}?${params}`, options: { method: "GET" } });
      return { rows: Array.isArray(rows) ? rows : [], dropSelect, dropFilter };
    } catch (error) {
      const missing = missingColumnOf(error);
      if (!missing) throw error;
      const filterIndex = kept.findIndex((filter) => filter.column === missing && filter.droppable);
      if (filterIndex >= 0) {
        dropFilter.add(missing);
        kept = kept.filter((_, index) => index !== filterIndex);
        continue;
      }
      if (!protectedSet.has(missing) && columns.includes(missing)) {
        dropSelect.add(missing);
        columns = columns.filter((column) => column !== missing);
        continue;
      }
      throw new ColumnUnavailable(missing, error);
    }
  }
  throw new Error("recent_items_read_failed_after_retries");
}

function windowFilters(dateColumn, window, requireDate = true) {
  const filters = requireDate ? [{ param: `${dateColumn}=not.is.null`, column: dateColumn, droppable: false }] : [];
  if (window?.dateFrom) filters.push({ param: `${dateColumn}=gte.${encodeURIComponent(window.dateFrom)}`, column: dateColumn, droppable: false });
  if (window?.dateTo) filters.push({ param: `${dateColumn}=lt.${encodeURIComponent(addDaysIso(window.dateTo, 1))}`, column: dateColumn, droppable: false });
  return filters;
}

// The newest rows of `table` (project-filtered), by the first date column the table really has.
async function readNewest({ config, projectId, table, select, dateColumns, filters = [], window = null, limit, requireDate = true, thenOrder = null }) {
  const hint = freshHint(config, table);
  const candidates = hint?.dateColumn
    ? [hint.dateColumn, ...dateColumns.filter((column) => column !== hint.dateColumn)]
    : dateColumns;
  let lastError = null;
  for (const dateColumn of candidates) {
    try {
      const result = await healingRead({
        config,
        table,
        select: [...new Set([...select, dateColumn])],
        filters: [{ param: projectIdFilterParam(projectId), column: "project_id", droppable: false }, ...filters, ...windowFilters(dateColumn, window, requireDate)],
        order: `order=${dateColumn}.desc.nullslast${thenOrder ? `,${thenOrder}.desc` : ""}`,
        limit,
        protectedColumns: [dateColumn, ...(thenOrder ? [thenOrder] : [])],
        hint: hint?.dateColumn === dateColumn ? hint : null
      });
      schemaHints.set(hintKey(config, table), { at: Date.now(), dateColumn, dropSelect: result.dropSelect, dropFilter: result.dropFilter });
      return { rows: result.rows, dateColumn, dropped: [...result.dropSelect] };
    } catch (error) {
      if (error?.code === "recent_column_unavailable" && error.column === dateColumn) {
        lastError = error;
        continue; // this table has no such date column: next candidate
      }
      if (error?.code === "recent_column_unavailable" && error.column === "project_id") {
        throw new Error("The table has no project_id, so it cannot be read for a Project");
      }
      throw error;
    }
  }
  throw lastError || new Error("no usable date column");
}

// Per-kind table and columns. A table the Project settings point a tool at (Subagents card) is
// introspected for its roles, like the content tools do; the default table uses the known roles.
async function resolveKindSource({ config, kindName }) {
  const kind = KINDS[kindName];
  if (kind.special === "alerts") {
    const contentConfig = contentSupabaseConfig(config);
    const saved = readLocalSettings()?.subagents?.alert?.table;
    const tables = [...new Set([saved, contentConfig.alertsTable, "alerts"].map((name) => String(name || "").trim()).filter((name) => /^[A-Za-z0-9_]+$/.test(name)))];
    return { tables, select: kind.selectColumns, dateColumns: kind.dateColumns, filters: [] };
  }
  if (kind.special === "registry") {
    const filters = [
      { param: `kind=eq.${kind.registryKind}`, column: "kind", droppable: false },
      { param: "withdrawn=eq.false", column: "withdrawn", droppable: false },
      { param: "superseded=eq.false", column: "superseded", droppable: false }
    ];
    return { tables: [REGISTRY_TABLE], select: REGISTRY_SELECT, dateColumns: kind.dateColumns, filters, registry: true };
  }
  if (kind.special === "whatsapp") {
    return { tables: ["whatsapp_conversations"], select: ["id", "conversation_start", "conversation_end"], dateColumns: kind.dateColumns, filters: [] };
  }
  const spec = CONTENT_TOOL_SPECS[kind.tool];
  const settings = contentToolSettings(config, kind.tool);
  const table = settings.table || spec.defaultTable;
  const isDefaultTable = table === spec.defaultTable;
  const filters = [...(kind.filters || [])];
  if (isDefaultTable && spec.extraFilter) {
    filters.push({ param: spec.extraFilter, column: spec.extraFilter.split("=")[0], droppable: true });
    return { tables: [table], select: spec.roles.selectColumns, dateColumns: kind.dateColumns, filters };
  }
  if (isDefaultTable) return { tables: [table], select: spec.roles.selectColumns, dateColumns: kind.dateColumns, filters };
  const roles = await resolveTableRoles({ config, table });
  return { tables: [table], select: roles.selectColumns, dateColumns: roles.dateColumn ? [roles.dateColumn] : [], filters, custom: true };
}

// Tries each candidate table until one exists.
async function readKindRows({ config, projectId, kindName, window, limit }) {
  const source = await resolveKindSource({ config, kindName });
  if (!source.dateColumns.length) throw new Error(`No date column is known for ${kindName}`);
  const known = schemaHintTable(config, source.tables);
  const ordered = known ? [known, ...source.tables.filter((table) => table !== known)] : source.tables;
  let lastError = null;
  for (const table of ordered) {
    try {
      const result = await readNewest({
        config, projectId, table, select: source.select, dateColumns: source.dateColumns, filters: source.filters, window, limit,
        // The registry keeps rows with no source date, ordered last, then by creation time.
        ...(source.registry ? { requireDate: false, thenOrder: "created_at" } : {})
      });
      return { ...result, table };
    } catch (error) {
      if (isMissingTableError(error) || isLabDatasetEmptyError(error)) { lastError = error; continue; }
      throw error;
    }
  }
  throw lastError || new Error("no table");
}

function schemaHintTable(config, tables) {
  return tables.find((table) => freshHint(config, table)) || null;
}

async function readWhatsappRows({ config, projectId, window, limit }) {
  const conversations = await readKindRows({ config, projectId, kindName: "whatsapp", window, limit });
  const ids = conversations.rows.map((row) => row.id).filter((id) => id != null);
  if (!ids.length) return { ...conversations, rows: [], conversationCount: 0 };
  const spec = CONTENT_TOOL_SPECS.whatsapp_messages;
  const analyses = await healingRead({
    config,
    table: spec.defaultTable,
    select: [...new Set([...spec.roles.selectColumns, "conversation_title"])],
    filters: [
      { param: projectIdFilterParam(projectId), column: "project_id", droppable: false },
      { param: `conversation_id=in.(${ids.join(",")})`, column: "conversation_id", droppable: false }
    ],
    limit: Math.max(ids.length * 2, 10),
    protectedColumns: ["conversation_id"]
  });
  const dateById = new Map(conversations.rows.map((row) => [String(row.id), row[conversations.dateColumn]]));
  const byConversation = new Map();
  for (const row of analyses.rows) {
    const key = String(row.conversation_id);
    if (!byConversation.has(key)) byConversation.set(key, { ...row, [conversations.dateColumn]: dateById.get(key) });
  }
  // Conversation order = newest first; a conversation with no analysis has nothing to show.
  const rows = conversations.rows
    .map((row) => byConversation.get(String(row.id)))
    .filter(Boolean);
  return { ...conversations, rows, conversationCount: conversations.rows.length };
}

// ── presenting rows ──────────────────────────────────────────────────────────

function snippet(value, max = SNIPPET_CHARS) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const joinDetail = (parts) => parts.map((part) => String(part || "").trim()).filter(Boolean).join(" — ");

function presentRow(kindName, row, labels) {
  switch (kindName) {
    case "emails":
      return {
        title: snippet(row.subject, 140) || labels.noSubject,
        detail: joinDetail([row.sender_name || row.sender_mail ? `${labels.from} ${snippet(row.sender_name || row.sender_mail, 60)}` : "", snippet(row.summary || row.mail_summarize)])
      };
    case "meetings":
      return {
        title: snippet(row.subject, 140) || labels.noTitle,
        detail: joinDetail([snippet(row.summary), row.decisions_made ? `${labels.decisions}: ${snippet(row.decisions_made)}` : ""])
      };
    case "decisions_meetings":
      return { title: snippet(row.subject, 140) || labels.noTitle, detail: snippet(row.decisions_made, 320) };
    case "decisions":
    case "commitments": {
      const statement = snippet(row.statement, 320);
      const title = snippet(row.title, 140);
      const due = row.due_date ? `${labels.due} ${formatDisplayDate(row.due_date)}` : "";
      return {
        title: title || snippet(row.statement, 140) || labels.noTitle,
        detail: joinDetail([title && statement !== title ? statement : "", row.owner_text ? `${labels.owner}: ${snippet(row.owner_text, 60)}` : "", row.decision_maker_text ? `${labels.decisionMaker}: ${snippet(row.decision_maker_text, 60)}` : "", due])
      };
    }
    case "whatsapp":
      return { title: snippet(row.conversation_title, 100) || snippet(row.summary, 80) || labels.noTitle, detail: snippet(row.conversation_title ? row.summary : "") };
    case "alerts":
      return { title: snippet(row.alert_type, 100) || labels.noTitle, detail: snippet(row.summary || row.alert_description) };
    case "safety":
      return { title: snippet(row.site_location, 100) || labels.noTitle, detail: joinDetail([row.risk_level ? `${labels.risk}: ${snippet(row.risk_level, 40)}` : "", snippet(row.summary)]) };
    case "quality":
      return { title: snippet(row.defect_title, 140) || labels.noTitle, detail: snippet(row.defect_description || row.summary) };
    case "consultants":
      return { title: snippet(row.report_topic, 140) || labels.noTitle, detail: joinDetail([snippet(row.consultant_name, 60), snippet(row.summary)]) };
    case "exceptions":
      return { title: snippet(row.exception_subject, 140) || labels.noTitle, detail: snippet(row.exception_description || row.summary) };
    case "financial":
      return {
        title: snippet(row.topic || row.vendor_name, 140) || labels.noTitle,
        detail: joinDetail([snippet(row.vendor_name, 60), row.total != null || row.amount_numeric != null ? `${row.total ?? row.amount_numeric} ${row.currency || ""}`.trim() : "", snippet(row.short_description || row.summary)])
      };
    default:
      return { title: labels.noTitle, detail: "" };
  }
}

function toItems({ kindName, rows, dateColumn, table, hebrew }) {
  const kind = KINDS[kindName];
  const labels = hebrew ? LABELS.he : LABELS.en;
  return rows.map((row) => {
    const { title, detail } = presentRow(kindName, row, labels);
    // A registry row with no source date is dated by when it was recorded, and says so.
    const ownDate = toDateOnly(row[dateColumn]);
    const date = ownDate || (KINDS[kindName].special === "registry" ? toDateOnly(row.created_at) : null);
    const source = buildContentRowSource(kind.tool, { ...row, date }, { table });
    return {
      id: row.id == null ? null : String(row.id),
      date,
      recordedDate: !ownDate && Boolean(date),
      title,
      detail,
      url: source?.url || null,
      source
    };
  }).filter((item) => item.date);
}

// ── ranking by meaning inside the window ─────────────────────────────────────

const TOPIC_RERANK_PROMPT = [
  "You rank project records (Hebrew or English) by how relevant they are to a TOPIC.",
  "Return ONLY valid JSON: {\"ranked\":[{\"index\":number,\"relevance\":number,\"reason\":string}]}.",
  "relevance is 0-100: 90+ the record is about the topic, 50 related, 0 unrelated.",
  "Judge meaning, not only shared words (a record about an elevator contractor is relevant to the topic elevators).",
  "Include every candidate. Do not include markdown."
].join("\n");

function topicTerms(topic) {
  return [...new Set(String(topic || "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
}

function keywordRank(items, topic, limit) {
  const terms = topicTerms(topic);
  return items
    .map((item) => {
      const haystack = `${item.title} ${item.detail}`.toLowerCase();
      return { item, score: terms.filter((term) => haystack.includes(term)).length };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)))
    .slice(0, limit)
    .map((entry) => entry.item);
}

async function rankByTopic({ config, topic, items, limit, telemetry }) {
  if (!items.length) return { items: [], method: "none" };
  if (!config?.openRouterApiKey) return { items: keywordRank(items, topic, limit), method: "keyword", warning: "no_openrouter_key" };
  try {
    const candidates = items.map((item) => ({ ...item, content: `${item.title}\n${item.detail}`.slice(0, 1500) }));
    const ranked = await rerankWithLlm({
      apiKey: config.openRouterApiKey,
      model: config.models?.reranker || config.models?.lite || config.models?.main,
      query: topic,
      results: candidates,
      topK: candidates.length,
      systemPrompt: TOPIC_RERANK_PROMPT,
      telemetry
    });
    const relevant = ranked
      .filter((row) => Number(row.rerank_score) >= MIN_TOPIC_RELEVANCE)
      .slice(0, limit)
      .map(({ content, rerank_score, rerank_reason, ...item }) => item);
    return { items: relevant, method: "llm_rerank" };
  } catch (error) {
    return { items: keywordRank(items, topic, limit), method: "keyword", warning: `rerank_failed: ${String(error.message || error).slice(0, 80)}` };
  }
}

// ── the route ────────────────────────────────────────────────────────────────

async function runKind({ config, projectId, kindName, recency, hebrew, telemetry }) {
  const kind = KINDS[kindName];
  const window = recency.window;
  const topic = recency.topic || "";
  const scan = topic ? Math.min(MAX_SCAN_ROWS, Math.max(RECENT_SCAN_ROWS, recency.limit * 6)) : Math.min(MAX_SCAN_ROWS, recency.limit * (kind.fallback ? 3 : 1));
  const readKind = (name, windowToRead, limit) => KINDS[name].special === "whatsapp"
    ? readWhatsappRows({ config, projectId, window: windowToRead, limit })
    : readKindRows({ config, projectId, kindName: name, window: windowToRead, limit });
  // The kind actually read: decisions fall back to meetings.decisions_made when the registry has no rows.
  let effectiveKind = kindName;
  let read = null;
  let registryError = null;
  try {
    read = await readKind(kindName, window, scan);
  } catch (error) {
    if (!kind.fallback || isCompanyDbError(error) || isLabDatasetEmptyError(error)) throw error;
    registryError = error;
  }
  if (kind.fallback && (!read || !read.rows.length)) {
    effectiveKind = kind.fallback;
    try {
      read = await readKind(effectiveKind, window, scan);
    } catch (error) {
      if (!read) throw registryError || error;
    }
  }
  let items = toItems({ kindName: effectiveKind, rows: read.rows, dateColumn: read.dateColumn, table: read.table, hebrew });
  if (effectiveKind === "decisions_meetings") items = items.filter((item) => item.detail);
  const scanned = items.length;
  let ranking = null;
  if (topic && scanned) {
    ranking = await rankByTopic({ config, topic, items, limit: recency.limit, telemetry });
    items = ranking.items;
  } else {
    items = items.slice(0, recency.limit);
  }
  // When the window holds nothing, say how far back the Project's data goes.
  let newestAny = items[0]?.date || null;
  if (!scanned && window) {
    try {
      const probe = await readKind(effectiveKind, null, 1);
      const probeRow = probe.rows[0];
      newestAny = toDateOnly(probeRow?.[probe.dateColumn]) || (KINDS[effectiveKind].special === "registry" ? toDateOnly(probeRow?.created_at) : null);
    } catch {
      newestAny = null;
    }
  } else if (topic && scanned) {
    newestAny = items.length ? [...items].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0].date : null;
  }
  return {
    kind: kindName,
    // What the rows came from (decisions: the registry, or meetings as the fallback).
    sourceKind: effectiveKind,
    tool: KINDS[effectiveKind].tool,
    table: read.table,
    dateColumn: read.dateColumn,
    ingestionDate: read.dateColumn === "created_at",
    window: window ? { from: window.dateFrom, to: window.dateTo } : null,
    scanned,
    items,
    topic: topic || null,
    ranking: ranking ? { method: ranking.method, warning: ranking.warning || null, matched: ranking.items.length } : null,
    newestAny,
    droppedColumns: read.dropped || []
  };
}

/**
 * Reads the newest items for a recency question.
 *
 * @returns {Promise<{ ok: boolean, sections: object[], errors: object[] }>} `ok` is false when no kind could be read.
 * Throws company_db_required / lab_dataset_empty (the caller falls back).
 */
export async function runRecentItems({ config, recency, hebrew = true, telemetry = null }) {
  const projectId = requestProjectId(config);
  if (!projectId) throw companyDbRequiredError("Recent items must name their Project (x-project-id)");
  contentSupabaseConfig(config);
  const sections = [];
  const errors = [];
  for (const kindName of recency.kinds.filter((name) => KINDS[name])) {
    const tool = KINDS[kindName].tool;
    if (config?.contentTools?.perTool?.[tool]?.enabled === false) {
      errors.push({ kind: kindName, error: "content_tool_disabled" });
      continue;
    }
    try {
      sections.push(await runKind({ config, projectId, kindName, recency, hebrew, telemetry }));
    } catch (error) {
      if (isCompanyDbError(error) || isLabDatasetEmptyError(error)) throw error;
      errors.push({ kind: kindName, error: String(error.message || error).slice(0, 160) });
    }
  }
  return { ok: sections.length > 0, sections, errors };
}

// ── answer ───────────────────────────────────────────────────────────────────

function itemLine(item, hebrew) {
  const date = formatDisplayDate(item.date);
  const text = item.detail ? `${item.title} — ${item.detail}` : item.title;
  const link = item.url ? ` [${hebrew ? "למקור" : "source"}](${item.url})` : "";
  const recorded = item.recordedDate ? (hebrew ? " _(תאריך קליטה)_" : " _(recorded)_") : "";
  return `- **${date}**${recorded} · ${text}${link}`;
}

function sectionAnswer(section, { recency, hebrew, today }) {
  const shown = KINDS[section.sourceKind || section.kind];
  const names = hebrew ? shown.he : { ...shown.en, none: shown.en.plain };
  const count = section.items.length;
  // The covered span comes from the items' own dates; a recorded-date stand-in does not widen it.
  const dated = section.items.filter((item) => !item.recordedDate);
  const spanDates = (dated.length ? dated : section.items).map((item) => item.date).sort();
  const from = formatDisplayDate(section.window?.from || spanDates[0]);
  const to = formatDisplayDate(section.window?.to || spanDates.at(-1));
  const lines = [];
  const newestDays = section.newestAny ? daysBetweenIso(section.newestAny, today) : null;
  const staleNote = section.newestAny && newestDays > STALE_AFTER_DAYS
    ? (hebrew
      ? `_הפריט האחרון במאגר הפרויקט הוא מ־${formatDisplayDate(section.newestAny)} (לפני ${newestDays} ימים)._`
      : `_The newest item in the Project's data is from ${formatDisplayDate(section.newestAny)} (${newestDays} days ago)._`)
    : null;

  if (!count) {
    const topicPart = section.topic ? (hebrew ? ` בנושא "${section.topic}"` : ` about "${section.topic}"`) : "";
    if (section.window) {
      lines.push(hebrew
        ? `לא נמצאו ${names.none}${topicPart} בטווח ${formatDisplayDate(section.window.from)}–${formatDisplayDate(section.window.to)}.`
        : `No ${names.none}${topicPart} were found from ${formatDisplayDate(section.window.from)} to ${formatDisplayDate(section.window.to)}.`);
      if (section.newestAny) {
        lines.push(hebrew
          ? `הפריט האחרון במאגר הפרויקט הוא מ־${formatDisplayDate(section.newestAny)}.`
          : `The newest item in the Project's data is from ${formatDisplayDate(section.newestAny)}.`);
      }
    } else {
      lines.push(hebrew
        ? `לא נמצאו ${names.none}${topicPart} בפרויקט${section.scanned ? ` בין ${section.scanned} הפריטים האחרונים שנבדקו` : ""}.`
        : `No ${names.none}${topicPart} were found in the Project${section.scanned ? ` among the ${section.scanned} newest items checked` : ""}.`);
    }
    return lines.join("\n");
  }

  const sameDay = from === to;
  const capitalized = names.plain.charAt(0).toUpperCase() + names.plain.slice(1);
  const heading = section.window
    ? (hebrew
      ? `**${names.plain} ${sameDay ? `ב־${from}` : `מ־${from} עד ${to}`}**`
      : `**${capitalized} ${sameDay ? `on ${from}` : `from ${from} to ${to}`}**`)
    : `**${names.latest} — ${sameDay ? from : hebrew ? `מ־${from} עד ${to}` : `${from} to ${to}`}**`;
  const order = section.ranking
    ? (hebrew ? `ממוינים לפי הקשר לנושא "${section.topic}" בתוך חלון זה` : `ranked by relevance to "${section.topic}" within this window`)
    : (hebrew ? `מהחדש לישן, לפי ${names.date}` : `newest first, by ${names.date}`);
  const scope = section.ranking && section.scanned
    ? (hebrew ? `, מתוך ${section.scanned} הפריטים החדשים ביותר בחלון` : `, out of the ${section.scanned} newest items in the window`)
    : "";
  const countText = hebrew ? (count === 1 ? "פריט אחד" : `${count} פריטים`) : `${count} ${count === 1 ? "item" : "items"}`;
  lines.push(`${heading} (${countText}, ${order}${scope})`);
  if (section.ingestionDate) {
    lines.push(hebrew
      ? "_תאריך המסמך עצמו אינו זמין בנתונים; המיון לפי מועד הקליטה במערכת._"
      : "_The record's own date is not available in the data; items are ordered by the time they were ingested._");
  }
  lines.push(...section.items.map((item) => itemLine(item, hebrew)));
  if (staleNote) lines.push(staleNote);
  return lines.join("\n");
}

export function buildRecentItemsAnswer({ result, recency, hebrew = true }) {
  if (!result?.ok) return null;
  return result.sections.map((section) => sectionAnswer(section, { recency, hebrew, today: recency.today })).join("\n\n");
}

// Names and counts only (no question text, no row text): what the compact run trace and the run events show.
export function summarizeRecentItems({ result, recency }) {
  return {
    path: "date_ordered",
    kinds: (result?.sections || []).map((section) => section.kind),
    window: recency?.window
      ? { type: recency.window.type, from: recency.window.dateFrom, to: recency.window.dateTo }
      : { type: "latest", from: null, to: null },
    sections: (result?.sections || []).map((section) => ({
      kind: section.kind,
      table: section.table,
      order_by: section.dateColumn,
      scanned: section.scanned,
      items: section.items.length,
      newest: section.items[0]?.date || section.newestAny || null,
      ranked_by_meaning: Boolean(section.ranking),
      ranking_method: section.ranking?.method || null
    })),
    errors: (result?.errors || []).map((entry) => ({ kind: entry.kind, error: String(entry.error).slice(0, 80) }))
  };
}
