// The Lab "load test dataset" action (ticket 06, ADR 0012).
//
// This is the ONE place a Lab request reads a Company DB. It is a dedicated, narrow, read-only path:
//   - the Company DB is found only through the Meta DB (projects.company_id -> companies.supabase_url +
//     company_credentials), exactly like the Project-mode cross-check in companyDb.js. The browser never
//     names a Company DB, and the key never leaves this module;
//   - every request to the Company DB is a GET (`companyGet`), always narrowed to the chosen Project
//     (project_id=eq.<Project>), with a table name checked against the plan in labDatasetSpec.js;
//   - everything is written to MAIN only (`MainClient`), into the Lab dataset tables, re-stamped with the
//     Lab Project id, and only ever deleted by `project_id = <Lab Project id>`;
//   - no other module imports this one except the Lab dataset routes in server.js (a test checks it), so no
//     other Lab route can reach a Company DB.
//
// The job is a sequence of small steps so that it fits a serverless function and reports progress: the
// browser calls `step` until the run is no longer running. A run purges the previous slice (table by table),
// loads the Project row, then copies each table of the plan page by page. Pages are upserted by id, so a
// repeated step is harmless. Progress is kept in MAIN's lab_dataset_runs row.

import { supabaseHeaders } from "./config.js";
import { normalizeCompanyDbUrl, resolveProjectCompanyDbFromMeta } from "./companyDb.js";
import { LAB_PROJECT_ID } from "./labDataset.js";
import { LAB_TABLE_COLUMNS } from "./labDatasetSchema.js";
import {
  LAB_COPY_DEFAULT_ROW_CAP,
  LAB_COPY_MAX_ROW_CAP,
  LAB_COPY_PAGE_SIZE,
  LAB_COPY_TABLES,
  copiedColumns,
  effectiveCap,
  labCopyEntry,
  scanOrder
} from "./labDatasetSpec.js";

const RUNS_TABLE = "lab_dataset_runs";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/u;
const WRITE_BATCH_ROWS = 100;
const WRITE_BATCH_BYTES = 1_500_000;
const IN_CHUNK = 100;
const DEFAULT_STEP_BUDGET_MS = 40_000;

export class LabDatasetError extends Error {
  constructor(code, message, status = 400, cause = null) {
    super(message);
    this.name = "LabDatasetError";
    this.code = code;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

const sameId = (left, right) => String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();

// ─── MAIN (the only thing this job writes) ───────────────────────────────────

export function createMainClient(config, fetchImpl = (...args) => globalThis.fetch(...args)) {
  const baseUrl = normalizeCompanyDbUrl(config?.supabaseUrl);
  const key = String(config?.supabaseServiceRoleKey || "").trim();
  if (!baseUrl || !key) throw new LabDatasetError("main_not_configured", "MAIN is not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY): the Lab has no database", 503);

  async function request(method, path, { body, headers = {}, timeoutMs = 25_000 } = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: supabaseHeaders(key, headers),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok) {
      const missing = response.status === 404 || ["PGRST205", "PGRST202", "42P01"].includes(data?.code);
      const error = missing
        ? new LabDatasetError("lab_tables_missing", "A Lab dataset table is missing in MAIN: apply supabase/migrations/20261016100000_lab_dataset_tables.sql to MAIN first", 503)
        : new LabDatasetError("main_request_failed", data?.message || `MAIN request failed: ${response.status}`, 502);
      error.upstreamStatus = response.status;
      error.upstreamCode = data?.code || null;
      throw error;
    }
    return { data, headers: response.headers };
  }

  return {
    get: async (path) => (await request("GET", path)).data,
    // Rows of a Lab dataset table, never returned. A row whose id is already there is left as it is: a copied
    // row never overwrites a row of anything else that MAIN holds under the same table (the previous slice
    // was purged first, so a repeated page changes nothing).
    insertRows: (table, rows) => request("POST", `/rest/v1/${table}?on_conflict=id`, { body: rows, headers: { Prefer: "resolution=ignore-duplicates,return=minimal" } }),
    // The Lab's own Project row (id = the Lab Project id): created or refreshed.
    upsertLabProject: (row) => request("POST", "/rest/v1/projects?on_conflict=id", { body: [row], headers: { Prefer: "resolution=merge-duplicates,return=minimal" } }),
    // Rows of the Lab Project only.
    deleteLabRows: (table) => request("DELETE", `/rest/v1/${table}?project_id=eq.${LAB_PROJECT_ID}`, { headers: { Prefer: "return=minimal" }, timeoutMs: 60_000 }),
    insertRun: async (row) => (await request("POST", `/rest/v1/${RUNS_TABLE}`, { body: row, headers: { Prefer: "return=representation" } })).data?.[0] || null,
    patchRun: (id, patch) => request("PATCH", `/rest/v1/${RUNS_TABLE}?id=eq.${encodeURIComponent(id)}`, { body: patch, headers: { Prefer: "return=minimal" } }),
    patchRunning: (patch) => request("PATCH", `/rest/v1/${RUNS_TABLE}?status=eq.running`, { body: patch, headers: { Prefer: "return=minimal" } })
  };
}

// ─── The Meta DB (read only): the Projects to choose from, and the chosen Project's Company DB ───

function metaEnvConnection(env) {
  const url = normalizeCompanyDbUrl(env.META_SUPABASE_URL);
  const key = String(env.META_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new LabDatasetError("meta_not_configured", "The Meta DB is not configured (META_SUPABASE_URL and META_SUPABASE_SERVICE_ROLE_KEY): the Lab cannot find a Project's Company DB", 503);
  return { url, key };
}

async function metaGet(path, { env, fetchImpl }) {
  const { url, key } = metaEnvConnection(env);
  let response;
  try {
    response = await fetchImpl(`${url}${path}`, {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    throw new LabDatasetError("meta_unreachable", "The Meta DB could not be read", 502, error);
  }
  if (!response.ok) throw new LabDatasetError("meta_unreachable", "The Meta DB could not be read", 502);
  const rows = await response.json().catch(() => null);
  if (!Array.isArray(rows)) throw new LabDatasetError("meta_unreachable", "The Meta DB answered something unexpected", 502);
  return rows;
}

// The Projects a Superadmin can copy from: id, name and Company.
export async function listSourceProjects({ env = process.env, fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  const projects = await metaGet("/rest/v1/projects?select=id,name,company_id,is_active&order=name.asc&limit=1000", { env, fetchImpl });
  const companies = await metaGet("/rest/v1/companies?select=id,name&limit=1000", { env, fetchImpl }).catch(() => []);
  const companyName = new Map(companies.map((company) => [String(company.id), company.name || null]));
  return projects
    .filter((project) => project?.id && !sameId(project.id, LAB_PROJECT_ID))
    .map((project) => ({
      id: String(project.id),
      name: project.name || String(project.id),
      companyId: project.company_id ? String(project.company_id) : null,
      companyName: companyName.get(String(project.company_id)) || null,
      isActive: project.is_active !== false
    }));
}

// The chosen Project and its Company DB connection, from the Meta DB only.
async function resolveSource({ projectId, env, fetchImpl }) {
  const id = encodeURIComponent(projectId);
  const [project] = await metaGet(`/rest/v1/projects?select=id,name,company_id,settings&id=eq.${id}&limit=1`, { env, fetchImpl });
  if (!project) throw new LabDatasetError("project_not_found", "The Project is not in the Meta DB", 404);
  let resolved;
  try {
    resolved = await resolveProjectCompanyDbFromMeta({ projectId, env, fetchImpl });
  } catch (error) {
    throw new LabDatasetError(error.code || "company_db_unverified", error.message, error.status || 503, error);
  }
  if (!resolved.supabaseUrl || !resolved.serviceKey) {
    throw new LabDatasetError("company_db_unavailable", "The Project's Company has no Company DB connection registered in the Meta DB", 422);
  }
  const requestedAlerts = String(project.settings?.alerts_table_name || "").trim();
  return {
    projectId,
    projectName: project.name || projectId,
    companyId: resolved.companyId,
    connection: { url: resolved.supabaseUrl, key: resolved.serviceKey },
    alertsTable: TABLE_NAME.test(requestedAlerts) ? requestedAlerts : "alerts"
  };
}

// ─── The Company DB (read only) ──────────────────────────────────────────────

// One GET to the Project's Company DB. This is the only function in the module that sends a request to it,
// and it can only GET: there is no method argument. Reads are always about one Project (the caller adds
// the project_id filter) and about a table named in the plan (or `projects`).
function createCompanyReader({ connection, projectId, fetchImpl }) {
  async function companyGet(table, query, { count = false } = {}) {
    if (!TABLE_NAME.test(table)) throw new LabDatasetError("invalid_table", `Invalid table name: ${table}`, 400);
    const params = new URLSearchParams(query);
    const scope = table === "projects" ? params.get("id") : params.get("project_id");
    if (!sameId(String(scope ?? "").replace(/^eq\./u, ""), projectId)) {
      throw new LabDatasetError("project_scope_required", "A Company DB read must be narrowed to the chosen Project", 500);
    }
    const response = await fetchImpl(`${connection.url}/rest/v1/${table}?${params}`, {
      method: "GET",
      headers: supabaseHeaders(connection.key, { Accept: "application/json", ...(count ? { Prefer: "count=exact" } : {}) }),
      signal: AbortSignal.timeout(25_000)
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok) {
      const error = new LabDatasetError("source_request_failed", `The Company DB answered ${response.status}`, 502);
      error.upstreamStatus = response.status;
      error.upstreamCode = data?.code || null;
      error.upstreamMessage = String(data?.message || "");
      throw error;
    }
    const range = response.headers.get("content-range")?.split("/")[1];
    const total = range && range !== "*" && Number.isFinite(Number(range)) ? Number(range) : null;
    return { rows: Array.isArray(data) ? data : [], total };
  }
  return { companyGet };
}

const isMissingTable = (error) => error?.code === "source_request_failed" && (error.upstreamStatus === 404 || ["PGRST205", "PGRST202", "42P01"].includes(error.upstreamCode));
const missingColumnOf = (error) => {
  if (error?.upstreamCode !== "42703" && !/column .* does not exist/iu.test(error?.upstreamMessage || "")) return null;
  const match = String(error.upstreamMessage || "").match(/column (?:[a-z0-9_]+\.)?"?([a-z0-9_]+)"? does not exist/iu);
  return match ? match[1] : null;
};

// ─── Row shaping ─────────────────────────────────────────────────────────────

// The Lab dataset is the Lab Project: every copied row is re-stamped with its id, in its own project_id
// column, in a Project id kept in its metadata, and in the graph's `p:<project>:` node ids.
export function restampRow(entry, row, sourceProjectId) {
  const out = {};
  for (const column of copiedColumns(entry)) {
    if (row[column] !== undefined) out[column] = row[column];
  }
  if (entry.table !== "projects" && (LAB_TABLE_COLUMNS[entry.table] || []).includes("project_id")) out.project_id = LAB_PROJECT_ID;
  if (out.metadata && typeof out.metadata === "object" && !Array.isArray(out.metadata)) {
    const metadata = { ...out.metadata };
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === "string" && sameId(value, sourceProjectId) && /project_?id$/iu.test(key)) metadata[key] = LAB_PROJECT_ID;
    }
    out.metadata = metadata;
  }
  const sourcePrefix = `p:${sourceProjectId}:`;
  const labPrefix = `p:${LAB_PROJECT_ID}:`;
  const reprefix = (value) => (typeof value === "string" && value.toLowerCase().startsWith(sourcePrefix.toLowerCase()) ? `${labPrefix}${value.slice(sourcePrefix.length)}` : value);
  if (entry.table === "graph_nodes") out.id = reprefix(out.id);
  if (entry.table === "graph_edges") {
    out.from_node_id = reprefix(out.from_node_id);
    out.to_node_id = reprefix(out.to_node_id);
  }
  return out;
}

// The Lab's own Project row: the source Project's name and settings without table-name overrides, which
// name tables of the source Company DB, not the Lab dataset's.
export function labProjectRow(projectName, sourceSettings) {
  const settings = {};
  for (const [key, value] of Object.entries(sourceSettings && typeof sourceSettings === "object" && !Array.isArray(sourceSettings) ? sourceSettings : {})) {
    if (!/_table_name$/u.test(key)) settings[key] = value;
  }
  return { id: LAB_PROJECT_ID, name: `Lab · ${projectName}`, settings, is_active: true };
}

const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

function windowParams(entry, run) {
  const params = [];
  if (!entry.dateColumn) return params;
  if (run.date_from) params.push([entry.dateColumn, `gte.${run.date_from}`]);
  if (run.date_to) params.push([entry.dateColumn, `lt.${nextDay(run.date_to)}`]);
  return params;
}

// A PostgREST in.(...) list: plain ids bare, anything else quoted.
const inList = (values) => `in.(${values.map((value) => {
  const text = String(value);
  return /^[A-Za-z0-9_.:-]+$/u.test(text) ? text : `"${text.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}).join(",")})`;

// ─── Run input and summaries ─────────────────────────────────────────────────

export function normalizeLoadInput(input = {}) {
  const projectId = String(input.projectId ?? "").trim();
  if (!UUID_PATTERN.test(projectId)) throw new LabDatasetError("invalid_project", "Choose a Project to copy from", 400);
  if (sameId(projectId, LAB_PROJECT_ID)) throw new LabDatasetError("invalid_project", "The Lab dataset cannot be copied from itself", 400);
  const date = (value, label) => {
    const text = String(value ?? "").trim();
    if (!text) return null;
    if (!DATE_PATTERN.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new LabDatasetError("invalid_date", `${label} must be a date (YYYY-MM-DD)`, 400);
    return text;
  };
  const dateFrom = date(input.dateFrom, "dateFrom");
  const dateTo = date(input.dateTo, "dateTo");
  if (dateFrom && dateTo && dateFrom > dateTo) throw new LabDatasetError("invalid_date", "dateFrom is after dateTo", 400);
  const rawCap = input.rowCap === undefined || input.rowCap === null || input.rowCap === "" ? LAB_COPY_DEFAULT_ROW_CAP : Number(input.rowCap);
  if (!Number.isInteger(rawCap) || rawCap < 1 || rawCap > LAB_COPY_MAX_ROW_CAP) {
    throw new LabDatasetError("invalid_row_cap", `rowCap must be a whole number from 1 to ${LAB_COPY_MAX_ROW_CAP}`, 400);
  }
  return { projectId, dateFrom, dateTo, rowCap: rawCap };
}

function freshProgress(sourceNames) {
  return {
    sourceNames,
    projectCopied: false,
    tables: Object.fromEntries(LAB_COPY_TABLES.map((entry) => [entry.key, { status: "pending", purged: false, copied: 0, total: null, offset: 0, chunk: 0, missing: [], note: null, error: null }]))
  };
}

export function summarizeRun(run) {
  if (!run) return null;
  const tables = LAB_COPY_TABLES.map((entry) => {
    const state = run.progress?.tables?.[entry.key] || {};
    return { key: entry.key, label: entry.label, status: state.status || "pending", copied: state.copied || 0, total: state.total ?? null, note: state.note || null, error: state.error || null };
  });
  const finished = tables.filter((table) => ["done", "skipped", "error"].includes(table.status)).length;
  const current = tables.find((table) => table.status === "running") || null;
  return {
    id: run.id,
    status: run.status,
    sourceProjectId: run.source_project_id,
    sourceProjectName: run.source_project_name || null,
    dateFrom: run.date_from || null,
    dateTo: run.date_to || null,
    rowCap: run.row_cap,
    createdAt: run.created_at || null,
    finishedAt: run.finished_at || null,
    error: run.error || null,
    phase: run.status !== "running" ? "finished" : run.progress?.tables && Object.values(run.progress.tables).some((state) => !state.purged) ? "purge" : "copy",
    tablesTotal: tables.length,
    tablesFinished: finished,
    rowsCopied: tables.reduce((sum, table) => sum + table.copied, 0),
    currentTable: current ? { key: current.key, label: current.label } : null,
    tables
  };
}

export async function latestRun(main) {
  try {
    const rows = await main.get(`/rest/v1/${RUNS_TABLE}?select=*&order=created_at.desc&limit=1`);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function readRun(main, id) {
  if (!UUID_PATTERN.test(String(id || ""))) throw new LabDatasetError("run_not_found", "No such load run", 404);
  const rows = await main.get(`/rest/v1/${RUNS_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!Array.isArray(rows) || !rows[0]) throw new LabDatasetError("run_not_found", "No such load run", 404);
  return rows[0];
}

// ─── Start a run ─────────────────────────────────────────────────────────────

export async function startLabCopy({ input, main, env = process.env, fetchImpl = (...args) => globalThis.fetch(...args), createdBy = null }) {
  const options = normalizeLoadInput(input);
  const source = await resolveSource({ projectId: options.projectId, env, fetchImpl });
  // One load at a time: a run still going is superseded by this one.
  await main.patchRunning({ status: "superseded", finished_at: new Date().toISOString() });
  const run = await main.insertRun({
    source_project_id: options.projectId,
    source_project_name: source.projectName,
    company_id: source.companyId,
    date_from: options.dateFrom,
    date_to: options.dateTo,
    row_cap: options.rowCap,
    status: "running",
    progress: freshProgress({ alerts: source.alertsTable }),
    created_by: createdBy
  });
  if (!run) throw new LabDatasetError("run_not_created", "The load run could not be recorded in MAIN", 502);
  return summarizeRun(run);
}

// ─── Do some work on a run ───────────────────────────────────────────────────

async function copyProjectRow({ source, reader, main }) {
  const { rows } = await reader.companyGet("projects", new URLSearchParams({ select: "id,name,settings", id: `eq.${source.projectId}`, limit: "1" }));
  const settings = rows[0]?.settings;
  await main.upsertLabProject(labProjectRow(rows[0]?.name || source.projectName, settings));
}

async function writeRows(main, entry, rows) {
  let batch = [];
  let bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    await main.insertRows(entry.table, batch);
    batch = [];
    bytes = 0;
  };
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (batch.length && (batch.length >= WRITE_BATCH_ROWS || bytes + size > WRITE_BATCH_BYTES)) await flush();
    batch.push(row);
    bytes += size;
  }
  await flush();
}

// The selected columns of a scan: every copied column except the ones this source is known to lack.
const selectList = (entry, state) => copiedColumns(entry).filter((column) => !(state.missing || []).includes(column)).join(",");

// Reads one page of a table from the source, dropping a column the source lacks and retrying.
// A column the query filters or orders by is not dropped: that error goes to the caller.
async function readWithColumnFallback({ reader, entry, state, buildQuery, keep = [], count = false }) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await reader.companyGet(entry.sourceName, buildQuery(selectList(entry, state)), { count });
    } catch (error) {
      const column = missingColumnOf(error);
      if (!column || (state.missing || []).includes(column) || !copiedColumns(entry).includes(column) || ["id", "project_id", ...keep].includes(column)) throw error;
      state.missing = [...(state.missing || []), column];
    }
  }
  throw new LabDatasetError("source_columns_unusable", `Too many columns of ${entry.table} are missing in the source`, 502);
}

const orderColumns = (order) => String(order).split(",").map((part) => part.split(".")[0]);

async function copyScanPage({ entry, state, run, source, reader, main }) {
  const cap = effectiveCap(entry, run.row_cap);
  if (state.copied >= cap) {
    state.status = "done";
    return;
  }
  const pageSize = Math.min(entry.pageSize || LAB_COPY_PAGE_SIZE, cap - state.copied);
  const query = (select, { order, window }) => {
    const params = new URLSearchParams({ select, project_id: `eq.${source.projectId}`, order, limit: String(pageSize), offset: String(state.offset) });
    if (window) for (const [column, filter] of windowParams(entry, run)) params.append(column, filter);
    return params;
  };
  const order = scanOrder(entry);
  let page;
  try {
    page = await readWithColumnFallback({ reader, entry, state, count: state.offset === 0, keep: [entry.dateColumn, ...orderColumns(order)].filter(Boolean), buildQuery: (select) => query(select, { order, window: true }) });
  } catch (error) {
    // An ordering or window column this (older) source lacks: take its newest rows by id, window not applied.
    const column = missingColumnOf(error);
    if (!column || (column !== entry.dateColumn && !orderColumns(order).includes(column))) throw error;
    state.note = `העמודה ${column} חסרה במקור: נלקחו השורות האחרונות ללא חלון תאריכים`;
    page = await readWithColumnFallback({ reader, entry, state, count: state.offset === 0, buildQuery: (select) => query(select, { order: "id.desc", window: false }) });
  }
  if (state.total === null && page.total !== null) state.total = Math.min(page.total, cap);
  await writeRows(main, entry, page.rows.map((row) => restampRow(entry, row, source.projectId)));
  state.copied += page.rows.length;
  state.offset += page.rows.length;
  if (page.rows.length < pageSize || state.copied >= cap) {
    state.status = "done";
    state.total = state.copied;
  }
}

const PARENT_PAGE = 1000;
const BY_IDS_PAGE = 500;

// The values the already-copied parent rows (read back from MAIN, paged: a server answers at most 1000
// rows) carry in the parent columns.
async function parentValues(entry, main) {
  const parent = labCopyEntry(entry.parent);
  const values = new Set();
  for (const column of entry.parentColumns) {
    for (let offset = 0; ; offset += PARENT_PAGE) {
      const rows = await main.get(`/rest/v1/${parent.table}?select=${column}&project_id=eq.${LAB_PROJECT_ID}&${column}=not.is.null&order=${column}.asc,id.asc&limit=${PARENT_PAGE}&offset=${offset}`);
      for (const row of Array.isArray(rows) ? rows : []) {
        if (row[column] !== null && row[column] !== undefined && row[column] !== "") values.add(String(row[column]));
      }
      if (!Array.isArray(rows) || rows.length < PARENT_PAGE) break;
    }
  }
  return [...values].sort();
}

// One page of the rows that belong to one chunk of parent values (state.chunk), paged within the chunk.
async function copyByIdsPage({ entry, state, source, reader, main }) {
  const values = await parentValues(entry, main);
  const chunk = values.slice(state.chunk * IN_CHUNK, (state.chunk + 1) * IN_CHUNK);
  if (!chunk.length) {
    state.status = "done";
    state.total = state.copied;
    return;
  }
  // graph_nodes: the parent values are the Lab's edges' (re-prefixed) node ids; the source rows carry the source prefix.
  const labPrefix = `p:${LAB_PROJECT_ID}:`;
  const lookup = entry.table === "graph_nodes"
    ? chunk.map((value) => (value.toLowerCase().startsWith(labPrefix) ? `p:${source.projectId}:${value.slice(labPrefix.length)}` : value))
    : chunk;
  const page = await readWithColumnFallback({
    reader,
    entry,
    state,
    buildQuery: (select) => new URLSearchParams({ select, project_id: `eq.${source.projectId}`, [entry.column]: inList(lookup), order: "id.asc", limit: String(BY_IDS_PAGE), offset: String(state.offset) })
  });
  await writeRows(main, entry, page.rows.map((row) => restampRow(entry, row, source.projectId)));
  state.copied += page.rows.length;
  if (page.rows.length >= BY_IDS_PAGE) {
    state.offset += page.rows.length;
  } else {
    state.chunk += 1;
    state.offset = 0;
  }
  if (state.chunk * IN_CHUNK >= values.length) {
    state.status = "done";
    state.total = state.copied;
  }
}

async function copyTable(context) {
  const { entry, state } = context;
  state.status = "running";
  context.entry = { ...entry, sourceName: entry.sourceTable ? context.source[entry.sourceTable] || entry.table : entry.table };
  try {
    if (entry.mode === "byIds") await copyByIdsPage(context);
    else await copyScanPage(context);
  } catch (error) {
    if (isMissingTable(error)) {
      state.status = "skipped";
      state.note = "הטבלה אינה קיימת במקור";
      return;
    }
    state.status = "error";
    state.error = error.message;
  }
}

function aliasAlertsTable(source, progress) {
  return { ...source, alertsTable: progress?.sourceNames?.alerts || source.alertsTable };
}

// Does about `budgetMs` of work on a run (purge the previous slice, copy the Project row, copy table pages)
// and saves its progress. Returns the run's summary; status is `running` until every table is finished.
export async function stepLabCopy({ runId, main, env = process.env, fetchImpl = (...args) => globalThis.fetch(...args), budgetMs = DEFAULT_STEP_BUDGET_MS, now = Date.now }) {
  const run = await readRun(main, runId);
  if (run.status !== "running") return summarizeRun(run);
  const deadline = now() + budgetMs;
  const resolved = await resolveSource({ projectId: run.source_project_id, env, fetchImpl });
  const source = aliasAlertsTable(resolved, run.progress);
  const reader = createCompanyReader({ connection: source.connection, projectId: source.projectId, fetchImpl });
  const progress = run.progress && run.progress.tables ? run.progress : freshProgress({ alerts: source.alertsTable });
  const save = () => main.patchRun(run.id, { progress, status: run.status, error: run.error || null, updated_at: new Date().toISOString() });

  try {
    do {
      // 1. Purge the previous slice, children first. Only rows of the Lab Project are deleted.
      const toPurge = [...LAB_COPY_TABLES].reverse().find((entry) => !progress.tables[entry.key].purged);
      if (toPurge) {
        await main.deleteLabRows(toPurge.table);
        progress.tables[toPurge.key].purged = true;
        await save();
        continue;
      }
      // 2. The Lab's Project row.
      if (!progress.projectCopied) {
        await copyProjectRow({ source, reader, main });
        progress.projectCopied = true;
        await save();
        continue;
      }
      // 3. The next table page.
      const entry = LAB_COPY_TABLES.find((candidate) => ["pending", "running"].includes(progress.tables[candidate.key].status));
      if (!entry) break;
      await copyTable({ entry, state: progress.tables[entry.key], run, source, reader, main });
      await save();
    } while (now() < deadline);
  } catch (error) {
    run.status = "failed";
    run.error = error.message;
    await main.patchRun(run.id, { progress, status: "failed", error: error.message, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    return summarizeRun({ ...run, progress, status: "failed", error: error.message });
  }

  const remaining = LAB_COPY_TABLES.some((entry) => ["pending", "running"].includes(progress.tables[entry.key].status)) || !progress.projectCopied;
  if (!remaining) {
    const failedTables = Object.values(progress.tables).filter((state) => state.status === "error");
    run.status = failedTables.length ? "partial" : "done";
    run.finished_at = new Date().toISOString();
    await main.patchRun(run.id, { progress, status: run.status, finished_at: run.finished_at, updated_at: run.finished_at });
  }
  return summarizeRun({ ...run, progress });
}
