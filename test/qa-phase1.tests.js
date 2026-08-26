import assert from "node:assert/strict";
import fs from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { runChatPipeline } from "../src/agent.js";
import { createRun, emitRunEvent, getRunEvents } from "../src/runLog.js";
import { buildQaMcpServer } from "../src/mcp/serverFactory.js";
import { QA_PHASE1_TOOL_NAMES } from "../src/mcp/tools/qaTools.js";
import { QA_ROLES, QaServiceError } from "../src/qa/contracts.js";
import { evaluateCaseRun } from "../src/qa/evaluator.js";
import { handleQaHttpRequest } from "../src/qa/httpApi.js";
import { InMemoryQaRepository } from "../src/qa/inMemoryQaRepository.js";
import { QaHarnessService } from "../src/qa/qaHarnessService.js";

const CONTEXT = Object.freeze({
  actorId: "qa-test-user",
  organizationId: "org-test",
  currentProjectId: "project-a",
  allowedProjectIds: ["project-a"],
  roles: [QA_ROLES.VIEWER, QA_ROLES.OPERATOR],
  environment: "qa"
});

export function registerQaPhase1Tests(test) {
  test("qa phase1 schema creates exactly the five isolated QA tables with server-only RLS", () => {
    const sql = fs.readFileSync(
      new URL("../supabase/migrations/20260822155219_qa_harness_phase1.sql", import.meta.url),
      "utf8",
    );
    const tables = [...sql.matchAll(/create table if not exists public\.(qa_[a-z_]+)/g)].map((match) => match[1]);
    assert.deepEqual(tables, ["qa_test_suites", "qa_test_cases", "qa_runs", "qa_case_runs", "qa_evaluations"]);
    for (const table of tables) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
    }
    assert.match(sql, /qa_evaluations_failure_codes_idx[\s\S]*using gin \(failure_codes\)/);
    assert.match(sql, /qa_case_runs_identity_idx/);
  });

  test("qa suite and case services are scoped, versioned, and idempotent", async () => {
    const repository = new InMemoryQaRepository();
    const service = serviceWithStub(repository);
    const suiteInput = {
      name: "Contracts smoke",
      description: "Contract QA",
      domain: "contracts",
      project_id: "project-a",
      is_regression: true,
      tags: ["contracts"],
      idempotency_key: "suite-contracts-001"
    };
    const created = await service.createTestSuite(CONTEXT, suiteInput);
    const replay = await service.createTestSuite(CONTEXT, suiteInput);
    assert.equal(replay.id, created.id);
    assert.equal(replay.idempotent_replay, true);

    const addInput = {
      suite_id: created.id,
      idempotency_key: "cases-contracts-001",
      cases: [{
        case_key: "route-rag",
        question: "What does the contract require?",
        expected_behavior: { expected_route: "RAG", must_have_sources: true },
        priority: "high",
        origin: "generated"
      }]
    };
    const added = await service.addTestCases(CONTEXT, addInput);
    const addedReplay = await service.addTestCases(CONTEXT, addInput);
    assert.equal(added.created, 1);
    assert.equal(addedReplay.cases[0].action, "replayed");
    assert.equal(addedReplay.cases[0].version, 1);

    const loaded = await service.getTestSuite(CONTEXT, { suite_id: created.id, include_cases: true, limit: 10 });
    assert.equal(loaded.suite.organization_id, "org-test");
    assert.equal(loaded.cases[0].is_golden, false);
    assert.equal(loaded.cases[0].origin, "generated");
  });

  test("qa isolated query passes the real execution contract without chat persistence or external side effects", async () => {
    const repository = new InMemoryQaRepository();
    let received = null;
    const service = serviceWithStub(repository, {
      pipeline: async (args) => {
        received = args;
        emitChatTrace(args.runId);
        return stubOutput("CHAT", { answer: "Hello", sources: [] });
      }
    });
    const result = await service.runQuery(CONTEXT, {
      question: "Hello",
      project_id: "project-a",
      expected_behavior: { expected_route: "CHAT" },
      idempotency_key: "query-hello-0001",
      budget: { max_estimated_cost: 1 }
    });
    assert.equal(received.ephemeral, true);
    assert.equal(received.executionMode, "qa");
    assert.equal(received.persistChatHistory, false);
    assert.equal(received.config.projectId, "project-a");
    assert.equal(received.config.qa.sideEffectsAllowed, false);
    assert.ok(Object.values(received.config.n8n.tools).every((value) => value === ""));
    assert.equal(result.run.status, "completed");
    assert.equal(result.execution.messageId, undefined);
    assert.equal(result.evaluation.status, "pass");
  });

  test("qa executionMode makes the actual chat pipeline ephemeral even when the legacy flag is false", async () => {
    const runId = "qa_real_pipeline_ephemeral";
    createRun(runId);
    const output = await runChatPipeline({
      message: "hello",
      sessionId: "qa-real-session",
      config: {
        openRouterApiKey: "",
        models: { classifier: "test", lite: "test", main: "test", embedding: "test", reranker: "test" },
        prompts: {},
        ai: {},
        memory: {},
        knowledge: {},
        cache: {},
        n8n: { tools: {}, runtime: {} },
        timezone: "Asia/Jerusalem"
      },
      runId,
      sourcesEnabled: false,
      executionMode: "qa",
      persistChatHistory: false,
      ephemeral: false
    });
    const saveEvent = getRunEvents(runId).find((event) => event.step === "save_message");
    assert.equal(output.messageId, null);
    assert.equal(output.memorySummary, null);
    assert.equal(saveEvent.data.status, "ephemeral");
    assert.equal(saveEvent.data.execution_mode, "qa");
  });

  test("qa suite runner enforces repetition, bounded concurrency, and stability summaries", async () => {
    const repository = new InMemoryQaRepository();
    let active = 0;
    let peak = 0;
    const service = serviceWithStub(repository, {
      pipeline: async (args) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 8));
        emitRagTrace(args.runId);
        active -= 1;
        return stubOutput("RAG", {
          answer: "The approved schedule is the source of truth.",
          sources: [{ id: "schedule-1", type: "schedule", title: "Schedule", url: "https://example.test/schedule/1" }]
        });
      }
    });
    const suite = await service.createTestSuite(CONTEXT, {
      name: "Schedule regression",
      domain: "schedule",
      project_id: "project-a",
      idempotency_key: "suite-schedule-001"
    });
    await service.addTestCases(CONTEXT, {
      suite_id: suite.id,
      idempotency_key: "cases-schedule-001",
      cases: [
        { case_key: "schedule-a", question: "Which schedule controls?", expected_behavior: { expected_route: "RAG", must_have_sources: true, required_source_types: ["schedule"] } },
        { case_key: "schedule-b", question: "What is the approved schedule?", expected_behavior: { expected_route: "RAG", must_have_sources: true, required_source_ids: ["schedule-1"] } }
      ]
    });
    const accepted = await service.runTestSuite(CONTEXT, {
      suite_id: suite.id,
      project_id: "project-a",
      parallelism: 2,
      repeat_each: 2,
      idempotency_key: "run-schedule-0001",
      budget: { max_cases: 10, max_parallel: 2, max_repeats: 2, max_estimated_cost: 5 }
    });
    assert.equal(accepted.status, "queued");
    assert.equal(accepted.execution_count, 4);
    await service.waitForRun(accepted.run_id);
    const run = await service.getRun(CONTEXT, { run_id: accepted.run_id, detail: "full", limit: 10 });
    const analysis = await service.analyzeRun(CONTEXT, { run_id: accepted.run_id });
    assert.equal(run.run.status, "completed");
    assert.equal(run.case_runs.length, 4);
    assert.equal(analysis.total_executions, 4);
    assert.equal(analysis.stability.cases.length, 2);
    assert.ok(analysis.stability.stability_score >= 90);
    assert.ok(peak <= 2);
  });

  test("qa service blocks cross-project execution before the pipeline runs", async () => {
    let called = false;
    const service = serviceWithStub(new InMemoryQaRepository(), {
      pipeline: async () => {
        called = true;
        return stubOutput("CHAT");
      }
    });
    await assert.rejects(
      service.runQuery(CONTEXT, {
        question: "Do not run",
        project_id: "project-b",
        idempotency_key: "query-denied-0001"
      }),
      (error) => error instanceof QaServiceError && error.code === "AUTHORIZATION_DENIED"
    );
    assert.equal(called, false);
  });

  test("qa evaluator gives deterministic findings precedence over a conflicting semantic judge", async () => {
    const evaluation = await evaluateCaseRun({
      caseRun: {
        question: "Use a schedule source",
        answer: "No source needed.",
        classification: { type: "CHAT" },
        tools: [],
        sources: [],
        errors: [],
        latency_ms: 10,
        context_trace: { completeness: { missing_stages: [] }, stages: [] }
      },
      expectedBehavior: { expected_route: "RAG", must_have_sources: true },
      semanticJudge: async () => ({ status: "completed", scores: { correctness: 100, grounding: 100 }, failure_codes: [], evidence: [] })
    });
    assert.ok(evaluation.failure_codes.includes("CLASSIFICATION_ERROR"));
    assert.ok(evaluation.failure_codes.includes("RETRIEVAL_MISS"));
    assert.notEqual(evaluation.status, "pass");
    assert.equal(evaluation.root_cause_domain, "Model/Prompt or Code/Pipeline");
  });

  test("qa MCP server exposes the seven Phase 1 contracts and returns structured envelopes", async () => {
    const repository = new InMemoryQaRepository();
    const service = serviceWithStub(repository);
    const server = buildQaMcpServer({ service, contextProvider: () => CONTEXT });
    const client = new Client({ name: "bidoc-qa-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const listed = await client.listTools();
      assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [...QA_PHASE1_TOOL_NAMES].sort());
      const result = await client.callTool({
        name: "qa_create_test_suite",
        arguments: {
          name: "MCP suite",
          domain: "general",
          project_id: "project-a",
          idempotency_key: "mcp-suite-0001"
        }
      });
      assert.equal(result.isError, undefined);
      assert.equal(result.structuredContent.status, "succeeded");
      assert.equal(result.structuredContent.data.domain, "general");
      assert.equal(result.structuredContent.meta.schema_version, "1.0");
    } finally {
      await client.close();
      await server.close();
    }
  });

  test("qa REST adapter calls the same service and returns the common envelope", async () => {
    const service = serviceWithStub(new InMemoryQaRepository());
    const request = { method: "POST", headers: {} };
    const created = await handleQaHttpRequest({
      req: request,
      url: new URL("http://localhost/api/qa/test-suites"),
      service,
      context: CONTEXT,
      readJson: async () => ({
        name: "REST suite",
        domain: "general",
        project_id: "project-a",
        idempotency_key: "rest-suite-0001"
      })
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.meta.schema_version, "1.0");
    assert.equal(created.body.data.name, "REST suite");

    const loaded = await handleQaHttpRequest({
      req: { method: "GET", headers: {} },
      url: new URL(`http://localhost/api/qa/test-suites/${created.body.data.id}?include_cases=true`),
      service,
      context: CONTEXT,
      readJson: async () => ({})
    });
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.data.suite.id, created.body.data.id);
  });
}

function serviceWithStub(repository, overrides = {}) {
  return new QaHarnessService({
    repository,
    configProvider: () => ({
      openRouterApiKey: "test-key",
      projectId: "project-a",
      models: { qa: "test-qa", embedding: "test-embedding" },
      retrieval: { rpcName: "test", candidates: 10 },
      n8n: { tools: { financial_transactions: "https://example.test/hook" }, runtime: {} }
    }),
    semanticJudge: async () => ({ status: "completed", model: "test-qa", scores: { correctness: 100, grounding: 100, completeness: 100, source_quality: 100, instruction_following: 100 }, failure_codes: [], evidence: [] }),
    ...overrides
  });
}

function stubOutput(route, { answer = "OK", sources = [] } = {}) {
  return {
    status: "complete",
    type: route,
    classification: { type: route },
    answer,
    sources,
    toolCalls: [],
    knowledgePlan: null,
    sourceQuality: null,
    conflicts: [],
    trace: [],
    openRouterUsage: {
      calls: [],
      totals: { calls: 0, successful_calls: 0, failed_calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cached_tokens: 0, reasoning_tokens: 0, cost: 0, duration_ms: 0 }
    },
    workflowLog: { nodes: [], cacheMetrics: {} }
  };
}

function emitChatTrace(runId) {
  for (const step of ["chat_input", "sanitize", "classifier", "heuristic_override", "knowledge_vocabulary", "lite_agent", "source_extraction"]) {
    emitRunEvent(runId, step, `${step} completed`, {});
  }
}

function emitRagTrace(runId) {
  for (const step of [
    "chat_input", "sanitize", "classifier", "heuristic_override", "knowledge_vocabulary", "query_planning",
    "embedding", "hybrid_search", "retrieval_filters", "deduplication", "reranker", "tool_selection",
    "conflict_detection", "context_construction", "main_agent", "source_extraction"
  ]) {
    emitRunEvent(runId, step, `${step} completed`, {});
  }
}
