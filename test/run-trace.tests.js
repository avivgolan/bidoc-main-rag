import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { buildCompactRunTrace, logFullRunTrace, RUN_TRACE_LIMITS, RUN_TRACE_VERSION } from "../src/runTrace.js";

// The compact run trace returned with every chat answer: steps, tools, durations,
// models, token and cost totals. Bounded, with no secrets and no raw documents.
// The full detail goes to the logs.

const PROJECT = "11111111-1111-4111-8111-111111111111";
const COMPANY = "https://company-trace.supabase.test";
const APP_DB = "https://app-db-trace.supabase.test";
const SECRET = "trace-test-bidoc-secret";
const COMPANY_KEY = "company-trace-service-key";
const DOCUMENT_TEXT = "CONFIDENTIAL-DOCUMENT-BODY the retaining wall pour is delayed";

const TEST_ENV = {
  VERCEL: "1",
  BIDOC_API_SECRET: SECRET,
  SUPABASE_URL: APP_DB,
  SUPABASE_SERVICE_ROLE_KEY: "app-db-trace-key",
  OPENROUTER_API_KEY: "sk-or-trace-test-key",
  META_SUPABASE_URL: undefined,
  META_SUPABASE_SERVICE_ROLE_KEY: undefined
};

const isoAt = (ms) => new Date(Date.UTC(2026, 9, 15, 10, 0, 0) + ms).toISOString();
const event = (ms, step, data = {}) => ({ id: `e${ms}`, time: isoAt(ms), step, message: `msg ${step}`, data });

function syntheticRun(overrides = {}) {
  return {
    runId: "run_trace_unit",
    startedAt: 1_000,
    finishedAt: 1_000 + 4_200,
    classification: { type: "RAG", urgency: "HIGH", professional: true, investigation: false, standalone_query: DOCUMENT_TEXT },
    agent: "main",
    workflowLog: {
      nodes: [
        { id: "classifier", label: "Smart Classifier", status: "done", input: { sanitized: DOCUMENT_TEXT }, output: { raw: DOCUMENT_TEXT } },
        { id: "hybrid_search", label: "Hybrid Search", status: "done", input: {}, output: { sample: [{ text: DOCUMENT_TEXT }] } },
        { id: "reranker", label: "OpenRouter Reranker", status: "error", input: {}, output: {} },
        { id: "update_message", label: "Update DB", status: "done", input: {}, output: {} }
      ],
      openRouterUsage: {
        calls: [],
        totals: { calls: 3, successful_calls: 2, failed_calls: 1, prompt_tokens: 900, completion_tokens: 120, total_tokens: 1020, cached_tokens: 10, reasoning_tokens: 0, cost: 0.0123, duration_ms: 2_100 }
      }
    },
    toolCalls: [
      { toolName: "hybrid_search", ok: true, data: [{ content: DOCUMENT_TEXT }, { content: "b" }], sources: [{ url: "https://x.test/a" }] },
      { toolName: "reranker", ok: false, fallback: true, error: `failed calling https://openrouter.ai/api with Bearer sk-or-abcdefghijklmnop for a@b.com`, data: null },
      { toolName: "alert", ok: false, skipped: true }
    ],
    runEvents: [
      event(0, "created"),
      event(100, "chat_input", { preview: DOCUMENT_TEXT }),
      event(300, "classifier"),
      event(900, "classifier"),
      event(1_000, "hybrid_search"),
      event(2_500, "reranker", { error: "boom" }),
      event(3_900, "main_agent"),
      event(4_000, "update_message")
    ],
    openRouterCalls: [
      { step: "classifier", kind: "chat", status: "done", requested_model: "openai/gpt-4o-mini", actual_model: "openai/gpt-4o-mini-2024", duration_ms: 600, prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost: 0.001 },
      { step: "reranker", kind: "chat", status: "error", requested_model: "openai/gpt-4o-mini", duration_ms: 50, http_status: 429, error: "rate limited sk-or-abcdefghijklmnop" },
      { step: "main_agent", kind: "chat", status: "done", requested_model: "openai/gpt-4o", duration_ms: 1_500, prompt_tokens: 800, completion_tokens: 100, total_tokens: 900, cost: 0.0113 }
    ],
    trace: [{ step: "mainAgent", ok: false, fallback: true, reason_code: "empty_answer", error: "x".repeat(500) }],
    ephemeral: false,
    ...overrides
  };
}

function fakeResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function installFakeFetch() {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input?.url || input);
    const parsed = new URL(url);
    const call = { url, origin: parsed.origin, method: String(options.method || "GET").toUpperCase(), body: typeof options.body === "string" ? options.body : null };
    calls.push(call);
    if (parsed.hostname === "openrouter.ai") {
      if (parsed.pathname.endsWith("/embeddings")) return fakeResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
      return fakeResponse({
        id: "gen-1",
        model: "openai/gpt-test-actual",
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ type: "RAG", complexity: "SPECIFIC", urgency: "NORMAL", answer: "ok" }) } }],
        usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15, cost: 0.0002 }
      });
    }
    if (call.origin === COMPANY && url.includes("/rest/v1/rpc/")) {
      return fakeResponse([{ id: "d1", project_id: PROJECT, content: DOCUMENT_TEXT, title: "Wall", url: "https://docs.test/wall" }], 200, { "content-range": "0-0/1" });
    }
    return fakeResponse([], 200, { "content-range": "*/0" });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const KAPAIM = { company: "https://kapaim-trace.supabase.test", key: "kapaim-trace-service-key", project: "33333333-3333-4333-8333-333333333333" };

function fakeReq(body, target = { company: COMPANY, key: COMPANY_KEY, project: PROJECT }) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]);
  req.method = "POST";
  req.url = "/api/chat";
  req.headers = {
    host: "main-agent.test",
    "content-type": "application/json",
    "x-bidoc-api-secret": SECRET,
    "x-content-supabase-url": target.company,
    "x-content-supabase-key": target.key,
    "x-project-id": target.project,
    "x-index-table": "data_index",
    "x-alerts-table": "alerts",
    "x-hybrid-rpc-name": "hybrid_match_data_index"
  };
  return req;
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    writeHead(status, headers = {}) { this.statusCode = status; Object.assign(this.headers, headers); return this; },
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(String(chunk)); return true; },
    end(chunk = "") { if (chunk) this.chunks.push(String(chunk)); this.ended = true; }
  };
}

// Runs one /api/chat request through the real HTTP handler under a fake network.
async function chatThroughHandler(body, target) {
  const saved = {};
  for (const [key, value] of Object.entries(TEST_ENV)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const fake = installFakeFetch();
  const logged = [];
  const originalInfo = console.info;
  console.info = (...args) => { logged.push(args.join(" ")); };
  try {
    const { default: handler } = await import("../src/server.js");
    const res = fakeRes();
    await handler(fakeReq(body, target), res);
    return { res, calls: fake.calls, logged };
  } finally {
    console.info = originalInfo;
    fake.restore();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const parseJsonBody = (res) => JSON.parse(res.chunks.join(""));
function parseResultFrame(res) {
  const text = res.chunks.join("");
  const match = text.match(/event: result\ndata: (.*)\n\n/);
  assert.ok(match, "the stream carries a result frame");
  return JSON.parse(match[1]);
}

// The top-level fields of a chat answer before the compact trace existed. BiDoc, the
// standalone UI and the QA harness read them; none may disappear or change shape.
const CHAT_ANSWER_FIELDS_BEFORE_TRACE = [
  "answer", "classification", "conflicts", "followUps", "investigationPlan", "knowledgePlan", "memoryDebug", "memorySummary",
  "messageId", "openRouterUsage", "progress", "runId", "sourceQuality", "sources", "status", "toolCalls", "trace", "type", "workflowLog"
];

export function registerRunTraceTests(test) {
  test("run trace: summarises steps, tools, durations, models and totals", () => {
    const trace = buildCompactRunTrace(syntheticRun());
    assert.equal(trace.version, RUN_TRACE_VERSION);
    assert.equal(trace.run_id, "run_trace_unit");
    assert.equal(trace.route, "RAG");
    assert.equal(trace.agent, "main");
    assert.equal(trace.urgency, "HIGH");
    assert.equal(trace.professional, true);
    assert.equal(trace.duration_ms, 4_200);
    // Each step is charged the time until the next step began.
    const step = (id) => trace.steps.find((item) => item.id === id);
    assert.deepEqual([step("classifier").status, step("classifier").offset_ms, step("classifier").duration_ms], ["done", 300, 700]);
    assert.deepEqual([step("hybrid_search").offset_ms, step("hybrid_search").duration_ms], [1_000, 1_500]);
    assert.equal(step("reranker").status, "error");
    assert.equal(step("reranker").duration_ms, 1_400);
    assert.equal(step("chat_input").status, "done");
    assert.deepEqual(trace.tools.map((tool) => [tool.name, tool.ok, tool.skipped, tool.fallback, tool.records, tool.sources]), [
      ["hybrid_search", true, false, false, 2, 1],
      ["reranker", false, false, true, null, 0],
      ["alert", false, true, false, null, 0]
    ]);
    assert.deepEqual(trace.models, ["openai/gpt-4o-mini-2024", "openai/gpt-4o"]);
    assert.equal(trace.model_calls.length, 3);
    assert.deepEqual(trace.model_calls[2], { step: "main_agent", kind: "chat", status: "done", model: "openai/gpt-4o", duration_ms: 1_500, prompt_tokens: 800, completion_tokens: 100, total_tokens: 900, cost: 0.0113 });
    assert.equal(trace.model_calls[1].http_status, 429);
    assert.equal(trace.totals.total_tokens, 1020);
    assert.equal(trace.totals.cost, 0.0123);
    assert.equal(trace.totals.failed_calls, 1);
    assert.equal(trace.failures[0].step, "mainAgent");
    assert.equal(trace.failures[0].reason, "empty_answer");
    assert.equal(trace.truncated, false);
  });

  test("run trace: carries no document text, query text, prompts, secrets, emails or URLs", () => {
    const text = JSON.stringify(buildCompactRunTrace(syntheticRun()));
    for (const forbidden of ["CONFIDENTIAL-DOCUMENT-BODY", "retaining wall", "sk-or-abcdefghijklmnop", "a@b.com", "https://", "Bearer sk-or"]) {
      assert.ok(!text.includes(forbidden), `the trace must not contain ${forbidden}`);
    }
    assert.match(text, /\[url\]/);
    // Failure text is capped.
    const long = buildCompactRunTrace(syntheticRun({ trace: [{ step: "s", ok: false, error: "y".repeat(900) }] }));
    assert.ok(long.failures[0].reason.length <= RUN_TRACE_LIMITS.textChars + 1);
  });

  test("run trace: stays under its byte cap however long the run is", () => {
    const manyEvents = Array.from({ length: 400 }, (_, index) => event(index * 10, `step_${index % 90}`));
    const manyCalls = Array.from({ length: 120 }, (_, index) => ({ step: `call_${index}`, kind: "chat", status: index % 2 ? "error" : "done", requested_model: "openai/gpt-4o", duration_ms: index, error: "e".repeat(300), prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.1 }));
    const manyTools = Array.from({ length: 80 }, (_, index) => ({ toolName: `tool_${index}`, ok: true, error: "t".repeat(300), data: [] }));
    const manyNodes = Array.from({ length: 90 }, (_, index) => ({ id: `step_${index}`, label: "L".repeat(200), status: "done" }));
    const trace = buildCompactRunTrace(syntheticRun({
      runEvents: manyEvents,
      openRouterCalls: manyCalls,
      toolCalls: manyTools,
      workflowLog: { nodes: manyNodes, openRouterUsage: { totals: {} } },
      trace: Array.from({ length: 60 }, (_, index) => ({ step: `f${index}`, ok: false, error: "z".repeat(400) }))
    }));
    assert.ok(Buffer.byteLength(JSON.stringify(trace), "utf8") <= RUN_TRACE_LIMITS.maxBytes);
    assert.equal(trace.truncated, true);
    assert.ok(trace.steps.length <= RUN_TRACE_LIMITS.steps);
    assert.ok(trace.totals.calls === 0, "missing totals fall back to zeros");
  });

  test("run trace: tolerates empty and malformed input without throwing", () => {
    for (const input of [{}, { runId: "r", runEvents: [null, { step: "x" }, { time: "nope" }], toolCalls: [null, 3], openRouterCalls: [null], trace: [null, "x"] }]) {
      const trace = buildCompactRunTrace(input);
      assert.equal(trace.version, RUN_TRACE_VERSION);
      assert.deepEqual(trace.totals.cost, null);
      assert.ok(Array.isArray(trace.steps) && Array.isArray(trace.tools));
    }
  });

  test("run trace: the full-detail log line holds every event and call, and a log failure never throws", () => {
    const lines = [];
    const run = syntheticRun();
    const compact = buildCompactRunTrace(run);
    logFullRunTrace({ runId: "run_trace_unit", sessionId: "bidoc:p:s", compact, runEvents: run.runEvents, openRouterCalls: run.openRouterCalls, log: (line) => lines.push(line) });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[run-trace\] /);
    const entry = JSON.parse(lines[0].replace(/^\[run-trace\] /, ""));
    assert.equal(entry.run_events.length, run.runEvents.length);
    assert.equal(entry.openrouter_calls.length, 3);
    assert.equal(entry.compact.run_id, "run_trace_unit");
    assert.doesNotThrow(() => logFullRunTrace({ runId: "r", compact, log: () => { throw new Error("log sink down"); } }));
  });

  test("run trace: the full-detail log redacts secrets, emails and phone numbers in events and OpenRouter errors", () => {
    const lines = [];
    const run = syntheticRun({
      runEvents: [event(0, "chat_input", { preview: "my key is sk-or-abcdefghijklmnop mail a@b.com call 054-123-4567", nested: { list: ["Bearer abc.def.ghi"] } })],
      openRouterCalls: [{ step: "classifier", status: "error", error: "bad key sk-or-abcdefghijklmnop" }]
    });
    logFullRunTrace({ runId: "r", compact: buildCompactRunTrace(run), runEvents: run.runEvents, openRouterCalls: run.openRouterCalls, log: (line) => lines.push(line) });
    for (const forbidden of ["sk-or-abcdefghijklmnop", "a@b.com", "054-123-4567", "abc.def.ghi"]) {
      assert.ok(!lines[0].includes(forbidden), `the log must not contain ${forbidden}`);
    }
    assert.match(lines[0], /REDACTED/);
  });

  test("run trace: /api/chat returns the compact trace and every old field, and writes nothing to MAIN", async () => {
    const { res, calls, logged } = await chatThroughHandler({
      message: "What happened with the retaining wall pour last week?",
      sessionId: `bidoc:${PROJECT}:trace-1`,
      projectId: PROJECT
    });
    assert.equal(res.statusCode, 200, res.chunks.join("").slice(0, 300));
    const body = parseJsonBody(res);
    // Backwards compatible: every field BiDoc and the standalone UI read today is still there.
    for (const field of ["messageId", "status", "type", "classification", "answer", "sources", "followUps", "progress", "toolCalls", "openRouterUsage", "trace", "workflowLog", "runId"]) {
      assert.ok(field in body, `old field ${field} is still returned`);
    }
    assert.ok(Array.isArray(body.trace));
    assert.ok(Array.isArray(body.workflowLog.nodes));
    // The new compact trace.
    const trace = body.runTrace;
    assert.equal(trace.version, RUN_TRACE_VERSION);
    assert.equal(trace.run_id, body.runId);
    assert.equal(trace.route, body.type);
    assert.ok(["lite", "main"].includes(trace.agent));
    assert.ok(trace.steps.some((item) => item.id === "classifier"));
    assert.ok(trace.steps.every((item) => typeof item.id === "string" && typeof item.status === "string"));
    assert.ok(trace.model_calls.length >= 1 && trace.totals.calls >= 1);
    assert.ok(trace.totals.total_tokens >= 15);
    assert.ok(trace.models.includes("openai/gpt-test-actual"));
    assert.ok(Number.isFinite(trace.duration_ms) && trace.duration_ms >= 0);
    assert.ok(Buffer.byteLength(JSON.stringify(trace), "utf8") <= RUN_TRACE_LIMITS.maxBytes);
    // No secrets, no raw documents.
    const traceText = JSON.stringify(trace);
    for (const forbidden of [DOCUMENT_TEXT, "retaining wall", COMPANY_KEY, SECRET, "sk-or-trace-test-key", COMPANY, APP_DB]) {
      assert.ok(!traceText.includes(forbidden), `the trace must not contain ${forbidden}`);
    }
    // Full detail went to the logs, not into the response trace.
    const line = logged.find((item) => item.startsWith("[run-trace] "));
    assert.ok(line, "the full run detail is logged");
    const entry = JSON.parse(line.slice("[run-trace] ".length));
    assert.equal(entry.run_id, body.runId);
    assert.ok(entry.run_events.length > trace.steps.length);
    assert.ok(!line.includes(COMPANY_KEY) && !line.includes(SECRET));
    // A Project request has no MAIN connection (ADR 0012): no chat copy is written there.
    assert.ok(!calls.some((call) => call.origin === APP_DB), "MAIN is never contacted by a Project chat");
    assert.equal(body.messageId, null, "no main-agent chat row, so no message id");
  });

  test("run trace: the streaming /api/chat result frame carries the same trace", async () => {
    const { res } = await chatThroughHandler({
      message: "What happened with the retaining wall pour last week?",
      sessionId: `bidoc:${PROJECT}:trace-2`,
      projectId: PROJECT,
      stream: true
    });
    const frame = parseResultFrame(res);
    assert.equal(frame.runTrace.version, RUN_TRACE_VERSION);
    assert.equal(frame.runTrace.run_id, frame.runId);
    assert.ok(typeof frame.answer === "string" && Array.isArray(frame.trace));
  });

  test("run trace: a Kapaim-shaped chat answer keeps every old field and gains only runTrace", async () => {
    const { res, calls } = await chatThroughHandler({
      message: "What happened with the retaining wall pour last week?",
      sessionId: `bidoc:${KAPAIM.project}:kapaim-1`,
      projectId: KAPAIM.project
    }, KAPAIM);
    assert.equal(res.statusCode, 200, res.chunks.join("").slice(0, 300));
    const body = parseJsonBody(res);
    assert.deepEqual(Object.keys(body).filter((key) => key !== "runTrace").sort(), CHAT_ANSWER_FIELDS_BEFORE_TRACE);
    assert.equal(typeof body.answer, "string");
    assert.equal(body.runTrace.version, RUN_TRACE_VERSION);
    assert.ok(!JSON.stringify(body.runTrace).includes(KAPAIM.key));
    // Only Kapaim's own Company DB is contacted (never MAIN): the trace adds no call.
    const origins = [...new Set(calls.map((call) => call.origin).filter((origin) => origin.includes("supabase.test")))];
    for (const origin of origins) assert.equal(origin, KAPAIM.company, `unexpected database ${origin}`);
  });

  test("run trace: an ephemeral (dashboard) run is traced too and still writes nothing to chat history", async () => {
    const fake = installFakeFetch();
    try {
      const { runChatPipeline } = await import("../src/agent.js");
      const { createRun } = await import("../src/runLog.js");
      createRun("run_trace_ephemeral");
      const output = await runChatPipeline({
        message: "hello",
        sessionId: `bidoc:${PROJECT}:eph`,
        config: {
          openRouterApiKey: "sk-or-trace-test-key",
          models: { classifier: "test", lite: "test", main: "test", embedding: "test", reranker: "test" },
          prompts: {}, ai: {}, memory: {}, knowledge: {}, cache: {}, n8n: { tools: {}, runtime: {} }, timezone: "Asia/Jerusalem"
        },
        runId: "run_trace_ephemeral",
        sourcesEnabled: false,
        ephemeral: true
      });
      assert.equal(output.runTrace.ephemeral, true);
      assert.equal(output.runTrace.run_id, "run_trace_ephemeral");
      assert.equal(output.messageId, null);
      assert.ok(!fake.calls.some((call) => call.url.includes("chat_messages_gf")), "no chat history call");
    } finally {
      fake.restore();
    }
  });
}
