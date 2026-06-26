import crypto from "node:crypto";

const TEXT_LIMIT = 700;
const LONG_TEXT_LIMIT = 1200;
const STEP_SUMMARY_LIMIT = 420;
const MAX_AGENT_STEPS = 40;
const MAX_EVIDENCE_ITEMS = 10;
const MAX_ERROR_ITEMS = 20;
const SENSITIVE_KEY_RE = /(?:api[_-]?key|authorization|bearer|token|secret|password|service[_-]?role|supabase[_-]?service)/i;
const SENSITIVE_VALUE_RE = /\b(?:sk-[A-Za-z0-9_-]{8,}|sb_secret_[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+)\b/g;

const STEP_MISSIONS = {
  chat_input: "Capture the user's original request.",
  sanitize: "Remove unsafe prompt-injection patterns and bound raw user input.",
  save_message: "Persist the pending chat message.",
  classifier: "Classify the request, route CHAT/RAG, choose tools, and detect professional or investigation needs.",
  knowledge_vocabulary: "Apply local professional Knowledge Base trigger vocabulary.",
  memory: "Load recent conversation memory and local summary.",
  switch: "Route the request to Lite or Main RAG flow.",
  lite_agent: "Answer small talk and non-project questions.",
  investigation: "Mark causal or multi-source investigation behavior.",
  knowledge_planner: "Convert professional Knowledge Base excerpts into a compact search and reasoning plan.",
  hybrid_search: "Retrieve candidate project records using hybrid vector and keyword search.",
  graph_search: "Find project graph relationships connected to retrieved records.",
  reranker: "Rank retrieved records by relevance to the exact user question.",
  alert_agent: "Summarize relevant alert records when alert routing is active.",
  n8n_tools: "Call configured external project tools and report skipped or failed tools.",
  source_quality: "Assess source reliability and quality.",
  conflict_detection: "Detect conflicting evidence across sources.",
  main_agent: "Synthesize the final grounded answer from retrieval, tools, graph, memory, and plans.",
  update_message: "Persist the final AI response and workflow log."
};

const PROMPT_BY_STEP = {
  classifier: "classifier",
  knowledge_planner: "knowledge_planner",
  lite_agent: "lite",
  reranker: "reranker",
  main_agent: "main"
};

export function buildQaRunSummary({ userMessage = "", aiResponse = "", workflowLog = null, userFeedback = null } = {}) {
  const workflow = workflowLog && typeof workflowLog === "object" ? workflowLog : {};
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes.slice(0, MAX_AGENT_STEPS) : [];
  const promptInventory = buildPromptInventory(workflow.activePrompts || {});
  const agentSteps = nodes.map((node) => summarizeNode(node, promptInventory));
  const openrouter = summarizeOpenRouter(workflow, agentSteps);
  return {
    schema_version: 1,
    run_overview: {
      user_message: cleanText(userMessage, LONG_TEXT_LIMIT),
      ai_response_preview: cleanText(aiResponse, LONG_TEXT_LIMIT),
      user_feedback: userFeedback ? cleanText(userFeedback, TEXT_LIMIT) : null,
      workflow_node_count: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
      workflow_log_chars: safeJsonLength(workflow),
      status_counts: countStatuses(nodes),
      route: routeFromNodes(nodes),
      has_openrouter_usage: Boolean(workflow.openRouterUsage),
      active_prompt_keys: Object.keys(workflow.activePrompts || {})
    },
    agent_steps: agentSteps,
    retrieval_evidence: buildRetrievalEvidence(nodes),
    grounding_inputs: buildGroundingInputs(nodes, aiResponse),
    openrouter_usage: openrouter,
    errors_and_fallbacks: buildErrorsAndFallbacks(nodes, workflow.trace || []),
    source_and_citation_signals: buildSourceSignals(nodes, aiResponse),
    prompt_inventory: promptInventory
  };
}

function summarizeNode(node = {}, promptInventory = {}) {
  const input = sanitizeValue(node.input);
  const output = sanitizeValue(node.output);
  const metrics = summarizeNodeMetrics(node);
  const promptKey = PROMPT_BY_STEP[node.id] || null;
  return {
    step: String(node.id || "unknown"),
    label: cleanText(node.label || node.id || "Unknown step", 120),
    kind: cleanText(node.kind || "", 40),
    status: normalizeStatus(node.status),
    mission: STEP_MISSIONS[node.id] || "Workflow step.",
    input_keys: objectKeys(input),
    output_keys: objectKeys(output),
    input_summary: summarizeValue(input, STEP_SUMMARY_LIMIT),
    output_summary: summarizeValue(output, STEP_SUMMARY_LIMIT),
    metrics,
    prompt: promptKey && promptInventory[promptKey]
      ? {
          key: promptKey,
          hash: promptInventory[promptKey].hash,
          chars: promptInventory[promptKey].chars
        }
      : null,
    evidence: evidenceForNode(node),
    visible_issue: visibleIssue(node)
  };
}

function buildPromptInventory(activePrompts = {}) {
  const inventory = {};
  for (const [key, value] of Object.entries(activePrompts || {})) {
    const text = String(value || "");
    inventory[key] = {
      key,
      chars: text.length,
      hash: hashText(text),
      preview: cleanText(text, 240)
    };
  }
  return inventory;
}

function buildRetrievalEvidence(nodes = []) {
  const byId = nodeMap(nodes);
  const reranker = byId.reranker;
  const hybrid = byId.hybrid_search;
  const graph = byId.graph_search;
  const topChunks = asArray(reranker?.output?.top_chunks).slice(0, MAX_EVIDENCE_ITEMS).map((chunk) => ({
    source: "reranker",
    rank: numberOrNull(chunk.rank),
    hybrid_score: numberOrNull(chunk.hybrid_score),
    rerank_score: numberOrNull(chunk.rerank_score),
    rerank_reason: cleanText(chunk.rerank_reason || "", 400),
    text: cleanText(chunk.text || "", TEXT_LIMIT),
    url: cleanText(chunk.url || "", 500),
    metadata: sanitizeValue(chunk.metadata || null, 2)
  }));
  const hybridSample = asArray(hybrid?.output?.sample).slice(0, 5).map((item, index) => ({
    source: "hybrid_search",
    rank: index + 1,
    score: numberOrNull(item.score),
    text: cleanText(item.text || "", 500),
    metadata: sanitizeValue(item.metadata || null, 2)
  }));
  const graphSample = asArray(graph?.output?.sample).slice(0, 8).map((item, index) => ({
    source: "graph_search",
    rank: index + 1,
    relation: cleanText(item.relation || item.edge_type || "", 120),
    from: cleanText(item.source || item.from_node?.label || "", 160),
    to: cleanText(item.target || item.to_node?.label || "", 160),
    evidence: cleanText(item.evidence || "", 300),
    confidence: numberOrNull(item.confidence)
  }));
  return {
    hybrid_records_returned: numberOrNull(hybrid?.output?.records_returned),
    reranker_records_returned: numberOrNull(reranker?.output?.records_returned),
    graph_relationships_returned: numberOrNull(graph?.output?.relationships_returned),
    top_chunks: topChunks,
    hybrid_sample: hybridSample,
    graph_sample: graphSample
  };
}

function buildGroundingInputs(nodes = [], aiResponse = "") {
  const byId = nodeMap(nodes);
  const main = byId.main_agent;
  return {
    answer_mode: cleanText(main?.input?.answer_mode || "", 80),
    retrieval_records: numberOrNull(main?.input?.retrieval_records),
    graph_relationships: numberOrNull(main?.input?.graph_relationships),
    tool_calls: numberOrNull(main?.input?.tool_calls),
    source_count: asArray(main?.output?.sources).length,
    sources: asArray(main?.output?.sources).slice(0, MAX_EVIDENCE_ITEMS).map((source) => ({
      title: cleanText(source.title || source.label || "", 180),
      url: cleanText(source.url || "", 500),
      toolName: cleanText(source.toolName || source.source || "", 120)
    })),
    answer_preview: cleanText(aiResponse || main?.output?.answer || "", LONG_TEXT_LIMIT)
  };
}

function summarizeOpenRouter(workflow = {}, agentSteps = []) {
  const calls = asArray(workflow.openRouterUsage?.calls)
    .concat(agentSteps.flatMap((step) => asArray(step.metrics?.calls)))
    .filter(Boolean);
  const uniqueCalls = uniqueBy(calls, (call) => call.call_id || `${call.step}:${call.generation_id}:${call.duration_ms}`);
  return {
    totals: sanitizeMetrics(workflow.openRouterUsage?.totals || aggregateCallMetrics(uniqueCalls)),
    calls: uniqueCalls.map((call) => sanitizeOpenRouterCall(call)).slice(0, 30)
  };
}

function buildErrorsAndFallbacks(nodes = [], trace = []) {
  const fromNodes = nodes
    .filter((node) => node.status === "error" || hasTruthy(node.output, "fallback") || node.output?.error || node.input?.error)
    .map((node) => ({
      step: cleanText(node.id || "", 80),
      status: normalizeStatus(node.status),
      error: cleanText(node.output?.error || node.input?.error || "", 500),
      fallback: Boolean(node.output?.fallback || node.input?.fallback)
    }));
  const fromTrace = asArray(trace)
    .filter((item) => item?.fallback || item?.error || item?.status === "error")
    .map((item) => ({
      step: cleanText(item.step || "", 80),
      status: cleanText(item.status || (item.error ? "error" : ""), 80),
      error: cleanText(item.error || "", 500),
      fallback: Boolean(item.fallback)
    }));
  return uniqueBy([...fromNodes, ...fromTrace], (item) => `${item.step}:${item.error}:${item.fallback}`)
    .slice(0, MAX_ERROR_ITEMS);
}

function buildSourceSignals(nodes = [], aiResponse = "") {
  const byId = nodeMap(nodes);
  const mainOutput = byId.main_agent?.output || {};
  const response = String(aiResponse || mainOutput.answer || "");
  const markdownLinks = [...response.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].map((match) => match[1]);
  return {
    answer_markdown_link_count: markdownLinks.length,
    answer_has_no_direct_source_marker: /ללא קישור ישיר|no direct/i.test(response),
    source_count: asArray(mainOutput.sources).length,
    conflict_count: asArray(mainOutput.conflicts).length,
    source_quality: sanitizeValue(mainOutput.source_quality || null, 3),
    sample_links: markdownLinks.slice(0, 10).map((url) => cleanText(url, 500))
  };
}

function summarizeNodeMetrics(node = {}) {
  const calls = asArray(node.openrouter).map((call) => sanitizeOpenRouterCall(call));
  return {
    model: calls[0]?.actual_model || calls[0]?.requested_model || node.input?.model || null,
    prompt_tokens: sumMetric(calls, "prompt_tokens"),
    completion_tokens: sumMetric(calls, "completion_tokens"),
    total_tokens: sumMetric(calls, "total_tokens"),
    cost: sumMetric(calls, "cost"),
    duration_ms: sumMetric(calls, "duration_ms"),
    generation_id: calls[0]?.generation_id || null,
    calls
  };
}

function evidenceForNode(node = {}) {
  const output = node.output || {};
  if (node.id === "reranker") {
    return asArray(output.top_chunks).slice(0, 6).map((chunk) => [
      `rank ${chunk.rank || "?"}`,
      chunk.rerank_reason ? `reason: ${chunk.rerank_reason}` : "",
      chunk.text ? cleanText(chunk.text, 260) : "",
      chunk.url ? cleanText(chunk.url, 220) : ""
    ].filter(Boolean).join(" | "));
  }
  if (node.id === "hybrid_search") {
    return asArray(output.sample).slice(0, 6).map((item, index) => `sample ${index + 1}: ${cleanText(item.text || "", 320)}`);
  }
  if (node.id === "graph_search") {
    return asArray(output.sample).slice(0, 6).map((item) => cleanText(`${item.source || item.from_node?.label || ""} ${item.relation || item.edge_type || ""} ${item.target || item.to_node?.label || ""}`, 320));
  }
  if (node.id === "n8n_tools" || node.id === "safety_precheck") {
    return asArray(output.results).slice(0, 6).map((item) => `${item.toolName}: ${item.ok ? "ok" : item.skipped ? "skipped" : "error"} ${cleanText(item.error || "", 220)}`.trim());
  }
  if (output.error) return [cleanText(output.error, 500)];
  return [];
}

function visibleIssue(node = {}) {
  if (node.status === "error") return cleanText(node.output?.error || node.input?.error || "Step status is error.", 700);
  if (node.output?.fallback) return cleanText(node.output?.error || "Step used fallback behavior.", 700);
  if (node.status === "skipped" && node.id === "knowledge_planner") return cleanText(node.output?.reason || "Knowledge planner skipped.", 700);
  return null;
}

function sanitizeOpenRouterCall(call = {}) {
  return {
    step: cleanText(call.step || "", 80),
    call_id: cleanText(call.call_id || "", 120),
    kind: cleanText(call.kind || "", 40),
    status: cleanText(call.status || "", 40),
    requested_model: cleanText(call.requested_model || "", 160),
    actual_model: cleanText(call.actual_model || "", 160),
    generation_id: cleanText(call.generation_id || "", 160),
    prompt_tokens: numberOrNull(call.prompt_tokens),
    completion_tokens: numberOrNull(call.completion_tokens),
    total_tokens: numberOrNull(call.total_tokens),
    cached_tokens: numberOrNull(call.cached_tokens),
    reasoning_tokens: numberOrNull(call.reasoning_tokens),
    cost: numberOrNull(call.cost),
    duration_ms: numberOrNull(call.duration_ms),
    finish_reason: cleanText(call.finish_reason || "", 80),
    error: cleanText(call.error || "", 300)
  };
}

function sanitizeMetrics(metrics = {}) {
  return {
    calls: numberOrNull(metrics.calls),
    successful_calls: numberOrNull(metrics.successful_calls),
    failed_calls: numberOrNull(metrics.failed_calls),
    prompt_tokens: numberOrNull(metrics.prompt_tokens),
    completion_tokens: numberOrNull(metrics.completion_tokens),
    total_tokens: numberOrNull(metrics.total_tokens),
    cached_tokens: numberOrNull(metrics.cached_tokens),
    reasoning_tokens: numberOrNull(metrics.reasoning_tokens),
    cost: numberOrNull(metrics.cost),
    duration_ms: numberOrNull(metrics.duration_ms),
    output_tokens_per_second: numberOrNull(metrics.output_tokens_per_second)
  };
}

function aggregateCallMetrics(calls = []) {
  const completed = calls.filter((call) => call.status === "done");
  return {
    calls: calls.length,
    successful_calls: completed.length,
    failed_calls: calls.length - completed.length,
    prompt_tokens: sumMetric(completed, "prompt_tokens"),
    completion_tokens: sumMetric(completed, "completion_tokens"),
    total_tokens: sumMetric(completed, "total_tokens"),
    cached_tokens: sumMetric(completed, "cached_tokens"),
    reasoning_tokens: sumMetric(completed, "reasoning_tokens"),
    cost: sumMetric(completed, "cost"),
    duration_ms: sumMetric(completed, "duration_ms")
  };
}

function sanitizeValue(value, depth = 4) {
  if (depth < 0) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return cleanText(value, TEXT_LIMIT);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitizeValue(item, depth - 1));
  if (typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      output[key] = SENSITIVE_KEY_RE.test(key) ? "[REDACTED]" : sanitizeValue(item, depth - 1);
    }
    return output;
  }
  return cleanText(String(value), TEXT_LIMIT);
}

function summarizeValue(value, limit = TEXT_LIMIT) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return cleanText(value, limit);
  if (Array.isArray(value)) {
    const first = value[0];
    const firstKeys = first && typeof first === "object" && !Array.isArray(first)
      ? `; first item keys: ${Object.keys(first).slice(0, 8).join(", ")}`
      : "";
    return cleanText(`array(${value.length})${firstKeys}`, limit);
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).slice(0, 12);
    const details = keys.slice(0, 6).map((key) => summarizeObjectField(key, value[key]));
    return cleanText(`keys: ${keys.join(", ")}${details.length ? `; ${details.join("; ")}` : ""}`, limit);
  }
  return cleanText(String(value), limit);
}

function cleanText(value = "", limit = TEXT_LIMIT) {
  const text = String(value || "").replace(SENSITIVE_VALUE_RE, "[REDACTED]");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function summarizeObjectField(key, value) {
  if (value === null || value === undefined) return `${key}: null`;
  if (typeof value === "string") {
    const text = cleanText(value, 120);
    return value.length > 120 ? `${key}: text(${value.length} chars) ${text}` : `${key}: ${text}`;
  }
  if (typeof value === "number" || typeof value === "boolean") return `${key}: ${value}`;
  if (Array.isArray(value)) return `${key}: array(${value.length})`;
  if (typeof value === "object") return `${key}: object keys(${Object.keys(value).slice(0, 6).join(", ")})`;
  return `${key}: ${cleanText(String(value), 80)}`;
}

function routeFromNodes(nodes = []) {
  const switchNode = nodes.find((node) => node.id === "switch");
  return cleanText(switchNode?.output?.route || "", 120);
}

function countStatuses(nodes = []) {
  return nodes.reduce((acc, node) => {
    const status = normalizeStatus(node.status);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function normalizeStatus(status = "") {
  const value = String(status || "").toLowerCase();
  if (["done", "skipped", "error"].includes(value)) return value;
  return value || "unknown";
}

function objectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).slice(0, 30)
    : [];
}

function nodeMap(nodes = []) {
  return Object.fromEntries(nodes.map((node) => [node.id, node]));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeJsonLength(value) {
  try {
    return JSON.stringify(value || {}).length;
  } catch {
    return null;
  }
}

function sumMetric(items = [], key) {
  const numbers = items.map((item) => numberOrNull(item?.[key])).filter((item) => item !== null);
  if (!numbers.length) return null;
  const sum = numbers.reduce((acc, item) => acc + item, 0);
  return key === "cost" ? Number(sum.toFixed(8)) : sum;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasTruthy(value, key) {
  if (!value || typeof value !== "object") return false;
  if (value[key]) return true;
  return Object.values(value).some((item) => item && typeof item === "object" && hasTruthy(item, key));
}

function uniqueBy(items = [], getKey) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function hashText(value = "") {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}
