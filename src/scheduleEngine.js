// Deterministic core of the Schedule Intelligence Service.
// Spec: docs/BIDoc_Schedule_Intelligence_Engine_Spec.md (schedule-engine.v1).
//
// Purity contract (spec 4.1, acceptance criteria 1, 13, 25):
//   - no Supabase, no fetch, no process.env, no Date.now() / implicit new Date();
//   - every entry point receives `asOf` explicitly;
//   - same inputs => same output, bit for bit.
// Loading rows from the DB and stamping calculatedAt belong to the
// orchestration layer (subagents/schedule.js) — never here. Rule 001: this
// file is the only place in the repo allowed to compute schedule arithmetic.

import {
  addCalendarDays,
  calendarCoverageState,
  countWorkingDays,
  diffCalendarDays,
  normalizeCalendar,
  toIsoDate
} from "./scheduleCalendar.js";

export const ENGINE_VERSION = "schedule-engine.v1";
export const CONTRACT_VERSION = "schedule-indicator.v1";

export const SCHEDULE_STATUSES = [
  "on_track", "watch", "at_risk",
  "delayed_vs_contractor", "delayed_vs_contract",
  "milestone_at_risk", "milestone_delayed",
  "hidden_slippage",
  "completed_late", "completed_on_time",
  "insufficient_data", "source_conflict",
  "not_started", "blocked"
];

// All tunable knobs in one place (spec 3.4, 6.8). Buffers are working days
// when a calendar is applied, calendar days otherwise.
export const DEFAULT_SCHEDULE_THRESHOLDS = {
  atRiskBufferDays: 7,
  atRiskProgressFloor: 50,
  watchBufferDays: 14,
  watchProgressFloor: 75,
  hiddenSlippageDays: 7,
  staleScheduleDays: 90,
  breachSevereDays: 14,
  approachingSoonDays: 3,
  approachingSoonProgressFloor: 50,
  approachingDays: 7,
  approachingProgressFloor: 25
};

// ─── Input normalization ─────────────────────────────────────────────────────
//
// Normalized task shape (produced by scheduleIngestion.js — the only layer
// that knows table names, spec 14.1):
//   {
//     activityKey:   "gantt:<file_id>:<task_uid>"  (version-scoped, required)
//     stableKey:     <task_uid>          — identity across schedule versions
//     name, plannedStart, plannedFinish, percentComplete,
//     isSummary, isMilestone, outlineLevel,
//     sourceVersionId, totalFloatDays?, predecessors?
//   }

function normalizePercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, num));
}

function normalizeObserved(raw) {
  if (!raw || typeof raw !== "object") return null;
  const events = Array.isArray(raw.events) ? raw.events : [];
  return {
    observedStart: toIsoDate(raw.observedStart),
    observedFinish: toIsoDate(raw.observedFinish),
    progressPercent: normalizePercent(raw.progressPercent),
    hasOpenBlocker: raw.hasOpenBlocker === true,
    events
  };
}

// contract_date is a frozen historical fact; the effective date adds approved
// extensions at read time. Spec 5.3 deliberately stores no effective_date
// column — computing it anywhere but here would violate Rule 001.
export function contractEffectiveDate(milestone) {
  const base = toIsoDate(milestone?.contractDate ?? milestone?.contract_date);
  if (!base) return { date: null, extensionDaysApplied: 0 };
  const extensions = Array.isArray(milestone?.extensions) ? milestone.extensions : [];
  const approved = extensions
    .filter((ext) => (ext?.status ?? "approved") === "approved")
    .reduce((sum, ext) => {
      const days = Number(ext?.extensionDays ?? ext?.extension_days);
      return sum + (Number.isFinite(days) ? Math.round(days) : 0);
    }, 0);
  return { date: addCalendarDays(base, approved), extensionDaysApplied: approved };
}

// Forecast by percent progress (spec 6.4): total = elapsed / (percent/100).
// percent === 0 is a division by zero — forecast stays null and the status
// derives from plannedFinish alone. That is exactly the state of most overdue
// tasks in the measured data.
function buildForecast({ plannedStart, percent, asOf }) {
  if (!plannedStart || percent == null || percent <= 0 || percent >= 100) return null;
  const elapsed = diffCalendarDays(plannedStart, asOf);
  if (elapsed == null || elapsed <= 0) return null;
  const totalDays = Math.round(elapsed / (percent / 100));
  return {
    forecastFinish: addCalendarDays(plannedStart, totalDays),
    method: "percent_progress",
    assumptions: [`קצב ליניארי: ${percent}% ב-${elapsed} ימים קלנדריים`]
  };
}

// ─── The indicator ───────────────────────────────────────────────────────────

export function computeIndicator(input = {}) {
  const {
    projectId,
    task = null,
    contractMilestone = null,
    calendar: rawCalendar = null,
    previousTask = null,
    observed: rawObserved = null,
    scheduleMeta = null,
    thresholds: rawThresholds = null,
    mappingConfidence = null,
    calculatedAt = null
  } = input;

  // Programming errors throw; data errors degrade to insufficient_data.
  if (!projectId || typeof projectId !== "string") throw new Error("computeIndicator: projectId is required");
  const asOf = toIsoDate(input.asOf);
  if (!asOf) throw new Error("computeIndicator: asOf must be a valid YYYY-MM-DD date");
  if (!task && !contractMilestone) throw new Error("computeIndicator: task or contractMilestone is required");
  if (task && !task.activityKey) throw new Error("computeIndicator: task.activityKey is required");

  const thresholds = { ...DEFAULT_SCHEDULE_THRESHOLDS, ...(rawThresholds || {}) };
  const calendar = normalizeCalendar(rawCalendar);
  const observed = normalizeObserved(rawObserved);

  const plannedStart = toIsoDate(task?.plannedStart);
  const plannedFinish = toIsoDate(task?.plannedFinish);
  const previousPlannedFinish = toIsoDate(previousTask?.plannedFinish);
  const percent = normalizePercent(task?.percentComplete);
  const relevancyDate = toIsoDate(scheduleMeta?.relevancyDate);
  const isSummary = Boolean(task?.isSummary);

  // Data anomaly rule (spec 5.2): zero-duration => milestone even when the
  // source flag is off. Measured on the real file: "צו תחילת עבודה" et al.
  const zeroDuration = Boolean(plannedStart && plannedFinish && plannedStart === plannedFinish);
  const milestoneInferred = zeroDuration && task ? task.isMilestone !== true : false;
  const isMilestone = !task || task.isMilestone === true || zeroDuration;

  const { date: contractDate, extensionDaysApplied } = contractEffectiveDate(contractMilestone);

  // Summary rollup percent is a weighted artifact (measured: 9% vs children
  // 25/0/0/0/23) — never forecast from it. Envelope dates remain meaningful.
  const forecast = isSummary ? null : buildForecast({ plannedStart, percent, asOf });
  const forecastFinish = forecast?.forecastFinish ?? null;

  // Basis priority (spec 3.2): contract → contractor planned → forecast.
  let basis = null;
  let basisDate = null;
  if (contractDate) {
    basis = "contract_finish";
    basisDate = contractDate;
  } else if (plannedFinish) {
    basis = "contractor_planned_finish";
    basisDate = plannedFinish;
  } else if (forecastFinish) {
    basis = "forecast_finish";
    basisDate = forecastFinish;
  }

  // ── Completion, conflicts, lateness ────────────────────────────────────────
  const observedFinish = observed?.observedFinish ?? null;
  const versionConflict = scheduleMeta?.versionConflict === true;
  const observedConflict = Boolean(observedFinish && percent != null && percent < 100);
  const hasConflict = versionConflict || observedConflict;

  let completed = false;
  let completionInferred = false;
  let completionUnverified = false;
  if (!hasConflict && observedFinish) {
    completed = true;
  } else if (!hasConflict && percent === 100 && !isSummary) {
    // 100% reported, no actual finish captured. Completion time is bounded by
    // the schedule's data date: if that bound is on or before the basis date —
    // or the deadline simply has not passed yet — on-time is provable.
    if (basisDate && relevancyDate && diffCalendarDays(relevancyDate, basisDate) >= 0) {
      completed = true;
      completionInferred = true;
    } else if (basisDate && diffCalendarDays(asOf, basisDate) >= 0) {
      completed = true;
      completionInferred = true;
    } else {
      completionUnverified = true; // done per contractor, timing unprovable
    }
  }

  const lateness = { isLate: null, daysLate: null, workingDaysLate: null, daysRemaining: null, workingDaysRemaining: null, basis, basisDate };
  let latenessWindowEnd = asOf;
  if (basisDate && !completed && !completionUnverified && !hasConflict) {
    const delta = diffCalendarDays(basisDate, asOf);
    lateness.isLate = delta > 0;
    if (delta > 0) {
      // Criterion 3: daysLate is never 0 — "not late" is represented by null only.
      lateness.daysLate = delta;
      lateness.workingDaysLate = calendar ? countWorkingDays(basisDate, asOf, calendar) : null;
      latenessWindowEnd = asOf;
    } else {
      lateness.daysRemaining = Math.abs(delta); // abs, not negation: -0 is not a value
      lateness.workingDaysRemaining = calendar ? countWorkingDays(asOf, basisDate, calendar) : null;
      latenessWindowEnd = basisDate;
    }
  }

  const calendarState = calendarCoverageState(calendar, latenessWindowEnd);

  // ── Variances (spec 6.5) ───────────────────────────────────────────────────
  const progressFinish = observedFinish ?? forecastFinish; // best available "real" finish
  const slippage = (previousPlannedFinish && plannedFinish)
    ? diffCalendarDays(previousPlannedFinish, plannedFinish)
    : null;
  const variances = {
    fromContractDays: contractDate && progressFinish ? diffCalendarDays(contractDate, progressFinish) : null,
    fromCurrentScheduleDays: plannedFinish && progressFinish ? diffCalendarDays(plannedFinish, progressFinish) : null,
    contractorVersionSlippageDays: slippage,
    observedVarianceDays: observedFinish && (plannedFinish || basisDate)
      ? diffCalendarDays(plannedFinish ?? basisDate, observedFinish)
      : null,
    milestoneImpactDays: contractDate && progressFinish && (isMilestone || contractMilestone?.activityKey === task?.activityKey)
      ? diffCalendarDays(contractDate, progressFinish)
      : null,
    // null, never false/0: without dependency data the engine cannot assert
    // float (spec 6.7 — blocked on parser extension, gate 🟠). The explicit
    // null check matters: Number(null) is 0, and a fabricated zero float would
    // falsely claim the activity is on the critical path.
    remainingFloatDays: task?.totalFloatDays != null && Number.isFinite(Number(task.totalFloatDays))
      ? Number(task.totalFloatDays)
      : null
  };

  // ── Status classification (spec 6.8) ───────────────────────────────────────
  // Documented priority: insufficient → conflict → completed → delayed →
  // blocked → at_risk → hidden_slippage → not_started → watch → on_track.
  // Lateness outranks a blocker (the breach already happened); a concrete
  // blocker outranks a projection (at_risk).
  const bufferRemaining = lateness.workingDaysRemaining ?? lateness.daysRemaining;
  let status;
  if (!basisDate) {
    status = "insufficient_data";
  } else if (hasConflict) {
    status = "source_conflict";
  } else if (completionUnverified) {
    status = "insufficient_data";
  } else if (completed) {
    const finishForJudgment = observedFinish ?? relevancyDate ?? asOf;
    status = diffCalendarDays(basisDate, finishForJudgment) > 0 ? "completed_late" : "completed_on_time";
  } else if (lateness.isLate) {
    status = isMilestone ? "milestone_delayed" : basis === "contract_finish" ? "delayed_vs_contract" : "delayed_vs_contractor";
  } else if (observed?.hasOpenBlocker) {
    status = "blocked";
  } else if ((forecastFinish && diffCalendarDays(basisDate, forecastFinish) > 0)
    || (!isSummary && bufferRemaining != null && bufferRemaining <= thresholds.atRiskBufferDays
        && percent != null && percent < thresholds.atRiskProgressFloor)) {
    status = isMilestone ? "milestone_at_risk" : "at_risk";
  } else if (slippage != null && slippage > thresholds.hiddenSlippageDays) {
    status = "hidden_slippage";
  } else if (!isSummary && percent === 0 && plannedStart && diffCalendarDays(asOf, plannedStart) > 0) {
    status = "not_started";
  } else if (!isSummary && bufferRemaining != null && bufferRemaining <= thresholds.watchBufferDays
    && (percent == null || percent < thresholds.watchProgressFloor)) {
    status = "watch";
  } else {
    status = "on_track";
  }

  // ── Confidence (spec 7) ────────────────────────────────────────────────────
  const scheduleAgeDays = relevancyDate ? diffCalendarDays(relevancyDate, asOf) : null;
  const staleSchedule = scheduleAgeDays != null && scheduleAgeDays > thresholds.staleScheduleDays;
  const hasObservedCorroboration = Boolean(observed && (observed.observedStart || observed.observedFinish
    || observed.progressPercent != null || observed.events.length));
  const factors = [];
  let score = 0.7;
  factors.push({ factor: "contractor_schedule_source", delta: 0.7 });
  if (basis === "contract_finish") { score += 0.05; factors.push({ factor: "contract_basis", delta: 0.05 }); }
  if (scheduleAgeDays == null && task) { score -= 0.05; factors.push({ factor: "unknown_schedule_age", delta: -0.05 }); }
  if (staleSchedule) {
    const delta = scheduleAgeDays > 180 ? -0.25 : -0.15;
    score += delta;
    factors.push({ factor: "stale_schedule", delta, ageDays: scheduleAgeDays });
  }
  if (calendarState !== "ok" && (lateness.workingDaysLate != null || lateness.workingDaysRemaining != null)) {
    score -= 0.05;
    factors.push({ factor: "calendar_" + calendarState, delta: -0.05 });
  }
  if (hasObservedCorroboration) { score += 0.1; factors.push({ factor: "observed_corroboration", delta: 0.1 }); }
  if (completionInferred) { score -= 0.1; factors.push({ factor: "completion_inferred", delta: -0.1 }); }
  if (hasConflict) { score -= 0.2; factors.push({ factor: "source_conflict", delta: -0.2 }); }
  if (mappingConfidence != null && Number(mappingConfidence) < 0.8) {
    score -= 0.15;
    factors.push({ factor: "uncertain_mapping", delta: -0.15 });
  }
  score = Math.min(1, Math.max(0, score));
  // A stale schedule as the only source can never yield "high" (spec 7).
  if (staleSchedule && !hasObservedCorroboration && basis !== "contract_finish") score = Math.min(score, 0.79);
  score = Math.round(score * 100) / 100;
  const confidence = {
    score,
    level: score >= 0.8 ? "high" : score >= 0.55 ? "medium" : "low",
    factors
  };

  // ── Impact (spec 3.2) — null unless directly provable ─────────────────────
  const contractLinked = Boolean(contractMilestone && (contractMilestone.activityKey == null
    || contractMilestone.activityKey === task?.activityKey || !task));
  const lateOrRisk = lateness.isLate === true || status === "at_risk" || status === "milestone_at_risk";
  const impact = {
    affectsMilestone: contractLinked && lateOrRisk ? true : null,
    affectsProjectFinish: contractLinked && contractMilestone?.isProjectCompletion === true && lateness.isLate === true ? true : null,
    affectedMilestoneIds: contractLinked && lateOrRisk && contractMilestone?.milestoneKey ? [contractMilestone.milestoneKey] : [],
    affectedActivityIds: []
  };

  const subject = {
    kind: task ? "activity" : "milestone",
    activityKey: task?.activityKey ?? contractMilestone?.activityKey ?? null,
    milestoneKey: contractMilestone?.milestoneKey ?? null,
    name: task?.name ?? contractMilestone?.name ?? "",
    isSummary,
    isMilestone,
    milestoneInferred,
    outlineLevel: task?.outlineLevel ?? null,
    sourceType: task ? "contractor_schedule" : "contract",
    sourceVersionId: task?.sourceVersionId ?? scheduleMeta?.sourceVersionId ?? null
  };

  const timing = {
    plannedStart,
    plannedFinish,
    observedStart: observed?.observedStart ?? null,
    observedFinish,
    forecastFinish,
    contractFinish: contractDate,
    previousPlannedFinish,
    percentComplete: percent
  };

  const explanation = buildExplanation({
    asOf, basis, basisDate, lateness, percent, status, subject,
    extensionDaysApplied, versionCount: scheduleMeta?.versionCount ?? null,
    milestoneInferred, completionInferred, completionUnverified,
    versionConflict, observedConflict, observedFinish, slippage,
    scheduleAgeDays, staleSchedule, calendarState, isSummary,
    hasOpenBlocker: observed?.hasOpenBlocker === true,
    hiddenSlippage: status === "hidden_slippage"
  });

  const evidence = buildEvidence({ task, subject, contractMilestone, contractDate, extensionDaysApplied, previousTask, previousPlannedFinish, observed, scheduleMeta, plannedStart, plannedFinish, percent });

  const gates = {
    contractAxis: contractMilestone ? "ok" : "missing",
    scheduleVersions: scheduleMeta?.versionCount ?? (task ? 1 : 0),
    dependencies: Array.isArray(task?.predecessors) && task.predecessors.length ? "ok" : "missing",
    observedEvents: hasObservedCorroboration ? "ok" : "missing",
    calendar: calendarState
  };

  return {
    contractVersion: CONTRACT_VERSION,
    engineVersion: ENGINE_VERSION,
    projectId,
    asOf,
    calculatedAt: calculatedAt ?? null, // stamped by the orchestrator, not here
    subject,
    timing,
    lateness,
    status,
    variances,
    confidence,
    impact,
    explanation,
    evidence,
    gates
  };
}

// ─── Hebrew explanation, composed deterministically (no LLM) ─────────────────

function buildExplanation(ctx) {
  const parts = [];
  if (ctx.basis === "contract_finish") {
    parts.push(`המועד החוזי הקובע הוא ${ctx.basisDate}${ctx.extensionDaysApplied > 0 ? ` (כולל ${ctx.extensionDaysApplied} ימי הארכה מאושרים)` : ""}.`);
  } else if (ctx.basis === "contractor_planned_finish") {
    const versionPhrase = ctx.versionCount != null && ctx.versionCount > 1 ? "בגרסת לוח הקבלן הנוכחית" : "בלוח הקבלן היחיד שנקלט";
    parts.push(`תאריך הסיום המתוכנן ${versionPhrase} הוא ${ctx.basisDate}.`);
  } else if (ctx.basis === "forecast_finish") {
    parts.push(`בהיעדר תאריך מתוכנן, הבסיס הוא תחזית: ${ctx.basisDate}.`);
  } else {
    parts.push("לא נמצא תאריך ייחוס — לא בחוזה, לא בלוח הקבלן ולא בתחזית.");
  }

  if (ctx.lateness.daysLate != null) {
    parts.push(`נכון ל-${ctx.asOf} חלפו ${ctx.lateness.daysLate} ימים קלנדריים${ctx.lateness.workingDaysLate != null ? ` (${ctx.lateness.workingDaysLate} ימי עבודה)` : ""} מהמועד.`);
  } else if (ctx.lateness.daysRemaining != null) {
    parts.push(`נכון ל-${ctx.asOf} נותרו ${ctx.lateness.daysRemaining} ימים קלנדריים${ctx.lateness.workingDaysRemaining != null ? ` (${ctx.lateness.workingDaysRemaining} ימי עבודה)` : ""} עד המועד.`);
  }

  if (ctx.percent != null) {
    parts.push(`אחוז הביצוע המדווח הוא ${ctx.percent}.`);
    if (ctx.percent === 0 && ctx.lateness.isLate === true) parts.push("לא נמצאה ראיה לתחילת ביצוע.");
  }

  if (ctx.isSummary) parts.push("זוהי משימת סיכום: התאריכים הם מעטפת של תתי-המשימות, ואחוז הביצוע המשוקלל אינו משמש לתחזית.");
  if (ctx.milestoneInferred) parts.push("הפעילות טופלה כאבן דרך (התחלה וסיום באותו תאריך) אף שהדגל בלוח כבוי.");
  if (ctx.completionInferred) parts.push("ההשלמה הוסקה מדיווח 100% בלוח הקבלן; תאריך סיום בפועל לא נקלט.");
  if (ctx.completionUnverified) parts.push("דווח ביצוע של 100% אך אין תאריך סיום בפועל, והמועד הקובע כבר חלף — לא ניתן לקבוע אם ההשלמה הייתה בזמן.");
  if (ctx.versionConflict) parts.push("שתי גרסאות לוח מסומנות כנוכחיות — נדרשת הכרעה.");
  if (ctx.observedConflict) parts.push(`דיווח ההתקדמות (${ctx.percent}%) סותר תאריך סיום שנצפה (${ctx.observedFinish}).`);
  if (ctx.hiddenSlippage && ctx.slippage != null) parts.push(`התאריך נדחה ב-${ctx.slippage} ימים לעומת הגרסה הקודמת ללא הודעת עיכוב.`);
  if (ctx.hasOpenBlocker) parts.push("קיים חסם פתוח.");
  if (ctx.staleSchedule) parts.push(`גרסת הלוח בת ${ctx.scheduleAgeDays} ימים — רמת הביטחון הופחתה.`);
  if (ctx.calendarState === "stale" && (ctx.lateness.workingDaysLate != null || ctx.lateness.workingDaysRemaining != null)) {
    parts.push("רשימת החגים אינה מכסה את התקופה הנמדדת — ימי העבודה עלולים להיות מנופחים.");
  }
  return parts.join(" ");
}

function buildEvidence(ctx) {
  const evidence = [];
  if (ctx.task) {
    evidence.push({
      evidenceId: ctx.task.activityKey,
      kind: "contractor_schedule",
      filename: ctx.scheduleMeta?.displayName ?? ctx.subject.sourceVersionId ?? null,
      eventDate: ctx.plannedFinish ?? ctx.plannedStart ?? null,
      excerpt: `${ctx.subject.name} — ${ctx.plannedStart ?? "?"} עד ${ctx.plannedFinish ?? "?"}, ${ctx.percent ?? "?"}% ביצוע`
    });
  }
  if (ctx.contractMilestone && ctx.contractDate) {
    evidence.push({
      evidenceId: `contract:${ctx.contractMilestone.milestoneKey ?? "milestone"}`,
      kind: "contract_milestone",
      documentId: ctx.contractMilestone.sourceDocumentId ?? null,
      eventDate: ctx.contractDate,
      excerpt: `${ctx.contractMilestone.name ?? ""} — מועד חוזי ${ctx.contractDate}${ctx.extensionDaysApplied > 0 ? ` (כולל ${ctx.extensionDaysApplied} ימי הארכה)` : ""}`
    });
  }
  if (ctx.previousTask && ctx.previousPlannedFinish) {
    evidence.push({
      evidenceId: ctx.previousTask.activityKey ?? `previous:${ctx.task?.activityKey ?? ""}`,
      kind: "contractor_schedule_previous",
      filename: ctx.previousTask.sourceVersionId ?? null,
      eventDate: ctx.previousPlannedFinish,
      excerpt: `גרסה קודמת: סיום מתוכנן ${ctx.previousPlannedFinish}`
    });
  }
  for (const event of ctx.observed?.events ?? []) {
    evidence.push({
      evidenceId: `observed:${event.sourceTable ?? "?"}:${event.sourceId ?? "?"}:${event.eventType ?? "?"}`,
      kind: "observed_event",
      documentId: event.sourceId ?? null,
      eventDate: toIsoDate(event.eventDate),
      excerpt: String(event.evidenceText ?? event.excerpt ?? "").slice(0, 240)
    });
  }
  return evidence;
}

// ─── Alert derivation (spec 3.4 / 3.5) ───────────────────────────────────────
//
// Severity comes from the numbers, never from a fixed per-type value. Working
// days drive the thresholds; calendar days substitute when no calendar exists
// (slightly more severe — days accrue faster — and documented as such).

export function deriveSeverity(indicator, rawThresholds = null) {
  if (!indicator || indicator.subject?.isSummary) return null; // 3.3 rule 2
  const thresholds = { ...DEFAULT_SCHEDULE_THRESHOLDS, ...(rawThresholds || {}) };
  const { lateness, subject, impact, timing, status } = indicator;
  if (status === "insufficient_data" || status === "source_conflict") return null; // 3.3 rule 1
  if (status === "completed_late" || status === "completed_on_time") return null;

  const late = lateness.workingDaysLate ?? lateness.daysLate;
  const remaining = lateness.workingDaysRemaining ?? lateness.daysRemaining;
  const percent = timing?.percentComplete;

  if (lateness.isLate === true && subject.isMilestone && lateness.basis === "contract_finish") return 5;
  if (impact?.affectsProjectFinish === true) return 5;
  if (late != null && late > thresholds.breachSevereDays) return 4;
  if (late != null && late >= 1) return 3;
  if (remaining != null && remaining <= thresholds.approachingSoonDays
    && percent != null && percent < thresholds.approachingSoonProgressFloor) return 3;
  if (remaining != null && remaining <= thresholds.approachingDays
    && percent != null && percent < thresholds.approachingProgressFloor) return 2;
  return null;
}

// Returns { alertType, severityLevel } for schedule_alerts, or null when the
// indicator does not warrant an alert (spec 3.5 — engine-owned types only).
export function deriveAlert(indicator, rawThresholds = null) {
  const severityLevel = deriveSeverity(indicator, rawThresholds);
  if (severityLevel == null) return null;
  const alertType = indicator.lateness.isLate === true ? "schedule_breach" : "schedule_approaching";
  return { alertType, severityLevel };
}

// ─── Sweep (spec 3.1 mode B) ─────────────────────────────────────────────────
//
// The proactive mode: "what is breaching?" across a whole normalized task set.
// Cross-version identity uses stableKey (task_uid) because activityKey embeds
// the file_id and therefore changes with every uploaded version.

export function sweep(input = {}) {
  const {
    projectId,
    tasks = [],
    contractMilestones = [],
    previousTasks = [],
    observedByActivity = {},
    calendar = null,
    scheduleMeta = null,
    thresholds = null,
    filters: rawFilters = {},
    calculatedAt = null
  } = input;
  const asOf = toIsoDate(input.asOf);
  if (!asOf) throw new Error("sweep: asOf must be a valid YYYY-MM-DD date");

  const filters = {
    excludeSummary: true,
    excludeCompleted: true,
    ...rawFilters
  };

  const milestoneByActivity = new Map(
    contractMilestones.filter((m) => m?.activityKey).map((m) => [m.activityKey, m])
  );
  const previousByStableKey = new Map(
    previousTasks.map((t) => [t?.stableKey ?? t?.activityKey, t]).filter(([key]) => key != null)
  );

  const indicators = [];
  for (const task of tasks) {
    if (!task?.activityKey) continue;
    if (filters.excludeSummary && task.isSummary) continue; // 3.3 rule 2
    const indicator = computeIndicator({
      projectId,
      task,
      asOf,
      calendar,
      scheduleMeta,
      thresholds,
      calculatedAt,
      contractMilestone: milestoneByActivity.get(task.activityKey) ?? null,
      previousTask: previousByStableKey.get(task.stableKey ?? task.activityKey) ?? null,
      observed: observedByActivity[task.activityKey] ?? null
    });
    indicator.severity = deriveSeverity(indicator, thresholds);
    indicators.push(indicator);
  }

  const matched = indicators.filter((ind) => {
    if (filters.excludeCompleted && (ind.status === "completed_late" || ind.status === "completed_on_time")) return false;
    if (filters.isLate === true && ind.lateness.isLate !== true) return false;
    if (filters.isLate === false && ind.lateness.isLate === true) return false;
    if (filters.minDaysLate != null && !(ind.lateness.daysLate >= filters.minDaysLate)) return false;
    if (filters.dueWithinDays != null
      && !(ind.lateness.daysRemaining != null && ind.lateness.daysRemaining <= filters.dueWithinDays)) return false;
    if (filters.dueWithinWorkingDays != null
      && !(ind.lateness.workingDaysRemaining != null && ind.lateness.workingDaysRemaining <= filters.dueWithinWorkingDays)) return false;
    if (Array.isArray(filters.statuses) && filters.statuses.length && !filters.statuses.includes(ind.status)) return false;
    if (filters.minConfidence != null && !(ind.confidence.score >= filters.minConfidence)) return false;
    if (filters.minSeverity != null && !(ind.severity != null && ind.severity >= filters.minSeverity)) return false;
    return true;
  });

  // Deterministic order: most late first, then closest deadline, then key.
  matched.sort((a, b) =>
    (b.lateness.daysLate ?? -1) - (a.lateness.daysLate ?? -1)
    || (a.lateness.daysRemaining ?? Infinity) - (b.lateness.daysRemaining ?? Infinity)
    || String(a.subject.activityKey).localeCompare(String(b.subject.activityKey))
  );

  return {
    contractVersion: CONTRACT_VERSION,
    engineVersion: ENGINE_VERSION,
    projectId: projectId ?? null,
    asOf,
    total: indicators.length,
    matchedCount: matched.length,
    indicators: matched
  };
}
