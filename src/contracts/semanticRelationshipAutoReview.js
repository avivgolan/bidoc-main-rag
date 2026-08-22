import { ContractsAgentError } from "./errors.js";
import { parseContractsClauseWorkspaceId } from "./clausePersistence.js";
import { contractsRelationshipTypeLabelHe } from "./relationshipProposals.js";
import {
  contractsRelationshipReviewApproved,
  loadContractsRelationshipReview
} from "./semanticRelationshipReview.js";
import {
  CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION,
  CONTRACTS_RELATIONSHIPS_R4_1_VERIFIER_SCHEMA_VERSION
} from "./semanticRelationships.js";
import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_RELATIONSHIP_AUTO_REVIEW_AGENT_VERSION = "contracts-relationships-agent.r4.2a1.v1";
export const CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION = "contracts-relationships-auto-review.r4.2a1.v1";
export const CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIGRATION_VERSION = "20260821193107";
export const CONTRACTS_RELATIONSHIP_AUTO_REVIEW_STATUS_RPC = "bidoc_contracts_relationship_auto_review_status_r4_2a1";
export const CONTRACTS_RELATIONSHIP_AUTO_REVIEW_APPLY_RPC = "bidoc_contracts_auto_review_semantic_relationships_r4_2a1";
export const CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE = 0.95;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HEBREW_PATTERN = /[\u0590-\u05ff]/u;
const AUTO_APPROVE_TYPES = new Set(["supports_same_decision", "depends_on", "condition_of"]);
const AUTO_REVIEW_SCOPE = "high_confidence_model_agreement_with_human_fallback";

function autoReviewError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function mapWorkspaceError(error) {
  const mapping = {
    contracts_workspace_migration_missing: [
      "contracts_relationship_auto_review_migration_missing",
      "The R4.2A.1 relationship auto-review migration is not available in KAPAIM.",
      503
    ],
    contracts_workspace_draft_stale: [
      "contracts_relationship_auto_review_stale",
      "A relationship changed while the automatic review was running. Reload before retrying.",
      409
    ],
    contracts_workspace_rpc_failed: [
      "contracts_relationship_auto_review_rpc_failed",
      "KAPAIM rejected the relationship auto-review request.",
      error?.status || 502
    ]
  };
  const mapped = mapping[error?.code];
  if (!mapped) return error;
  return autoReviewError(mapped[0], mapped[1], mapped[2], error);
}

function exactEmptyObject(value) {
  const body = value === null || value === undefined ? {} : value;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) {
    throw autoReviewError(
      "contracts_relationship_auto_review_request_invalid",
      "Relationship auto-review accepts no browser-supplied relationships, thresholds, decisions, or model settings."
    );
  }
  return {};
}

function numberInRange(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 1 ? normalized : null;
}

function normalizedTokens(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function incompatibleWhenBothPresent(left, right) {
  if (!left.length || !right.length) return false;
  return left.length !== right.length || left.some((value, index) => value !== right[index]);
}

function collectPatternTokens(text, pattern, mapper) {
  const tokens = [];
  for (const match of String(text || "").matchAll(pattern)) tokens.push(mapper(match));
  return normalizedTokens(tokens);
}

function comparableFacts(text) {
  const normalized = String(text || "").replace(/^\s*(?:סעיף\s*)?\d+(?:\.\d+)*[.)]?\s*/u, "");
  const amounts = collectPatternTokens(
    normalized,
    /(\d[\d,.\s]*?)\s*(ש["״']?ח|₪|שקלים?|אחוזים?|%)/gu,
    (match) => `${match[1].replace(/[\s,]/gu, "")}:${match[2].replace(/["״']/gu, "")}`
  );
  const dates = collectPatternTokens(
    normalized,
    /\b(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\b/gu,
    (match) => match[1]
  );
  const deadlines = collectPatternTokens(
    normalized,
    /(?:תוך|לא\s+יאוחר\s+מ(?:-|־)?|עד\s+חלוף)\s*(\d{1,4})\s*(ימי(?:ם)?|יום|ימים|שעות?|חודשים?|שבועות?)/gu,
    (match) => `${match[1]}:${match[2]}`
  );
  const urgent = /(?:פגמ|ליקו)[^.!?\n]{0,80}דחופ|(?:מיד|מייד)(?:ית)?/u.test(normalized);
  const nonUrgent = /(?:פגמ|ליקו)[^.!?\n]{0,80}(?:שאינ(?:ו|ם)\s+דחופ|אחרים)|לא\s+בהכרח\s+(?:מיד|מייד)/u.test(normalized);
  const triggers = normalizedTokens([
    urgent && !nonUrgent ? "urgent" : "",
    nonUrgent ? "non_urgent" : ""
  ]);
  return { amounts, dates, deadlines, triggers };
}

function relationshipBlockers(item) {
  const signals = item?.evidence?.signals;
  const excerpts = Array.isArray(item?.evidence?.excerpts) ? item.evidence.excerpts : [];
  const retrieval = signals?.retrieval;
  const blockers = [];
  const finalConfidence = numberInRange(item?.confidence);
  const classifierConfidence = numberInRange(signals?.classifierConfidence);
  const verificationConfidence = numberInRange(signals?.verificationConfidence);

  if (item?.origin !== "model" || item?.reviewStatus !== "proposed") blockers.push("not_pending_model_proposal");
  if (!AUTO_APPROVE_TYPES.has(item?.relationshipType)) blockers.push("relationship_type_requires_human_review");
  if (finalConfidence === null || finalConfidence < CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE) {
    blockers.push("final_confidence_below_threshold");
  }
  if (classifierConfidence === null || classifierConfidence < CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE) {
    blockers.push("classifier_confidence_below_threshold");
  }
  if (verificationConfidence === null || verificationConfidence < CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE) {
    blockers.push("verification_confidence_below_threshold");
  }
  if (signals?.verificationSchemaVersion !== CONTRACTS_RELATIONSHIPS_R4_1_VERIFIER_SCHEMA_VERSION) {
    blockers.push("verification_schema_invalid");
  }
  if (!retrieval || (retrieval.sameSection !== true && retrieval.explicitReference !== true)) {
    blockers.push("structural_support_missing");
  }
  if (excerpts.length !== 2 || excerpts.some((excerpt) => !String(excerpt?.excerpt || "").trim())) {
    blockers.push("source_evidence_incomplete");
  }
  if (!HEBREW_PATTERN.test(String(item?.evidence?.rationaleHe || ""))) blockers.push("hebrew_rationale_missing");

  const sourceFacts = comparableFacts(excerpts[0]?.excerpt);
  const targetFacts = comparableFacts(excerpts[1]?.excerpt);
  const checks = {
    amountMismatch: incompatibleWhenBothPresent(sourceFacts.amounts, targetFacts.amounts),
    dateMismatch: incompatibleWhenBothPresent(sourceFacts.dates, targetFacts.dates),
    deadlineMismatch: incompatibleWhenBothPresent(sourceFacts.deadlines, targetFacts.deadlines),
    triggerMismatch: incompatibleWhenBothPresent(sourceFacts.triggers, targetFacts.triggers)
  };
  if (checks.amountMismatch) blockers.push("amount_mismatch");
  if (checks.dateMismatch) blockers.push("date_mismatch");
  if (checks.deadlineMismatch) blockers.push("deadline_mismatch");
  if (checks.triggerMismatch) blockers.push("trigger_mismatch");

  return {
    blockers: [...new Set(blockers)],
    checks,
    finalConfidence,
    classifierConfidence,
    verificationConfidence,
    sameSection: retrieval?.sameSection === true,
    explicitReference: retrieval?.explicitReference === true
  };
}

function automaticReasonHe(item) {
  const typeLabel = contractsRelationshipTypeLabelHe(item.relationshipType);
  return `המסווג והבודק העצמאי הסכימו בביטחון גבוה על קשר מסוג ${typeLabel} בין סעיפים ${item.sourceClauseKey} ו־${item.targetClauseKey}, ולא זוהו פערים בסכומים, במועדים או בטריגרים.`;
}

export function parseContractsRelationshipAutoReviewRequest(value) {
  return exactEmptyObject(value);
}

export function buildContractsSemanticAutoReviewPlan({ relationshipReview } = {}) {
  if (!relationshipReview || !Array.isArray(relationshipReview.items) || !relationshipReview.metrics) {
    throw autoReviewError(
      "contracts_relationship_auto_review_response_invalid",
      "The relationship review projection is unavailable or invalid.",
      502
    );
  }
  const candidates = relationshipReview.items
    .filter((item) => item?.reviewStatus === "proposed")
    .map((item) => {
      const policy = relationshipBlockers(item);
      const eligible = policy.blockers.length === 0;
      return {
        relationshipId: item.relationshipId,
        expectedRevision: Number(item.revision),
        sourceClauseKey: item.sourceClauseKey,
        targetClauseKey: item.targetClauseKey,
        relationshipType: item.relationshipType,
        outcome: eligible ? "auto_approve" : "human_review_required",
        blockers: policy.blockers,
        reasonHe: eligible ? automaticReasonHe(item) : null,
        policyEvidence: {
          finalConfidence: policy.finalConfidence,
          classifierConfidence: policy.classifierConfidence,
          verificationConfidence: policy.verificationConfidence,
          sameSection: policy.sameSection,
          explicitReference: policy.explicitReference,
          checks: policy.checks,
          blockers: policy.blockers
        }
      };
    });
  const eligibleCount = candidates.filter((candidate) => candidate.outcome === "auto_approve").length;
  return {
    agentVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_AGENT_VERSION,
    policyVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION,
    relationshipPolicyVersion: CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION,
    scope: AUTO_REVIEW_SCOPE,
    minimumConfidence: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE,
    candidates,
    metrics: {
      inputPendingCount: candidates.length,
      eligibleCount,
      humanReviewRequiredCount: candidates.length - eligibleCount,
      decisionCount: Number(relationshipReview.metrics.decisionCount || 0),
      scheduleWriteCount: 0
    },
    gates: {
      autoApproveEnabled: true,
      autoRejectEnabled: false,
      correctionEnabled: false,
      humanFallbackEnabled: true,
      decisionCreationEnabled: false,
      scheduleWritesEnabled: false
    }
  };
}

export async function loadContractsRelationshipAutoReviewStatus({
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
      agentVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_AGENT_VERSION,
      policyVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION,
      migrationVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIGRATION_VERSION,
      scope: AUTO_REVIEW_SCOPE,
      minimumConfidence: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE,
      autoApproveEnabled: false,
      autoRejectEnabled: false,
      correctionEnabled: false,
      humanFallbackEnabled: true,
      decisionCreationEnabled: false,
      scheduleWritesEnabled: false,
      reason: "relationship_review_not_approved"
    };
  }
  try {
    const status = await workspaceRpc({
      config,
      rpc: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_STATUS_RPC,
      fetchImpl,
      timeoutMs
    });
    return { active: true, ready: true, applyApproved: true, ...assertAutoReviewStatus(status) };
  } catch (error) {
    throw mapWorkspaceError(error);
  }
}

export async function autoReviewContractsSemanticRelationships({
  config,
  workspaceId,
  reviewerId,
  body = {},
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  parseContractsRelationshipAutoReviewRequest(body);
  if (!contractsRelationshipReviewApproved(env)) {
    throw autoReviewError(
      "contracts_relationship_auto_review_not_enabled",
      "Relationship auto-review requires the approved R4.2A review path.",
      503
    );
  }
  const normalizedWorkspaceId = parseContractsClauseWorkspaceId(workspaceId);
  const normalizedReviewerId = String(reviewerId || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedReviewerId)) {
    throw autoReviewError("contracts_relationship_auto_review_request_invalid", "reviewerId must be a UUID.");
  }
  await loadContractsRelationshipAutoReviewStatus({ config, env, fetchImpl, timeoutMs });
  const relationshipReview = await loadContractsRelationshipReview({
    config,
    workspaceId: normalizedWorkspaceId,
    fetchImpl,
    timeoutMs
  });
  const plan = buildContractsSemanticAutoReviewPlan({ relationshipReview });
  const eligible = plan.candidates.filter((candidate) => candidate.outcome === "auto_approve");
  if (eligible.length === 0) {
    return {
      agentVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_AGENT_VERSION,
      policyVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION,
      migrationVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIGRATION_VERSION,
      scope: AUTO_REVIEW_SCOPE,
      plan,
      autoReview: {
        approvedCount: 0,
        humanReviewRequiredCount: plan.metrics.humanReviewRequiredCount,
        atomic: true
      },
      review: relationshipReview,
      gates: plan.gates
    };
  }
  try {
    const applied = await workspaceRpc({
      config,
      rpc: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_APPLY_RPC,
      payload: {
        p_workspace_id: normalizedWorkspaceId,
        p_requested_by_reviewer_id: normalizedReviewerId,
        p_auto_policy_version: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION,
        p_items: eligible.map((candidate) => ({
          relationshipId: candidate.relationshipId,
          expectedRevision: candidate.expectedRevision,
          reasonHe: candidate.reasonHe,
          policyEvidence: candidate.policyEvidence
        }))
      },
      fetchImpl,
      timeoutMs
    });
    if (applied?.autoReview?.atomic !== true
        || Number(applied?.autoReview?.approvedCount) !== eligible.length
        || Number(applied?.metrics?.scheduleWriteCount) !== 0) {
      throw autoReviewError(
        "contracts_relationship_auto_review_response_invalid",
        "The auto-review database response is invalid.",
        502
      );
    }
    const review = await loadContractsRelationshipReview({
      config,
      workspaceId: normalizedWorkspaceId,
      fetchImpl,
      timeoutMs
    });
    return {
      agentVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_AGENT_VERSION,
      policyVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION,
      migrationVersion: CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIGRATION_VERSION,
      scope: AUTO_REVIEW_SCOPE,
      plan,
      autoReview: {
        approvedCount: eligible.length,
        humanReviewRequiredCount: Number(review.metrics.proposedCount || 0),
        atomic: true
      },
      review,
      gates: plan.gates
    };
  } catch (error) {
    if (error?.code === "contracts_relationship_auto_review_response_invalid") throw error;
    throw mapWorkspaceError(error);
  }
}

function assertAutoReviewStatus(value) {
  if (!value
      || value.agentVersion !== CONTRACTS_RELATIONSHIP_AUTO_REVIEW_AGENT_VERSION
      || value.policyVersion !== CONTRACTS_RELATIONSHIP_AUTO_REVIEW_POLICY_VERSION
      || value.migrationVersion !== CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIGRATION_VERSION
      || value.scope !== AUTO_REVIEW_SCOPE
      || Number(value.minimumConfidence) !== CONTRACTS_RELATIONSHIP_AUTO_REVIEW_MIN_CONFIDENCE
      || value.autoApproveEnabled !== true
      || value.autoRejectEnabled !== false
      || value.correctionEnabled !== false
      || value.humanFallbackEnabled !== true
      || value.decisionCreationEnabled !== false
      || value.scheduleWritesEnabled !== false) {
    throw autoReviewError(
      "contracts_relationship_auto_review_response_invalid",
      "The R4.2A.1 relationship auto-review migration version is unsupported.",
      502
    );
  }
  return value;
}
