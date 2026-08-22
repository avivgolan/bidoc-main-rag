import { ContractsAgentError } from "./errors.js";
import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_INDICATOR_HANDOFF_AGENT_VERSION = "contracts-indicator-handoff.r6.v1";
export const CONTRACTS_INDICATOR_HANDOFF_POLICY_VERSION = "contracts-reviewed-indicator-suitability.r6.v1";
export const CONTRACTS_INDICATOR_HANDOFF_SCHEMA_VERSION = "contracts-indicator-handoff.r6.v1";
export const CONTRACTS_INDICATOR_HANDOFF_SOURCE_SCHEMA_VERSION = "contracts-indicator-product-source.r6.v1";
export const CONTRACTS_INDICATOR_HANDOFF_MIGRATION_VERSION = "20260822113820";
export const CONTRACTS_INDICATOR_HANDOFF_SOURCE_RPC = "bidoc_contracts_r6_indicator_product_handoff_source_v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HEBREW_PATTERN = /[\u0590-\u05ff]/u;
const REVIEWED_STATUSES = new Set(["approved", "corrected"]);
const INACTIVE_STATUSES = new Set(["rejected", "split", "merged", "superseded"]);
const ALLOWED_CONFLICT_STATUSES = new Set(["none", "reviewed"]);
const REVIEW_STATUSES = new Set([
  "proposed", "approved", "corrected", "rejected", "unresolved", "split", "merged", "superseded"
]);
const REVIEW_STATUS_HE = {
  proposed: "מוצע",
  approved: "מאושר",
  corrected: "תוקן",
  rejected: "נדחה",
  unresolved: "לא_פתור",
  split: "הוחלף",
  merged: "הוחלף",
  superseded: "הוחלף"
};
const INDICATOR_SUITABILITY = new Set(["מתאים", "לא_מתאים", "נדרשת_בדיקה"]);

function handoffError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function normalizedUuid(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizeIndicatorSuitability(decision) {
  const productValue = String(decision?.indicatorSuitability || "").trim();
  if (INDICATOR_SUITABILITY.has(productValue)) return productValue;
  const legacyValue = String(decision?.scheduleImpact || "unknown");
  if (legacyValue === "yes") return "מתאים";
  if (legacyValue === "no") return "לא_מתאים";
  return "נדרשת_בדיקה";
}

function normalizeTiming(decision) {
  if (decision?.timing && typeof decision.timing === "object" && !Array.isArray(decision.timing)) {
    return decision.timing;
  }
  const kind = String(decision?.temporalKind || "none");
  if (kind === "none" && !decision?.contractDate && decision?.offsetValue == null && decision?.recurring !== true) {
    return null;
  }
  return {
    schemaVersion: "contracts-timing.r6.4a.v1",
    kind,
    contractDate: decision?.contractDate || null,
    offsetValue: decision?.offsetValue ?? null,
    offsetUnit: decision?.offsetUnit || null,
    calendarSemantics: String(decision?.calendarSemantics || "unknown"),
    recurring: decision?.recurring === true
  };
}

function classifyDecision(decision) {
  const reviewStatus = String(decision?.reviewStatusCode || decision?.reviewStatus || "");
  const conflictStatus = String(decision?.conflictStatus || "");
  const indicatorSuitability = normalizeIndicatorSuitability(decision);

  if (INACTIVE_STATUSES.has(reviewStatus)) {
    return { handoffStatus: "not_suitable", reasonCodes: ["decision_inactive"] };
  }
  if (!REVIEWED_STATUSES.has(reviewStatus)) {
    return { handoffStatus: "requires_review", reasonCodes: ["decision_not_reviewed"] };
  }
  if (!ALLOWED_CONFLICT_STATUSES.has(conflictStatus)) {
    return {
      handoffStatus: "requires_review",
      reasonCodes: [conflictStatus === "unresolved" ? "decision_conflict_unresolved" : "decision_conflict_not_reviewed"]
    };
  }
  if (decision?.embeddingReady === false) {
    return { handoffStatus: "requires_review", reasonCodes: ["decision_embedding_missing"] };
  }
  if (indicatorSuitability === "נדרשת_בדיקה") {
    return { handoffStatus: "requires_review", reasonCodes: ["indicator_suitability_unknown"] };
  }
  if (indicatorSuitability === "לא_מתאים") {
    return { handoffStatus: "not_suitable", reasonCodes: ["no_indicator_impact"] };
  }
  if (indicatorSuitability === "מתאים") {
    return { handoffStatus: "suitable", reasonCodes: ["reviewed_indicator_impact"] };
  }
  return { handoffStatus: "requires_review", reasonCodes: ["indicator_suitability_invalid"] };
}

function handoffItem(decision, documentVersionId) {
  const classification = classifyDecision(decision);
  const reviewStatusCode = String(decision?.reviewStatusCode || decision?.reviewStatus || "");
  const indicatorSuitability = normalizeIndicatorSuitability(decision);
  const timing = normalizeTiming(decision);
  return {
    decisionId: normalizedUuid(decision?.decisionId),
    projectId: normalizedUuid(decision?.projectId),
    sourceDocumentId: normalizedUuid(decision?.sourceDocumentId),
    decisionKey: String(decision?.decisionKey || ""),
    revision: Number(decision?.revision),
    documentVersionId: String(documentVersionId || ""),
    titleHe: String(decision?.titleHe || ""),
    summaryHe: String(decision?.summaryHe || ""),
    content: String(decision?.content || decision?.decisionTextHe || ""),
    hashtags: unique((decision?.hashtags || decision?.tags || []).map((tag) => String(tag || "").trim())),
    sourceEvidence: (decision?.sourceEvidence || []).map((evidence) => ({
      clauseId: normalizedUuid(evidence?.clauseId),
      clauseKey: evidence?.clauseKey ? String(evidence.clauseKey) : null,
      pageStart: Number.isInteger(Number(evidence?.pageStart)) && Number(evidence.pageStart) > 0 ? Number(evidence.pageStart) : null,
      pageEnd: Number.isInteger(Number(evidence?.pageEnd)) && Number(evidence.pageEnd) > 0 ? Number(evidence.pageEnd) : null,
      excerpt: String(evidence?.excerpt || "").trim()
    })).filter((evidence) => evidence.excerpt),
    responsibleParty: decision?.responsibleParty || null,
    beneficiary: decision?.beneficiary || null,
    categoryHe: String(decision?.categoryHe || decision?.decisionCategory || ""),
    reviewStatus: String(decision?.reviewStatus || REVIEW_STATUS_HE[reviewStatusCode] || ""),
    reviewStatusCode,
    conflictStatus: String(decision?.conflictStatus || ""),
    indicatorSuitability,
    timing,
    triggerHe: decision?.triggerHe || decision?.triggerKind || null,
    triggerDescriptionHe: decision?.triggerDescriptionHe || null,
    reviewedAt: decision?.reviewedAt || null,
    reviewReasonHe: decision?.reviewReasonHe || null,
    embeddingReady: decision?.embeddingReady !== false,
    embeddingDimensions: decision?.embeddingDimensions ?? null,
    handoffStatus: classification.handoffStatus,
    reasonCodes: classification.reasonCodes,
    suitableForIndicator: classification.handoffStatus === "suitable",
    placementOwnedByIndicator: true,
    operationalWritesPerformed: false
  };
}

export function contractsIndicatorHandoffApproved(env = process.env) {
  return [
    env.CONTRACTS_INDICATOR_HANDOFF_R5_APPROVED,
    env.CONTRACTS_SCHEDULE_PROJECTION_R5_APPROVED
  ].some((value) => String(value || "").trim().toUpperCase() === "TRUE");
}

export function parseContractsIndicatorHandoffWorkspaceId(value) {
  const workspaceId = normalizedUuid(value);
  if (!workspaceId) {
    throw handoffError("contracts_indicator_handoff_request_invalid", "workspaceId must be a UUID.");
  }
  return workspaceId;
}

export function buildContractsIndicatorHandoff(decisionProjection) {
  const workspace = decisionProjection?.workspace;
  if (!normalizedUuid(workspace?.workspaceId)
      || !normalizedUuid(workspace?.projectId || workspace?.sourceProjectId)
      || !Array.isArray(decisionProjection?.items)) {
    throw handoffError(
      "contracts_indicator_handoff_source_invalid",
      "The reviewed Contracts decision projection is invalid.",
      502
    );
  }
  const items = decisionProjection.items.map((decision) => handoffItem(decision, workspace.documentVersionId));
  if (items.some((item) => !item.decisionId
      || !Number.isSafeInteger(item.revision)
      || item.revision < 1
      || item.sourceEvidence.length < 1)) {
    throw handoffError(
      "contracts_indicator_handoff_source_invalid",
      "A current Contracts decision is incomplete for the Indicator handoff.",
      502
    );
  }
  const count = (status) => items.filter((item) => item.handoffStatus === status).length;
  const result = {
    schemaVersion: CONTRACTS_INDICATOR_HANDOFF_SCHEMA_VERSION,
    agentVersion: CONTRACTS_INDICATOR_HANDOFF_AGENT_VERSION,
    policyVersion: CONTRACTS_INDICATOR_HANDOFF_POLICY_VERSION,
    migrationVersion: CONTRACTS_INDICATOR_HANDOFF_MIGRATION_VERSION,
    mode: "indicator_handoff_read_only",
    workspace: {
      workspaceId: normalizedUuid(workspace.workspaceId),
      projectId: normalizedUuid(workspace.projectId || workspace.sourceProjectId),
      sourceProjectId: normalizedUuid(workspace.projectId || workspace.sourceProjectId),
      documentVersionId: String(workspace.documentVersionId || ""),
      parserGenerationId: String(workspace.parserGenerationId || "")
    },
    metrics: {
      currentDecisionCount: items.length,
      suitableCount: count("suitable"),
      notSuitableCount: count("not_suitable"),
      requiresReviewCount: count("requires_review"),
      embeddingReadyCount: items.filter((item) => item.embeddingReady).length,
      modelCallCount: 0,
      contractTruthWriteCount: 0,
      indicatorWriteCount: 0,
      scheduleWriteCount: 0,
      activityMappingWriteCount: 0,
      runtimeDueDateWriteCount: 0
    },
    items,
    suitableItems: items.filter((item) => item.suitableForIndicator),
    gates: {
      existingReviewedContractTruthReused: true,
      productViewSource: true,
      separateHandoffTableRequired: false,
      humanDecisionReviewRequired: true,
      indicatorOwnsProjectPlacement: true,
      indicatorOwnsTargetSelection: true,
      indicatorOwnsCalendarCalculation: true,
      indicatorOwnsScheduleWrites: true,
      contractsScheduleWritesEnabled: false,
      contractsIndicatorWritesEnabled: false,
      contractsModelCallsEnabled: false
    },
    operationalWritesPerformed: false
  };
  if (result.metrics.currentDecisionCount !== result.metrics.suitableCount
      + result.metrics.notSuitableCount
      + result.metrics.requiresReviewCount
      || result.metrics.scheduleWriteCount !== 0
      || result.metrics.contractTruthWriteCount !== 0
      || result.metrics.indicatorWriteCount !== 0
      || result.items.some((item) => item.operationalWritesPerformed !== false
        || Object.hasOwn(item, "scheduleImpact")
        || Object.hasOwn(item, "decisionCategory")
        || Object.hasOwn(item, "temporalKind")
        || Object.hasOwn(item, "scheduleProjectId")
        || Object.hasOwn(item, "targetTable"))) {
    throw handoffError(
      "contracts_indicator_handoff_safety_violation",
      "The Indicator handoff violated its complete zero-write boundary.",
      500
    );
  }
  return result;
}

export async function loadContractsIndicatorHandoffStatus({ env = process.env } = {}) {
  const approved = contractsIndicatorHandoffApproved(env);
  return {
    active: true,
    ready: approved,
    agentVersion: CONTRACTS_INDICATOR_HANDOFF_AGENT_VERSION,
    policyVersion: CONTRACTS_INDICATOR_HANDOFF_POLICY_VERSION,
    migrationVersion: CONTRACTS_INDICATOR_HANDOFF_MIGRATION_VERSION,
    mode: "indicator_handoff_read_only",
    sourceRpc: CONTRACTS_INDICATOR_HANDOFF_SOURCE_RPC,
    sourceView: "private.contracts_product_r6_v1",
    separateHandoffTableRequired: false,
    scheduleWritesEnabled: false,
    modelCallsEnabled: false,
    reason: approved ? null : "activation_not_approved"
  };
}

function assertProductSource(value) {
  const workspace = value?.workspace;
  if (!value
      || value.schemaVersion !== CONTRACTS_INDICATOR_HANDOFF_SOURCE_SCHEMA_VERSION
      || value.migrationVersion !== CONTRACTS_INDICATOR_HANDOFF_MIGRATION_VERSION
      || value.sourceView !== "private.contracts_product_r6_v1"
      || !normalizedUuid(workspace?.workspaceId)
      || !normalizedUuid(workspace?.projectId)
      || !Array.isArray(value.items)
      || Number(value?.metrics?.productDecisionCount) !== value.items.length
      || Number(value?.metrics?.modelCallCount) !== 0
      || Number(value?.metrics?.contractTruthWriteCount) !== 0
      || Number(value?.metrics?.indicatorWriteCount) !== 0
      || Number(value?.metrics?.scheduleWriteCount) !== 0
      || value?.gates?.productViewSource !== true
      || value?.gates?.readOnly !== true) {
    throw handoffError(
      "contracts_indicator_handoff_source_invalid",
      "The Contracts R6 product-view handoff source is invalid.",
      502
    );
  }
  if (value.items.some((item) => !normalizedUuid(item?.decisionId)
      || !normalizedUuid(item?.projectId)
      || !normalizedUuid(item?.sourceDocumentId)
      || !Number.isSafeInteger(Number(item?.revision))
      || Number(item.revision) < 1
      || !String(item?.content || "").trim()
      || !Array.isArray(item?.hashtags)
      || item.hashtags.some((tag) => !HEBREW_PATTERN.test(String(tag || "")) || /[A-Za-z#]/u.test(String(tag || "")))
      || !Array.isArray(item?.sourceEvidence)
      || item.sourceEvidence.length < 1
      || !HEBREW_PATTERN.test(String(item?.categoryHe || ""))
      || !INDICATOR_SUITABILITY.has(item?.indicatorSuitability)
      || !REVIEW_STATUSES.has(item?.reviewStatusCode)
      || !HEBREW_PATTERN.test(String(item?.reviewStatus || ""))
      || (item?.timing !== null && (typeof item.timing !== "object" || Array.isArray(item.timing)))
      || typeof item?.embeddingReady !== "boolean"
      || (item.embeddingReady && Number(item?.embeddingDimensions) !== 3072)
      || Object.hasOwn(item, "embedding")
      || Object.hasOwn(item, "scheduleImpact")
      || Object.hasOwn(item, "scheduleProjectId")
      || Object.hasOwn(item, "targetTable"))) {
    throw handoffError(
      "contracts_indicator_handoff_source_invalid",
      "A Contracts R6 product-view decision is incomplete or exposes a legacy handoff field.",
      502
    );
  }
  return value;
}

export async function loadContractsIndicatorProductSource({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs = 60_000
} = {}) {
  try {
    const source = await workspaceRpc({
      config,
      rpc: CONTRACTS_INDICATOR_HANDOFF_SOURCE_RPC,
      payload: { p_workspace_id: parseContractsIndicatorHandoffWorkspaceId(workspaceId) },
      fetchImpl,
      timeoutMs
    });
    if (!source) {
      throw handoffError("contracts_indicator_handoff_workspace_not_found", "The saved Contracts workspace was not found.", 404);
    }
    return assertProductSource(source);
  } catch (error) {
    if (error?.code === "contracts_workspace_migration_missing") {
      throw handoffError(
        "contracts_indicator_handoff_migration_missing",
        "The Contracts R6 Indicator product-view migration is not available in KAPAIM.",
        503,
        error
      );
    }
    throw error;
  }
}

export async function loadContractsIndicatorHandoff({
  config,
  workspaceId,
  env = process.env,
  fetchImpl = fetch,
  loadProductSourceImpl = loadContractsIndicatorProductSource,
  timeoutMs = 60_000
} = {}) {
  if (!contractsIndicatorHandoffApproved(env)) {
    throw handoffError("contracts_indicator_handoff_not_enabled", "The R6 Indicator handoff is not enabled.", 503);
  }
  const normalizedWorkspaceId = parseContractsIndicatorHandoffWorkspaceId(workspaceId);
  const productSource = await loadProductSourceImpl({
    config,
    workspaceId: normalizedWorkspaceId,
    fetchImpl,
    timeoutMs
  });
  return buildContractsIndicatorHandoff(productSource);
}
