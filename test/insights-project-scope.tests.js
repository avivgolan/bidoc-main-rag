import assert from "node:assert/strict";
import fs from "node:fs";
import { getProjectInsightRun, listProjectInsightRuns, saveProjectInsightRun } from "../src/supabase.js";
import { collectInsightHashtags, runProjectInsightsAnalysis } from "../src/subagents/projectInsights.js";
import { runIncrementalIndexing } from "../src/subagents/indexing.js";
import { resolveRequestProjectId } from "../src/projectScope.js";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const CONTENT_URL = "https://content.supabase.test";
const APP_URL = "https://app.supabase.test";

function scopedConfig(overrides = {}) {
  return {
    openRouterApiKey: "openrouter-test-key",
    supabaseUrl: APP_URL,
    supabaseServiceRoleKey: "app-key",
    contentSource: {
      supabaseUrl: CONTENT_URL,
      supabaseServiceRoleKey: "content-key",
      hybridRpcName: "content_hybrid",
      indexTable: "content_index",
      alertsTable: "alerts",
      alertsRpcName: "match_alerts"
    },
    models: { embedding: "openai/text-embedding-3-large", main: "test/main", lite: "test/lite" },
    retrieval: { candidates: 5, vectorWeight: 0.6, keywordWeight: 0.4, alertCandidates: 4 },
    ...overrides
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}

const LLM_JSON = JSON.stringify({ focusQuery: "בטון", topics: [], findings: [], insights: [] });

async function withFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: String(url), method: String(options.method || "GET").toUpperCase(), options, body: options.body ? safeJson(options.body) : null };
    calls.push(call);
    if (call.url.includes("openrouter.ai/api/v1/embeddings")) return jsonResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    if (call.url.includes("openrouter.ai/api/v1/chat/completions")) return jsonResponse({ choices: [{ message: { content: LLM_JSON } }] });
    return handler(call);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// A Company DB request is Project-scoped when its URL filters project_id, its
// RPC body carries the project filter, or every inserted row is stamped.
function isProjectScoped(call, projectId) {
  const url = decodeURIComponent(call.url);
  if (url.includes(`project_id=eq.${projectId}`)) return true;
  if (call.method === "POST" && url.includes("/rest/v1/rpc/")) {
    return call.body?.project_id_filter === projectId || call.body?.filter_project_id === projectId;
  }
  if (call.method === "POST" && Array.isArray(call.body)) {
    return call.body.length > 0 && call.body.every((row) => row?.project_id === projectId);
  }
  if (call.method === "POST" && call.body && typeof call.body === "object") {
    return call.body.project_id === projectId;
  }
  return false;
}

function indexRow(id, projectId, extra = {}) {
  return {
    id,
    created_at: "2026-09-01T08:00:00Z",
    primary_date: "2026-09-01",
    project_id: projectId,
    source_table: "emails",
    source_id: String(id),
    title: `עיכוב בטון ${id}`,
    summary: "ספק הבטון לא הגיע לאתר",
    hashtags: ["בטון"],
    ...extra
  };
}

export function registerInsightsProjectScopeTests(test) {
  test("insights project scope: x-project-id wins, ?project_id is the fallback, a disagreeing pair is project_mismatch", () => {
    assert.equal(resolveRequestProjectId({ header: PROJECT_A, query: null, body: PROJECT_B }), PROJECT_A);
    assert.equal(resolveRequestProjectId({ header: null, query: PROJECT_A, body: null }), PROJECT_A);
    assert.equal(resolveRequestProjectId({ header: "", query: ` ${PROJECT_A} `, body: PROJECT_B }), PROJECT_A);
    assert.equal(resolveRequestProjectId({ header: null, query: null, body: PROJECT_B }), PROJECT_B);
    assert.equal(resolveRequestProjectId({ header: PROJECT_A, query: PROJECT_A.toUpperCase() }), PROJECT_A);
    assert.equal(resolveRequestProjectId({}), null);
    assert.throws(
      () => resolveRequestProjectId({ header: PROJECT_A, query: PROJECT_B }),
      (error) => error.code === "project_mismatch" && error.status === 400
    );
  });

  test("insights project scope: server resolves the Project from header or query and answers 400 project_mismatch", () => {
    const serverSource = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const builder = serverSource.match(/function buildRequestConfig\([\s\S]*?\n}\n/)?.[0] || "";
    assert.match(builder, /resolveRequestProjectId\(\{\s*header: req\.headers\["x-project-id"\],\s*query: requestQueryProjectId\(req\)/);
    assert.match(serverSource, /searchParams\.get\("project_id"\)/);
    assert.match(serverSource, /resolveRequestProjectId\(\{ header: req\.headers\["x-project-id"\], query: url\.searchParams\.get\("project_id"\) \}\)/);
    assert.match(serverSource, /sendJson\(res, 400, \{ error: "project_mismatch"/);
  });

  test("insights project scope: analyze persists the run under the request Project and refuses a foreign runId", () => {
    const serverSource = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const start = serverSource.indexOf('url.pathname === "/api/insights/analyze"');
    const route = serverSource.slice(start, serverSource.indexOf('url.pathname === "/api/delay-claims"', start));
    assert.ok(route.length > 0);
    assert.match(route, /const runProjectId = requestProjectId\(cfg\);/);
    assert.doesNotMatch(route, /projectId: body\.projectId \|\| body\.project_id/);
    assert.equal((route.match(/projectId: runProjectId,/g) || []).length, 3);
    assert.match(route, /error: "project_mismatch", message: "body project_id names a different Project/);
    assert.match(route, /sendJson\(res, 409, \{ ok: false, error: "project_mismatch"/);
    // runs / quality-metrics / hashtags all read through the request config.
    for (const path of ["/api/insights/runs", "/api/insights/quality-metrics", "/api/insights/hashtags"]) {
      const at = serverSource.indexOf(`url.pathname === "${path}"`);
      const block = serverSource.slice(at, at + 1200);
      assert.match(block, /buildRequestConfig\(req, \{\}\)/, path);
    }
  });

  test("insights project scope: hashtags count only the requesting Project's alerts and index rows", async () => {
    await withFetch((call) => {
      if (call.url.startsWith(`${CONTENT_URL}/rest/v1/alerts?`)) {
        return jsonResponse([
          { id: 1, created_at: "2026-09-01T08:00:00Z", data_date: "2026-09-01", hashtags: ["בטון"], alert_type: "עיכוב", summary: "a" }
        ]);
      }
      if (call.url.startsWith(`${CONTENT_URL}/rest/v1/content_index?`)) return jsonResponse([indexRow(7, PROJECT_A)]);
      return jsonResponse([]);
    }, async (calls) => {
      const alerts = await collectInsightHashtags({ config: scopedConfig({ projectId: PROJECT_A }), source: "alerts" });
      const index = await collectInsightHashtags({ config: scopedConfig({ projectId: PROJECT_A }), source: "index" });
      assert.deepEqual(alerts.hashtags.map((item) => item.tag).sort(), ["בטון", "עיכוב"].sort());
      assert.equal(index.total, 1);
      const reads = calls.filter((call) => call.url.startsWith(CONTENT_URL));
      assert.equal(reads.length, 2);
      for (const call of reads) assert.ok(isProjectScoped(call, PROJECT_A), call.url);
      assert.ok(reads.every((call) => !call.url.includes(PROJECT_B)));
    });
  });

  test("insights project scope: analyze source collection, tools, graph and auto-indexing read and write only the requesting Project", async () => {
    const config = scopedConfig({
      projectId: PROJECT_A,
      insights: { graphClustering: true, graphEnrichment: true, closureFollowup: true },
      indexing: { autoIndexing: true, incrementalLimit: 5 },
      n8nBaseUrl: "https://n8n.example.test"
    });
    await withFetch((call) => {
      const url = call.url;
      if (!url.startsWith(CONTENT_URL)) return jsonResponse([]);
      if (url.includes("/rest/v1/rpc/content_hybrid")) return jsonResponse([{ ...indexRow(9, PROJECT_A), content: "בטון" }]);
      if (url.includes("/rest/v1/rpc/")) return jsonResponse([]);
      if (url.includes("/rest/v1/content_index?") && call.method === "GET") {
        return jsonResponse(url.includes("source_table=eq.") ? [] : [indexRow(1, PROJECT_A), indexRow(2, PROJECT_A)]);
      }
      if (url.includes("/rest/v1/alerts?")) {
        return jsonResponse([{ id: 3, created_at: "2026-09-02T08:00:00Z", data_date: "2026-09-02", hashtags: ["בטון"], summary: "עיכוב ספק בטון", severity_level: 3 }]);
      }
      return jsonResponse([]);
    }, async (calls) => {
      const result = await runProjectInsightsAnalysis({ config, focusQuery: "", limit: 25, runId: "insights_scope_test" });
      assert.ok(result.summary);
      const appCalls = calls.filter((call) => call.url.startsWith(APP_URL));
      assert.deepEqual(appCalls.map((call) => call.url), [], "no App DB reads/writes for a Project-scoped run");
      assert.ok(calls.every((call) => !call.url.startsWith("https://n8n.example.test")), "n8n tools are skipped for a Project-scoped run");
      const companyCalls = calls.filter((call) => call.url.startsWith(CONTENT_URL));
      assert.ok(companyCalls.length >= 5, `expected several Company DB calls, got ${companyCalls.length}`);
      const unscoped = companyCalls.filter((call) => !isProjectScoped(call, PROJECT_A));
      assert.deepEqual(unscoped.map((call) => `${call.method} ${call.url}`), []);
      // Paths actually exercised: index scan, alerts priming, hybrid focus search, graph search, auto-indexing source reads.
      assert.ok(companyCalls.some((call) => call.url.includes("/rest/v1/content_index?") && call.url.includes("order=primary_date.desc")));
      assert.ok(companyCalls.some((call) => call.url.includes("/rest/v1/alerts?")));
      assert.ok(companyCalls.some((call) => call.url.includes("/rest/v1/rpc/content_hybrid")));
      assert.ok(companyCalls.some((call) => call.url.includes("/rest/v1/rpc/graph_search")));
      assert.ok(companyCalls.some((call) => call.url.includes("/rest/v1/emails?")));
    });
  });

  test("insights project scope: auto-indexing indexes only the requesting Project's source rows", async () => {
    const config = scopedConfig({ projectId: PROJECT_A });
    await withFetch((call) => {
      const url = decodeURIComponent(call.url);
      if (call.method === "POST" && url.includes("/rest/v1/content_index")) return new Response(null, { status: 201 });
      if (url.includes("/rest/v1/content_index?")) return jsonResponse([]);
      if (url.includes("/rest/v1/emails?") && url.includes("select=id&")) return jsonResponse([{ id: 10 }, { id: 11 }]);
      // A misbehaving DB that ignores the filter must still not leak Project B.
      if (url.includes("/rest/v1/emails?") && url.includes("id=in.")) {
        return jsonResponse([
          { id: 10, project_id: PROJECT_A, subject: "בטון", content: "עיכוב", created_at: "2026-09-01T08:00:00Z" },
          { id: 11, project_id: PROJECT_B, subject: "אחר", content: "פרויקט אחר", created_at: "2026-09-01T08:00:00Z" }
        ]);
      }
      return jsonResponse([]);
    }, async (calls) => {
      const summary = await runIncrementalIndexing({ config, dryRun: false, limit: 5, tables: ["emails"] });
      const reads = calls.filter((call) => call.url.startsWith(CONTENT_URL) && call.method === "GET");
      assert.ok(reads.length >= 3);
      for (const call of reads) assert.ok(isProjectScoped(call, PROJECT_A), call.url);
      const inserts = calls.filter((call) => call.method === "POST" && call.url.includes("/rest/v1/content_index"));
      assert.equal(inserts.length, 1);
      assert.deepEqual(inserts[0].body.map((row) => row.project_id), [PROJECT_A]);
      assert.equal(summary.inserted, 1);
    });
  });

  test("insights project scope: saving a run refuses a runId already saved under another Project", async () => {
    const config = scopedConfig({ projectId: PROJECT_A });
    await withFetch((call) => {
      if (call.method === "PATCH") return jsonResponse([]);
      if (call.method === "POST") {
        return jsonResponse({ code: "23505", message: "duplicate key value violates unique constraint \"project_insight_runs_run_id_key\"" }, 409);
      }
      return jsonResponse([]);
    }, async (calls) => {
      await assert.rejects(
        saveProjectInsightRun({ config, run: { runId: "run_owned_by_b", status: "running" } }),
        (error) => error.code === "project_mismatch"
      );
      const patch = calls.find((call) => call.method === "PATCH");
      assert.ok(patch.url.includes("run_id=eq.run_owned_by_b"));
      assert.ok(patch.url.includes(`project_id=eq.${PROJECT_A}`));
      const insert = calls.find((call) => call.method === "POST");
      assert.equal(insert.body.project_id, PROJECT_A);
      assert.doesNotMatch(String(insert.options.headers?.Prefer || ""), /merge-duplicates/);
      assert.ok(!insert.url.includes("on_conflict"));
    });
  });

  test("insights project scope: saving a run updates its own Project's run, inserts a new one, and rejects a foreign project_id", async () => {
    const config = scopedConfig({ projectId: PROJECT_A });
    await withFetch((call) => {
      if (call.method === "PATCH") return jsonResponse([{ run_id: "own_run", project_id: PROJECT_A, status: "done" }]);
      return jsonResponse([]);
    }, async (calls) => {
      const saved = await saveProjectInsightRun({ config, run: { runId: "own_run", status: "done" } });
      assert.equal(saved.project_id, PROJECT_A);
      assert.deepEqual(calls.map((call) => call.method), ["PATCH"]);
      assert.equal(calls[0].body.project_id, PROJECT_A);
      assert.equal(calls[0].body.run_id, undefined);
    });
    await withFetch((call) => {
      if (call.method === "PATCH") return jsonResponse([]);
      if (call.method === "POST") return jsonResponse([{ ...call.body }], 201);
      return jsonResponse([]);
    }, async (calls) => {
      const saved = await saveProjectInsightRun({ config, run: { runId: "new_run", status: "running" } });
      assert.equal(saved.project_id, PROJECT_A);
      assert.deepEqual(calls.map((call) => call.method), ["PATCH", "POST"]);
    });
    await withFetch(() => jsonResponse([]), async (calls) => {
      await assert.rejects(
        saveProjectInsightRun({ config, run: { runId: "x", projectId: PROJECT_B } }),
        (error) => error.code === "project_mismatch"
      );
      assert.equal(calls.length, 0);
    });
    // A save without a Project is refused; the legacy unscoped upsert is gone.
    await withFetch((call) => jsonResponse([{ ...call.body }]), async (calls) => {
      await assert.rejects(
        saveProjectInsightRun({ config: scopedConfig(), run: { runId: "legacy", status: "done" } }),
        (error) => error.code === "company_db_required"
      );
      assert.equal(calls.length, 0);
    });
  });

  test("insights project scope: run history and parent-run reads filter by the requesting Project", async () => {
    await withFetch(() => jsonResponse([]), async (calls) => {
      await listProjectInsightRuns({ config: scopedConfig({ projectId: PROJECT_A }), limit: 5 });
      await getProjectInsightRun({ config: scopedConfig({ projectId: PROJECT_A }), runId: "parent" });
      assert.equal(calls.length, 2);
      for (const call of calls) assert.ok(isProjectScoped(call, PROJECT_A), call.url);
    });
  });
}
