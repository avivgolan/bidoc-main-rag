import assert from "node:assert/strict";
import { bodyOf, fakeReq, fakeRes, installFakeFetch, jsonResponse } from "./support/handler-harness.js";
import { buildSessionSetCookieHeader } from "../src/auth.js";
import { getConfig } from "../src/config.js";
import { clearCompanyDbMetaCache } from "../src/companyDb.js";
import {
  CONTRACTS_LAB_DECISION,
  REQUEST_MODE_LAB,
  REQUEST_MODE_PROJECT,
  configForMode,
  decideRequestMode,
  modeRouteRefusal,
  routeAccess,
  routeNeedsCompanyDb
} from "../src/requestMode.js";
import { annotateMessage, getProjectInsightRun, listMessages, listSessions, saveMessage, upsertChatSessionMemory } from "../src/supabase.js";

// ADR 0012: every main-agent request is exactly one mode, decided once. A Project
// request (machine secret + Project + Company DB headers) has only that Company DB
// plus the Meta settings read: no MAIN connection at all. A Lab request (Superadmin
// session) has only MAIN plus the Meta settings route: Company DB headers are
// refused. These tests drive the real handler under a fake network that records
// every host, with leftover global CONTENT_* / DATA_QUERY_* env set (it changes nothing).

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const KAPAIM_PROJECT = "33333333-3333-4333-8333-333333333333";
const COMPANY_A = "https://company-a.supabase.test";
const KAPAIM = "https://kapaim.supabase.test";
const MAIN_DB = "https://main-db.supabase.test";
const META_DB = "https://meta.supabase.test";
const GLOBAL_CONTENT = "https://global-content.supabase.test";
const BIDOC_SECRET = "test-bidoc-secret";
const INGEST_SECRET = "test-ingest-secret";
const SUPERADMIN = { id: "a0000000-0000-4000-8000-000000000006", email: "root@example.test" };

const TEST_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: BIDOC_SECRET,
  INGEST_API_SECRET: INGEST_SECRET,
  MAIN_AGENT_SESSION_SECRET: "lab-session-secret",
  SUPABASE_URL: MAIN_DB,
  SUPABASE_SERVICE_ROLE_KEY: "main-db-key",
  OPENROUTER_API_KEY: "sk-or-test-key",
  // Leftover global content / Data Query configuration must change nothing.
  CONTENT_SUPABASE_URL: GLOBAL_CONTENT,
  CONTENT_SUPABASE_SERVICE_ROLE_KEY: "global-content-key",
  DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN: "global-data-query-token",
  DATA_QUERY_SUPABASE_SERVICE_EMAIL: "global-dq@example.invalid",
  DATA_QUERY_SUPABASE_SERVICE_PASSWORD: "global-dq-password",
  META_SUPABASE_URL: undefined,
  META_SUPABASE_SERVICE_ROLE_KEY: undefined
};

function labCookie() {
  return buildSessionSetCookieHeader(SUPERADMIN).split(";")[0];
}

function projectHeaders({ url = COMPANY_A, key = "company-a-key", projectId = PROJECT_A, secret = BIDOC_SECRET, extra = {} } = {}) {
  return {
    host: "main-agent.test",
    "content-type": "application/json",
    ...(secret ? { "x-bidoc-api-secret": secret } : {}),
    "x-content-supabase-url": url,
    "x-content-supabase-key": key,
    ...(projectId ? { "x-project-id": projectId } : {}),
    ...extra
  };
}

function labHeaders(extra = {}) {
  return { host: "main-agent.test", "content-type": "application/json", cookie: labCookie(), ...extra };
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
    serverModule ||= await import("../src/server.js");
    return await fn({ handler: serverModule.default, calls: fake.calls });
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

// A Company DB that answers the way a real one does for the routes below.
const companyRoute = (origin = COMPANY_A) => (call) => {
  if (call.origin !== origin) return null;
  if (call.url.includes("/chat_sessions?")) return jsonResponse([{ session_id: "s1", project_id: PROJECT_A }]);
  return null;
};

function assertNoMain(calls, label) {
  assert.deepEqual(calls.filter((call) => call.origin === MAIN_DB).map((call) => `${call.method} ${call.url}`), [], `${label}: MAIN is never contacted (read or write)`);
  assert.ok(!dbOrigins(calls).includes(GLOBAL_CONTENT), `${label}: never the global content DB`);
}

export function registerRequestModeTests(test) {
  test("request modes: the mode is decided once from the credentials (machine secret = Project, Superadmin session = Lab)", () => {
    const env = { BIDOC_API_SECRET: BIDOC_SECRET, INGEST_API_SECRET: INGEST_SECRET };
    const req = (headers) => ({ headers });
    const session = { sub: SUPERADMIN.id, email: SUPERADMIN.email };
    assert.equal(decideRequestMode(req(projectHeaders()), { env }).mode, REQUEST_MODE_PROJECT);
    assert.equal(decideRequestMode(req(projectHeaders({ secret: INGEST_SECRET })), { env }).mode, REQUEST_MODE_PROJECT, "the engine's own secret is a Project request too");
    assert.equal(decideRequestMode(req({ host: "x" }), { env, session }).mode, REQUEST_MODE_LAB);
    // A machine secret wins over a session cookie: the cookie never opens MAIN for a Project request.
    assert.equal(decideRequestMode(req(projectHeaders()), { env, session }).mode, REQUEST_MODE_PROJECT);
    // A wrong secret is refused, never downgraded to the session.
    assert.equal(decideRequestMode(req(projectHeaders({ secret: "wrong" })), { env, session }).refusal.status, 401);
    // Company DB headers on a Lab request are refused.
    const labWithHeaders = decideRequestMode(req(projectHeaders({ secret: null })), { env, session });
    assert.equal(labWithHeaders.refusal.status, 400);
    assert.equal(labWithHeaders.refusal.error, "lab_mode_has_no_company_db");
    for (const header of ["x-content-supabase-key", "x-hybrid-rpc-name", "x-index-table", "x-alerts-table"]) {
      assert.equal(decideRequestMode(req({ host: "x", [header]: "value" }), { env, session }).refusal.error, "lab_mode_has_no_company_db", header);
    }
    // No credentials: refused.
    assert.equal(decideRequestMode(req({ host: "x" }), { env }).refusal.status, 401);
    assert.equal(decideRequestMode(req(projectHeaders({ secret: null })), { env }).refusal.status, 401);
    assert.equal(CONTRACTS_LAB_DECISION.mode, REQUEST_MODE_LAB, "the Contracts lab's fixed connection stays on the Lab side");
  });

  test("request modes: a mode's config holds only that mode's connections", () => {
    const base = { supabaseUrl: MAIN_DB, supabaseServiceRoleKey: "main-key", contentSource: { indexTable: "t", supabaseUrl: "", supabaseServiceRoleKey: "" } };
    const project = configForMode(base, REQUEST_MODE_PROJECT);
    assert.equal(project.supabaseUrl, "");
    assert.equal(project.supabaseServiceRoleKey, "");
    assert.equal(project.requestMode, REQUEST_MODE_PROJECT);
    const lab = configForMode({ ...base, contentSource: { indexTable: "t", supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "k" } }, REQUEST_MODE_LAB);
    assert.equal(lab.supabaseUrl, MAIN_DB);
    assert.equal(lab.contentSource.supabaseUrl, "", "a Lab config carries no Company DB");
    assert.equal(lab.contentSource.supabaseServiceRoleKey, "");
    assert.equal(lab.contentSource.indexTable, "t");
  });

  test("request modes: MAIN readers and writers fail closed for a Project-mode config", async () => {
    const project = { ...configForMode(getConfig(), REQUEST_MODE_PROJECT), projectId: PROJECT_A };
    const isMainRefusal = (error) => error.code === "main_unavailable_in_project_mode" && error.status === 403;
    await withServer(async ({ calls }) => {
      await assert.rejects(saveMessage({ config: project, userMessage: "hi", sanitizedMessage: "hi", sessionId: `bidoc:${PROJECT_A}:s1` }), isMainRefusal);
      await assert.rejects(annotateMessage({ config: project, messageId: "m1", annotation: "V" }), isMainRefusal);
      await assert.rejects(upsertChatSessionMemory({ config: project, sessionId: "s1", summary: { x: 1 } }), isMainRefusal);
      await assert.rejects(listSessions({ config: project }), isMainRefusal);
      await assert.rejects(listMessages({ config: project, sessionId: "s1" }), isMainRefusal);
      assert.equal(calls.length, 0, "refused before any network call");
    });
  });

  test("request modes: route access sorts every route into Project, Lab, both or shared (new routes default to Project)", () => {
    // The screens that read a Project's content are open to both modes: a Project request reads its Company DB,
    // a Lab request the Lab dataset in MAIN (ticket 05, test/lab-is-back.tests.js).
    for (const path of ["/api/chat", "/api/timeline/events", "/api/graph", "/api/insights/analyze", "/api/subagents/data-query", "/api/subagents/alert",
      "/api/index/run", "/api/schedule/alert-scan", "/api/graph/enrich", "/api/tools/meetings/test"]) {
      assert.equal(routeAccess(path), "both", path);
      assert.equal(routeNeedsCompanyDb(path), true, `${path} still names its Company DB in Project mode`);
      assert.equal(routeNeedsCompanyDb(path, REQUEST_MODE_LAB), false, `${path} needs no Company DB in Lab mode`);
    }
    assert.equal(routeAccess("/api/some-new-route"), "project", "a new route defaults to Project-only");
    assert.equal(routeNeedsCompanyDb("/api/some-new-route"), true);
    for (const path of ["/api/sessions", "/api/sessions/s1/messages", "/api/run-history", "/api/qa/runs", "/api/ai-report/abc", "/api/delay-claims", "/api/delay-events/e1",
      "/api/contracts/extract", "/api/indicator/contracts/x", "/api/dashboard/v1/overview", "/api/settings/schedule-assignment-agent/dry-run"]) {
      assert.equal(routeAccess(path), "lab", path);
      assert.equal(routeNeedsCompanyDb(path), false, path);
    }
    for (const path of ["/api/auth/login", "/api/settings", "/api/agents", "/api/knowledge/documents", "/api/openrouter/models", "/api/runs/r1/events", "/api/diagnostics/connections"]) {
      assert.equal(routeAccess(path), "shared", path);
      assert.equal(routeNeedsCompanyDb(path), false, path);
    }
    assert.equal(routeAccess("/api/messages/m1/annotate"), "both");
    assert.equal(routeNeedsCompanyDb("/api/messages/m1/annotate"), true, "a Project's annotate still names its Company DB");
    assert.equal(modeRouteRefusal(REQUEST_MODE_PROJECT, "/api/sessions").error, "route_requires_lab_mode");
    assert.equal(modeRouteRefusal(REQUEST_MODE_LAB, "/api/some-new-route").error, "route_requires_project_mode");
    assert.equal(modeRouteRefusal(REQUEST_MODE_LAB, "/api/chat"), null, "the Lab chat reads the Lab dataset in MAIN");
    assert.equal(modeRouteRefusal(REQUEST_MODE_LAB, "/api/messages/m1/annotate"), null);
    assert.equal(modeRouteRefusal(REQUEST_MODE_PROJECT, "/api/messages/m1/annotate"), null);
  });

  test("project mode: a Project request never contacts MAIN across chat, insights, indexing, schedule scan, data query and annotate", async () => {
    await withServer(async ({ handler, calls }) => {
      const steps = [
        ["chat", { url: "/api/chat", headers: projectHeaders(), body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${PROJECT_A}:s1`, projectId: PROJECT_A } }, [200]],
        ["chat without a session id", { url: "/api/chat", headers: projectHeaders(), body: { message: "hello there" } }, [200]],
        ["insights analyze", { url: "/api/insights/analyze", headers: projectHeaders(), body: { focusQuery: "delays", limit: 5 } }, [200, 500]],
        ["insights runs", { url: "/api/insights/runs", method: "GET", headers: projectHeaders() }, [200]],
        ["insights hashtags", { url: "/api/insights/hashtags", method: "GET", headers: projectHeaders() }, [200, 500]],
        ["indexing", { url: "/api/index/run", headers: projectHeaders({ secret: INGEST_SECRET }), body: { dryRun: true, tables: ["emails"], limit: 5 } }, [200]],
        ["schedule alert scan", { url: "/api/schedule/alert-scan", headers: projectHeaders({ secret: INGEST_SECRET }), body: { projectId: PROJECT_A } }, [200, 400, 500]],
        ["data query", { url: "/api/subagents/data-query", headers: projectHeaders(), body: { question: "How many alerts are there?", projectId: PROJECT_A } }, [200, 400]],
        ["alerts", { url: "/api/subagents/alert", headers: projectHeaders(), body: { query: "open alerts" } }, [200]],
        ["timeline", { url: "/api/timeline/events?limit=5", method: "GET", headers: projectHeaders() }, [200]],
        ["annotate", { url: "/api/messages/agent-msg-1/annotate", headers: projectHeaders(), body: { annotation: "V" } }, [200]],
        ["settings read", { url: "/api/settings", method: "GET", headers: projectHeaders() }, [200]],
        ["diagnostics", { url: "/api/diagnostics/connections", headers: projectHeaders(), body: { ids: ["app_supabase_rest"] } }, [200]]
      ];
      for (const [label, options, statuses] of steps) {
        const start = calls.length;
        const result = await request(handler, options);
        assert.ok(statuses.includes(result.status), `${label}: status ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
        const used = calls.slice(start);
        assertNoMain(used, label);
        for (const origin of dbOrigins(used)) assert.equal(origin, COMPANY_A, `${label}: only Company A (${origin})`);
      }
      assertNoMain(calls, "the whole battery");
      assert.ok(calls.some((call) => call.origin === COMPANY_A), "the Project's Company DB was used");
    }, { route: companyRoute() });
  });

  test("project mode: chat stores nothing of its own (no chat copy, no memory, no message id) and returns the answer", async () => {
    await withServer(async ({ handler, calls }) => {
      const result = await request(handler, {
        url: "/api/chat",
        headers: projectHeaders(),
        body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${PROJECT_A}:s1`, projectId: PROJECT_A }
      });
      assert.equal(result.status, 200, JSON.stringify(result.body).slice(0, 300));
      assert.equal(typeof result.body.answer, "string");
      assert.equal(result.body.messageId, null, "no main-agent message row exists, so no id");
      assert.ok(result.body.runTrace, "the compact trace still travels with the answer");
      const writes = calls.filter((call) => call.method !== "GET" && call.method !== "HEAD" && call.origin.includes("supabase.test"));
      assert.deepEqual(writes.map((call) => `${call.method} ${call.url}`).filter((entry) => !/\/rpc\//.test(entry)), [], "a Project chat writes nothing to any database");
      assert.ok(!calls.some((call) => /chat_messages_gf|chat_session_memory|chat_memory_items/.test(call.url)));
    }, { route: companyRoute() });
  });

  test("project mode: annotate is accepted and ignored, writes nothing, and never reads MAIN (BiDoc keeps the vote on its own chat message)", async () => {
    await withServer(async ({ handler, calls }) => {
      for (const annotation of ["V", "X", null]) {
        const result = await request(handler, { url: "/api/messages/agent-msg-1/annotate", headers: projectHeaders(), body: { annotation } });
        assert.equal(result.status, 200);
        assert.equal(result.body.ok, true, "the same success answer BiDoc always got");
        assert.equal(result.body.ignored, true);
      }
      const noProject = await request(handler, { url: "/api/messages/agent-msg-1/annotate", headers: projectHeaders({ projectId: null }), body: { annotation: "V" } });
      assert.equal(noProject.status, 400, "a Project annotate still names its Project and Company DB");
      assert.equal(noProject.body.error, "company_db_required");
      assert.equal(calls.length, 0, "no database call at all");
    });
  });

  test("project mode: Lab-only routes are refused with no database call, even with a valid Lab cookie next to the machine secret", async () => {
    await withServer(async ({ handler, calls }) => {
      const routes = [
        ["GET", "/api/sessions"], ["GET", "/api/sessions/s1/messages"], ["GET", "/api/run-history"], ["GET", "/api/qa/runs"], ["POST", "/api/qa/trends"],
        ["POST", "/api/ai-report/m1/run"], ["GET", "/api/ai-report/m1"], ["GET", "/api/delay-claims"], ["POST", "/api/delay-claims"],
        ["GET", "/api/contracts/workspaces"], ["GET", "/api/dashboard/v1/projects"], ["GET", "/api/lab/dataset"], ["GET", "/api/memory/stats"],
        ["GET", "/api/schedule/activity-updates/assignment-agent/reviews?projectId=" + PROJECT_A]
      ];
      for (const withCookie of [false, true]) {
        for (const [method, url] of routes) {
          // The Contracts lab refuses Company DB headers with its own error before anything else, so it gets the secret alone.
          const secretOnly = /^\/api\/contracts\//.test(url);
          const headers = secretOnly
            ? { host: "main-agent.test", "content-type": "application/json", "x-bidoc-api-secret": BIDOC_SECRET, ...(withCookie ? { cookie: labCookie() } : {}) }
            : projectHeaders({ extra: withCookie ? { cookie: labCookie() } : {} });
          const result = await request(handler, { method, url, headers, body: method === "POST" ? {} : null });
          // The Contracts lab's own entry still asks for its session first (401); every other Lab route says why (403).
          const contractsWithoutSession = !withCookie && /^\/api\/contracts\/workspaces/.test(url);
          assert.equal(result.status, contractsWithoutSession ? 401 : 403, `${method} ${url}${withCookie ? " (with cookie)" : ""}: ${JSON.stringify(result.body)}`);
          if (!contractsWithoutSession) assert.equal(result.body.error, "route_requires_lab_mode");
        }
      }
      const save = await request(handler, { method: "PUT", url: "/api/settings", headers: projectHeaders({ extra: { cookie: labCookie() } }), body: { timezone: "UTC" } });
      assert.equal(save.status, 403, "a session cookie never lets a Project request save settings");
      assert.equal(save.body.error, "settings_lab_only");
      assert.equal(calls.length, 0, "refused before any database call");
    });
  });

  test("lab mode: a Lab request works on MAIN and never contacts a Company DB", async () => {
    const route = (call) => {
      if (call.origin === MAIN_DB && /chat_messages_gf\?id=eq\.msg-1/.test(call.url) && call.method === "PATCH") return jsonResponse([{ id: "msg-1", annotation: "V" }]);
      return null;
    };
    await withServer(async ({ handler, calls }) => {
      const sessions = await request(handler, { method: "GET", url: "/api/sessions", headers: labHeaders() });
      assert.equal(sessions.status, 200);
      const history = await request(handler, { method: "GET", url: "/api/run-history", headers: labHeaders() });
      assert.equal(history.status, 200);
      const messages = await request(handler, { method: "GET", url: "/api/sessions/s1/messages", headers: labHeaders() });
      assert.equal(messages.status, 200);
      const annotate = await request(handler, { url: "/api/messages/msg-1/annotate", headers: labHeaders(), body: { annotation: "V" } });
      assert.equal(annotate.status, 200);
      assert.equal(annotate.body.ok, true);
      assert.equal(annotate.body.ignored, undefined, "a Lab vote is really written");
      const settings = await request(handler, { method: "GET", url: "/api/settings", headers: labHeaders() });
      assert.equal(settings.status, 200);
      const agents = await request(handler, { method: "GET", url: "/api/agents", headers: labHeaders() });
      assert.equal(agents.status, 200);
      const diagnostics = await request(handler, { url: "/api/diagnostics/connections", headers: labHeaders(), body: { ids: ["app_supabase_rest", "content_supabase_index_table"] } });
      assert.equal(diagnostics.status, 200);
      const session = await request(handler, { method: "GET", url: "/api/auth/session", headers: labHeaders() });
      assert.equal(session.body.authenticated, true);

      for (const origin of dbOrigins(calls)) assert.equal(origin, MAIN_DB, `a Lab request reaches only MAIN (${origin})`);
      assert.ok(calls.some((call) => call.origin === MAIN_DB && call.method === "PATCH"), "the Lab vote was written to MAIN");
      assert.ok(!calls.some((call) => call.origin === GLOBAL_CONTENT || call.origin === COMPANY_A));
    }, { route });
  });

  test("lab mode: Company DB headers on a Lab request are refused before any database call", async () => {
    await withServer(async ({ handler, calls }) => {
      for (const extra of [
        { "x-content-supabase-url": COMPANY_A, "x-content-supabase-key": "company-a-key", "x-project-id": PROJECT_A },
        { "x-content-supabase-url": COMPANY_A },
        { "x-content-supabase-key": "company-a-key" },
        { "x-index-table": "data_index" },
        { "x-alerts-table": "alerts" },
        { "x-hybrid-rpc-name": "hybrid_match" }
      ]) {
        for (const [method, url] of [["GET", "/api/sessions"], ["GET", "/api/settings"], ["POST", "/api/chat"], ["GET", "/api/timeline/events"], ["POST", "/api/messages/m1/annotate"]]) {
          const result = await request(handler, { method, url, headers: labHeaders(extra), body: method === "POST" ? { message: "hi", annotation: "V" } : null });
          assert.equal(result.status, 400, `${method} ${url} ${JSON.stringify(extra)}: ${JSON.stringify(result.body)}`);
          assert.equal(result.body.error, "lab_mode_has_no_company_db");
        }
      }
      assert.equal(calls.length, 0, "no database call at all");
    });
  });

  test("lab mode: a route no mode owns (a new route) has no Company DB to read and is refused without a call", async () => {
    await withServer(async ({ handler, calls }) => {
      for (const [method, url] of [["POST", "/api/some-new-route"], ["GET", "/api/some-new-route"], ["POST", "/api/system/restart"]]) {
        const result = await request(handler, { method, url, headers: labHeaders(), body: method === "POST" ? { message: "hi" } : null });
        assert.equal(result.status, 403, `${method} ${url}: ${JSON.stringify(result.body)}`);
        assert.equal(result.body.error, "route_requires_project_mode");
      }
      assert.equal(calls.length, 0, "refused before any database call");
    });
  });

  test("request modes: no credentials, or a wrong machine secret, is refused before any database call", async () => {
    await withServer(async ({ handler, calls }) => {
      const none = await request(handler, { url: "/api/chat", headers: { host: "main-agent.test" }, body: { message: "hi" } });
      assert.equal(none.status, 401);
      const wrong = await request(handler, { url: "/api/chat", headers: projectHeaders({ secret: "wrong" }), body: { message: "hi" } });
      assert.equal(wrong.status, 401);
      const wrongWithCookie = await request(handler, { url: "/api/chat", headers: projectHeaders({ secret: "wrong", extra: { cookie: labCookie() } }), body: { message: "hi" } });
      assert.equal(wrongWithCookie.status, 401, "a wrong machine secret is never rescued by a session cookie");
      const headersOnly = await request(handler, { url: "/api/timeline/events", method: "GET", headers: projectHeaders({ secret: null }) });
      assert.equal(headersOnly.status, 401, "Company DB headers without the secret are not an identity");
      assert.equal(calls.length, 0);
    });
  });

  test("project mode: insight runs are looked up and written by run id AND Project", async () => {
    const OTHER_RUN = "run-of-another-project";
    const route = (call) => {
      if (call.origin === COMPANY_A && call.method === "GET" && call.url.includes("/project_insight_runs?")) {
        return jsonResponse(call.url.includes(`run_id=eq.${OTHER_RUN}`) && !call.url.includes(`project_id=eq.${PROJECT_A}`)
          ? [{ run_id: OTHER_RUN, project_id: "99999999-9999-4999-8999-999999999999", insights: [] }]
          : []);
      }
      return null;
    };
    await withServer(async ({ handler, calls }) => {
      const config = { ...configForMode(getConfig(), REQUEST_MODE_PROJECT), projectId: PROJECT_A, contentSource: { supabaseUrl: COMPANY_A, supabaseServiceRoleKey: "company-a-key" } };
      const found = await getProjectInsightRun({ config, runId: OTHER_RUN });
      assert.equal(found, null, "another Project's run is not found through this Project");
      const lookup = calls.find((call) => call.url.includes("/project_insight_runs?"));
      assert.match(lookup.url, new RegExp(`run_id=eq.${OTHER_RUN}`));
      assert.match(lookup.url, new RegExp(`project_id=eq.${PROJECT_A}`));

      const start = calls.length;
      const analyze = await request(handler, { url: "/api/insights/analyze", headers: projectHeaders(), body: { focusQuery: "delays", limit: 5, runId: "run-a-1", parentRunId: OTHER_RUN } });
      assert.ok([200, 500].includes(analyze.status), JSON.stringify(analyze.body).slice(0, 300));
      const runCalls = calls.slice(start).filter((call) => call.url.includes("/project_insight_runs"));
      assert.ok(runCalls.length > 0);
      for (const call of runCalls) {
        if (call.method === "POST") assert.equal(call.body.project_id, PROJECT_A, "a new run row carries the request Project");
        else assert.match(call.url, new RegExp(`project_id=eq.${PROJECT_A}`), `${call.method} ${call.url} is scoped to the Project`);
      }
      assertNoMain(calls.slice(start), "insight run persistence");
    }, { route });
  });

  registerKapaimRequestModeRegressionTests(test);
}

function registerKapaimRequestModeRegressionTests(test) {
  test("kapaim regression: a Kapaim-shaped Project request for chat, insights and annotate behaves the same for its users, on Kapaim's own DB only", async () => {
    const kapaimHeaders = projectHeaders({
      url: KAPAIM,
      key: "kapaim-key",
      projectId: KAPAIM_PROJECT,
      extra: { "x-index-table": "data_index", "x-alerts-table": "alerts", "x-hybrid-rpc-name": "hybrid_match_data_index" }
    });
    await withServer(async ({ handler, calls }) => {
      const chat = await request(handler, {
        url: "/api/chat",
        headers: kapaimHeaders,
        body: { message: "What happened with the concrete pour last week?", sessionId: `bidoc:${KAPAIM_PROJECT}:s1`, projectId: KAPAIM_PROJECT }
      });
      assert.equal(chat.status, 200, JSON.stringify(chat.body).slice(0, 300));
      for (const field of ["messageId", "status", "type", "answer", "sources", "followUps", "toolCalls", "runTrace", "runId"]) {
        assert.ok(field in chat.body, `the chat answer still carries ${field}`);
      }
      assert.equal(chat.body.status, "complete");
      assert.equal(typeof chat.body.answer, "string");
      assert.equal(chat.body.messageId, null, "BiDoc stores a null agent_message_id and keeps the vote on its own chat message");

      const insights = await request(handler, { method: "GET", url: "/api/insights/runs", headers: kapaimHeaders });
      assert.equal(insights.status, 200, JSON.stringify(insights.body).slice(0, 300));
      assert.ok(Array.isArray(insights.body.runs));

      // A Kapaim message that still carries an old agent_message_id: BiDoc's proxy call succeeds exactly as before.
      const annotate = await request(handler, { url: "/api/messages/legacy-agent-msg/annotate", headers: kapaimHeaders, body: { annotation: "X" } });
      assert.equal(annotate.status, 200);
      assert.equal(annotate.body.ok, true);

      assert.deepEqual(dbOrigins(calls), [KAPAIM], "only Kapaim's own Company DB is contacted");
      assertNoMain(calls, "kapaim");
      for (const call of calls.filter((item) => item.origin === KAPAIM)) {
        const parsed = new URL(call.url);
        assert.ok(parsed.pathname.startsWith("/rest/v1/"), `Kapaim is reached only through its data API (${parsed.pathname})`);
        assert.ok(["GET", "POST", "HEAD"].includes(call.method), `no Kapaim schema or row change from main-agent (${call.method} ${parsed.pathname})`);
        assert.ok(!/chat_messages|chat_sessions/.test(parsed.pathname) || call.method === "GET", "main-agent only reads BiDoc's chat tables");
      }
    });
  });

  test("request modes: restore the environment", () => {
    clearCompanyDbMetaCache();
    restoreEnv();
  });
}
