export const CONTRACTS_TEMPORAL_COVERAGE_AUDIT_VERSION = "contracts-temporal-coverage-audit.r6.v1";

const DURATION_PATTERN = /(?:תוך|לא\s+יאוחר|לפחות|התראה|הודעה\s+מוקדמת|בתוקף)[^.!?\n]{0,80}\d+(?:\s*[-–]\s*\d+)?\s*(?:שעות?|ימים?|ימי\s+עבודה|שבועות?|חודשים?)/u;
const DIRECT_DURATION_PATTERN = /\d+(?:\s*[-–]\s*\d+)?\s*(?:שעות?|ימים?|ימי\s+עבודה|שבועות?|חודשים?)(?:\s+(?:מיום|ממועד|לאחר|לפני|מתום|עד))?/u;
const RECURRING_PATTERN = /(?:מדי|בכל)\s+(?:יום|שבוע|חודש|חודשיים|רבעון|שנה)|בין\s+היום\s+ה?\s*\d+\s+(?:ל|עד)[-־]?\s*\d+/u;
const TEMPORAL_KINDS = new Set(["fixed", "relative", "recurring", "extension"]);

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function strings(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function clauseKey(value) {
  return String(value || "").trim();
}

function ruleKinds(text) {
  const value = String(text || "");
  const kinds = [];
  if (RECURRING_PATTERN.test(value)) kinds.push("recurring");
  if (DURATION_PATTERN.test(value) || DIRECT_DURATION_PATTERN.test(value)) kinds.push("relative_duration");
  return kinds;
}

function timingKind(decision) {
  const timing = decision?.timing;
  const value = typeof timing === "object" && timing !== null
    ? timing.kind
    : decision?.temporalKind;
  return String(value || "none").trim() || "none";
}

function decisionSummary(decision) {
  return {
    decisionId: String(decision?.decisionId || "").trim() || null,
    decisionKey: String(decision?.decisionKey || "").trim() || null,
    reviewStatus: String(decision?.reviewStatusCode || decision?.reviewStatus || "").trim() || null,
    indicatorSuitability: String(decision?.indicatorSuitability || "").trim() || null,
    timingKind: timingKind(decision)
  };
}

/**
 * Reports source clauses containing likely temporal rules that are missing a
 * corresponding R6 decision or a structured timing value. It is pure and
 * read-only: callers own all retrieval, re-extraction, review, and writes.
 */
export function auditContractsTemporalCoverage({ clauses = [], decisions = [] } = {}) {
  const decisionsByClause = new Map();
  for (const decision of Array.isArray(decisions) ? decisions : []) {
    for (const evidence of Array.isArray(decision?.sourceEvidence) ? decision.sourceEvidence : []) {
      const key = clauseKey(evidence?.clauseKey);
      if (!key) continue;
      const matches = decisionsByClause.get(key) || [];
      matches.push(decision);
      decisionsByClause.set(key, matches);
    }
  }

  const items = (Array.isArray(clauses) ? clauses : []).flatMap((clause) => {
    const key = clauseKey(clause?.clauseKey);
    const detectedRuleKinds = ruleKinds(clause?.rawText);
    if (!key || !detectedRuleKinds.length) return [];
    const linkedDecisions = decisionsByClause.get(key) || [];
    const summaries = linkedDecisions.map(decisionSummary);
    const represented = linkedDecisions.some((decision) => TEMPORAL_KINDS.has(timingKind(decision)));
    const status = linkedDecisions.length === 0
      ? "missing_decision"
      : represented
        ? "represented"
        : "missing_structured_timing";
    return [{
      clauseKey: key,
      pageStart: Number.isInteger(Number(clause?.pageStart)) ? Number(clause.pageStart) : null,
      pageEnd: Number.isInteger(Number(clause?.pageEnd)) ? Number(clause.pageEnd) : null,
      tags: unique(strings(clause?.hashtags || clause?.tags)),
      detectedRuleKinds,
      status,
      decisions: summaries
    }];
  });
  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    auditVersion: CONTRACTS_TEMPORAL_COVERAGE_AUDIT_VERSION,
    metrics: {
      sourceClauseCount: Array.isArray(clauses) ? clauses.length : 0,
      temporalClauseCount: items.length,
      representedCount: count("represented"),
      missingDecisionCount: count("missing_decision"),
      missingStructuredTimingCount: count("missing_structured_timing"),
      unresolvedCount: count("missing_decision") + count("missing_structured_timing")
    },
    items
  };
}
