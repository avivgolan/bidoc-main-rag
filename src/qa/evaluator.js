import { chatCompletion, extractJsonObject, summarizeOpenRouterUsage } from "../openrouter.js";
import {
  DEFAULT_EVALUATION_PROFILE,
  QA_DEFAULT_PROFILE,
  QA_EVALUATOR_VERSION,
  safeErrorMessage,
  validateExpectedBehavior
} from "./contracts.js";
import { taxonomyFor } from "./failureTaxonomy.js";

const SEVERITY_RANK = Object.freeze({ INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 });

export async function evaluateCaseRun({
  caseRun,
  expectedBehavior = {},
  isCritical = false,
  profile = DEFAULT_EVALUATION_PROFILE,
  config = {},
  semanticJudge = defaultSemanticJudge
}) {
  const expected = validateExpectedBehavior(expectedBehavior);
  const findings = deterministicAndPipelineChecks({ caseRun, expected, isCritical });
  let semantic = { status: "skipped", scores: {}, analysis: null, evidence: [], failure_codes: [] };
  try {
    semantic = await semanticJudge({ caseRun, expected, findings, config });
  } catch (error) {
    semantic = {
      status: "error",
      scores: {},
      analysis: safeErrorMessage(error),
      evidence: [],
      failure_codes: ["EVALUATOR_FAILURE"]
    };
  }

  const failureCodes = unique([
    ...findings.failure_codes,
    ...(semantic.failure_codes || [])
  ]);
  const scores = mergeScores(findings.scores, semantic.scores || {});
  const hardFail = Boolean(findings.hard_fail || semantic.hard_fail);
  const overallScore = hardFail ? Math.min(59.99, weightedScore(scores, profile.weights)) : weightedScore(scores, profile.weights);
  const status = hardFail || overallScore < profile.partialThreshold
    ? "fail"
    : overallScore < profile.passThreshold
      ? "partial"
      : "pass";
  const severity = maxSeverity([
    findings.severity,
    semantic.severity || "INFO",
    hardFail ? "CRITICAL" : "INFO"
  ]);
  const rootCause = selectRootCause(failureCodes, findings.evidence);
  const recommendations = unique(failureCodes.map((code) => taxonomyFor(code).recommendation));

  return {
    evaluator_version: QA_EVALUATOR_VERSION,
    evaluator_model: semantic.model || null,
    evaluation_profile: profile.id || QA_DEFAULT_PROFILE,
    status,
    overall_score: Number(overallScore.toFixed(2)),
    scores,
    passed: status === "pass",
    hard_fail: hardFail,
    hard_fail_reason: findings.hard_fail_reason || semantic.hard_fail_reason || null,
    failure_codes: failureCodes,
    severity,
    root_cause_domain: rootCause.domain,
    root_cause_confidence: rootCause.confidence,
    analysis: {
      deterministic: findings.analysis,
      semantic_judge: {
        status: semantic.status,
        analysis: semantic.analysis || null,
        usage: semantic.usage || null
      },
      action_class: rootCause.actionClass
    },
    evidence: [...findings.evidence, ...(semantic.evidence || [])],
    recommendations
  };
}

export function deterministicAndPipelineChecks({ caseRun, expected, isCritical }) {
  const failureCodes = [];
  const evidence = [];
  const answer = String(caseRun?.answer || "").trim();
  const tools = Array.isArray(caseRun?.tools) ? caseRun.tools : [];
  const sources = Array.isArray(caseRun?.sources) ? caseRun.sources : [];
  const errors = Array.isArray(caseRun?.errors) ? caseRun.errors : [];
  const route = String(caseRun?.classification?.type || "").toUpperCase();
  const toolNames = new Set(tools.map((tool) => String(tool?.name || tool?.toolName || "")));
  const sourceTypes = new Set(sources.map((source) => String(source?.type || "")));
  const sourceIds = new Set(sources.map((source) => String(source?.id || "")));
  const traceMissing = caseRun?.context_trace?.completeness?.missing_stages || [];
  let hardFail = false;
  let hardFailReason = null;
  let severity = "INFO";

  if (!answer) {
    failureCodes.push("INCOMPLETE_ANSWER");
    evidence.push(finding("answer", "Answer is empty", "HIGH"));
    severity = "HIGH";
  }
  if (expected.expected_route && route !== expected.expected_route) {
    failureCodes.push("CLASSIFICATION_ERROR");
    evidence.push(finding("classification", `Expected ${expected.expected_route}, received ${route || "unknown"}`, "HIGH"));
    severity = "HIGH";
  }

  const missingTools = expected.required_tools.filter((tool) => !toolNames.has(tool));
  const usedForbiddenTools = expected.forbidden_tools.filter((tool) => toolNames.has(tool));
  if (missingTools.length || usedForbiddenTools.length) {
    failureCodes.push("WRONG_TOOL_SELECTION");
    evidence.push(finding("tools", "Required/forbidden tool policy failed", "HIGH", { missing_tools: missingTools, forbidden_tools_used: usedForbiddenTools }));
    severity = "HIGH";
  }
  const failedTools = tools.filter((tool) => tool?.status === "error" && !tool?.side_effect_denied);
  if (failedTools.length) {
    failureCodes.push("TOOL_FAILURE");
    evidence.push(finding("tools", `${failedTools.length} selected tool(s) failed`, "MEDIUM", { tools: failedTools.map((tool) => tool.name) }));
    severity = maxSeverity([severity, "MEDIUM"]);
  }
  const sideEffectsDenied = errors.filter((item) => item?.code === "SIDE_EFFECT_DENIED");
  if (sideEffectsDenied.length) {
    failureCodes.push("SIDE_EFFECT_DENIED");
    evidence.push(finding("tools", "A side-effecting or unapproved external tool was denied in QA", "INFO"));
  }

  const requiresSources = expected.must_have_sources || expected.required_source_types.length || expected.required_source_ids.length;
  const missingSourceTypes = expected.required_source_types.filter((type) => !sourceTypes.has(type));
  const missingSourceIds = expected.required_source_ids.filter((id) => !sourceIds.has(id));
  if ((requiresSources && !sources.length) || missingSourceTypes.length || missingSourceIds.length) {
    failureCodes.push("RETRIEVAL_MISS");
    evidence.push(finding("retrieval", "Required source evidence did not reach the answer", "HIGH", {
      source_count: sources.length,
      missing_source_types: missingSourceTypes,
      missing_source_ids: missingSourceIds
    }));
    severity = "HIGH";
  }

  const expectedFactMatches = expected.expected_facts.map((fact) => ({ fact, present: includesNormalized(answer, fact) }));
  const missingFacts = expectedFactMatches.filter((item) => !item.present).map((item) => item.fact);
  if (missingFacts.length) {
    failureCodes.push("INCOMPLETE_ANSWER");
    evidence.push(finding("answer", "Expected facts are missing", "MEDIUM", { missing_facts: missingFacts }));
    severity = maxSeverity([severity, "MEDIUM"]);
  }
  const forbiddenClaims = expected.forbidden_claims.filter((claim) => includesNormalized(answer, claim));
  if (forbiddenClaims.length) {
    failureCodes.push("PROMPT_BEHAVIOR");
    evidence.push(finding("answer", "Forbidden claims appear in the answer", "HIGH", { forbidden_claims: forbiddenClaims }));
    severity = "HIGH";
  }
  if (expected.max_latency_ms && Number(caseRun?.latency_ms || 0) > expected.max_latency_ms) {
    failureCodes.push("TIMEOUT");
    evidence.push(finding("latency", `Latency exceeded ${expected.max_latency_ms}ms`, "MEDIUM", { latency_ms: caseRun.latency_ms }));
    severity = maxSeverity([severity, "MEDIUM"]);
  }
  if (traceMissing.length || errors.some((item) => item?.code === "TRACE_INCOMPLETE")) {
    failureCodes.push("TRACE_INCOMPLETE");
    evidence.push(finding("trace", "Diagnostic trace is incomplete", "MEDIUM", { missing_stages: traceMissing }));
    severity = maxSeverity([severity, "MEDIUM"]);
  }
  for (const operational of ["TIMEOUT", "BUDGET_EXCEEDED", "AUTHORIZATION_DENIED"]) {
    if (errors.some((item) => item?.code === operational)) failureCodes.push(operational);
  }

  if (isCritical && (forbiddenClaims.length || !answer || missingSourceIds.length)) {
    hardFail = true;
    hardFailReason = forbiddenClaims.length
      ? "CRITICAL_FORBIDDEN_CLAIM"
      : !answer
        ? "CRITICAL_EMPTY_ANSWER"
        : "CRITICAL_REQUIRED_SOURCE_MISSING";
    severity = "CRITICAL";
  }

  const factCoverage = expected.expected_facts.length
    ? (expected.expected_facts.length - missingFacts.length) / expected.expected_facts.length
    : answer ? 1 : 0;
  const toolPolicyPass = missingTools.length === 0 && usedForbiddenTools.length === 0;
  const sourcePolicyPass = !requiresSources || (sources.length > 0 && missingSourceTypes.length === 0 && missingSourceIds.length === 0);
  const retrievalStage = caseRun?.context_trace?.stages?.find((stage) => stage?.step === "hybrid_retrieval");
  const rerankStage = caseRun?.context_trace?.stages?.find((stage) => stage?.step === "reranking");
  if (rerankStage?.status === "error") failureCodes.push("RERANK_ERROR");

  return {
    failure_codes: unique(failureCodes),
    evidence,
    hard_fail: hardFail,
    hard_fail_reason: hardFailReason,
    severity,
    scores: {
      correctness: clampScore(answer ? 70 + 30 * factCoverage : 0),
      grounding: clampScore(sourcePolicyPass ? (sources.length ? 100 : route === "CHAT" ? 100 : 70) : 20),
      completeness: clampScore(100 * factCoverage),
      retrieval: clampScore(retrievalStage?.status === "error" || !sourcePolicyPass ? 25 : traceMissing.includes("hybrid_retrieval") ? 50 : 100),
      tool_selection: clampScore(toolPolicyPass ? (failedTools.length ? 60 : 100) : 20),
      source_quality: clampScore(sourcePolicyPass ? (sources.length ? 100 : 80) : 20),
      instruction_following: clampScore(forbiddenClaims.length ? 0 : 100),
      stability: 100
    },
    analysis: {
      route,
      answer_present: Boolean(answer),
      source_count: sources.length,
      selected_tools: [...toolNames],
      fact_coverage: Number(factCoverage.toFixed(4)),
      trace_complete: traceMissing.length === 0
    }
  };
}

export async function defaultSemanticJudge({ caseRun, expected, findings, config }) {
  if (!config?.openRouterApiKey) {
    return {
      status: "unavailable",
      scores: {},
      analysis: "Semantic evaluator unavailable because the QA model API key is not configured.",
      evidence: [],
      failure_codes: ["EVALUATOR_FAILURE"]
    };
  }
  const model = config.models?.qa || config.models?.main;
  const calls = [];
  const response = await chatCompletion({
    apiKey: config.openRouterApiKey,
    model,
    temperature: 0,
    maxTokens: 1800,
    timeoutMs: config.ai?.qa?.timeoutMs || 90_000,
    responseFormat: { type: "json_object" },
    telemetry: {
      step: "qa_evaluator",
      callId: `qa_evaluator_${caseRun.id || "case"}`,
      record: (entry) => calls.push(entry)
    },
    messages: [
      {
        role: "system",
        content: "You are a constrained QA judge. Deterministic and pipeline findings are authoritative. Return JSON only with scores (correctness, grounding, completeness, source_quality, instruction_following: 0-100), analysis, failure_codes, severity, and evidence. Do not invent missing trace or sources."
      },
      {
        role: "user",
        content: JSON.stringify({
          question: caseRun.question,
          answer: String(caseRun.answer || "").slice(0, 12000),
          expected_behavior: expected,
          sources: caseRun.sources,
          deterministic_findings: findings
        })
      }
    ]
  });
  const parsed = extractJsonObject(response);
  return {
    status: "completed",
    model,
    scores: sanitizeSemanticScores(parsed.scores),
    analysis: String(parsed.analysis || "").slice(0, 5000),
    failure_codes: Array.isArray(parsed.failure_codes) ? parsed.failure_codes.map(String).slice(0, 20) : [],
    severity: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(parsed.severity) ? parsed.severity : "INFO",
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 20) : [],
    usage: summarizeOpenRouterUsage(calls)
  };
}

function sanitizeSemanticScores(scores = {}) {
  const allowed = ["correctness", "grounding", "completeness", "source_quality", "instruction_following"];
  return Object.fromEntries(allowed
    .filter((key) => Number.isFinite(Number(scores?.[key])))
    .map((key) => [key, clampScore(scores[key])]));
}

function mergeScores(deterministic, semantic) {
  const out = { ...deterministic };
  for (const [key, value] of Object.entries(semantic)) {
    if (!Number.isFinite(Number(value)) || !Object.hasOwn(out, key)) continue;
    out[key] = clampScore((Number(out[key]) * 0.6) + (Number(value) * 0.4));
  }
  return Object.fromEntries(Object.entries(out).map(([key, value]) => [key, Number(Number(value).toFixed(2))]));
}

function weightedScore(scores, weights) {
  return Object.entries(weights).reduce((sum, [key, weight]) => sum + Number(scores[key] || 0) * Number(weight || 0), 0);
}

function selectRootCause(failureCodes, evidence) {
  if (!failureCodes.length) return { domain: null, confidence: null, actionClass: null };
  const code = failureCodes.find((item) => !["TRACE_INCOMPLETE", "EVALUATOR_FAILURE"].includes(item)) || failureCodes[0];
  const taxonomy = taxonomyFor(code);
  const matchingEvidence = evidence.length ? 1 : 0;
  const confidence = Number(Math.min(0.95, 0.55 + Math.min(0.3, matchingEvidence * 0.1) + (failureCodes.length === 1 ? 0.1 : 0)).toFixed(4));
  return { domain: taxonomy.rootCauseDomain, confidence, actionClass: taxonomy.actionClass };
}

function finding(stage, message, severity, details = null) {
  return { stage, message, severity, ...(details ? { details } : {}) };
}

function includesNormalized(haystack, needle) {
  const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
  return normalize(haystack).includes(normalize(needle));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function maxSeverity(values) {
  return values.reduce((current, candidate) => SEVERITY_RANK[candidate] > SEVERITY_RANK[current] ? candidate : current, "INFO");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
