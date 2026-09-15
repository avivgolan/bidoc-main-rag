// Shared, persisted review-reason markers. An unverified relationship is excluded
// from assembly, but its clauses must remain blocked from operational promotion.
export const CONTRACTS_AUTOMATIC_PIPELINE_VERSION = "contracts-automatic-pipeline.v1";
export const AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX = "[contracts-automatic-pipeline.v1:unresolved]";

export const CONTRACTS_AUTOMATIC_STEPS = Object.freeze([
  "explicit", "semantic", "relationship-review", "decisions", "decision-review",
  "decision-findings", "handoff", "indicator", "schedule"
]);

export function unresolvedAutomaticRelationship(item) {
  return item?.reviewStatus === "rejected"
    && String(item.reviewReason || "").startsWith(AUTOMATIC_RELATIONSHIP_UNRESOLVED_PREFIX);
}
