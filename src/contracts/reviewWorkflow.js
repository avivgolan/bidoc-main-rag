import { ContractsAgentError } from "./errors.js";
import { planContractPromotions } from "./promotionPlanner.js";

export const CONTRACTS_PHASE2_MIGRATION_VERSION = "20260810175150";

const APPROVED_PROMOTION_GATE = Object.freeze({
  schemaAuditApproved: true,
  projectNamespaceApproved: true,
  reviewAuditPersistenceApproved: true,
  atomicPromotionApproved: true,
  permissionModelApproved: true
});

export function contractsPhase2ApplyApproved(env = process.env) {
  return String(env?.CONTRACTS_PHASE2_APPLY_APPROVED || "").trim().toLowerCase() === "true";
}

export function prepareContractReview({ body, reviewerId } = {}) {
  if (!body || typeof body !== "object") {
    throw reviewError("contracts_review_body_missing", "A Contracts review request is required.", 400);
  }
  if (!body.extraction || typeof body.extraction !== "object") {
    throw reviewError("contracts_review_extraction_missing", "The reviewed Contracts extraction is required.", 400);
  }
  if (!body.reviewBatch || typeof body.reviewBatch !== "object") {
    throw reviewError("contracts_review_batch_missing", "Review batch details are required.", 400);
  }
  if (!body.projectMapping || typeof body.projectMapping !== "object") {
    throw reviewError("contracts_review_mapping_missing", "An approved project mapping is required.", 400);
  }
  if (!String(reviewerId || "").trim()) {
    throw reviewError("contracts_review_session_missing", "An authenticated reviewer session is required.", 401);
  }

  const reviewBatch = {
    ...body.reviewBatch,
    reviewerId: String(reviewerId)
  };
  const projectMapping = {
    sourceProjectId: String(body.projectMapping.sourceProjectId || ""),
    scheduleProjectId: String(body.projectMapping.scheduleProjectId || ""),
    sameNamespace: false,
    approved: true,
    approvedBy: "private_mapping_registry",
    approvedAt: String(reviewBatch.reviewedAt || ""),
    reason: "The atomic RPC must validate this pair against the private approved project-mapping registry."
  };
  const plan = planContractPromotions({
    extraction: body.extraction,
    reviewBatch,
    projectMapping,
    gate: APPROVED_PROMOTION_GATE
  });

  return {
    extraction: body.extraction,
    reviewBatch,
    projectMapping,
    plan,
    operationalWritesPerformed: false
  };
}

function reviewError(code, message, status) {
  return new ContractsAgentError(code, message, status);
}
