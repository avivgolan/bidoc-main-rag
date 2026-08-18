import { loadContractsDecisionLineageReview } from "./decisionLineage.js";
import { ContractsAgentError } from "./errors.js";

export const CONTRACTS_INDICATOR_HANDOFF_AGENT_VERSION = "contracts-indicator-handoff.r5.v1";
export const CONTRACTS_INDICATOR_HANDOFF_POLICY_VERSION = "contracts-reviewed-indicator-suitability.r5.v1";
export const CONTRACTS_INDICATOR_HANDOFF_SCHEMA_VERSION = "contracts-indicator-handoff.r5.v1";
export const CONTRACTS_INDICATOR_HANDOFF_MIGRATION_VERSION = "20260818102828";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const REVIEWED_STATUSES = new Set(["approved", "corrected"]);
const INACTIVE_STATUSES = new Set(["rejected", "split", "merged", "superseded"]);
const ALLOWED_CONFLICT_STATUSES = new Set(["none", "reviewed"]);

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

function classifyDecision(decision) {
  const reviewStatus = String(decision?.reviewStatus || "");
  const conflictStatus = String(decision?.conflictStatus || "");
  const scheduleImpact = String(decision?.scheduleImpact || "unknown");

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
  if (scheduleImpact === "unknown") {
    return { handoffStatus: "requires_review", reasonCodes: ["indicator_suitability_unknown"] };
  }
  if (scheduleImpact === "no") {
    return { handoffStatus: "not_suitable", reasonCodes: ["no_indicator_impact"] };
  }
  if (scheduleImpact === "yes") {
    return { handoffStatus: "suitable", reasonCodes: ["reviewed_indicator_impact"] };
  }
  return { handoffStatus: "requires_review", reasonCodes: ["indicator_suitability_invalid"] };
}

function handoffItem(decision, documentVersionId) {
  const classification = classifyDecision(decision);
  return {
    decisionId: normalizedUuid(decision?.decisionId),
    decisionKey: String(decision?.decisionKey || ""),
    revision: Number(decision?.revision),
    documentVersionId: String(documentVersionId || ""),
    titleHe: String(decision?.titleHe || ""),
    summaryHe: String(decision?.summaryHe || ""),
    decisionTextHe: String(decision?.decisionTextHe || ""),
    tags: unique((decision?.tags || []).map((tag) => String(tag || "").trim())),
    sourceEvidence: (decision?.sourceEvidence || []).map((evidence) => ({
      clauseId: normalizedUuid(evidence?.clauseId),
      clauseKey: evidence?.clauseKey ? String(evidence.clauseKey) : null,
      pageStart: Number.isInteger(Number(evidence?.pageStart)) && Number(evidence.pageStart) > 0 ? Number(evidence.pageStart) : null,
      pageEnd: Number.isInteger(Number(evidence?.pageEnd)) && Number(evidence.pageEnd) > 0 ? Number(evidence.pageEnd) : null,
      excerpt: String(evidence?.excerpt || "").trim()
    })).filter((evidence) => evidence.excerpt),
    decisionCategory: String(decision?.decisionCategory || "other"),
    reviewStatus: String(decision?.reviewStatus || ""),
    conflictStatus: String(decision?.conflictStatus || ""),
    scheduleImpact: String(decision?.scheduleImpact || "unknown"),
    temporalKind: String(decision?.temporalKind || "none"),
    contractDate: decision?.contractDate || null,
    triggerKind: decision?.triggerKind || null,
    triggerDescriptionHe: decision?.triggerDescriptionHe || null,
    offsetValue: decision?.offsetValue ?? null,
    offsetUnit: decision?.offsetUnit || null,
    calendarSemantics: String(decision?.calendarSemantics || "unknown"),
    recurring: decision?.recurring === true,
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
      || !normalizedUuid(workspace?.sourceProjectId)
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
      sourceProjectId: normalizedUuid(workspace.sourceProjectId),
      documentVersionId: String(workspace.documentVersionId || ""),
      parserGenerationId: String(workspace.parserGenerationId || "")
    },
    metrics: {
      currentDecisionCount: items.length,
      suitableCount: count("suitable"),
      notSuitableCount: count("not_suitable"),
      requiresReviewCount: count("requires_review"),
      modelCallCount: 0,
      contractTruthWriteCount: 0,
      scheduleWriteCount: 0,
      activityMappingWriteCount: 0,
      runtimeDueDateWriteCount: 0
    },
    items,
    suitableItems: items.filter((item) => item.suitableForIndicator),
    gates: {
      existingReviewedContractTruthReused: true,
      separateHandoffTableRequired: false,
      humanDecisionReviewRequired: true,
      indicatorOwnsProjectPlacement: true,
      indicatorOwnsTargetSelection: true,
      indicatorOwnsCalendarCalculation: true,
      indicatorOwnsScheduleWrites: true,
      contractsScheduleWritesEnabled: false,
      contractsModelCallsEnabled: false
    },
    operationalWritesPerformed: false
  };
  if (result.metrics.currentDecisionCount !== result.metrics.suitableCount
      + result.metrics.notSuitableCount
      + result.metrics.requiresReviewCount
      || result.metrics.scheduleWriteCount !== 0
      || result.metrics.contractTruthWriteCount !== 0
      || result.items.some((item) => item.operationalWritesPerformed !== false)) {
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
    separateHandoffTableRequired: false,
    scheduleWritesEnabled: false,
    modelCallsEnabled: false,
    reason: approved ? null : "activation_not_approved"
  };
}

export async function loadContractsIndicatorHandoff({
  config,
  workspaceId,
  env = process.env,
  fetchImpl = fetch,
  loadDecisionProjectionImpl = loadContractsDecisionLineageReview,
  timeoutMs = 60_000
} = {}) {
  if (!contractsIndicatorHandoffApproved(env)) {
    throw handoffError("contracts_indicator_handoff_not_enabled", "The R5 Indicator handoff is not enabled.", 503);
  }
  const normalizedWorkspaceId = parseContractsIndicatorHandoffWorkspaceId(workspaceId);
  const decisionProjection = await loadDecisionProjectionImpl({
    config,
    workspaceId: normalizedWorkspaceId,
    fetchImpl,
    timeoutMs
  });
  return buildContractsIndicatorHandoff(decisionProjection);
}
