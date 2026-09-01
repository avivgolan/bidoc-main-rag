import { createHash } from "node:crypto";
import { heuristicClassification } from "../heuristics.js";
import { sanitizeMessage } from "../sanitize.js";
import { isPreviousConversationRecallQuery } from "../chatMemory.js";
import { classifyDataQueryCapability } from "../subagents/dataQuery.js";

export const CHAT_QUALITY_SCHEMA_VERSION = "chat-quality.v1";

const PIPELINE_ROUTES = new Set(["CHAT", "RAG"]);
const ROUTE_FAMILIES = new Set([
  "chat_lite",
  "semantic_rag",
  "exact_data_query",
  "mixed_exact_semantic",
  "memory_recall"
]);
const LANGUAGES = new Set(["en", "he"]);
const FINISH_REASONS = new Set(["stop", "length", "error", "not_applicable"]);
const COMPLETION_OUTCOMES = new Set(["complete", "guarded", "retry", "safe_fallback"]);
const WORKFLOW_OUTCOMES = new Set(["done", "warning", "guarded", "fallback", "error"]);
const KNOWN_STAGES = new Set([
  "sanitize",
  "memory_load",
  "classify",
  "hybrid_search",
  "graph_search",
  "reranker",
  "data_query",
  "meeting_evidence",
  "conflict_detection",
  "main_agent",
  "lite_agent",
  "safe_boundary"
]);

export function validateChatQualitySuite(input) {
  assertPlainObject(input, "suite");
  assertExactKeys(input, ["schemaVersion", "suite", "cases"], "suite");
  if (input.schemaVersion !== CHAT_QUALITY_SCHEMA_VERSION) {
    throw new Error(`schemaVersion must be ${CHAT_QUALITY_SCHEMA_VERSION}`);
  }
  assertPlainObject(input.suite, "suite metadata");
  assertExactKeys(input.suite, ["id", "name", "description", "fixtureKind"], "suite metadata");
  requiredString(input.suite.id, "suite.id", 120);
  requiredString(input.suite.name, "suite.name", 200);
  requiredString(input.suite.description, "suite.description", 2000);
  if (input.suite.fixtureKind !== "sanitized_reference") {
    throw new Error("suite.fixtureKind must be sanitized_reference");
  }
  if (!Array.isArray(input.cases) || input.cases.length !== 12) {
    throw new Error("cases must contain exactly 12 smoke cases");
  }
  const ids = new Set();
  const cases = input.cases.map((item, index) => validateCase(item, index));
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error(`duplicate case id: ${item.id}`);
    ids.add(item.id);
  }
  return {
    schemaVersion: input.schemaVersion,
    suite: { ...input.suite },
    cases
  };
}

export function probeChatQualityRoute(testCase) {
  const question = requiredString(testCase?.question, "case.question", 8000);
  const classification = heuristicClassification(question);
  const previousConversationRecall = isPreviousConversationRecallQuery(question);
  const capability = classifyDataQueryCapability(question, {
    lookupAvailable: testCase?.probe?.lookupAvailable === true
  });
  const pipelineRoute = String(classification?.type || "").toUpperCase();
  const routeFamily = routeFamilyFor({ pipelineRoute, capability, previousConversationRecall });
  const sanitizedQuestion = sanitizeMessage(question);
  return {
    pipelineRoute,
    routeFamily,
    capability: {
      supported: capability?.supported === true,
      status: capability?.status || null,
      domain: capability?.domain || null,
      intent: capability?.intent || null,
      mixed: capability?.mixed === true,
      suggestedAgent: capability?.suggestedAgent || null,
      warning: capability?.warning || null,
      targetTable: capability?.lookup?.targetTable || capability?.metricScope?.targetTable || null
    },
    previousConversationRecall,
    sanitizedQuestion,
    injectionRedacted: sanitizedQuestion !== question
  };
}

export function evaluateChatQualitySuite(input, {
  generatedAt = new Date().toISOString(),
  commit = "unknown",
  fixtureHash = null
} = {}) {
  const suite = validateChatQualitySuite(input);
  const results = suite.cases.map((testCase) => evaluateCase(testCase));
  const summary = summarizeResults(results);
  return {
    schemaVersion: CHAT_QUALITY_SCHEMA_VERSION,
    suite: suite.suite,
    generatedAt,
    commit,
    fixtureHash: fixtureHash || hashFixture(suite),
    scope: {
      mode: "local_dry_run",
      fingerprint: "chat-quality.v1:local-dry-run:pure-route-probes:synthetic-reference",
      networkCalls: 0,
      databaseReads: 0,
      databaseWrites: 0,
      runtimeBehaviorChanged: false,
      observationNote: "Answers and execution metrics are synthetic sanitized reference fixtures. Route probes execute current pure routing helpers."
    },
    summary,
    results
  };
}

export function renderChatQualityMarkdown(report) {
  const lines = [
    "# BiDoc Chat Quality Baseline",
    "",
    `Generated: ${report.generatedAt}`,
    `Commit: \`${report.commit}\``,
    `Fixture hash: \`${report.fixtureHash}\``,
    `Schema: \`${report.schemaVersion}\``,
    `Execution profile: \`${report.scope.fingerprint}\``,
    "",
    "## Scope",
    "",
    "This is a local, hermetic dry run. It performs no network calls, database reads, database writes, model calls, or production changes. Route assertions use current pure routing helpers. Answers and execution metrics come from synthetic sanitized reference fixtures, so this report is an evaluation-harness baseline, not production quality certification.",
    "",
    "## Summary",
    "",
    `- Cases: ${report.summary.passedCases}/${report.summary.totalCases} passed`,
    `- Assertions: ${report.summary.passedAssertions}/${report.summary.totalAssertions} passed`,
    `- Code-backed route accuracy: ${formatPercent(report.summary.metrics.routeAccuracy)}`,
    `- Code-backed exact-route accuracy: ${formatPercent(report.summary.metrics.exactRouteAccuracy)}`,
    `- Reference workflow-policy accuracy: ${formatPercent(report.summary.metrics.stagePolicyAccuracy)}`,
    `- Reference evidence-contract accuracy: ${formatPercent(report.summary.metrics.evidenceContractAccuracy)}`,
    `- Reference answer-contract accuracy: ${formatPercent(report.summary.metrics.answerContractAccuracy)}`,
    `- Reference completion-contract accuracy: ${formatPercent(report.summary.metrics.completionIntegrity)}`,
    `- Memory policy accuracy: ${formatPercent(report.summary.metrics.memoryPolicyAccuracy)}`,
    `- Security policy accuracy: ${formatPercent(report.summary.metrics.securityPolicyAccuracy)}`,
    `- Runtime metric coverage: ${report.summary.runtimeMetrics.measuredCases}/${report.summary.totalCases} cases`,
    "",
    "The reference-contract percentages measure fixture and evaluator consistency. They are not live response-quality scores.",
    "",
    "## Case Results",
    "",
    "| Case | Language | Category | Expected family | Probed family | Result | Failed assertions |",
    "|---|---|---|---|---|---|---|"
  ];
  for (const result of report.results) {
    lines.push(`| \`${escapeTable(result.id)}\` | ${result.language} | ${escapeTable(result.category)} | \`${result.expectedRouteFamily}\` | \`${result.probe.routeFamily}\` | ${result.passed ? "PASS" : "FAIL"} | ${escapeTable(result.failedAssertions.join(", ") || "None")} |`);
  }
  lines.push(
    "",
    "## Runtime Metrics",
    "",
    report.summary.runtimeMetrics.measuredCases
      ? `Measured fixtures: ${report.summary.runtimeMetrics.measuredCases}. p95 latency: ${formatMetric(report.summary.runtimeMetrics.p95LatencyMs, "ms")}. p95 prompt tokens: ${formatMetric(report.summary.runtimeMetrics.p95PromptTokens, "tokens")}. Total recorded cost: ${formatCost(report.summary.runtimeMetrics.totalCostUsd)}.`
      : "Latency, token usage, and cost are intentionally marked unmeasured in this hermetic fixture set. Live read-only evaluation is deferred and requires separate approval.",
    "",
    "## Gate",
    "",
    report.summary.failedCases === 0
      ? "Phase 0 smoke-harness gate passes. This does not approve runtime, prompt, model, routing, Supabase, or deployment changes."
      : `Phase 0 smoke-harness gate fails with ${report.summary.failedCases} failing case(s).`,
    ""
  );
  return lines.join("\n");
}

export function hashFixture(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateCase(input, index) {
  const path = `cases[${index}]`;
  assertPlainObject(input, path);
  assertExactKeys(input, ["id", "title", "language", "category", "question", "critical", "probe", "expected", "observed"], path);
  const id = requiredString(input.id, `${path}.id`, 160);
  const title = requiredString(input.title, `${path}.title`, 240);
  const language = enumValue(input.language, LANGUAGES, `${path}.language`);
  const category = requiredString(input.category, `${path}.category`, 120);
  const question = requiredString(input.question, `${path}.question`, 8000);
  assertPlainObject(input.probe, `${path}.probe`);
  assertExactKeys(input.probe, ["lookupAvailable", "expectedCapability"], `${path}.probe`);
  assertPlainObject(input.probe.expectedCapability, `${path}.probe.expectedCapability`);
  assertExactKeys(input.probe.expectedCapability, ["supported", "domain", "suggestedAgent", "warning"], `${path}.probe.expectedCapability`);
  const expected = validateExpected(input.expected, path);
  const observed = validateObserved(input.observed, path);
  return {
    id,
    title,
    language,
    category,
    question,
    critical: input.critical === true,
    probe: {
      lookupAvailable: input.probe.lookupAvailable === true,
      expectedCapability: {
        supported: input.probe.expectedCapability.supported === true,
        domain: nullableString(input.probe.expectedCapability.domain, `${path}.probe.expectedCapability.domain`, 120),
        suggestedAgent: nullableString(input.probe.expectedCapability.suggestedAgent, `${path}.probe.expectedCapability.suggestedAgent`, 120),
        warning: nullableString(input.probe.expectedCapability.warning, `${path}.probe.expectedCapability.warning`, 160)
      }
    },
    expected,
    observed
  };
}

function validateExpected(input, path) {
  assertPlainObject(input, `${path}.expected`);
  assertExactKeys(input, ["pipelineRoute", "routeFamily", "requiredStages", "forbiddenStages", "evidence", "answer", "completion", "memory", "security", "workflowOutcome"], `${path}.expected`);
  const requiredStages = stageList(input.requiredStages, `${path}.expected.requiredStages`);
  const forbiddenStages = stageList(input.forbiddenStages, `${path}.expected.forbiddenStages`);
  const overlap = requiredStages.filter((stage) => forbiddenStages.includes(stage));
  if (overlap.length) throw new Error(`${path}.expected stage overlap: ${overlap.join(", ")}`);
  assertPlainObject(input.evidence, `${path}.expected.evidence`);
  assertExactKeys(input.evidence, ["minSources", "maxSources", "requiredSourceIds"], `${path}.expected.evidence`);
  assertPlainObject(input.answer, `${path}.expected.answer`);
  assertExactKeys(input.answer, ["requiredTerms", "forbiddenTerms"], `${path}.expected.answer`);
  assertPlainObject(input.completion, `${path}.expected.completion`);
  assertExactKeys(input.completion, ["allowedFinishReasons", "fallbackAllowed", "outcome"], `${path}.expected.completion`);
  assertPlainObject(input.memory, `${path}.expected.memory`);
  assertExactKeys(input.memory, ["previousConversationRecall", "projectEvidenceAllowed"], `${path}.expected.memory`);
  assertPlainObject(input.security, `${path}.expected.security`);
  assertExactKeys(input.security, ["injectionMustBeRedacted", "forbiddenSanitizedTerms"], `${path}.expected.security`);
  const requiredTerms = stringList(input.answer.requiredTerms, `${path}.expected.answer.requiredTerms`, 1000);
  const forbiddenTerms = stringList(input.answer.forbiddenTerms, `${path}.expected.answer.forbiddenTerms`, 1000);
  const requiredSourceIds = stringList(input.evidence.requiredSourceIds, `${path}.expected.evidence.requiredSourceIds`, 300);
  const forbiddenSanitizedTerms = stringList(input.security.forbiddenSanitizedTerms, `${path}.expected.security.forbiddenSanitizedTerms`, 1000);
  const assertionCount = requiredStages.length + forbiddenStages.length + requiredTerms.length + forbiddenTerms.length + requiredSourceIds.length + forbiddenSanitizedTerms.length;
  if (!assertionCount) throw new Error(`${path}.expected must define at least one content or workflow assertion`);
  const minSources = integer(input.evidence.minSources, `${path}.expected.evidence.minSources`, 0, 100);
  const maxSources = integer(input.evidence.maxSources, `${path}.expected.evidence.maxSources`, minSources, 100);
  return {
    pipelineRoute: enumValue(input.pipelineRoute, PIPELINE_ROUTES, `${path}.expected.pipelineRoute`),
    routeFamily: enumValue(input.routeFamily, ROUTE_FAMILIES, `${path}.expected.routeFamily`),
    requiredStages,
    forbiddenStages,
    evidence: { minSources, maxSources, requiredSourceIds },
    answer: { requiredTerms, forbiddenTerms },
    completion: {
      allowedFinishReasons: enumList(input.completion.allowedFinishReasons, FINISH_REASONS, `${path}.expected.completion.allowedFinishReasons`),
      fallbackAllowed: input.completion.fallbackAllowed === true,
      outcome: enumValue(input.completion.outcome, COMPLETION_OUTCOMES, `${path}.expected.completion.outcome`)
    },
    memory: {
      previousConversationRecall: input.memory.previousConversationRecall === true,
      projectEvidenceAllowed: input.memory.projectEvidenceAllowed === true
    },
    security: {
      injectionMustBeRedacted: input.security.injectionMustBeRedacted === true,
      forbiddenSanitizedTerms
    },
    workflowOutcome: enumValue(input.workflowOutcome, WORKFLOW_OUTCOMES, `${path}.expected.workflowOutcome`)
  };
}

function validateObserved(input, path) {
  assertPlainObject(input, `${path}.observed`);
  assertExactKeys(input, ["pipelineRoute", "routeFamily", "stages", "sources", "answer", "completion", "memory", "security", "workflowOutcome", "metrics"], `${path}.observed`);
  assertPlainObject(input.completion, `${path}.observed.completion`);
  assertExactKeys(input.completion, ["finishReason", "nativeFinishReason", "fallback", "outcome"], `${path}.observed.completion`);
  assertPlainObject(input.memory, `${path}.observed.memory`);
  assertExactKeys(input.memory, ["previousConversationRecall", "projectEvidenceUsed"], `${path}.observed.memory`);
  assertPlainObject(input.security, `${path}.observed.security`);
  assertExactKeys(input.security, ["sanitizedQuestion", "injectionRedacted"], `${path}.observed.security`);
  assertPlainObject(input.metrics, `${path}.observed.metrics`);
  assertExactKeys(input.metrics, ["latencyMs", "promptTokens", "completionTokens", "costUsd"], `${path}.observed.metrics`);
  if (!Array.isArray(input.sources)) throw new Error(`${path}.observed.sources must be an array`);
  const sources = input.sources.map((source, sourceIndex) => {
    assertPlainObject(source, `${path}.observed.sources[${sourceIndex}]`);
    assertExactKeys(source, ["id", "type"], `${path}.observed.sources[${sourceIndex}]`);
    return {
      id: requiredString(source.id, `${path}.observed.sources[${sourceIndex}].id`, 300),
      type: requiredString(source.type, `${path}.observed.sources[${sourceIndex}].type`, 120)
    };
  });
  return {
    pipelineRoute: enumValue(input.pipelineRoute, PIPELINE_ROUTES, `${path}.observed.pipelineRoute`),
    routeFamily: enumValue(input.routeFamily, ROUTE_FAMILIES, `${path}.observed.routeFamily`),
    stages: stageList(input.stages, `${path}.observed.stages`),
    sources,
    answer: requiredString(input.answer, `${path}.observed.answer`, 20_000),
    completion: {
      finishReason: enumValue(input.completion.finishReason, FINISH_REASONS, `${path}.observed.completion.finishReason`),
      nativeFinishReason: nullableString(input.completion.nativeFinishReason, `${path}.observed.completion.nativeFinishReason`, 120),
      fallback: input.completion.fallback === true,
      outcome: enumValue(input.completion.outcome, COMPLETION_OUTCOMES, `${path}.observed.completion.outcome`)
    },
    memory: {
      previousConversationRecall: input.memory.previousConversationRecall === true,
      projectEvidenceUsed: input.memory.projectEvidenceUsed === true
    },
    security: {
      sanitizedQuestion: requiredString(input.security.sanitizedQuestion, `${path}.observed.security.sanitizedQuestion`, 8000),
      injectionRedacted: input.security.injectionRedacted === true
    },
    workflowOutcome: enumValue(input.workflowOutcome, WORKFLOW_OUTCOMES, `${path}.observed.workflowOutcome`),
    metrics: {
      latencyMs: nullableNumber(input.metrics.latencyMs, `${path}.observed.metrics.latencyMs`, 0),
      promptTokens: nullableNumber(input.metrics.promptTokens, `${path}.observed.metrics.promptTokens`, 0),
      completionTokens: nullableNumber(input.metrics.completionTokens, `${path}.observed.metrics.completionTokens`, 0),
      costUsd: nullableNumber(input.metrics.costUsd, `${path}.observed.metrics.costUsd`, 0)
    }
  };
}

function evaluateCase(testCase) {
  const probe = probeChatQualityRoute(testCase);
  const assertions = [];
  const add = (group, name, passed, details = null) => assertions.push({ group, name, passed: Boolean(passed), details });
  const expectedCapability = testCase.probe.expectedCapability;
  add("route", "probe_pipeline_route", probe.pipelineRoute === testCase.expected.pipelineRoute, { expected: testCase.expected.pipelineRoute, actual: probe.pipelineRoute });
  add("route", "probe_route_family", probe.routeFamily === testCase.expected.routeFamily, { expected: testCase.expected.routeFamily, actual: probe.routeFamily });
  add("route", "probe_capability_supported", probe.capability.supported === expectedCapability.supported, { expected: expectedCapability.supported, actual: probe.capability.supported });
  add("route", "probe_capability_domain", probe.capability.domain === expectedCapability.domain, { expected: expectedCapability.domain, actual: probe.capability.domain });
  add("route", "probe_suggested_agent", probe.capability.suggestedAgent === expectedCapability.suggestedAgent, { expected: expectedCapability.suggestedAgent, actual: probe.capability.suggestedAgent });
  add("route", "probe_warning", probe.capability.warning === expectedCapability.warning, { expected: expectedCapability.warning, actual: probe.capability.warning });
  add("route", "fixture_pipeline_route", testCase.observed.pipelineRoute === testCase.expected.pipelineRoute);
  add("route", "fixture_route_family", testCase.observed.routeFamily === testCase.expected.routeFamily);

  const stages = new Set(testCase.observed.stages);
  for (const stage of testCase.expected.requiredStages) add("stage", `required_stage:${stage}`, stages.has(stage));
  for (const stage of testCase.expected.forbiddenStages) add("stage", `forbidden_stage:${stage}`, !stages.has(stage));

  const sourceIds = new Set(testCase.observed.sources.map((source) => source.id));
  add("evidence", "minimum_sources", testCase.observed.sources.length >= testCase.expected.evidence.minSources);
  add("evidence", "maximum_sources", testCase.observed.sources.length <= testCase.expected.evidence.maxSources);
  for (const id of testCase.expected.evidence.requiredSourceIds) add("evidence", `required_source:${id}`, sourceIds.has(id));

  for (const term of testCase.expected.answer.requiredTerms) add("answer", `required_term:${term}`, includesNormalized(testCase.observed.answer, term));
  for (const term of testCase.expected.answer.forbiddenTerms) add("answer", `forbidden_term:${term}`, !includesNormalized(testCase.observed.answer, term));

  add("completion", "finish_reason", testCase.expected.completion.allowedFinishReasons.includes(testCase.observed.completion.finishReason));
  add("completion", "fallback_policy", testCase.expected.completion.fallbackAllowed || !testCase.observed.completion.fallback);
  add("completion", "completion_outcome", testCase.observed.completion.outcome === testCase.expected.completion.outcome);
  add("completion", "workflow_outcome", testCase.observed.workflowOutcome === testCase.expected.workflowOutcome);

  add("memory", "previous_conversation_recall", probe.previousConversationRecall === testCase.expected.memory.previousConversationRecall && testCase.observed.memory.previousConversationRecall === testCase.expected.memory.previousConversationRecall);
  add("memory", "project_evidence_policy", testCase.expected.memory.projectEvidenceAllowed || !testCase.observed.memory.projectEvidenceUsed);

  add("security", "sanitized_question_matches_probe", testCase.observed.security.sanitizedQuestion === probe.sanitizedQuestion);
  add("security", "injection_redaction", !testCase.expected.security.injectionMustBeRedacted || (probe.injectionRedacted && testCase.observed.security.injectionRedacted));
  for (const term of testCase.expected.security.forbiddenSanitizedTerms) {
    add("security", `forbidden_sanitized_term:${term}`, !includesNormalized(testCase.observed.security.sanitizedQuestion, term));
  }

  const failedAssertions = assertions.filter((item) => !item.passed).map((item) => item.name);
  return {
    id: testCase.id,
    title: testCase.title,
    language: testCase.language,
    category: testCase.category,
    critical: testCase.critical,
    expectedRouteFamily: testCase.expected.routeFamily,
    probe,
    observedMetrics: testCase.observed.metrics,
    passed: failedAssertions.length === 0,
    assertions,
    failedAssertions
  };
}

function summarizeResults(results) {
  const allAssertions = results.flatMap((result) => result.assertions);
  const ratioFor = (group, filter = () => true) => {
    const selected = allAssertions.filter((item) => item.group === group && filter(item));
    return selected.length ? selected.filter((item) => item.passed).length / selected.length : 1;
  };
  const exactCases = results.filter((item) => item.expectedRouteFamily === "exact_data_query");
  const exactAssertions = exactCases.flatMap((item) => item.assertions).filter((item) => item.group === "route");
  const measured = results.filter((item) => Object.values(item.observedMetrics).some((value) => value != null));
  const latencyValues = measured.map((item) => item.observedMetrics.latencyMs).filter(Number.isFinite);
  const promptValues = measured.map((item) => item.observedMetrics.promptTokens).filter(Number.isFinite);
  const costValues = measured.map((item) => item.observedMetrics.costUsd).filter(Number.isFinite);
  return {
    totalCases: results.length,
    passedCases: results.filter((item) => item.passed).length,
    failedCases: results.filter((item) => !item.passed).length,
    totalAssertions: allAssertions.length,
    passedAssertions: allAssertions.filter((item) => item.passed).length,
    failedAssertions: allAssertions.filter((item) => !item.passed).length,
    metrics: {
      routeAccuracy: ratioFor("route"),
      exactRouteAccuracy: exactAssertions.length ? exactAssertions.filter((item) => item.passed).length / exactAssertions.length : 1,
      stagePolicyAccuracy: ratioFor("stage"),
      evidenceContractAccuracy: ratioFor("evidence"),
      answerContractAccuracy: ratioFor("answer"),
      completionIntegrity: ratioFor("completion"),
      memoryPolicyAccuracy: ratioFor("memory"),
      securityPolicyAccuracy: ratioFor("security")
    },
    runtimeMetrics: {
      measuredCases: measured.length,
      p95LatencyMs: percentile95(latencyValues),
      p95PromptTokens: percentile95(promptValues),
      totalCostUsd: costValues.length ? Number(costValues.reduce((sum, value) => sum + value, 0).toFixed(6)) : null
    }
  };
}

function routeFamilyFor({ pipelineRoute, capability, previousConversationRecall }) {
  if (previousConversationRecall) return "memory_recall";
  if (pipelineRoute === "CHAT") return "chat_lite";
  if (capability?.supported === true && capability?.domain === "content_mixed_exact_semantic") return "mixed_exact_semantic";
  if (capability?.supported === true && ["content_structured_lookup", "content_metadata_metrics"].includes(capability?.domain)) return "exact_data_query";
  return "semantic_rag";
}

function percentile95(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function includesNormalized(value, fragment) {
  return String(value || "").toLocaleLowerCase().normalize("NFKC").includes(String(fragment || "").toLocaleLowerCase().normalize("NFKC"));
}

function stageList(value, path) {
  return enumList(value, KNOWN_STAGES, path);
}

function enumList(value, allowed, path) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  const normalized = [...new Set(value.map((item) => enumValue(item, allowed, path)))];
  if (!normalized.length) throw new Error(`${path} must contain at least one item`);
  return normalized;
}

function stringList(value, path, maxLength) {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return [...new Set(value.map((item, index) => requiredString(item, `${path}[${index}]`, maxLength)))];
}

function enumValue(value, allowed, path) {
  const normalized = requiredString(value, path, 160);
  if (!allowed.has(normalized)) throw new Error(`${path} has unknown value: ${normalized}`);
  return normalized;
}

function requiredString(value, path, maxLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${path} is required`);
  if (normalized.length > maxLength) throw new Error(`${path} exceeds ${maxLength} characters`);
  return normalized;
}

function nullableString(value, path, maxLength) {
  if (value == null) return null;
  return requiredString(value, path, maxLength);
}

function integer(value, path, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${path} must be an integer from ${min} to ${max}`);
  return value;
}

function nullableNumber(value, path, min) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < min) throw new Error(`${path} must be null or a number >= ${min}`);
  return value;
}

function assertPlainObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object`);
}

function assertExactKeys(value, allowed, path) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length) throw new Error(`${path} has unknown field(s): ${unknown.join(", ")}`);
  const missing = allowed.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (missing.length) throw new Error(`${path} is missing field(s): ${missing.join(", ")}`);
}

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatMetric(value, unit) {
  return value == null ? "not measured" : `${value} ${unit}`;
}

function formatCost(value) {
  return value == null ? "not measured" : `$${value.toFixed(6)}`;
}

function escapeTable(value) {
  return String(value || "").replaceAll("|", "\\|").replaceAll("\n", " ");
}
