import { ContractsAgentError } from "./errors.js";
import { parseContractsClauseWorkspaceId } from "./clausePersistence.js";
import {
  CONTRACTS_RELATIONSHIPS_R4_1_MODEL_SCHEMA_VERSION,
  CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION,
  CONTRACTS_RELATIONSHIPS_R4_1_VERIFIER_SCHEMA_VERSION
} from "./semanticRelationships.js";
import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_RELATIONSHIP_REVIEW_AGENT_VERSION = "contracts-relationships-agent.r4.2a.v1";
export const CONTRACTS_RELATIONSHIP_REVIEW_MIGRATION_VERSION = "20260817093931";
export const CONTRACTS_RELATIONSHIP_REVIEW_STATUS_RPC = "bidoc_contracts_relationship_review_status_r4_2a";
export const CONTRACTS_RELATIONSHIP_REVIEW_GET_RPC = "bidoc_contracts_get_relationship_review_r4_2a";
export const CONTRACTS_RELATIONSHIP_REVIEW_PERSIST_RPC = "bidoc_contracts_persist_semantic_relationships_r4_2a";
export const CONTRACTS_RELATIONSHIP_REVIEW_APPLY_RPC = "bidoc_contracts_review_semantic_relationship_r4_2a";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const HEBREW_PATTERN = /[\u0590-\u05ff]/u;
const RELATIONSHIP_TYPES = new Set([
  "supports_same_decision",
  "depends_on",
  "condition_of",
  "exception_to",
  "amends",
  "duplicates",
  "conflicts_with"
]);
const REVIEW_ACTIONS = new Set(["approve", "reject", "correct"]);
const REVIEW_STATUSES = new Set(["proposed", "approved", "corrected", "rejected", "superseded"]);

function reviewError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function exactObject(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw reviewError("contracts_relationship_review_request_invalid", `${label} must be an object.`);
  }
  const unsupported = Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
  if (unsupported.length) {
    throw reviewError(
      "contracts_relationship_review_request_invalid",
      `${label} contains an unsupported field: ${unsupported[0]}.`
    );
  }
  return value;
}

function uuid(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw reviewError("contracts_relationship_review_request_invalid", `${field} must be a UUID.`);
  }
  return normalized;
}

function boundedText(value, field, { min = 1, max = 200 } = {}) {
  const normalized = String(value || "").trim();
  if (normalized.length < min || normalized.length > max) {
    throw reviewError(
      "contracts_relationship_review_request_invalid",
      `${field} must contain between ${min} and ${max} characters.`
    );
  }
  return normalized;
}

function confidence(value, field) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw reviewError("contracts_relationship_review_response_invalid", `${field} is invalid.`, 502);
  }
  return normalized;
}

function mapWorkspaceError(error) {
  const mapping = {
    contracts_workspace_migration_missing: [
      "contracts_relationship_review_migration_missing",
      "The R4.2A relationship review migration is not available in KAPAIM.",
      503
    ],
    contracts_workspace_draft_stale: [
      "contracts_relationship_review_stale",
      "The relationship proposal changed in another review session. Reload it before saving.",
      409
    ],
    contracts_workspace_conflict: [
      "contracts_relationship_review_conflict",
      "The relationship review conflicts with a newer or existing relationship.",
      409
    ],
    contracts_workspace_rpc_failed: [
      "contracts_relationship_review_rpc_failed",
      "KAPAIM rejected the relationship review request.",
      error?.status || 502
    ]
  };
  const mapped = mapping[error?.code];
  if (!mapped) return error;
  return reviewError(mapped[0], mapped[1], mapped[2], error);
}

export function contractsRelationshipReviewApproved(env = process.env) {
  return String(env.CONTRACTS_RELATIONSHIPS_R4_2A_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function parseContractsRelationshipReviewRequest(value) {
  const body = exactObject(
    value,
    new Set(["expectedRevision", "action", "reasonHe", "correction"]),
    "relationship review request"
  );
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw reviewError("contracts_relationship_review_request_invalid", "expectedRevision must be a positive integer.");
  }
  const action = String(body.action || "").trim();
  if (!REVIEW_ACTIONS.has(action)) {
    throw reviewError("contracts_relationship_review_request_invalid", "The relationship review action is unsupported.");
  }
  const reasonHe = boundedText(body.reasonHe, "reasonHe", { min: 10, max: 1_000 });
  if (!HEBREW_PATTERN.test(reasonHe)) {
    throw reviewError("contracts_relationship_review_request_invalid", "reasonHe must contain a Hebrew review explanation.");
  }
  let correction = null;
  if (action === "correct") {
    const input = exactObject(
      body.correction,
      new Set(["relationshipType", "sourceClauseKey", "targetClauseKey"]),
      "relationship correction"
    );
    const relationshipType = String(input.relationshipType || "").trim();
    if (!RELATIONSHIP_TYPES.has(relationshipType)) {
      throw reviewError("contracts_relationship_review_request_invalid", "The corrected relationship type is unsupported.");
    }
    const sourceClauseKey = boundedText(input.sourceClauseKey, "correction.sourceClauseKey");
    const targetClauseKey = boundedText(input.targetClauseKey, "correction.targetClauseKey");
    if (sourceClauseKey === targetClauseKey) {
      throw reviewError("contracts_relationship_review_request_invalid", "A relationship cannot point to the same clause.");
    }
    correction = { relationshipType, sourceClauseKey, targetClauseKey };
  } else if (body.correction !== undefined) {
    throw reviewError(
      "contracts_relationship_review_request_invalid",
      "Only a correction action may include corrected relationship fields."
    );
  }
  return { expectedRevision, action, reasonHe, correction };
}

export async function loadContractsRelationshipReviewStatus({
  config,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsRelationshipReviewApproved(env)) {
    return {
      active: true,
      ready: false,
      applyApproved: false,
      agentVersion: CONTRACTS_RELATIONSHIP_REVIEW_AGENT_VERSION,
      relationshipPolicyVersion: CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION,
      migrationVersion: CONTRACTS_RELATIONSHIP_REVIEW_MIGRATION_VERSION,
      scope: "verified_semantic_proposals_and_human_review",
      proposalPersistenceEnabled: false,
      humanReviewEnabled: false,
      decisionCreationEnabled: false,
      conflictResolutionEnabled: false,
      scheduleWritesEnabled: false,
      reason: "activation_not_approved"
    };
  }
  try {
    const status = await workspaceRpc({
      config,
      rpc: CONTRACTS_RELATIONSHIP_REVIEW_STATUS_RPC,
      fetchImpl,
      timeoutMs
    });
    return { active: true, ready: true, applyApproved: true, ...assertStatus(status) };
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function loadContractsRelationshipReview({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  try {
    const projection = await workspaceRpc({
      config,
      rpc: CONTRACTS_RELATIONSHIP_REVIEW_GET_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_relationship_policy_version: CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION
      },
      fetchImpl,
      timeoutMs
    });
    if (!projection) {
      throw reviewError("contracts_relationship_review_workspace_not_found", "The saved clause workspace was not found.", 404);
    }
    return assertProjection(projection);
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function persistContractsSemanticRelationshipProposals({
  config,
  workspaceId,
  semanticResult,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsRelationshipReviewApproved(env)) {
    throw reviewError(
      "contracts_relationship_review_not_enabled",
      "R4.2A relationship proposal persistence is not enabled on this server.",
      503
    );
  }
  const proposals = assertCompleteSemanticResult(semanticResult).proposals.map(toPersistenceProposal);
  try {
    const projection = await workspaceRpc({
      config,
      rpc: CONTRACTS_RELATIONSHIP_REVIEW_PERSIST_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_relationship_policy_version: semanticResult.relationshipPolicyVersion,
        p_prompt_version: semanticResult.promptVersion,
        p_model_version: semanticResult.modelVersion,
        p_proposals: proposals
      },
      fetchImpl,
      timeoutMs
    });
    return assertProjection(projection, { persistenceRequired: true });
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function reviewContractsSemanticRelationship({
  config,
  workspaceId,
  relationshipId,
  body,
  reviewerId,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsRelationshipReviewApproved(env)) {
    throw reviewError(
      "contracts_relationship_review_not_enabled",
      "R4.2A relationship review is not enabled on this server.",
      503
    );
  }
  const request = parseContractsRelationshipReviewRequest(body);
  try {
    const projection = await workspaceRpc({
      config,
      rpc: CONTRACTS_RELATIONSHIP_REVIEW_APPLY_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_relationship_id: uuid(relationshipId, "relationshipId"),
        p_expected_revision: request.expectedRevision,
        p_reviewer_id: uuid(reviewerId, "reviewerId"),
        p_action: request.action,
        p_reason_he: request.reasonHe,
        p_correction: request.correction
      },
      fetchImpl,
      timeoutMs
    });
    return assertProjection(projection, { reviewRequired: true });
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

function assertStatus(value) {
  if (!value
      || value.agentVersion !== CONTRACTS_RELATIONSHIP_REVIEW_AGENT_VERSION
      || value.relationshipPolicyVersion !== CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION
      || value.migrationVersion !== CONTRACTS_RELATIONSHIP_REVIEW_MIGRATION_VERSION
      || value.scope !== "verified_semantic_proposals_and_human_review"
      || value.proposalPersistenceEnabled !== true
      || value.humanReviewEnabled !== true
      || value.decisionCreationEnabled !== false
      || value.conflictResolutionEnabled !== false
      || value.scheduleWritesEnabled !== false) {
    throw reviewError(
      "contracts_relationship_review_response_invalid",
      "The R4.2A relationship review migration version is unsupported.",
      502
    );
  }
  return value;
}

function assertCompleteSemanticResult(value) {
  if (!value
      || value.agentVersion !== "contracts-relationships-agent.r4.1.v3"
      || value.relationshipPolicyVersion !== CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION
      || value.scope !== "same_generation_semantic_clause_pairs"
      || !Array.isArray(value.proposals)
      || value.proposals.length > 50
      || value.metrics?.classificationComplete !== true
      || value.metrics?.verificationComplete !== true
      || value.metrics?.modelRelationshipCount !== value.proposals.length
      || value.metrics?.decisionCount !== 0
      || value.metrics?.persistenceWriteCount !== 0
      || value.metrics?.scheduleWriteCount !== 0
      || value.gates?.relationshipPersistenceEnabled !== false
      || value.gates?.decisionCreationEnabled !== false
      || value.gates?.conflictResolutionEnabled !== false
      || value.gates?.scheduleWritesEnabled !== false) {
    throw reviewError(
      "contracts_relationship_review_analysis_incomplete",
      "Only a complete, verified R4.1 result can be persisted for review.",
      422
    );
  }
  return value;
}

function toPersistenceProposal(value) {
  const proposal = exactObject(value, new Set([
    "proposalKey", "relationshipType", "relationshipTypeLabelHe", "origin", "originLabelHe",
    "confidence", "classifierConfidence", "verificationConfidence", "verificationSchemaVersion",
    "reviewStatus", "reviewStatusLabelHe", "sourceClauseKey", "sourceClauseOrder",
    "sourceSummaryHe", "sourcePageStart", "sourcePageEnd", "sourceExcerpt", "targetClauseKey",
    "targetClauseOrder", "targetSummaryHe", "targetPageStart", "targetPageEnd", "targetExcerpt",
    "rationaleHe", "retrieval", "relationshipPolicyVersion", "promptVersion", "modelVersion"
  ]), "semantic proposal");
  if (!SHA256_PATTERN.test(String(proposal.proposalKey || ""))
      || !RELATIONSHIP_TYPES.has(proposal.relationshipType)
      || proposal.origin !== "model"
      || proposal.reviewStatus !== "proposed"
      || proposal.relationshipPolicyVersion !== CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION
      || proposal.verificationSchemaVersion !== CONTRACTS_RELATIONSHIPS_R4_1_VERIFIER_SCHEMA_VERSION
      || !proposal.retrieval
      || typeof proposal.retrieval !== "object"
      || Array.isArray(proposal.retrieval)) {
    throw reviewError("contracts_relationship_review_response_invalid", "An R4.1 proposal is invalid.", 502);
  }
  const finalConfidence = confidence(proposal.confidence, "proposal.confidence");
  const classifierConfidence = confidence(proposal.classifierConfidence, "proposal.classifierConfidence");
  const verificationConfidence = confidence(proposal.verificationConfidence, "proposal.verificationConfidence");
  if (finalConfidence > classifierConfidence || finalConfidence > verificationConfidence) {
    throw reviewError("contracts_relationship_review_response_invalid", "An R4.1 proposal confidence is invalid.", 502);
  }
  return {
    proposalKey: proposal.proposalKey,
    relationshipType: proposal.relationshipType,
    sourceClauseKey: boundedText(proposal.sourceClauseKey, "proposal.sourceClauseKey"),
    targetClauseKey: boundedText(proposal.targetClauseKey, "proposal.targetClauseKey"),
    confidence: finalConfidence,
    classifierConfidence,
    verificationConfidence,
    verificationSchemaVersion: CONTRACTS_RELATIONSHIPS_R4_1_VERIFIER_SCHEMA_VERSION,
    rationaleHe: boundedText(proposal.rationaleHe, "proposal.rationaleHe", { min: 8, max: 240 }),
    retrieval: proposal.retrieval
  };
}

function assertProjection(value, { persistenceRequired = false, reviewRequired = false } = {}) {
  assertStatus({
    ...value,
    proposalPersistenceEnabled: value?.gates?.proposalPersistenceEnabled,
    humanReviewEnabled: value?.gates?.humanReviewEnabled,
    decisionCreationEnabled: value?.gates?.decisionCreationEnabled,
    conflictResolutionEnabled: value?.gates?.conflictResolutionEnabled,
    scheduleWritesEnabled: value?.gates?.scheduleWritesEnabled
  });
  if (!UUID_PATTERN.test(String(value?.workspace?.workspaceId || ""))
      || !Array.isArray(value.items)
      || !value.metrics
      || Number(value.metrics.scheduleWriteCount) !== 0
      || !Number.isSafeInteger(Number(value.metrics.decisionCount))
      || Number(value.metrics.decisionCount) < 0
      || value.items.some((item) => !UUID_PATTERN.test(String(item?.relationshipId || ""))
        || !RELATIONSHIP_TYPES.has(item?.relationshipType)
        || !["model", "human"].includes(item?.origin)
        || !REVIEW_STATUSES.has(item?.reviewStatus)
        || !Number.isSafeInteger(Number(item?.revision))
        || Number(item.revision) < 1
        || !item?.evidence
        || item.evidence?.signals?.schemaVersion !== "contracts-relationship-signals.r4.2a.v1")
      || (persistenceRequired && value?.persistence?.atomic !== true)
      || (reviewRequired && value?.review?.atomic !== true)) {
    throw reviewError(
      "contracts_relationship_review_response_invalid",
      "The R4.2A relationship review response is invalid.",
      502
    );
  }
  return value;
}

export const CONTRACTS_RELATIONSHIP_REVIEW_MODEL_SCHEMA_VERSION = CONTRACTS_RELATIONSHIPS_R4_1_MODEL_SCHEMA_VERSION;
