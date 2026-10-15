// The compact run trace returned with every chat answer.
//
// BiDoc saves it next to the answer (in the assistant message's metadata), so a
// Superadmin can see how an answer was produced: which steps ran and for how
// long, which tools were called, which models were used, and the token and cost
// totals. It is deliberately small and safe to store: counts and names only, no
// document text, no prompts, no query text, no secrets, and a hard size cap.
// The full detail (every run event and OpenRouter call) goes to the logs through
// logFullRunTrace().
import { redactLogText } from "./memoryLogger.js";

export const RUN_TRACE_VERSION = 1;

export const RUN_TRACE_LIMITS = Object.freeze({
  steps: 40,
  tools: 24,
  modelCalls: 24,
  failures: 12,
  textChars: 160,
  // The serialized trace never exceeds this many UTF-8 bytes.
  maxBytes: 8192
});

// Longest the full-detail log line may be. Vercel truncates very long lines.
const FULL_LOG_MAX_CHARS = 200_000;

const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const roundedMs = (value) => {
  const number = finiteOrNull(value);
  return number === null ? null : Math.max(0, Math.round(number));
};

// Short, single-line, free of secrets, addresses and URLs.
function safeText(value, max = RUN_TRACE_LIMITS.textChars) {
  if (value === null || value === undefined) return null;
  const text = redactLogText(String(value))
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// An identifier-like value (step, tool, model name): letters, digits and a few
// separators only, so free text can never ride along in an id field.
function safeId(value, max = 80) {
  const text = String(value ?? "").trim().slice(0, max);
  return /^[\w.\-:/@+ ]+$/.test(text) ? text : null;
}

function rowCount(data) {
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.data)) return data.data.length;
  if (Array.isArray(data?.matches)) return data.matches.length;
  if (Array.isArray(data?.documents)) return data.documents.length;
  return null;
}

// Time spent per step, from the run events: each step is charged the wall-clock
// from its first event to the first event of the next different step (the last
// step runs to the final event). Steps run one after another, so this is the
// step's own time plus any untracked gap before the next one.
function stepTimings(runEvents) {
  const events = (Array.isArray(runEvents) ? runEvents : [])
    .map((event) => ({ step: safeId(event?.step), time: Date.parse(event?.time), data: event?.data }))
    .filter((event) => event.step && Number.isFinite(event.time));
  if (!events.length) return [];
  const origin = events[0].time;
  const steps = [];
  for (const event of events) {
    const previous = steps[steps.length - 1];
    if (previous && previous.step === event.step) {
      if (event.data?.status === "warning" || event.data?.error) previous.warned = true;
      continue;
    }
    if (previous) previous.endTime = event.time;
    steps.push({
      step: event.step,
      offsetMs: event.time - origin,
      startTime: event.time,
      endTime: event.time,
      warned: Boolean(event.data?.status === "warning" || event.data?.error)
    });
  }
  const last = events[events.length - 1];
  steps[steps.length - 1].endTime = last.time;
  return steps;
}

function buildSteps({ workflowLog, runEvents }) {
  const statusById = new Map();
  const labelById = new Map();
  for (const node of Array.isArray(workflowLog?.nodes) ? workflowLog.nodes : []) {
    const id = safeId(node?.id);
    if (!id) continue;
    statusById.set(id, safeId(node?.status) || "done");
    labelById.set(id, safeText(node?.label, 60));
  }
  const timings = stepTimings(runEvents);
  const merged = new Map();
  for (const entry of timings) {
    const existing = merged.get(entry.step);
    const duration = Math.max(0, entry.endTime - entry.startTime);
    if (existing) {
      existing.duration_ms += duration;
      continue;
    }
    merged.set(entry.step, {
      id: entry.step,
      label: labelById.get(entry.step) || null,
      status: statusById.get(entry.step) || (entry.warned ? "warning" : "done"),
      offset_ms: roundedMs(entry.offsetMs),
      duration_ms: roundedMs(duration)
    });
  }
  // A workflow node with no run event of its own still shows up, untimed.
  for (const [id, status] of statusById) {
    if (!merged.has(id)) merged.set(id, { id, label: labelById.get(id) || null, status, offset_ms: null, duration_ms: null });
  }
  return [...merged.values()];
}

function buildTools(toolCalls) {
  return (Array.isArray(toolCalls) ? toolCalls : []).map((call) => {
    const entry = {
      name: safeId(call?.toolName) || "unknown",
      ok: call?.ok === true,
      skipped: call?.skipped === true,
      fallback: call?.fallback === true,
      records: rowCount(call?.data),
      sources: Array.isArray(call?.sources) ? call.sources.length : 0
    };
    const error = safeText(call?.error, 120);
    if (error && !entry.ok) entry.error = error;
    return entry;
  });
}

function buildModelCalls(openRouterCalls) {
  return (Array.isArray(openRouterCalls) ? openRouterCalls : []).map((call) => {
    const entry = {
      step: safeId(call?.step) || "openrouter",
      kind: safeId(call?.kind, 24),
      status: safeId(call?.status, 24) || "done",
      model: safeId(call?.actual_model || call?.requested_model),
      duration_ms: roundedMs(call?.duration_ms),
      prompt_tokens: finiteOrNull(call?.prompt_tokens),
      completion_tokens: finiteOrNull(call?.completion_tokens),
      total_tokens: finiteOrNull(call?.total_tokens),
      cost: finiteOrNull(call?.cost)
    };
    if (entry.status !== "done") {
      entry.http_status = finiteOrNull(call?.http_status);
      entry.error = safeText(call?.error, 120);
    }
    return entry;
  });
}

function buildFailures(trace) {
  return (Array.isArray(trace) ? trace : [])
    .filter((item) => item && item.ok === false)
    .map((item) => ({
      step: safeId(item.step) || "unknown",
      fallback: item.fallback === true,
      reason: safeId(item.reason_code, 60) || safeText(item.error, 120) || null,
      integrity_status: safeId(item.integrity_status, 60)
    }));
}

function totalsFrom(usage) {
  const totals = usage?.totals || {};
  return {
    calls: finiteOrNull(totals.calls) ?? 0,
    failed_calls: finiteOrNull(totals.failed_calls) ?? 0,
    prompt_tokens: finiteOrNull(totals.prompt_tokens) ?? 0,
    completion_tokens: finiteOrNull(totals.completion_tokens) ?? 0,
    total_tokens: finiteOrNull(totals.total_tokens) ?? 0,
    cached_tokens: finiteOrNull(totals.cached_tokens) ?? 0,
    reasoning_tokens: finiteOrNull(totals.reasoning_tokens) ?? 0,
    cost: finiteOrNull(totals.cost),
    model_duration_ms: roundedMs(totals.duration_ms) ?? 0
  };
}

const byteLength = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");

// Drops detail, least useful first, until the trace fits the byte cap.
function fitToBudget(trace) {
  const result = trace; // shrunk in place
  const shrinkers = [
    () => { for (const call of result.model_calls) { delete call.error; delete call.http_status; } },
    () => { result.model_calls.length = Math.min(result.model_calls.length, 8); result.truncated = true; },
    () => { result.tools.length = Math.min(result.tools.length, 8); result.truncated = true; },
    () => { for (const step of result.steps) step.label = null; },
    () => { result.steps.length = Math.min(result.steps.length, 20); result.truncated = true; },
    () => { result.failures.length = Math.min(result.failures.length, 4); result.truncated = true; },
    () => { result.model_calls = []; result.tools = []; result.truncated = true; }
  ];
  for (const shrink of shrinkers) {
    if (byteLength(result) <= RUN_TRACE_LIMITS.maxBytes) break;
    shrink();
  }
  return result;
}

/**
 * Build the compact trace of one chat run.
 *
 * @param {object} input
 * @param {string} input.runId
 * @param {number} input.startedAt           Date.now() when the pipeline started.
 * @param {object} input.classification      The route decision (type, urgency, ...).
 * @param {string} input.agent               "lite" | "main" | "memory_action".
 * @param {object} input.workflowLog         Its nodes give each step's status; openRouterUsage gives the totals.
 * @param {Array}  input.toolCalls           The run's tool calls.
 * @param {Array}  input.runEvents           The run's events (timing source).
 * @param {Array}  input.openRouterCalls     Every OpenRouter call of the run.
 * @param {Array}  input.trace               The run's failure/fallback entries.
 * @param {boolean} input.ephemeral          True when the run kept nothing in chat history.
 * @param {number} [input.finishedAt]
 */
export function buildCompactRunTrace({
  runId,
  startedAt,
  finishedAt = Date.now(),
  classification = null,
  agent = null,
  workflowLog = null,
  toolCalls = [],
  runEvents = [],
  openRouterCalls = [],
  trace = [],
  ephemeral = false
}) {
  const steps = buildSteps({ workflowLog, runEvents });
  const tools = buildTools(toolCalls);
  const modelCalls = buildModelCalls(openRouterCalls);
  const failures = buildFailures(trace);
  const models = [...new Set(modelCalls.filter((call) => call.status === "done").map((call) => call.model).filter(Boolean))];
  const bounded = {
    version: RUN_TRACE_VERSION,
    run_id: safeId(runId, 120),
    route: safeId(classification?.type, 24),
    agent: safeId(agent, 24),
    urgency: safeId(classification?.urgency, 24),
    professional: Boolean(classification?.professional),
    investigation: Boolean(classification?.investigation),
    ephemeral: Boolean(ephemeral),
    duration_ms: roundedMs(finiteOrNull(startedAt) === null ? null : finishedAt - startedAt),
    steps: steps.slice(0, RUN_TRACE_LIMITS.steps),
    tools: tools.slice(0, RUN_TRACE_LIMITS.tools),
    models,
    model_calls: modelCalls.slice(0, RUN_TRACE_LIMITS.modelCalls),
    totals: totalsFrom(workflowLog?.openRouterUsage),
    failures: failures.slice(0, RUN_TRACE_LIMITS.failures),
    truncated: steps.length > RUN_TRACE_LIMITS.steps
      || tools.length > RUN_TRACE_LIMITS.tools
      || modelCalls.length > RUN_TRACE_LIMITS.modelCalls
      || failures.length > RUN_TRACE_LIMITS.failures
  };
  return fitToBudget(bounded);
}

// Copy of a JSON-like value with every string passed through redactLogText
// (API keys, tokens, JWTs, emails, phone numbers), so a secret typed into a
// question or echoed in a provider error never reaches the logs.
function redactDeep(value, depth = 0) {
  if (typeof value === "string") return redactLogText(value);
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDeep(item, depth + 1)]));
}

/**
 * Write the full detail of one run to the logs as a single JSON line: every run
 * event and every OpenRouter call, plus the compact trace, with secrets, emails
 * and phone numbers redacted. Run events can still carry short previews of the
 * question and of model output; that is the detail the logs exist for. Nothing
 * here goes to a database. Node inputs and outputs of the workflow log (which
 * carry document previews) are not logged. Never throws.
 */
export function logFullRunTrace({ runId, sessionId = null, compact, runEvents = [], openRouterCalls = [], log = console.info } = {}) {
  try {
    const entry = {
      type: "chat_run_trace",
      run_id: runId,
      session_id: sessionId,
      compact,
      run_events: (Array.isArray(runEvents) ? runEvents : []).map((event) => ({
        time: event?.time,
        step: event?.step,
        message: safeText(event?.message, 300),
        data: redactDeep(event?.data)
      })),
      openrouter_calls: redactDeep(openRouterCalls)
    };
    let line = JSON.stringify(entry);
    if (line.length > FULL_LOG_MAX_CHARS) {
      line = JSON.stringify({ ...entry, run_events: entry.run_events.slice(-80), truncated: true });
      if (line.length > FULL_LOG_MAX_CHARS) line = JSON.stringify({ type: entry.type, run_id: runId, compact, truncated: true });
    }
    log(`[run-trace] ${line}`);
  } catch (error) {
    console.warn("[run-trace] could not write the full run trace:", error?.message);
  }
}
