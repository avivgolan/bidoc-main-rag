import assert from "node:assert/strict";
import fs from "node:fs";
import { authorizeBidocRead, checkBidocSecretHeader, isBidocContextRequest } from "../src/apiSecurity.js";
import { chatSessionInProject, chatSessionProjectId, resolveScopedProjectId } from "../src/projectScope.js";
import { createRun, getRunProjectId, listLocalRunHistory, recordRunHistory, runVisibleToRequest, subscribeRun } from "../src/runLog.js";
import { fetchLegacyAlertsTimelineEvents, listRunHistory, listSessions } from "../src/supabase.js";
import { runEmbeddingBackfill, runIndexDatesBackfill } from "../src/subagents/indexing.js";
import { listScheduleProjects } from "../src/scheduleIngestion.js";
import { QaHarnessService } from "../src/qa/qaHarnessService.js";
import { InMemoryQaRepository } from "../src/qa/inMemoryQaRepository.js";
import { createHttpQaContext } from "../src/mcp/context.js";

// Follow-up to internal-scope.tests.js: fail-closed BiDoc secret, Project-bound
// run streams, data-query / schedule / index Project resolution, and App DB
// chat history that a BiDoc caller may only see for its own Project.

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const CONTENT_URL = "https://content.supabase.test";
const APP_URL = "https://app.supabase.test";

function baseConfig(overrides = {}) {
  return {
    openRouterApiKey: "openrouter-test-key",
    supabaseUrl: APP_URL,
    supabaseServiceRoleKey: "app-key",
    contentSource: {
      supabaseUrl: CONTENT_URL,
      supabaseServiceRoleKey: "content-key",
      indexTable: "content_index",
      alertsTable: "alerts"
    },
    models: { embedding: "openai/text-embedding-3-large" },
    retrieval: { candidates: 5 },
    ...overrides
  };
}

const scoped = (overrides = {}) => baseConfig({ projectId: PROJECT_A, ...overrides });

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function withFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: decodeURIComponent(String(url)), method: String(options.method || "GET").toUpperCase() };
    calls.push(call);
    return handler(call);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function fakeResponse() {
  return { chunks: [], ended: false, write(chunk) { this.chunks.push(chunk); }, end() { this.ended = true; } };
}

const serverSource = () => fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

function routeSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `route marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `route end marker not found: ${endMarker}`);
  return source.slice(start, end);
}

const crossTenant = (headers = {}) => ({ headers: { "x-content-supabase-url": CONTENT_URL, ...headers } });

export function registerInternalScopeAccessTests(test) {
  test("internal access: the BiDoc secret check fails closed when no machine secret is configured", () => {
    const req = crossTenant({ "x-bidoc-api-secret": "" });
    assert.equal(checkBidocSecretHeader(req, {}), false);
    assert.equal(checkBidocSecretHeader(crossTenant({ "x-bidoc-api-secret": "anything" }), {}), false);
    assert.equal(checkBidocSecretHeader(crossTenant({ "x-bidoc-api-secret": "web" }), { BIDOC_API_SECRET: "web" }), true);
    assert.equal(checkBidocSecretHeader(crossTenant({ "x-bidoc-api-secret": "engine" }), { INGEST_API_SECRET: "engine" }), true);
    assert.equal(checkBidocSecretHeader(crossTenant({ "x-bidoc-api-secret": "wrong" }), { BIDOC_API_SECRET: "web" }), false);

    assert.equal(isBidocContextRequest(crossTenant()), true);
    assert.equal(isBidocContextRequest({ headers: {} }), false);
    // Cross-tenant reads need the secret; same-origin reads need the UI session.
    assert.equal(authorizeBidocRead(crossTenant(), { env: {}, hasSession: true }), false);
    assert.equal(authorizeBidocRead(crossTenant({ "x-bidoc-api-secret": "web" }), { env: { BIDOC_API_SECRET: "web" } }), true);
    assert.equal(authorizeBidocRead({ headers: {} }, { env: {}, hasSession: false }), false);
    assert.equal(authorizeBidocRead({ headers: {} }, { env: {}, hasSession: true }), true);

    const source = serverSource();
    const check = source.match(/function checkBidocSecret\(req\) \{[\s\S]*?\n\}/)?.[0] || "";
    assert.doesNotMatch(check, /return true/);
    assert.match(check, /checkBidocSecretHeader\(req\)/);
    const read = source.match(/function checkBidocSecretForRead\(req\) \{[\s\S]*?\n\}/)?.[0] || "";
    assert.match(read, /authorizeBidocRead\(req, \{ hasSession: Boolean\(getSuperadminSession\(req\)\) \}\)/);
  });

  test("internal access: chat session ids name their Project", () => {
    assert.equal(chatSessionProjectId(`bidoc:${PROJECT_A}:sess-1`), PROJECT_A);
    assert.equal(chatSessionProjectId("session_123"), null);
    assert.equal(chatSessionProjectId("bidoc::x"), null);
    assert.equal(chatSessionInProject(`bidoc:${PROJECT_A}:sess-1`, PROJECT_A), true);
    assert.equal(chatSessionInProject(`bidoc:${PROJECT_A.toUpperCase()}:sess-1`, PROJECT_A), true);
    assert.equal(chatSessionInProject(`bidoc:${PROJECT_B}:sess-1`, PROJECT_A), false);
    assert.equal(chatSessionInProject("session_123", PROJECT_A), false);
    assert.equal(chatSessionInProject(`bidoc:${PROJECT_A}:x`, null), false);
  });

  test("internal access: a route or body Project must agree with the request Project", () => {
    assert.equal(resolveScopedProjectId(PROJECT_A, null), PROJECT_A);
    assert.equal(resolveScopedProjectId(null, PROJECT_B), PROJECT_B);
    assert.equal(resolveScopedProjectId(PROJECT_A, PROJECT_A.toUpperCase()), PROJECT_A);
    assert.equal(resolveScopedProjectId(null, ""), null);
    assert.throws(() => resolveScopedProjectId(PROJECT_A, PROJECT_B), (error) => error.code === "project_mismatch" && error.status === 400);
  });

  test("internal access: runs record their Project and a BiDoc caller follows only its own", () => {
    const runId = `run_scope_${Date.now()}`;
    createRun(runId, { projectId: PROJECT_A });
    assert.equal(getRunProjectId(runId), PROJECT_A);
    assert.equal(runVisibleToRequest(runId, { bidocContext: true, projectId: PROJECT_A }), true);
    assert.equal(runVisibleToRequest(runId, { bidocContext: true, projectId: PROJECT_B }), false);
    assert.equal(runVisibleToRequest(runId, { bidocContext: true, projectId: null }), false);
    // The superadmin UI keeps following any run.
    assert.equal(runVisibleToRequest(runId, { bidocContext: false, projectId: null }), true);

    const unscopedRun = `run_unscoped_${Date.now()}`;
    createRun(unscopedRun);
    assert.equal(getRunProjectId(unscopedRun), null);
    assert.equal(runVisibleToRequest(unscopedRun, { bidocContext: true, projectId: PROJECT_A }), false);
    assert.equal(runVisibleToRequest("run_never_created", { bidocContext: true, projectId: PROJECT_A }), false);

    // Re-creating a runId for another Project never streams into the old
    // Project's subscribers.
    const res = fakeResponse();
    subscribeRun(runId, res);
    createRun(runId, { projectId: PROJECT_B });
    assert.equal(res.ended, true);
    assert.equal(getRunProjectId(runId), PROJECT_B);

    recordRunHistory({ id: runId, title: "B run" });
    recordRunHistory({ id: unscopedRun, title: "UI run" });
    const forA = listLocalRunHistory({ limit: 50, projectId: PROJECT_A });
    const forB = listLocalRunHistory({ limit: 50, projectId: PROJECT_B });
    assert.ok(!forA.some((run) => run.id === runId || run.id === unscopedRun));
    assert.ok(forB.some((run) => run.id === runId));
    assert.ok(!forB.some((run) => run.id === unscopedRun));
    assert.ok(listLocalRunHistory({ limit: 50 }).some((run) => run.id === unscopedRun));
  });

  test("internal access: run stream, chat, data-query and App DB routes enforce the request Project", () => {
    const source = serverSource();
    const stream = routeSource(source, 'url.pathname.startsWith("/api/runs/") && url.pathname.endsWith("/events")', "res.writeHead(200");
    assert.match(stream, /runVisibleToRequest\(runId, \{ bidocContext: isBidocContextRequest\(req\), projectId: requestScopeProjectId\(req\) \}\)/);
    assert.match(stream, /sendJson\(res, 404/);

    const chat = routeSource(source, 'url.pathname === "/api/chat")', 'url.pathname === "/api/sessions")');
    assert.match(chat, /createRun\(runId, \{ projectId: requestProjectId\(cfg\) \}\)/);
    assert.match(chat, /chatSessionInProject\(/);

    const dataQuery = routeSource(source, 'url.pathname === "/api/subagents/data-query")', "annotate$/.test");
    assert.match(dataQuery, /buildRequestConfig\(req\)/);
    assert.match(dataQuery, /resolveScopedProjectId\(/);
    assert.doesNotMatch(dataQuery, /config: config\(\)/);

    const appDb = [
      ['url.pathname === "/api/sessions")', 'url.pathname === "/api/run-history")'],
      ['url.pathname === "/api/run-history")', 'url.pathname === "/api/evaluations/run")'],
      ["const messagesMatch", 'url.pathname === "/api/settings")'],
      ["/^\\/api\\/messages\\/[^/]+\\/annotate$/", 'url.pathname === "/api/timeline")'],
      ["const aiReportRunMatch", "const qaReportMatch"]
    ];
    for (const [start, end] of appDb) {
      const route = routeSource(source, start, end);
      assert.match(route, /bidocChatScope\(req\)|chatMessageVisible\(/, `${start} must scope BiDoc callers to their Project`);
    }

    // Annotate: a BiDoc caller must name its Project (BiDoc PR #85 sends
    // x-project-id) and may only annotate messages of that Project's sessions.
    const annotate = routeSource(source, "/^\\/api\\/messages\\/[^/]+\\/annotate$/", 'url.pathname === "/api/timeline")');
    assert.match(annotate, /if \(chatScope\.bidoc && !chatScope\.projectId\) return projectRequired\(res\);/);
    assert.match(annotate, /chatMessageVisible\(chatScope, message\)/);
    assert.doesNotMatch(annotate, /chatSessionProjectId\(/, "no tag-only fallback without a Project");

    const qa = routeSource(source, 'url.pathname.startsWith("/api/qa/")', 'url.pathname === "/api/chat")');
    assert.match(qa, /bidocChatScope\(req\)/);
    assert.match(qa, /createHttpQaContext\(req, \{ session: getSuperadminSession\(req\), projectId:/);
  });

  test("internal access: schedule routes resolve their Project against the request Project", () => {
    const source = serverSource();
    const schedule = routeSource(source, 'url.pathname === "/api/schedule/indicator")', "const subagentConfigMatch");
    const routes = schedule.split(/\n  if \(req\.method === |\n  const assignmentRunMatch/).filter((part) => /config: buildRequestConfig\(req/.test(part));
    assert.ok(routes.length >= 10, `expected the BiDoc-reachable schedule routes, got ${routes.length}`);
    for (const route of routes) {
      if (/schedule\/projects"/.test(route)) continue;
      assert.match(route, /scheduleRouteProjectId\(req, /, `schedule route must resolve its Project: ${route.slice(0, 80)}`);
    }
  });

  test("internal access: App DB chat history lists only the Project's tagged sessions", async () => {
    const rows = [
      { session_id: `bidoc:${PROJECT_A}:s1`, created_at: "2026-10-01", user_message: "a" },
      { session_id: `bidoc:${PROJECT_B}:s2`, created_at: "2026-10-01", user_message: "b" },
      { session_id: "session_1", created_at: "2026-10-01", user_message: "ui" }
    ];
    await withFetch(() => jsonResponse(rows), async (calls) => {
      const sessions = await listSessions({ config: baseConfig(), sessionPrefix: `bidoc:${PROJECT_A}:` });
      assert.match(calls[0].url, new RegExp(`session_id=like\\.bidoc:${PROJECT_A}:\\*`));
      assert.deepEqual(sessions.map((item) => item.sessionId), [`bidoc:${PROJECT_A}:s1`]);
      const history = await listRunHistory({ config: baseConfig(), sessionPrefix: `bidoc:${PROJECT_A}:` });
      assert.match(calls[1].url, new RegExp(`session_id=like\\.bidoc:${PROJECT_A}:\\*`));
      assert.deepEqual(history.map((item) => item.session_id), [`bidoc:${PROJECT_A}:s1`]);
      const all = await listSessions({ config: baseConfig() });
      assert.equal(all.length, 3);
      assert.doesNotMatch(calls[2].url, /session_id=like/);
    });
  });

  test("internal access: legacy alert reads by id are Project-filtered", async () => {
    await withFetch(() => jsonResponse([]), async (calls) => {
      await fetchLegacyAlertsTimelineEvents({ config: scoped(), ids: ["alert_1", "2"] });
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, new RegExp(`project_id=eq\\.${PROJECT_A}`));
      await fetchLegacyAlertsTimelineEvents({ config: baseConfig(), ids: ["3"] });
      assert.doesNotMatch(calls[1].url, /project_id=eq/);
    });
  });

  test("internal access: Project-scoped index date and embedding backfills touch only that Project", async () => {
    await withFetch(() => jsonResponse([]), async (calls) => {
      await runIndexDatesBackfill({ config: scoped(), dryRun: true, limit: 10 });
      await runEmbeddingBackfill({ config: scoped(), dryRun: true, limit: 10 });
      assert.ok(calls.length >= 2);
      for (const call of calls) assert.match(call.url, new RegExp(`project_id=eq\\.${PROJECT_A}`), call.url);
    });
    await withFetch(() => jsonResponse([]), async (calls) => {
      await runIndexDatesBackfill({ config: baseConfig(), dryRun: true, limit: 10 });
      for (const call of calls) assert.doesNotMatch(call.url, /project_id=eq/);
    });
  });

  test("internal access: Project-scoped schedule project listing returns only that Project", async () => {
    const projects = [
      { id: PROJECT_A, name: "A", is_active: true, settings: {} },
      { id: PROJECT_B, name: "B", is_active: true, settings: {} }
    ];
    await withFetch((call) => {
      if (call.url.includes("/rest/v1/projects?")) {
        return jsonResponse(projects.filter((project) => !call.url.includes("id=eq.") || call.url.includes(`id=eq.${project.id}`)));
      }
      return jsonResponse([]);
    }, async (calls) => {
      const listed = await listScheduleProjects({ config: scoped({ supabaseUrl: APP_URL }) });
      assert.ok(listed.length >= 1);
      assert.ok(listed.every((project) => project.projectId === PROJECT_A));
      for (const call of calls.filter((item) => item.url.includes("/rest/v1/projects?"))) {
        assert.match(call.url, new RegExp(`id=eq\\.${PROJECT_A}`));
      }
    });
  });

  test("internal access: a Project-scoped QA caller cannot read suites stored without a Project", async () => {
    const service = new QaHarnessService({ repository: new InMemoryQaRepository(), pipeline: async () => ({}), configProvider: () => baseConfig(), scheduler: () => {} });
    const unscopedContext = { actorId: "local", organizationId: "default", allowedProjectIds: [], roles: ["QA_VIEWER", "QA_OPERATOR"] };
    const suite = await service.createTestSuite(unscopedContext, { name: "S", domain: "chat", idempotency_key: "suite-unscoped-0001" });
    assert.equal(suite.project_id ?? null, null);
    const bidocContext = createHttpQaContext(crossTenant({ "x-project-id": PROJECT_A }), { projectId: PROJECT_A, env: {} });
    assert.deepEqual(bidocContext.allowedProjectIds, [PROJECT_A]);
    await assert.rejects(service.getTestSuite(bidocContext, { suite_id: suite.id }), (error) => error.code === "AUTHORIZATION_DENIED");
    // The unscoped caller that created it still reads it.
    const loaded = await service.getTestSuite(unscopedContext, { suite_id: suite.id });
    assert.equal(loaded.suite.id, suite.id);
  });
}
