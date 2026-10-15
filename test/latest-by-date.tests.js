import assert from "node:assert/strict";
import { bodyOf, fakeReq, fakeRes, installFakeFetch, jsonResponse } from "./support/handler-harness.js";
import { addDaysIso, detectRecencyIntent, formatDisplayDate, parseLeadingDate, todayIsoIn } from "../src/recency.js";
import {
  buildRecentItemsAnswer,
  clearRecentItemsSchemaHints,
  missingColumnOf,
  recentItemsRouteAllowed,
  runRecentItems,
  summarizeRecentItems
} from "../src/subagents/recentItems.js";
import { buildCompactRunTrace } from "../src/runTrace.js";

// "Latest / recent" questions answer by date (ticket 08). The newest items of the asked kind are read from
// the Project's own Company DB, ordered by that kind's own date column, instead of a vector match returning
// the items closest in meaning (which put a 30.03.2026 email first when the newest was from 19.07.2026).

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const KAPAIM_PROJECT = "33333333-3333-4333-8333-333333333333";
const COMPANY_A = "https://company-a.supabase.test";
const COMPANY_B = "https://company-b.supabase.test";
const KAPAIM = "https://kapaim.supabase.test";
const APP_DB = "https://app-db.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";
// A fixed "today" so the windows are reproducible.
const NOW = new Date("2026-10-15T09:00:00Z");
const TODAY = "2026-10-15";

const TEST_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  SUPABASE_URL: APP_DB,
  SUPABASE_SERVICE_ROLE_KEY: "app-db-key",
  OPENROUTER_API_KEY: "sk-or-test-key",
  META_SUPABASE_URL: undefined,
  META_SUPABASE_SERVICE_ROLE_KEY: undefined
};

// ── a tiny PostgREST stand-in for one Company DB ─────────────────────────────
// Rejects a column the table does not have (42703), a table it does not have (PGRST205), honours
// project_id / date / not.is.null / in filters, order and limit, like the real REST API.

function companyDb({ origin, tables, missingTables = [], rpc = () => null }) {
  const project = (row) => row.project_id;
  return (call) => {
    if (call.origin !== origin) return null;
    const url = new URL(call.url);
    if (!url.pathname.startsWith("/rest/v1/")) return null;
    const name = url.pathname.slice("/rest/v1/".length);
    if (name.startsWith("rpc/")) return rpc(name.slice(4), call);
    if (missingTables.includes(name)) {
      return jsonResponse({ code: "PGRST205", message: `Could not find the table 'public.${name}' in the schema cache` }, 404);
    }
    const table = tables[name];
    if (!table) return null;
    const columnError = (column) => jsonResponse({ code: "42703", message: `column ${name}.${column} does not exist` }, 400);
    const select = (url.searchParams.get("select") || "*").split(",").map((item) => item.trim());
    for (const column of select) if (column !== "*" && !table.columns.includes(column)) return columnError(column);
    let rows = [...table.rows];
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit"].includes(key)) continue;
      if (!table.columns.includes(key)) return columnError(key);
      rows = rows.filter((row) => {
        const cell = row[key];
        if (value.startsWith("eq.")) return String(cell) === value.slice(3);
        if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(String(cell));
        if (value === "not.is.null") return cell !== null && cell !== undefined;
        if (value.startsWith("gte.")) return cell != null && String(cell) >= value.slice(4);
        if (value.startsWith("lt.")) return cell != null && String(cell) < value.slice(3);
        return true;
      });
    }
    const order = url.searchParams.get("order");
    if (order) {
      const [column, direction] = order.split(".");
      if (!table.columns.includes(column)) return columnError(column);
      rows.sort((a, b) => {
        if (a[column] == null) return 1;
        if (b[column] == null) return -1;
        return (a[column] > b[column] ? 1 : -1) * (direction === "desc" ? -1 : 1);
      });
    }
    const limit = Number(url.searchParams.get("limit"));
    if (limit > 0) rows = rows.slice(0, limit);
    const columns = select.includes("*") ? table.columns : select;
    return jsonResponse(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))));
  };
}

// Four rows of Project A whose id order differs from their date order (the newest has id 2), plus a newer
// row of Project B that must never be returned.
const DATES = { 1: "2026-03-30T08:00:00+00:00", 2: "2026-07-19T08:00:00+00:00", 3: "2026-05-02T08:00:00+00:00", 4: "2026-06-10T08:00:00+00:00" };
const NEWEST_FIRST = ["2026-07-19", "2026-06-10", "2026-05-02", "2026-03-30"];

function tableRows(dateColumn, fields, { extraDateColumns = {} } = {}) {
  const make = (id, projectId, date) => ({ id, project_id: projectId, created_at: "2026-10-01T00:00:00+00:00", ...(dateColumn ? { [dateColumn]: date } : {}), ...extraDateColumns, ...fields(id, projectId) });
  return [
    ...[1, 2, 3, 4].map((id) => make(id, PROJECT_A, DATES[id])),
    make(5, PROJECT_B, "2026-09-01T08:00:00+00:00")
  ];
}

function table(dateColumn, fields, options = {}) {
  const rows = tableRows(dateColumn, fields, options);
  return { columns: Object.keys(rows[0]), rows };
}

const label = (prefix) => (id, projectId) => ({ [prefix]: projectId === PROJECT_B ? `OTHER-PROJECT ${prefix} ${id}` : `${prefix} ${id}` });

// The 006 Company DB template: the date column names of the ticket.
function templateTables() {
  return {
    emails: table("received_date", (id, projectId) => ({ subject: projectId === PROJECT_B ? "OTHER-PROJECT email" : `Email ${id}`, sender_name: `Sender ${id}`, summary: `Email summary ${id}`, mail_id: `m${id}`, relevance_status: "project_related" })),
    meetings: table("meeting_date", (id, projectId) => ({ subject: projectId === PROJECT_B ? "OTHER-PROJECT meeting" : `Meeting ${id}`, summary: `Meeting summary ${id}`, decisions_made: id % 2 ? `Decision ${id}` : null })),
    alerts: table("data_date", (id, projectId) => ({ alert_type: projectId === PROJECT_B ? "OTHER-PROJECT alert" : `Alert ${id}`, summary: `Alert summary ${id}`, data_link: `https://files.test/alert-${id}` })),
    safety_reports: table("report_date", (id, projectId) => ({ site_location: projectId === PROJECT_B ? "OTHER-PROJECT site" : `Site ${id}`, risk_level: "medium", summary: `Safety summary ${id}` })),
    quality_control: table("inspection_date", label("defect_title")),
    consultants_reports: table("report_date", label("report_topic")),
    exceptions_report: table("exception_date", label("exception_subject")),
    financial_transactions: table("transaction_date", (id, projectId) => ({ topic: projectId === PROJECT_B ? "OTHER-PROJECT invoice" : `Invoice ${id}`, vendor_name: `Vendor ${id}` })),
    whatsapp_conversations: table("conversation_start", () => ({})),
    whatsapp_analysis: {
      columns: ["id", "project_id", "conversation_id", "summary", "item_status", "hashtags", "tasks_json"],
      rows: [1, 2, 3, 4, 5].map((id) => ({ id: 100 + id, project_id: id === 5 ? PROJECT_B : PROJECT_A, conversation_id: id, summary: id === 5 ? "OTHER-PROJECT chat" : `Chat summary ${id}`, item_status: null, hashtags: null, tasks_json: null }))
    }
  };
}

// Kapaim's older shape: no received_date on emails (received_at), meetings dated `date`, alerts in
// alerts_embeddings_gf, safety reports with no date of their own (created_at only).
function legacyTables() {
  const tables = templateTables();
  tables.emails = table("received_at", (id, projectId) => ({ subject: projectId === PROJECT_B ? "OTHER-PROJECT email" : `Email ${id}`, sender_name: `Sender ${id}`, summary: `Email summary ${id}`, mail_id: `m${id}` }));
  tables.meetings = table("date", (id, projectId) => ({ subject: projectId === PROJECT_B ? "OTHER-PROJECT meeting" : `Meeting ${id}`, summary: `Meeting summary ${id}`, decisions_made: id % 2 ? `Decision ${id}` : null }));
  tables.alerts_embeddings_gf = tables.alerts;
  delete tables.alerts;
  const created = [1, 2, 3, 4, 5].map((id) => ({ id, project_id: id === 5 ? PROJECT_B : PROJECT_A, created_at: DATES[id] || "2026-09-01T08:00:00+00:00", site_location: id === 5 ? "OTHER-PROJECT site" : `Site ${id}`, risk_level: "high", summary: `Safety summary ${id}` }));
  tables.safety_reports = { columns: Object.keys(created[0]), rows: created };
  return tables;
}

function recencyFor(message) {
  const recency = detectRecencyIntent(message, { now: NOW });
  assert.ok(recency, `expected a recency intent for: ${message}`);
  return recency;
}

function projectConfig({ origin = COMPANY_A, projectId = PROJECT_A, alertsTable = "alerts" } = {}) {
  return {
    requestMode: "project",
    projectId,
    openRouterApiKey: "sk-or-test-key",
    models: { embedding: "text-embedding-3-large", reranker: "test/reranker", lite: "test/lite", main: "test/main" },
    contentSource: { supabaseUrl: origin, supabaseServiceRoleKey: "company-key", alertsTable }
  };
}

async function withNetwork(route, fn) {
  clearRecentItemsSchemaHints();
  const fake = installFakeFetch(route);
  try {
    return await fn(fake.calls);
  } finally {
    fake.restore();
    clearRecentItemsSchemaHints();
  }
}

const companyCalls = (calls, origin) => calls.filter((call) => call.origin === origin);

// ── handler harness (the real HTTP handler under a fake network) ──────────────

let serverModule = null;
let savedEnv = null;

function companyHeaders({ url = COMPANY_A, key = "company-a-key", projectId = PROJECT_A, extra = {} } = {}) {
  return {
    host: "main-agent.test",
    "content-type": "application/json",
    "x-bidoc-api-secret": BIDOC_SECRET,
    "x-content-supabase-url": url,
    "x-content-supabase-key": key,
    "x-project-id": projectId,
    ...extra
  };
}

async function withServer(route, fn) {
  if (!savedEnv) {
    savedEnv = {};
    for (const [key, value] of Object.entries(TEST_ENV)) {
      savedEnv[key] = process.env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  clearRecentItemsSchemaHints();
  const fake = installFakeFetch(route);
  try {
    serverModule ||= await import("../src/server.js");
    return await fn({ handler: serverModule.default, calls: fake.calls });
  } finally {
    fake.restore();
    clearRecentItemsSchemaHints();
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

async function chat(handler, { headers = companyHeaders(), projectId = PROJECT_A, message }) {
  const res = fakeRes();
  await handler(fakeReq({ url: "/api/chat", headers, body: { message, sessionId: `bidoc:${projectId}:s-latest`, projectId } }), res);
  return { status: res.statusCode, body: bodyOf(res) };
}

const isTopicRank = (call) => call.origin === "https://openrouter.ai" && /relevant they are to a TOPIC/.test(String(call.body?.messages?.[0]?.content || ""));

export function registerLatestByDateTests(test) {
  // ── detection ──────────────────────────────────────────────────────────────

  test("latest by date: every recency phrasing of the ticket is detected (Hebrew and English)", () => {
    const cases = [
      ["מה המיילים האחרונים?", { kinds: ["emails"], window: null }],
      ["מה סוכם בישיבות האחרונות?", { kinds: ["meetings"], window: null }],
      ["מה ההתראות האחרונות?", { kinds: ["alerts"], window: null }],
      ["מה היה בוואטסאפ לאחרונה?", { kinds: ["whatsapp"], window: null }],
      ["מה המיילים החדשים?", { kinds: ["emails"], window: null }],
      ["מה ההחלטות החדשות?", { kinds: ["decisions"], window: null }],
      ["מה המיילים השבוע?", { kinds: ["emails"], window: { type: "this_week" } }],
      ["מה סוכם בישיבות החודש?", { kinds: ["meetings"], window: { type: "this_month", dateFrom: "2026-10-01", dateTo: TODAY } }],
      ["what are the latest emails?", { kinds: ["emails"], window: null }],
      ["show me recent alerts", { kinds: ["alerts"], window: null }],
      ["newest meetings please", { kinds: ["meetings"], window: null }],
      ["any new emails?", { kinds: ["emails"], window: null }]
    ];
    for (const [message, expected] of cases) {
      const intent = recencyFor(message);
      assert.deepEqual(intent.kinds, expected.kinds, message);
      if (expected.window === null) assert.equal(intent.window, null, message);
      else for (const [key, value] of Object.entries(expected.window)) assert.equal(intent.window[key], value, `${message} ${key}`);
      assert.equal(intent.singular, false, message);
      assert.equal(intent.limit, 10, message);
    }
  });

  test("latest by date: 'since <date>' and 'in the last N days' name a date window", () => {
    const since = (message) => recencyFor(message).window;
    assert.deepEqual(
      { ...since("emails since 1 June"), days: undefined },
      { type: "since", days: undefined, dateFrom: "2026-06-01", dateTo: TODAY }
    );
    assert.equal(since("מיילים מאז 1.6").dateFrom, "2026-06-01");
    assert.equal(since("מיילים מאז 01/06/2026").dateFrom, "2026-06-01");
    assert.equal(since("מה הישיבות החל מ־15 ביוני 2026?").dateFrom, "2026-06-15");
    assert.equal(since("alerts since June 3rd").dateFrom, "2026-06-03");
    assert.equal(since("alerts since yesterday").dateFrom, "2026-10-14");
    assert.equal(since("מה ההתראות מאז אתמול").dateFrom, "2026-10-14");
    // No year: the most recent such date, never the future.
    assert.equal(since("emails since 20 December").dateFrom, "2025-12-20");

    const last7 = since("emails in the last 7 days");
    assert.deepEqual([last7.type, last7.days, last7.dateFrom, last7.dateTo], ["last_days", 7, "2026-10-08", TODAY]);
    assert.equal(since("meetings in the last 14 days").dateFrom, "2026-10-01");
    assert.equal(since("ב-30 הימים האחרונים מה הישיבות?").dateFrom, "2026-09-15");
    assert.equal(since("מה המיילים ב־7 הימים האחרונים?").days, 7);
    assert.equal(since("what emails came in the past 2 weeks").days, 14);
    assert.equal(since("מה המיילים בשבוע האחרון?").days, 7);
    assert.equal(since("המיילים בחודש האחרון").days, 30);
    assert.equal(since("alerts today").dateFrom, TODAY);
    assert.equal(since("מה המיילים אתמול?").dateTo, "2026-10-14");
  });

  test("latest by date: a topic, an item count and a single item are told apart", () => {
    const withTopic = recencyFor("מה המיילים האחרונים בנושא איטום?");
    assert.equal(withTopic.topic, "איטום");
    assert.equal(recencyFor("show recent emails about waterproofing").topic, "waterproofing");
    assert.equal(recencyFor("מה סוכם בישיבות האחרונות?").topic, "", "generic words are not a topic");
    assert.equal(recencyFor("what are the latest emails?").topic, "");
    const windowed = recencyFor("מה המיילים בשבוע האחרון בנושא חשמל?");
    assert.equal(windowed.topic, "חשמל");
    assert.equal(windowed.window.days, 7);

    assert.equal(recencyFor("5 המיילים האחרונים").limit, 5);
    assert.equal(recencyFor("last 3 meetings").limit, 3);
    assert.equal(recencyFor("show the latest 100 emails").limit, 25, "bounded");

    const single = recencyFor("מה המייל האחרון?");
    assert.deepEqual([single.singular, single.limit], [true, 1]);
    assert.equal(recencyFor("what is the latest email").singular, true);
    // One record plus a subject is a lookup with evidence, not a list of recent items.
    assert.equal(detectRecencyIntent("מה הישיבה האחרונה בנושא מעליות?", { now: NOW }), null);
    assert.deepEqual(recencyFor("מה קרה במיילים וישיבות לאחרונה?").kinds, ["emails", "meetings"]);
  });

  test("latest by date: questions that are not recency questions are not caught", () => {
    const notRecency = [
      "כמה מיילים התקבלו בשבוע האחרון?",            // a count: the exact metrics route
      "how many emails this week",
      "what is the total number of alerts in the last 7 days",
      "מה אישר המייל הראשון?",                       // the first, not the newest
      "show me the first emails",
      "מה הגרסה האחרונה של התוכנית?",                // a cue with no kind of item
      "what was the last thing the contractor said about the schedule",
      "מה לוח הזמנים החדש?",
      "מה החלטת הישיבה בתאריך 3 ביוני?",              // an explicit date alone is not a recency cue
      "מה המיילים של איטום?",
      "emails from John about the elevators",         // "from" is a sender, not "since"
      "what is the status of the elevator submittal?",
      "emails last year",
      "מי האחראי על האיטום?",
      "שלום",
      "hello, how are you",
      ""
    ];
    for (const message of notRecency) {
      assert.equal(detectRecencyIntent(message, { now: NOW }), null, message || "(empty)");
    }
    assert.equal(detectRecencyIntent(null), null);
    assert.equal(detectRecencyIntent("x".repeat(1000) + " latest emails", { now: NOW }), null, "very long text is not a recency question");
  });

  test("latest by date: date helpers", () => {
    assert.equal(formatDisplayDate("2026-07-19T08:00:00+00:00"), "19.07.2026");
    assert.equal(formatDisplayDate(null), null);
    assert.equal(addDaysIso("2026-03-01", -1), "2026-02-28");
    assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
    assert.equal(todayIsoIn("Asia/Jerusalem", new Date("2026-10-14T22:30:00Z")), "2026-10-15", "the project time zone decides the day");
    assert.equal(parseLeadingDate("31.02.2026", TODAY), null, "not a real date");
    assert.equal(parseLeadingDate("1 ביוני 2026 לערך", TODAY), "2026-06-01");
    assert.equal(missingColumnOf({ message: "column emails.received_at does not exist" }), "received_at");
    assert.equal(missingColumnOf({ message: "Could not find the 'mail_id' column of 'emails' in the schema cache" }), "mail_id");
    assert.equal(missingColumnOf({ message: "permission denied" }), null);
  });

  test("latest by date: the exact Data Query keeps what it supports; deliberate refusals are not overridden", () => {
    assert.equal(recentItemsRouteAllowed(null), true);
    assert.equal(recentItemsRouteAllowed({ supported: false, warning: "email_unapproved_lookup_route_elsewhere" }), true);
    assert.equal(recentItemsRouteAllowed({ supported: false, warning: "alert_unapproved_lookup_not_computable" }), true);
    assert.equal(recentItemsRouteAllowed({ supported: false, warning: "structured_lookup_not_available" }), true);
    assert.equal(recentItemsRouteAllowed({ supported: true, intent: "lookup" }), false, "an exact lookup already orders by the table's date");
    assert.equal(recentItemsRouteAllowed({ supported: false, warning: "email_ingestion_time_not_computable" }), false);
    assert.equal(recentItemsRouteAllowed({ supported: false, warning: "email_pii_metric_not_computable" }), false);
    assert.equal(recentItemsRouteAllowed({ supported: false, warning: "consultant_identity_field_not_queryable" }), false);
  });

  // ── per-kind date-ordered reads, both schema shapes ────────────────────────

  const KIND_CASES = [
    { kind: "emails", message: "מה המיילים האחרונים?", template: { table: "emails", dateColumn: "received_date" }, legacy: { table: "emails", dateColumn: "received_at" }, titles: (id) => `Email ${id}` },
    { kind: "meetings", message: "מה סוכם בישיבות האחרונות?", template: { table: "meetings", dateColumn: "meeting_date" }, legacy: { table: "meetings", dateColumn: "date" }, titles: (id) => `Meeting ${id}` },
    { kind: "alerts", message: "מה ההתראות האחרונות?", template: { table: "alerts", dateColumn: "data_date" }, legacy: { table: "alerts_embeddings_gf", dateColumn: "data_date" }, titles: (id) => `Alert ${id}`, alertsTable: { template: "alerts", legacy: "alerts_embeddings_gf" } },
    { kind: "safety", message: "מה דוחות הבטיחות האחרונים?", template: { table: "safety_reports", dateColumn: "report_date" }, legacy: { table: "safety_reports", dateColumn: "created_at", ingestion: true }, titles: (id) => `Site ${id}` },
    { kind: "quality", message: "מה ממצאי בקרת האיכות האחרונים?", template: { table: "quality_control", dateColumn: "inspection_date" }, legacy: { table: "quality_control", dateColumn: "inspection_date" }, titles: (id) => `defect_title ${id}` },
    { kind: "consultants", message: "מה דוחות היועצים האחרונים?", template: { table: "consultants_reports", dateColumn: "report_date" }, legacy: { table: "consultants_reports", dateColumn: "report_date" }, titles: (id) => `report_topic ${id}` },
    { kind: "exceptions", message: "מה החריגים האחרונים?", template: { table: "exceptions_report", dateColumn: "exception_date" }, legacy: { table: "exceptions_report", dateColumn: "exception_date" }, titles: (id) => `exception_subject ${id}` },
    { kind: "financial", message: "מה החשבוניות האחרונות?", template: { table: "financial_transactions", dateColumn: "transaction_date" }, legacy: { table: "financial_transactions", dateColumn: "transaction_date" }, titles: (id) => `Invoice ${id}` },
    { kind: "decisions", message: "מה ההחלטות האחרונות?", template: { table: "meetings", dateColumn: "meeting_date" }, legacy: { table: "meetings", dateColumn: "date" }, titles: (id) => `Meeting ${id}`, only: [1, 3], oneNewestFirst: ["2026-05-02", "2026-03-30"] },
    { kind: "whatsapp", message: "מה היה בוואטסאפ לאחרונה?", template: { table: "whatsapp_conversations", dateColumn: "conversation_start" }, legacy: { table: "whatsapp_conversations", dateColumn: "conversation_start" }, titles: (id) => `Chat summary ${id}` }
  ];

  for (const shape of ["template", "legacy"]) {
    test(`latest by date: every kind reads the newest items by its own date column (${shape} schema)`, async () => {
      for (const spec of KIND_CASES) {
        const tables = shape === "template" ? templateTables() : legacyTables();
        const expected = spec[shape];
        const config = projectConfig({ alertsTable: spec.alertsTable?.[shape] || "alerts" });
        await withNetwork(companyDb({ origin: COMPANY_A, tables }), async (calls) => {
          const result = await runRecentItems({ config, recency: recencyFor(spec.message), hebrew: true });
          assert.equal(result.ok, true, `${spec.kind}: ${JSON.stringify(result.errors)}`);
          const [section] = result.sections;
          assert.equal(section.kind, spec.kind);
          assert.equal(section.table, expected.table, `${spec.kind}: table`);
          assert.equal(section.dateColumn, expected.dateColumn, `${spec.kind}: date column (${shape})`);
          assert.equal(section.ingestionDate, Boolean(expected.ingestion), `${spec.kind}: ingestion-date fallback is flagged`);
          assert.deepEqual(section.items.map((item) => item.date), spec.oneNewestFirst || NEWEST_FIRST, `${spec.kind}: newest first by its own date`);
          // The newest item is not the first row by id or by insertion: it comes from the ORDER BY.
          const newestId = (spec.only ? [3] : [2])[0];
          assert.equal(section.items[0].title, spec.titles(spec.only ? 3 : newestId), `${spec.kind}: newest item first`);
          assert.ok(section.items.every((item) => !String(item.title).includes("OTHER-PROJECT")), `${spec.kind}: Project B's newer row is never returned`);

          // Every request: Project A's Company DB only, GET only, filtered by project_id, ordered by the date column.
          assert.ok(calls.length > 0);
          for (const call of calls) {
            assert.equal(call.origin, COMPANY_A, `${spec.kind}: only the Project's Company DB (${call.url})`);
            assert.equal(call.method, "GET", `${spec.kind}: reads only (${call.url})`);
          }
          const reads = calls.filter((call) => call.url.includes(`/rest/v1/${expected.table}?`) || (spec.kind === "whatsapp" && call.url.includes("/rest/v1/whatsapp_analysis?")));
          assert.ok(reads.length > 0);
          for (const read of reads) assert.match(read.url, new RegExp(`project_id=eq\\.${PROJECT_A}`), `${spec.kind}: project filter on ${read.url}`);
          const ordered = calls.find((call) => call.url.includes(`order=${expected.dateColumn}.desc`));
          assert.ok(ordered, `${spec.kind}: ordered by ${expected.dateColumn} desc`);
          assert.equal(calls.some((call) => /\/rpc\//.test(call.url)), false, `${spec.kind}: no vector RPC`);
          assert.equal(calls.some((call) => call.url.includes("/embeddings")), false, `${spec.kind}: no embedding call without a topic`);
        });
      }
    });
  }

  test("latest by date: the schema hint is remembered, so a legacy table is not probed again", async () => {
    const config = projectConfig();
    await withNetwork(companyDb({ origin: COMPANY_A, tables: legacyTables() }), async (calls) => {
      await runRecentItems({ config, recency: recencyFor("מה המיילים האחרונים?"), hebrew: true });
      const firstRun = calls.length;
      assert.ok(firstRun > 1, "the first read probes the date column candidates and drops absent columns");
      const again = calls.length;
      await runRecentItems({ config, recency: recencyFor("מה המיילים האחרונים?"), hebrew: true });
      assert.equal(calls.length - again, 1, "the second read is a single request");
    });
  });

  test("latest by date: a table with no project_id is never read unfiltered", async () => {
    const tables = templateTables();
    tables.emails = { columns: ["id", "received_date", "subject"], rows: [{ id: 1, received_date: "2026-07-19T08:00:00+00:00", subject: "no project column" }] };
    await withNetwork(companyDb({ origin: COMPANY_A, tables }), async (calls) => {
      const result = await runRecentItems({ config: projectConfig(), recency: recencyFor("מה המיילים האחרונים?"), hebrew: true });
      assert.equal(result.ok, false);
      assert.equal(result.sections.length, 0);
      assert.ok(calls.every((call) => /project_id=eq\./.test(call.url)), "every attempt carried the project filter");
    });
  });

  test("latest by date: 'since <date>' and 'last N days' read only that window, and an empty window says how far back the data goes", async () => {
    const config = projectConfig();
    await withNetwork(companyDb({ origin: COMPANY_A, tables: templateTables() }), async (calls) => {
      const result = await runRecentItems({ config, recency: recencyFor("מיילים מאז 1.6"), hebrew: true });
      const [section] = result.sections;
      assert.deepEqual(section.items.map((item) => item.date), ["2026-07-19", "2026-06-10"]);
      assert.deepEqual(section.window, { from: "2026-06-01", to: TODAY });
      const read = calls.find((call) => call.url.includes("/rest/v1/emails?"));
      assert.match(read.url, /received_date=gte\.2026-06-01/);
      assert.match(read.url, /received_date=lt\.2026-10-16/, "the end day is included");
    });
    await withNetwork(companyDb({ origin: COMPANY_A, tables: templateTables() }), async () => {
      const result = await runRecentItems({ config, recency: recencyFor("what emails came in the last 7 days"), hebrew: false });
      const [section] = result.sections;
      assert.equal(section.items.length, 0);
      assert.equal(section.newestAny, "2026-07-19", "the newest item overall is looked up");
      const hebrew = buildRecentItemsAnswer({ result, recency: recencyFor("מה המיילים ב־7 הימים האחרונים?"), hebrew: true });
      assert.match(hebrew, /לא נמצאו מיילים בטווח 08\.10\.2026–15\.10\.2026/);
      assert.match(hebrew, /19\.07\.2026/);
      const english = buildRecentItemsAnswer({ result, recency: recencyFor("what emails came in the last 7 days"), hebrew: false });
      assert.match(english, /No emails were found from 08\.10\.2026 to 15\.10\.2026/);
    });
  });

  // ── topic + recency ────────────────────────────────────────────────────────

  test("latest by date: a topic ranks by meaning inside the recent window only", async () => {
    const tables = templateTables();
    const config = projectConfig();
    const rank = (call) => {
      if (!isTopicRank(call)) return null;
      const candidates = JSON.parse(call.body.messages[1].content).candidates;
      // The model finds the waterproofing email: rank it first, give the rest no relevance.
      const index = candidates.findIndex((candidate) => /Email 3/.test(candidate.text));
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify({ ranked: [{ index, relevance: 92, reason: "about waterproofing" }, ...candidates.map((_, i) => ({ index: i, relevance: 5, reason: "unrelated" })).filter((entry) => entry.index !== index)] }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      });
    };
    await withNetwork((call) => companyDb({ origin: COMPANY_A, tables })(call) || rank(call), async (calls) => {
      const result = await runRecentItems({ config, recency: recencyFor("מה המיילים מאז 1.5 בנושא איטום?"), hebrew: true });
      const [section] = result.sections;
      assert.equal(section.topic, "איטום");
      assert.deepEqual(section.items.map((item) => item.title), ["Email 3"], "only the relevant item of the window, ranked by meaning");
      assert.equal(section.ranking.method, "llm_rerank");
      assert.equal(section.scanned, 3, "the window (since 1 May) holds three emails; the March email is outside it");
      const ranking = calls.find(isTopicRank);
      const candidates = JSON.parse(ranking.body.messages[1].content).candidates;
      assert.equal(candidates.length, 3);
      assert.ok(candidates.every((candidate) => !/Email 1\b|OTHER-PROJECT/.test(candidate.text)), "nothing outside the window or the Project reaches the ranker");
      assert.equal(calls.some((call) => /\/rpc\/match_emails/.test(call.url)), false, "no vector search over the whole table");
      assert.ok(calls.filter((call) => call.origin === COMPANY_A).every((call) => call.method === "GET"));
      const answer = buildRecentItemsAnswer({ result, recency: recencyFor("מה המיילים מאז 1.5 בנושא איטום?"), hebrew: true });
      assert.match(answer, /ממוינים לפי הקשר לנושא "איטום" בתוך חלון זה/);
      assert.match(answer, /מתוך 3 הפריטים החדשים ביותר בחלון/);
    });
  });

  test("latest by date: without a model the topic falls back to keyword ranking, still inside the window", async () => {
    const tables = templateTables();
    tables.emails.rows.find((row) => row.id === 4).subject = "איטום הגג";
    const config = { ...projectConfig(), openRouterApiKey: "" };
    await withNetwork(companyDb({ origin: COMPANY_A, tables }), async () => {
      const result = await runRecentItems({ config, recency: recencyFor("מה המיילים האחרונים בנושא איטום?"), hebrew: true });
      const [section] = result.sections;
      assert.deepEqual(section.items.map((item) => item.title), ["איטום הגג"]);
      assert.equal(section.ranking.method, "keyword");
    });
  });

  // ── the answer ─────────────────────────────────────────────────────────────

  test("latest by date: the answer states the date window it covered", async () => {
    await withNetwork(companyDb({ origin: COMPANY_A, tables: templateTables() }), async () => {
      const latest = recencyFor("מה המיילים האחרונים?");
      const result = await runRecentItems({ config: projectConfig(), recency: latest, hebrew: true });
      const answer = buildRecentItemsAnswer({ result, recency: latest, hebrew: true });
      const lines = answer.split("\n");
      assert.match(lines[0], /^\*\*המיילים האחרונים — מ־30\.03\.2026 עד 19\.07\.2026\*\*/, "the covered span is in the heading");
      assert.match(lines[0], /4 פריטים, מהחדש לישן, לפי תאריך קבלה/);
      assert.match(lines[1], /^- \*\*19\.07\.2026\*\* · Email 2/, "newest first");
      assert.equal(lines.filter((line) => line.startsWith("- ")).length, 4);
      assert.match(answer, /הפריט האחרון במאגר הפרויקט הוא מ־19\.07\.2026 \(לפני 88 ימים\)/, "a stale newest item is called out");

      const english = buildRecentItemsAnswer({ result: await runRecentItems({ config: projectConfig(), recency: recencyFor("what are the latest emails?"), hebrew: false }), recency: recencyFor("what are the latest emails?"), hebrew: false });
      assert.match(english.split("\n")[0], /^\*\*Latest emails — 30\.03\.2026 to 19\.07\.2026\*\* \(4 items, newest first, by received date\)/);

      const windowed = recencyFor("מיילים מאז 1.6");
      const windowedAnswer = buildRecentItemsAnswer({ result: await runRecentItems({ config: projectConfig(), recency: windowed, hebrew: true }), recency: windowed, hebrew: true });
      assert.match(windowedAnswer.split("\n")[0], /^\*\*המיילים מ־01\.06\.2026 עד 15\.10\.2026\*\*/, "an explicit window states the requested range");
    });
  });

  test("latest by date: a single latest item reads naturally in Hebrew and English", async () => {
    await withNetwork(companyDb({ origin: COMPANY_A, tables: templateTables() }), async () => {
      const hebrewIntent = recencyFor("מה המייל האחרון?");
      const hebrew = buildRecentItemsAnswer({ result: await runRecentItems({ config: projectConfig(), recency: hebrewIntent, hebrew: true }), recency: hebrewIntent, hebrew: true });
      assert.match(hebrew.split("\n")[0], /^\*\*המיילים האחרונים — 19\.07\.2026\*\* \(פריט אחד, מהחדש לישן, לפי תאריך קבלה\)/);
      assert.equal(hebrew.split("\n").filter((line) => line.startsWith("- ")).length, 1);
      const englishIntent = recencyFor("what is the latest alert");
      const english = buildRecentItemsAnswer({ result: await runRecentItems({ config: projectConfig(), recency: englishIntent, hebrew: false }), recency: englishIntent, hebrew: false });
      assert.match(english, /\*\*Latest alerts — 19\.07\.2026\*\* \(1 item, newest first, by alert date\)/);
      assert.match(english, /\[source\]\(https:\/\/files\.test\/alert-2\)/);
    });
  });

  test("latest by date: an ingestion-time fallback is flagged in the answer", async () => {
    await withNetwork(companyDb({ origin: COMPANY_A, tables: legacyTables() }), async () => {
      const intent = recencyFor("מה דוחות הבטיחות האחרונים?");
      const answer = buildRecentItemsAnswer({ result: await runRecentItems({ config: projectConfig(), recency: intent, hebrew: true }), recency: intent, hebrew: true });
      assert.match(answer, /תאריך המסמך עצמו אינו זמין בנתונים; המיון לפי מועד הקליטה במערכת/);
    });
  });

  test("latest by date: several kinds in one question each get their own window", async () => {
    await withNetwork(companyDb({ origin: COMPANY_A, tables: templateTables() }), async () => {
      const intent = recencyFor("מה קרה במיילים ובישיבות לאחרונה?");
      const result = await runRecentItems({ config: projectConfig(), recency: intent, hebrew: true });
      assert.deepEqual(result.sections.map((section) => section.kind), ["emails", "meetings"]);
      const answer = buildRecentItemsAnswer({ result, recency: intent, hebrew: true });
      assert.match(answer, /\*\*המיילים האחרונים — /);
      assert.match(answer, /\*\*הישיבות האחרונות — /);
    });
  });

  test("latest by date: the run trace summary names the path, the order column and counts, never row text", async () => {
    await withNetwork(companyDb({ origin: COMPANY_A, tables: templateTables() }), async () => {
      const intent = recencyFor("מה המיילים האחרונים?");
      const result = await runRecentItems({ config: projectConfig(), recency: intent, hebrew: true });
      const summary = summarizeRecentItems({ result, recency: intent });
      assert.equal(summary.path, "date_ordered");
      assert.deepEqual(summary.sections[0], { kind: "emails", table: "emails", order_by: "received_date", scanned: 4, items: 4, newest: "2026-07-19", ranked_by_meaning: false, ranking_method: null });
      const trace = buildCompactRunTrace({ runId: "run-1", startedAt: Date.now() - 50, classification: { type: "RAG" }, agent: "main", recency: summary });
      assert.equal(trace.recency.path, "date_ordered");
      assert.equal(trace.recency.sections[0].order_by, "received_date");
      assert.equal(trace.recency.window.type, "latest");
      assert.equal(/Email \d|Sender/.test(JSON.stringify(trace)), false, "no row text in the trace");
      assert.equal("recency" in buildCompactRunTrace({ runId: "run-2", startedAt: Date.now(), classification: { type: "RAG" } }), false, "other runs are unchanged");
    });
  });

  // ── through the real handler: host recording and Kapaim ────────────────────

  test("latest by date: Kapaim 'latest emails' returns its newest emails first, from a Kapaim-shaped Company DB, with no schema change", async () => {
    // Kapaim's emails: the vector search (what used to answer) returns the 30.03 email first; the newest is 19.07.
    const kapaim = legacyTables();
    kapaim.emails = table("received_date", (id, projectId) => ({ subject: projectId === PROJECT_B ? "OTHER-PROJECT email" : `Kapaim email ${id}`, sender_name: `Sender ${id}`, summary: `summary ${id}`, mail_id: `m${id}`, relevance_status: "project_related" }));
    kapaim.emails.rows.forEach((row) => { row.project_id = row.project_id === PROJECT_B ? PROJECT_B : KAPAIM_PROJECT; });
    const rpc = (name) => name === "match_emails"
      ? jsonResponse([{ id: 1, content: "oldest", similarity: 0.9 }, { id: 3, content: "x", similarity: 0.5 }])
      : jsonResponse([]);
    await withServer(companyDb({ origin: KAPAIM, tables: kapaim, rpc }), async ({ handler, calls }) => {
      const headers = companyHeaders({ url: KAPAIM, key: "kapaim-key", projectId: KAPAIM_PROJECT, extra: { "x-alerts-table": "alerts_embeddings_gf" } });
      const result = await chat(handler, { headers, projectId: KAPAIM_PROJECT, message: "מה המיילים האחרונים?" });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 400));
      const answer = String(result.body.answer);
      const first = answer.indexOf("19.07.2026");
      assert.ok(first >= 0, `the newest email (19.07.2026) is in the answer:\n${answer}`);
      const bullets = answer.split("\n").filter((line) => line.startsWith("- "));
      assert.match(bullets[0], /19\.07\.2026/, "the answer leads with the newest email");
      assert.deepEqual(bullets.map((line) => line.match(/\d{2}\.\d{2}\.\d{4}/)[0]), ["19.07.2026", "10.06.2026", "02.05.2026", "30.03.2026"]);
      assert.match(answer.split("\n")[0], /מ־30\.03\.2026 עד 19\.07\.2026/, "the window is stated");

      // The run trace shows the date-ordered path; the vector route did not run.
      assert.equal(result.body.runTrace.recency.path, "date_ordered");
      assert.equal(result.body.runTrace.recency.sections[0].order_by, "received_date");
      assert.ok(result.body.runTrace.tools.some((tool) => tool.name === "recent_items" && tool.ok === true && tool.records === 4));
      const skipped = result.body.runTrace.tools.filter((tool) => ["hybrid_search", "graph_search", "reranker"].includes(tool.name));
      assert.ok(skipped.length === 3 && skipped.every((tool) => tool.skipped === true), "hybrid, graph and reranker are skipped");
      assert.ok(result.body.runTrace.steps.some((step) => step.id === "recent_items"));

      const seen = calls.filter((call) => call.origin === KAPAIM);
      assert.equal(seen.some((call) => /\/rpc\//.test(call.url)), false, "no match_emails / hybrid RPC");
      assert.deepEqual(seen.filter((call) => call.method !== "GET"), [], "Kapaim: reads only, no write and no schema change");
      assert.ok(seen.some((call) => call.url.includes("/rest/v1/emails?") && call.url.includes("order=received_date.desc")));
      assert.ok(seen.filter((call) => call.url.includes("/rest/v1/emails?")).every((call) => call.url.includes(`project_id=eq.${KAPAIM_PROJECT}`)));
    });
  });

  test("latest by date: a Project request reads only its own Company DB, GET only, and never MAIN", async () => {
    await withServer(companyDb({ origin: COMPANY_A, tables: templateTables(), missingTables: ["alerts_embeddings_gf"], rpc: () => jsonResponse([]) }), async ({ handler, calls }) => {
      const questions = ["מה המיילים האחרונים?", "מה סוכם בישיבות האחרונות?", "מה ההתראות האחרונות?", "show the latest emails since 1 June", "מה היה בוואטסאפ לאחרונה?"];
      for (const message of questions) {
        const start = calls.length;
        const result = await chat(handler, { message });
        assert.equal(result.status, 200, `${message}: ${JSON.stringify(result.body).slice(0, 300)}`);
        assert.equal(result.body.runTrace.recency?.path, "date_ordered", `${message}: date-ordered path`);
        const seen = calls.slice(start);
        for (const call of seen) {
          const isDb = call.origin.includes("supabase.test");
          if (!isDb) continue;
          assert.equal(call.origin, COMPANY_A, `${message}: only the Project's Company DB (${call.url})`);
          assert.equal(call.method, "GET", `${message}: GET only (${call.url})`);
        }
        assert.equal(seen.some((call) => call.origin === APP_DB), false, `${message}: MAIN is never contacted`);
        assert.equal(seen.some((call) => call.origin === COMPANY_B), false);
        assert.equal(seen.some((call) => /\/rpc\//.test(call.url)), false, `${message}: no search RPC`);
        assert.ok(String(result.body.answer).includes("**"), `${message}: the deterministic answer states its window:\n${result.body.answer}`);
      }
    });
  });

  test("latest by date: an alerts question the exact route used to refuse is answered by date on a 006 template DB", async () => {
    // The configured alerts table (Kapaim's alerts_embeddings_gf) does not exist here; the template's `alerts` does.
    await withServer(companyDb({ origin: COMPANY_A, tables: templateTables(), missingTables: ["alerts_embeddings_gf"] }), async ({ handler }) => {
      const result = await chat(handler, { message: "מה ההתראות האחרונות?" });
      assert.equal(result.status, 200);
      assert.match(result.body.answer, /^\*\*ההתראות האחרונות — מ־30\.03\.2026 עד 19\.07\.2026\*\*/);
      assert.match(result.body.answer, /- \*\*19\.07\.2026\*\* · Alert 2 — Alert summary 2 \[למקור\]\(https:\/\/files\.test\/alert-2\)/);
      assert.equal(result.body.runTrace.recency.sections[0].table, "alerts");
    });
  });

  test("latest by date: when no date-ordered read is possible the ordinary route still answers", async () => {
    const tables = templateTables();
    tables.emails = { columns: ["id", "project_id", "subject"], rows: [{ id: 1, project_id: PROJECT_A, subject: "no date at all" }] };
    await withServer(companyDb({ origin: COMPANY_A, tables }), async ({ handler }) => {
      const result = await chat(handler, { message: "מה המיילים האחרונים?" });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 300));
      assert.equal(result.body.runTrace.recency, undefined, "the date-ordered route did not answer");
      assert.ok(result.body.answer, "the ordinary route produced an answer");
    });
  });

  test("latest by date: questions that are not recency questions keep their ordinary route", async () => {
    await withServer(companyDb({ origin: COMPANY_A, tables: templateTables(), rpc: () => jsonResponse([]) }), async ({ handler, calls }) => {
      for (const message of ["מי האחראי על האיטום?", "כמה מיילים התקבלו בשבוע האחרון?"]) {
        const start = calls.length;
        const result = await chat(handler, { message });
        assert.equal(result.status, 200, message);
        assert.equal(result.body.runTrace.recency, undefined, `${message}: not a recency question`);
        assert.equal(calls.slice(start).some((call) => call.url.includes("/rest/v1/emails?") && call.url.includes("order=received_date.desc")), false);
      }
    });
  });

  test("latest by date: restore env", () => {
    restoreEnv();
  });
}
