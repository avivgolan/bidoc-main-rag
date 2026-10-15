import assert from "node:assert/strict";
import { bodyOf, fakeReq, fakeRes, installFakeFetch, jsonResponse } from "./support/handler-harness.js";
import {
  clearCompanyDbMetaCache,
  companyDbConnection,
  normalizeCompanyDbUrl,
  readCompanyDbHeaders,
  verifyCompanyDbAgainstMeta
} from "../src/companyDb.js";
import { getConfig } from "../src/config.js";
import { contentSupabaseConfig } from "../src/supabase.js";

// The rule: everything main-agent does for a Project reads and writes ONLY
// that Project's own Company DB, named by the authenticated caller's
// x-content-supabase-* headers. Never another Company's DB, never a global
// content DB (CONTENT_SUPABASE_*), never the App DB as content, and never the
// global Data Query service account. No Company DB → refused, no DB call.

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const KAPAIM_PROJECT = "33333333-3333-4333-8333-333333333333";
const COMPANY_A = "https://company-a.supabase.test";
const COMPANY_B = "https://company-b.supabase.test";
const KAPAIM = "https://kapaim.supabase.test";
const GLOBAL_CONTENT = "https://global-content.supabase.test";
const APP_DB = "https://app-db.supabase.test";
const META_DB = "https://meta.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";
const INGEST_SECRET = "test-ingest-secret";
const GLOBAL_DQ_TOKEN = "global-data-query-token";

const TEST_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  INGEST_API_SECRET: INGEST_SECRET,
  SUPABASE_URL: APP_DB,
  SUPABASE_SERVICE_ROLE_KEY: "app-db-key",
  OPENROUTER_API_KEY: "sk-or-test-key",
  // Leftover global content / Data Query configuration must be ignored.
  CONTENT_SUPABASE_URL: GLOBAL_CONTENT,
  CONTENT_SUPABASE_SERVICE_ROLE_KEY: "global-content-key",
  DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN: GLOBAL_DQ_TOKEN,
  DATA_QUERY_SUPABASE_SERVICE_EMAIL: "global-dq@example.invalid",
  DATA_QUERY_SUPABASE_SERVICE_PASSWORD: "global-dq-password",
  META_SUPABASE_URL: undefined,
  META_SUPABASE_SERVICE_ROLE_KEY: undefined
};

function companyHeaders({ url = COMPANY_A, key = "company-a-key", projectId = PROJECT_A, secret = BIDOC_SECRET, extra = {} } = {}) {
  return {
    host: "main-agent.test",
    "content-type": "application/json",
    ...(secret ? { "x-bidoc-api-secret": secret } : {}),
    ...(url !== null ? { "x-content-supabase-url": url } : {}),
    ...(key !== null ? { "x-content-supabase-key": key } : {}),
    ...(projectId ? { "x-project-id": projectId } : {}),
    ...extra
  };
}

const dbOrigins = (calls) => [...new Set(calls.map((call) => call.origin).filter((origin) => origin.includes("supabase.test")))];

let serverModule = null;
let savedEnv = null;

async function withServer(fn, { route } = {}) {
  if (!savedEnv) {
    savedEnv = {};
    for (const [key, value] of Object.entries(TEST_ENV)) {
      savedEnv[key] = process.env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const fake = installFakeFetch(route);
  try {
    // Imported lazily, under the fake network, with VERCEL set so it does not listen.
    serverModule ||= await import("../src/server.js");
    return await fn({ handler: serverModule.default, calls: fake.calls, server: serverModule });
  } finally {
    fake.restore();
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

async function request(handler, options) {
  const res = fakeRes();
  await handler(fakeReq(options), res);
  return { status: res.statusCode, body: bodyOf(res) };
}

function assertOnlyCompanyDb(calls, origin, label) {
  const origins = dbOrigins(calls);
  assert.ok(origins.length > 0, `${label}: expected at least one Company DB call`);
  for (const other of origins) {
    assert.ok(other === origin || other === APP_DB, `${label}: contacted ${other}; only ${origin} (and main-agent's own App DB) are allowed`);
  }
  assert.ok(!origins.includes(GLOBAL_CONTENT), `${label}: never the global content DB`);
  assert.ok(!origins.includes(COMPANY_B), `${label}: never another Company DB`);
  for (const call of calls.filter((item) => item.origin === APP_DB)) {
    assert.match(call.url, /\/rest\/v1\/(agent_settings|chat_messages_gf|chat_session_memory|chat_memory_items|qa_reports)/, `${label}: App DB is used only for main-agent's own tables (${call.url})`);
  }
}

export function registerCompanyDbIsolationTests(test) {
  test("company db: the connection comes only from the request; no global or App DB fallback", () => {
    const global = getConfig();
    assert.equal(global.contentSource.supabaseUrl, "");
    assert.equal(global.contentSource.supabaseServiceRoleKey, "");
    assert.throws(() => contentSupabaseConfig(global), (error) => error.code === "company_db_required" && error.status === 400);
    assert.throws(() => companyDbConnection({ supabaseUrl: APP_DB, supabaseServiceRoleKey: "app-key", contentSource: {} }), (error) => error.code === "company_db_required");
    assert.equal(companyDbConnection({ contentSource: { supabaseUrl: `${COMPANY_A}/`, supabaseServiceRoleKey: "k" } }).supabaseUrl, COMPANY_A);
    assert.equal(normalizeCompanyDbUrl("ftp://company"), "");
    assert.equal(normalizeCompanyDbUrl("not a url"), "");
    assert.deepEqual(readCompanyDbHeaders({ headers: { "x-content-supabase-url": COMPANY_A, "x-content-supabase-key": "k" } }), { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "k" });
    assert.equal(readCompanyDbHeaders({ headers: { "x-content-supabase-url": COMPANY_A, "x-content-supabase-key": "" } }), null);
    assert.equal(readCompanyDbHeaders({ headers: { "x-content-supabase-url": "", "x-content-supabase-key": "k" } }), null);
    assert.equal("dataQueryReadAccessToken" in global, false);
  });

  test("company db: a request without its Company DB or Project is refused before any database call", async () => {
    await withServer(async ({ handler, calls }) => {
      const before = calls.length;
      const missingKey = await request(handler, { url: "/api/timeline/events", method: "GET", headers: companyHeaders({ key: null }) });
      assert.equal(missingKey.status, 400);
      assert.equal(missingKey.body.error, "company_db_required");
      const missingProject = await request(handler, { url: "/api/subagents/alert", headers: companyHeaders({ projectId: null }), body: { query: "x" } });
      assert.equal(missingProject.status, 400);
      assert.equal(missingProject.body.error, "company_db_required");
      const badUrl = await request(handler, { url: "/api/index/run", headers: companyHeaders({ url: "not-a-url" }), body: { dryRun: true } });
      assert.equal(badUrl.status, 400);
      const noHeaders = await request(handler, { url: "/api/chat", headers: { host: "main-agent.test" }, body: { message: "hi" } });
      assert.ok([400, 401].includes(noHeaders.status), `no-header chat is refused (${noHeaders.status})`);
      assert.equal(dbOrigins(calls.slice(before)).filter((origin) => origin !== APP_DB).length, 0, "no Company/global DB call");
      assert.equal(calls.slice(before).filter((call) => call.origin !== APP_DB).length, 0, "no call at all besides settings");
    });
  });

  test("company db: Project A's retrieval, alerts, indexing and schedule alert-scan touch only Company A", async () => {
    await withServer(async ({ handler, calls }) => {
      let start = calls.length;
      const timeline = await request(handler, { url: "/api/timeline/events?limit=5", method: "GET", headers: companyHeaders() });
      assert.equal(timeline.status, 200, JSON.stringify(timeline.body));
      assertOnlyCompanyDb(calls.slice(start), COMPANY_A, "timeline");
      assert.ok(calls.slice(start).filter((call) => call.origin === COMPANY_A).every((call) => call.url.includes(`project_id=eq.${PROJECT_A}`)));

      start = calls.length;
      await request(handler, { url: "/api/subagents/alert", headers: companyHeaders(), body: { query: "open alerts" } });
      assertOnlyCompanyDb(calls.slice(start), COMPANY_A, "alerts");
      const alertRpc = calls.slice(start).find((call) => call.url.includes("/rest/v1/rpc/"));
      assert.equal(alertRpc.body.project_id_filter, PROJECT_A);

      start = calls.length;
      const index = await request(handler, { url: "/api/index/run", headers: companyHeaders({ secret: INGEST_SECRET }), body: { dryRun: true, tables: ["emails"], limit: 5 } });
      assert.equal(index.status, 200, JSON.stringify(index.body));
      assertOnlyCompanyDb(calls.slice(start), COMPANY_A, "indexing");

      start = calls.length;
      await request(handler, { url: "/api/schedule/alert-scan", headers: companyHeaders({ secret: INGEST_SECRET }), body: { projectId: PROJECT_A } });
      assertOnlyCompanyDb(calls.slice(start), COMPANY_A, "schedule alert-scan");
    });
  });

  test("company db: chat for Project A reads only Company A (plus main-agent's own App DB tables)", async () => {
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const chat = await request(handler, {
        url: "/api/chat",
        headers: companyHeaders(),
        body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${PROJECT_A}:s1`, projectId: PROJECT_A }
      });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 400));
      assertOnlyCompanyDb(calls.slice(start), COMPANY_A, "chat");
    });
  });

  test("company db: Data Query runs on the request Company DB only and never sends the global service-account token", async () => {
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const result = await request(handler, {
        url: "/api/subagents/data-query",
        headers: companyHeaders(),
        body: { question: "How many alerts are there?", projectId: PROJECT_A }
      });
      assert.ok([200, 400].includes(result.status), JSON.stringify(result.body).slice(0, 400));
      const dbCalls = calls.slice(start).filter((call) => call.origin.includes("supabase.test"));
      assert.ok(dbCalls.length > 0, "Data Query read the Company DB");
      assertOnlyCompanyDb(calls.slice(start), COMPANY_A, "data query");
      for (const call of dbCalls) {
        assert.notEqual(call.headers.Authorization, `Bearer ${GLOBAL_DQ_TOKEN}`);
        assert.equal(call.headers.apikey, "company-a-key");
        assert.ok(!call.url.includes("/auth/v1/token"), "no service-account login");
      }
    });
  });

  test("company db: two Projects in two Companies never share a connection", async () => {
    await withServer(async ({ handler, calls }) => {
      let start = calls.length;
      await request(handler, { url: "/api/timeline/events?limit=5", method: "GET", headers: companyHeaders({ url: COMPANY_B, key: "company-b-key", projectId: PROJECT_B }) });
      const bOrigins = dbOrigins(calls.slice(start)).filter((origin) => origin !== APP_DB);
      assert.deepEqual(bOrigins, [COMPANY_B]);
      start = calls.length;
      await request(handler, { url: "/api/timeline/events?limit=5", method: "GET", headers: companyHeaders() });
      assert.deepEqual(dbOrigins(calls.slice(start)).filter((origin) => origin !== APP_DB), [COMPANY_A]);
    });
  });

  test("company db: an RPC without the Project filter fails closed and is never retried unfiltered", async () => {
    const route = (call) => call.url.includes("/rest/v1/rpc/") && call.origin === COMPANY_A
      ? jsonResponse({ code: "PGRST202", message: "Could not find the function public.match_alerts(project_id_filter) in the schema cache" }, 404)
      : null;
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const result = await request(handler, { url: "/api/subagents/alert", headers: companyHeaders(), body: { query: "open alerts" } });
      assert.equal(result.body.ok, false);
      assert.match(result.body.error, /Search function out of date for this Company DB/);
      const rpcCalls = calls.slice(start).filter((call) => call.url.includes("/rest/v1/rpc/"));
      assert.equal(rpcCalls.length, 1);
      assert.equal(rpcCalls[0].body.project_id_filter, PROJECT_A);
    }, { route });
  });

  test("company db: a Kapaim-shaped request with its own Company DB headers still works", async () => {
    const indexRow = {
      id: "k1", created_at: "2026-06-01T08:00:00Z", primary_date: "2026-06-01T10:00:00Z", title: "Kapaim pour",
      source_table: "emails", source_id: "m1", project_id: KAPAIM_PROJECT
    };
    const route = (call) => call.origin === KAPAIM && call.url.includes("/rest/v1/data_index?") ? jsonResponse([indexRow]) : null;
    await withServer(async ({ handler, calls }) => {
      const start = calls.length;
      const headers = companyHeaders({
        url: KAPAIM,
        key: "kapaim-key",
        projectId: KAPAIM_PROJECT,
        extra: { "x-index-table": "data_index", "x-alerts-table": "alerts", "x-hybrid-rpc-name": "hybrid_match_data_index" }
      });
      const timeline = await request(handler, { url: "/api/timeline/events?limit=5", method: "GET", headers });
      assert.equal(timeline.status, 200, JSON.stringify(timeline.body));
      assert.deepEqual(timeline.body.events.map((event) => event.id), ["k1"]);
      const alerts = await request(handler, { url: "/api/subagents/alert", headers, body: { query: "open alerts" } });
      assert.notEqual(alerts.status, 400);
      assertOnlyCompanyDb(calls.slice(start), KAPAIM, "kapaim");
      const index = calls.slice(start).find((call) => call.url.includes("/rest/v1/data_index?"));
      assert.match(index.url, new RegExp(`project_id=eq.${KAPAIM_PROJECT}`));
    }, { route });
  });

  test("company db: routes that touch Project data need a Company DB; App DB-only routes do not", async () => {
    await withServer(async ({ server }) => {
      for (const path of ["/api/chat", "/api/timeline/events", "/api/graph", "/api/insights/analyze", "/api/subagents/data-query",
        "/api/subagents/alert", "/api/index/run", "/api/schedule/alert-scan", "/api/delay-claims", "/api/graph/enrich",
        "/api/settings/schedule-assignment-agent/dry-run", "/api/tools/meetings/test", "/api/some-new-route"]) {
        assert.equal(server.routeNeedsCompanyDb(path), true, path);
      }
      for (const path of ["/api/auth/login", "/api/sessions", "/api/run-history", "/api/messages/abc/annotate", "/api/settings",
        "/api/knowledge/documents", "/api/contracts/extract", "/api/qa/runs", "/api/runs/r1/events"]) {
        assert.equal(server.routeNeedsCompanyDb(path), false, path);
      }
    });
  });

  test("company db: optional Meta DB cross-check refuses a Company DB that is not the Project's own", async () => {
    const env = { META_SUPABASE_URL: META_DB, META_SUPABASE_SERVICE_ROLE_KEY: "meta-key" };
    const metaFetch = (overrides = {}) => async (url) => {
      const parsed = new URL(String(url));
      if (overrides.down) return jsonResponse({ message: "down" }, 503);
      if (parsed.pathname.endsWith("/projects")) return jsonResponse(parsed.searchParams.get("id") === `eq.${PROJECT_A}` ? [{ company_id: "company-a" }] : []);
      if (parsed.pathname.endsWith("/companies")) return jsonResponse([{ supabase_url: COMPANY_A }]);
      if (parsed.pathname.endsWith("/company_credentials")) return jsonResponse([{ supabase_service_role_key: "company-a-key" }]);
      return jsonResponse([], 404);
    };
    clearCompanyDbMetaCache();
    assert.deepEqual(await verifyCompanyDbAgainstMeta({ projectId: PROJECT_A, connection: { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "x" }, env: {} }), { checked: false });
    const ok = await verifyCompanyDbAgainstMeta({ projectId: PROJECT_A, connection: { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "company-a-key" }, env, fetchImpl: metaFetch() });
    assert.equal(ok.checked, true);
    await assert.rejects(
      verifyCompanyDbAgainstMeta({ projectId: PROJECT_A, connection: { supabaseUrl: COMPANY_B, supabaseServiceRoleKey: "company-a-key" }, env, fetchImpl: metaFetch() }),
      (error) => error.code === "company_db_mismatch" && error.status === 403
    );
    await assert.rejects(
      verifyCompanyDbAgainstMeta({ projectId: PROJECT_A, connection: { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "company-b-key" }, env, fetchImpl: metaFetch() }),
      (error) => error.code === "company_db_mismatch"
    );
    await assert.rejects(
      verifyCompanyDbAgainstMeta({ projectId: PROJECT_B, connection: { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "company-a-key" }, env, fetchImpl: metaFetch() }),
      (error) => error.code === "company_db_mismatch"
    );
    clearCompanyDbMetaCache();
    await assert.rejects(
      verifyCompanyDbAgainstMeta({ projectId: PROJECT_A, connection: { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "company-a-key" }, env, fetchImpl: metaFetch({ down: true }) }),
      (error) => error.code === "company_db_unverified" && error.status === 503
    );
  });

  test("company db: with the Meta DB configured, the HTTP gate refuses a mismatched Company DB before reading it", async () => {
    const route = (call) => {
      if (call.origin !== META_DB) return null;
      const parsed = new URL(call.url);
      if (parsed.pathname.endsWith("/projects")) return jsonResponse([{ company_id: "company-a" }]);
      if (parsed.pathname.endsWith("/companies")) return jsonResponse([{ supabase_url: COMPANY_A }]);
      if (parsed.pathname.endsWith("/company_credentials")) return jsonResponse([{ supabase_service_role_key: "company-a-key" }]);
      return jsonResponse([], 404);
    };
    await withServer(async ({ handler, calls }) => {
      process.env.META_SUPABASE_URL = META_DB;
      process.env.META_SUPABASE_SERVICE_ROLE_KEY = "meta-key";
      clearCompanyDbMetaCache();
      try {
        let start = calls.length;
        const refused = await request(handler, { url: "/api/timeline/events?limit=5", method: "GET", headers: companyHeaders({ url: COMPANY_B, key: "company-b-key" }) });
        assert.equal(refused.status, 403);
        assert.equal(refused.body.error, "company_db_mismatch");
        assert.equal(calls.slice(start).some((call) => call.origin === COMPANY_B), false, "the mismatched Company DB is never read");
        start = calls.length;
        const allowed = await request(handler, { url: "/api/timeline/events?limit=5", method: "GET", headers: companyHeaders() });
        assert.equal(allowed.status, 200);
        assert.ok(calls.slice(start).some((call) => call.origin === COMPANY_A));
      } finally {
        delete process.env.META_SUPABASE_URL;
        delete process.env.META_SUPABASE_SERVICE_ROLE_KEY;
        clearCompanyDbMetaCache();
        restoreEnv();
      }
    }, { route });
  });
}
