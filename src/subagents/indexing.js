// Internal Indexing Agent (docs/n8n-agents-migration-spec.md, Task A1).
// Part of the n8n phase-out: fills the event_date/document_date columns the n8n
// indexing workflow never populated, and indexes new source rows into data_index.
// Dates are deterministic (index-dates-v1): they come only from source-native date
// columns — a missing date stays null and is never invented from ingestion
// timestamps (created_at on most source rows is the 2026-05/06 ingestion time,
// not a document date).

import { createEmbedding } from "../openrouter.js";
import { contentSupabaseConfig, contentSupabaseRequest } from "../supabase.js";

export const INDEX_DATES_VERSION = "index-dates-v1";
export const INTERNAL_INDEXING_VERSION = "internal-indexing-v1";

const KEY_PAGE_SIZE = 1000;
const SOURCE_FETCH_CHUNK = 100;
const UPSERT_BATCH_SIZE = 200;
const EMBEDDING_CONCURRENCY = 3;

// Per-source-table contract: where document/event dates come from, which fields
// feed a new index row, and which rows are eligible at all. relevanceFilter is a
// PostgREST filter string; the emails rule (only project-classified mails are
// indexed) mirrors the live n8n behavior and must be preserved.
export const SOURCE_TABLE_SPECS = {
  meetings: {
    documentDateColumn: "meeting_date",
    eventDateColumn: "meeting_date" // the meeting itself is the event
  },
  emails: {
    documentDateColumn: "received_date",
    eventDateColumn: null, // the mail reports events; extracting them is Task A2
    relevanceFilter: "relevance_status=in.(project_related,multi_project)"
  },
  safety_reports: {
    documentDateColumn: "report_date",
    eventDateColumn: "report_date" // the inspection visit is the event
  },
  consultants_reports: {
    documentDateColumn: "report_date",
    eventDateColumn: "report_date"
  },
  financial_transactions: {
    documentDateColumn: "transaction_date",
    eventDateColumn: "transaction_date"
  },
  whatsapp_analysis: {
    // Source rows carry no date column of their own — the conversation they
    // analyze does (whatsapp_conversations.conversation_start, ~270/525 rows);
    // the index row's primary_date (when n8n filled it) is the fallback.
    documentDateColumn: null,
    eventDateColumn: null,
    documentDateFromPrimary: true,
    dateJoin: { table: "whatsapp_conversations", sourceKey: "conversation_id", dateColumn: "conversation_start" }
  },
  other_documents: {
    // Only created_at (ingestion time) exists — no reliable dates at all.
    documentDateColumn: null,
    eventDateColumn: null
  }
};

export function toDateOnly(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// Deterministic date derivation. primaryDate follows the same convention as the
// source date column in every table (verified live), so it is a safe fallback for
// orphaned index rows whose source row was deleted.
export function computeIndexDates({ sourceTable, sourceRow = null, primaryDate = null, joinedDate = null }) {
  const spec = SOURCE_TABLE_SPECS[sourceTable];
  if (!spec) return { event_date: null, document_date: null };
  let documentDate = spec.documentDateColumn ? toDateOnly(sourceRow?.[spec.documentDateColumn]) : null;
  if (!documentDate && spec.dateJoin) documentDate = toDateOnly(joinedDate);
  if (!documentDate && (spec.documentDateColumn || spec.documentDateFromPrimary)) {
    documentDate = toDateOnly(primaryDate);
  }
  let eventDate = null;
  if (spec.eventDateColumn) {
    eventDate = spec.eventDateColumn === spec.documentDateColumn
      ? documentDate
      : toDateOnly(sourceRow?.[spec.eventDateColumn]);
  }
  return { event_date: eventDate, document_date: documentDate };
}

// ── Backfill: fill event_date/document_date on existing index rows ───────────

export async function runIndexDatesBackfill({ config, dryRun = true, limit = 3000, runId = null, emit = null } = {}) {
  const indexTable = contentSupabaseConfig(config).indexTable;
  const summary = {
    dates_version: INDEX_DATES_VERSION,
    dryRun,
    indexTable,
    scanned: 0,
    planned: 0,
    updated: 0,
    skippedNoDates: 0,
    orphanFallbacks: 0,
    byTable: {}
  };

  emit?.(runId, "index_dates_backfill", "Scanning index rows with missing dates", { status: "running", limit });
  const rows = await fetchAllPages({
    config,
    table: indexTable,
    select: "id,source_table,source_id,primary_date,event_date,document_date",
    filter: "or=(event_date.is.null,document_date.is.null)",
    max: limit
  });
  summary.scanned = rows.length;

  const byTable = groupBy(rows, (row) => row.source_table);
  const plans = [];
  for (const [sourceTable, tableRows] of byTable) {
    const spec = SOURCE_TABLE_SPECS[sourceTable];
    const tableSummary = { scanned: tableRows.length, planned: 0, skippedNoDates: 0, orphanFallbacks: 0 };
    summary.byTable[sourceTable] = tableSummary;
    if (!spec) {
      tableSummary.skippedNoDates = tableRows.length;
      summary.skippedNoDates += tableRows.length;
      continue;
    }
    const sourceSelect = [
      "id",
      spec.documentDateColumn,
      spec.dateJoin?.sourceKey
    ].filter(Boolean).join(",");
    const sourceRows = spec.documentDateColumn || spec.dateJoin
      ? await fetchSourceRowsById({
          config,
          table: sourceTable,
          ids: tableRows.map((row) => row.source_id),
          select: sourceSelect
        })
      : new Map();
    const joinedDates = await fetchJoinedDates({ config, spec, sourceRows });
    for (const row of tableRows) {
      const sourceRow = sourceRows.get(String(row.source_id)) || null;
      const dates = computeIndexDates({
        sourceTable,
        sourceRow,
        primaryDate: row.primary_date,
        joinedDate: joinedDates.get(String(row.source_id)) ?? null
      });
      // Plan only actual changes — an email row whose document_date is already set
      // (and whose event_date is null by design) must not be re-written every run.
      if (dates.event_date === toDateOnly(row.event_date) && dates.document_date === toDateOnly(row.document_date)) {
        tableSummary.skippedNoDates += 1;
        summary.skippedNoDates += 1;
        continue;
      }
      if (spec.documentDateColumn && !sourceRow) {
        tableSummary.orphanFallbacks += 1;
        summary.orphanFallbacks += 1;
      }
      plans.push({
        source_table: sourceTable,
        source_id: row.source_id,
        event_date: dates.event_date,
        document_date: dates.document_date
      });
      tableSummary.planned += 1;
    }
  }
  summary.planned = plans.length;

  if (dryRun) {
    emit?.(runId, "index_dates_backfill", `Dry-run: ${plans.length} rows would be updated`, { ...summary, status: "done" });
    return { ...summary, sample: plans.slice(0, 25) };
  }

  // PATCH (not upsert): Postgres checks NOT NULL before ON CONFLICT arbitration,
  // so an upsert without project_id/index_text fails even when every row exists.
  // Rows sharing the same date pair are updated in one grouped PATCH; the write
  // surface is exactly the two date columns.
  const groups = groupBy(plans, (plan) => `${plan.source_table}|${plan.event_date}|${plan.document_date}`);
  for (const [, groupPlans] of groups) {
    const { source_table: sourceTable, event_date: eventDate, document_date: documentDate } = groupPlans[0];
    for (const batch of chunk(groupPlans.map((plan) => plan.source_id), UPSERT_BATCH_SIZE)) {
      const updated = await contentSupabaseRequest({
        config,
        path: `/rest/v1/${indexTable}?source_table=eq.${encodeURIComponent(sourceTable)}&source_id=in.(${batch.map(encodeURIComponent).join(",")})&select=id`,
        options: {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ event_date: eventDate, document_date: documentDate })
        }
      });
      summary.updated += Array.isArray(updated) ? updated.length : batch.length;
    }
    emit?.(runId, "index_dates_backfill", `Updated ${summary.updated}/${plans.length} rows`, { status: "running" });
  }
  emit?.(runId, "index_dates_backfill", `Backfill complete: ${summary.updated} rows updated`, { ...summary, status: "done" });
  return { ...summary, sample: plans.slice(0, 25) };
}

// ── Incremental indexing: index source rows missing from data_index ──────────

export async function runIncrementalIndexing({ config, dryRun = true, limit = 50, tables = null, runId = null, emit = null } = {}) {
  const indexTable = contentSupabaseConfig(config).indexTable;
  const summary = {
    indexing_version: INTERNAL_INDEXING_VERSION,
    dates_version: INDEX_DATES_VERSION,
    dryRun,
    indexTable,
    planned: 0,
    inserted: 0,
    embeddings: 0,
    byTable: {}
  };
  const targetTables = (Array.isArray(tables) && tables.length ? tables : Object.keys(SOURCE_TABLE_SPECS))
    .filter((table) => SOURCE_TABLE_SPECS[table]);

  const planned = [];
  let remaining = limit;
  for (const sourceTable of targetTables) {
    if (remaining <= 0) break;
    const spec = SOURCE_TABLE_SPECS[sourceTable];
    const existing = new Set(
      (await fetchAllPages({
        config,
        table: indexTable,
        select: "id,source_id",
        filter: `source_table=eq.${encodeURIComponent(sourceTable)}`
      })).map((row) => String(row.source_id))
    );
    const sourceIds = (await fetchAllPages({
      config,
      table: sourceTable,
      select: "id",
      filter: spec.relevanceFilter || null
    })).map((row) => String(row.id));
    const missing = sourceIds.filter((id) => !existing.has(id)).slice(0, remaining);
    summary.byTable[sourceTable] = { existing: existing.size, sources: sourceIds.length, missing: missing.length };
    if (!missing.length) continue;
    remaining -= missing.length;

    const sourceRows = await fetchSourceRowsById({ config, table: sourceTable, ids: missing, select: "*" });
    const joinedDates = await fetchJoinedDates({ config, spec, sourceRows });
    for (const id of missing) {
      const sourceRow = sourceRows.get(id);
      if (!sourceRow) continue;
      planned.push(buildIndexRow({ sourceTable, sourceRow, joinedDate: joinedDates.get(id) ?? null }));
    }
  }
  summary.planned = planned.length;
  emit?.(runId, "incremental_indexing", `${planned.length} source rows are missing from the index`, { ...summary, status: dryRun ? "done" : "running" });

  if (dryRun) {
    return { ...summary, sample: planned.slice(0, 10).map(({ embedding, ...row }) => ({ ...row, index_text: String(row.index_text || "").slice(0, 300) })) };
  }
  if (!planned.length) return summary;
  if (!config?.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing — cannot embed new index rows");

  for (const group of chunk(planned, EMBEDDING_CONCURRENCY)) {
    await Promise.all(group.map(async (row) => {
      row.embedding = await createEmbedding({
        apiKey: config.openRouterApiKey,
        model: config.models?.embedding,
        input: row.index_text
      });
      summary.embeddings += 1;
    }));
  }

  // ignore-duplicates: never overwrite rows another writer (n8n) indexed first.
  for (const batch of chunk(planned, 20)) {
    await contentSupabaseRequest({
      config,
      path: `/rest/v1/${indexTable}?on_conflict=source_table,source_id`,
      options: {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(batch)
      }
    });
    summary.inserted += batch.length;
    emit?.(runId, "incremental_indexing", `Indexed ${summary.inserted}/${planned.length} rows`, { status: "running" });
  }
  emit?.(runId, "incremental_indexing", `Incremental indexing complete: ${summary.inserted} rows`, { ...summary, status: "done" });
  return summary;
}

// Builds a complete data_index row from a source row, mirroring the field and
// index_text conventions of the existing n8n-written rows (sampled live per table).
export function buildIndexRow({ sourceTable, sourceRow, joinedDate = null }) {
  const title = indexTitle(sourceTable, sourceRow);
  const summaryText = indexSummary(sourceTable, sourceRow);
  const hashtags = Array.isArray(sourceRow.hashtags) ? sourceRow.hashtags.filter(Boolean) : [];
  const primaryDate = indexPrimaryDate(sourceTable, sourceRow, joinedDate);
  const itemStatus = sourceRow.item_status ?? sourceRow.status ?? null;
  const severity = sourceTable === "safety_reports" ? sourceRow.risk_level ?? null : null;
  const dates = computeIndexDates({ sourceTable, sourceRow, primaryDate, joinedDate });
  const row = {
    project_id: sourceRow.project_id,
    source_table: sourceTable,
    source_id: String(sourceRow.id),
    title,
    summary: summaryText,
    hashtags,
    primary_date: primaryDate,
    item_status: itemStatus,
    severity_or_risk: severity,
    mail_id: sourceRow.mail_id ?? null,
    attachment_id: sourceRow.attachment_id ?? sourceRow.email_attachment_id ?? null,
    source_url: indexSourceUrl(sourceTable, sourceRow),
    mentioned_dates: normalizeMentionedDates(sourceRow.mentioned_dates),
    event_date: dates.event_date,
    document_date: dates.document_date,
    metadata: { ...indexMetadata(sourceTable, sourceRow), indexing: INTERNAL_INDEXING_VERSION, dates_version: INDEX_DATES_VERSION }
  };
  row.index_text = buildIndexText({ sourceTable, sourceRow, title, summary: summaryText, hashtags, primaryDate, itemStatus, severity });
  return row;
}

export function buildIndexText({ sourceTable, sourceRow = {}, title, summary, hashtags = [], primaryDate, itemStatus = null, severity = null }) {
  const tags = hashtags.length ? hashtags.join(" ") : null;
  if (sourceTable === "emails") {
    return joinLines([
      "מקור: emails",
      primaryDate ? `תאריך קבלה: ${isoDate(primaryDate)}` : null,
      line("מאת", [sourceRow.sender_name, sourceRow.sender_mail].filter(Boolean).join(" / ")),
      line("אל", Array.isArray(sourceRow.other_recipients) ? sourceRow.other_recipients.join(", ") : sourceRow.other_recipients),
      line("נושא", title),
      tags ? `תגיות: ${tags}` : null,
      line("תקציר", summary),
      line("תוכן המייל", truncate(sourceRow.mail_body, 1500))
    ]);
  }
  return joinLines([
    `מקור: ${sourceTable}`,
    primaryDate ? `תאריך: ${isoDate(primaryDate)}` : null,
    line("כותרת", title),
    line("סטטוס טיפול", itemStatus),
    line("חומרה/סיכון", severity),
    tags ? `תגיות: ${tags}` : null,
    line("תקציר", summary)
  ]);
}

function indexTitle(sourceTable, row) {
  switch (sourceTable) {
    case "meetings":
    case "emails":
      return row.subject || null;
    case "financial_transactions":
      return row.topic || null;
    case "safety_reports":
      return row.site_location ? `דוח בטיחות – ${row.site_location}` : "דוח בטיחות";
    case "consultants_reports":
      return row.report_topic || row.document_name || null;
    case "whatsapp_analysis":
      return truncate(row.summary, 80);
    case "other_documents":
      return row.document_name || row.filename || null;
    default:
      return row.title || row.subject || null;
  }
}

function indexSummary(sourceTable, row) {
  if (sourceTable === "emails") return row.summary || row.mail_summarize || null;
  if (sourceTable === "financial_transactions") return row.summary || row.short_description || null;
  return row.summary || null;
}

function indexPrimaryDate(sourceTable, row, joinedDate = null) {
  const spec = SOURCE_TABLE_SPECS[sourceTable] || {};
  if (spec.documentDateColumn && row[spec.documentDateColumn]) return row[spec.documentDateColumn];
  if (spec.dateJoin && joinedDate) return joinedDate;
  if (sourceTable === "other_documents") return row.created_at || null;
  return null;
}

function indexSourceUrl(sourceTable, row) {
  if (sourceTable === "financial_transactions") return row.data_link || null;
  if (sourceTable === "emails" && row.mail_id) {
    return `https://outlook.office.com/mail/inbox/id/${encodeURIComponent(row.mail_id)}`;
  }
  // SharePoint download links carry short-lived tempauth tokens minted by the n8n
  // OneDrive integration at ingestion time; they cannot be regenerated here.
  return null;
}

function indexMetadata(sourceTable, row) {
  switch (sourceTable) {
    case "meetings":
      return compact({
        status: row.status,
        attendances: row.attendances,
        description: row.description,
        meeting_goal: row.meeting_goal,
        meeting_hour: row.meeting_hour,
        decisions_made: row.decisions_made,
        mentioned_dates: row.mentioned_dates,
        document_filename: row.document_filename,
        external_meeting_ref: row.external_meeting_ref,
        mentioned_responsibles: row.mentioned_responsibles
      });
    case "emails":
      return compact({
        direction: row.direction,
        sender_name: row.sender_name,
        sender_email: row.sender_mail,
        mail_category: row.mail_category,
        to_recipients: row.other_recipients,
        conversation_id: row.conversationid,
        has_attachments: row.has_attachments,
        body_preview: truncate(row.mail_body, 300)
      });
    case "financial_transactions":
      return compact({
        total: row.total,
        people: row.people,
        category: row.category,
        data_link: row.data_link,
        vendor_name: row.vendor_name,
        transaction_type: row.transaction_type,
        short_description: row.short_description,
        transaction_submitter: row.transaction_submitter
      });
    case "safety_reports":
      return compact({
        resolved: row.resolved,
        site_grade: row.site_grade,
        site_manager: row.site_manager,
        site_location: row.site_location,
        total_workers: row.total_workers,
        defect_details: row.defect_details,
        project_manager: row.project_manager,
        document_filename: row.document_filename
      });
    case "consultants_reports":
      return compact({
        document_name: row.document_name,
        specialization: row.specialization,
        consultant_name: row.consultant_name,
        proposed_actions: row.proposed_actions,
        main_recommendations: row.main_recommendations,
        implementation_status: row.implementation_status
      });
    case "whatsapp_analysis":
      return compact({
        participants: row.people_involved_json,
        conversation_id: row.conversation_id,
        tasks_count: Array.isArray(row.tasks_json) ? row.tasks_json.length : undefined,
        decisions_count: Array.isArray(row.decisions_json) ? row.decisions_json.length : undefined
      });
    case "other_documents":
      return compact({ filename: row.filename, document_type: row.document_type, source: row.source });
    default:
      return {};
  }
}

// ── Content REST helpers ─────────────────────────────────────────────────────

async function fetchAllPages({ config, table, select, filter = null, max = 20000 }) {
  const rows = [];
  let lastId = null;
  while (rows.length < max) {
    const params = [
      `select=${encodeURIComponent(select)}`,
      filter,
      lastId != null ? `id=gt.${lastId}` : null,
      "order=id.asc",
      `limit=${Math.min(KEY_PAGE_SIZE, max - rows.length)}`
    ].filter(Boolean).join("&");
    const page = await contentSupabaseRequest({ config, path: `/rest/v1/${table}?${params}` });
    if (!Array.isArray(page) || !page.length) break;
    rows.push(...page);
    lastId = page[page.length - 1].id;
    if (page.length < KEY_PAGE_SIZE) break;
  }
  return rows;
}

// Resolves per-source-row dates that live in a related table (e.g. the
// whatsapp conversation a whatsapp_analysis row analyzes). Returns a map of
// source-row id -> raw joined date value; empty when the spec has no dateJoin.
async function fetchJoinedDates({ config, spec, sourceRows }) {
  const joined = new Map();
  if (!spec?.dateJoin || !sourceRows?.size) return joined;
  const { table, sourceKey, dateColumn } = spec.dateJoin;
  const joinIds = [...new Set(
    [...sourceRows.values()].map((row) => row?.[sourceKey]).filter((id) => id != null).map(String)
  )];
  if (!joinIds.length) return joined;
  const joinRows = await fetchSourceRowsById({ config, table, ids: joinIds, select: `id,${dateColumn}` });
  for (const [sourceId, sourceRow] of sourceRows) {
    const joinRow = joinRows.get(String(sourceRow?.[sourceKey]));
    if (joinRow?.[dateColumn]) joined.set(sourceId, joinRow[dateColumn]);
  }
  return joined;
}

async function fetchSourceRowsById({ config, table, ids = [], select = "*" }) {
  const map = new Map();
  const uniqueIds = [...new Set(ids.map((id) => String(id)).filter((id) => /^\d+$/.test(id)))];
  for (const group of chunk(uniqueIds, SOURCE_FETCH_CHUNK)) {
    const rows = await contentSupabaseRequest({
      config,
      path: `/rest/v1/${table}?select=${encodeURIComponent(select)}&id=in.(${group.join(",")})`
    });
    for (const row of Array.isArray(rows) ? rows : []) map.set(String(row.id), row);
  }
  return map;
}

// ── Small utilities ──────────────────────────────────────────────────────────

function normalizeMentionedDates(value) {
  if (!Array.isArray(value)) return null;
  const dates = value.map((item) => String(item || "").trim()).filter(Boolean);
  return dates.length ? dates : null;
}

function isoDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().replace(".000Z", "+00:00");
}

function line(label, value) {
  const text = String(value ?? "").trim();
  return text ? `${label}: ${text}` : null;
}

function joinLines(lines) {
  return lines.filter(Boolean).join("\n");
}

function truncate(value, length) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function chunk(items = [], size = 10) {
  const output = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}
