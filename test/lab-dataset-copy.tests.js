import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { bodyOf, fakeReq, fakeRes, installFakeFetch, jsonResponse } from "./support/handler-harness.js";
import { buildSessionSetCookieHeader } from "../src/auth.js";
import { resetSettingsForTests } from "../src/config.js";
import { clearCompanyDbMetaCache } from "../src/companyDb.js";
import { LAB_DATASET_NAMES, LAB_PROJECT_ID } from "../src/labDataset.js";
import { LAB_TABLE_COLUMNS } from "../src/labDatasetSchema.js";
import { LAB_COPY_KEYS, LAB_COPY_TABLES, effectiveCap, scanOrder } from "../src/labDatasetSpec.js";
import { createMainClient, labProjectRow, restampRow, stepLabCopy, summarizeRun } from "../src/labDatasetCopy.js";
import { labDatasetConfig, routeAccess } from "../src/requestMode.js";

// Ticket 06: the Lab action "load test dataset". A Superadmin copies a slice of one Project's content
// into MAIN's Lab dataset tables. The copy reads the Project's Company DB (read only, GET, found through
// the Meta DB) and writes only MAIN; a re-run replaces the slice; Kapaim is only read; and no other Lab
// route can reach a Company DB. The tests drive the real HTTP handler under a fake network that records
// every host, method and path: a fake Meta DB, two fake Company DBs (JFrog's and Kapaim's older one) and a
// fake MAIN that holds legacy rows the copy must leave alone.

const JFROG = "55555555-5555-4555-8555-555555555555";
const JFROG_OTHER = "66666666-6666-4666-8666-666666666666";
const KAPAIM_PROJECT = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const LEGACY_PROJECT = "77777777-7777-4777-8777-777777777777";
const COMPANY_JFROG = "11111111-aaaa-4aaa-8aaa-111111111111";
const COMPANY_KAPAIM = "22222222-bbbb-4bbb-8bbb-222222222222";
const JFROG_DB = "https://jfrog-company.supabase.test";
const KAPAIM_DB = "https://kapaim.supabase.test";
const MAIN_DB = "https://main-db.supabase.test";
const META_DB = "https://meta.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";
const SESSION_SECRET = "lab-session-secret";
const SUPERADMIN = { id: "a0000000-0000-4000-8000-000000000006", email: "root@example.test" };
const COMPANY_ORIGINS = [JFROG_DB, KAPAIM_DB];
const JFROG_KEY = "jfrog-service-key";
const KAPAIM_KEY = "kapaim-service-key";
const NOW = "2026-10-15T09:00:00.000Z";

const ENV_KEYS = ["VERCEL", "BIDOC_API_SECRET", "INGEST_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY", "META_SUPABASE_URL",
  "META_SUPABASE_SERVICE_ROLE_KEY", "MAIN_AGENT_SESSION_SECRET", "CONTENT_SUPABASE_URL", "CONTENT_SUPABASE_SERVICE_ROLE_KEY"];
const BASE_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  MAIN_AGENT_SESSION_SECRET: SESSION_SECRET,
  SUPABASE_URL: MAIN_DB,
  SUPABASE_SERVICE_ROLE_KEY: "main-db-key",
  OPENROUTER_API_KEY: "sk-or-test-key-0000000000",
  META_SUPABASE_URL: META_DB,
  META_SUPABASE_SERVICE_ROLE_KEY: "meta-service-key"
};

let serverModule = null;
let savedEnv = null;

function useEnv(overrides = {}) {
  savedEnv ||= Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (value !== undefined) process.env[key] = value;
  }
}

function restoreEnv() {
  if (!savedEnv) return;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv = null;
}

const labCookie = () => buildSessionSetCookieHeader(SUPERADMIN).split(";")[0];
const labHeaders = (extra = {}) => ({ host: "main-agent.test", "content-type": "application/json", cookie: labCookie(), ...extra });

// ─── A tiny stateful PostgREST (equality, in, comparison and null filters, ordering, paging) ───

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict"]);

function parseIn(value) {
  const inner = value.slice(4, -1);
  const items = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "\\" && quoted) { current += inner[index + 1]; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { items.push(current); current = ""; continue; }
    current += char;
  }
  items.push(current);
  return items;
}

function matchesFilters(row, params) {
  for (const [column, value] of params.entries()) {
    if (RESERVED.has(column) || column === "or" || column === "and") continue;
    const cell = row[column];
    if (value.startsWith("eq.")) { if (String(cell) !== value.slice(3)) return false; }
    else if (value.startsWith("in.(")) { if (!parseIn(value).includes(String(cell))) return false; }
    else if (value === "not.is.null") { if (cell === null || cell === undefined) return false; }
    else if (value === "is.null") { if (cell !== null && cell !== undefined) return false; }
    else if (value.startsWith("gte.")) { if (cell === null || cell === undefined || String(cell) < value.slice(4)) return false; }
    else if (value.startsWith("lt.")) { if (cell === null || cell === undefined || String(cell) >= value.slice(3)) return false; }
    else throw new Error(`fake PostgREST: unsupported filter ${column}=${value}`);
  }
  return true;
}

function sortRows(rows, order) {
  if (!order) return rows;
  const parts = order.split(",").map((part) => {
    const [column, direction = "asc", nulls] = part.split(".");
    return { column, desc: direction === "desc", nulls };
  });
  return [...rows].sort((a, b) => {
    for (const { column, desc, nulls } of parts) {
      const x = a[column];
      const y = b[column];
      const xn = x === null || x === undefined;
      const yn = y === null || y === undefined;
      if (xn || yn) {
        if (xn && yn) continue;
        const nullsFirst = nulls === "nullsfirst" || (nulls === undefined && desc);
        return xn ? (nullsFirst ? -1 : 1) : (nullsFirst ? 1 : -1);
      }
      if (x === y) continue;
      const result = x < y ? -1 : 1;
      return desc ? -result : result;
    }
    return 0;
  });
}

function selectColumns(rows, select) {
  if (!select || select === "*") return rows;
  const columns = select.split(",");
  return rows.map((row) => Object.fromEntries(columns.filter((column) => column in row).map((column) => [column, row[column]])));
}

// A server answers at most this many rows, whatever the limit (Supabase's default max-rows).
const SERVER_MAX_ROWS = 1000;

function readRows(rows, url) {
  const params = url.searchParams;
  const filtered = sortRows(rows.filter((row) => matchesFilters(row, params)), params.get("order"));
  const offset = Number(params.get("offset") || 0);
  const limit = Math.min(params.has("limit") ? Number(params.get("limit")) : filtered.length, SERVER_MAX_ROWS);
  return { total: filtered.length, rows: selectColumns(filtered.slice(offset, offset + limit), params.get("select")) };
}

// A Company DB: GET only (every other method is answered 500 and recorded as a violation). `tables` maps a
// table name to its rows; a table that is not there answers PGRST205; a selected, filtered or ordered
// column the table's `columns` list lacks answers 42703 (an older schema).
function companyDb({ origin, key, tables, columns = {}, violations, allowRpc = false }) {
  return (call) => {
    if (call.origin !== origin) return null;
    if (allowRpc && call.method === "POST" && new URL(call.url).pathname.startsWith("/rest/v1/rpc/")) return jsonResponse([]);
    if (call.method !== "GET") {
      violations.push(`${call.method} ${call.url}`);
      return jsonResponse({ message: "write refused" }, 500);
    }
    const url = new URL(call.url);
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    if (call.headers.apikey !== key) return jsonResponse({ message: "bad key" }, 401);
    if (!(table in tables)) return jsonResponse({ code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` }, 404);
    const known = columns[table];
    if (known) {
      const used = [...(url.searchParams.get("select") || "*").split(","), ...[...url.searchParams.keys()].filter((name) => !RESERVED.has(name)),
        ...String(url.searchParams.get("order") || "").split(",").map((part) => part.split(".")[0])].filter((name) => name && name !== "*");
      const missing = used.find((name) => !known.includes(name));
      if (missing) return jsonResponse({ code: "42703", message: `column ${table}.${missing} does not exist` }, 400);
    }
    const result = readRows(tables[table], url);
    return jsonResponse(result.rows, 200, { "content-range": `0-${Math.max(result.rows.length - 1, 0)}/${result.total}` });
  };
}


// MAIN: the Lab dataset tables (empty until copied into), plus legacy rows of other data that must survive.
function fakeMain({ state, missingTables = [] }) {
  return (call) => {
    if (call.origin !== MAIN_DB) return null;
    const url = new URL(call.url);
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/);
    if (rpc) return jsonResponse([]);
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    state.touched.push(`${call.method} ${table}`);
    if (missingTables.includes(table)) return jsonResponse({ code: "PGRST205", message: `Could not find the table 'public.${table}'` }, 404);
    const rows = (state.tables[table] ||= []);
    if (call.method === "GET") {
      const result = readRows(rows, url);
      return jsonResponse(result.rows, 200, { "content-range": `0-0/${result.total}` });
    }
    if (call.method === "POST") {
      const prefer = String(call.headers.Prefer || call.headers.prefer || "");
      const incoming = Array.isArray(call.body) ? call.body : [call.body];
      const created = [];
      for (const row of incoming) {
        const withDefaults = { ...row };
        if (!("id" in withDefaults)) withDefaults.id = crypto.randomUUID();
        if (table === "lab_dataset_runs") Object.assign(withDefaults, { created_at: NOW, updated_at: NOW, finished_at: null, error: null }, withDefaults);
        const existing = rows.find((candidate) => String(candidate.id) === String(withDefaults.id));
        if (existing) {
          if (prefer.includes("merge-duplicates")) Object.assign(existing, withDefaults);
          continue; // ignore-duplicates: the existing row stays as it is
        }
        rows.push(withDefaults);
        created.push(withDefaults);
      }
      return jsonResponse(prefer.includes("return=representation") ? created : null, 201);
    }
    if (call.method === "PATCH") {
      for (const row of rows.filter((candidate) => matchesFilters(candidate, url.searchParams))) Object.assign(row, call.body);
      return new Response(null, { status: 204 });
    }
    if (call.method === "DELETE") {
      state.tables[table] = rows.filter((candidate) => !matchesFilters(candidate, url.searchParams));
      return new Response(null, { status: 204 });
    }
    return jsonResponse({ message: "unexpected" }, 500);
  };
}

function fakeMeta({ projects, companies, credentials }) {
  return (call) => {
    if (call.origin !== META_DB) return null;
    if (call.method !== "GET") return jsonResponse({ message: "the Meta DB is read only here" }, 500);
    const url = new URL(call.url);
    const table = url.pathname.replace(/^\/rest\/v1\//, "");
    const source = { projects, companies, company_credentials: credentials }[table];
    if (!source) return jsonResponse({ message: "unknown table" }, 404);
    return jsonResponse(readRows(source, url).rows);
  };
}

// ─── Source data ─────────────────────────────────────────────────────────────

const day = (n) => `2026-09-${String(n).padStart(2, "0")}T10:00:00+00:00`;
const embedding = "[0.1,0.2,0.3]";

function jfrogTables() {
  const indexRows = [1, 2, 3, 4, 5].map((id) => ({
    id, created_at: day(id), project_id: JFROG, source_table: "emails", source_id: String(id), summary: `תקציר ${id}`, hashtags: ["יציקה"], index_text: `טקסט ${id}`,
    metadata: { project_id: JFROG, source: "email" }, embedding, primary_date: day(id), title: `כותרת ${id}`, item_status: "open", mail_id: `m${id}`, attachment_id: null
  }));
  return {
    projects: [{ id: JFROG, name: "גי פרוג", settings: { gantt_files_table_name: "gantt_files_gf", project_start_date: "2026-01-01" }, is_active: true }],
    data_index: [...indexRows, { id: 90, project_id: JFROG_OTHER, source_table: "emails", source_id: "90", index_text: "אחר", embedding, primary_date: day(3) }],
    alerts: [1, 2, 3].map((id) => ({ id, project_id: JFROG, created_at: day(id), data_date: day(id), alert_description: `התראה ${id}`, is_relevant: true, embedding, metadata: { projectId: JFROG } })),
    emails: [1, 2, 3, 4].map((id) => ({ id, project_id: JFROG, created_at: day(id), mail_id: `m${id}`, received_date: day(id), subject: `נושא ${id}`, mail_body: "גוף", relevance_status: "project_related", embedding, metadata: {} }))
      .concat([{ id: 91, project_id: JFROG_OTHER, mail_id: "other", received_date: day(2), subject: "של פרויקט אחר", embedding }]),
    email_attachments: [
      { id: 1, project_id: JFROG, mail_id: "m1", original_file_name: "a.pdf", attachment_id: "att1" },
      { id: 2, project_id: JFROG, mail_id: "m2", original_file_name: "b.pdf", attachment_id: "att2" },
      { id: 3, project_id: JFROG, mail_id: "m9", original_file_name: "never-copied.pdf", attachment_id: "att3" },
      { id: 92, project_id: JFROG_OTHER, mail_id: "m1", original_file_name: "same mail id, other Project.pdf", attachment_id: "att4" }
    ],
    graph_edges: [
      { id: "e1", project_id: JFROG, from_node_id: `p:${JFROG}:a`, to_node_id: `p:${JFROG}:b`, edge_type: "related_to", confidence: 0.9 },
      { id: "e2", project_id: JFROG, from_node_id: `p:${JFROG}:b`, to_node_id: `p:${JFROG}:c`, edge_type: "mentions", confidence: 0.5 }
    ],
    graph_nodes: [
      { id: `p:${JFROG}:a`, project_id: JFROG, node_type: "topic", label: "A", normalized_label: "a" },
      { id: `p:${JFROG}:b`, project_id: JFROG, node_type: "topic", label: "B", normalized_label: "b" },
      { id: `p:${JFROG}:c`, project_id: JFROG, node_type: "topic", label: "C", normalized_label: "c" },
      { id: `p:${JFROG}:unused`, project_id: JFROG, node_type: "topic", label: "unused", normalized_label: "unused" },
      { id: `p:${JFROG_OTHER}:a`, project_id: JFROG_OTHER, node_type: "topic", label: "other", normalized_label: "other" }
    ],
    gantt_files: [
      { id: 1, project_id: JFROG, file_id: "f-old", display_name: "ישן", uploaded_at: day(1), relevancy_date: day(1) },
      { id: 2, project_id: JFROG, file_id: "f-new", display_name: "חדש", uploaded_at: day(5), relevancy_date: day(5) }
    ],
    gantt_tasks: [
      { id: 1, project_id: JFROG, file_id: "f-old", task_uid: "1", task_name: "ישן" },
      { id: 2, project_id: JFROG, file_id: "f-new", task_uid: "1", task_name: "חדש 1" },
      { id: 3, project_id: JFROG, file_id: "f-new", task_uid: "2", task_name: "חדש 2" },
      { id: 93, project_id: JFROG_OTHER, file_id: "f-new", task_uid: "1", task_name: "פרויקט אחר" }
    ],
    project_delay_items: [
      { id: "d1", project_id: JFROG, title: "עיכוב", source_date: "2026-09-02" },
      { id: "d2", project_id: JFROG, title: "עיכוב 2", source_date: "2026-09-04" }
    ],
    project_delay_sources: [
      { id: "s1", project_id: JFROG, item_id: "d1", excerpt: "מקור 1" },
      { id: "s2", project_id: JFROG, item_id: "d2", excerpt: "מקור 2" },
      { id: "s3", project_id: JFROG, item_id: "gone", excerpt: "של פריט שלא הועתק" }
    ]
  };
}

// Kapaim: finished, older schema. No documents table, alerts live in alerts_kapaim, emails lack
// relevance_status, data_index is the template's.
function kapaimTables() {
  return {
    projects: [{ id: KAPAIM_PROJECT, name: "כפעים", settings: { alerts_table_name: "alerts_kapaim" }, is_active: true }],
    data_index: [1, 2, 3].map((id) => ({ id: 500 + id, project_id: KAPAIM_PROJECT, source_table: "emails", source_id: String(id), index_text: `כפעים ${id}`, embedding, primary_date: day(id), metadata: { project_id: KAPAIM_PROJECT } })),
    alerts_kapaim: [{ id: 700, project_id: KAPAIM_PROJECT, data_date: day(2), alert_description: "התראת כפעים", embedding }],
    emails: [{ id: 801, project_id: KAPAIM_PROJECT, mail_id: "k1", received_date: day(3), subject: "כפעים", embedding }]
  };
}
const KAPAIM_COLUMNS = {
  emails: ["id", "project_id", "created_at", "mail_id", "received_date", "subject", "sender_name", "sender_mail", "sender_domain", "other_recipients", "mail_body",
    "has_attachments", "hashtags", "mail_summarize", "mail_category", "processed_for_insights", "conversationid", "direction", "item_status", "summary", "content", "metadata", "embedding"]
};

const META_PROJECTS = [
  { id: JFROG, name: "גי פרוג", company_id: COMPANY_JFROG, is_active: true, settings: {} },
  { id: KAPAIM_PROJECT, name: "כפעים", company_id: COMPANY_KAPAIM, is_active: true, settings: { alerts_table_name: "alerts_kapaim" } },
  { id: LAB_PROJECT_ID, name: "should never be listed", company_id: COMPANY_JFROG, is_active: true, settings: {} }
];
const META_COMPANIES = [
  { id: COMPANY_JFROG, name: "חברת בנייה אביב ובניו", supabase_url: JFROG_DB },
  { id: COMPANY_KAPAIM, name: "Kapaim", supabase_url: KAPAIM_DB }
];
const META_CREDENTIALS = [
  { company_id: COMPANY_JFROG, supabase_service_role_key: JFROG_KEY },
  { company_id: COMPANY_KAPAIM, supabase_service_role_key: KAPAIM_KEY }
];

function freshMainState() {
  return {
    touched: [],
    tables: {
      projects: [{ id: LEGACY_PROJECT, name: "פרויקט ישן", settings: {}, is_active: true }],
      // Legacy rows of other data in a table the Lab dataset shares by name: id 1 collides with a copied id.
      emails: [{ id: 1, project_id: LEGACY_PROJECT, subject: "legacy MAIN email", mail_id: "legacy" }],
      data_index: [{ id: 999, project_id: LAB_PROJECT_ID, index_text: "stale row of the previous slice", source_table: "emails", source_id: "999" }],
      chat_messages_gf: [{ id: "msg-1", session_id: "lab_s1", user_message: "q", ai_response: "a" }],
      qa_reports: [{ id: "r1", message_id: "msg-1" }]
    }
  };
}

async function withCopy(fn, { env = {}, main = {}, jfrog = {}, kapaim = {}, meta = {}, state = freshMainState(), allowRpc = false } = {}) {
  useEnv(env);
  clearCompanyDbMetaCache();
  const violations = [];
  const jf = { tables: jfrogTables(), ...jfrog };
  const kp = { tables: kapaimTables(), columns: KAPAIM_COLUMNS, ...kapaim };
  const routes = [
    fakeMeta({ projects: META_PROJECTS, companies: META_COMPANIES, credentials: META_CREDENTIALS, ...meta }),
    companyDb({ origin: JFROG_DB, key: JFROG_KEY, tables: jf.tables, columns: jf.columns, violations }),
    companyDb({ origin: KAPAIM_DB, key: KAPAIM_KEY, tables: kp.tables, columns: kp.columns, violations, allowRpc }),
    fakeMain({ state, ...main })
  ];
  const originalWarn = console.warn;
  console.warn = () => {};
  const fake = installFakeFetch(async (call) => {
    for (const route of routes) {
      const response = await route(call);
      if (response) return response;
    }
    return null;
  });
  try {
    serverModule ||= await import("../src/server.js");
    resetSettingsForTests();
    fake.calls.length = 0;
    return await fn({ handler: serverModule.default, calls: fake.calls, state, violations });
  } finally {
    console.warn = originalWarn;
    fake.restore();
    resetSettingsForTests();
    clearCompanyDbMetaCache();
    restoreEnv();
  }
}

async function request(handler, { method = "POST", url, headers = labHeaders(), body = null }) {
  const res = fakeRes();
  await handler(fakeReq({ method, url, headers, body }), res);
  return { status: res.statusCode, body: bodyOf(res), headers: res.headers };
}

// Starts a load and steps it to the end through the real routes.
async function loadDataset(handler, input) {
  const started = await request(handler, { url: "/api/lab/dataset/load", body: input });
  assert.equal(started.status, 200, JSON.stringify(started.body));
  let run = started.body.run;
  const seen = [run];
  for (let guard = 0; run.status === "running" && guard < 50; guard += 1) {
    const stepped = await request(handler, { url: `/api/lab/dataset/runs/${run.id}/step` });
    assert.equal(stepped.status, 200, JSON.stringify(stepped.body));
    run = stepped.body.run;
    seen.push(run);
  }
  return { run, seen };
}

const rowsOf = (state, table) => state.tables[table] || [];
const labRows = (state, table) => rowsOf(state, table).filter((row) => row.project_id === LAB_PROJECT_ID);
const callsTo = (calls, origin) => calls.filter((call) => call.origin === origin);

// Tables the copy may write in MAIN (the plan's tables, the Lab's Project row, the run log); nothing else.
const WRITABLE_IN_MAIN = new Set([...LAB_COPY_KEYS, "projects", "lab_dataset_runs"]);

// The fake network, for a local run of the Lab screen (scripts are not part of the suite).
export const labCopyFakes = { companyDb, fakeMain, fakeMeta, freshMainState, jfrogTables, kapaimTables, META_PROJECTS, META_COMPANIES, META_CREDENTIALS, KAPAIM_COLUMNS };

export function registerLabDatasetCopyTests(test) {
  // ─── The copy: read only on the source, writes only MAIN ──────────────────
  test("lab dataset copy: reads only the chosen Project's Company DB (GET only, always narrowed to the Project) and writes only MAIN's dataset tables, stamped with the Lab Project", async () => {
    await withCopy(async ({ handler, calls, state, violations }) => {
      const { run } = await loadDataset(handler, { projectId: JFROG, rowCap: 100 });
      assert.equal(run.status, "done", JSON.stringify(run).slice(0, 600));

      // Source: GET only, only JFrog's Company DB, every read about the one Project.
      assert.deepEqual(violations, [], "the source Company DB was never written");
      const source = callsTo(calls, JFROG_DB);
      assert.ok(source.length > 10, "the Company DB was read");
      assert.ok(source.every((call) => call.method === "GET"), "only GET requests reach the Company DB");
      for (const call of source) {
        const url = new URL(call.url);
        const scoped = url.pathname.endsWith("/projects") ? url.searchParams.get("id") === `eq.${JFROG}` : url.searchParams.get("project_id") === `eq.${JFROG}`;
        assert.ok(scoped, `a read of the Company DB is narrowed to the Project: ${call.url}`);
        assert.equal(call.headers.apikey, JFROG_KEY, "the key is the one the Meta DB holds for the Company");
      }
      assert.equal(callsTo(calls, KAPAIM_DB).length, 0, "no other Company DB is contacted");
      // The Meta DB is only read; the browser never named a Company DB.
      assert.ok(callsTo(calls, META_DB).every((call) => call.method === "GET"));

      // MAIN: only the dataset tables, the Lab's Project row and the run log are written.
      const writes = calls.filter((call) => call.origin === MAIN_DB && call.method !== "GET").map((call) => new URL(call.url).pathname.replace("/rest/v1/", ""));
      assert.ok(writes.length > 10);
      for (const table of new Set(writes)) assert.ok(WRITABLE_IN_MAIN.has(table), `the copy wrote ${table} in MAIN`);
      assert.ok(!state.touched.some((entry) => /^\w+ (chat_messages_gf|chat_session_memory|qa_\w+|delay_\w+|schedule_activity_assignment_\w+)$/.test(entry)), "MAIN's Lab history, QA and other tables are never touched");
      assert.deepEqual(rowsOf(state, "chat_messages_gf"), [{ id: "msg-1", session_id: "lab_s1", user_message: "q", ai_response: "a" }]);

      // The slice: re-stamped with the Lab Project id, the source ids kept, nothing of the other Project.
      const index = labRows(state, "data_index");
      assert.deepEqual(index.map((row) => row.id).sort((a, b) => a - b), [1, 2, 3, 4, 5], "the Project's 5 index rows (the other Project's row and the stale row are gone)");
      assert.ok(index.every((row) => row.project_id === LAB_PROJECT_ID && row.metadata.project_id === LAB_PROJECT_ID), "project_id and the Project id in metadata are re-stamped");
      assert.equal(index[0].embedding, embedding, "index rows keep their embedding");
      assert.equal(index[0].index_text, "טקסט 5", "newest first by primary_date");
      assert.equal(labRows(state, "alerts").length, 3);
      assert.equal(labRows(state, "alerts")[0].metadata.projectId, LAB_PROJECT_ID, "a Project id kept as projectId in metadata is re-stamped too");
      const emails = labRows(state, "emails");
      assert.deepEqual(emails.map((row) => row.id).sort(), [2, 3, 4], "ids already taken by another row of MAIN's emails table are left to it (ignore-duplicates), not overwritten");
      assert.ok(emails.every((row) => row.embedding === undefined), "content tables are copied as text: no embedding");
      assert.deepEqual(rowsOf(state, "emails").find((row) => row.id === 1), { id: 1, project_id: LEGACY_PROJECT, subject: "legacy MAIN email", mail_id: "legacy" }, "a legacy row of MAIN is untouched");
      // Children follow their parents (attachments by mail_id of the copied emails; tasks by file_id).
      assert.deepEqual(labRows(state, "email_attachments").map((row) => row.id), [2], "attachments of the copied emails of this Project only (email 1 is MAIN's legacy row, so its attachment has no parent)");
      assert.deepEqual(labRows(state, "gantt_files").map((row) => row.file_id).sort(), ["f-new", "f-old"]);
      assert.deepEqual(labRows(state, "gantt_tasks").map((row) => row.id).sort(), [1, 2, 3]);
      assert.deepEqual(labRows(state, "project_delay_sources").map((row) => row.id).sort(), ["s1", "s2"], "evidence of copied items only");
      // The graph keeps the Lab's p:<project>: id convention.
      assert.deepEqual(labRows(state, "graph_edges").map((row) => [row.from_node_id, row.to_node_id]).sort(), [[`p:${LAB_PROJECT_ID}:a`, `p:${LAB_PROJECT_ID}:b`], [`p:${LAB_PROJECT_ID}:b`, `p:${LAB_PROJECT_ID}:c`]]);
      assert.deepEqual(labRows(state, "graph_nodes").map((row) => row.id).sort(), [`p:${LAB_PROJECT_ID}:a`, `p:${LAB_PROJECT_ID}:b`, `p:${LAB_PROJECT_ID}:c`], "only the nodes the copied edges use");
      // The Lab's Project row: the source name, its settings without table-name overrides.
      const labProject = rowsOf(state, "projects").find((row) => row.id === LAB_PROJECT_ID);
      assert.equal(labProject.name, "Lab · גי פרוג");
      assert.deepEqual(labProject.settings, { project_start_date: "2026-01-01" });
      assert.ok(rowsOf(state, "projects").some((row) => row.id === LEGACY_PROJECT), "MAIN's other projects stay");

      // Progress: every table has an outcome; a source without the table is skipped, not an error.
      assert.equal(run.tablesFinished, run.tablesTotal);
      assert.equal(run.tables.find((table) => table.key === "documents").status, "skipped");
      assert.equal(run.tables.find((table) => table.key === "data_index").copied, 5);
      assert.ok(run.rowsCopied >= 20);
      assert.ok(!run.tables.some((table) => table.status === "error"));
    });
  });

  test("lab dataset copy: a re-run replaces the previous slice, and the date window and row cap narrow it", async () => {
    await withCopy(async ({ handler, state, violations }) => {
      const first = await loadDataset(handler, { projectId: JFROG, rowCap: 100 });
      assert.equal(first.run.status, "done");
      assert.equal(labRows(state, "data_index").length, 5);
      // A row only the first slice had (and the Lab's own rows of MAIN) are what a re-run replaces.
      state.tables.data_index.push({ id: 1234, project_id: LAB_PROJECT_ID, index_text: "added by hand after the first load", source_table: "emails", source_id: "x" });
      state.tables.emails.push({ id: 5555, project_id: LEGACY_PROJECT, subject: "another legacy email" });

      // Second load: a window (4 Sept to 5 Sept) and a cap.
      const second = await loadDataset(handler, { projectId: JFROG, dateFrom: "2026-09-04", dateTo: "2026-09-05", rowCap: 1 });
      assert.equal(second.run.status, "done");
      assert.deepEqual(labRows(state, "data_index").map((row) => row.id), [5], "the previous slice is gone; the cap of 1 keeps the newest row of the window");
      assert.equal(labRows(state, "alerts").length, 0, "no alert in the window");
      assert.deepEqual(labRows(state, "emails").map((row) => row.id), [4]);
      assert.ok(!rowsOf(state, "data_index").some((row) => row.id === 999 || row.id === 1234), "nothing of the old slice stays");
      assert.equal(rowsOf(state, "projects").filter((row) => row.id === LAB_PROJECT_ID).length, 1, "one Lab Project row");
      // Other data of MAIN survives both loads.
      assert.ok(rowsOf(state, "emails").some((row) => row.id === 1 && row.project_id === LEGACY_PROJECT));
      assert.ok(rowsOf(state, "emails").some((row) => row.id === 5555));
      assert.equal(rowsOf(state, "chat_messages_gf").length, 1);

      // Same window, no cap: the window alone.
      const third = await loadDataset(handler, { projectId: JFROG, dateFrom: "2026-09-02", dateTo: "2026-09-03" });
      assert.deepEqual(labRows(state, "data_index").map((row) => row.id).sort(), [2, 3]);
      assert.deepEqual(violations, []);

      // The run log keeps the history: the earlier runs are finished, the latest is the third.
      const runs = rowsOf(state, "lab_dataset_runs");
      assert.equal(runs.length, 3);
      assert.deepEqual(runs.map((row) => row.status), ["done", "done", "done"]);
      assert.equal(third.run.dateFrom, "2026-09-02");
    });
  });

  test("lab dataset copy: starting a load supersedes a load still running", async () => {
    await withCopy(async ({ handler, state }) => {
      const first = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG } });
      assert.equal(first.body.run.status, "running");
      const second = await loadDataset(handler, { projectId: JFROG });
      assert.equal(second.run.status, "done");
      assert.equal(rowsOf(state, "lab_dataset_runs").find((row) => row.id === first.body.run.id).status, "superseded");
      // The old run cannot carry on.
      const stale = await request(handler, { url: `/api/lab/dataset/runs/${first.body.run.id}/step` });
      assert.equal(stale.body.run.status, "superseded");
    });
  });

  test("lab dataset copy: Kapaim is only read, and its older schema is copied as far as it goes", async () => {
    await withCopy(async ({ handler, calls, state, violations }) => {
      const { run } = await loadDataset(handler, { projectId: KAPAIM_PROJECT });
      assert.equal(run.status, "done", JSON.stringify(run).slice(0, 500));
      // Read-only on Kapaim: GET only, no write attempt of any kind, nothing else contacted.
      assert.deepEqual(violations, [], "not one write was even attempted on Kapaim's Company DB");
      const kapaim = callsTo(calls, KAPAIM_DB);
      assert.ok(kapaim.length > 5 && kapaim.every((call) => call.method === "GET"));
      assert.equal(callsTo(calls, JFROG_DB).length, 0, "only the chosen Project's Company DB is contacted");
      assert.ok(kapaim.every((call) => call.headers.apikey === KAPAIM_KEY));
      // The data: index rows with embeddings, alerts from the Project's own alerts table, emails without the column Kapaim lacks.
      assert.deepEqual(labRows(state, "data_index").map((row) => row.id).sort(), [501, 502, 503]);
      assert.equal(labRows(state, "alerts").length, 1, "alerts_kapaim (named by the Project's settings) lands in the Lab's alerts table");
      assert.ok(callsTo(calls, KAPAIM_DB).some((call) => /\/alerts_kapaim\?/.test(call.url)));
      assert.ok(!callsTo(calls, KAPAIM_DB).some((call) => /\/alerts\?/.test(call.url)), "the template's alerts table is not guessed when the Project names its own");
      assert.deepEqual(labRows(state, "emails").map((row) => row.id), [801], "emails copied although Kapaim has no relevance_status column");
      assert.equal(run.tables.find((table) => table.key === "documents").status, "skipped", "Kapaim has no documents table");
      assert.equal(run.tables.find((table) => table.key === "contract_conflicts").status, "skipped");
      assert.ok(!run.tables.some((table) => table.status === "error"));
    });
  });

  test("kapaim regression: after a Lab load from Kapaim, Kapaim's chat, insights and annotate behave as before on Kapaim's own DB, and its data and schema are unchanged", async () => {
    const kapaim = { tables: { ...kapaimTables(), chat_sessions: [], chat_messages: [], project_insight_runs: [] } };
    await withCopy(async ({ handler, calls, state, violations }) => {
      const before = JSON.stringify(kapaim.tables);
      const loaded = await loadDataset(handler, { projectId: KAPAIM_PROJECT });
      assert.equal(loaded.run.status, "done");
      const afterLoad = calls.length;
      // Kapaim's own users: a Project request (machine secret) with Kapaim's headers, as BiDoc sends them.
      const headers = {
        host: "main-agent.test", "content-type": "application/json", "x-bidoc-api-secret": BIDOC_SECRET, "x-content-supabase-url": KAPAIM_DB, "x-content-supabase-key": KAPAIM_KEY,
        "x-project-id": KAPAIM_PROJECT, "x-index-table": "data_index", "x-hybrid-rpc-name": "hybrid_match_data_index", "x-alerts-table": "alerts_kapaim"
      };
      const chat = await request(handler, { url: "/api/chat", headers, body: { message: "מה קורה עם הטיח בקומה 3 לפי כפעים?", sessionId: `bidoc:${KAPAIM_PROJECT}:s1`, projectId: KAPAIM_PROJECT } });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 300));
      for (const field of ["answer", "sources", "followUps", "classification", "type", "runTrace", "status"]) assert.ok(field in chat.body, `chat keeps ${field}`);
      assert.equal(chat.body.messageId, null, "a Project chat stores nothing in main-agent, as before");
      assert.equal((await request(handler, { method: "GET", url: "/api/insights/runs", headers })).status, 200);
      assert.deepEqual((await request(handler, { url: "/api/messages/m1/annotate", headers, body: { annotation: "V" } })).body, { ok: true, ignored: true });
      const project = calls.slice(afterLoad);
      assert.ok(!project.some((call) => call.origin === MAIN_DB), "a Kapaim Project request never touches MAIN (the Lab dataset included)");
      assert.ok(project.some((call) => call.origin === KAPAIM_DB && /\/rpc\/hybrid_match_data_index$/.test(call.url)), "retrieval uses the request's table and RPC names on Kapaim's DB");
      // (The alerts RPC of a Project request still defaults to match_alerts_embeddings_gf: that is how Project mode behaved before this change and is not touched here.)
      assert.deepEqual(project.filter((call) => /data_index_embeddings_gf|hybrid_match_data_index_embeddings_gf/.test(call.url)).map((call) => call.url), [], "the Lab's names did not leak into a Project request");
      // Kapaim's data and schema: nothing written, in the load or after it (RPC calls are reads).
      assert.deepEqual(violations, [], "no write to Kapaim's Company DB");
      assert.equal(JSON.stringify(kapaim.tables), before, "Kapaim's rows are unchanged");
      assert.ok(calls.filter((call) => call.origin === KAPAIM_DB).every((call) => call.method === "GET" || /\/rpc\//.test(call.url)));
    }, { kapaim, allowRpc: true });
  });

  test("lab dataset copy: progress is reported step by step and a load resumes where it stopped", async () => {
    await withCopy(async ({ handler, state }) => {
      const started = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG } });
      const runId = started.body.run.id;
      assert.equal(started.body.run.status, "running");
      assert.equal(started.body.run.tablesFinished, 0);
      assert.equal(started.body.run.tablesTotal, LAB_COPY_KEYS.length);

      // A step with no time left does one unit of work (here: purge one table) and reports it.
      const config = labDatasetConfig({ supabaseUrl: MAIN_DB, supabaseServiceRoleKey: "main-db-key", contentSource: {}, contentTools: {} });
      const main = createMainClient(config);
      const phases = [];
      let summary = started.body.run;
      let guard = 0;
      while (summary.status === "running" && guard < 400) {
        summary = await stepLabCopy({ runId, main, budgetMs: 0 });
        phases.push(summary.phase);
        guard += 1;
      }
      assert.equal(summary.status, "done");
      assert.ok(guard > 40, `many small steps, each saved (${guard})`);
      assert.equal(phases[0], "purge");
      assert.ok(phases.includes("copy"));
      assert.equal(phases.at(-1), "finished");
      assert.deepEqual(labRows(state, "data_index").map((row) => row.id).sort((a, b) => a - b), [1, 2, 3, 4, 5]);

      // Reading the run (the browser's poll) and the status route carry the same progress.
      const polled = await request(handler, { method: "GET", url: `/api/lab/dataset/runs/${runId}` });
      assert.equal(polled.body.run.status, "done");
      assert.equal(polled.body.run.rowsCopied, summary.rowsCopied);
      const status = await request(handler, { method: "GET", url: "/api/lab/dataset" });
      assert.equal(status.body.lastRun.id, runId);
      assert.equal(status.body.lastRun.sourceProjectName, "גי פרוג");
    });
  });

  test("lab dataset copy: a table that fails is reported and the rest still load (partial)", async () => {
    await withCopy(async ({ handler, state }) => {
      const broken = (call) => (call.origin === JFROG_DB && /\/alerts\?/.test(call.url) ? jsonResponse({ code: "XX000", message: "boom" }, 500) : null);
      // A route in front of the Company DB's: only the alerts read fails.
      const original = globalThis.fetch;
      globalThis.fetch = async (input, options = {}) => {
        const url = String(input?.url || input);
        const failing = broken({ origin: new URL(url).origin, url });
        return failing || original(input, options);
      };
      try {
        const { run } = await loadDataset(handler, { projectId: JFROG });
        assert.equal(run.status, "partial");
        assert.equal(run.tables.find((table) => table.key === "alerts").status, "error");
        assert.match(run.tables.find((table) => table.key === "alerts").error, /Company DB answered 500/);
        assert.equal(labRows(state, "data_index").length, 5, "the other tables still loaded");
      } finally {
        globalThis.fetch = original;
      }
    });
  });

  test("lab dataset copy: more rows than a server answers at once are paged (1,000-row limit), parents and children alike", async () => {
    const jf = jfrogTables();
    // 1,300 emails (each with an attachment) and one Gantt file with 1,600 tasks.
    jf.emails = Array.from({ length: 1300 }, (_, index) => ({ id: 1000 + index, project_id: JFROG, mail_id: `bulk-${index}`, received_date: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T10:00:00+00:00`, subject: `מייל ${index}` }));
    jf.email_attachments = Array.from({ length: 1300 }, (_, index) => ({ id: 5000 + index, project_id: JFROG, mail_id: `bulk-${index}`, original_file_name: `f${index}.pdf` }));
    jf.gantt_files = [{ id: 1, project_id: JFROG, file_id: "f-big", display_name: "גדול", uploaded_at: day(5), relevancy_date: day(5) }];
    jf.gantt_tasks = Array.from({ length: 1600 }, (_, index) => ({ id: 9000 + index, project_id: JFROG, file_id: "f-big", task_uid: String(index), task_name: `פעילות ${index}` }));
    await withCopy(async ({ handler, state }) => {
      const { run } = await loadDataset(handler, { projectId: JFROG, rowCap: 1300 });
      assert.equal(run.status, "done", JSON.stringify(run).slice(0, 400));
      assert.equal(labRows(state, "emails").length, 1300, "1,300 emails although a server answers 1,000 at a time");
      assert.equal(labRows(state, "email_attachments").length, 1300, "every attachment, including those of emails beyond the first thousand");
      assert.equal(labRows(state, "gantt_tasks").length, 1600, "every task of the Gantt file");
      assert.equal(new Set(labRows(state, "gantt_tasks").map((row) => row.id)).size, 1600);
    }, { jfrog: { tables: jf } });
  });

  // ─── Only the copy routes reach a Company DB ──────────────────────────────
  test("lab dataset copy: the copy routes are Lab-only, and no other Lab route contacts a Company DB or the Meta DB", async () => {
    await withCopy(async ({ handler, calls }) => {
      // Route classes: the copy is on the Lab side only.
      for (const path of ["/api/lab/dataset", "/api/lab/dataset/load", "/api/lab/dataset/projects", "/api/lab/dataset/runs/x/step"]) assert.equal(routeAccess(path), "lab", path);

      // A Project request (machine secret) cannot start a copy, read a run or list the Projects.
      const projectHeaders = { host: "main-agent.test", "content-type": "application/json", "x-bidoc-api-secret": BIDOC_SECRET, "x-content-supabase-url": JFROG_DB, "x-content-supabase-key": JFROG_KEY, "x-project-id": JFROG };
      for (const [method, url] of [["POST", "/api/lab/dataset/load"], ["GET", "/api/lab/dataset/projects"], ["POST", "/api/lab/dataset/runs/x/step"], ["GET", "/api/lab/dataset"]]) {
        const refused = await request(handler, { method, url, headers: projectHeaders, body: method === "POST" ? { projectId: JFROG } : null });
        assert.equal(refused.status, 403, `${method} ${url}`);
        assert.equal(refused.body.error, "route_requires_lab_mode");
      }
      // Anonymous, or a Lab session with Company DB headers: refused.
      const anonymous = await request(handler, { url: "/api/lab/dataset/load", headers: { host: "main-agent.test", "content-type": "application/json" }, body: { projectId: JFROG } });
      assert.equal(anonymous.status, 401);
      const withHeaders = await request(handler, { url: "/api/lab/dataset/load", headers: labHeaders({ "x-content-supabase-url": JFROG_DB, "x-content-supabase-key": JFROG_KEY }), body: { projectId: JFROG } });
      assert.equal(withHeaders.status, 400);
      assert.equal(withHeaders.body.error, "lab_mode_has_no_company_db");
      assert.equal(calls.filter((call) => !/agent_settings/.test(call.url)).length, 0, "refused before any database call (bar the settings refresh)");

      // Every other Lab route, with the dataset loaded, stays on MAIN.
      assert.equal((await loadDataset(handler, { projectId: JFROG })).run.status, "done");
      const start = calls.length;
      for (const [method, url, body] of [
        ["POST", "/api/chat", { message: "מה מצב היציקה?", sessionId: "lab_s1" }],
        ["GET", "/api/sessions", null], ["GET", "/api/run-history", null], ["GET", "/api/dashboard/v1/projects", null],
        ["GET", "/api/insights/runs", null], ["POST", "/api/insights/analyze", { focusQuery: "יציקה", limit: 5 }],
        ["GET", "/api/timeline/events?limit=5", null], ["GET", "/api/timeline/alerts", null], ["GET", "/api/graph?limit=20", null],
        ["GET", "/api/schedule/projects", null], ["POST", "/api/index/run", { dryRun: true, tables: ["emails"], limit: 5 }],
        ["POST", "/api/tools/hybrid_search/test", { query: "יציקה" }], ["POST", "/api/subagents/alert", { query: "התראות" }],
        ["GET", "/api/qa/messages", null], ["GET", "/api/delay-claims", null], ["GET", "/api/lab/dataset", null]
      ]) {
        const before = calls.length;
        await request(handler, { method, url, body });
        const used = calls.slice(before);
        assert.ok(!used.some((call) => COMPANY_ORIGINS.includes(call.origin)), `${method} ${url} never contacts a Company DB`);
        assert.ok(!used.some((call) => call.origin === META_DB && !/agent_settings/.test(call.url)), `${method} ${url} does not read the Meta DB (bar the settings refresh)`);
      }
      assert.ok(calls.slice(start).every((call) => !COMPANY_ORIGINS.includes(call.origin)));
    });
  });

  test("lab dataset copy: the Lab reads the slice under the Company DB template's names, never the legacy *_gf tables", async () => {
    assert.deepEqual({ ...LAB_DATASET_NAMES }, { indexTable: "data_index", hybridRpcName: "hybrid_match_data_index", alertsTable: "alerts", alertsRpcName: "match_alerts" });
    // Whatever the saved settings say (they still name the legacy tables), a Lab config uses the template's names.
    const lab = labDatasetConfig({
      supabaseUrl: MAIN_DB, supabaseServiceRoleKey: "k",
      contentSource: { indexTable: "data_index_embeddings_gf_dor_agent", hybridRpcName: "hybrid_match_data_index_embeddings_gf_dor_agent", alertsTable: "alerts_embeddings_gf", alertsRpcName: "match_alerts_embeddings_gf" },
      contentTools: { perTool: { emails: { enabled: true, table: "emails_gf" }, meetings: { enabled: true, table: "" } } }
    });
    assert.equal(lab.contentSource.indexTable, "data_index");
    assert.equal(lab.contentSource.hybridRpcName, "hybrid_match_data_index");
    assert.equal(lab.contentSource.alertsTable, "alerts");
    assert.equal(lab.contentSource.alertsRpcName, "match_alerts");
    assert.equal(lab.contentSource.supabaseUrl, MAIN_DB, "the content source is MAIN itself");
    assert.equal(lab.contentTools.perTool.emails.table, "", "a saved tool table (emails_gf) is not read in the Lab");
    assert.equal(lab.projectId, LAB_PROJECT_ID);

    // A Lab chat searches the Lab dataset's names.
    await withCopy(async ({ handler, calls }) => {
      // (a question no other test asks: a cached answer would skip the search)
      await request(handler, { url: "/api/chat", body: { message: "מתי הסתיימה יציקת התקרה בקומה 3 לפי המסמכים בבדיקת שמות הטבלאות?", sessionId: "lab_names" } });
      const search = calls.find((call) => call.origin === MAIN_DB && /\/rpc\/hybrid_match/.test(call.url));
      assert.ok(search, "retrieval ran against MAIN");
      assert.ok(search.url.endsWith("/rpc/hybrid_match_data_index"));
      assert.equal(search.body.project_id_filter, LAB_PROJECT_ID);
      assert.ok(!calls.some((call) => /_gf/.test(call.url) && /data_index|alerts_embeddings/.test(call.url)), "no legacy *_gf index or alerts table is read");
    });
  });

  test("lab dataset copy: the Project list comes from the Meta DB (never the Lab Project), and bad input is refused before any Company DB read", async () => {
    await withCopy(async ({ handler, calls }) => {
      const list = await request(handler, { method: "GET", url: "/api/lab/dataset/projects" });
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.projects.map((project) => project.id).sort(), [JFROG, KAPAIM_PROJECT].sort(), "the Lab Project is not offered as a source");
      assert.equal(list.body.projects.find((project) => project.id === JFROG).companyName, "חברת בנייה אביב ובניו");
      assert.ok(JSON.stringify(list.body).indexOf(JFROG_KEY) < 0 && JSON.stringify(list.body).indexOf(KAPAIM_KEY) < 0, "no key leaves the server");
      assert.ok(callsTo(calls, META_DB).every((call) => call.method === "GET"));

      const bad = [
        [{ projectId: "not-a-uuid" }, "invalid_project"],
        [{ projectId: LAB_PROJECT_ID }, "invalid_project"],
        [{ projectId: JFROG, dateFrom: "2026-13-45" }, "invalid_date"],
        [{ projectId: JFROG, dateFrom: "2026-09-10", dateTo: "2026-09-01" }, "invalid_date"],
        [{ projectId: JFROG, rowCap: 0 }, "invalid_row_cap"],
        [{ projectId: JFROG, rowCap: 100000 }, "invalid_row_cap"],
        [{ projectId: JFROG, rowCap: 1.5 }, "invalid_row_cap"],
        [{ projectId: "99999999-9999-4999-8999-999999999999" }, "project_not_found"]
      ];
      for (const [body, code] of bad) {
        const result = await request(handler, { url: "/api/lab/dataset/load", body });
        assert.ok([400, 404].includes(result.status), JSON.stringify(result.body));
        assert.equal(result.body.error, code, JSON.stringify(body));
      }
      assert.equal(callsTo(calls, JFROG_DB).length + callsTo(calls, KAPAIM_DB).length, 0, "nothing was read from a Company DB");
      assert.equal(callsTo(calls, MAIN_DB).length, 0, "nothing was written");
      // A Company DB named in the request body is ignored: only the Meta DB decides.
      const sneaky = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG, supabaseUrl: KAPAIM_DB, companyDbUrl: KAPAIM_DB, contentSupabaseUrl: KAPAIM_DB, contentSupabaseKey: "x" } });
      assert.equal(sneaky.status, 200);
      assert.equal(callsTo(calls, KAPAIM_DB).length, 0);
    });
  });

  test("lab dataset copy: it says what is missing instead of guessing (no Meta DB, no Company DB for the Project, migration not applied, no MAIN)", async () => {
    await withCopy(async ({ handler, calls }) => {
      const result = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG } });
      assert.equal(result.status, 503);
      assert.equal(result.body.error, "meta_not_configured");
      assert.equal(calls.length, 0);
    }, { env: { META_SUPABASE_URL: undefined, META_SUPABASE_SERVICE_ROLE_KEY: undefined } });

    await withCopy(async ({ handler }) => {
      const result = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG } });
      assert.equal(result.status, 422);
      assert.equal(result.body.error, "company_db_unavailable");
    }, { meta: { credentials: [] } });

    await withCopy(async ({ handler, calls }) => {
      const result = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG } });
      assert.equal(result.status, 503);
      assert.equal(result.body.error, "lab_tables_missing");
      assert.match(result.body.message, /20261016100000_lab_dataset_tables\.sql/);
      assert.equal(callsTo(calls, JFROG_DB).length, 0);
    }, { main: { missingTables: ["lab_dataset_runs"] } });

    await withCopy(async ({ handler }) => {
      const result = await request(handler, { url: "/api/lab/dataset/load", body: { projectId: JFROG } });
      assert.equal(result.status, 503);
      assert.equal(result.body.error, "main_not_configured");
    }, { env: { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined } });

    // The migration applied but one dataset table missing: the run says so and stops (no half-silent copy).
    await withCopy(async ({ handler }) => {
      const { run } = await loadDataset(handler, { projectId: JFROG });
      assert.equal(run.status, "failed");
      assert.match(run.error, /20261016100000_lab_dataset_tables\.sql/);
    }, { main: { missingTables: ["graph_edges"] } });
  });

  // ─── The plan, the schema and the migration agree ─────────────────────────
  test("lab dataset copy: the plan only names tables and columns of the schema, parents before children", () => {
    const seen = new Set();
    for (const entry of LAB_COPY_TABLES) {
      const columns = LAB_TABLE_COLUMNS[entry.table];
      assert.ok(columns, `${entry.table} is in the schema`);
      assert.ok(columns.includes("id") && columns.includes("project_id"), `${entry.table} has id and project_id`);
      assert.ok(!seen.has(entry.key), `${entry.key} appears once`);
      if (entry.dateColumn) assert.ok(columns.includes(entry.dateColumn), `${entry.table}.${entry.dateColumn}`);
      for (const part of String(scanOrder(entry)).split(",")) assert.ok(columns.includes(part.split(".")[0]), `${entry.table} orders by ${part}`);
      if (entry.mode === "byIds") {
        assert.ok(seen.has(entry.parent), `${entry.table}'s parent ${entry.parent} is copied before it`);
        for (const column of entry.parentColumns) assert.ok(LAB_TABLE_COLUMNS[entry.parent].includes(column), `${entry.parent}.${column}`);
        assert.ok(columns.includes(entry.column), `${entry.table}.${entry.column}`);
      } else {
        assert.equal(entry.mode, "scan");
      }
      if (entry.embeddings) assert.ok(columns.includes("embedding"));
      seen.add(entry.key);
    }
    assert.deepEqual(LAB_COPY_TABLES.filter((entry) => entry.embeddings).map((entry) => entry.table), ["data_index", "alerts"], "embeddings travel only for the index and the alerts");
    for (const required of ["data_index", "alerts", "emails", "email_attachments", "documents", "meetings", "meetings_documents", "whatsapp_analysis", "safety_reports", "financial_transactions",
      "exceptions_report", "consultants_reports", "graph_nodes", "graph_edges", "gantt_files", "gantt_tasks", "schedule_alerts", "schedule_indicator_snapshots", "project_delay_items", "project_progress_items"]) {
      assert.ok(LAB_COPY_KEYS.includes(required), `${required} is part of the slice`);
    }
    // Row cap rules.
    assert.equal(effectiveCap({}, 300), 300);
    assert.equal(effectiveCap({ capMin: 1000 }, 300), 1000);
    assert.equal(effectiveCap({ capMax: 20 }, 300), 20);
    assert.equal(effectiveCap({}, 99999), 5000);
  });

  test("lab dataset copy: the migration creates every table of the schema, adds only, and never touches legacy data", () => {
    const sql = fs.readFileSync(new URL("../supabase/migrations/20261016100000_lab_dataset_tables.sql", import.meta.url), "utf8");
    const statements = sql.replace(/--[^\n]*/g, "");
    for (const [table, columns] of Object.entries(LAB_TABLE_COLUMNS)) {
      const call = statements.match(new RegExp(`pg_temp\\.lab_dataset_table\\('${table}',[\\s\\S]*?\\]\\);`));
      assert.ok(call, `the migration creates ${table}`);
      for (const column of columns.filter((name) => name !== "id")) assert.match(call[0], new RegExp(`'${column} `), `${table}.${column} is in the migration`);
    }
    // The same number of tables in the migration as in the schema (no table the code does not know).
    assert.equal([...statements.matchAll(/pg_temp\.lab_dataset_table\('/g)].length, Object.keys(LAB_TABLE_COLUMNS).length);
    // Add-only: no drop, truncate, delete, update, no RLS or grant change outside a table the migration creates.
    for (const forbidden of [/\bDROP\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i, /\bUPDATE\s+public\./i, /\bALTER\s+TABLE\s+\S+\s+DROP\b/i, /DISABLE\s+ROW\s+LEVEL/i]) {
      assert.doesNotMatch(statements, forbidden, `the migration has no ${forbidden}`);
    }
    // The legacy JFrog tables are never named.
    assert.doesNotMatch(statements, /_gf\b|_gf_/, "the legacy *_gf tables are not touched");
    // Idempotent shape: one transaction, functions only when none accepts the Project filter.
    assert.match(statements, /\bBEGIN;/);
    assert.match(statements, /\bCOMMIT;/);
    for (const rpc of ["hybrid_match_data_index", "graph_search"]) assert.ok(statements.includes(rpc), rpc);
    assert.match(statements, /ARRAY\['alerts', 'meetings', 'emails'/, "match_<table> is created for the alerts and the content tools' tables");
    assert.match(statements, /'match_' \|\| t/);
    assert.match(statements, /project_id_filter/);
    assert.match(statements, /filter_project_id/);
    // Tables of the Lab dataset are server-only: RLS on and no browser role.
    assert.match(statements, /ENABLE ROW LEVEL SECURITY/);
    assert.match(statements, /REVOKE ALL ON public\.%I FROM PUBLIC, anon, authenticated/);
    assert.match(statements, /lab_dataset_runs/);
  });

  test("lab dataset copy: nothing but the Lab dataset routes can reach the copy or a Company DB through it", () => {
    const sources = fs.readdirSync(new URL("../src/", import.meta.url), { recursive: true }).filter((name) => String(name).endsWith(".js"));
    const importers = sources.filter((name) => /from\s+["'][./]*(?:\.\/)?labDatasetCopy\.js["']/.test(fs.readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8")));
    assert.deepEqual(importers, ["server.js"], "only the server's Lab dataset routes import the copy");
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const usage = [...server.matchAll(/\b(startLabCopy|stepLabCopy|listSourceProjects)\(/g)].map((match) => match[1]);
    assert.equal(usage.length, 3);
    assert.ok(server.indexOf("startLabCopy(") > server.indexOf("async function handleLabDatasetLoad"), "used only inside the Lab dataset handler");
    // The module reads a Company DB with one function, and it can only GET.
    const copy = fs.readFileSync(new URL("../src/labDatasetCopy.js", import.meta.url), "utf8");
    const reader = copy.slice(copy.indexOf("function createCompanyReader"), copy.indexOf("const isMissingTable"));
    assert.equal([...reader.matchAll(/fetchImpl\(/g)].length, 1, "one request site for the Company DB");
    assert.match(reader, /method: "GET"/);
    assert.doesNotMatch(reader, /method: "(POST|PUT|PATCH|DELETE)"/);
    // And Meta is read with GET only.
    assert.doesNotMatch(copy.slice(copy.indexOf("async function metaGet"), copy.indexOf("// The Projects a Superadmin can copy from")), /method: "(POST|PUT|PATCH|DELETE)"/);
  });

  test("lab dataset copy: copied rows are re-stamped with the Lab Project, and a source that is not a template row loses nothing it needs", () => {
    const entry = LAB_COPY_TABLES.find((candidate) => candidate.key === "data_index");
    const out = restampRow(entry, { id: 1, project_id: JFROG, metadata: { project_id: JFROG, other: JFROG, projectId: JFROG.toUpperCase() }, index_text: "x", embedding, extra_unknown_column: 1 }, JFROG);
    assert.equal(out.project_id, LAB_PROJECT_ID);
    assert.deepEqual(out.metadata, { project_id: LAB_PROJECT_ID, other: JFROG, projectId: LAB_PROJECT_ID }, "only Project id keys of the metadata are re-stamped");
    assert.equal(out.extra_unknown_column, undefined, "a column the Lab table lacks is dropped");
    assert.equal(out.embedding, embedding);
    const emails = restampRow(LAB_COPY_TABLES.find((candidate) => candidate.key === "emails"), { id: 2, project_id: JFROG, embedding, subject: "s" }, JFROG);
    assert.equal(emails.embedding, undefined);
    const project = labProjectRow("גי פרוג", { alerts_table_name: "x", gantt_tasks_table_name: "y", keep: 1 });
    assert.deepEqual(project, { id: LAB_PROJECT_ID, name: "Lab · גי פרוג", settings: { keep: 1 }, is_active: true });
    const summary = summarizeRun({ id: "r", status: "running", row_cap: 5, progress: { tables: { data_index: { status: "running", copied: 3, total: 10, purged: true } } } });
    assert.equal(summary.rowsCopied, 3);
    assert.equal(summary.currentTable.key, "data_index");
  });

  test("lab dataset copy: the Lab screen has the load action wired to the Lab dataset routes", () => {
    const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
    const js = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(html, /id="labDatasetDialog"/);
    for (const id of ["labDatasetProject", "labDatasetFrom", "labDatasetTo", "labDatasetCap", "labDatasetStart", "labDatasetBar", "labDatasetTables"]) assert.match(html, new RegExp(`id="${id}"`), id);
    assert.ok((html.match(/data-lab-load/g) || []).length >= 10, "every empty-state notice and the sidebar open the dialog");
    assert.match(html, /טען מערך בדיקה/);
    assert.match(js, /\/api\/lab\/dataset\/projects/);
    assert.match(js, /\/api\/lab\/dataset\/load/);
    assert.match(js, /\/api\/lab\/dataset\/runs\/\$\{encodeURIComponent\(run\.id\)\}\/step/);
    assert.match(js, /safeInitStep\("lab dataset", wireLabDataset\)/);
    // The browser never names a Company DB or a key.
    const block = js.slice(js.indexOf("// ── Lab action: load test dataset"), js.indexOf("function activateTab"));
    assert.doesNotMatch(block, /x-content-supabase|supabaseUrl|serviceRole/i);
  });
}
