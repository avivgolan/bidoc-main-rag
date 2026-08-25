import crypto from "node:crypto";
import { relativeTemporalMentions } from "./decisionNormalization.js";

export const CONTRACTS_TEMPORAL_REEXTRACTION_PLAN_VERSION = "contracts-temporal-reextraction-plan.r6.v1";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function text(value) {
  return String(value || "").trim();
}

function clauseKey(value) {
  return text(value?.clauseKey);
}

/**
 * Builds a bounded, non-persistent repair queue from the temporal-coverage
 * audit. It intentionally does not produce a Contracts decision or invoke a
 * model: existing decision revisions must remain append-only and every repair
 * still needs the established human review step.
 */
export function buildContractsTemporalReextractionPlan({ coverageAudit, clauses = [] } = {}) {
  const auditItems = Array.isArray(coverageAudit?.items) ? coverageAudit.items : [];
  const clauseByKey = new Map(
    (Array.isArray(clauses) ? clauses : [])
      .map((clause) => [clauseKey(clause), clause])
      .filter(([key]) => Boolean(key))
  );
  const unresolved = auditItems.filter((item) => ["missing_decision", "missing_structured_timing"].includes(text(item?.status)));
  const candidates = unresolved.flatMap((item) => {
    const key = text(item?.clauseKey);
    const clause = clauseByKey.get(key);
    if (!clause) {
      return [{
        candidateKey: sha256(`${CONTRACTS_TEMPORAL_REEXTRACTION_PLAN_VERSION}\u001f${key}\u001fmissing_source_clause`),
        clauseKey: key,
        coverageStatus: text(item?.status),
        detectedRuleKinds: Array.isArray(item?.detectedRuleKinds) ? item.detectedRuleKinds : [],
        disposition: "blocked_missing_source_clause",
        temporalFocus: null,
        reviewReason: "The coverage audit references a clause that is unavailable in the saved immutable generation."
      }];
    }
    const mentions = relativeTemporalMentions([clause]);
    if (!mentions.length) {
      return [{
        candidateKey: sha256(`${CONTRACTS_TEMPORAL_REEXTRACTION_PLAN_VERSION}\u001f${key}\u001fmanual_temporal_review`),
        clauseKey: key,
        coverageStatus: text(item?.status),
        detectedRuleKinds: Array.isArray(item?.detectedRuleKinds) ? item.detectedRuleKinds : [],
        disposition: "manual_temporal_review",
        temporalFocus: null,
        reviewReason: "The clause contains a recurring, windowed, or compound timing rule that has no unambiguous numeric relative-time mention."
      }];
    }
    return mentions.map((mention) => ({
      candidateKey: sha256(`${CONTRACTS_TEMPORAL_REEXTRACTION_PLAN_VERSION}\u001f${key}\u001f${mention.offset}\u001f${mention.text}`),
      clauseKey: key,
      coverageStatus: text(item?.status),
      detectedRuleKinds: Array.isArray(item?.detectedRuleKinds) ? item.detectedRuleKinds : [],
      disposition: "normalize_for_human_review",
      temporalFocus: {
        text: mention.text,
        offset: mention.offset,
        context: mention.context
      },
      reviewReason: "A source-grounded relative-time mention needs a new append-only decision proposal and human review."
    }));
  });
  const count = (disposition) => candidates.filter((item) => item.disposition === disposition).length;
  return {
    planVersion: CONTRACTS_TEMPORAL_REEXTRACTION_PLAN_VERSION,
    auditVersion: text(coverageAudit?.auditVersion) || null,
    metrics: {
      unresolvedClauseCount: unresolved.length,
      candidateCount: candidates.length,
      normalizeForHumanReviewCount: count("normalize_for_human_review"),
      manualTemporalReviewCount: count("manual_temporal_review"),
      blockedMissingSourceClauseCount: count("blocked_missing_source_clause")
    },
    candidates
  };
}
