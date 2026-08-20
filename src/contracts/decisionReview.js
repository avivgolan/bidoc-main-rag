import { ContractsAgentError } from "./errors.js";
import { getSavedContractsClauseWorkspace, parseContractsClauseWorkspaceId } from "./clausePersistence.js";
import { loadContractsRelationshipReview } from "./semanticRelationshipReview.js";
import {
  CONTRACTS_DECISION_CATEGORIES,
  CONTRACTS_DECISIONS_R4_2B_AGENT_VERSION,
  CONTRACTS_DECISIONS_R4_2B_POLICY_VERSION,
  CONTRACTS_DECISIONS_R4_2B_PROMPT_VERSION,
  CONTRACTS_DECISION_SUPPORT_POLICY_VERSION,
  runContractsDecisionNormalization
} from "./decisionNormalization.js";
import { workspaceRpc } from "./workspacePersistence.js";
import {
  CONTRACTS_R6_PHASE3_DECISION_PERSISTENCE_RPC,
  CONTRACTS_R6_PHASE3_DECISION_REVIEW_RPC,
  contractsR6Phase3Approved,
  loadContractsR6ActiveCatalog,
  persistContractsR6Embeddings
} from "./r6Preparation.js";

export const CONTRACTS_DECISION_REVIEW_MIGRATION_VERSION = "20260817121000";
export const CONTRACTS_DECISION_REVIEW_STATUS_RPC = "bidoc_contracts_decision_review_status_r4_2b";
export const CONTRACTS_DECISION_REVIEW_GET_RPC = "bidoc_contracts_get_decision_review_r4_2b";
export const CONTRACTS_DECISION_REVIEW_PERSIST_RPC = "bidoc_contracts_persist_decisions_r4_2b";
export const CONTRACTS_DECISION_REVIEW_APPLY_RPC = "bidoc_contracts_review_decision_r4_2b";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const HEBREW_PATTERN = /[\u0590-\u05ff]/u;
const DECISION_CATEGORY_SET = new Set(CONTRACTS_DECISION_CATEGORIES);
const REVIEW_ACTIONS = new Set(["approve", "reject", "correct", "unresolved"]);
const REVIEW_STATUSES = new Set(["proposed", "approved", "corrected", "rejected", "split", "merged", "superseded", "unresolved"]);
const TEMPORAL_KINDS = new Set(["none", "fixed", "relative", "recurring", "extension", "consequence"]);
const OFFSET_UNITS = new Set(["hours", "calendar_days", "working_days", "weeks", "months"]);
const CALENDAR_SEMANTICS = new Set(["explicit", "reviewed", "unknown", "not_applicable"]);

function decisionReviewError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function exactObject(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw decisionReviewError("contracts_decision_review_request_invalid", `${label} must be an object.`);
  }
  const unsupported = Object.keys(value).filter((key) => !allowedKeys.has(key)).sort();
  if (unsupported.length) {
    throw decisionReviewError(
      "contracts_decision_review_request_invalid",
      `${label} contains an unsupported field: ${unsupported[0]}.`
    );
  }
  return value;
}

function uuid(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw decisionReviewError("contracts_decision_review_request_invalid", `${field} must be a UUID.`);
  }
  return normalized;
}

function boundedText(value, field, { min = 1, max = 200, optional = false } = {}) {
  const normalized = String(value ?? "").trim();
  if (optional && !normalized) return null;
  if (normalized.length < min || normalized.length > max) {
    throw decisionReviewError(
      "contracts_decision_review_request_invalid",
      `${field} must contain between ${min} and ${max} characters.`
    );
  }
  return normalized;
}

function mapWorkspaceError(error) {
  const mapping = {
    contracts_workspace_migration_missing: [
      "contracts_decision_review_migration_missing",
      "The R4.2B decision review migration is not available in KAPAIM.",
      503
    ],
    contracts_workspace_draft_stale: [
      "contracts_decision_review_stale",
      "The decision proposal changed in another review session. Reload it before saving.",
      409
    ],
    contracts_workspace_conflict: [
      "contracts_decision_review_conflict",
      "The decision review conflicts with a newer or existing decision.",
      409
    ],
    contracts_workspace_rpc_failed: [
      "contracts_decision_review_rpc_failed",
      "KAPAIM rejected the decision review request.",
      error?.status || 502
    ]
  };
  const mapped = mapping[error?.code];
  return mapped ? decisionReviewError(mapped[0], mapped[1], mapped[2], error) : error;
}

export function contractsDecisionReviewApproved(env = process.env) {
  return String(env.CONTRACTS_DECISIONS_R4_2B_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function parseContractsDecisionProposalRequest(value) {
  const body = value === null || value === undefined ? {} : value;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) {
    throw decisionReviewError(
      "contracts_decision_review_request_invalid",
      "R4.2B accepts no browser-supplied clauses, relationships, model settings, decision proposals, or database settings."
    );
  }
  return {};
}

export function parseContractsDecisionReviewRequest(value) {
  const body = exactObject(
    value,
    new Set(["expectedRevision", "action", "reasonHe", "correction"]),
    "decision review request"
  );
  const expectedRevision = Number(body.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw decisionReviewError("contracts_decision_review_request_invalid", "expectedRevision must be a positive integer.");
  }
  const action = String(body.action || "").trim();
  if (!REVIEW_ACTIONS.has(action)) {
    throw decisionReviewError("contracts_decision_review_request_invalid", "The decision review action is unsupported.");
  }
  const reasonHe = boundedText(body.reasonHe, "reasonHe", { min: 10, max: 1_000 });
  if (!HEBREW_PATTERN.test(reasonHe)) {
    throw decisionReviewError("contracts_decision_review_request_invalid", "reasonHe must contain a Hebrew review explanation.");
  }
  let correction = null;
  if (action === "correct") {
    const input = exactObject(
      body.correction,
      new Set([
        "titleHe", "summaryHe", "decisionTextHe", "responsibleParty", "beneficiary",
        "decisionCategory", "conflictStatus", "scheduleImpact", "temporalKind", "contractDate",
        "triggerKind", "triggerDescriptionHe", "offsetValue", "offsetUnit",
        "calendarSemantics", "recurring"
      ]),
      "decision correction"
    );
    const titleHe = boundedText(input.titleHe, "correction.titleHe", { min: 5, max: 1_000 });
    const summaryHe = boundedText(input.summaryHe, "correction.summaryHe", { min: 10, max: 10_000 });
    const decisionTextHe = boundedText(input.decisionTextHe, "correction.decisionTextHe", { min: 10, max: 20_000 });
    if (![titleHe, summaryHe, decisionTextHe].every((item) => HEBREW_PATTERN.test(item))) {
      throw decisionReviewError("contracts_decision_review_request_invalid", "Corrected decision text must be in Hebrew.");
    }
    const decisionCategory = String(input.decisionCategory || "");
    const conflictStatus = String(input.conflictStatus || "");
    const scheduleImpact = String(input.scheduleImpact || "");
    const temporalKind = String(input.temporalKind || "");
    const offsetUnit = input.offsetUnit ? String(input.offsetUnit) : null;
    const calendarSemantics = String(input.calendarSemantics || "");
    const offsetValue = input.offsetValue === null || input.offsetValue === "" ? null : Number(input.offsetValue);
    if (!DECISION_CATEGORY_SET.has(decisionCategory)
        || !["none", "detected", "reviewed", "unresolved"].includes(conflictStatus)
        || !["yes", "no", "unknown"].includes(scheduleImpact)
        || !TEMPORAL_KINDS.has(temporalKind)
        || (offsetUnit && !OFFSET_UNITS.has(offsetUnit))
        || !CALENDAR_SEMANTICS.has(calendarSemantics)
        || (offsetValue !== null && (!Number.isFinite(offsetValue) || offsetValue < 0))
        || typeof input.recurring !== "boolean") {
      throw decisionReviewError("contracts_decision_review_request_invalid", "The corrected controlled decision fields are invalid.");
    }
    correction = {
      titleHe,
      summaryHe,
      decisionTextHe,
      responsibleParty: boundedText(input.responsibleParty, "correction.responsibleParty", { max: 300, optional: true }),
      beneficiary: boundedText(input.beneficiary, "correction.beneficiary", { max: 300, optional: true }),
      decisionCategory,
      conflictStatus,
      scheduleImpact,
      temporalKind,
      contractDate: boundedText(input.contractDate, "correction.contractDate", { max: 10, optional: true }),
      triggerKind: boundedText(input.triggerKind, "correction.triggerKind", { max: 120, optional: true }),
      triggerDescriptionHe: boundedText(input.triggerDescriptionHe, "correction.triggerDescriptionHe", { max: 700, optional: true }),
      offsetValue,
      offsetUnit,
      calendarSemantics,
      recurring: input.recurring
    };
  } else if (body.correction !== undefined) {
    throw decisionReviewError(
      "contracts_decision_review_request_invalid",
      "Only a correction action may include corrected decision fields."
    );
  }
  return { expectedRevision, action, reasonHe, correction };
}

export async function loadContractsDecisionReviewStatus({
  config,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const approved = contractsDecisionReviewApproved(env);
  const modelConfigured = Boolean(config?.openRouterApiKey);
  if (!approved) {
    return {
      active: true,
      ready: false,
      applyApproved: false,
      modelConfigured,
      agentVersion: CONTRACTS_DECISIONS_R4_2B_AGENT_VERSION,
      decisionPolicyVersion: CONTRACTS_DECISIONS_R4_2B_POLICY_VERSION,
      supportRelationshipPolicyVersion: CONTRACTS_DECISION_SUPPORT_POLICY_VERSION,
      promptVersion: CONTRACTS_DECISIONS_R4_2B_PROMPT_VERSION,
      migrationVersion: CONTRACTS_DECISION_REVIEW_MIGRATION_VERSION,
      scope: "reviewed_relationships_to_normalized_decision_proposals",
      decisionPersistenceEnabled: false,
      humanReviewEnabled: false,
      conflictWinnerSelectionEnabled: false,
      scheduleWritesEnabled: false,
      reason: "activation_not_approved"
    };
  }
  try {
    const status = assertStatus(await workspaceRpc({
      config,
      rpc: CONTRACTS_DECISION_REVIEW_STATUS_RPC,
      fetchImpl,
      timeoutMs
    }));
    return {
      active: true,
      ready: modelConfigured,
      applyApproved: true,
      modelConfigured,
      ...status,
      reason: modelConfigured ? null : "model_key_missing"
    };
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function loadContractsDecisionReview({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  try {
    const projection = await workspaceRpc({
      config,
      rpc: CONTRACTS_DECISION_REVIEW_GET_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_decision_policy_version: CONTRACTS_DECISIONS_R4_2B_POLICY_VERSION
      },
      fetchImpl,
      timeoutMs
    });
    if (!projection) {
      throw decisionReviewError("contracts_decision_review_workspace_not_found", "The saved clause workspace was not found.", 404);
    }
    return assertProjection(projection);
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function generateAndPersistContractsDecisions({
  config,
  workspaceId,
  body = {},
  env = process.env,
  fetchImpl = fetch,
  chatComplete,
  deadlineAt,
  signal,
  logger = console
} = {}) {
  parseContractsDecisionProposalRequest(body);
  if (!contractsDecisionReviewApproved(env)) {
    throw decisionReviewError(
      "contracts_decision_review_not_enabled",
      "R4.2B decision persistence and review are not enabled on this server.",
      503
    );
  }
  if (!config?.openRouterApiKey) {
    throw decisionReviewError(
      "contracts_decision_normalization_unavailable",
      "R4.2B requires the configured server-side model key.",
      503
    );
  }
  const normalizedWorkspaceId = parseContractsClauseWorkspaceId(workspaceId);
  const r6Enabled = contractsR6Phase3Approved(env);
  const r6Catalog = r6Enabled
    ? await loadContractsR6ActiveCatalog({ config, fetchImpl, timeoutMs: remainingMs(deadlineAt) })
    : null;
  const current = await loadContractsDecisionReview({
    config,
    workspaceId: normalizedWorkspaceId,
    fetchImpl,
    timeoutMs: remainingMs(deadlineAt)
  });
  if (Number(current.metrics?.pendingRelationshipCount) > 0) {
    throw decisionReviewError(
      "contracts_decision_relationship_review_incomplete",
      "Every saved relationship proposal must be reviewed before R4.2B can run.",
      409
    );
  }
  if (Number(current.metrics?.currentDecisionCount) > 0) {
    return { analysis: null, review: current, modelAvoided: true };
  }
  const [saved, relationshipReview] = await Promise.all([
    getSavedContractsClauseWorkspace({
      config,
      workspaceId: normalizedWorkspaceId,
      fetchImpl,
      timeoutMs: remainingMs(deadlineAt)
    }),
    loadContractsRelationshipReview({
      config,
      workspaceId: normalizedWorkspaceId,
      fetchImpl,
      timeoutMs: remainingMs(deadlineAt)
    })
  ]);
  const analysis = await runContractsDecisionNormalization({
    preview: saved.preview,
    relationshipReview,
    config,
    ...(r6Catalog ? { triggerCatalog: r6Catalog.triggers } : {}),
    modelVersion: r6Enabled
      ? config.models?.lite || config.models?.main || "openai/gpt-4o-mini"
      : config.models?.main || config.models?.lite || "openai/gpt-4o",
    ...(chatComplete ? { chatComplete } : {}),
    deadlineAt,
    signal,
    logger
  });
  const review = await persistContractsDecisionProposals({
    config,
    workspaceId: normalizedWorkspaceId,
    normalizationResult: analysis,
    env,
    fetchImpl,
    timeoutMs: remainingMs(deadlineAt)
  });
  return { analysis, review, modelAvoided: false };
}

export async function persistContractsDecisionProposals({
  config,
  workspaceId,
  normalizationResult,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsDecisionReviewApproved(env)) {
    throw decisionReviewError("contracts_decision_review_not_enabled", "R4.2B is not enabled on this server.", 503);
  }
  const proposals = assertCompleteNormalization(normalizationResult).proposals.map(toPersistenceProposal);
  try {
    const projection = await workspaceRpc({
      config,
      rpc: contractsR6Phase3Approved(env)
        ? CONTRACTS_R6_PHASE3_DECISION_PERSISTENCE_RPC
        : CONTRACTS_DECISION_REVIEW_PERSIST_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_decision_policy_version: normalizationResult.decisionPolicyVersion,
        p_model_version: normalizationResult.modelVersion,
        p_proposals: proposals
      },
      fetchImpl,
      timeoutMs
    });
    const accepted = assertProjection(projection, { persistenceRequired: true });
    if (contractsR6Phase3Approved(env)) {
      await persistContractsR6Embeddings({
        config,
        workspaceId: parseContractsClauseWorkspaceId(workspaceId),
        fetchImpl,
        timeoutMs
      });
    }
    return accepted;
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function reviewContractsDecision({
  config,
  workspaceId,
  decisionId,
  body,
  reviewerId,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsDecisionReviewApproved(env)) {
    throw decisionReviewError("contracts_decision_review_not_enabled", "R4.2B is not enabled on this server.", 503);
  }
  const request = parseContractsDecisionReviewRequest(body);
  try {
    const projection = await workspaceRpc({
      config,
      rpc: contractsR6Phase3Approved(env)
        ? CONTRACTS_R6_PHASE3_DECISION_REVIEW_RPC
        : CONTRACTS_DECISION_REVIEW_APPLY_RPC,
      payload: {
        p_workspace_id: parseContractsClauseWorkspaceId(workspaceId),
        p_decision_id: uuid(decisionId, "decisionId"),
        p_expected_revision: request.expectedRevision,
        p_reviewer_id: uuid(reviewerId, "reviewerId"),
        p_action: request.action,
        p_reason_he: request.reasonHe,
        p_correction: request.correction
      },
      fetchImpl,
      timeoutMs
    });
    const accepted = assertProjection(projection, { reviewRequired: true });
    if (contractsR6Phase3Approved(env)) {
      await persistContractsR6Embeddings({
        config,
        workspaceId: parseContractsClauseWorkspaceId(workspaceId),
        fetchImpl,
        timeoutMs
      });
    }
    return accepted;
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

function assertStatus(value) {
  if (!value
      || value.agentVersion !== CONTRACTS_DECISIONS_R4_2B_AGENT_VERSION
      || value.decisionPolicyVersion !== CONTRACTS_DECISIONS_R4_2B_POLICY_VERSION
      || value.supportRelationshipPolicyVersion !== CONTRACTS_DECISION_SUPPORT_POLICY_VERSION
      || value.migrationVersion !== CONTRACTS_DECISION_REVIEW_MIGRATION_VERSION
      || value.scope !== "reviewed_relationships_to_normalized_decision_proposals"
      || value.decisionPersistenceEnabled !== true
      || value.humanReviewEnabled !== true
      || value.conflictWinnerSelectionEnabled !== false
      || value.scheduleWritesEnabled !== false) {
    throw decisionReviewError(
      "contracts_decision_review_response_invalid",
      "The R4.2B decision review migration version is unsupported.",
      502
    );
  }
  return value;
}

function assertCompleteNormalization(value) {
  if (!value
      || value.agentVersion !== CONTRACTS_DECISIONS_R4_2B_AGENT_VERSION
      || value.decisionPolicyVersion !== CONTRACTS_DECISIONS_R4_2B_POLICY_VERSION
      || value.supportRelationshipPolicyVersion !== CONTRACTS_DECISION_SUPPORT_POLICY_VERSION
      || value.scope !== "reviewed_relationships_to_normalized_decision_proposals"
      || !Array.isArray(value.proposals)
      || value.proposals.length < 1
      || value.proposals.length > 200
      || value.metrics?.normalizationComplete !== true
      || value.metrics?.pendingRelationshipCount !== 0
      || value.metrics?.modelDecisionCount !== value.proposals.length
      || value.metrics?.persistenceWriteCount !== 0
      || value.metrics?.scheduleWriteCount !== 0
      || value.gates?.relationshipReviewComplete !== true
      || value.gates?.decisionPersistenceEnabled !== false
      || value.gates?.humanReviewRequired !== true
      || value.gates?.conflictWinnerSelectionEnabled !== false
      || value.gates?.scheduleWritesEnabled !== false) {
    throw decisionReviewError(
      "contracts_decision_normalization_incomplete",
      "Only a complete R4.2B normalization result can be persisted for review.",
      422
    );
  }
  return value;
}

function toPersistenceProposal(value) {
  const allowed = new Set([
    "proposalKey", "decisionKey", "primaryClauseKey", "sourceClauseKeys", "titleHe", "summaryHe",
    "decisionTextHe", "tags", "people", "responsibleParty", "beneficiary", "decisionCategory",
    "conflictStatus", "scheduleImpact", "temporalKind", "contractDate", "triggerKind",
    "triggerDescriptionHe", "offsetValue", "offsetUnit", "calendarSemantics", "recurring",
    "reviewStatus", "projectionStatus", "decisionPolicyVersion", "supportRelationshipPolicyVersion",
    "promptVersion", "modelVersion"
  ]);
  const proposal = exactObject(value, allowed, "decision proposal");
  if (!SHA256_PATTERN.test(String(proposal.proposalKey || ""))
      || !Array.isArray(proposal.sourceClauseKeys)
      || proposal.sourceClauseKeys.length < 1
      || proposal.sourceClauseKeys.length > 20
      || proposal.reviewStatus !== "proposed"
      || proposal.decisionPolicyVersion !== CONTRACTS_DECISIONS_R4_2B_POLICY_VERSION
      || proposal.supportRelationshipPolicyVersion !== CONTRACTS_DECISION_SUPPORT_POLICY_VERSION
      || !DECISION_CATEGORY_SET.has(proposal.decisionCategory)
      || !["none", "unresolved"].includes(proposal.conflictStatus)
      || !["yes", "no", "unknown"].includes(proposal.scheduleImpact)
      || !TEMPORAL_KINDS.has(proposal.temporalKind)
      || !CALENDAR_SEMANTICS.has(proposal.calendarSemantics)
      || typeof proposal.recurring !== "boolean") {
    throw decisionReviewError("contracts_decision_review_response_invalid", "A normalized decision proposal is invalid.", 502);
  }
  return {
    proposalKey: proposal.proposalKey,
    decisionKey: boundedText(proposal.decisionKey, "proposal.decisionKey", { max: 300 }),
    primaryClauseKey: boundedText(proposal.primaryClauseKey, "proposal.primaryClauseKey", { max: 300 }),
    sourceClauseKeys: proposal.sourceClauseKeys.map((key) => boundedText(key, "proposal.sourceClauseKey", { max: 300 })),
    titleHe: boundedText(proposal.titleHe, "proposal.titleHe", { min: 5, max: 1_000 }),
    summaryHe: boundedText(proposal.summaryHe, "proposal.summaryHe", { min: 10, max: 10_000 }),
    decisionTextHe: boundedText(proposal.decisionTextHe, "proposal.decisionTextHe", { min: 10, max: 20_000 }),
    tags: Array.isArray(proposal.tags) ? proposal.tags.slice(0, 12) : [],
    people: [],
    responsibleParty: proposal.responsibleParty || null,
    beneficiary: proposal.beneficiary || null,
    decisionCategory: proposal.decisionCategory,
    conflictStatus: proposal.conflictStatus,
    scheduleImpact: proposal.scheduleImpact,
    temporalKind: proposal.temporalKind,
    contractDate: proposal.contractDate || null,
    triggerKind: proposal.triggerKind || null,
    triggerDescriptionHe: proposal.triggerDescriptionHe || null,
    offsetValue: proposal.offsetValue ?? null,
    offsetUnit: proposal.offsetUnit || null,
    calendarSemantics: proposal.calendarSemantics,
    recurring: proposal.recurring
  };
}

function assertProjection(value, { persistenceRequired = false, reviewRequired = false } = {}) {
  assertStatus({
    ...value,
    decisionPersistenceEnabled: value?.gates?.decisionPersistenceEnabled,
    humanReviewEnabled: value?.gates?.humanReviewEnabled,
    conflictWinnerSelectionEnabled: value?.gates?.conflictWinnerSelectionEnabled,
    scheduleWritesEnabled: value?.gates?.scheduleWritesEnabled
  });
  if (!UUID_PATTERN.test(String(value?.workspace?.workspaceId || ""))
      || !Array.isArray(value.items)
      || !value.metrics
      || Number(value.metrics.scheduleWriteCount) !== 0
      || value.items.some((item) => !UUID_PATTERN.test(String(item?.decisionId || ""))
        || !REVIEW_STATUSES.has(item?.reviewStatus)
        || !DECISION_CATEGORY_SET.has(item?.decisionCategory)
        || !Number.isSafeInteger(Number(item?.revision))
        || Number(item.revision) < 1
        || !Array.isArray(item?.sourceEvidence)
        || item.sourceEvidence.length < 1)
      || (persistenceRequired && value?.persistence?.atomic !== true)
      || (reviewRequired && value?.review?.atomic !== true)) {
    throw decisionReviewError(
      "contracts_decision_review_response_invalid",
      "The R4.2B decision review response is invalid.",
      502
    );
  }
  return value;
}

function remainingMs(deadlineAt) {
  if (!Number.isFinite(Number(deadlineAt))) return undefined;
  return Math.max(1_000, Number(deadlineAt) - Date.now());
}
