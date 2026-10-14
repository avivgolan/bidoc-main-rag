import assert from "node:assert/strict";
import fs from "node:fs";
import { fetchTimelineEvents, getProjectInsightRun, graphSearch, listProjectInsightRuns, listEntityMentionEdges, upsertProjectGraphData, hybridSearch } from "../src/supabase.js";
import { callN8nTool } from "../src/tools.js";
import { CONTENT_TOOL_SPECS, isInternalContentTool } from "../src/subagents/contentTools.js";
import { INTERNAL_CONTENT_TOOL_NAMES, TOOL_NAMES } from "../src/config.js";
import { runAlertAgent } from "../src/subagents/alert.js";
import { runContentToolAgent } from "../src/subagents/contentTools.js";
import { runExceptionEvidenceAgent } from "../src/subagents/exceptionEvidence.js";
import { runConsultantReportEvidenceAgent } from "../src/subagents/consultantReportEvidence.js";
import { runMeetingEvidenceAgent } from "../src/subagents/meeting.js";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const CONTENT_URL = "https://content.supabase.test";
const APP_URL = "https://app.supabase.test";

function scopedConfig(overrides = {}) {
  return {
    openRouterApiKey: "openrouter-test-key",
    supabaseUrl: "https://app.supabase.test",
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

async function withFetch(handler, fn) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = { url: String(url), options, body: options.body ? safeJson(options.body) : null };
    calls.push(call);
    if (call.url.includes("openrouter.ai/api/v1/embeddings")) {
      return jsonResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    }
    if (call.url.includes("openrouter.ai/api/v1/chat/completions")) {
      return jsonResponse({ choices: [{ message: { content: "scoped answer" } }] });
    }
    return handler(call);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}

const SIGNATURE_ERROR = {
  code: "PGRST202",
  message: "Could not find the function public.content_hybrid(project_id_filter, query_text) in the schema cache"
};

export function registerChatProjectScopeTests(test) {
  test("chat project scope: hybrid search never widens a project-scoped call on an RPC signature error", async () => {
    await withFetch(
      (call) => call.url.includes("/rest/v1/rpc/content_hybrid") ? jsonResponse(SIGNATURE_ERROR, 404) : jsonResponse([], 404),
      async (calls) => {
        await assert.rejects(
          hybridSearch({ config: scopedConfig({ projectId: PROJECT_A }), query: "concrete", dateFrom: null, dateTo: null }),
          /project/i
        );
        const rpcCalls = calls.filter((call) => call.url.includes("/rest/v1/rpc/content_hybrid"));
        assert.ok(rpcCalls.length >= 1);
        for (const call of rpcCalls) assert.equal(call.body.project_id_filter, PROJECT_A);
      }
    );
  });

  test("chat project scope: hybrid search drops only hashtags on retry and keeps project_id_filter", async () => {
    await withFetch(
      (call) => {
        if (!call.url.includes("/rest/v1/rpc/content_hybrid")) return jsonResponse([], 404);
        if (Array.isArray(call.body.hashtags) && call.body.hashtags.length) return jsonResponse(SIGNATURE_ERROR, 404);
        return jsonResponse([
          { id: 1, project_id: PROJECT_A, content: "ours" },
          { id: 2, project_id: PROJECT_B, content: "theirs" },
          { id: 3, content: "unlabelled row from the project-filtered RPC" }
        ]);
      },
      async (calls) => {
        const results = await hybridSearch({
          config: scopedConfig({ projectId: PROJECT_A }),
          query: "concrete",
          dateFrom: null,
          dateTo: null,
          hashtags: ["#pour"]
        });
        const rpcCalls = calls.filter((call) => call.url.includes("/rest/v1/rpc/content_hybrid"));
        assert.equal(rpcCalls.length, 2);
        assert.deepEqual(rpcCalls[0].body.hashtags, ["pour"]);
        assert.equal(rpcCalls[1].body.project_id_filter, PROJECT_A);
        assert.equal("hashtags" in rpcCalls[1].body, false);
        assert.deepEqual(results.map((row) => row.id), [1, 3]);
      }
    );
  });

  test("chat project scope: hybrid search without a project is refused before any call", async () => {
    await withFetch(
      () => jsonResponse([{ id: 9 }]),
      async (calls) => {
        await assert.rejects(
          hybridSearch({ config: scopedConfig(), query: "q", dateFrom: null, dateTo: null, hashtags: ["x"] }),
          (error) => error.code === "company_db_required"
        );
        assert.equal(calls.length, 0, "no embedding or Company DB call without a Project");
      }
    );
  });

  test("chat project scope: hybrid search refuses an RPC without project_id_filter instead of running unfiltered", async () => {
    await withFetch(
      (call) => call.url.includes("/rest/v1/rpc/content_hybrid") ? jsonResponse(SIGNATURE_ERROR, 404) : jsonResponse([], 404),
      async (calls) => {
        await assert.rejects(
          hybridSearch({ config: scopedConfig({ projectId: PROJECT_A }), query: "q", dateFrom: null, dateTo: null, hashtags: [] }),
          (error) => error.code === "search_function_outdated" && /out of date for this Company DB/.test(error.message)
        );
        const rpcCalls = calls.filter((call) => call.url.includes("/rest/v1/rpc/content_hybrid"));
        assert.equal(rpcCalls.length, 1);
        assert.ok(rpcCalls.every((call) => call.body.project_id_filter === PROJECT_A), "never called without the Project filter");
      }
    );
  });

  test("chat project scope: alert lookup uses the request config and filters alert rows by project", async () => {
    await withFetch(
      (call) => {
        if (call.url.startsWith(`${CONTENT_URL}/rest/v1/rpc/match_alerts`)) {
          return jsonResponse([
            { id: 10, content: "ours", similarity: 0.4 },
            { id: 20, content: "other project alert", similarity: 0.3 }
          ]);
        }
        if (call.url.startsWith(`${CONTENT_URL}/rest/v1/alerts?`)) {
          return jsonResponse([{ id: 10, data_date: "2026-10-01", alert_type: "delay", summary: "ours" }]);
        }
        return jsonResponse([], 404);
      },
      async (calls) => {
        const result = await runAlertAgent({ config: scopedConfig({ projectId: PROJECT_A }), query: "open alerts" });
        const detail = calls.find((call) => call.url.startsWith(`${CONTENT_URL}/rest/v1/alerts?`));
        assert.ok(detail, "alert detail select must hit the request Company DB");
        assert.match(detail.url, new RegExp(`[?&]project_id=eq\\.${PROJECT_A}(&|$)`));
        assert.equal(result.resultsCount, 1);
        const completion = calls.find((call) => call.url.includes("chat/completions"));
        const prompt = JSON.stringify(completion.body.messages);
        assert.doesNotMatch(prompt, /other project alert/);
      }
    );
  });

  test("chat project scope: alert lookup fails closed when the project-filtered detail read fails", async () => {
    await withFetch(
      (call) => {
        if (call.url.includes("/rest/v1/rpc/match_alerts")) return jsonResponse([{ id: 10, content: "unscoped raw row" }]);
        if (call.url.includes("/rest/v1/alerts?")) return jsonResponse({ message: "column alerts.project_id does not exist" }, 400);
        return jsonResponse([], 404);
      },
      async (calls) => {
        const result = await runAlertAgent({ config: scopedConfig({ projectId: PROJECT_A }), query: "open alerts" });
        assert.equal(result.resultsCount, 0);
        const completion = calls.find((call) => call.url.includes("chat/completions"));
        assert.doesNotMatch(JSON.stringify(completion.body.messages), /unscoped raw row/);
      }
    );
  });

  test("chat project scope: content tool vector and text legs select rows of the requesting project only", async () => {
    await withFetch(
      (call) => {
        if (call.url.includes("/rest/v1/rpc/match_meetings")) return jsonResponse([{ id: 5, similarity: 0.5 }, { id: 6, similarity: 0.4 }]);
        if (call.url.includes("/rest/v1/meetings?")) return jsonResponse([{ id: 5, meeting_date: "2026-10-01", subject: "ours" }]);
        return jsonResponse([], 404);
      },
      async (calls) => {
        const config = scopedConfig({
          projectId: PROJECT_A,
          contentTools: { perTool: { meetings: { enabled: true, answerSynthesis: false } } }
        });
        const output = await runContentToolAgent({ config, toolName: "meetings", query: "pour schedule" });
        const rowSelects = calls.filter((call) => call.url.includes("/rest/v1/meetings?"));
        assert.equal(rowSelects.length, 2, "vector-leg row select and text leg");
        const vectorSelect = rowSelects.find((call) => /[?&]id=in\./.test(call.url));
        assert.ok(vectorSelect, "vector leg must select matched ids");
        for (const call of rowSelects) {
          assert.match(call.url, new RegExp(`[?&]project_id=eq\\.${PROJECT_A}(&|$)`));
        }
        assert.ok(output.results.every((row) => row.id === 5));
      }
    );
  });

  test("chat project scope: content tools without a project are refused before any call", async () => {
    await withFetch(
      () => jsonResponse([{ id: 5 }]),
      async (calls) => {
        const config = scopedConfig({ contentTools: { perTool: { meetings: { enabled: true, answerSynthesis: false } } } });
        await assert.rejects(runContentToolAgent({ config, toolName: "meetings", query: "pour schedule" }), (error) => error.code === "company_db_required");
        assert.equal(calls.length, 0);
      }
    );
  });

  test("chat project scope: same-record evidence agents refuse a record from another project", async () => {
    let fetched = 0;
    const fetchImpl = async () => { fetched += 1; return jsonResponse([]); };
    const config = scopedConfig({ projectId: PROJECT_A });
    const exception = await runExceptionEvidenceAgent({
      config,
      question: "why?",
      scope: { exceptionId: 7, projectId: PROJECT_B, attachmentId: "att-1" },
      fetchImpl
    });
    const report = await runConsultantReportEvidenceAgent({
      config,
      question: "why?",
      scope: { reportId: 7, projectId: PROJECT_B, attachmentId: "att-1" },
      fetchImpl
    });
    assert.equal(exception.status, "not_computable");
    assert.equal(report.status, "not_computable");
    assert.equal(fetched, 0);
  });

  test("chat project scope: meeting evidence refuses another project's meeting and scopes adjacent chunks", async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/rest/v1/rpc/")) {
        return jsonResponse([{ id: 1, source_id: 3, attachment_id: "att-1", chunk_index: 2, content: "chunk", primary_date: "2026-10-01" }]);
      }
      return jsonResponse([]);
    };
    const config = scopedConfig({ projectId: PROJECT_A, meetingsEvidence: { adjacentChunks: 1 } });
    const exact = await runMeetingEvidenceAgent({
      query: "decisions",
      meetingId: 3,
      projectId: PROJECT_B,
      attachmentId: "att-1",
      configOverride: config,
      fetchImpl
    });
    assert.equal(exact.status, "error");
    assert.equal(calls.length, 0);

    const semantic = await runMeetingEvidenceAgent({
      query: "what was agreed about the pour",
      configOverride: config,
      embeddingOverride: [0.1, 0.2, 0.3],
      fetchImpl
    });
    assert.equal(semantic.status, "found");
    const adjacent = calls.filter((url) => url.includes("/rest/v1/meetings_documents?"));
    assert.ok(adjacent.length >= 1);
    for (const url of adjacent) assert.match(url, new RegExp(`project_id=eq\\.${PROJECT_A}(&|$)`));
  });

  test("chat project scope: chat runs graph search scoped to its Project", () => {
    const agentSource = fs.readFileSync(new URL("../src/agent.js", import.meta.url), "utf8");
    assert.doesNotMatch(agentSource, /graph_search_not_project_scoped/);
    assert.match(agentSource, /graphSearch\(\{ config, payload, limit: graphSearchLimit, projectId: requestProjectId\(config\) \}\)/);
  });

  test("project graph: scoped graph_search reads the Company DB with filter_project_id and project-local refs", async () => {
    await withFetch(
      (call) => call.url.startsWith(`${CONTENT_URL}/rest/v1/rpc/graph_search`)
        ? jsonResponse([{ edge_id: "e1", source_node: { id: "a", project_id: PROJECT_A }, target_node: { id: "b", project_id: PROJECT_A } }])
        : jsonResponse([], 404),
      async (calls) => {
        const graph = await graphSearch({
          config: scopedConfig({ projectId: PROJECT_A }),
          payload: { query_text: "pour", source_refs: [{ node_id: "emails:5", source_table: "emails", source_id: "5" }], max_rows: 10 }
        });
        assert.equal(graph.results.length, 1);
        assert.equal(calls.some((call) => call.url.startsWith(APP_URL)), false, "scoped graph never reads the App DB");
        const rpc = calls.find((call) => call.url.includes("/rest/v1/rpc/graph_search"));
        assert.equal(rpc.body.filter_project_id, PROJECT_A);
        assert.deepEqual(rpc.body.source_refs, [{ source_table: "emails", source_id: "5" }]);
      }
    );
  });

  test("project graph: older graph_search without filter_project_id is refused, never run unfiltered", async () => {
    await withFetch(
      (call) => {
        if (!call.url.includes("/rest/v1/rpc/graph_search")) return jsonResponse([{ id: "leak" }]);
        if ("filter_project_id" in call.body) {
          return jsonResponse({ code: "PGRST202", message: "Could not find the function public.graph_search(filter_project_id, max_rows, query_text, source_refs) in the schema cache" }, 404);
        }
        return jsonResponse([{ edge_id: "theirs", source_node: { project_id: PROJECT_B }, target_node: { project_id: PROJECT_B } }]);
      },
      async (calls) => {
        await assert.rejects(
          graphSearch({ config: scopedConfig({ projectId: PROJECT_A }), payload: { query_text: "x", source_refs: [] } }),
          (error) => error.code === "search_function_outdated"
        );
        const rpcCalls = calls.filter((call) => call.url.includes("/rest/v1/rpc/graph_search"));
        assert.equal(rpcCalls.length, 1);
        assert.equal(rpcCalls[0].body.filter_project_id, PROJECT_A);
        assert.equal(calls.some((call) => /\/rest\/v1\/graph_(edges|nodes)/.test(call.url)), false, "no unscoped REST fallback");
      }
    );
  });

  test("project graph: a Company DB without graph_search is refused and reads nothing else", async () => {
    await withFetch(
      (call) => call.url.includes("/rest/v1/rpc/graph_search")
        ? jsonResponse({ code: "PGRST202", message: "Could not find the function public.graph_search in the schema cache" }, 404)
        : jsonResponse([{ id: "leak" }]),
      async (calls) => {
        await assert.rejects(
          graphSearch({ config: scopedConfig({ projectId: PROJECT_A }), payload: { query_text: "x" } }),
          (error) => error.code === "search_function_outdated"
        );
        assert.equal(calls.some((call) => /\/rest\/v1\/graph_(edges|nodes)/.test(call.url)), false);
        await assert.rejects(graphSearch({ config: scopedConfig(), payload: { query_text: "x" } }), (error) => error.code === "company_db_required");
      }
    );
  });

  test("project graph: scoped writers stamp project_id and project-local ids on the Company DB", async () => {
    await withFetch(
      () => jsonResponse([]),
      async (calls) => {
        await upsertProjectGraphData({
          config: scopedConfig({ projectId: PROJECT_A }),
          nodes: [
            { id: "emails:5", node_type: "event", label: "mail", source_table: "emails", source_id: "5" },
            { id: "supplier:acme", node_type: "supplier", label: "Acme" }
          ],
          edges: [{ from_node_id: "emails:5", to_node_id: "supplier:acme", edge_type: "mentions" }]
        });
        assert.equal(calls.some((call) => call.url.startsWith(APP_URL)), false);
        const nodeWrite = calls.find((call) => call.url.startsWith(`${CONTENT_URL}/rest/v1/graph_nodes`));
        assert.deepEqual(nodeWrite.body.map((node) => [node.id, node.project_id]), [
          [`p:${PROJECT_A}:emails:5`, PROJECT_A],
          [`p:${PROJECT_A}:supplier:acme`, PROJECT_A]
        ]);
        const edgeWrite = calls.find((call) => call.url.startsWith(`${CONTENT_URL}/rest/v1/graph_edges`) && call.options.method === "POST");
        assert.deepEqual(edgeWrite.body.map((edge) => [edge.from_node_id, edge.to_node_id, edge.project_id]), [
          [`p:${PROJECT_A}:emails:5`, `p:${PROJECT_A}:supplier:acme`, PROJECT_A]
        ]);
      }
    );
  });

  test("project graph: scoped mention-edge reads filter by project and return project-local entity ids", async () => {
    await withFetch(
      (call) => call.url.startsWith(`${CONTENT_URL}/rest/v1/graph_edges`)
        ? jsonResponse([{ to_node_id: `p:${PROJECT_A}:supplier:acme`, metadata: { source_table: "emails", source_id: "5", target_kind: "supplier" } }])
        : jsonResponse([], 404),
      async (calls) => {
        const links = await listEntityMentionEdges({ config: scopedConfig({ projectId: PROJECT_A }) });
        assert.match(calls[0].url, new RegExp(`project_id=eq\\.${PROJECT_A}`));
        assert.deepEqual(links, [{ record_ref: "emails:5", entity_id: "supplier:acme", kind: "supplier", label: "acme" }]);
      }
    );
  });

  test("project graph: scoped timeline source reads filter the index by project", async () => {
    await withFetch(
      () => jsonResponse([]),
      async (calls) => {
        await fetchTimelineEvents({ config: scopedConfig({ projectId: PROJECT_A }) });
        assert.match(calls[0].url, new RegExp(`[?&]project_id=eq\\.${PROJECT_A}(&|$)`));
        await assert.rejects(fetchTimelineEvents({ config: scopedConfig() }), (error) => error.code === "company_db_required");
        assert.equal(calls.length, 1, "an unscoped timeline read makes no call");
      }
    );
  });

  test("match RPCs: scoped alert search passes project_id_filter and refuses an older RPC without it", async () => {
    await withFetch(
      (call) => {
        if (call.url.includes("/rest/v1/rpc/match_alerts")) {
          if ("project_id_filter" in call.body) return jsonResponse({ code: "PGRST202", message: "Could not find the function public.match_alerts(filter, match_count, match_threshold, project_id_filter, query_embedding) in the schema cache" }, 404);
          return jsonResponse([{ id: 10, content: "ours" }, { id: 20, content: "theirs" }]);
        }
        if (call.url.includes("/rest/v1/alerts?")) return jsonResponse([{ id: 10, data_date: "2026-10-01" }]);
        return jsonResponse([], 404);
      },
      async (calls) => {
        await assert.rejects(
          runAlertAgent({ config: scopedConfig({ projectId: PROJECT_A }), query: "alerts" }),
          (error) => error.code === "search_function_outdated"
        );
        const rpcCalls = calls.filter((call) => call.url.includes("/rest/v1/rpc/match_alerts"));
        assert.equal(rpcCalls.length, 1);
        assert.equal(rpcCalls[0].body.project_id_filter, PROJECT_A);
        assert.equal(rpcCalls[0].body.match_count, 4, "no over-fetch when the RPC filters by project");
        assert.equal(calls.some((call) => call.url.includes("/rest/v1/alerts?")), false);
      }
    );
  });

  test("match RPCs: scoped content tool vector leg passes project_id_filter and keeps the row-select filter", async () => {
    await withFetch(
      (call) => {
        if (call.url.includes("/rest/v1/rpc/match_meetings")) return jsonResponse([{ id: 5, similarity: 0.5 }]);
        if (call.url.includes("/rest/v1/meetings?")) return jsonResponse([{ id: 5, meeting_date: "2026-10-01" }]);
        return jsonResponse([], 404);
      },
      async (calls) => {
        const config = scopedConfig({ projectId: PROJECT_A, contentTools: { perTool: { meetings: { enabled: true, answerSynthesis: false } } } });
        await runContentToolAgent({ config, toolName: "meetings", query: "pour" });
        const rpc = calls.find((call) => call.url.includes("/rest/v1/rpc/match_meetings"));
        assert.equal(rpc.body.project_id_filter, PROJECT_A);
        assert.equal(rpc.body.match_count, 24);
        const vectorSelect = calls.find((call) => call.url.includes("/rest/v1/meetings?") && /id=in\./.test(call.url));
        assert.match(vectorSelect.url, new RegExp(`project_id=eq\\.${PROJECT_A}`));
      }
    );
  });

  test("n8n: project-scoped calls never reach an n8n webhook", async () => {
    await withFetch(
      () => jsonResponse({ ok: true }),
      async (calls) => {
        const result = await callN8nTool({
          toolName: "submittals",
          query: "q",
          sessionId: "s",
          config: scopedConfig({ projectId: PROJECT_A, n8nBaseUrl: "https://n8n.example.test", tools: { submittals: "https://n8n.example.test/webhook/submittals" } })
        });
        assert.equal(result.ok, false);
        assert.equal(result.skipped, true);
        assert.equal(result.error, "n8n_disabled_for_project_scope");
        assert.equal(calls.length, 0);
      }
    );
  });

  test("n8n: project-scoped chat uses internal content tools, including the former n8n-only domains", () => {
    const scoped = scopedConfig({ projectId: PROJECT_A });
    for (const tool of ["meetings", "emails", "whatsapp_messages", "financial_transactions", "safety_report", "consultants_reports", "exceptions_report", "quality_control"]) {
      assert.ok(CONTENT_TOOL_SPECS[tool], tool);
      assert.equal(isInternalContentTool(tool, scoped), true, tool);
      assert.equal(isInternalContentTool(tool, scopedConfig()), false, `${tool} stays on the legacy flag without a project`);
    }
    assert.equal(CONTENT_TOOL_SPECS.consultants_reports.defaultTable, "consultants_reports");
    assert.equal(CONTENT_TOOL_SPECS.exceptions_report.defaultTable, "exceptions_report");
    assert.equal(CONTENT_TOOL_SPECS.quality_control.defaultTable, "quality_control");
    assert.deepEqual([...INTERNAL_CONTENT_TOOL_NAMES].sort(), Object.keys(CONTENT_TOOL_SPECS).sort());
    // Every n8n tool name is replaced internally except submittals (no Company DB table).
    const replaced = new Set([...Object.keys(CONTENT_TOOL_SPECS), "alert", "meeting_evidence_search"]);
    assert.deepEqual(TOOL_NAMES.filter((tool) => !replaced.has(tool)), ["submittals"]);
  });

  test("n8n: chat refuses n8n for project-scoped requests before the webhook call", () => {
    const agentSource = fs.readFileSync(new URL("../src/agent.js", import.meta.url), "utf8");
    assert.match(agentSource, /if \(requestProjectId\(config\)\) \{\s*return \{\s*toolName,\s*ok: false,\s*skipped: true,\s*error: "n8n_disabled_for_project_scope"/);
  });

  test("re-scan: insight runs are listed and read within the request Project", async () => {
    await withFetch(
      () => jsonResponse([]),
      async (calls) => {
        await listProjectInsightRuns({ config: scopedConfig({ projectId: PROJECT_A }) });
        await getProjectInsightRun({ config: scopedConfig({ projectId: PROJECT_A }), runId: "run-1" });
        for (const call of calls) assert.match(call.url, new RegExp(`[?&]project_id=eq\\.${PROJECT_A}(&|$)`));
        const before = calls.length;
        await assert.rejects(listProjectInsightRuns({ config: scopedConfig() }), (error) => error.code === "company_db_required");
        assert.equal(calls.length, before);
      }
    );
  });

  test("re-scan: insights and delay-claim subagents run on the caller's config", () => {
    const insights = fs.readFileSync(new URL("../src/subagents/projectInsights.js", import.meta.url), "utf8");
    const delay = fs.readFileSync(new URL("../src/subagents/delayClaim.js", import.meta.url), "utf8");
    assert.match(insights, /runAlertAgent\(\{ config, query, dateFrom, dateTo \}\)/);
    assert.match(delay, /runMeetingEvidenceAgent\(\{[\s\S]{0,400}?configOverride: config/);
  });

  test("chat project scope: chat passes its request config to the alert and meeting subagents", () => {
    const agentSource = fs.readFileSync(new URL("../src/agent.js", import.meta.url), "utf8");
    assert.match(agentSource, /runAlertAgent\(\{\s*config,/);
    assert.match(agentSource, /runMeetingEvidenceAgent\(\{[\s\S]{0,1200}?configOverride: config/);
  });
}
