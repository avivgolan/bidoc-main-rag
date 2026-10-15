// What the Lab "load test dataset" action copies (ticket 06, ADR 0012).
//
// One Project's slice of its Company DB goes into MAIN, into tables with the Company DB template's
// names and columns (labDatasetSchema.js, created by supabase/migrations/20261016100000_lab_dataset_tables.sql).
// This file is only the plan: which tables, in which order, how each one is picked (a page-by-page scan
// of the Project's newest rows, or the rows that belong to rows already copied), which column the date
// window applies to, and whether the embedding comes along.
//
//   scan     Rows of the Project, newest first by `dateColumn` (else created_at, else id), inside the
//            date window when the table has a date column, up to the row cap.
//   byIds    The rows whose `column` holds a value that the already-copied parent rows carry in
//            `parentColumns` (an Email's attachments, a graph edge's two nodes, a Gantt file's tasks).
//
// Embeddings are copied only for the index and the alerts (the Lab chat and the alerts search use their
// vectors); the other content tables are copied as text, and the content tools read them through their
// text leg. A source table that does not exist (an older Company DB, Kapaim's, has no `documents`) is
// skipped, never an error.

import { LAB_TABLE_COLUMNS } from "./labDatasetSchema.js";

export const LAB_COPY_DEFAULT_ROW_CAP = 300;
export const LAB_COPY_MAX_ROW_CAP = 5000;
export const LAB_COPY_PAGE_SIZE = 200;

const scan = (table, label, options = {}) => ({ key: table, table, label, mode: "scan", ...options });
const byIds = (table, label, options) => ({ key: table, table, label, mode: "byIds", ...options });

// The eight derived-record registries the dashboard reads (items, then the evidence of each item).
const registry = (name, label) => [
  scan(`project_${name}_items`, label, { dateColumn: "source_date" }),
  byIds(`project_${name}_sources`, `${label}: מקורות`, { parent: `project_${name}_items`, parentColumns: ["id"], column: "item_id" })
];

export const LAB_COPY_TABLES = Object.freeze([
  // Search and chat
  scan("data_index", "אינדקס חיפוש", { dateColumn: "primary_date", embeddings: true, pageSize: 100 }),
  // The source table is named by the Project's settings (alerts_table_name), the Lab table is `alerts`.
  scan("alerts", "התראות", { dateColumn: "data_date", embeddings: true, pageSize: 100, sourceTable: "alertsTable" }),
  scan("documents", "טקסט קבצים", { dateColumn: "primary_date" }),
  // Communication
  scan("emails", "מיילים", { dateColumn: "received_date" }),
  byIds("email_attachments", "קבצים מצורפים", { parent: "emails", parentColumns: ["mail_id"], column: "mail_id" }),
  scan("whatsapp_analysis", "וואטסאפ: ניתוחים", { dateColumn: "created_at" }),
  byIds("whatsapp_conversations", "וואטסאפ: שיחות", { parent: "whatsapp_analysis", parentColumns: ["conversation_id"], column: "id" }),
  // Construction records the content tools read
  scan("meetings", "ישיבות", { dateColumn: "meeting_date" }),
  scan("meetings_documents", "ישיבות: מסמכים"),
  scan("safety_reports", "דוחות בטיחות", { dateColumn: "report_date" }),
  scan("safety_reports_documents", "דוחות בטיחות: מסמכים"),
  scan("quality_control", "בקרת איכות", { dateColumn: "inspection_date" }),
  scan("quality_control_documents", "בקרת איכות: מסמכים"),
  scan("daily_work_log", "יומני עבודה", { dateColumn: "log_date" }),
  scan("daily_work_log_documents", "יומני עבודה: מסמכים"),
  scan("consultants_reports", "דוחות יועצים", { dateColumn: "report_date" }),
  scan("consultants_reports_documents", "דוחות יועצים: מסמכים"),
  scan("exceptions_report", "חריגים", { dateColumn: "exception_date" }),
  scan("financial_transactions", "עסקאות כספיות", { dateColumn: "transaction_date" }),
  scan("other_documents", "מסמכים אחרים", { dateColumn: "attachment_date" }),
  // Graph (edges first, then the nodes they use)
  scan("graph_edges", "גרף: קשרים", { order: "confidence.desc.nullslast,id.desc", capMin: 1000 }),
  byIds("graph_nodes", "גרף: צמתים", { parent: "graph_edges", parentColumns: ["from_node_id", "to_node_id"], column: "id" }),
  // Dashboard read model
  ...registry("intelligence", "תובנות"),
  ...registry("approval", "אישורים"),
  ...registry("open_question", "שאלות פתוחות"),
  ...registry("delay", "עיכובים"),
  ...registry("safety", "בטיחות"),
  ...registry("quality", "איכות"),
  ...registry("commercial_issue", "נושאים מסחריים"),
  ...registry("progress", "התקדמות"),
  scan("contract_conflicts", "סתירות חוזיות"),
  // Schedule (the newest five Gantt files and every task of them)
  scan("gantt_files", "לוח זמנים: קבצים", { order: "relevancy_date.desc.nullslast,uploaded_at.desc.nullslast,id.desc", capMax: 5 }),
  byIds("gantt_tasks", "לוח זמנים: פעילויות", { parent: "gantt_files", parentColumns: ["file_id"], column: "file_id" }),
  scan("schedule_alerts", "לו\"ז: התראות", { dateColumn: "first_detected_at", capMin: 500 }),
  scan("schedule_indicator_snapshots", "לו\"ז: מדדים", { dateColumn: "as_of", capMin: 500 }),
  scan("schedule_activity_alert_links", "לו\"ז: קישורי התראות", { dateColumn: "event_date", capMin: 500 }),
  scan("schedule_calendars", "לו\"ז: לוחות שנה", { order: "id.asc", capMin: 50 }),
  scan("schedule_observed_events", "לו\"ז: אירועים שנצפו", { dateColumn: "event_date", capMin: 500 }),
  scan("schedule_contract_milestones", "לו\"ז: אבני דרך חוזיות", { order: "id.asc", capMin: 500 }),
  scan("schedule_contract_extensions", "לו\"ז: הארכות", { order: "id.asc", capMin: 500 }),
  scan("schedule_contract_conditions", "לו\"ז: תנאים חוזיים", { order: "id.asc", capMin: 500 })
]);

export const LAB_COPY_KEYS = Object.freeze(LAB_COPY_TABLES.map((entry) => entry.key));

export function labCopyEntry(key) {
  return LAB_COPY_TABLES.find((entry) => entry.key === key) || null;
}

// The ORDER BY of a scan.
export function scanOrder(entry) {
  if (entry.order) return entry.order;
  const columns = LAB_TABLE_COLUMNS[entry.table] || [];
  if (entry.dateColumn) return `${entry.dateColumn}.desc.nullslast,id.desc`;
  return columns.includes("created_at") ? "created_at.desc,id.desc" : "id.desc";
}

// How many rows of this table the slice takes, for a requested row cap.
export function effectiveCap(entry, rowCap) {
  const requested = Math.max(1, Math.min(Number(rowCap) || LAB_COPY_DEFAULT_ROW_CAP, LAB_COPY_MAX_ROW_CAP));
  let cap = entry.capMin ? Math.max(requested, entry.capMin) : requested;
  if (entry.capMax) cap = Math.min(cap, entry.capMax);
  return Math.min(cap, LAB_COPY_MAX_ROW_CAP);
}

// Lab table columns the copy writes (embedding only where the plan keeps it).
export function copiedColumns(entry) {
  const columns = LAB_TABLE_COLUMNS[entry.table] || [];
  return entry.embeddings ? columns : columns.filter((column) => column !== "embedding");
}
