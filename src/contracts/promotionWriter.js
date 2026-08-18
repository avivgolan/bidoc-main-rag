import { CONTRACTS_MAX_JSON_BYTES } from "./constants.js";
import { ContractsAgentError } from "./errors.js";
import { CONTRACTS_PROMOTION_PLANNER_VERSION } from "./promotionPlanner.js";
import { scheduleSupabaseConfig } from "../scheduleIngestion.js";
import { supabaseHeaders } from "../config.js";
import { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } from "./reviewMode.js";

export const CONTRACTS_PROMOTION_SUBMISSION_VERSION = "contracts-promotion-submission.phase2.v1";
export const CONTRACTS_PROMOTION_RPC = "bidoc_contracts_promote_review_v1";
export const CONTRACTS_PROMOTION_TIMEOUT_MS = 30_000;

const ALLOWED_CANDIDATE_STATUSES = new Set(["transaction_ready", "rejected", "blocked"]);

export function buildContractPromotionSubmission({ extraction, reviewBatch, projectMapping, plan } = {}) {
  if (!extraction || typeof extraction !== "object") throw promotionError("contracts_promotion_extraction_missing", "A Contracts extraction is required.");
  if (!reviewBatch || typeof reviewBatch !== "object") throw promotionError("contracts_promotion_review_missing", "A reviewed batch is required.");
  if (!projectMapping || typeof projectMapping !== "object") throw promotionError("contracts_promotion_mapping_missing", "An approved project mapping is required.");
  if (!plan || typeof plan !== "object") throw promotionError("contracts_promotion_plan_missing", "A promotion plan is required.");
  if (plan.plannerVersion !== CONTRACTS_PROMOTION_PLANNER_VERSION) {
    throw promotionError("contracts_promotion_planner_version_invalid", "The promotion planner version is not approved.");
  }
  if (plan.operationalWritesPerformed !== false) {
    throw promotionError("contracts_promotion_source_not_dry", "The source plan must not have performed operational writes.");
  }
  if (!Array.isArray(plan.globalBlockers) || plan.globalBlockers.length) {
    throw promotionError("contracts_promotion_globally_blocked", "The promotion plan still has global blockers.", plan.globalBlockers || []);
  }
  if (!Array.isArray(plan.candidatePlans) || !plan.candidatePlans.length) {
    throw promotionError("contracts_promotion_candidates_missing", "The promotion plan has no candidate decisions.");
  }
  if (plan.candidatePlans.some((candidate) => !ALLOWED_CANDIDATE_STATUSES.has(candidate?.status))) {
    throw promotionError("contracts_promotion_candidate_status_invalid", "The promotion plan contains an unsupported candidate status.");
  }
  const unsafeBlocked = plan.candidatePlans.filter((candidate) =>
    candidate.status === "blocked" && !candidate.blockers?.includes("review_decision_missing")
  );
  if (unsafeBlocked.length) {
    throw promotionError(
      "contracts_promotion_candidate_blocked",
      "A reviewed candidate is unsafe, so the whole submission remains blocked.",
      unsafeBlocked.flatMap((candidate) => candidate.blockers || [])
    );
  }
  const ready = plan.candidatePlans.filter((candidate) => candidate.status === "transaction_ready");
  const rejected = plan.candidatePlans.filter((candidate) => candidate.status === "rejected");
  const submissionMode = contractReviewSubmissionMode(plan);
  if (submissionMode === CONTRACT_REVIEW_SUBMISSION_MODE.blocked) {
    throw promotionError("contracts_review_submission_blocked", "The reviewed plan is neither promotion-ready nor a complete rejection-only review.");
  }
  if (submissionMode === CONTRACT_REVIEW_SUBMISSION_MODE.promotion && ready.length === 0) {
    throw promotionError("contracts_promotion_rows_missing", "A transaction-ready plan must contain at least one operational row.");
  }
  if (submissionMode === CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly && (ready.length > 0 || rejected.length !== plan.candidatePlans.length)) {
    throw promotionError("contracts_review_only_invalid", "A review-only submission must contain a rejection and no promotable row.");
  }
  const submission = {
    submissionVersion: CONTRACTS_PROMOTION_SUBMISSION_VERSION,
    submissionMode,
    extraction: {
      mode: extraction.mode,
      document: extraction.document,
      projectBinding: extraction.projectBinding,
      candidates: extraction.candidates || [],
      conflicts: extraction.conflicts || []
    },
    reviewBatch,
    projectMapping,
    plan
  };
  const bytes = Buffer.byteLength(JSON.stringify(submission), "utf8");
  if (bytes > CONTRACTS_MAX_JSON_BYTES) {
    throw new ContractsAgentError(
      "contracts_promotion_submission_too_large",
      `The promotion submission exceeds ${CONTRACTS_MAX_JSON_BYTES} bytes.`,
      413
    );
  }
  return submission;
}

export async function submitContractPromotion({
  extraction,
  reviewBatch,
  projectMapping,
  plan,
  config,
  commit = false,
  migrationApplyApproved = false,
  timeoutMs = CONTRACTS_PROMOTION_TIMEOUT_MS,
  fetchImpl = fetch
} = {}) {
  if (commit !== true) {
    throw promotionError("contracts_promotion_commit_required", "Promotion requires an explicit commit flag.");
  }
  if (migrationApplyApproved !== true) {
    throw promotionError("contracts_promotion_apply_not_approved", "The Phase 2 migration/apply gate is not approved.");
  }
  const submission = buildContractPromotionSubmission({ extraction, reviewBatch, projectMapping, plan });
  const connection = scheduleSupabaseConfig(config, "app_data");
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
    throw new ContractsAgentError("contracts_promotion_database_missing", "APP DATA is not configured for Contracts promotion.", 503);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || CONTRACTS_PROMOTION_TIMEOUT_MS));
  let response;
  try {
    response = await fetchImpl(
      `${String(connection.supabaseUrl).replace(/\/+$/u, "")}/rest/v1/rpc/${CONTRACTS_PROMOTION_RPC}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: supabaseHeaders(connection.supabaseServiceRoleKey),
        body: JSON.stringify({ p_submission: submission })
      }
    );
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw new ContractsAgentError(
      timedOut ? "contracts_promotion_timeout" : "contracts_promotion_transport_failed",
      timedOut ? "The atomic promotion request timed out." : "The atomic promotion request failed.",
      timedOut ? 504 : 502,
      { cause: error }
    );
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let result = null;
  try {
    result = text ? JSON.parse(text) : null;
  } catch {
    throw new ContractsAgentError("contracts_promotion_response_invalid", "The promotion RPC returned invalid JSON.", 502);
  }
  if (Array.isArray(result) && result.length === 1) result = result[0];
  if (!response.ok) {
    const rpcMissing = response.status === 404 || ["PGRST202", "42883"].includes(String(result?.code || ""));
    throw new ContractsAgentError(
      rpcMissing ? "contracts_promotion_migration_missing" : "contracts_promotion_rpc_failed",
      rpcMissing
        ? "The expected Contracts Phase 2 RPC is unavailable in APP DATA. Verify that the approved migration is applied and exposed before retrying."
        : String(result?.message || result?.hint || `Promotion RPC failed with status ${response.status}.`).slice(0, 1000),
      rpcMissing ? 503 : 502
    );
  }
  if (!result || typeof result !== "object" || !["committed", "reviewed_no_promotion", "failed"].includes(result.status)) {
    throw new ContractsAgentError("contracts_promotion_response_invalid", "The promotion RPC returned an unsupported result.", 502);
  }
  if (result.status === "failed") {
    throw new ContractsAgentError(
      "contracts_promotion_transaction_failed",
      "The database rejected the atomic promotion without committing partial Schedule rows.",
      409,
      { issueCodes: result.errorCode ? [String(result.errorCode)] : [] }
    );
  }
  if (String(result.batchId || "") !== String(reviewBatch.batchId || "")) {
    throw new ContractsAgentError("contracts_promotion_batch_mismatch", "The promotion RPC returned a different review batch.", 502);
  }
  return {
    ...result,
    operationalWritesPerformed: result.status === "committed",
    submissionVersion: CONTRACTS_PROMOTION_SUBMISSION_VERSION
  };
}

function promotionError(code, message, issueCodes = []) {
  return new ContractsAgentError(code, message, 409, { issueCodes: [...new Set(issueCodes)].sort() });
}
