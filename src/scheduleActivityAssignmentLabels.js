export const SCHEDULE_ASSIGNMENT_LABEL_TYPES = Object.freeze({
  CONFIRMED_MATCH: "confirmed_match",
  REJECTED_MATCH: "rejected_match",
  NO_MATCH: "no_match",
  STALE_ACTIVITY: "stale_activity",
  IRRELEVANT_ALERT: "irrelevant_alert",
  AMBIGUOUS: "ambiguous"
});

export const SCHEDULE_ASSIGNMENT_NEGATIVE_LABEL_TYPES = Object.freeze([
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.NO_MATCH,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.STALE_ACTIVITY,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.IRRELEVANT_ALERT,
  SCHEDULE_ASSIGNMENT_LABEL_TYPES.AMBIGUOUS
]);

export const SCHEDULE_ASSIGNMENT_REVIEW_LABEL_OPTIONS = Object.freeze([
  {
    type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.NO_MATCH,
    labelHe: "אף פעילות אינה מתאימה",
    reasonHe: "הבודק אישר שאין פעילות מתאימה בגרסת לוח הזמנים הפעילה."
  },
  {
    type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.AMBIGUOUS,
    labelHe: "אין מספיק מידע להכריע",
    reasonHe: "הבודק אישר שכמה פעילויות נותרו סבירות ואין די מידע להכרעה."
  },
  {
    type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.IRRELEVANT_ALERT,
    labelHe: "לא רלוונטי לשיוך בלוח",
    reasonHe: "הבודק אישר שההתראה אינה צריכה להיכנס לתהליך שיוך הפעילויות."
  },
  {
    type: SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH,
    labelHe: "ההצעות שגויות. קיימת פעילות אחרת",
    reasonHe: "הבודק דחה את הפעילויות שהוצעו אך לא קבע שאין פעילות מתאימה אחרת."
  }
]);

const LABEL_TYPES = new Set(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES));
const NEGATIVE_LABEL_TYPES = new Set(SCHEDULE_ASSIGNMENT_NEGATIVE_LABEL_TYPES);

function safeText(value, max = 1200) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, "").trim().slice(0, max);
}

function safeActivityKeys(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => safeText(value, 500))
    .filter((value) => value.startsWith("gantt:")))];
}

export function normalizeScheduleAssignmentReviewLabel({
  labelType,
  expectedActivityKey = null,
  forbiddenActivityKeys = [],
  reason = null
} = {}) {
  const type = safeText(labelType, 80);
  if (!LABEL_TYPES.has(type)) throw new Error("unsupported Schedule assignment evaluation label");
  const expected = safeText(expectedActivityKey, 500) || null;
  const forbidden = safeActivityKeys(forbiddenActivityKeys);
  const normalizedReason = safeText(reason, 1200) || null;
  if (!normalizedReason) throw new Error("reviewed Schedule assignment label requires a reason");
  if (type === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH) {
    if (!expected?.startsWith("gantt:")) throw new Error("confirmed_match requires an expected Gantt activity");
    if (forbidden.length) throw new Error("confirmed_match cannot contain forbidden activities");
  } else if (expected) {
    throw new Error(`${type} cannot contain an expected activity`);
  }
  if ([SCHEDULE_ASSIGNMENT_LABEL_TYPES.REJECTED_MATCH, SCHEDULE_ASSIGNMENT_LABEL_TYPES.STALE_ACTIVITY].includes(type) && !forbidden.length) {
    throw new Error(`${type} requires at least one forbidden activity`);
  }
  return {
    type,
    expectedActivityKey: expected,
    forbiddenActivityKeys: forbidden,
    reason: normalizedReason,
    resolutionStatus: type === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH ? "selected" : "rejected"
  };
}

export function scheduleAssignmentReviewRowToEvaluationCase(row = {}) {
  if (!row?.evaluation_label_type) return null;
  const label = normalizeScheduleAssignmentReviewLabel({
    labelType: row.evaluation_label_type,
    expectedActivityKey: row.expected_activity_key,
    forbiddenActivityKeys: row.forbidden_activity_keys,
    reason: row.evaluation_label_reason || row.resolution_note
  });
  const sourceId = safeText(row.source_id, 160);
  if (!sourceId) throw new Error("reviewed Schedule assignment label requires source_id");
  return {
    id: `shared-review:${safeText(row.id || row.run_id, 500)}`,
    projectId: safeText(row.source_project_id, 500) || null,
    sourceId,
    scheduleVersionId: safeText(row.decision_snapshot?.scheduleVersionId, 500) || null,
    label: {
      type: label.type,
      expectedActivityKey: label.expectedActivityKey,
      forbiddenActivityKeys: label.forbiddenActivityKeys,
      reason: label.reason
    },
    provenance: {
      source: "schedule_activity_assignment_reviews",
      linkId: safeText(row.id, 500) || null,
      reviewedAt: safeText(row.labelled_at || row.resolved_at, 100) || null,
      recordOrigin: safeText(row.event_snapshot?.recordOrigin, 160) || null,
      assignmentMethod: label.type === SCHEDULE_ASSIGNMENT_LABEL_TYPES.CONFIRMED_MATCH ? "review_label" : null,
      reviewer: safeText(row.labelled_by || row.resolved_by, 300) || null,
      runId: safeText(row.run_id, 500) || null
    }
  };
}

export function summarizeScheduleAssignmentLabelCoverage(cases = [], { minimumCaseCount = 100 } = {}) {
  const rows = Array.isArray(cases) ? cases : [];
  const labelBreakdown = Object.fromEntries(Object.values(SCHEDULE_ASSIGNMENT_LABEL_TYPES)
    .map((type) => [type, rows.filter((item) => (item?.label?.type || item?.labelType) === type).length]));
  const missingLabelTypes = Object.entries(labelBreakdown).filter(([, count]) => count === 0).map(([type]) => type);
  return {
    caseCount: rows.length,
    minimumCaseCount,
    remainingCaseCount: Math.max(0, minimumCaseCount - rows.length),
    labelBreakdown,
    missingLabelTypes,
    minimumCoverageMet: rows.length >= minimumCaseCount && missingLabelTypes.length === 0
  };
}

function reviewedLabelSignature(item = {}) {
  const label = item.label || {};
  return JSON.stringify({
    type: label.type || null,
    expectedActivityKey: label.expectedActivityKey || null,
    forbiddenActivityKeys: [...(label.forbiddenActivityKeys || [])].sort()
  });
}

export function reconcileScheduleAssignmentReviewLabels({ reviewCases = [], canonicalCases = [] } = {}) {
  const canonicalBySource = new Map((Array.isArray(canonicalCases) ? canonicalCases : [])
    .map((item) => [String(item?.sourceId || ""), item])
    .filter(([sourceId]) => sourceId));
  const grouped = new Map();
  for (const item of Array.isArray(reviewCases) ? reviewCases : []) {
    const sourceId = String(item?.sourceId || "");
    if (!sourceId) continue;
    if (!grouped.has(sourceId)) grouped.set(sourceId, []);
    grouped.get(sourceId).push(item);
  }
  const selectedCases = [];
  const exclusions = [];
  const blockedSourceIds = [];
  for (const [sourceId, cases] of grouped) {
    const canonical = canonicalBySource.get(sourceId);
    if (canonical) {
      for (const item of cases) {
        exclusions.push({
          sourceId,
          reviewId: item.provenance?.linkId || null,
          reason: reviewedLabelSignature(item) === reviewedLabelSignature(canonical)
            ? "review_label_duplicate_of_canonical_link"
            : "review_label_conflicts_with_canonical_link"
        });
      }
      continue;
    }
    const signatures = [...new Set(cases.map(reviewedLabelSignature))];
    if (signatures.length > 1) {
      blockedSourceIds.push(sourceId);
      exclusions.push({
        sourceId,
        reviewIds: cases.map((item) => item.provenance?.linkId).filter(Boolean),
        reason: "conflicting_shared_review_labels"
      });
      continue;
    }
    const ordered = [...cases].sort((left, right) => Date.parse(left.provenance?.reviewedAt || 0) - Date.parse(right.provenance?.reviewedAt || 0));
    const selected = ordered.at(-1);
    selectedCases.push(selected);
    for (const duplicate of ordered.slice(0, -1)) {
      exclusions.push({
        sourceId,
        reviewId: duplicate.provenance?.linkId || null,
        reason: "review_label_superseded_duplicate"
      });
    }
  }
  return { selectedCases, exclusions, blockedSourceIds };
}

export function isScheduleAssignmentNegativeLabelType(value) {
  return NEGATIVE_LABEL_TYPES.has(String(value || ""));
}
