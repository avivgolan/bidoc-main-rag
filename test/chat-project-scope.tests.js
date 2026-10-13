import assert from "node:assert/strict";
import fs from "node:fs";
import { hybridSearch } from "../src/supabase.js";
import { runAlertAgent } from "../src/subagents/alert.js";
import { runContentToolAgent } from "../src/subagents/contentTools.js";
import { runExceptionEvidenceAgent } from "../src/subagents/exceptionEvidence.js";
import { runConsultantReportEvidenceAgent } from "../src/subagents/consultantReportEvidence.js";
import { runMeetingEvidenceAgent } from "../src/subagents/meeting.js";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const CONTENT_URL = "https://content.supabase.test";

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

  test("chat project scope: hybrid search without a project keeps the legacy widen-on-signature fallback", async () => {
    await withFetch(
      (call) => {
        if (!call.url.includes("/rest/v1/rpc/content_hybrid")) return jsonResponse([], 404);
        if (call.body.hashtags) return jsonResponse(SIGNATURE_ERROR, 404);
        return jsonResponse([{ id: 9 }]);
      },
      async (calls) => {
        const results = await hybridSearch({ config: scopedConfig(), query: "q", dateFrom: null, dateTo: null, hashtags: ["x"] });
        assert.deepEqual(results, [{ id: 9 }]);
        assert.equal(calls.filter((call) => call.url.includes("/rest/v1/rpc/content_hybrid")).length, 2);
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

  test("chat project scope: content tool legs stay unscoped when the caller has no project", async () => {
    await withFetch(
      (call) => {
        if (call.url.includes("/rest/v1/rpc/match_meetings")) return jsonResponse([{ id: 5, similarity: 0.5 }]);
        if (call.url.includes("/rest/v1/meetings?")) return jsonResponse([{ id: 5, meeting_date: "2026-10-01" }]);
        return jsonResponse([], 404);
      },
      async (calls) => {
        const config = scopedConfig({ contentTools: { perTool: { meetings: { enabled: true, answerSynthesis: false } } } });
        await runContentToolAgent({ config, toolName: "meetings", query: "pour schedule" });
        for (const call of calls.filter((item) => item.url.includes("/rest/v1/meetings?"))) {
          assert.doesNotMatch(call.url, /project_id=/);
        }
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

  test("chat project scope: project-scoped chat skips the unscoped project graph search", () => {
    const agentSource = fs.readFileSync(new URL("../src/agent.js", import.meta.url), "utf8");
    assert.match(agentSource, /config\.graph\?\.enabled !== false && requestProjectId\(config\)\)[\s\S]{0,600}graph_search_not_project_scoped/);
  });

  test("chat project scope: chat passes its request config to the alert and meeting subagents", () => {
    const agentSource = fs.readFileSync(new URL("../src/agent.js", import.meta.url), "utf8");
    assert.match(agentSource, /runAlertAgent\(\{\s*config,/);
    assert.match(agentSource, /runMeetingEvidenceAgent\(\{[\s\S]{0,1200}?configOverride: config/);
  });
}
