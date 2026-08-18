export const CONTRACT_REVIEW_SUBMISSION_MODE = Object.freeze({
  promotion: "promotion",
  reviewOnly: "review_only",
  blocked: "blocked"
});

export function contractReviewSubmissionMode(plan) {
  if (!plan || typeof plan !== "object") return CONTRACT_REVIEW_SUBMISSION_MODE.blocked;

  const globalBlockers = Array.isArray(plan.globalBlockers) ? plan.globalBlockers : [];
  const candidatePlans = Array.isArray(plan.candidatePlans) ? plan.candidatePlans : [];
  if (globalBlockers.length || candidatePlans.length === 0) return CONTRACT_REVIEW_SUBMISSION_MODE.blocked;

  if (plan.transactionReady === true) {
    const hasReadyCandidate = candidatePlans.some((candidate) => candidate?.status === "transaction_ready");
    const hasUnsupportedStatus = candidatePlans.some((candidate) => !["transaction_ready", "rejected"].includes(candidate?.status));
    return hasReadyCandidate && !hasUnsupportedStatus
      ? CONTRACT_REVIEW_SUBMISSION_MODE.promotion
      : CONTRACT_REVIEW_SUBMISSION_MODE.blocked;
  }

  return candidatePlans.every((candidate) => candidate?.status === "rejected")
    ? CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly
    : CONTRACT_REVIEW_SUBMISSION_MODE.blocked;
}
