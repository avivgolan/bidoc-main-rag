const REVIEW_GATE_LABELS = Object.freeze({
  noHardConflict: "לא זוהתה סתירה מהותית",
  canonicalDate: "יש להתראה תאריך מקור תקין",
  activeScheduleActivity: "המועמד שייך לגרסת לוח הזמנים הפעילה",
  unassigned: "ההתראה עדיין אינה משויכת",
  freshRun: "הריצה עדיין עדכנית",
  autoAssignmentEnabled: "מדיניות השיוך האוטומטי פעילה",
  requiredRolesCompleted: "כל בדיקות המודל הנדרשות הושלמו",
  matcherValidatorAgreement: "בודקי המודל הסכימו על אותה פעילות",
  decisionMatch: "התקבלה החלטת התאמה חד-משמעית",
  calibratedThreshold: "ההסתברות המכוילת עברה את הסף",
  margin: "הפער מהמועמד הבא עבר את הסף"
});

const CALIBRATION_REASON_LABELS = Object.freeze({
  calibrator_unavailable: "לא הוגדר מכייל תואם לריצה",
  artifact_version_mismatch: "גרסת המכייל אינה תואמת לגרסת המנוע",
  feature_version_mismatch: "גרסת נתוני הכיול אינה תואמת לריצה",
  engineVersion_mismatch: "גרסת המכייל אינה תואמת לגרסת המנוע",
  scheduleVersionId_mismatch: "המכייל אינו תואם לגרסת לוח הזמנים",
  settingsVersion_mismatch: "המכייל אינו תואם לגרסת ההגדרות",
  configurationSnapshotId_mismatch: "המכייל אינו תואם לתמונת ההגדרות",
  minimum_evidence_not_met: "עדיין אין מספיק ראיות להפעלת המכייל",
  selected_method_is_control: "ריצת הבקרה לא מפיקה הסתברות מכוילת",
  calibrator_prediction_failed: "המכייל לא הצליח להפיק הסתברות תקפה"
});

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatScheduleAssignmentNumber(value) {
  const number = finiteNumber(value);
  if (number == null) return "לא זמין";
  return Number(number.toFixed(2)).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

function addReason(reasons, key, label) {
  if (!label || reasons.some((item) => item.key === key || item.label === label)) return;
  reasons.push({ key, label });
}

function reviewReasons({ decision, gates, policy, calibratedProbability, calibrationStatus }) {
  const reasons = [];
  const decisionType = String(decision?.type || decision?.decision || "");
  if (decisionType === "no_match") addReason(reasons, "decision_no_match", "אף מועמד לא עבר את סף ההצעה");
  if (decisionType === "ambiguous") addReason(reasons, "decision_ambiguous", "המודל לא קיבל החלטת התאמה חד-משמעית");
  if (decisionType === "conflict") addReason(reasons, "decision_conflict", "זוהתה סתירה מהותית בין הנתונים");

  if (gates.calibratedThreshold === false) {
    if (calibrationStatus === "calibrated" && calibratedProbability != null) {
      const threshold = finiteNumber(policy.calibratedProbabilityThreshold);
      addReason(reasons, "calibratedThreshold", threshold == null
        ? "ההסתברות המכוילת לא עברה את סף המדיניות"
        : `ההסתברות המכוילת ${Math.round(calibratedProbability * 100)}% נמוכה מהסף ${formatScheduleAssignmentNumber(threshold)}%`);
    } else {
      const reasonCode = String(decision?.calibration?.reason || "");
      addReason(reasons, "calibrationUnavailable", CALIBRATION_REASON_LABELS[reasonCode] || "לא הייתה הסתברות מכוילת תקפה לריצה זו");
    }
  }
  if (gates.margin === false) {
    const gap = finiteNumber(decision?.rankingGap ?? decision?.margin);
    const threshold = finiteNumber(policy.minimumRankingGap);
    addReason(reasons, "margin", gap == null || threshold == null
      ? "הפער מהמועמד הבא קטן מהפער הנדרש"
      : `פער הדירוג ${formatScheduleAssignmentNumber(gap)} קטן מהפער הנדרש ${formatScheduleAssignmentNumber(threshold)} נקודות`);
  }
  if (gates.noHardConflict === false) addReason(reasons, "noHardConflict", "זוהתה סתירה מהותית בנתונים");
  if (gates.matcherValidatorAgreement === false) addReason(reasons, "matcherValidatorAgreement", "בודק ההתאמה ובודק לוח הזמנים לא הסכימו על אותה פעילות");
  if (gates.requiredRolesCompleted === false) addReason(reasons, "requiredRolesCompleted", "לא כל בדיקות המודל הנדרשות הושלמו");
  if (gates.canonicalDate === false) addReason(reasons, "canonicalDate", "להתראה אין תאריך מקור תקין");
  if (gates.activeScheduleActivity === false) addReason(reasons, "activeScheduleActivity", "המועמד אינו שייך לגרסת לוח הזמנים הפעילה");
  if (gates.freshRun === false) addReason(reasons, "freshRun", "הריצה אינה עדכנית עוד");
  if (gates.unassigned === false) addReason(reasons, "unassigned", "ההתראה כבר משויכת לפעילות");
  if (gates.autoAssignmentEnabled === false) addReason(reasons, "autoAssignmentEnabled", "מדיניות השיוך האוטומטי כבויה כרגע");
  if (!reasons.length && decision?.autoAssigned !== true) addReason(reasons, "humanReview", "המדיניות דרשה בדיקה אנושית לפני שיוך");
  return reasons;
}

export function buildScheduleAssignmentDecisionPresentation(agentResult = {}) {
  const decision = agentResult?.decision && typeof agentResult.decision === "object" ? agentResult.decision : {};
  const gates = decision.gates && typeof decision.gates === "object" ? decision.gates : {};
  const policy = decision.policy && typeof decision.policy === "object" ? decision.policy : {};
  const rankingScore = finiteNumber(decision.rankingScore ?? decision.confidence) ?? 0;
  const runnerUpRankingScore = finiteNumber(decision.runnerUpRankingScore ?? decision.runnerUpConfidence);
  const rankingGap = finiteNumber(decision.rankingGap ?? decision.margin) ?? 0;
  const probability = finiteNumber(decision.calibratedProbability);
  const calibrationStatus = String(decision.calibration?.status || "unavailable");
  const calibratedProbability = calibrationStatus === "calibrated" && probability != null
    ? Math.max(0, Math.min(1, probability))
    : null;
  const hasRunnerUp = (Array.isArray(agentResult.candidates) && agentResult.candidates.length > 1)
    || (runnerUpRankingScore != null && runnerUpRankingScore > 0);
  const gateRows = Object.entries(REVIEW_GATE_LABELS)
    .filter(([key]) => typeof gates[key] === "boolean")
    .map(([key, label]) => ({ key, label, passed: gates[key] === true }));
  const auditItems = [
    { key: "engineVersion", label: "גרסת מנוע", value: agentResult.engineVersion || decision.engineVersion || null },
    { key: "settingsVersion", label: "גרסת הגדרות", value: agentResult.settingsVersion || decision.settingsVersion || null },
    { key: "scheduleVersionId", label: "גרסת לוח זמנים", value: agentResult.scheduleVersionId || decision.scheduleVersionId || null },
    { key: "calibrator", label: "מכייל", value: decision.calibration?.artifactId || null },
    { key: "calibrationStatus", label: "מצב כיול", value: calibrationStatus || null }
  ].filter((item) => item.value);
  return {
    rankingScore,
    runnerUpRankingScore,
    rankingGap,
    hasRunnerUp,
    calibratedProbability,
    calibrationStatus,
    policy,
    reviewReasons: reviewReasons({ decision, gates, policy, calibratedProbability, calibrationStatus }),
    gateRows,
    auditItems
  };
}
