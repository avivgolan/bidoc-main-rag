import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { bodyOf, fakeReq, fakeRes, installFakeFetch, jsonResponse } from "./support/handler-harness.js";
import { buildSessionSetCookieHeader } from "../src/auth.js";
import { getConfig, reloadSettingsFromDb, resetSettingsForTests } from "../src/config.js";
import { clearCompanyDbMetaCache } from "../src/companyDb.js";
import { LAB_EMPTY_MESSAGE, LAB_PROJECT_ID } from "../src/labDataset.js";
import { REQUEST_MODE_LAB, REQUEST_MODE_PROJECT, labDatasetConfig, modeRouteRefusal, routeAccess } from "../src/requestMode.js";

// Ticket 05: the Lab is back (ADR 0012). A Superadmin signs in with the BiDoc login and every Lab
// screen works in Lab mode against MAIN: chat, insights, dashboard, history, QA, timeline, graph,
// schedule, delay claims, tools, settings (saved live to Meta) and the Knowledge Base (read-only
// on Vercel). The screens that read a Project's content read the Lab dataset, MAIN's copy of the
// Company DB tables, and answer the empty state until ticket 06 seeds it. The Reset item and its
// route are gone. These tests drive the real HTTP handler under a fake network that records every
// host: a Lab request never contacts a Company DB.

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const KAPAIM_PROJECT = "33333333-3333-4333-8333-333333333333";
const OLD_REVIEW_PROJECT = "44444444-4444-4444-8444-444444444444";
const COMPANY_A = "https://company-a.supabase.test";
const KAPAIM = "https://kapaim.supabase.test";
const MAIN_DB = "https://main-db.supabase.test";
const META_DB = "https://meta.supabase.test";
const META_AUTH = "https://meta-auth.supabase.test";
const GLOBAL_CONTENT = "https://global-content.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";
const SESSION_SECRET = "lab-session-secret";
const SUPERADMIN = { id: "a0000000-0000-4000-8000-000000000006", email: "root@example.test" };
const SUPERADMIN_ROLE = "סופראדמין";
const META_KEY = "meta-service-key";
const SAVE_URL = `${META_DB}/rest/v1/rpc/save_agent_settings`;

const ENV_KEYS = [
  "VERCEL", "BIDOC_API_SECRET", "INGEST_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY",
  "META_SUPABASE_URL", "META_SUPABASE_SERVICE_ROLE_KEY", "MAIN_AGENT_SESSION_SECRET", "BIDOC_META_SUPABASE_URL", "BIDOC_META_SUPABASE_ANON_KEY",
  "CONTENT_SUPABASE_URL", "CONTENT_SUPABASE_SERVICE_ROLE_KEY", "DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN", "MAIN_MODEL", "LITE_MODEL",
  "CLASSIFIER_MODEL", "KNOWLEDGE_PLANNER_MODEL", "QA_MODEL", "EMBEDDING_MODEL", "HYBRID_CANDIDATES", "RERANK_TOP_K", "TIMEZONE", "N8N_BASE_URL"
];
const BASE_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  MAIN_AGENT_SESSION_SECRET: SESSION_SECRET,
  SUPABASE_URL: MAIN_DB,
  SUPABASE_SERVICE_ROLE_KEY: "main-db-key",
  OPENROUTER_API_KEY: "sk-or-test-key-0000000000",
  BIDOC_META_SUPABASE_URL: META_AUTH,
  BIDOC_META_SUPABASE_ANON_KEY: "meta-anon-key",
  // Leftover global content connection (the Contracts lab's fixed one): a Lab request that reads a
  // Project's content must never use it.
  CONTENT_SUPABASE_URL: GLOBAL_CONTENT,
  CONTENT_SUPABASE_SERVICE_ROLE_KEY: "global-content-key",
  DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN: "global-data-query-token"
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

// A correctly signed session cookie whose role is not Superadmin (it must open nothing).
function signedCookie({ role, secret = SESSION_SECRET }) {
  const payload = Buffer.from(JSON.stringify({ sub: SUPERADMIN.id, email: SUPERADMIN.email, role, exp: Date.now() + 60_000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `bidoc_session=${encodeURIComponent(`${payload}.${sig}`)}`;
}

const labHeaders = (extra = {}) => ({ host: "main-agent.test", "content-type": "application/json", cookie: labCookie(), ...extra });
const anonymousHeaders = (extra = {}) => ({ host: "main-agent.test", "content-type": "application/json", ...extra });

function projectHeaders({ url = COMPANY_A, key = "company-a-key", projectId = PROJECT_A, extra = {} } = {}) {
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

// ─── The fake MAIN ───────────────────────────────────────────────────────────
// MAIN's own Lab tables always exist. The Lab dataset tables (the Company DB template tables copied
// into MAIN by ticket 06) exist once `state.seeded`; before that PostgREST answers "table not found".
const MAIN_OWN = /^(chat_messages_gf|chat_session_memory|chat_memory_items|qa_[a-z_]+|delay_[a-z_]+|schedule_activity_assignment_[a-z_]+|schedule_assignment_[a-z_]+)$/;
const NOW = "2026-10-15T09:00:00.000Z";

function labMessage(overrides = {}) {
  return {
    id: "msg-1", session_id: "lab_s1", user_message: "מה מצב היציקה?", ai_response: "היציקה הושלמה.", status: "done",
    created_at: NOW, annotation: null, workflow_log: { nodes: [{ id: "classifier", status: "done" }] }, run_events: [], ...overrides
  };
}

function datasetRows(table) {
  if (table === "projects") return [{ id: LAB_PROJECT_ID, name: "Lab", is_active: true, settings: {}, created_at: NOW }];
  if (table === "data_index_embeddings_gf_dor_agent") {
    return [{ id: 1, created_at: NOW, primary_date: "2026-10-01", hashtags: ["יציקה"], title: "יציקת תקרה", summary: "היציקה הושלמה", index_text: "יציקת תקרה הושלמה",
      source_table: "emails", source_id: "e1", project_id: LAB_PROJECT_ID, item_status: "open", mail_id: "m1", attachment_id: null, source_url: null, mentioned_dates: [] }];
  }
  return [];
}

// The QA harness keeps suites, runs and results in MAIN: a tiny stateful PostgREST for its tables
// (equality and in() filters only, which is all its repository sends).
const QA_STORED = /^qa_(test_suites|test_cases|runs|case_runs|evaluations)$/;

function qaTable(state, table, call, url) {
  const rows = (state.qa[table] ||= []);
  const matches = (row) => [...url.searchParams.entries()].every(([key, value]) => {
    if (["select", "order", "limit", "offset"].includes(key)) return true;
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    const list = value.match(/^in\.\((.*)\)$/);
    return list ? list[1].split(",").includes(String(row[key])) : true;
  });
  if (call.method === "POST") {
    const row = { id: crypto.randomUUID(), created_at: NOW, ...call.body };
    rows.push(row);
    return jsonResponse([row], 201);
  }
  if (call.method === "PATCH") {
    const updated = rows.filter(matches).map((row) => Object.assign(row, call.body));
    return jsonResponse(updated);
  }
  return jsonResponse(rows.filter(matches));
}

function mainRoute(state) {
  return (call) => {
    if (call.origin !== MAIN_DB) return null;
    const url = new URL(call.url);
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(.+)$/);
    const table = rpc ? null : url.pathname.replace(/^\/rest\/v1\//, "");
    if (!rpc && QA_STORED.test(table)) return qaTable(state, table, call, url);
    if (!rpc && MAIN_OWN.test(table)) {
      if (call.method === "POST") return jsonResponse([{ ...(call.body || {}), id: call.body?.id || `${table}-new` }], 201);
      if (call.method === "PATCH") return jsonResponse([{ ...(call.body || {}), id: url.searchParams.get("id")?.replace(/^eq\./, "") || "msg-1" }]);
      if (table === "chat_messages_gf") return jsonResponse([labMessage()]);
      if (table === "qa_reports") return jsonResponse([{ id: "r1", message_id: "msg-1", status: "done", report: { score: 3 }, created_at: NOW }]);
      if (table === "delay_claim_cases") return jsonResponse([{ id: "case-1", title: "תיק בדיקה", project_id: null, updated_at: NOW }]);
      if (table === "schedule_activity_assignment_reviews" && url.searchParams.get("select") === "source_project_id") {
        return jsonResponse([{ source_project_id: OLD_REVIEW_PROJECT }, { source_project_id: OLD_REVIEW_PROJECT }, { source_project_id: LAB_PROJECT_ID }]);
      }
      return jsonResponse([]);
    }
    // Lab dataset tables and RPCs.
    if (!state.seeded) return jsonResponse({ code: rpc ? "PGRST202" : "PGRST205", message: "Could not find the table or function in the schema cache" }, 404);
    // The Indicator's project mapping RPC answers the Lab Project as its own schedule project.
    if (rpc && /schedule_project_context/.test(rpc[1])) return jsonResponse({ mappingFound: true, sourceProjectId: LAB_PROJECT_ID, scheduleProjectId: LAB_PROJECT_ID });
    if (rpc) return jsonResponse([]);
    if (call.method === "POST" || call.method === "PATCH") return jsonResponse(Array.isArray(call.body) ? call.body : [{ ...(call.body || {}), id: "row-1" }], 201);
    return jsonResponse(datasetRows(table), 200, { "content-range": `0-0/${datasetRows(table).length}` });
  };
}

async function withLab(fn, { seeded = true, env = {}, route = () => null } = {}) {
  useEnv(env);
  clearCompanyDbMetaCache();
  const state = { seeded, qa: {} };
  const originalWarn = console.warn;
  console.warn = () => {};
  const fake = installFakeFetch((call) => mainRoute(state)(call) || route(call));
  try {
    serverModule ||= await import("../src/server.js");
    resetSettingsForTests();
    fake.calls.length = 0;
    return await fn({ handler: serverModule.default, calls: fake.calls, state });
  } finally {
    console.warn = originalWarn;
    fake.restore();
    resetSettingsForTests();
    clearCompanyDbMetaCache();
    restoreEnv();
  }
}

async function request(handler, options) {
  const res = fakeRes();
  await handler(fakeReq(options), res);
  return { status: res.statusCode, body: bodyOf(res), headers: res.headers };
}

const supabaseOrigins = (calls) => [...new Set(calls.map((call) => call.origin).filter((origin) => origin.includes("supabase.test")))];

// A Lab request reaches only MAIN (and the Meta DB for settings): never a Company DB.
function assertLabOnly(calls, label, { allowed = [MAIN_DB] } = {}) {
  for (const origin of supabaseOrigins(calls)) assert.ok(allowed.includes(origin), `${label}: a Lab request reached ${origin}`);
  for (const forbidden of [COMPANY_A, KAPAIM, GLOBAL_CONTENT]) {
    assert.ok(!calls.some((call) => call.origin === forbidden), `${label}: a Lab request never contacts ${forbidden}`);
  }
}

const htmlOf = () => fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const appJs = () => fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

export function registerLabIsBackTests(test) {
  // ─── Sign-in ──────────────────────────────────────────────────────────────
  test("lab sign-in: a Superadmin signs in with the BiDoc login, a non-Superadmin cannot, and only the Lab session opens the Lab", async () => {
    const accounts = {
      "root@example.test": { password: "right", id: SUPERADMIN.id, role: SUPERADMIN_ROLE },
      "pm@example.test": { password: "right", id: "b0000000-0000-4000-8000-000000000001", role: "מנהל פרויקט" },
      "nobody@example.test": { password: "right", id: "b0000000-0000-4000-8000-000000000002", role: null }
    };
    const route = (call) => {
      if (call.origin !== META_AUTH) return null;
      const url = new URL(call.url);
      if (url.pathname === "/auth/v1/token") {
        const account = accounts[call.body?.email];
        if (!account || account.password !== call.body?.password) return jsonResponse({ error_description: "Invalid login credentials" }, 400);
        return jsonResponse({ access_token: `token-${account.id}`, user: { id: account.id, email: call.body.email } });
      }
      if (url.pathname === "/rest/v1/profiles") {
        const account = Object.values(accounts).find((item) => `eq.${item.id}` === url.searchParams.get("id"));
        return jsonResponse(account?.role ? [{ role: account.role }] : []);
      }
      return jsonResponse({}, 404);
    };
    await withLab(async ({ handler, calls }) => {
      const signIn = (email, password) => request(handler, { url: "/api/auth/login", headers: anonymousHeaders(), body: { email, password } });

      const ok = await signIn("root@example.test", "right");
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.match(String(ok.headers["Set-Cookie"] || ""), /^bidoc_session=.+HttpOnly/, "the Lab session cookie is set");
      // That cookie opens the Lab.
      const cookie = String(ok.headers["Set-Cookie"]).split(";")[0];
      const session = await request(handler, { method: "GET", url: "/api/auth/session", headers: anonymousHeaders({ cookie }) });
      assert.deepEqual(session.body, { authenticated: true, email: "root@example.test" });
      const sessions = await request(handler, { method: "GET", url: "/api/sessions", headers: anonymousHeaders({ cookie }) });
      assert.equal(sessions.status, 200);

      for (const [email, password, why] of [
        ["pm@example.test", "right", "a project manager"],
        ["nobody@example.test", "right", "a user without a profile role"],
        ["root@example.test", "wrong", "a wrong password"],
        ["", "", "no credentials"]
      ]) {
        const refused = await signIn(email, password);
        assert.equal(refused.status, 401, `${why} cannot sign in`);
        assert.equal(refused.headers["Set-Cookie"], undefined, `${why} gets no session cookie`);
      }
      assert.match((await signIn("pm@example.test", "right")).body.error, /סופראדמין/, "the refusal says the Lab is for Superadmins");

      // Only the BiDoc Meta auth host was contacted to sign in: no Company DB, not even MAIN.
      assert.deepEqual([...new Set(calls.filter((call) => call.url.includes("/auth/v1/") || call.url.includes("/profiles")).map((call) => call.origin))], [META_AUTH]);
      assertLabOnly(calls, "sign-in", { allowed: [META_AUTH, MAIN_DB] });
    }, { route });
  });

  test("lab sign-in: a session that is not a Superadmin's (wrong role, wrong signature, none) opens no Lab route and no database call is made", async () => {
    await withLab(async ({ handler, calls }) => {
      const cookies = [
        ["no cookie", undefined],
        ["a signed non-Superadmin session", signedCookie({ role: "מנהל פרויקט" })],
        ["a Superadmin session signed with another secret", signedCookie({ role: SUPERADMIN_ROLE, secret: "someone-elses-secret" })],
        ["a malformed cookie", "bidoc_session=abc.def"]
      ];
      for (const [label, cookie] of cookies) {
        for (const [method, url] of [["GET", "/api/sessions"], ["POST", "/api/chat"], ["GET", "/api/dashboard/v1/projects"], ["GET", "/api/timeline/events"],
          ["PUT", "/api/settings"], ["GET", "/api/qa/messages"], ["GET", "/api/delay-claims"], ["GET", "/api/contracts/workspaces/status"]]) {
          const result = await request(handler, { method, url, headers: anonymousHeaders(cookie ? { cookie } : {}), body: method === "GET" ? null : { message: "x", models: { main: "x/y" } } });
          assert.equal(result.status, 401, `${label}: ${method} ${url} -> ${result.status} ${JSON.stringify(result.body)}`);
        }
        const session = await request(handler, { method: "GET", url: "/api/auth/session", headers: anonymousHeaders(cookie ? { cookie } : {}) });
        assert.equal(session.body.authenticated, false, label);
      }
      assert.equal(calls.length, 0, "refused before any database call");
    });
  });

  // ─── Every Lab screen works against MAIN ──────────────────────────────────
  test("lab screens: chat answers from the Lab dataset, keeps its chat and memory in MAIN, and never contacts a Company DB", async () => {
    await withLab(async ({ handler, calls }) => {
      const result = await request(handler, { url: "/api/chat", headers: labHeaders(), body: { message: "מה מצב היציקה?", sessionId: "lab_s1" } });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 400));
      assert.equal(typeof result.body.answer, "string");
      assert.ok(result.body.runTrace, "the compact run trace still travels with the answer");
      assert.equal(result.body.messageId, "chat_messages_gf-new", "a Lab chat is stored in MAIN and has its MAIN message id");

      const toMain = calls.filter((call) => call.origin === MAIN_DB);
      assert.ok(toMain.some((call) => call.method === "POST" && /\/chat_messages_gf$/.test(call.url)), "the Lab chat message is written to MAIN");
      assert.ok(toMain.some((call) => call.method === "PATCH" && /\/chat_messages_gf\?id=eq\./.test(call.url)), "the answer is saved on it in MAIN");
      assert.ok(toMain.some((call) => /chat_session_memory/.test(call.url)), "the Lab keeps its chat memory in MAIN");
      const search = toMain.find((call) => /\/rpc\/hybrid_match/.test(call.url));
      assert.ok(search, "retrieval ran against the Lab dataset in MAIN");
      assert.equal(search.body.project_id_filter, LAB_PROJECT_ID, "the Lab dataset is the Lab Project");
      assertLabOnly(calls, "chat");

      // A streamed Lab chat (the standalone UI's mode) works the same.
      const start = calls.length;
      const streamed = fakeRes();
      await handler(fakeReq({ url: "/api/chat", headers: labHeaders(), body: { message: "שלום", sessionId: "lab_s2", stream: true } }), streamed);
      const text = streamed.chunks.join("");
      assert.match(text, /event: result\n/);
      assertLabOnly(calls.slice(start), "streamed chat");
    });
  });

  test("lab screens: every screen that reads a Project's content works against the Lab dataset in MAIN, and writes only MAIN", async () => {
    await withLab(async ({ handler, calls }) => {
      const screens = [
        ["dashboard projects", "GET", "/api/dashboard/v1/projects", null, [200]],
        ["insights runs", "GET", "/api/insights/runs", null, [200]],
        ["insights quality", "GET", "/api/insights/quality-metrics", null, [200]],
        ["insights hashtags", "GET", "/api/insights/hashtags?source=alerts", null, [200]],
        ["insights analyze", "POST", "/api/insights/analyze", { focusQuery: "יציקה", limit: 5 }, [200]],
        ["timeline", "GET", "/api/timeline", null, [200]],
        ["timeline alerts", "GET", "/api/timeline/alerts", null, [200]],
        ["timeline events", "GET", "/api/timeline/events?limit=5", null, [200]],
        ["timeline links", "GET", "/api/timeline/links?source=index", null, [200]],
        ["graph", "GET", "/api/graph?limit=20", null, [200]],
        ["link agent", "GET", "/api/timeline/link-suggestions?source=index", null, [200]],
        ["schedule projects", "GET", "/api/schedule/projects", null, [200]],
        ["schedule alerts", "GET", `/api/schedule/alerts?projectId=${LAB_PROJECT_ID}`, null, [200]],
        ["schedule activity updates", "GET", `/api/schedule/activity-updates?projectId=${LAB_PROJECT_ID}`, null, [200]],
        ["schedule assignment reviews", "GET", `/api/schedule/activity-updates/assignment-agent/reviews?projectId=${LAB_PROJECT_ID}`, null, [200]],
        ["indexing dry run", "POST", "/api/index/run", { dryRun: true, tables: ["emails"], limit: 5 }, [200]],
        ["tools: hybrid search", "POST", "/api/tools/hybrid_search/test", { query: "יציקה" }, [200]],
        ["alert agent", "POST", "/api/subagents/alert", { query: "התראות פתוחות" }, [200]],
        ["data query", "POST", "/api/subagents/data-query", { question: "כמה התראות יש?" }, [200, 400]],
        ["evaluations", "POST", "/api/evaluations/run", { cases: [{ message: "שלום" }] }, [200]],
        ["diagnostics", "POST", "/api/diagnostics/connections", { ids: ["app_supabase_rest", "content_supabase_index_table", "content_supabase_alerts_table"] }, [200]]
      ];
      for (const [label, method, url, body, statuses] of screens) {
        const start = calls.length;
        const result = await request(handler, { method, url, headers: labHeaders(), body });
        assert.ok(statuses.includes(result.status), `${label}: ${method} ${url} -> ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
        assertLabOnly(calls.slice(start), label);
      }
      assert.ok(calls.some((call) => call.origin === MAIN_DB && ["POST", "PATCH"].includes(call.method) && /\/project_insight_runs/.test(call.url)), "an insights run is saved in MAIN's Lab tables");
      assertLabOnly(calls, "the whole battery");
    });
  });

  test("lab screens: history, QA, annotate and delay claims work on MAIN's own Lab tables", async () => {
    await withLab(async ({ handler, calls }) => {
      const get = (url) => request(handler, { method: "GET", url, headers: labHeaders() });
      const post = (url, body = {}) => request(handler, { url, headers: labHeaders(), body });

      const sessions = await get("/api/sessions");
      assert.equal(sessions.status, 200);
      assert.equal(sessions.body.sessions[0].sessionId, "lab_s1", "existing Lab chat history is visible");
      const messages = await get("/api/sessions/lab_s1/messages");
      assert.equal(messages.body.messages[0].id, "msg-1");
      const history = await get("/api/run-history?limit=10");
      assert.equal(history.status, 200);
      assert.ok(history.body.runs.some((run) => run.id === "msg-1"), "past Lab runs are listed");

      // Message-level QA (the QA screen): these routes were shadowed by the QA harness before.
      const qaList = await get("/api/qa/messages?filter=all&limit=30");
      assert.equal(qaList.status, 200, JSON.stringify(qaList.body));
      assert.equal(qaList.body.messages[0].id, "msg-1");
      assert.equal(qaList.body.messages[0].qa_report.id, "r1", "existing QA reports are visible");
      assert.equal((await get("/api/qa/dislikes")).status, 200);
      const report = await get("/api/qa/msg-1/report");
      assert.equal(report.status, 200);
      const aiReport = await get("/api/ai-report/msg-1");
      assert.ok([200, 404].includes(aiReport.status));
      const qaRun = await post("/api/qa/msg-1/run");
      assert.ok([200, 500].includes(qaRun.status), `QA run: ${qaRun.status} ${JSON.stringify(qaRun.body).slice(0, 200)}`);
      assert.ok(calls.some((call) => call.origin === MAIN_DB && call.method === "POST" && /\/qa_reports$/.test(call.url)), "the QA report is stored in MAIN");
      const trends = await post("/api/qa/trends");
      assert.ok([200, 500].includes(trends.status), `QA trends: ${trends.status}`);

      // QA suites and runs (the harness): suites live in MAIN.
      const suite = await post("/api/qa/test-suites", { name: "Lab smoke", domain: "chat", idempotency_key: "suite-lab-0001" });
      assert.equal(suite.status, 201, JSON.stringify(suite.body).slice(0, 300));
      assert.ok(calls.some((call) => call.origin === MAIN_DB && call.method === "POST" && /\/qa_test_suites$/.test(call.url)), "the QA suite is stored in MAIN");

      // A QA question runs the real chat pipeline against the Lab dataset and stores its run in MAIN.
      const qaQuery = await post("/api/qa/query", { question: "מה סטטוס האישורים בקומה 2?", expected_behavior: { expected_route: "RAG" }, idempotency_key: "query-lab-0001" });
      assert.equal(qaQuery.status, 200, JSON.stringify(qaQuery.body).slice(0, 400));
      assert.ok(calls.some((call) => call.origin === MAIN_DB && call.method === "POST" && /\/qa_runs$/.test(call.url)), "the QA run is stored in MAIN");
      const qaSearch = calls.find((call) => call.origin === MAIN_DB && /\/rpc\/hybrid_match/.test(call.url) && call.body?.project_id_filter === LAB_PROJECT_ID);
      assert.ok(qaSearch, "the QA run retrieved from the Lab dataset in MAIN");
      assert.ok(!calls.some((call) => /qa_[a-z_]+/.test(call.url) && call.origin !== MAIN_DB));

      // Votes.
      const vote = await post("/api/messages/msg-1/annotate", { annotation: "X" });
      assert.equal(vote.status, 200);
      assert.equal(vote.body.ignored, undefined, "a Lab vote is really written");
      assert.ok(calls.some((call) => call.origin === MAIN_DB && call.method === "PATCH" && /chat_messages_gf\?id=eq\.msg-1/.test(call.url)));

      // Delay claims: the Lab sees every case (the old test case has no Project) and writes MAIN.
      const claims = await get("/api/delay-claims");
      assert.equal(claims.status, 200, JSON.stringify(claims.body));
      assert.equal(claims.body.claims[0].id, "case-1");
      const claimsCall = calls.find((call) => /\/delay_claim_cases\?select=/.test(call.url) && call.method === "GET");
      assert.ok(!/project_id/.test(claimsCall.url), "the Lab lists every delay claim case, not one Project's");
      const created = await post("/api/delay-claims", { title: "תיק חדש" });
      assert.equal(created.status, 200, JSON.stringify(created.body));
      assert.equal(created.body.claim.id, "delay_claim_cases-new");
      assert.equal((await get("/api/delay-claims/case-1/events")).status, 200);

      // Chat memory panel of the Settings screen.
      const memory = await get("/api/memory/stats");
      assert.equal(memory.status, 200);
      assert.equal(memory.body.mode, "session_only");

      assertLabOnly(calls, "history, QA, votes, delay claims and memory");
    });
  });

  test("lab screens: schedule lists the Lab dataset's project and the Projects of past assignment reviews, from MAIN only", async () => {
    await withLab(async ({ handler, calls }) => {
      const result = await request(handler, { method: "GET", url: "/api/schedule/projects", headers: labHeaders() });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      const ids = result.body.projects.map((project) => project.projectId);
      assert.deepEqual(ids.filter((id) => id === OLD_REVIEW_PROJECT), [OLD_REVIEW_PROJECT], "a Project with past reviews is listed once");
      assert.ok(result.body.projects.find((project) => project.projectId === OLD_REVIEW_PROJECT).reviewsOnly, "it is marked as reviews-only");
      assert.equal(ids.filter((id) => id === LAB_PROJECT_ID).length, 1, "the Lab project is not listed twice");
      assertLabOnly(calls, "schedule projects");
    });
    // Before the dataset is seeded the past reviews are still reachable.
    await withLab(async ({ handler }) => {
      const result = await request(handler, { method: "GET", url: "/api/schedule/projects", headers: labHeaders() });
      assert.equal(result.status, 200);
      assert.ok(result.body.projects.some((project) => project.projectId === OLD_REVIEW_PROJECT && project.reviewsOnly), "past reviews stay reachable with no dataset");
    }, { seeded: false });
  });

  test("lab screens: a deployment without MAIN says so instead of asking for a Company DB", async () => {
    await withLab(async ({ handler, calls }) => {
      for (const [method, url] of [["GET", "/api/lab/dataset"], ["GET", "/api/timeline/events"], ["GET", "/api/graph"]]) {
        const result = await request(handler, { method, url, headers: labHeaders() });
        assert.equal(result.status, 503, `${method} ${url}: ${JSON.stringify(result.body)}`);
        assert.equal(result.body.error, "main_not_configured");
      }
      assert.equal(calls.length, 0);
    }, { env: { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined } });
  });

  test("lab screens: the Contracts lab keeps its fixed connection and never takes a Company DB from the request", async () => {
    await withLab(async ({ handler, calls }) => {
      const status = await request(handler, { method: "GET", url: "/api/contracts/workspaces/status", headers: labHeaders() });
      assert.equal(status.status, 200, JSON.stringify(status.body).slice(0, 300));
      // Its connection is the server-owned one (CONTENT_SUPABASE_*), exactly as before the Lab came back.
      assert.deepEqual(supabaseOrigins(calls).filter((origin) => origin !== GLOBAL_CONTENT && origin !== MAIN_DB), []);
      assert.ok(!calls.some((call) => call.origin === COMPANY_A || call.origin === KAPAIM));
      const override = await request(handler, { method: "GET", url: "/api/contracts/workspaces/status", headers: labHeaders({ "x-content-supabase-url": COMPANY_A, "x-content-supabase-key": "k" }) });
      assert.equal(override.status, 400, "client database overrides are refused");
      assert.ok(!calls.some((call) => call.origin === COMPANY_A));
    });
  });

  test("lab screens: Company DB headers on any Lab screen are refused before a database call", async () => {
    await withLab(async ({ handler, calls }) => {
      const routes = [
        ["POST", "/api/chat"], ["GET", "/api/insights/runs"], ["POST", "/api/insights/analyze"], ["GET", "/api/timeline/events"], ["GET", "/api/graph"],
        ["GET", "/api/schedule/projects"], ["POST", "/api/index/run"], ["POST", "/api/tools/hybrid_search/test"], ["POST", "/api/subagents/alert"],
        ["POST", "/api/subagents/data-query"], ["GET", "/api/dashboard/v1/projects"], ["GET", "/api/qa/messages"], ["GET", "/api/delay-claims"], ["GET", "/api/lab/dataset"]
      ];
      for (const [method, url] of routes) {
        const result = await request(handler, {
          method, url, body: method === "GET" ? null : { message: "x" },
          headers: labHeaders({ "x-content-supabase-url": COMPANY_A, "x-content-supabase-key": "company-a-key", "x-project-id": PROJECT_A })
        });
        assert.equal(result.status, 400, `${method} ${url}: ${JSON.stringify(result.body)}`);
        assert.equal(result.body.error, "lab_mode_has_no_company_db", `${method} ${url}`);
      }
      assert.equal(calls.length, 0);
    });
  });

  // ─── Empty state ──────────────────────────────────────────────────────────
  test("lab dataset: until ticket 06 seeds it, every screen that reads a Project's content shows the empty state", async () => {
    await withLab(async ({ handler, calls }) => {
      const status = await request(handler, { method: "GET", url: "/api/lab/dataset", headers: labHeaders() });
      assert.equal(status.status, 200);
      assert.equal(status.body.hasData, false);
      assert.equal(status.body.message, LAB_EMPTY_MESSAGE);
      assert.equal(LAB_EMPTY_MESSAGE, "אין נתוני Lab — טען מערך בדיקה");

      for (const [method, url, body] of [
        ["GET", "/api/dashboard/v1/projects", null],
        ["GET", "/api/timeline/events?limit=5", null],
        ["GET", "/api/schedule/projects", null],
        ["POST", "/api/index/run", { dryRun: true, tables: ["emails"], limit: 5 }],
        ["POST", "/api/tools/hybrid_search/test", { query: "יציקה" }]
      ]) {
        const result = await request(handler, { method, url, headers: labHeaders(), body });
        // Either the screen's own error shows the empty-state text, or its list is simply empty.
        const empty = result.body?.error === LAB_EMPTY_MESSAGE
          || (result.status === 200 && (result.body.ok === false
            // The schedule list holds only the Projects of past reviews (no schedule data), never the Lab project.
            || (result.body.projects || result.body.events || []).filter((item) => !item.reviewsOnly).length === 0));
        assert.ok(empty, `${method} ${url} shows the empty state: ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
      }
      // Chat still answers (it just finds nothing to ground on), and the lists show nothing.
      const chat = await request(handler, { url: "/api/chat", headers: labHeaders(), body: { message: "מה מצב היציקה?", sessionId: "lab_s9" } });
      assert.equal(chat.status, 200);
      for (const url of ["/api/timeline", "/api/timeline/alerts", "/api/graph"]) {
        const result = await request(handler, { method: "GET", url, headers: labHeaders() });
        assert.ok([200, 409].includes(result.status), `${url}: ${result.status}`);
      }
      // History, QA and settings are MAIN's own tables: they work with no dataset.
      for (const url of ["/api/sessions", "/api/run-history", "/api/qa/messages", "/api/delay-claims", "/api/settings", "/api/agents"]) {
        assert.equal((await request(handler, { method: "GET", url, headers: labHeaders() })).status, 200, url);
      }
      assertLabOnly(calls, "empty Lab dataset");
    }, { seeded: false });

    await withLab(async ({ handler }) => {
      const status = await request(handler, { method: "GET", url: "/api/lab/dataset", headers: labHeaders() });
      assert.equal(status.body.hasData, true, "a seeded dataset has no empty state");
      assert.equal(status.body.projectId, LAB_PROJECT_ID);
    }, { seeded: true });
  });

  test("lab dataset: the empty-state notice and the Lab dataset status are wired into the Lab screens", () => {
    const html = htmlOf();
    for (const tab of ["dashboard", "chat", "insights", "schedule", "timeline", "graph", "linkAgent", "qa", "tools"]) {
      const section = html.slice(html.indexOf(`id="${tab}"`));
      const upToNext = section.slice(0, section.indexOf("<section class=\"panel", 10) > 0 ? section.indexOf("<section class=\"panel", 10) : section.length);
      assert.match(upToNext, /data-lab-empty/, `${tab} carries the empty-state notice`);
    }
    assert.match(html, /אין נתוני Lab — טען מערך בדיקה/);
    const js = appJs();
    assert.match(js, /api\("\/api\/lab\/dataset"\)/);
    assert.match(js, /LAB_DATA_TABS\.has\(tabId\)\) refreshLabDatasetNotices\(\)/);
  });

  // ─── Settings ─────────────────────────────────────────────────────────────
  test("lab settings: every settings screen saves live to Meta through the one logged route and says that it changes production", async () => {
    const state = { row: { models: { main: "meta/main" }, timezone: "Asia/Jerusalem" }, saves: [] };
    const route = (call) => {
      if (call.origin !== META_DB) return null;
      const url = new URL(call.url);
      if (call.method === "GET" && url.pathname === "/rest/v1/agent_settings") return jsonResponse([{ value: state.row }]);
      if (call.method === "POST" && call.url === SAVE_URL) {
        state.row = call.body.p_value;
        state.saves.push(call.body);
        return jsonResponse(call.body.p_value);
      }
      return jsonResponse({ message: "unexpected Meta call" }, 404);
    };
    await withLab(async ({ handler, calls }) => {
      await reloadSettingsFromDb();
      calls.length = 0;
      // Main agent, sub-agents (toolsRuntime), workflow, tools and settings all save through PUT /api/settings.
      const saves = [
        ["סוכן ראשי", { models: { main: "lab/main" }, prompts: { lite: "LAB PROMPT" } }],
        ["סוכני משנה", { subagents: { meetingsEvidence: { enabled: true } }, toolsRuntime: { internalTools: true } }],
        ["בדיקת כלים", { tools: { alert: "https://n8n.example/webhook/alert" } }],
        ["הגדרות", { retrieval: { candidates: 31 }, timezone: "Asia/Tokyo" }]
      ];
      for (const [label, body] of saves) {
        const result = await request(handler, { method: "PUT", url: "/api/settings", headers: labHeaders(), body });
        assert.equal(result.status, 200, `${label}: ${JSON.stringify(result.body).slice(0, 300)}`);
      }
      assert.equal(state.saves.length, saves.length, "every save is one logged RPC call: no draft step");
      for (const save of state.saves) {
        assert.equal(save.p_changed_by, SUPERADMIN.id, "every save records who changed it");
        assert.equal(save.p_changed_by_email, SUPERADMIN.email);
      }
      assert.equal(getConfig().models.main, "lab/main", "the saved value is live at once");
      assert.deepEqual(supabaseOrigins(calls), [META_DB], "a settings save touches only the Meta DB: not MAIN, not a Company DB");
      assert.ok(!calls.some((call) => call.origin === MAIN_DB));
    }, { env: { META_SUPABASE_URL: META_DB, META_SUPABASE_SERVICE_ROLE_KEY: META_KEY }, route });

    // The screens say it.
    const html = htmlOf();
    for (const tab of ["agents", "subagents", "workflow", "settings", "tools"]) {
      const start = html.indexOf(`<section class="panel" id="${tab}"`);
      assert.ok(start > 0, tab);
      const next = html.indexOf("<section class=\"panel", start + 10);
      const section = html.slice(start, next > 0 ? next : html.length);
      assert.match(section, /labProdNotice[\s\S]*שמירה כאן משנה את הייצור/, `${tab} states that saving changes production`);
    }
    assert.match(appJs(), /שומר בייצור/);
    assert.doesNotMatch(htmlOf(), /שמור ל-Supabase/, "the sub-agents save button no longer claims a Supabase draft");
  });

  // ─── Knowledge Base ───────────────────────────────────────────────────────
  test("knowledge base: read-only on Vercel (files ship with the code), writable locally", async () => {
    await withLab(async ({ handler, calls }) => {
      const list = await request(handler, { method: "GET", url: "/api/knowledge/documents", headers: labHeaders() });
      assert.equal(list.status, 200);
      assert.equal(list.body.writable, false);
      assert.ok(list.body.documents.length > 0, "the shipped documents are listed");
      const agents = await request(handler, { method: "GET", url: "/api/knowledge/agents", headers: labHeaders() });
      assert.equal(agents.status, 200);
      const search = await request(handler, { url: "/api/knowledge/search", headers: labHeaders(), body: { query: "עיכוב בלוח זמנים", agentId: "schedule" } });
      assert.equal(search.status, 200, "searching the Knowledge Base still works");

      const upload = await request(handler, { url: "/api/knowledge/documents", headers: labHeaders(), body: { filename: "x.md", content: "hello", agentId: "schedule" } });
      assert.equal(upload.status, 405);
      assert.equal(upload.body.code, "knowledge_read_only");
      const removal = await request(handler, { method: "DELETE", url: "/api/knowledge/documents/x.md?agentId=schedule&source=upload", headers: labHeaders() });
      assert.equal(removal.status, 405);
      assert.equal(removal.body.code, "knowledge_read_only");
      assert.equal(calls.length, 0, "the Knowledge Base reads no database");
    });
    await withLab(async ({ handler }) => {
      const list = await request(handler, { method: "GET", url: "/api/knowledge/documents", headers: labHeaders() });
      assert.equal(list.body.writable, true, "off Vercel (local development) uploads still work");
    }, { env: { VERCEL: undefined } });

    const html = htmlOf();
    assert.match(html, /id="knowledgeReadOnlyNote"/);
    assert.match(appJs(), /applyKnowledgeWritable\(result\.writable !== false\)/);
  });

  // ─── Reset is gone ────────────────────────────────────────────────────────
  test("reset: the Reset menu item, its screen, its code and its route are removed", async () => {
    const html = htmlOf();
    assert.doesNotMatch(html, /data-tab="reset"/);
    assert.doesNotMatch(html, /id="reset"/);
    assert.doesNotMatch(html, /restartServer|restartStatus|Reset Server/);
    const js = appJs();
    assert.doesNotMatch(js, /restartServer|wireReset|waitForServer|reset_server|\/api\/system\/restart/);
    const serverSource = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    assert.doesNotMatch(serverSource, /scheduleServerRestart|\/api\/system\/restart|node:child_process/);
    // The other menu items stay.
    for (const tab of ["dashboard", "chat", "insights", "schedule", "contracts", "agents", "subagents", "knowledge", "workflow", "tools", "history", "timeline", "graph", "linkAgent", "qa", "settings"]) {
      assert.match(html, new RegExp(`data-tab="${tab}"`), `${tab} stays`);
    }
    assert.notEqual(routeAccess("/api/system/restart"), "lab");

    await withLab(async ({ handler, calls }) => {
      for (const headers of [labHeaders(), projectHeaders(), anonymousHeaders()]) {
        const result = await request(handler, { url: "/api/system/restart", headers, body: {} });
        assert.ok(result.status >= 400, `the restart route no longer answers (${result.status})`);
        assert.notEqual(result.body?.message, "Restarting server");
      }
      assert.ok(!calls.some((call) => call.origin === COMPANY_A && /restart/.test(call.url)));
    });
  });

  // ─── Route classes ────────────────────────────────────────────────────────
  test("lab routes: the screens that read a Project's content are open to both modes, and a Lab request has no Company DB connection", () => {
    for (const path of ["/api/chat", "/api/evaluations/run", "/api/graph", "/api/graph/enrich", "/api/insights/analyze", "/api/insights/runs", "/api/timeline/events",
      "/api/timeline/graph/rebuild", "/api/index/run", "/api/schedule/alert-scan", "/api/schedule/projects", "/api/subagents/alert", "/api/subagents/data-query",
      "/api/tools/hybrid_search/test", "/api/messages/m1/annotate"]) {
      assert.equal(routeAccess(path), "both", path);
      assert.equal(modeRouteRefusal(REQUEST_MODE_LAB, path), null, `${path} is open to a Lab request`);
      assert.equal(modeRouteRefusal(REQUEST_MODE_PROJECT, path), null, `${path} stays open to a Project request`);
    }
    for (const path of ["/api/lab/dataset", "/api/memory/stats", "/api/sessions", "/api/qa/messages", "/api/delay-claims"]) {
      assert.equal(routeAccess(path), "lab", path);
      assert.equal(modeRouteRefusal(REQUEST_MODE_PROJECT, path).error, "route_requires_lab_mode", path);
    }
    assert.equal(routeAccess("/api/some-new-route"), "project", "a new route still defaults to Project-only");
    const config = labDatasetConfig({ supabaseUrl: MAIN_DB, supabaseServiceRoleKey: "main-key", contentSource: { indexTable: "t", supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "company-key" } });
    assert.equal(config.requestMode, REQUEST_MODE_LAB);
    assert.equal(config.projectId, LAB_PROJECT_ID);
    assert.equal(config.contentSource.supabaseUrl, MAIN_DB, "the Lab dataset is MAIN, whatever the settings name");
    assert.equal(config.contentSource.supabaseServiceRoleKey, "main-key");
    assert.equal(config.contentSource.labDataset, true);
    assert.equal(labDatasetConfig({ supabaseUrl: MAIN_DB, supabaseServiceRoleKey: "k", contentSource: {} }, PROJECT_A).projectId, PROJECT_A, "a Lab request may name a Project of its own");
  });

  // ─── Kapaim regression ────────────────────────────────────────────────────
  test("Kapaim regression: Project-mode chat, insights and annotate behave as before, on Kapaim's Company DB only, with no MAIN and no schema change", async () => {
    const kapaimRoute = (call) => {
      if (call.origin !== KAPAIM) return null;
      if (call.url.includes("/chat_sessions?")) return jsonResponse([{ session_id: "s1", project_id: KAPAIM_PROJECT }]);
      return null;
    };
    await withLab(async ({ handler, calls }) => {
      const kapaim = (extra = {}) => projectHeaders({ url: KAPAIM, key: "kapaim-key", projectId: KAPAIM_PROJECT, extra });
      const chat = await request(handler, { url: "/api/chat", headers: kapaim(), body: { message: "מה קורה עם הטיח בקומה 3?", sessionId: `bidoc:${KAPAIM_PROJECT}:s1`, projectId: KAPAIM_PROJECT } });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 300));
      for (const field of ["answer", "sources", "followUps", "classification", "type", "runTrace", "status"]) assert.ok(field in chat.body, `chat keeps ${field}`);
      assert.equal(chat.body.messageId, null, "a Project chat stores nothing in main-agent, as before");
      const runs = await request(handler, { method: "GET", url: "/api/insights/runs", headers: kapaim() });
      assert.equal(runs.status, 200);
      assert.ok(Array.isArray(runs.body.runs));
      const vote = await request(handler, { url: "/api/messages/agent-msg-1/annotate", headers: kapaim(), body: { annotation: "V" } });
      assert.equal(vote.status, 200);
      assert.deepEqual(vote.body, { ok: true, ignored: true });

      assert.deepEqual(supabaseOrigins(calls), [KAPAIM], "Kapaim's requests reach only Kapaim's Company DB");
      assert.ok(!calls.some((call) => call.origin === MAIN_DB), "never MAIN");
      const writes = calls.filter((call) => call.method !== "GET" && call.method !== "HEAD" && call.origin === KAPAIM);
      assert.deepEqual(writes.map((call) => `${call.method} ${call.url}`).filter((entry) => !/\/rpc\//.test(entry)), [], "no write to Kapaim's DB (no schema change, no new rows)");
      // The Lab dataset flag never reaches a Project connection.
      const search = calls.find((call) => /\/rpc\/hybrid_match/.test(call.url));
      assert.equal(search?.body?.project_id_filter, KAPAIM_PROJECT);
    }, { route: kapaimRoute });
  });
}
