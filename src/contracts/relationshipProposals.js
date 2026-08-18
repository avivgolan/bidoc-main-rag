import {
  contractsClauseDisplayLabelHe,
  contractsReferenceTargetLabelHe,
  decorateContractsClauseRecords
} from "./clausePresentation.js";

export const CONTRACTS_RELATIONSHIPS_AGENT_VERSION = "contracts-relationships-agent.r4.0.v1";
export const CONTRACTS_RELATIONSHIP_POLICY_VERSION = "contracts-relationships-explicit-reference.r4.0.v1";

export const CONTRACTS_RELATIONSHIP_TYPE_LABELS_HE = Object.freeze({
  cross_reference: "הפניה מפורשת",
  supports_same_decision: "תומך באותה החלטה",
  depends_on: "תלוי ב־",
  condition_of: "תנאי של",
  exception_to: "חריג ל־",
  amends: "מתקן את",
  duplicates: "כפילות של",
  conflicts_with: "סותר את",
  split_into: "פוצלה אל",
  merged_into: "מוזגה אל"
});

export const CONTRACTS_RELATIONSHIP_ORIGIN_LABELS_HE = Object.freeze({
  explicit_reference: "הפניה שכתובה בחוזה",
  deterministic: "כלל דטרמיניסטי",
  model: "הצעת מודל",
  human: "החלטת סוקר",
  system: "פעולת מערכת"
});

export const CONTRACTS_RELATIONSHIP_REVIEW_LABELS_HE = Object.freeze({
  proposed: "מוצע לסקירה",
  approved: "אושר",
  corrected: "תוקן ואושר",
  rejected: "נדחה",
  superseded: "הוחלף",
  unresolved: "לא פתור"
});

export function contractsRelationshipTypeLabelHe(value) {
  return CONTRACTS_RELATIONSHIP_TYPE_LABELS_HE[value] || "קשר חוזי";
}

export function contractsRelationshipOriginLabelHe(value) {
  return CONTRACTS_RELATIONSHIP_ORIGIN_LABELS_HE[value] || "מקור קשר לא ידוע";
}

export function contractsRelationshipReviewLabelHe(value) {
  return CONTRACTS_RELATIONSHIP_REVIEW_LABELS_HE[value] || "ממתין לסקירה";
}

export function buildContractsExplicitReferencePreview(preview = {}) {
  const clauses = decorateContractsClauseRecords(preview?.clauses);
  const clausesByKey = new Map(clauses.map((clause) => [String(clause.clauseKey || ""), clause]));
  const proposalsByKey = new Map();
  const unresolvedReferences = [];
  let explicitReferenceCount = 0;

  for (const source of clauses) {
    for (const reference of Array.isArray(source.crossReferences) ? source.crossReferences : []) {
      explicitReferenceCount += 1;
      const targetClauseKey = String(reference?.targetClauseKey || "").trim();
      const target = clausesByKey.get(targetClauseKey);
      if (reference?.resolution !== "resolved" || !target || targetClauseKey === source.clauseKey) {
        unresolvedReferences.push({
          sourceClauseKey: source.clauseKey,
          sourceLabelHe: source.displayLabelHe || contractsClauseDisplayLabelHe(source.clauseKey, source.clauseTitle),
          targetClauseKey,
          targetLabelHe: reference?.targetLabelHe || contractsReferenceTargetLabelHe(targetClauseKey),
          referenceText: String(reference?.referenceText || "").trim(),
          referenceKind: reference?.referenceKind || "clause",
          reason: targetClauseKey === source.clauseKey ? "self_reference" : "target_missing",
          reasonHe: targetClauseKey === source.clauseKey
            ? "ההפניה מצביעה לאותה רשומה ולכן לא נוצר קשר עצמי."
            : "יעד ההפניה לא נמצא בגרסת החוזה שנשמרה."
        });
        continue;
      }

      const proposalKey = `${source.clauseKey}\u001f${target.clauseKey}\u001fcross_reference`;
      const existing = proposalsByKey.get(proposalKey);
      if (existing) {
        if (!existing.referenceTexts.includes(reference.referenceText)) existing.referenceTexts.push(reference.referenceText);
        if (!existing.referenceKinds.includes(reference.referenceKind)) existing.referenceKinds.push(reference.referenceKind);
        continue;
      }
      proposalsByKey.set(proposalKey, {
        proposalKey,
        relationshipType: "cross_reference",
        relationshipTypeLabelHe: contractsRelationshipTypeLabelHe("cross_reference"),
        origin: "explicit_reference",
        originLabelHe: contractsRelationshipOriginLabelHe("explicit_reference"),
        confidence: null,
        reviewStatus: "proposed",
        reviewStatusLabelHe: contractsRelationshipReviewLabelHe("proposed"),
        sourceClauseKey: source.clauseKey,
        sourceLabelHe: source.displayLabelHe || contractsClauseDisplayLabelHe(source.clauseKey, source.clauseTitle),
        sourceSummaryHe: source.summaryHe,
        sourcePageStart: source.pageStart,
        sourcePageEnd: source.pageEnd,
        sourceRawText: source.rawText,
        sourceRawTextSha256: source.rawTextSha256,
        targetClauseKey: target.clauseKey,
        targetLabelHe: target.displayLabelHe || contractsClauseDisplayLabelHe(target.clauseKey, target.clauseTitle),
        targetSummaryHe: target.summaryHe,
        targetPageStart: target.pageStart,
        targetPageEnd: target.pageEnd,
        targetRawText: target.rawText,
        targetRawTextSha256: target.rawTextSha256,
        referenceTexts: [reference.referenceText],
        referenceKinds: [reference.referenceKind],
        rationaleHe: `ב${source.displayLabelHe || contractsClauseDisplayLabelHe(source.clauseKey, source.clauseTitle)} נמצאה הפניה מפורשת אל ${target.displayLabelHe || contractsClauseDisplayLabelHe(target.clauseKey, target.clauseTitle)}. הקשר מתעד את ההפניה בלבד ואינו מוכיח ששתי הרשומות שייכות לאותה החלטה.`
      });
    }
  }

  const proposals = [...proposalsByKey.values()].map((proposal) => ({
    ...proposal,
    referenceTexts: [...proposal.referenceTexts].sort((a, b) => a.localeCompare(b, "he")),
    referenceKinds: [...proposal.referenceKinds].sort()
  }));
  return {
    agentVersion: CONTRACTS_RELATIONSHIPS_AGENT_VERSION,
    relationshipPolicyVersion: CONTRACTS_RELATIONSHIP_POLICY_VERSION,
    scope: "explicit_references_only",
    proposals,
    unresolvedReferences,
    metrics: {
      explicitReferenceCount,
      explicitRelationshipCount: proposals.length,
      unresolvedReferenceCount: unresolvedReferences.length,
      modelRelationshipCount: 0,
      decisionCount: 0,
      scheduleWriteCount: 0
    },
    gates: {
      modelGroupingEnabled: false,
      decisionCreationEnabled: false,
      conflictResolutionEnabled: false,
      scheduleWritesEnabled: false
    }
  };
}
