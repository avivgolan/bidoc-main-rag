import { z } from "zod/v4";
import { errorEnvelope, resultEnvelope } from "../../qa/contracts.js";

export const QA_PHASE1_TOOL_NAMES = Object.freeze([
  "qa_create_test_suite",
  "qa_get_test_suite",
  "qa_add_test_cases",
  "qa_run_query",
  "qa_run_test_suite",
  "qa_get_run",
  "qa_analyze_run"
]);

const id = z.string().uuid();
const idempotencyKey = z.string().min(8).max(200);
const stringList = (max = 100) => z.array(z.string().min(1).max(1000)).max(max);
const expectedBehaviorSchema = z.object({
  expected_route: z.enum(["CHAT", "RAG", "chat", "rag"]).optional(),
  required_tools: stringList(30).optional(),
  forbidden_tools: stringList(30).optional(),
  required_source_types: stringList(30).optional(),
  required_source_ids: stringList(100).optional(),
  must_have_sources: z.boolean().optional(),
  expected_facts: stringList(100).optional(),
  forbidden_claims: stringList(100).optional(),
  reference_answer: z.string().max(20_000).nullable().optional(),
  max_latency_ms: z.number().int().min(1).max(600_000).nullable().optional()
}).strict();
const budgetSchema = z.object({
  max_cases: z.number().int().min(1).max(1000).optional(),
  max_parallel: z.number().int().min(1).max(20).optional(),
  max_repeats: z.number().int().min(1).max(10).optional(),
  max_estimated_cost: z.number().min(0).max(100_000).optional(),
  currency: z.string().length(3).optional()
}).strict();
const projectSelector = {
  project_id: z.string().min(1).max(200).nullable().optional()
};

export function registerQaTools(server, { service, contextProvider }) {
  register(server, "qa_create_test_suite", {
    title: "Create QA Test Suite",
    description: "Create an organization-scoped draft QA suite. This is an idempotent, low-risk write.",
    inputSchema: z.object({
      name: z.string().min(1).max(160),
      description: z.string().max(4000).optional(),
      domain: z.string().min(1).max(80),
      is_regression: z.boolean().optional(),
      tags: stringList(50).optional(),
      ...projectSelector,
      idempotency_key: idempotencyKey
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    accepted: false,
    handler: (context, args) => service.createTestSuite(context, args)
  }, contextProvider);

  register(server, "qa_get_test_suite", {
    title: "Get QA Test Suite",
    description: "Read one QA suite and optionally return a cursor-paged case list.",
    inputSchema: z.object({
      suite_id: id,
      include_cases: z.boolean().optional(),
      cursor: z.string().max(500).nullable().optional(),
      limit: z.number().int().min(1).max(100).optional()
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: (context, args) => service.getTestSuite(context, args)
  }, contextProvider);

  register(server, "qa_add_test_cases", {
    title: "Add QA Test Cases",
    description: "Batch create or version-update cases by case_key. Generated cases remain non-golden.",
    inputSchema: z.object({
      suite_id: id,
      cases: z.array(z.object({
        case_key: z.string().min(1).max(160),
        question: z.string().min(1).max(8000),
        expected_behavior: expectedBehaviorSchema.optional(),
        tags: stringList(50).optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).optional(),
        origin: z.enum(["manual", "generated", "production_failure", "user_dislike", "bug_report", "ground_truth"]).optional(),
        is_critical: z.boolean().optional(),
        enabled: z.boolean().optional()
      }).strict()).min(1).max(100),
      idempotency_key: idempotencyKey
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: (context, args) => service.addTestCases(context, args)
  }, contextProvider);

  register(server, "qa_run_query", {
    title: "Run Isolated QA Query",
    description: "Run one question through the real BiDoc pipeline in isolated QA mode with no chat-history persistence or unapproved external side effects.",
    inputSchema: z.object({
      question: z.string().min(1).max(8000),
      ...projectSelector,
      config_reference: z.union([z.literal("production"), z.object({ type: z.literal("production") }).strict()]).optional(),
      isolated_session: z.boolean().optional(),
      capture: z.object({ raw_result: z.boolean().optional(), trace: z.boolean().optional() }).strict().optional(),
      expected_behavior: expectedBehaviorSchema.optional(),
      budget: budgetSchema.optional(),
      idempotency_key: idempotencyKey
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: (context, args) => service.runQuery(context, args)
  }, contextProvider);

  register(server, "qa_run_test_suite", {
    title: "Run QA Test Suite",
    description: "Queue an isolated bounded-concurrency suite run. Read progress and results with qa_get_run.",
    inputSchema: z.object({
      suite_id: id,
      ...projectSelector,
      config_reference: z.union([z.literal("production"), z.object({ type: z.literal("production") }).strict()]).optional(),
      parallelism: z.number().int().min(1).max(20).optional(),
      repeat_each: z.number().int().min(1).max(10).optional(),
      stop_on_critical: z.boolean().optional(),
      budget: budgetSchema.optional(),
      corpus_version: z.string().max(200).nullable().optional(),
      idempotency_key: idempotencyKey
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    accepted: true,
    handler: (context, args) => service.runTestSuite(context, args)
  }, contextProvider);

  register(server, "qa_get_run", {
    title: "Get QA Run",
    description: "Read a QA run summary or cursor-paged failure/full case records.",
    inputSchema: z.object({
      run_id: id,
      detail: z.enum(["summary", "failures", "full"]).optional(),
      status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional(),
      failure_code: z.string().max(100).optional(),
      severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
      cursor: z.string().max(500).nullable().optional(),
      limit: z.number().int().min(1).max(100).optional()
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: (context, args) => service.getRun(context, args)
  }, contextProvider);

  register(server, "qa_analyze_run", {
    title: "Analyze QA Run",
    description: "Return pass rate, dimensional scores, stability, failure distribution, trace-backed root causes, and recommendations. Optional reevaluation persists a new evaluator result when versions change.",
    inputSchema: z.object({
      run_id: id,
      evaluation_profile_id: z.string().max(100).optional(),
      evaluation_profile_version: z.string().max(100).optional(),
      reevaluate: z.boolean().optional(),
      idempotency_key: z.string().min(8).max(200).optional()
    }).strict(),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    handler: (context, args) => service.analyzeRun(context, args)
  }, contextProvider);
}

function register(server, name, definition, contextProvider) {
  server.registerTool(name, {
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    annotations: definition.annotations
  }, async (args) => {
    try {
      const context = await contextProvider();
      const data = await definition.handler(context, args);
      const envelope = resultEnvelope(data, { status: definition.accepted ? "accepted" : "succeeded" });
      return mcpResult(envelope);
    } catch (error) {
      return mcpResult(errorEnvelope(error), true);
    }
  });
}

function mcpResult(envelope, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    structuredContent: envelope,
    ...(isError ? { isError: true } : {})
  };
}
