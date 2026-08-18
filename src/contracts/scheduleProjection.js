import { buildContractActivityMappingCandidates } from "./activityMapping.js";
import { loadContractActivityMappingState } from "./activityMappingService.js";
import { loadContractsDecisionLineageReview } from "./decisionLineage.js";
import { ContractsAgentError } from "./errors.js";
import { workspaceRpc } from "./workspacePersistence.js";
import { CONDITION_RESOLVER_VERSION, resolveConditionDueDate } from "../subagents/scheduleConditionResolver.js";

export const CONTRACTS_SCHEDULE_PROJECTION_AGENT_VERSION = "contracts-schedule-projection.r5.v1";
export const CONTRACTS_SCHEDULE_PROJECTION_POLICY_VERSION = "contracts-reviewed-schedule-shadow.r5.v1";
export const CONTRACTS_SCHEDULE_PROJECTION_SCHEMA_VERSION = "contracts-schedule-shadow-preview.r5.v1";
export const CONTRACTS_SCHEDULE_PROJECTION_MIGRATION_VERSION = "20260817213000";
export const CONTRACTS_SCHEDULE_PROJECTION_SOURCE_RPC = "bidoc_contracts_schedule_projection_source_r5";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const REVIEWED_STATUSES = new Set(["approved", "corrected"]);
const SUPPORTED_OFFSET_UNITS = new Set(["hours", "calendar_days", "working_days", "weeks", "months"]);
const TEMPORAL_VALUE_MISSING_PATTERN = /(?:אינו\s+מצוין|אינה\s+מצוינת|לא\s+צוין|לא\s+צוינה|טרם\s+נקבע|טרם\s+נקבעה|יש\s+להגדיר|ימולא|ימולאו)/u;
const EXPLICIT_DURATION_PATTERN = /(?:תוך|לא\s+יאוחר|לפחות|התראה|הודעה\s+מוקדמת|בתוקף)[^.!?\n]{0,70}\d+(?:\s*[-–]\s*\d+)?\s*(?:שעות?|ימים?|ימי\s+עבודה|שבועות?|חודשים?)/u;
const DIRECT_DURATION_PATTERN = /\d+(?:\s*[-–]\s*\d+)?\s*(?:שעות?|ימים?|ימי\s+עבודה|שבועות?|חודשים?)(?:\s+(?:מיום|ממועד|לאחר|לפני|מתום|עד))?/u;
const RECURRING_PATTERN = /(?:מדי|בכל)\s+(?:יום|שבוע|חודש|חודשיים|רבעון|שנה)|בין\s+היום\s+ה?\s*\d+\s+(?:ל|עד)[-־]?\s*\d+/u;
const EVENT_ANCHOR_PATTERN = /(?:^|[,.؛;:]|\s)(?:עם|לאחר|לפני|עד|בגמר|בסיום|כתנאי\s+ל|מייד(?:ית)?\s+לאחר)\s+[^,.؛;:]{2,90}/u;

const TARGET_TABLES = Object.freeze({
  fixed: "schedule_contract_milestones",
  relative: "schedule_contract_conditions",
  extension: "schedule_contract_extensions"
});

function projectionError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizedUuid(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("en");
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedEvidence(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    evidenceId: normalizedUuid(item?.clauseId) || String(item?.clauseId || item?.rawTextSha256 || "evidence"),
    sourceText: String(item?.excerpt || "").trim(),
    pdfPage: Number.isInteger(Number(item?.pageStart)) && Number(item.pageStart) > 0 ? Number(item.pageStart) : null,
    clause: item?.clauseKey ? String(item.clauseKey) : null
  })).filter((item) => item.sourceText);
}

function targetClassification(decision) {
  switch (decision?.temporalKind) {
    case "fixed": return { classification: "fixed", targetTable: TARGET_TABLES.fixed };
    case "relative":
    case "recurring": return { classification: "relative", targetTable: TARGET_TABLES.relative };
    case "extension": return { classification: "extension", targetTable: TARGET_TABLES.extension };
    default: return { classification: "not_projectable", targetTable: null };
  }
}

function scheduleAudit(decision, classification) {
  if (classification !== "not_projectable" || decision?.scheduleImpact !== "yes") {
    return {
      disposition: classification === "not_projectable" ? "not_schedule_related" : "target_shaped",
      recommendedTemporalKind: classification === "not_projectable" ? null : classification,
      requiresCanonicalCorrection: false,
      detectedSignals: []
    };
  }

  if (!REVIEWED_STATUSES.has(decision?.reviewStatus) || decision?.conflictStatus === "unresolved") {
    return {
      disposition: "review_blocked",
      recommendedTemporalKind: null,
      requiresCanonicalCorrection: false,
      detectedSignals: unique([
        !REVIEWED_STATUSES.has(decision?.reviewStatus) ? "decision_not_reviewed" : null,
        decision?.conflictStatus === "unresolved" ? "decision_conflict_unresolved" : null
      ])
    };
  }

  const text = [decision?.titleHe, decision?.summaryHe, ...(decision?.sourceEvidence || []).map((item) => item?.excerpt)]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n");
  const missingValue = TEMPORAL_VALUE_MISSING_PATTERN.test(text);
  const recurring = RECURRING_PATTERN.test(text);
  const explicitDuration = EXPLICIT_DURATION_PATTERN.test(text) || DIRECT_DURATION_PATTERN.test(text);
  const eventAnchor = EVENT_ANCHOR_PATTERN.test(text);
  const detectedSignals = unique([
    missingValue ? "temporal_value_missing" : null,
    recurring ? "recurring_rule_detected" : null,
    explicitDuration ? "duration_rule_detected" : null,
    eventAnchor ? "event_anchor_detected" : null
  ]);

  if (missingValue) {
    return {
      disposition: "missing_temporal_value",
      recommendedTemporalKind: null,
      requiresCanonicalCorrection: false,
      detectedSignals
    };
  }
  if (recurring || explicitDuration) {
    return {
      disposition: "temporal_correction_candidate",
      recommendedTemporalKind: recurring ? "recurring" : "relative",
      requiresCanonicalCorrection: true,
      detectedSignals
    };
  }
  if (eventAnchor) {
    return {
      disposition: "event_anchor_review",
      recommendedTemporalKind: "relative",
      requiresCanonicalCorrection: true,
      detectedSignals
    };
  }
  return {
    disposition: "schedule_context_only",
    recommendedTemporalKind: null,
    requiresCanonicalCorrection: false,
    detectedSignals: []
  };
}

function temporalBlockers(decision, classification) {
  const blockers = [];
  const offset = numberOrNull(decision?.offsetValue);
  if (classification === "fixed") {
    if (!ISO_DATE_PATTERN.test(String(decision?.contractDate || ""))) blockers.push("fixed_contract_date_missing");
  } else if (classification === "relative") {
    if (!String(decision?.triggerDescriptionHe || "").trim()) blockers.push("condition_trigger_missing");
    if (offset === null || offset < 0 || !Number.isInteger(offset)) blockers.push("condition_offset_invalid");
    if (!SUPPORTED_OFFSET_UNITS.has(String(decision?.offsetUnit || ""))) blockers.push("condition_offset_unit_unsupported");
    if (decision?.offsetUnit === "working_days" && !["explicit", "reviewed"].includes(decision?.calendarSemantics)) {
      blockers.push("working_calendar_semantics_unreviewed");
    }
    if (decision?.offsetUnit === "hours" && offset !== null && offset % 24 !== 0) {
      blockers.push("subday_deadline_not_supported");
    }
  } else if (classification === "extension") {
    blockers.push("extension_amount_missing", "extension_approval_date_missing", "extension_milestone_identity_missing");
  } else if (decision?.scheduleImpact === "yes") {
    blockers.push("temporal_classification_missing");
  }
  return blockers;
}

function projectionBlockers(decision, classification, projectContext) {
  const blockers = [];
  if (!REVIEWED_STATUSES.has(decision?.reviewStatus)) blockers.push("decision_not_reviewed");
  if (decision?.scheduleImpact === "unknown") blockers.push("schedule_impact_unreviewed");
  if (decision?.scheduleImpact === "no") blockers.push("schedule_impact_none");
  if (decision?.conflictStatus === "unresolved") blockers.push("decision_conflict_unresolved");
  blockers.push(...temporalBlockers(decision, classification));

  if (classification !== "not_projectable" && REVIEWED_STATUSES.has(decision?.reviewStatus) && decision?.scheduleImpact === "yes") {
    const registryScheduleProjectId = normalizedUuid(projectContext?.scheduleProjectId);
    const decisionScheduleProjectId = normalizedUuid(decision?.scheduleProjectId);
    if (!registryScheduleProjectId || projectContext?.mappingStatus !== "active") {
      blockers.push("project_mapping_missing");
    } else if (!decisionScheduleProjectId) {
      blockers.push("decision_schedule_mapping_missing");
    } else if (decisionScheduleProjectId !== registryScheduleProjectId) {
      blockers.push("decision_schedule_mapping_mismatch");
    } else if (!["ready", "projected"].includes(String(decision?.projectionStatus || ""))) {
      blockers.push("decision_projection_not_ready");
    }
  }
  return unique(blockers);
}

function commonShadowRow(decision, projectContext) {
  return {
    project_id: normalizedUuid(projectContext?.scheduleProjectId),
    source_contract_decision_id: normalizedUuid(decision?.decisionId),
    written_by: "contracts_schedule_projection_r5_shadow",
    metadata: {
      shadow_preview: true,
      projection_policy_version: CONTRACTS_SCHEDULE_PROJECTION_POLICY_VERSION,
      source_decision_key: String(decision?.decisionKey || ""),
      source_document_version_id: String(decision?.documentVersionId || ""),
      runtime_trigger_date: null,
      calculated_due_date: null
    }
  };
}

function firstEvidence(decision) {
  const evidence = Array.isArray(decision?.sourceEvidence) ? decision.sourceEvidence : [];
  return evidence[0] || null;
}

function buildShadowRow(decision, classification, projectContext, blockers) {
  if (!normalizedUuid(decision?.decisionId) || !normalizedUuid(projectContext?.scheduleProjectId)) return null;
  const evidence = firstEvidence(decision);
  const excerpt = (decision?.sourceEvidence || []).map((item) => String(item?.excerpt || "").trim()).filter(Boolean).join("\n\n").slice(0, 4000);
  const common = commonShadowRow(decision, projectContext);
  if (classification === "fixed" && !blockers.includes("fixed_contract_date_missing")) {
    return {
      ...common,
      milestone_key: `decision:${decision.decisionId}`,
      name: String(decision.titleHe || ""),
      contract_date: decision.contractDate,
      is_project_completion: decision.decisionCategory === "commencement_and_completion",
      activity_key: null,
      status: "active",
      source_document_id: String(decision.documentVersionId || ""),
      source_excerpt: excerpt,
      confidence: 1,
      extractor_version: CONTRACTS_SCHEDULE_PROJECTION_AGENT_VERSION
    };
  }
  if (classification === "relative" && !blockers.some((code) => [
    "condition_trigger_missing", "condition_offset_invalid", "condition_offset_unit_unsupported", "subday_deadline_not_supported"
  ].includes(code))) {
    return {
      ...common,
      condition_key: `decision:${decision.decisionId}`,
      name: String(decision.titleHe || ""),
      category: String(decision.decisionCategory || "other"),
      anchor_kind: String(decision.triggerKind || "event"),
      anchor_description: String(decision.triggerDescriptionHe || ""),
      offset_value: numberOrNull(decision.offsetValue),
      offset_unit: String(decision.offsetUnit || ""),
      recurring: decision.recurring === true,
      status: "pending",
      resolved_milestone_key: null,
      trigger_source_table: null,
      trigger_source_id: null,
      trigger_event_date: null,
      is_project_completion: decision.decisionCategory === "commencement_and_completion",
      penalty_ils_per_day: null,
      source_page: Number.isInteger(Number(evidence?.pageStart)) ? Number(evidence.pageStart) : null,
      source_excerpt: excerpt,
      confidence: 1
    };
  }
  return null;
}

function resolverCompatibility(shadowRow, classification) {
  if (classification !== "relative" || !shadowRow) return null;
  const result = resolveConditionDueDate(shadowRow, "2000-01-01", null);
  const compatible = result.reason === null || result.reason === "working_calendar_missing";
  return {
    resolverVersion: CONDITION_RESOLVER_VERSION,
    compatible,
    pendingReason: result.reason,
    runtimeTriggerDate: null,
    calculatedDueDate: null,
    contractualTruthUpdated: false
  };
}

function activityMappingPreview(decision, classification, mappingState) {
  if (!mappingState?.projectContext || !mappingState?.scheduleVersion) return null;
  if (!["fixed", "relative", "extension"].includes(classification)) return null;
  const evidence = normalizedEvidence(decision?.sourceEvidence);
  try {
    const bundle = buildContractActivityMappingCandidates({
      projectContext: mappingState.projectContext,
      obligation: {
        documentVersionId: decision.documentVersionId,
        candidateKey: decision.decisionKey,
        milestoneKey: classification === "fixed" ? `decision:${decision.decisionId}` : null,
        label: decision.titleHe,
        mappingRequirement: classification === "extension" ? "not_required" : "required",
        conditionStatus: classification === "relative" ? "pending" : "not_applicable",
        triggerEvidenceReviewed: classification !== "relative",
        preferMilestone: classification === "fixed",
        preferredTaskUid: null,
        preferredActivityKey: null,
        preferredOutlineLevel: null,
        activityTerms: unique([decision.titleHe, ...(decision.tags || [])]),
        sourceEvidence: evidence
      },
      scheduleVersion: mappingState.scheduleVersion,
      tasks: mappingState.activities || [],
      existingMappings: (mappingState.existingMappings || []).map((mapping) => ({
        canonicalKey: mapping.canonicalKey,
        alias: mapping.alias,
        aliasSource: mapping.aliasSource,
        matchMethod: mapping.matchMethod,
        confidence: mapping.confidence,
        status: mapping.status
      }))
    });
    return {
      mappingContractVersion: bundle.mappingContractVersion,
      decisionState: bundle.decisionState,
      blockerCodes: bundle.blockers,
      candidateCount: bundle.candidates.length,
      candidates: bundle.candidates.slice(0, 3),
      operationalWritesPerformed: false
    };
  } catch (error) {
    return {
      mappingContractVersion: null,
      decisionState: "blocked",
      blockerCodes: ["activity_mapping_input_invalid"],
      candidateCount: 0,
      candidates: [],
      operationalWritesPerformed: false,
      errorCode: String(error?.code || "contracts_activity_mapping_input_invalid")
    };
  }
}

function planItem(decision, projectContext, mappingState) {
  const { classification, targetTable } = targetClassification(decision);
  const audit = scheduleAudit(decision, classification);
  const blockers = projectionBlockers(decision, classification, projectContext);
  const shadowRow = buildShadowRow(decision, classification, projectContext, blockers);
  const reviewed = REVIEWED_STATUSES.has(decision?.reviewStatus);
  const promotionEligible = reviewed
    && decision?.scheduleImpact === "yes"
    && targetTable !== null
    && blockers.length === 0
    && shadowRow !== null;
  const status = decision?.scheduleImpact === "no"
    ? "not_applicable"
    : promotionEligible
      ? "preview_ready"
      : "blocked";
  return {
    decisionId: normalizedUuid(decision?.decisionId),
    decisionKey: String(decision?.decisionKey || ""),
    documentVersionId: String(decision?.documentVersionId || ""),
    titleHe: String(decision?.titleHe || ""),
    summaryHe: String(decision?.summaryHe || ""),
    decisionCategory: String(decision?.decisionCategory || "other"),
    tags: unique((decision?.tags || []).map((tag) => String(tag || "").trim())),
    sourceEvidence: (decision?.sourceEvidence || []).map((item) => ({
      clauseId: normalizedUuid(item?.clauseId),
      clauseKey: item?.clauseKey ? String(item.clauseKey) : null,
      pageStart: Number.isInteger(Number(item?.pageStart)) && Number(item.pageStart) > 0 ? Number(item.pageStart) : null,
      pageEnd: Number.isInteger(Number(item?.pageEnd)) && Number(item.pageEnd) > 0 ? Number(item.pageEnd) : null,
      excerpt: String(item?.excerpt || "").trim()
    })).filter((item) => item.excerpt),
    reviewStatus: String(decision?.reviewStatus || ""),
    projectionStatus: String(decision?.projectionStatus || "blocked"),
    conflictStatus: String(decision?.conflictStatus || ""),
    scheduleImpact: String(decision?.scheduleImpact || "unknown"),
    temporalKind: String(decision?.temporalKind || "none"),
    classification,
    targetTable,
    status,
    promotionEligible,
    scheduleAudit: audit,
    blockerCodes: blockers,
    projectMapping: {
      sourceProjectId: normalizedUuid(projectContext?.sourceProjectId),
      registryScheduleProjectId: normalizedUuid(projectContext?.scheduleProjectId),
      decisionScheduleProjectId: normalizedUuid(decision?.scheduleProjectId),
      mappingStatus: String(projectContext?.mappingStatus || "missing"),
      matches: Boolean(
        normalizedUuid(decision?.scheduleProjectId)
        && normalizedUuid(decision?.scheduleProjectId) === normalizedUuid(projectContext?.scheduleProjectId)
      )
    },
    shadowRow,
    conditionResolver: resolverCompatibility(shadowRow, classification),
    activityMapping: activityMappingPreview(decision, classification, mappingState),
    operationalWritesPerformed: false
  };
}

function metrics(items) {
  const count = (predicate) => items.filter(predicate).length;
  return {
    currentDecisionCount: items.length,
    reviewedDecisionCount: count((item) => REVIEWED_STATUSES.has(item.reviewStatus)),
    unreviewedDecisionCount: count((item) => !REVIEWED_STATUSES.has(item.reviewStatus)),
    scheduleImpactYesCount: count((item) => item.scheduleImpact === "yes"),
    scheduleImpactWithoutTargetCount: count((item) => item.scheduleImpact === "yes" && item.targetTable === null),
    temporalCorrectionCandidateCount: count((item) => item.scheduleAudit?.requiresCanonicalCorrection === true),
    missingTemporalValueCount: count((item) => item.scheduleAudit?.disposition === "missing_temporal_value"),
    scheduleContextOnlyCount: count((item) => item.scheduleAudit?.disposition === "schedule_context_only"),
    scheduleReviewBlockedCount: count((item) => item.scheduleAudit?.disposition === "review_blocked"),
    targetShapedDecisionCount: count((item) => item.targetTable !== null),
    reviewedTargetShapedDecisionCount: count((item) => REVIEWED_STATUSES.has(item.reviewStatus)
      && item.scheduleImpact === "yes"
      && item.targetTable !== null),
    milestonePreviewCount: count((item) => item.targetTable === TARGET_TABLES.fixed),
    conditionPreviewCount: count((item) => item.targetTable === TARGET_TABLES.relative),
    extensionPreviewCount: count((item) => item.targetTable === TARGET_TABLES.extension),
    promotionEligibleCount: count((item) => item.promotionEligible),
    blockedCount: count((item) => item.status === "blocked"),
    notApplicableCount: count((item) => item.status === "not_applicable"),
    unreviewedScheduleChangeCount: 0,
    modelCallCount: 0,
    scheduleWriteCount: 0,
    activityMappingWriteCount: 0,
    contractTruthWriteCount: 0,
    runtimeDueDateWriteCount: 0
  };
}

export function contractsScheduleProjectionApproved(env = process.env) {
  return String(env.CONTRACTS_SCHEDULE_PROJECTION_R5_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function parseContractsScheduleProjectionWorkspaceId(value) {
  const workspaceId = normalizedUuid(value);
  if (!workspaceId) {
    throw projectionError("contracts_schedule_projection_request_invalid", "workspaceId must be a UUID.");
  }
  return workspaceId;
}

export async function loadContractsScheduleProjectionSourceMappings({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs = 60_000
} = {}) {
  const normalizedWorkspaceId = parseContractsScheduleProjectionWorkspaceId(workspaceId);
  const value = await workspaceRpc({
    config,
    rpc: CONTRACTS_SCHEDULE_PROJECTION_SOURCE_RPC,
    payload: { p_workspace_id: normalizedWorkspaceId },
    fetchImpl,
    timeoutMs
  });
  if (!value
      || normalizedUuid(value.workspaceId) !== normalizedWorkspaceId
      || value.migrationVersion !== CONTRACTS_SCHEDULE_PROJECTION_MIGRATION_VERSION
      || value.mode !== "read_only"
      || Number(value.scheduleWriteCount) !== 0
      || !Array.isArray(value.items)
      || value.items.some((item) => !normalizedUuid(item?.decisionId)
        || (item.scheduleProjectId !== null && !normalizedUuid(item.scheduleProjectId))
        || !["not_applicable", "blocked", "ready", "projected", "superseded"].includes(item.projectionStatus))) {
    throw projectionError(
      "contracts_schedule_projection_source_invalid",
      "The R5 decision-mapping source response is invalid.",
      502
    );
  }
  return {
    ...value,
    items: value.items.map((item) => ({
      decisionId: normalizedUuid(item.decisionId),
      scheduleProjectId: normalizedUuid(item.scheduleProjectId),
      projectionStatus: item.projectionStatus
    }))
  };
}

function applyDecisionSourceMappings(decisionProjection, decisionSource) {
  if (!decisionSource) return decisionProjection;
  const sourceByDecisionId = new Map(decisionSource.items.map((item) => [item.decisionId, item]));
  return {
    ...decisionProjection,
    items: decisionProjection.items.map((item) => {
      const source = sourceByDecisionId.get(normalizedUuid(item.decisionId));
      return source ? {
        ...item,
        scheduleProjectId: source.scheduleProjectId,
        projectionStatus: source.projectionStatus
      } : item;
    })
  };
}

export function planReviewedScheduleProjection({
  decisionProjection,
  decisionSource = null,
  decisionSourceError = null,
  mappingState = null,
  mappingError = null
} = {}) {
  const workspace = decisionProjection?.workspace;
  if (!normalizedUuid(workspace?.workspaceId) || !Array.isArray(decisionProjection?.items)) {
    throw projectionError("contracts_schedule_projection_source_invalid", "The R4.2 reviewed decision projection is invalid.", 502);
  }
  const projectContext = mappingState?.projectContext || {
    sourceProjectId: workspace.sourceProjectId,
    scheduleProjectId: null,
    projectMappingId: null,
    mappingStatus: "missing"
  };
  const items = decisionProjection.items.map((decision) => planItem({
    ...decision,
    documentVersionId: workspace.documentVersionId
  }, projectContext, mappingState));
  const result = {
    schemaVersion: CONTRACTS_SCHEDULE_PROJECTION_SCHEMA_VERSION,
    agentVersion: CONTRACTS_SCHEDULE_PROJECTION_AGENT_VERSION,
    projectionPolicyVersion: CONTRACTS_SCHEDULE_PROJECTION_POLICY_VERSION,
    migrationVersion: CONTRACTS_SCHEDULE_PROJECTION_MIGRATION_VERSION,
    mode: "shadow_read_only",
    workspace: {
      workspaceId: normalizedUuid(workspace.workspaceId),
      sourceProjectId: normalizedUuid(workspace.sourceProjectId),
      documentVersionId: String(workspace.documentVersionId || ""),
      parserGenerationId: String(workspace.parserGenerationId || "")
    },
    projectMapping: {
      available: Boolean(mappingState?.projectContext?.mappingStatus === "active"),
      sourceProjectId: normalizedUuid(projectContext.sourceProjectId),
      scheduleProjectId: normalizedUuid(projectContext.scheduleProjectId),
      projectMappingId: normalizedUuid(projectContext.projectMappingId),
      status: String(projectContext.mappingStatus || "missing"),
      errorCode: mappingError ? String(mappingError.code || "contracts_schedule_projection_mapping_unavailable") : null
    },
    decisionSource: {
      migrationAvailable: Boolean(decisionSource),
      migrationVersion: decisionSource?.migrationVersion || CONTRACTS_SCHEDULE_PROJECTION_MIGRATION_VERSION,
      mode: decisionSource?.mode || "legacy_projection_fallback",
      errorCode: decisionSourceError
        ? String(decisionSourceError.code || "contracts_schedule_projection_source_unavailable")
        : null,
      scheduleWriteCount: 0
    },
    metrics: metrics(items),
    items,
    gates: {
      reviewedDecisionsOnly: true,
      projectMappingRequiredAtEligibility: true,
      oneWayScheduleDecisionLink: true,
      conditionResolverReused: true,
      activityMapperReused: true,
      humanPromotionApprovalRequired: true,
      promotionEnabled: false,
      scheduleWritesEnabled: false,
      modelCallsEnabled: false
    },
    operationalWritesPerformed: false
  };
  if (result.metrics.scheduleWriteCount !== 0
      || result.metrics.unreviewedScheduleChangeCount !== 0
      || result.items.some((item) => item.operationalWritesPerformed !== false)) {
    throw projectionError("contracts_schedule_projection_safety_violation", "The R5 shadow planner violated the zero-write boundary.", 500);
  }
  return result;
}

export async function loadContractsScheduleProjectionStatus({ env = process.env } = {}) {
  const approved = contractsScheduleProjectionApproved(env);
  return {
    active: true,
    ready: approved,
    shadowPreviewApproved: approved,
    agentVersion: CONTRACTS_SCHEDULE_PROJECTION_AGENT_VERSION,
    projectionPolicyVersion: CONTRACTS_SCHEDULE_PROJECTION_POLICY_VERSION,
    migrationVersion: CONTRACTS_SCHEDULE_PROJECTION_MIGRATION_VERSION,
    mode: "shadow_read_only",
    promotionEnabled: false,
    scheduleWritesEnabled: false,
    modelCallsEnabled: false,
    migrationRequiredBeforePromotion: true,
    reason: approved ? null : "activation_not_approved"
  };
}

export async function loadContractsScheduleProjectionPreview({
  config,
  workspaceId,
  env = process.env,
  fetchImpl = fetch,
  loadDecisionProjectionImpl = loadContractsDecisionLineageReview,
  loadDecisionMappingsImpl = loadContractsScheduleProjectionSourceMappings,
  loadMappingStateImpl = loadContractActivityMappingState,
  timeoutMs = 60_000
} = {}) {
  if (!contractsScheduleProjectionApproved(env)) {
    throw projectionError("contracts_schedule_projection_not_enabled", "The R5 shadow projection is not enabled.", 503);
  }
  const normalizedWorkspaceId = parseContractsScheduleProjectionWorkspaceId(workspaceId);
  let decisionProjection = await loadDecisionProjectionImpl({
    config,
    workspaceId: normalizedWorkspaceId,
    fetchImpl,
    timeoutMs
  });
  let decisionSource = null;
  let decisionSourceError = null;
  try {
    decisionSource = await loadDecisionMappingsImpl({
      config,
      workspaceId: normalizedWorkspaceId,
      fetchImpl,
      timeoutMs
    });
    decisionProjection = applyDecisionSourceMappings(decisionProjection, decisionSource);
  } catch (error) {
    decisionSourceError = error;
  }
  let mappingState = null;
  let mappingError = null;
  try {
    mappingState = await loadMappingStateImpl({
      config,
      sourceProjectId: decisionProjection.workspace.sourceProjectId,
      fetchImpl,
      timeoutMs
    });
  } catch (error) {
    mappingError = error;
  }
  return planReviewedScheduleProjection({
    decisionProjection,
    decisionSource,
    decisionSourceError,
    mappingState,
    mappingError
  });
}
