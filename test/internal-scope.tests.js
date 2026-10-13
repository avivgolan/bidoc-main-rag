import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createDelayClaim,
  createTimelineEventLink,
  delayClaimCaseInProject,
  delayEventInProject,
  deleteTimelineEventLink,
  fetchAlertsTimelineEvents,
  fetchTimelineEventPage,
  fetchTimelineEvents,
  listDelayClaims,
  listProjectGraph,
  listTimelineEventLinks,
  listTimelineGraphData
} from "../src/supabase.js";

// Closes main-agent's last Project-scope gaps: the run event stream sits behind
// the auth wall, and the timeline / graph / delay-claim / alert routes read
// through the request config, so a BiDoc caller (x-content-supabase-* plus
// x-project-id) only ever sees its own Project.

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const CONTENT_URL = "https://content.supabase.test";
const APP_URL = "https://app.supabase.test";

function baseConfig(overrides = {}) {
  return {
    supabaseUrl: APP_URL,
    supabaseServiceRoleKey: "app-key",
    contentSource: {
      supabaseUrl: CONTENT_URL,
      supabaseServiceRoleKey: "content-key",
      indexTable: "content_index",
      alertsTable: "alerts"
    },
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
    const call = {
      url: decodeURIComponent(String(url)),
      method: String(options.method || "GET").toUpperCase(),
      body: options.body ? JSON.parse(options.body) : null
    };
    calls.push(call);
    return handler(call);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const serverSource = () => fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

// The source of one route: from its marker to the next route's marker.
function routeSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `route marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `route end marker not found: ${endMarker}`);
  return source.slice(start, end);
}

export function registerInternalScopeTests(test) {
  test("internal scope: the run event stream is served only after the auth wall", () => {
    const source = serverSource();
    const handleApi = source.slice(source.indexOf("async function handleApi("));
    const wall = handleApi.indexOf('if (!url.pathname.startsWith("/api/auth/")) {');
    const stream = handleApi.indexOf('url.pathname.startsWith("/api/runs/") && url.pathname.endsWith("/events")');
    assert.ok(wall > 0, "auth wall not found");
    assert.ok(stream > wall, "/api/runs/:id/events must be routed after the auth wall");
    // The UI follows runs with a same-origin EventSource, which sends the
    // bidoc_session cookie the wall checks.
    const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    assert.match(app, /new EventSource\(`\/api\/runs\/\$\{encodeURIComponent\(runId\)\}\/events`\)/);
    assert.doesNotMatch(app, /new EventSource\([^)]*https?:/);
  });

  test("internal scope: timeline, graph, delay-claim, alert and tool routes read through the request config", () => {
    const source = serverSource();
    const routes = [
      ['url.pathname === "/api/timeline")', 'url.pathname === "/api/timeline/alerts")'],
      ['url.pathname === "/api/timeline/alerts")', 'url.pathname === "/api/timeline/events")'],
      ['url.pathname === "/api/timeline/events")', 'req.method === "GET" && url.pathname === "/api/timeline/links")'],
      ['req.method === "GET" && url.pathname === "/api/timeline/links")', 'url.pathname === "/api/timeline/link-suggestions")'],
      ['url.pathname === "/api/timeline/link-suggestions")', 'url.pathname === "/api/timeline/graph/rebuild")'],
      ['req.method === "POST" && url.pathname === "/api/timeline/links")', 'url.pathname === "/api/qa/dislikes")'],
      ['req.method === "GET" && url.pathname === "/api/graph")', 'url.pathname === "/api/insights/runs")'],
      ['req.method === "GET" && url.pathname === "/api/delay-claims")', 'const messagesMatch'],
      ['url.pathname === "/api/subagents/alert")', 'url.pathname === "/api/subagents/data-query")'],
      ['const toolMatch = ', 'Contracts Agent Phase 1'],
      ['url.pathname === "/api/evaluations/run")', 'url.pathname === "/api/diagnostics/connections")']
    ];
    for (const [startMarker, endMarker] of routes) {
      const route = routeSource(source, startMarker, endMarker);
      assert.match(route, /buildRequestConfig\(req/, `${startMarker} must use buildRequestConfig`);
      assert.doesNotMatch(route, /config: config\(\)|cfg: config\(\)|config\(\)\./, `${startMarker} must not read the global config`);
    }
  });

  test("internal scope: delay-claim routes check the case or event belongs to the request Project", () => {
    const source = serverSource();
    const delay = routeSource(source, 'req.method === "GET" && url.pathname === "/api/delay-claims")', "const messagesMatch");
    for (const marker of ["delayClaimEventsMatch", "delayClaimAnalyzeMatch", "delayClaimPackageMatch"]) {
      const route = routeSource(delay, `const ${marker} =`, "\n  const ");
      assert.match(route, /delayClaimCaseInProject\(\{ config: cfg, caseId \}\)/, `${marker} must check the case`);
    }
    for (const marker of ["delayEventMatch", "delayEventAnalyzeMatch", "delayEventEvidenceMatch", "delayEventGapsMatch", "delayEventChangeLogMatch"]) {
      const route = routeSource(delay + "\n  const END", `const ${marker} =`, "\n  const ");
      assert.match(route, /delayEventInProject\(\{ config: cfg, eventId \}\)/, `${marker} must check the event`);
    }
    // The internal UI sends project_id in the claim body; only headers/query
    // make a delay route Project-scoped, so its behaviour is unchanged.
    assert.doesNotMatch(delay, /buildRequestConfig\(req, body\)/);
  });

  test("internal scope: Project-scoped timeline reads filter by project_id", async () => {
    await withFetch(() => jsonResponse([]), async (calls) => {
      await fetchTimelineEvents({ config: scoped() });
      await fetchAlertsTimelineEvents({ config: scoped(), limit: 10 });
      await fetchTimelineEventPage({ config: scoped(), limit: 5 });
      assert.equal(calls.length, 3);
      for (const call of calls) {
        assert.ok(call.url.startsWith(CONTENT_URL), call.url);
        assert.match(call.url, new RegExp(`project_id=eq\\.${PROJECT_A}`));
      }
    });
  });

  test("internal scope: Project-scoped graph reads the Company DB graph of that Project only", async () => {
    const edges = [
      { id: "e1", from_node_id: `p:${PROJECT_A}:event:1`, to_node_id: `p:${PROJECT_A}:supplier:x`, edge_type: "mentions", confidence: 0.9, metadata: {}, project_id: PROJECT_A },
      { id: "e2", from_node_id: `p:${PROJECT_A}:event:2`, to_node_id: `p:${PROJECT_B}:supplier:y`, edge_type: "mentions", confidence: 0.8, metadata: {}, project_id: PROJECT_A }
    ];
    const nodes = [
      { id: `p:${PROJECT_A}:event:1`, node_type: "event", label: "אירוע 1", project_id: PROJECT_A },
      { id: `p:${PROJECT_A}:supplier:x`, node_type: "supplier", label: "ספק X", project_id: PROJECT_A },
      { id: `p:${PROJECT_A}:event:2`, node_type: "event", label: "אירוע 2", project_id: PROJECT_A },
      { id: `p:${PROJECT_B}:supplier:y`, node_type: "supplier", label: "ספק Y", project_id: PROJECT_B }
    ];
    await withFetch((call) => {
      if (call.url.includes("/rest/v1/graph_edges")) return jsonResponse(edges);
      if (call.url.includes("/rest/v1/graph_nodes")) {
        const scopedNodes = nodes.filter((node) => call.url.includes(`project_id=eq.${node.project_id}`));
        return jsonResponse(scopedNodes);
      }
      return jsonResponse([]);
    }, async (calls) => {
      const graph = await listProjectGraph({ config: scoped(), limit: 50 });
      assert.ok(calls.length >= 2);
      for (const call of calls) {
        assert.ok(call.url.startsWith(CONTENT_URL), `scoped graph must read the Company DB: ${call.url}`);
        assert.match(call.url, new RegExp(`project_id=eq\\.${PROJECT_A}`));
      }
      assert.deepEqual(graph.edges.map((edge) => edge.id), ["e1"]);
      assert.ok(graph.nodes.every((node) => !node.id.includes(PROJECT_B)));
    });
  });

  test("internal scope: graph without a Project keeps reading the App DB graph", async () => {
    await withFetch(() => jsonResponse([]), async (calls) => {
      await listProjectGraph({ config: baseConfig(), limit: 50 });
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.startsWith(`${APP_URL}/rest/v1/graph_edges`));
      assert.doesNotMatch(calls[0].url, /project_id=eq/);
    });
  });

  test("internal scope: App DB timeline links and entity graph carry no project_id, so a Project-scoped read is empty", async () => {
    await withFetch(() => jsonResponse([{ id: "leak" }]), async (calls) => {
      assert.deepEqual(await listTimelineEventLinks({ config: scoped(), source: "index" }), []);
      assert.deepEqual(await listTimelineGraphData({ config: scoped(), source: "index" }), { entities: [], eventEntities: [], graphEdges: [] });
      assert.equal(calls.length, 0);
      await listTimelineEventLinks({ config: baseConfig(), source: "index" });
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.startsWith(`${APP_URL}/rest/v1/timeline_event_links`));
    });
  });

  test("internal scope: Project-scoped timeline link writes and deletes are refused", async () => {
    await withFetch(() => jsonResponse([{}]), async (calls) => {
      const link = { source_event_id: "1", target_event_id: "2" };
      await assert.rejects(createTimelineEventLink({ config: scoped(), link }), (error) => error.code === "timeline_links_not_project_scoped" && error.status === 409);
      await assert.rejects(deleteTimelineEventLink({ config: scoped(), id: "abc" }), (error) => error.code === "timeline_links_not_project_scoped" && error.status === 409);
      assert.equal(calls.length, 0);
    });
  });

  test("internal scope: delay claims list and create are stamped with the request Project", async () => {
    await withFetch((call) => jsonResponse(call.method === "POST" ? [call.body] : []), async (calls) => {
      await listDelayClaims({ config: scoped() });
      assert.match(calls[0].url, new RegExp(`^${APP_URL}/rest/v1/delay_claim_cases\\?.*project_id=eq\\.${PROJECT_A}`));
      await listDelayClaims({ config: baseConfig() });
      assert.doesNotMatch(calls[1].url, /project_id=eq/);

      const claim = await createDelayClaim({ config: scoped(), claim: { title: "עיכוב בטון" } });
      assert.equal(calls[2].body.project_id, PROJECT_A);
      assert.equal(claim.project_id, PROJECT_A);
      await assert.rejects(
        createDelayClaim({ config: scoped(), claim: { title: "עיכוב", project_id: PROJECT_B } }),
        (error) => error.code === "project_mismatch" && error.status === 400
      );
      assert.equal(calls.length, 3);

      // Without a Project the body's project_id is kept as before.
      await createDelayClaim({ config: baseConfig(), claim: { title: "עיכוב", project_id: PROJECT_B } });
      assert.equal(calls[3].body.project_id, PROJECT_B);
    });
  });

  test("internal scope: delay case and event Project checks", async () => {
    const cases = { "case-a": PROJECT_A, "case-b": PROJECT_B };
    const events = { "event-a": "case-a", "event-b": "case-b" };
    await withFetch((call) => {
      const url = new URL(call.url);
      if (url.pathname.endsWith("/delay_claim_cases")) {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        const projectId = url.searchParams.get("project_id")?.replace(/^eq\./, "");
        return jsonResponse(cases[id] && cases[id] === projectId ? [{ id }] : []);
      }
      if (url.pathname.endsWith("/delay_events")) {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        return jsonResponse(events[id] ? [{ case_id: events[id] }] : []);
      }
      return jsonResponse([]);
    }, async (calls) => {
      assert.equal(await delayClaimCaseInProject({ config: scoped(), caseId: "case-a" }), true);
      assert.equal(await delayClaimCaseInProject({ config: scoped(), caseId: "case-b" }), false);
      assert.equal(await delayEventInProject({ config: scoped(), eventId: "event-a" }), true);
      assert.equal(await delayEventInProject({ config: scoped(), eventId: "event-b" }), false);
      assert.equal(await delayEventInProject({ config: scoped(), eventId: "missing" }), false);
      assert.ok(calls.every((call) => call.url.startsWith(APP_URL)));
      const callCount = calls.length;
      assert.equal(await delayClaimCaseInProject({ config: baseConfig(), caseId: "case-b" }), true);
      assert.equal(await delayEventInProject({ config: baseConfig(), eventId: "event-b" }), true);
      assert.equal(calls.length, callCount, "unscoped checks make no request");
    });
  });
}
