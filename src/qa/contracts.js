import crypto from "node:crypto";

export const QA_SCHEMA_VERSION = "1.0";
export const QA_EVALUATOR_VERSION = "phase1-v1";
export const QA_DEFAULT_PROFILE = "default-v1";
export const QA_ROLES = Object.freeze({
  VIEWER: "QA_VIEWER",
  OPERATOR: "QA_OPERATOR",
  TUNING_ENGINEER: "TUNING_ENGINEER",
  TUNING_APPROVER: "TUNING_APPROVER",
  ADMIN: "ADMIN"
});

export const QA_FAILURE_CODES = Object.freeze([
  "CLASSIFICATION_ERROR",
  "RETRIEVAL_MISS",
  "RETRIEVAL_NOISE",
  "RERANK_ERROR",
  "WRONG_TOOL_SELECTION",
  "TOOL_FAILURE",
  "KNOWLEDGE_ROUTING_ERROR",
  "CONTEXT_LOSS",
  "HALLUCINATION",
  "SOURCE_MISMATCH",
  "INCOMPLETE_ANSWER",
  "PROMPT_BEHAVIOR",
  "MODEL_LIMITATION"
]);

export const QA_OPERATIONAL_CODES = Object.freeze([
  "TRACE_INCOMPLETE",
  "EVALUATOR_FAILURE",
  "TIMEOUT",
  "BUDGET_EXCEEDED",
  "AUTHORIZATION_DENIED",
  "SIDE_EFFECT_DENIED"
]);

export const DEFAULT_EVALUATION_PROFILE = Object.freeze({
  id: QA_DEFAULT_PROFILE,
  passThreshold: 80,
  partialThreshold: 60,
  weights: Object.freeze({
    correctness: 0.25,
    grounding: 0.20,
    completeness: 0.15,
    retrieval: 0.10,
    tool_selection: 0.10,
    source_quality: 0.10,
    instruction_following: 0.05,
    stability: 0.05
  })
});

const ORIGINS = new Set(["manual", "generated", "production_failure", "user_dislike", "bug_report", "ground_truth"]);
const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
const ROUTES = new Set(["CHAT", "RAG"]);

export class QaServiceError extends Error {
  constructor(code, message, { status = 400, retryable = false, details = null } = {}) {
    super(message);
    this.name = "QaServiceError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

export function createRequestId() {
  return crypto.randomUUID();
}

export function resultEnvelope(data, { status = "succeeded", warnings = [], requestId = createRequestId() } = {}) {
  return {
    request_id: requestId,
    status,
    data,
    warnings,
    meta: {
      schema_version: QA_SCHEMA_VERSION,
      created_at: new Date().toISOString()
    },
    error: null
  };
}

export function errorEnvelope(error, { requestId = createRequestId() } = {}) {
  const normalized = normalizeQaError(error);
  return {
    request_id: requestId,
    status: "failed",
    data: null,
    warnings: [],
    meta: {
      schema_version: QA_SCHEMA_VERSION,
      created_at: new Date().toISOString()
    },
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
      ...(normalized.details ? { details: normalized.details } : {})
    }
  };
}

export function normalizeQaError(error) {
  if (error instanceof QaServiceError) return error;
  return new QaServiceError("QA_INTERNAL_ERROR", safeErrorMessage(error), {
    status: 500,
    retryable: false
  });
}

export function requireRole(context, requiredRole) {
  const roles = new Set(Array.isArray(context?.roles) ? context.roles : []);
  if (roles.has(requiredRole) || roles.has(QA_ROLES.ADMIN)) return;
  throw new QaServiceError("AUTHORIZATION_DENIED", `Role ${requiredRole} is required`, {
    status: 403,
    details: { required_role: requiredRole }
  });
}

export function assertProjectAccess(context, requestedProjectId, { optional = true } = {}) {
  const projectId = optionalString(requestedProjectId, "project_id", 200);
  if (!projectId) {
    if (optional) return context?.currentProjectId || null;
    throw new QaServiceError("PROJECT_REQUIRED", "project_id is required", { status: 400 });
  }
  const allowed = new Set(Array.isArray(context?.allowedProjectIds) ? context.allowedProjectIds.map(String) : []);
  if (allowed.has("*") || allowed.has(projectId) || context?.currentProjectId === projectId) return projectId;
  throw new QaServiceError("AUTHORIZATION_DENIED", "Project is outside the authenticated actor scope", {
    status: 403,
    details: { project_id: projectId }
  });
}

export function normalizeContext(context = {}) {
  const actorId = requiredString(context.actorId || context.actor_id, "actor_id", 200);
  const organizationId = requiredString(context.organizationId || context.organization_id || "default", "organization_id", 200);
  return {
    actorId,
    organizationId,
    currentProjectId: optionalString(context.currentProjectId || context.current_project_id, "current_project_id", 200),
    allowedProjectIds: uniqueStrings(context.allowedProjectIds || context.allowed_project_ids || [], 200, 500),
    roles: uniqueStrings(context.roles || [], 80, 20),
    environment: optionalString(context.environment || "qa", "environment", 40) || "qa"
  };
}

export function validateCreateSuiteInput(input = {}) {
  return {
    name: requiredString(input.name, "name", 160),
    description: optionalString(input.description, "description", 4000) || "",
    domain: requiredString(input.domain, "domain", 80),
    is_regression: Boolean(input.is_regression ?? input.regression_flag ?? false),
    tags: uniqueStrings(input.tags || [], 80, 50),
    project_id: optionalString(input.project_id || input.projectId, "project_id", 200),
    idempotency_key: validateIdempotencyKey(input.idempotency_key)
  };
}

export function validateAddCasesInput(input = {}) {
  const rawCases = Array.isArray(input.cases) ? input.cases : [];
  if (!rawCases.length) throw new QaServiceError("VALIDATION_ERROR", "cases must contain at least one item");
  if (rawCases.length > 100) throw new QaServiceError("VALIDATION_ERROR", "cases cannot contain more than 100 items");
  return {
    suite_id: requiredId(input.suite_id || input.suiteId, "suite_id"),
    idempotency_key: validateIdempotencyKey(input.idempotency_key),
    cases: rawCases.map((item, index) => {
      try {
        const origin = String(item?.origin || "manual").trim().toLowerCase();
        const priority = String(item?.priority || "medium").trim().toLowerCase();
        if (!ORIGINS.has(origin)) throw new QaServiceError("VALIDATION_ERROR", `origin is invalid`);
        if (!PRIORITIES.has(priority)) throw new QaServiceError("VALIDATION_ERROR", `priority is invalid`);
        return {
          case_key: requiredString(item?.case_key || item?.caseKey, "case_key", 160),
          question: requiredString(item?.question, "question", 8000),
          expected_behavior: validateExpectedBehavior(item?.expected_behavior || item?.expectedBehavior || {}),
          tags: uniqueStrings(item?.tags || [], 80, 50),
          priority,
          origin,
          is_critical: Boolean(item?.is_critical ?? item?.isCritical ?? priority === "critical"),
          enabled: item?.enabled !== false
        };
      } catch (error) {
        const normalized = normalizeQaError(error);
        throw new QaServiceError(normalized.code, `cases[${index}]: ${normalized.message}`, {
          status: normalized.status,
          details: normalized.details
        });
      }
    })
  };
}

export function validateExpectedBehavior(value = {}) {
  if (!isPlainObject(value)) throw new QaServiceError("VALIDATION_ERROR", "expected_behavior must be an object");
  const expectedRoute = optionalString(value.expected_route, "expected_route", 20)?.toUpperCase() || null;
  if (expectedRoute && !ROUTES.has(expectedRoute)) {
    throw new QaServiceError("VALIDATION_ERROR", "expected_route must be CHAT or RAG");
  }
  const maxLatency = value.max_latency_ms == null ? null : boundedInteger(value.max_latency_ms, "max_latency_ms", 1, 600_000);
  return {
    expected_route: expectedRoute,
    required_tools: uniqueStrings(value.required_tools || [], 100, 30),
    forbidden_tools: uniqueStrings(value.forbidden_tools || [], 100, 30),
    required_source_types: uniqueStrings(value.required_source_types || [], 100, 30),
    required_source_ids: uniqueStrings(value.required_source_ids || [], 300, 100),
    must_have_sources: Boolean(value.must_have_sources),
    expected_facts: uniqueStrings(value.expected_facts || [], 1000, 100),
    forbidden_claims: uniqueStrings(value.forbidden_claims || [], 1000, 100),
    reference_answer: optionalString(value.reference_answer, "reference_answer", 20_000),
    max_latency_ms: maxLatency
  };
}

export function validateBudget(value = {}, policy = {}) {
  if (value != null && !isPlainObject(value)) throw new QaServiceError("VALIDATION_ERROR", "budget must be an object");
  const defaults = {
    maxCases: Number(policy.maxCases || 100),
    maxParallel: Number(policy.maxParallel || 4),
    maxRepeats: Number(policy.maxRepeats || 3),
    maxEstimatedCost: Number(policy.maxEstimatedCost || 20),
    estimatedCostPerCase: Number(policy.estimatedCostPerCase || 0.05)
  };
  return {
    max_cases: boundedInteger(value?.max_cases ?? defaults.maxCases, "max_cases", 1, Math.min(1000, defaults.maxCases)),
    max_parallel: boundedInteger(value?.max_parallel ?? defaults.maxParallel, "max_parallel", 1, Math.min(20, defaults.maxParallel)),
    max_repeats: boundedInteger(value?.max_repeats ?? defaults.maxRepeats, "max_repeats", 1, Math.min(10, defaults.maxRepeats)),
    max_estimated_cost: boundedNumber(value?.max_estimated_cost ?? defaults.maxEstimatedCost, "max_estimated_cost", 0, defaults.maxEstimatedCost),
    currency: String(value?.currency || "USD").trim().toUpperCase(),
    estimated_cost_per_case: Math.max(0, defaults.estimatedCostPerCase)
  };
}

export function enforceWorkloadBudget({ caseCount, repeatEach, parallelism, budget }) {
  const total = caseCount * repeatEach;
  const estimatedCost = Number((total * budget.estimated_cost_per_case).toFixed(6));
  const violations = [];
  if (caseCount > budget.max_cases) violations.push(`case count ${caseCount} exceeds ${budget.max_cases}`);
  if (repeatEach > budget.max_repeats) violations.push(`repeat count ${repeatEach} exceeds ${budget.max_repeats}`);
  if (parallelism > budget.max_parallel) violations.push(`parallelism ${parallelism} exceeds ${budget.max_parallel}`);
  if (estimatedCost > budget.max_estimated_cost) violations.push(`estimated cost ${estimatedCost} exceeds ${budget.max_estimated_cost}`);
  if (violations.length) {
    throw new QaServiceError("BUDGET_EXCEEDED", "Requested QA workload exceeds budget", {
      status: 422,
      details: { violations, estimated_cost: estimatedCost, currency: budget.currency }
    });
  }
  return { totalExecutions: total, estimatedCost };
}

export function validateIdempotencyKey(value) {
  const key = requiredString(value, "idempotency_key", 200);
  if (key.length < 8) throw new QaServiceError("VALIDATION_ERROR", "idempotency_key must contain at least 8 characters");
  return key;
}

export function requiredId(value, field) {
  const id = requiredString(value, field, 200);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new QaServiceError("VALIDATION_ERROR", `${field} must be a UUID`);
  }
  return id;
}

export function boundedInteger(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new QaServiceError("VALIDATION_ERROR", `${field} must be an integer between ${min} and ${max}`);
  }
  return number;
}

export function boundedNumber(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new QaServiceError("VALIDATION_ERROR", `${field} must be a number between ${min} and ${max}`);
  }
  return number;
}

export function requiredString(value, field, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) throw new QaServiceError("VALIDATION_ERROR", `${field} is required`);
  if (text.length > maxLength) throw new QaServiceError("VALIDATION_ERROR", `${field} cannot exceed ${maxLength} characters`);
  return text;
}

export function optionalString(value, field, maxLength) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) throw new QaServiceError("VALIDATION_ERROR", `${field} cannot exceed ${maxLength} characters`);
  return text;
}

export function uniqueStrings(value, maxLength, maxItems) {
  if (!Array.isArray(value)) throw new QaServiceError("VALIDATION_ERROR", "Expected an array of strings");
  if (value.length > maxItems) throw new QaServiceError("VALIDATION_ERROR", `Array cannot exceed ${maxItems} items`);
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean).map((item) => {
    if (item.length > maxLength) throw new QaServiceError("VALIDATION_ERROR", `Array item cannot exceed ${maxLength} characters`);
    return item;
  }))];
}

export function safeErrorMessage(error) {
  return String(error?.message || error || "Unexpected QA error")
    .replace(/(?:sk|sb_secret)_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 1000);
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
