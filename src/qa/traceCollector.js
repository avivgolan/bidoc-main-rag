import crypto from "node:crypto";
import { safeErrorMessage } from "./contracts.js";

const SENSITIVE_KEY = /(api[-_]?key|authorization|credential|secret|password|service[-_]?role|system[-_]?prompt|prompt_value|document_body|raw_payload)/i;
const LONG_TEXT_KEY = /(content|payload|arguments|input|output|prompt|quote|excerpt|body|text)/i;

const EVENT_STAGE_MAP = Object.freeze({
  chat_input: "input",
  sanitize: "sanitize",
  classifier: "classification",
  heuristic_override: "heuristic_override",
  knowledge_vocabulary: "knowledge_routing",
  query_planning: "query_planning",
  knowledge_planner: "query_planning",
  embedding: "embedding",
  hybrid_search: "hybrid_retrieval",
  retrieval_filters: "filters",
  deduplication: "deduplication",
  graph_search: "graph_search",
  reranker: "reranking",
  tool_selection: "tool_selection",
  n8n_tools: "tool_calls",
  data_query: "tool_calls",
  meeting_evidence: "tool_calls",
  alert_agent: "tool_calls",
  conflict_detection: "conflict_detection",
  context_construction: "context_construction",
  main_agent: "main_model_call",
  lite_agent: "main_model_call",
  source_extraction: "source_extraction"
});

export function normalizeCaseExecution({
  executionId,
  question,
  output,
  events = [],
  startedAt,
  completedAt,
  error = null
}) {
  const latencyMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
  const workflowNodes = Array.isArray(output?.workflowLog?.nodes) ? output.workflowLog.nodes : [];
  const stages = buildTraceStages(events, workflowNodes);
  const expectedStages = expectedTraceStages(output?.classification?.type);
  const observed = new Set(stages.map((stage) => stage.step));
  const missingStages = expectedStages.filter((stage) => !observed.has(stage));
  const tools = normalizeTools(output?.toolCalls || [], events);
  const errors = collectExecutionErrors({ error, output, tools, missingStages });
  const usage = normalizeUsage(output?.openRouterUsage);
  const sources = normalizeSources(output?.sources || []);
  const retrieval = buildRetrievalTrace({ question, output, events, workflowNodes });
  const reranking = buildRerankingTrace({ events, workflowNodes });
  const contextTrace = {
    completeness: {
      complete: missingStages.length === 0,
      expected_stages: expectedStages,
      observed_stages: [...observed],
      missing_stages: missingStages
    },
    stages
  };
  return {
    execution_id: executionId,
    status: error ? "failed" : "completed",
    question,
    answer: String(output?.answer || ""),
    classification: redactValue(output?.classification || {}),
    retrieval,
    reranking,
    knowledge: redactValue(output?.knowledgePlan || {}),
    tools,
    sources,
    context_trace: contextTrace,
    workflow: redactValue({
      nodes: workflowNodes,
      cache_metrics: output?.workflowLog?.cacheMetrics || null
    }),
    errors,
    latency_ms: latencyMs,
    usage_metrics: usage,
    estimated_cost: usage?.totals?.cost ?? null,
    raw_result: buildReplayPayload({ output, events, executionId, startedAt, completedAt }),
    started_at: startedAt,
    completed_at: completedAt
  };
}

export function buildTraceStages(events = [], workflowNodes = []) {
  const byStage = new Map();
  for (const event of events) {
    const step = EVENT_STAGE_MAP[String(event?.step || "")];
    if (!step) continue;
    const time = validIso(event?.time) || new Date().toISOString();
    const current = byStage.get(step) || {
      step,
      started_at: time,
      completed_at: time,
      status: "done",
      summaries: [],
      errors: [],
      usage: null,
      estimated_cost: null
    };
    current.completed_at = time;
    current.summaries.push(redactValue({ message: event?.message || "", data: event?.data || {} }));
    if (/skipped/i.test(String(event?.message || "")) && current.status !== "error") current.status = "skipped";
    const eventError = event?.data?.error;
    if (eventError) {
      current.status = /failed|error/i.test(String(event?.message || "")) ? "error" : current.status;
      current.errors.push(safeErrorMessage(eventError));
    }
    byStage.set(step, current);
  }

  for (const node of workflowNodes) {
    const step = EVENT_STAGE_MAP[String(node?.id || "")];
    if (!step || byStage.has(step)) continue;
    const now = new Date().toISOString();
    byStage.set(step, {
      step,
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      status: node?.status === "error" ? "error" : node?.status === "skipped" ? "skipped" : "done",
      summaries: [redactValue({ input: node?.input || {}, output: node?.output || {} })],
      errors: [],
      usage: null,
      estimated_cost: null
    });
  }

  return [...byStage.values()].map((stage) => ({
    ...stage,
    duration_ms: Math.max(0, Date.parse(stage.completed_at) - Date.parse(stage.started_at))
  }));
}

export function expectedTraceStages(route) {
  const common = ["input", "sanitize", "classification", "heuristic_override", "knowledge_routing", "main_model_call", "source_extraction"];
  if (String(route || "").toUpperCase() !== "RAG") return common;
  return [
    ...common.slice(0, 5),
    "query_planning",
    "embedding",
    "hybrid_retrieval",
    "filters",
    "deduplication",
    "reranking",
    "tool_selection",
    "conflict_detection",
    "context_construction",
    "main_model_call",
    "source_extraction"
  ];
}

export function redactValue(value, key = "", depth = 0) {
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (value === null || value === undefined) return value;
  if (SENSITIVE_KEY.test(key)) return hashSummary(value);
  if (typeof value === "string") {
    const secretRedacted = value
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
      .replace(/(?:sk|sb_secret)_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]");
    if (LONG_TEXT_KEY.test(key) && secretRedacted.length > 1200) {
      return { hash: sha256(secretRedacted), length: secretRedacted.length, preview: secretRedacted.slice(0, 240) };
    }
    return secretRedacted.slice(0, 5000);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactValue(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 150).map(([childKey, childValue]) => [
      childKey,
      redactValue(childValue, childKey, depth + 1)
    ]));
  }
  return String(value);
}

function buildRetrievalTrace({ question, output, events, workflowNodes }) {
  const retrievalEvents = events.filter((event) => ["embedding", "hybrid_search", "retrieval_filters", "deduplication", "graph_search"].includes(event?.step));
  const retrievalNodes = workflowNodes.filter((node) => ["hybrid_search", "graph_search"].includes(node?.id));
  return redactValue({
    query: question,
    events: retrievalEvents,
    nodes: retrievalNodes,
    returned_source_ids: normalizeSources(output?.sources || []).map((source) => source.id),
    cache_metrics: output?.workflowLog?.cacheMetrics || null
  });
}

function buildRerankingTrace({ events, workflowNodes }) {
  return redactValue({
    events: events.filter((event) => event?.step === "reranker"),
    nodes: workflowNodes.filter((node) => node?.id === "reranker")
  });
}

function normalizeTools(toolCalls, events) {
  return toolCalls.slice(0, 100).map((call) => ({
    name: String(call?.toolName || call?.name || "unknown"),
    status: call?.ok ? "done" : call?.skipped ? "skipped" : "error",
    result_count: inferResultCount(call?.data),
    error_category: call?.error ? categorizeError(call.error) : null,
    error: call?.error ? safeErrorMessage(call.error) : null,
    side_effect_denied: call?.error === "QA_SIDE_EFFECT_DENIED" || call?.error === "SIDE_EFFECT_DENIED",
    safe_summary: redactValue({
      internal: Boolean(call?.internal),
      exact_read: Boolean(call?.exactRead),
      fallback: Boolean(call?.fallback),
      sources: Array.isArray(call?.sources) ? call.sources.length : 0
    })
  }));
}

function normalizeSources(sources) {
  return sources.slice(0, 200).map((source, index) => ({
    id: String(source?.id || `source_${index + 1}`),
    type: String(source?.type || "document"),
    title: String(source?.title || source?.label || `Source ${index + 1}`).slice(0, 500),
    url: source?.url ? String(source.url).slice(0, 2000) : null
  }));
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return { calls: [], totals: emptyUsageTotals() };
  return redactValue({
    calls: Array.isArray(usage.calls) ? usage.calls : [],
    totals: { ...emptyUsageTotals(), ...(usage.totals || {}) }
  });
}

function collectExecutionErrors({ error, output, tools, missingStages }) {
  const errors = [];
  if (error) errors.push({ code: categorizeError(error), message: safeErrorMessage(error) });
  for (const traceError of Array.isArray(output?.trace) ? output.trace : []) {
    if (traceError?.ok !== false && !traceError?.error && !traceError?.errors) continue;
    errors.push({
      code: categorizeError(traceError?.error || traceError?.errors?.[0]),
      step: traceError?.step || null,
      message: safeErrorMessage(traceError?.error || traceError?.errors?.join("; ") || "Pipeline stage failed")
    });
  }
  for (const tool of tools.filter((item) => item.status === "error" || item.side_effect_denied)) {
    errors.push({
      code: tool.side_effect_denied ? "SIDE_EFFECT_DENIED" : tool.error_category || "TOOL_FAILURE",
      step: "tool_calls",
      tool: tool.name,
      message: tool.error || "Tool failed"
    });
  }
  if (missingStages.length) {
    errors.push({ code: "TRACE_INCOMPLETE", step: "trace", message: `Missing trace stages: ${missingStages.join(", ")}` });
  }
  return errors;
}

function buildReplayPayload({ output, events, executionId, startedAt, completedAt }) {
  return redactValue({
    execution_id: executionId,
    answer: output?.answer || "",
    classification: output?.classification || {},
    sources: output?.sources || [],
    tool_calls: output?.toolCalls || [],
    knowledge_plan: output?.knowledgePlan || null,
    source_quality: output?.sourceQuality || null,
    conflicts: output?.conflicts || [],
    workflow: output?.workflowLog || {},
    events,
    started_at: startedAt,
    completed_at: completedAt
  });
}

function emptyUsageTotals() {
  return {
    calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cached_tokens: 0,
    reasoning_tokens: 0,
    cost: null,
    duration_ms: 0
  };
}

function inferResultCount(value) {
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value?.results)) return value.results.length;
  if (Array.isArray(value?.rows)) return value.rows.length;
  return null;
}

function categorizeError(value) {
  const message = safeErrorMessage(value).toLowerCase();
  if (message.includes("timeout") || message.includes("timed out")) return "TIMEOUT";
  if (message.includes("budget")) return "BUDGET_EXCEEDED";
  if (message.includes("authoriz") || message.includes("forbidden")) return "AUTHORIZATION_DENIED";
  if (message.includes("side_effect")) return "SIDE_EFFECT_DENIED";
  return "TOOL_FAILURE";
}

function hashSummary(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return { redacted: true, hash: sha256(text), length: text.length };
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function validIso(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
