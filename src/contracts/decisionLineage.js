import { ContractsAgentError } from "./errors.js";
import { parseContractsClauseWorkspaceId } from "./clausePersistence.js";
import { CONTRACTS_DECISION_CATEGORIES } from "./decisionNormalization.js";
import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_DECISION_LINEAGE_AGENT_VERSION = "contracts-decisions-lineage.r4.2c.v1";
export const CONTRACTS_DECISION_LINEAGE_POLICY_VERSION = "contracts-decision-lineage.r4.2c.v1";
export const CONTRACTS_DECISION_LINEAGE_MIGRATION_VERSION = "20260817173106";
export const CONTRACTS_DECISION_LINEAGE_STATUS_RPC = "bidoc_contracts_decision_lineage_status_r4_2c";
export const CONTRACTS_DECISION_LINEAGE_GET_RPC = "bidoc_contracts_get_decision_lineage_review_r4_2c";
export const CONTRACTS_DECISION_LINEAGE_APPLY_RPC = "bidoc_contracts_review_decision_lineage_r4_2c";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HEBREW_PATTERN = /[\u0590-\u05ff]/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DECISION_CATEGORY_SET = new Set(CONTRACTS_DECISION_CATEGORIES);
const TEMPORAL_KINDS = new Set(["none", "fixed", "relative", "recurring", "extension", "consequence"]);
const OFFSET_UNITS = new Set(["hours", "calendar_days", "working_days", "weeks", "months"]);
const CALENDAR_SEMANTICS = new Set(["explicit", "reviewed", "unknown", "not_applicable"]);
const CONFLICT_STATUSES = new Set(["none", "detected", "reviewed", "unresolved"]);
const SCHEDULE_IMPACTS = new Set(["yes", "no", "unknown"]);
const REVIEW_STATUSES = new Set(["proposed", "approved", "corrected", "rejected", "split", "merged", "superseded", "unresolved"]);

function lineageError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function exactObject(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw lineageError("contracts_decision_lineage_request_invalid", `${label} must be an object.`);
  }
  const unsupported = Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
  if (unsupported.length) {
    throw lineageError(
      "contracts_decision_lineage_request_invalid",
      `${label} contains an unsupported field: ${unsupported[0]}.`
    );
  }
  return value;
}

function uuid(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw lineageError("contracts_decision_lineage_request_invalid", `${field} must be a UUID.`);
  }
  return normalized;
}

function expectedRevision(value, field = "expectedRevision") {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw lineageError("contracts_decision_lineage_request_invalid", `${field} must be a positive integer.`);
  }
  return revision;
}

function boundedText(value, field, { min = 1, max = 200, optional = false, hebrew = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (optional && !normalized) return null;
  if (normalized.length < min || normalized.length > max || (hebrew && !HEBREW_PATTERN.test(normalized))) {
    throw lineageError(
      "contracts_decision_lineage_request_invalid",
      `${field} must contain ${min}-${max} characters${hebrew ? " and include Hebrew" : ""}.`
    );
  }
  return normalized;
}

function parseSource(value, index) {
  const source = exactObject(value, new Set(["decisionId", "expectedRevision"]), `sources[${index}]`);
  return {
    decisionId: uuid(source.decisionId, `sources[${index}].decisionId`),
    expectedRevision: expectedRevision(source.expectedRevision, `sources[${index}].expectedRevision`)
  };
}

function parseOutput(value, index) {
  const output = exactObject(
    value,
    new Set([
      "primaryClauseId", "sourceClauseIds", "titleHe", "summaryHe", "decisionTextHe", "tags",
      "responsibleParty", "beneficiary", "decisionCategory", "conflictStatus", "scheduleImpact",
      "temporalKind", "contractDate", "triggerKind", "triggerDescriptionHe", "offsetValue",
      "offsetUnit", "calendarSemantics", "recurring"
    ]),
    `outputs[${index}]`
  );
  if (!Array.isArray(output.sourceClauseIds)
      || output.sourceClauseIds.length < 1
      || output.sourceClauseIds.length > 100) {
    throw lineageError(
      "contracts_decision_lineage_request_invalid",
      `outputs[${index}].sourceClauseIds must contain 1-100 clause IDs.`
    );
  }
  const sourceClauseIds = output.sourceClauseIds.map((value, sourceIndex) => (
    uuid(value, `outputs[${index}].sourceClauseIds[${sourceIndex}]`)
  ));
  if (new Set(sourceClauseIds).size !== sourceClauseIds.length) {
    throw lineageError("contracts_decision_lineage_request_invalid", `outputs[${index}] repeats a source clause.`);
  }
  const primaryClauseId = uuid(output.primaryClauseId, `outputs[${index}].primaryClauseId`);
  if (!sourceClauseIds.includes(primaryClauseId)) {
    throw lineageError(
      "contracts_decision_lineage_request_invalid",
      `outputs[${index}].primaryClauseId must be included in its sourceClauseIds.`
    );
  }
  if (!Array.isArray(output.tags) || output.tags.length > 12) {
    throw lineageError("contracts_decision_lineage_request_invalid", `outputs[${index}].tags must contain at most 12 tags.`);
  }
  const tags = output.tags.map((tag, tagIndex) => boundedText(
    tag,
    `outputs[${index}].tags[${tagIndex}]`,
    { max: 100, hebrew: true }
  ));
  const decisionCategory = String(output.decisionCategory || "");
  const conflictStatus = String(output.conflictStatus || "");
  const scheduleImpact = String(output.scheduleImpact || "");
  const temporalKind = String(output.temporalKind || "");
  const calendarSemantics = String(output.calendarSemantics || "");
  const offsetUnit = output.offsetUnit === null || output.offsetUnit === "" ? null : String(output.offsetUnit);
  const offsetValue = output.offsetValue === null || output.offsetValue === "" ? null : Number(output.offsetValue);
  const contractDate = boundedText(output.contractDate, `outputs[${index}].contractDate`, { max: 10, optional: true });
  const triggerDescriptionHe = boundedText(
    output.triggerDescriptionHe,
    `outputs[${index}].triggerDescriptionHe`,
    { max: 700, optional: true }
  );
  if (!DECISION_CATEGORY_SET.has(decisionCategory)
      || !CONFLICT_STATUSES.has(conflictStatus)
      || !SCHEDULE_IMPACTS.has(scheduleImpact)
      || !TEMPORAL_KINDS.has(temporalKind)
      || !CALENDAR_SEMANTICS.has(calendarSemantics)
      || (offsetUnit && !OFFSET_UNITS.has(offsetUnit))
      || (offsetValue !== null && (!Number.isFinite(offsetValue) || offsetValue < 0))
      || typeof output.recurring !== "boolean"
      || (contractDate && !DATE_PATTERN.test(contractDate))) {
    throw lineageError("contracts_decision_lineage_request_invalid", `outputs[${index}] contains invalid controlled fields.`);
  }
  if (temporalKind === "fixed" && !contractDate) {
    throw lineageError("contracts_decision_lineage_request_invalid", `outputs[${index}] requires a fixed contract date.`);
  }
  if (["relative", "recurring"].includes(temporalKind)
      && (!triggerDescriptionHe || !HEBREW_PATTERN.test(triggerDescriptionHe) || offsetValue === null || !offsetUnit)) {
    throw lineageError(
      "contracts_decision_lineage_request_invalid",
      `outputs[${index}] requires a Hebrew trigger, non-negative offset, and offset unit.`
    );
  }
  return {
    primaryClauseId,
    sourceClauseIds,
    titleHe: boundedText(output.titleHe, `outputs[${index}].titleHe`, { min: 5, max: 1_000, hebrew: true }),
    summaryHe: boundedText(output.summaryHe, `outputs[${index}].summaryHe`, { min: 10, max: 10_000, hebrew: true }),
    decisionTextHe: boundedText(output.decisionTextHe, `outputs[${index}].decisionTextHe`, { min: 10, max: 20_000, hebrew: true }),
    tags,
    responsibleParty: boundedText(output.responsibleParty, `outputs[${index}].responsibleParty`, { max: 300, optional: true }),
    beneficiary: boundedText(output.beneficiary, `outputs[${index}].beneficiary`, { max: 300, optional: true }),
    decisionCategory,
    conflictStatus,
    scheduleImpact,
    temporalKind,
    contractDate,
    triggerKind: boundedText(output.triggerKind, `outputs[${index}].triggerKind`, { max: 120, optional: true }),
    triggerDescriptionHe,
    offsetValue,
    offsetUnit,
    calendarSemantics,
    recurring: output.recurring
  };
}

function parseReason(value) {
  return boundedText(value, "reasonHe", { min: 10, max: 1_000, hebrew: true });
}

function uniqueSources(sources) {
  if (new Set(sources.map((source) => source.decisionId)).size !== sources.length) {
    throw lineageError("contracts_decision_lineage_request_invalid", "The merge source decisions must be unique.");
  }
  return sources;
}

function mapWorkspaceError(error) {
  const mapping = {
    contracts_workspace_migration_missing: [
      "contracts_decision_lineage_migration_missing",
      "The R4.2C decision lineage migration is not available in KAPAIM.",
      503
    ],
    contracts_workspace_draft_stale: [
      "contracts_decision_lineage_stale",
      "A selected decision changed in another review session. Reload before saving the split or merge.",
      409
    ],
    contracts_workspace_conflict: [
      "contracts_decision_lineage_conflict",
      "KAPAIM rejected the split or merge because its evidence or lineage conflicts with current truth.",
      409
    ],
    contracts_workspace_rpc_failed: [
      "contracts_decision_lineage_rpc_failed",
      "KAPAIM rejected the decision lineage request.",
      error?.status || 502
    ]
  };
  const mapped = mapping[error?.code];
  return mapped ? lineageError(mapped[0], mapped[1], mapped[2], error) : error;
}

function assertStatus(value) {
  if (!value
      || value.agentVersion !== CONTRACTS_DECISION_LINEAGE_AGENT_VERSION
      || value.decisionPolicyVersion !== "contracts-decisions-normalization.r4.2b.v1"
      || value.supportRelationshipPolicyVersion !== "contracts-decision-support.r4.2b.v1"
      || value.lineageRelationshipPolicyVersion !== CONTRACTS_DECISION_LINEAGE_POLICY_VERSION
      || value.migrationVersion !== CONTRACTS_DECISION_LINEAGE_MIGRATION_VERSION
      || value.scope !== "audited_decision_split_merge_and_lineage"
      || value.splitEnabled !== true
      || value.mergeEnabled !== true
      || value.humanReviewRequired !== true
      || value.conflictWinnerSelectionEnabled !== false
      || value.modelCallsEnabled !== false
      || value.scheduleWritesEnabled !== false) {
    throw lineageError(
      "contracts_decision_lineage_response_invalid",
      "The R4.2C decision lineage migration version is unsupported.",
      502
    );
  }
  return value;
}

function assertProjection(value, { action = null } = {}) {
  const lineage = value?.lineage;
  assertStatus({
    ...lineage,
    lineageRelationshipPolicyVersion: lineage?.relationshipPolicyVersion,
    splitEnabled: lineage?.gates?.splitEnabled,
    mergeEnabled: lineage?.gates?.mergeEnabled,
    humanReviewRequired: lineage?.gates?.humanReviewRequired,
    conflictWinnerSelectionEnabled: lineage?.gates?.conflictWinnerSelectionEnabled,
    modelCallsEnabled: lineage?.gates?.modelCallsEnabled,
    scheduleWritesEnabled: lineage?.gates?.scheduleWritesEnabled
  });
  if (!UUID_PATTERN.test(String(value?.workspace?.workspaceId || ""))
      || !Array.isArray(value?.items)
      || !value?.metrics
      || Number(value.metrics.scheduleWriteCount) !== 0
      || value.items.some((item) => !UUID_PATTERN.test(String(item?.decisionId || ""))
        || !REVIEW_STATUSES.has(item?.reviewStatus)
        || !Number.isSafeInteger(Number(item?.revision))
        || !Array.isArray(item?.sourceEvidence)
        || item.sourceEvidence.length < 1)
      || !Array.isArray(lineage?.links)
      || Number(lineage?.metrics?.modelCallCount) !== 0
      || Number(lineage?.metrics?.scheduleWriteCount) !== 0
      || Number(lineage?.metrics?.incompleteLineageCount) !== 0
      || lineage.links.some((link) => !UUID_PATTERN.test(String(link?.relationshipId || ""))
        || !["split_into", "merged_into"].includes(link?.relationshipType)
        || !UUID_PATTERN.test(String(link?.sourceDecisionId || ""))
        || !UUID_PATTERN.test(String(link?.targetDecisionId || "")))) {
    throw lineageError("contracts_decision_lineage_response_invalid", "The R4.2C lineage response is invalid.", 502);
  }
  if (action) {
    const mutation = value?.lineageMutation;
    if (!mutation
        || mutation.action !== action
        || mutation.atomic !== true
        || Number(mutation.modelCallCount) !== 0
        || Number(mutation.scheduleWriteCount) !== 0
        || !Array.isArray(mutation.sourceDecisionIds)
        || !Array.isArray(mutation.terminalDecisionIds)
        || !Array.isArray(mutation.outputDecisionIds)
        || Number(mutation.lineageInserted) < 2) {
      throw lineageError("contracts_decision_lineage_response_invalid", "The R4.2C lineage mutation is incomplete.", 502);
    }
  }
  return value;
}

export function contractsDecisionLineageApproved(env = process.env) {
  return String(env.CONTRACTS_DECISION_LINEAGE_R4_2C_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function parseContractsDecisionSplitRequest(value, decisionId) {
  const body = exactObject(value, new Set(["expectedRevision", "reasonHe", "outputs"]), "split request");
  if (!Array.isArray(body.outputs) || body.outputs.length < 2 || body.outputs.length > 10) {
    throw lineageError("contracts_decision_lineage_request_invalid", "A split requires 2-10 output decisions.");
  }
  return {
    action: "split",
    reasonHe: parseReason(body.reasonHe),
    sources: [{
      decisionId: uuid(decisionId, "decisionId"),
      expectedRevision: expectedRevision(body.expectedRevision)
    }],
    outputs: body.outputs.map(parseOutput)
  };
}

export function parseContractsDecisionMergeRequest(value) {
  const body = exactObject(value, new Set(["sources", "reasonHe", "output"]), "merge request");
  if (!Array.isArray(body.sources) || body.sources.length < 2 || body.sources.length > 10) {
    throw lineageError("contracts_decision_lineage_request_invalid", "A merge requires 2-10 source decisions.");
  }
  return {
    action: "merge",
    reasonHe: parseReason(body.reasonHe),
    sources: uniqueSources(body.sources.map(parseSource)),
    outputs: [parseOutput(body.output, 0)]
  };
}

export async function loadContractsDecisionLineageStatus({
  config,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsDecisionLineageApproved(env)) {
    return {
      active: true,
      ready: false,
      applyApproved: false,
      agentVersion: CONTRACTS_DECISION_LINEAGE_AGENT_VERSION,
      lineageRelationshipPolicyVersion: CONTRACTS_DECISION_LINEAGE_POLICY_VERSION,
      migrationVersion: CONTRACTS_DECISION_LINEAGE_MIGRATION_VERSION,
      splitEnabled: false,
      mergeEnabled: false,
      humanReviewRequired: true,
      conflictWinnerSelectionEnabled: false,
      modelCallsEnabled: false,
      scheduleWritesEnabled: false,
      reason: "activation_not_approved"
    };
  }
  try {
    return {
      active: true,
      ready: true,
      applyApproved: true,
      ...assertStatus(await workspaceRpc({
        config,
        rpc: CONTRACTS_DECISION_LINEAGE_STATUS_RPC,
        fetchImpl,
        timeoutMs
      })),
      reason: null
    };
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function loadContractsDecisionLineageReview({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  try {
    const projection = await workspaceRpc({
      config,
      rpc: CONTRACTS_DECISION_LINEAGE_GET_RPC,
      payload: { p_workspace_id: parseContractsClauseWorkspaceId(workspaceId) },
      fetchImpl,
      timeoutMs
    });
    if (!projection) {
      throw lineageError("contracts_decision_lineage_workspace_not_found", "The saved clause workspace was not found.", 404);
    }
    return assertProjection(projection);
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

async function applyLineageAction({
  config,
  workspaceId,
  reviewerId,
  request,
  env,
  fetchImpl,
  timeoutMs
}) {
  if (!contractsDecisionLineageApproved(env)) {
    throw lineageError("contracts_decision_lineage_not_enabled", "R4.2C is not enabled on this server.", 503);
  }
  try {
    const projection = await workspaceRpc({
      config,
      rpc: CONTRACTS_DECISION_LINEAGE_APPLY_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_reviewer_id: uuid(reviewerId, "reviewerId"),
        p_action: request.action,
        p_reason_he: request.reasonHe,
        p_sources: request.sources,
        p_outputs: request.outputs
      },
      fetchImpl,
      timeoutMs
    });
    return assertProjection(projection, { action: request.action });
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function splitContractsDecision({
  config,
  workspaceId,
  decisionId,
  body,
  reviewerId,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  return applyLineageAction({
    config,
    workspaceId,
    reviewerId,
    request: parseContractsDecisionSplitRequest(body, decisionId),
    env,
    fetchImpl,
    timeoutMs
  });
}

export async function mergeContractsDecisions({
  config,
  workspaceId,
  body,
  reviewerId,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  return applyLineageAction({
    config,
    workspaceId,
    reviewerId,
    request: parseContractsDecisionMergeRequest(body),
    env,
    fetchImpl,
    timeoutMs
  });
}
