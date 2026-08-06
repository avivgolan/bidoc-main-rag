// Deterministic test vectors for the Schedule Intelligence Engine (spec 4.1).
// Every vector uses a fixed asOf — nothing here depends on the wall clock.
// Run: node test/schedule-engine.test.js   (or npm run test:schedule)

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  computeIndicator, deriveAlert, deriveSeverity, sweep,
  contractEffectiveDate, CONTRACT_VERSION, ENGINE_VERSION
} from "../src/scheduleEngine.js";
import {
  addCalendarDays, calendarCoverageState, countWorkingDays,
  diffCalendarDays, normalizeCalendar, toIsoDate
} from "../src/scheduleCalendar.js";
import {
  buildActivityKey, MAIN_GANTT_SOURCE, normalizeGanttTask, pickCurrentVersion,
  scheduleSettings, scheduleSupabaseConfig, SCHEDULE_SOURCE_PROFILES
} from "../src/scheduleIngestion.js";
import {
  buildScheduleHealth, scheduleDataVersion, snapshotRowFromIndicator,
  buildScheduleWorkflowLog, planScheduleAlerts, subjectKeyOf,
  BOOTSTRAP_SUMMARY_KEY, SCHEDULE_HEALTH_VERSION
} from "../src/subagents/schedule.js";
import {
  addWorkingDays, milestoneKeyForCondition, normalizeEvidenceResult,
  promotionRows, resolveConditionDueDate, runScheduleConditionResolver,
  scheduleResolverError, settingsOwnedAiConfig
} from "../src/subagents/scheduleConditionResolver.js";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const AS_OF = "2026-08-04";
const PROJECT = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const CAL = { workingWeekdays: [0, 1, 2, 3, 4], holidays: [] };

// Mirrors the real measured row: "אישור גופי תאורה" — the spec's flagship case.
const LIGHTING_TASK = {
  activityKey: "gantt:file-a:9",
  stableKey: 9,
  name: "אישור גופי תאורה",
  plannedStart: "2025-12-02",
  plannedFinish: "2025-12-21",
  percentComplete: 0,
  isSummary: false,
  isMilestone: false,
  outlineLevel: 3,
  sourceVersionId: "file-a"
};

// ─── calendar module ─────────────────────────────────────────────────────────

test("schedule calendar: calendar-day arithmetic is UTC-stable", () => {
  assert.equal(diffCalendarDays("2025-12-21", "2026-08-04"), 226);
  assert.equal(addCalendarDays("2026-01-01", 30), "2026-01-31");
  assert.equal(addCalendarDays("2026-02-28", 1), "2026-03-01");
  assert.equal(toIsoDate("2026-08-04T17:00:00Z"), "2026-08-04");
  assert.equal(toIsoDate("not-a-date"), null);
});

test("schedule calendar: working days count strictly after from, inclusive of to", () => {
  const cal = normalizeCalendar(CAL);
  // Thu -> Sun with Fri+Sat off: only Sunday counts.
  assert.equal(countWorkingDays("2026-08-06", "2026-08-09", cal), 1);
  assert.equal(countWorkingDays("2026-08-04", "2026-08-04", cal), 0);
  assert.equal(countWorkingDays("2026-08-09", "2026-08-06", cal), -1); // symmetric
  // Holiday inside the window is skipped.
  const withHoliday = normalizeCalendar({ ...CAL, holidays: ["2026-08-09"] });
  assert.equal(countWorkingDays("2026-08-06", "2026-08-09", withHoliday), 0);
  // The spec's flagship window: 226 calendar days == 162 Sun-Thu working days.
  assert.equal(countWorkingDays("2025-12-21", "2026-08-04", cal), 162);
});

test("schedule calendar: coverage state reflects holidays_through", () => {
  assert.equal(calendarCoverageState(null, AS_OF), "missing");
  assert.equal(calendarCoverageState(normalizeCalendar(CAL), AS_OF), "stale"); // no holidaysThrough
  assert.equal(calendarCoverageState(normalizeCalendar({ ...CAL, holidaysThrough: "2026-12-31" }), AS_OF), "ok");
  assert.equal(calendarCoverageState(normalizeCalendar({ ...CAL, holidaysThrough: "2026-01-01" }), AS_OF), "stale");
});

// ─── the flagship breach ─────────────────────────────────────────────────────

test("schedule engine: 226-day breach matches the spec example bit for bit", () => {
  const ind = computeIndicator({
    projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF, calendar: CAL,
    scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1, displayName: "לוז מעודכן 03.12.25" }
  });
  assert.equal(ind.contractVersion, CONTRACT_VERSION);
  assert.equal(ind.engineVersion, ENGINE_VERSION);
  assert.equal(ind.status, "delayed_vs_contractor");
  assert.equal(ind.lateness.isLate, true);
  assert.equal(ind.lateness.daysLate, 226);
  assert.equal(ind.lateness.workingDaysLate, 162);
  assert.equal(ind.lateness.daysRemaining, null);
  assert.equal(ind.lateness.basis, "contractor_planned_finish");
  assert.equal(ind.lateness.basisDate, "2025-12-21");
  // Stale 244-day-old schedule as the only source can never be "high".
  assert.equal(ind.confidence.level, "low");
  assert.ok(ind.confidence.factors.some((f) => f.factor === "stale_schedule"));
  assert.match(ind.explanation, /תאריך הסיום המתוכנן בלוח הקבלן היחיד שנקלט הוא 2025-12-21/);
  assert.match(ind.explanation, /חלפו 226 ימים קלנדריים \(162 ימי עבודה\)/);
  assert.match(ind.explanation, /לא נמצאה ראיה לתחילת ביצוע/);
  assert.equal(ind.evidence[0].evidenceId, "gantt:file-a:9");
  assert.equal(ind.gates.contractAxis, "missing");
  assert.equal(ind.gates.dependencies, "missing");
  assert.equal(ind.gates.calendar, "stale");
});

test("schedule engine: daysLate and daysRemaining are mutually exclusive, zero is never late", () => {
  // Due exactly today: not late, zero days remaining — daysLate must be null, never 0.
  const dueToday = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { ...LIGHTING_TASK, plannedFinish: AS_OF, plannedStart: "2026-07-01" }
  });
  assert.equal(dueToday.lateness.isLate, false);
  assert.equal(dueToday.lateness.daysLate, null);
  assert.equal(dueToday.lateness.daysRemaining, 0);
  // One day past: late by exactly 1.
  const oneLate = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { ...LIGHTING_TASK, plannedFinish: "2026-08-03", plannedStart: "2026-07-01" }
  });
  assert.equal(oneLate.lateness.daysLate, 1);
  assert.equal(oneLate.lateness.daysRemaining, null);
});

test("schedule engine: no dates means insufficient_data, not on_track", () => {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:99", name: "ללא תאריכים", percentComplete: 40 }
  });
  assert.equal(ind.status, "insufficient_data");
  assert.equal(ind.lateness.isLate, null);
  assert.equal(ind.lateness.daysLate, null);
  assert.equal(ind.lateness.daysRemaining, null);
  assert.equal(ind.lateness.basisDate, null);
  // Contract fields still present and complete (criterion 10).
  assert.ok(ind.confidence.score >= 0 && ind.confidence.score <= 1);
  assert.equal(typeof ind.explanation, "string");
});

test("schedule engine: working-day fields are null without a calendar, never guessed", () => {
  const ind = computeIndicator({ projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF });
  assert.equal(ind.lateness.daysLate, 226);
  assert.equal(ind.lateness.workingDaysLate, null);
  assert.equal(ind.gates.calendar, "missing");
});

// ─── data anomalies from the measured file ───────────────────────────────────

test("schedule engine: zero-duration task is a milestone even when the flag is off", () => {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: {
      activityKey: "gantt:file-a:2", name: "קבלת תכנון-אבן דרך א'- בינוי",
      plannedStart: "2025-09-29", plannedFinish: "2025-09-29",
      percentComplete: 0, isMilestone: false
    }
  });
  assert.equal(ind.subject.isMilestone, true);
  assert.equal(ind.subject.milestoneInferred, true);
  assert.equal(ind.status, "milestone_delayed");
  assert.match(ind.explanation, /טופלה כאבן דרך/);
});

test("schedule engine: summary rollup percent never feeds a forecast", () => {
  // Measured anomaly: summary shows 9% while children show 25/0/0/0/23.
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: {
      activityKey: "gantt:file-a:13", name: "אישורי חשמל", isSummary: true,
      plannedStart: "2025-11-17", plannedFinish: "2026-01-12", percentComplete: 9
    }
  });
  assert.equal(ind.timing.forecastFinish, null);
  assert.equal(ind.subject.isSummary, true);
  assert.equal(ind.lateness.daysLate, 204); // envelope dates stay meaningful
  assert.match(ind.explanation, /משימת סיכום/);
  assert.equal(deriveSeverity(ind), null); // summaries never alert (3.3 rule 2)
});

// ─── completion inference ────────────────────────────────────────────────────

test("schedule engine: 100% bounded by the data date proves on-time completion", () => {
  // Measured row: finish 2025-12-31, 100%, relevancy 2025-12-03 <= finish.
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:1192", name: "הזמנה ואספקה תקרות אקוסטיות", plannedStart: "2025-12-04", plannedFinish: "2025-12-31", percentComplete: 100 },
    scheduleMeta: { relevancyDate: "2025-12-03" }
  });
  assert.equal(ind.status, "completed_on_time");
  assert.equal(ind.lateness.daysLate, null);
  assert.equal(ind.lateness.daysRemaining, null);
  assert.ok(ind.confidence.factors.some((f) => f.factor === "completion_inferred"));
});

test("schedule engine: 100% past deadline with a later data date is honestly insufficient", () => {
  // Measured row: finish 2025-09-28, 100%, relevancy 2025-12-03 — completion
  // could be either side of the deadline. Claiming on-time would be a lie.
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:1", name: "צו תחילת עבודה", plannedStart: "2025-09-28", plannedFinish: "2025-09-28", percentComplete: 100 },
    scheduleMeta: { relevancyDate: "2025-12-03" }
  });
  assert.equal(ind.status, "insufficient_data");
  assert.match(ind.explanation, /לא ניתן לקבוע אם ההשלמה הייתה בזמן/);
  assert.equal(deriveSeverity(ind), null); // and it never alerts
});

test("schedule engine: observed finish beats inference and judges lateness", () => {
  const late = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:50", name: "טיח", plannedStart: "2026-01-01", plannedFinish: "2026-02-01", percentComplete: 100 },
    observed: { observedFinish: "2026-03-01" }
  });
  assert.equal(late.status, "completed_late");
  assert.equal(late.variances.observedVarianceDays, 28);
  const onTime = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:51", name: "טיח", plannedStart: "2026-01-01", plannedFinish: "2026-02-01", percentComplete: 100 },
    observed: { observedFinish: "2026-01-20" }
  });
  assert.equal(onTime.status, "completed_on_time");
});

// ─── conflicts, blockers, not started ────────────────────────────────────────

test("schedule engine: observed finish contradicting reported progress is a source_conflict", () => {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:60", name: "ריצוף", plannedStart: "2026-01-01", plannedFinish: "2026-02-01", percentComplete: 40 },
    observed: { observedFinish: "2026-01-15" }
  });
  assert.equal(ind.status, "source_conflict");
  assert.equal(ind.lateness.isLate, null); // contested — no lateness claim
  assert.equal(deriveSeverity(ind), null); // 3.3 rule 1: conflicts don't alert
  assert.match(ind.explanation, /סותר/);
});

test("schedule engine: two current versions is a source_conflict", () => {
  const ind = computeIndicator({
    projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF,
    scheduleMeta: { versionConflict: true }
  });
  assert.equal(ind.status, "source_conflict");
});

test("schedule engine: an open blocker outranks a projection but not a breach", () => {
  const blocked = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:70", name: "מעלית", plannedStart: "2026-05-01", plannedFinish: "2026-09-30", percentComplete: 50 },
    observed: { hasOpenBlocker: true }
  });
  assert.equal(blocked.status, "blocked"); // forecast breaches, blocker still wins
  const breached = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:71", name: "מעלית", plannedStart: "2026-01-01", plannedFinish: "2026-07-01", percentComplete: 50 },
    observed: { hasOpenBlocker: true }
  });
  assert.equal(breached.status, "delayed_vs_contractor"); // lateness outranks blocker
});

test("schedule engine: future task with zero progress is not_started", () => {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    task: { activityKey: "gantt:file-a:80", name: "מסירה", plannedStart: "2026-09-01", plannedFinish: "2026-10-01", percentComplete: 0 }
  });
  assert.equal(ind.status, "not_started");
  assert.equal(ind.lateness.daysRemaining, 58);
});

// ─── forecast, at_risk, hidden slippage ──────────────────────────────────────

test("schedule engine: percent-progress forecast breaching the plan flags at_risk", () => {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: "2026-01-31",
    task: { activityKey: "gantt:file-a:90", name: "שלד", plannedStart: "2026-01-01", plannedFinish: "2026-03-01", percentComplete: 25 }
  });
  // elapsed 30 / 25% => 120 total => forecast 2026-05-01
  assert.equal(ind.timing.forecastFinish, "2026-05-01");
  assert.equal(ind.status, "at_risk");
  assert.equal(ind.lateness.isLate, false);
  assert.equal(ind.variances.fromCurrentScheduleDays, 61);
});

test("schedule engine: zero percent never divides — no forecast, plan is the basis", () => {
  const ind = computeIndicator({ projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF });
  assert.equal(ind.timing.forecastFinish, null);
  assert.equal(ind.lateness.basis, "contractor_planned_finish");
});

test("schedule engine: quiet slip between versions is hidden_slippage", () => {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: "2025-12-01",
    task: { activityKey: "gantt:file-b:100", stableKey: 100, name: "חיפוי", plannedStart: "2025-10-01", plannedFinish: "2026-02-01", percentComplete: 50, sourceVersionId: "file-b" },
    previousTask: { activityKey: "gantt:file-a:100", stableKey: 100, plannedFinish: "2026-01-01", sourceVersionId: "file-a" }
  });
  assert.equal(ind.status, "hidden_slippage");
  assert.equal(ind.variances.contractorVersionSlippageDays, 31);
  assert.match(ind.explanation, /נדחה ב-31 ימים/);
});

// ─── the contract axis ───────────────────────────────────────────────────────

test("schedule engine: effective date = contract date + approved extensions only", () => {
  const milestone = {
    milestoneKey: "m-completion", name: "מסירת הפרויקט", contractDate: "2026-06-01",
    isProjectCompletion: true,
    extensions: [
      { extensionDays: 30, status: "approved" },
      { extensionDays: 15, status: "claimed" },   // claimed ≠ approved — excluded
      { extensionDays: 10, status: "rejected" }
    ]
  };
  assert.deepEqual(contractEffectiveDate(milestone), { date: "2026-07-01", extensionDaysApplied: 30 });
  const ind = computeIndicator({ projectId: PROJECT, contractMilestone: milestone, asOf: AS_OF });
  assert.equal(ind.subject.kind, "milestone");
  assert.equal(ind.lateness.basis, "contract_finish");
  assert.equal(ind.lateness.basisDate, "2026-07-01");
  assert.equal(ind.lateness.daysLate, 34);
  assert.equal(ind.status, "milestone_delayed");
  assert.equal(deriveSeverity(ind), 5); // contract milestone breached
  assert.match(ind.explanation, /כולל 30 ימי הארכה מאושרים/);
});

test("schedule engine: impact is null when not provable, never false", () => {
  const futureMilestone = { milestoneKey: "m2", name: "טופס 4", contractDate: "2026-12-01", activityKey: "gantt:file-a:9" };
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, contractMilestone: futureMilestone,
    task: { ...LIGHTING_TASK, plannedFinish: "2026-11-01", percentComplete: 80 }
  });
  assert.equal(ind.impact.affectsMilestone, null);      // not true, but not false either
  assert.equal(ind.impact.affectsProjectFinish, null);
  assert.equal(ind.variances.remainingFloatDays, null); // no dependency data — null, not 0
  const late = computeIndicator({ projectId: PROJECT, asOf: AS_OF, contractMilestone: { ...futureMilestone, contractDate: "2026-07-01" }, task: LIGHTING_TASK });
  assert.equal(late.impact.affectsMilestone, true);
  assert.deepEqual(late.impact.affectedMilestoneIds, ["m2"]);
});

// ─── severity and alert derivation (3.4 / 3.5) ───────────────────────────────

test("schedule engine: severity is derived from the numbers, never fixed per type", () => {
  const big = computeIndicator({ projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF, calendar: CAL });
  assert.equal(deriveSeverity(big), 4); // 162 working days late > 14
  const small = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, calendar: CAL,
    task: { ...LIGHTING_TASK, activityKey: "gantt:file-a:91", plannedFinish: "2026-08-01", plannedStart: "2026-07-01", percentComplete: 20 }
  });
  assert.equal(small.lateness.workingDaysLate, 3);
  assert.equal(deriveSeverity(small), 3);
  const soon = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, calendar: CAL,
    task: { activityKey: "gantt:file-a:92", name: "צבע", plannedStart: "2026-07-01", plannedFinish: "2026-08-06", percentComplete: 40 }
  });
  assert.equal(deriveSeverity(soon), 3); // <=3 working days left, under 50%
  const approaching = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, calendar: CAL,
    task: { activityKey: "gantt:file-a:93", name: "אלומיניום", plannedStart: "2026-07-01", plannedFinish: "2026-08-12", percentComplete: 20 }
  });
  assert.equal(deriveSeverity(approaching), 2); // <=7 working days left, under 25%
  const healthy = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, calendar: CAL,
    task: { activityKey: "gantt:file-a:94", name: "פיתוח", plannedStart: "2026-07-01", plannedFinish: "2026-12-01", percentComplete: 60 }
  });
  assert.equal(deriveSeverity(healthy), null);
  assert.deepEqual(deriveAlert(big), { alertType: "schedule_breach", severityLevel: 4 });
  assert.deepEqual(deriveAlert(soon), { alertType: "schedule_approaching", severityLevel: 3 });
  assert.equal(deriveAlert(healthy), null);
});

// ─── sweep ───────────────────────────────────────────────────────────────────

test("schedule engine: sweep excludes summaries and completed, sorts most-late first", () => {
  const tasks = [
    LIGHTING_TASK,
    { activityKey: "gantt:file-a:13", stableKey: 13, name: "אישורי חשמל", isSummary: true, plannedStart: "2025-11-17", plannedFinish: "2026-01-12", percentComplete: 9 },
    { activityKey: "gantt:file-a:91", stableKey: 91, name: "איטום", plannedStart: "2026-07-01", plannedFinish: "2026-08-01", percentComplete: 20 },
    { activityKey: "gantt:file-a:1192", stableKey: 1192, name: "תקרות", plannedStart: "2025-12-04", plannedFinish: "2025-12-31", percentComplete: 100 },
    { activityKey: "gantt:file-a:94", stableKey: 94, name: "פיתוח", plannedStart: "2026-07-01", plannedFinish: "2026-12-01", percentComplete: 60 }
  ];
  const result = sweep({
    projectId: PROJECT, tasks, asOf: AS_OF, calendar: CAL,
    scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1 }
  });
  assert.equal(result.contractVersion, CONTRACT_VERSION);
  const keys = result.indicators.map((i) => i.subject.activityKey);
  assert.ok(!keys.includes("gantt:file-a:13"));   // summary excluded
  assert.ok(!keys.includes("gantt:file-a:1192")); // completed excluded
  assert.equal(keys[0], "gantt:file-a:9");        // 226 days late sorts first
  assert.equal(result.indicators[0].severity, 4); // severity attached for the UI
  const lateOnly = sweep({
    projectId: PROJECT, tasks, asOf: AS_OF, calendar: CAL,
    scheduleMeta: { relevancyDate: "2025-12-03" },
    filters: { isLate: true, minDaysLate: 100 }
  });
  assert.deepEqual(lateOnly.indicators.map((i) => i.subject.activityKey), ["gantt:file-a:9"]);
  assert.equal(lateOnly.total, 4); // computed set (summary skipped), before filters
});

// ─── determinism and purity (criteria 1, 13, 25) ─────────────────────────────

test("schedule engine: identical inputs produce bit-identical output", () => {
  const input = {
    projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF, calendar: CAL,
    scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1 }
  };
  assert.equal(JSON.stringify(computeIndicator(input)), JSON.stringify(computeIndicator(input)));
});

test("schedule engine: asOf is mandatory — the engine never reads the clock", () => {
  assert.throws(() => computeIndicator({ projectId: PROJECT, task: LIGHTING_TASK }), /asOf/);
  assert.throws(() => sweep({ projectId: PROJECT, tasks: [LIGHTING_TASK] }), /asOf/);
  assert.throws(() => computeIndicator({ projectId: PROJECT, asOf: AS_OF }), /task or contractMilestone/);
});

test("schedule engine: source files contain no I/O, env access, or clock reads", () => {
  for (const file of ["../src/scheduleEngine.js", "../src/scheduleCalendar.js"]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .map((line) => line.split("//")[0])
      .join("\n");
    assert.doesNotMatch(source, /process\.env/, `${file} reads process.env`);
    assert.doesNotMatch(source, /Date\.now/, `${file} reads the clock`);
    assert.doesNotMatch(source, /new Date\(\)/, `${file} constructs an implicit now`);
    assert.doesNotMatch(source, /fetch\s*\(/, `${file} performs network I/O`);
    assert.doesNotMatch(source, /supabase/i, `${file} references supabase`);
  }
});

// ─── ingestion: pure parts only (I/O is the orchestrator's problem) ──────────

test("schedule ingestion: gantt row normalizes to the engine task shape", () => {
  const task = normalizeGanttTask({
    file_id: "1776105870763_03.12.25.xml", task_uid: 9, task_name: "אישור גופי תאורה",
    start_date: "2025-12-02", finish_date: "2025-12-21",
    percent_complete: 0, is_summary: false, is_milestone: false, outline_level: 3
  });
  assert.equal(task.activityKey, "gantt:1776105870763_03.12.25.xml:9");
  assert.equal(task.stableKey, 9);
  assert.equal(task.percentComplete, 0);
  assert.equal(task.isSummary, false);
  assert.equal(task.totalFloatDays, null); // parser does not persist slack yet — null, not 0
  assert.equal(buildActivityKey("f", 7), "gantt:f:7");
  // Rows without identity are data noise, not tasks.
  assert.equal(normalizeGanttTask({ task_name: "x" }), null);
  // The normalized row feeds the engine directly.
  const ind = computeIndicator({ projectId: PROJECT, task, asOf: AS_OF });
  assert.equal(ind.lateness.daysLate, 226);
  // Regression: ingestion emits totalFloatDays null; Number(null) is 0, and a
  // fabricated zero float would claim critical path. Must stay null (15.5#1).
  assert.equal(ind.variances.remainingFloatDays, null);
});

test("schedule ingestion: current version follows relevancy_date, not upload time", () => {
  const older = { file_id: "a", relevancy_date: "2025-12-03", uploaded_at: "2026-04-13T18:44:33Z" };
  const newer = { file_id: "b", relevancy_date: "2026-03-01", uploaded_at: "2026-03-05T10:00:00Z" };
  // "a" was uploaded later but describes an older state — "b" must win.
  const picked = pickCurrentVersion([older, newer]);
  assert.equal(picked.current.file_id, "b");
  assert.equal(picked.previous.file_id, "a");
  assert.equal(picked.versionConflict, false);
  // Two versions sharing the top relevancy_date is a source_conflict (spec 6.1).
  const tie = pickCurrentVersion([older, { ...newer, relevancy_date: "2025-12-03" }]);
  assert.equal(tie.versionConflict, true);
  assert.deepEqual(pickCurrentVersion([]), { current: null, previous: null, versionConflict: false });
});

test("schedule ingestion: source profiles are a settings switch, not a code change", () => {
  const dev = scheduleSettings({});
  assert.equal(dev.sourceProfile, "app_data");
  assert.equal(dev.tasksTable, "gantt_tasks");
  assert.equal(dev.filesTable, "gantt_files");
  const content = scheduleSettings({ sourceProfile: "content" });
  assert.equal(content.tasksTable, "gantt_tasks");
  assert.equal(content.filesTable, "gantt_files");
  // Explicit override beats the profile preset.
  const custom = scheduleSettings({ sourceProfile: "content", tasksTable: "gantt_tasks_v2" });
  assert.equal(custom.tasksTable, "gantt_tasks_v2");
  // Unknown profile degrades to the verified APP DATA production tables.
  assert.equal(scheduleSettings({ sourceProfile: "nope" }).sourceProfile, "app_data");
  assert.deepEqual(Object.keys(SCHEDULE_SOURCE_PROFILES).sort(), ["app_data", "content", "dev", "kapaim"]);
});

test("schedule ingestion: source uploads use MAIN while engine tables use APP DATA / KAPAIM", () => {
  const target = scheduleSupabaseConfig({
    supabaseUrl: "https://app.example",
    supabaseServiceRoleKey: "app-key",
    contentSource: {
      supabaseUrl: "https://smxibuaowzuxkznuouwj.supabase.co",
      supabaseServiceRoleKey: "app-data-key"
    }
  });
  assert.deepEqual(target, {
    label: "APP DATA",
    supabaseUrl: "https://smxibuaowzuxkznuouwj.supabase.co",
    supabaseServiceRoleKey: "app-data-key"
  });
  assert.deepEqual(MAIN_GANTT_SOURCE, {
    filesTable: "gantt_files_test",
    tasksTable: "gantt_tasks_test"
  });
  assert.deepEqual(scheduleSupabaseConfig({
    supabaseUrl: "https://main.example",
    supabaseServiceRoleKey: "main-key"
  }, "main", {}), {
    label: "App / MAIN",
    supabaseUrl: "https://main.example",
    supabaseServiceRoleKey: "main-key"
  });
});

// ─── orchestrator: pure parts only ───────────────────────────────────────────

test("schedule orchestrator: snapshot row sets exactly one subject key", () => {
  const activityInd = computeIndicator({
    projectId: PROJECT, task: LIGHTING_TASK, asOf: AS_OF, calendar: CAL,
    contractMilestone: { milestoneKey: "m1", name: "אבן דרך", contractDate: "2026-01-01", activityKey: LIGHTING_TASK.activityKey },
    calculatedAt: "2026-08-04T17:00:00+03:00"
  });
  const row = snapshotRowFromIndicator(activityInd, { dataVersion: "file-a#v1" });
  // Linked milestone or not — an activity snapshot carries activity_key only,
  // mirroring the schedule_snapshots_subject_ck constraint.
  assert.equal(row.activity_key, "gantt:file-a:9");
  assert.equal(row.milestone_key, null);
  assert.equal(row.basis, "contract_finish");
  assert.equal(row.days_late, activityInd.lateness.daysLate);
  assert.equal(row.engine_version, ENGINE_VERSION);
  assert.equal(row.data_version, "file-a#v1");
  assert.equal(row.payload, activityInd); // full indicator preserved for audit (spec 9)

  const milestoneInd = computeIndicator({
    projectId: PROJECT, asOf: AS_OF,
    contractMilestone: { milestoneKey: "m2", name: "מסירה", contractDate: "2026-06-01" }
  });
  const milestoneRow = snapshotRowFromIndicator(milestoneInd);
  assert.equal(milestoneRow.activity_key, null);
  assert.equal(milestoneRow.milestone_key, "m2");
});

test("schedule orchestrator: data version derives from the schedule, not the clock", () => {
  assert.equal(scheduleDataVersion({ sourceVersionId: "1776_a.xml", versionCount: 2 }), "1776_a.xml#v2");
  assert.equal(scheduleDataVersion({}), "none#v0");
});

test("schedule orchestrator: health aggregates engine output without recomputing", () => {
  const tasks = [
    LIGHTING_TASK,
    { activityKey: "gantt:file-a:2", stableKey: 2, name: "אבן דרך בינוי", plannedStart: "2025-09-29", plannedFinish: "2025-09-29", percentComplete: 0 },
    { activityKey: "gantt:file-a:94", stableKey: 94, name: "פיתוח", plannedStart: "2026-07-01", plannedFinish: "2026-12-01", percentComplete: 60 }
  ];
  const result = sweep({ projectId: PROJECT, tasks, asOf: AS_OF, calendar: CAL, scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1, sourceVersionId: "file-a", displayName: "לוז" } });
  const health = buildScheduleHealth({ projectId: PROJECT, indicators: result.indicators, scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1, sourceVersionId: "file-a", displayName: "לוז" }, asOf: AS_OF });
  assert.equal(health.healthVersion, SCHEDULE_HEALTH_VERSION);
  assert.equal(health.computed, 3);
  assert.equal(health.late, 2);
  assert.equal(health.milestonesDelayed, 1);
  assert.equal(health.worst.activityKey, "gantt:file-a:2"); // 309d late beats 226d
  assert.equal(health.worst.daysLate, 309);
  assert.equal(health.totalDaysLate, 309 + 226);
  assert.equal(health.byStatus.on_track, 1);
  // Schedule age is a first-order signal (spec 15.4.1), shown at the top.
  assert.equal(health.schedule.ageDays, 244);
});

test("schedule orchestrator: workflow log covers source, engine, and snapshot nodes", () => {
  const log = buildScheduleWorkflowLog({
    settings: scheduleSettings({}),
    scheduleMeta: { sourceVersionId: "file-a", versionCount: 1, relevancyDate: "2025-12-03" },
    sourceCounts: { tasks: 382, previousTasks: 0 },
    engineCounts: { asOf: AS_OF, computed: 328, matched: 285, late: 285 },
    persistOutcome: { persisted: false, table: "schedule_indicator_snapshots", inserted: 0, skipped: 328 },
    warnings: ["schedule_indicator_snapshots: table is missing"]
  });
  assert.deepEqual(log.nodes.map((n) => n.id), ["schedule_source", "schedule_engine", "snapshot_write", "schedule_warnings"]);
  assert.equal(log.nodes[2].status, "error"); // failed persistence is visible, not silent
  assert.deepEqual(log.edges, [["schedule_source", "schedule_engine"], ["schedule_engine", "snapshot_write"]]);
});

test("schedule engine: sweep surfaces unlinked contract milestones as milestone-only rows", () => {
  const milestone = { milestoneKey: "contract-completion-works", name: "השלמת העבודות", contractDate: "2026-02-12", isProjectCompletion: true, activityKey: null };
  const result = sweep({
    projectId: PROJECT, tasks: [LIGHTING_TASK], contractMilestones: [milestone],
    asOf: AS_OF, calendar: CAL, scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1 }
  });
  const milestoneRow = result.indicators.find((ind) => ind.subject.kind === "milestone");
  assert.ok(milestoneRow, "unlinked contract milestone must appear in the sweep");
  assert.equal(milestoneRow.subject.milestoneKey, "contract-completion-works");
  assert.equal(milestoneRow.status, "milestone_delayed");
  assert.equal(milestoneRow.lateness.basis, "contract_finish");
  assert.equal(milestoneRow.lateness.daysLate, 173); // Feb 12 -> Aug 4, engine-computed
  assert.equal(milestoneRow.severity, 5); // breached contract milestone is severity 5
  // A milestone linked to a present task must NOT get a duplicate row.
  const linked = sweep({
    projectId: PROJECT, tasks: [LIGHTING_TASK],
    contractMilestones: [{ ...milestone, activityKey: LIGHTING_TASK.activityKey }],
    asOf: AS_OF, calendar: CAL, scheduleMeta: { relevancyDate: "2025-12-03", versionCount: 1 }
  });
  assert.equal(linked.indicators.filter((ind) => ind.subject.kind === "milestone").length, 0);
});

// ─── alert planner (spec 3.3-3.6) — pure decision core ───────────────────────

// A fresh-schedule indicator (relevancy close to asOf) yields medium
// confidence, which passes the default alert gate.
function freshIndicator(taskOverrides = {}, indicatorOverrides = {}) {
  const ind = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, calendar: { ...CAL, holidaysThrough: "2026-12-31" },
    task: { activityKey: "gantt:f:1", stableKey: 1, name: "משימה", plannedStart: "2026-07-01", plannedFinish: "2026-07-20", percentComplete: 20, ...taskOverrides },
    scheduleMeta: { relevancyDate: "2026-08-01", versionCount: 1 },
    ...indicatorOverrides
  });
  return ind;
}

test("schedule alerts: bootstrap creates suppressed placeholders plus one visible summary", () => {
  const a = freshIndicator();
  const b = freshIndicator({ activityKey: "gantt:f:2", stableKey: 2, name: "משימה ב", plannedFinish: "2026-06-01" });
  const snapshotIds = { [subjectKeyOf(a)]: "snap-a", [subjectKeyOf(b)]: "snap-b" };
  const plan = planScheduleAlerts({ indicators: [a, b], existingAlerts: [], isBootstrap: true, asOf: AS_OF, snapshotIds });
  assert.equal(plan.creates.length, 2);
  assert.ok(plan.creates.every((row) => row.baselined === true)); // 3.6א — no flood
  assert.ok(plan.summaryCreate);
  assert.equal(plan.summaryCreate.activity_key, BOOTSTRAP_SUMMARY_KEY);
  assert.match(plan.summaryCreate.title, /2 חריגות/);
  assert.equal(plan.summaryCreate.indicator_snapshot_id, "snap-b"); // worst breach's snapshot
  assert.equal(plan.updates.length + plan.resolves.length, 0);
});

test("schedule alerts: steady state creates only gated, snapshot-backed alerts", () => {
  const good = freshIndicator();
  const lowConf = { ...freshIndicator({ activityKey: "gantt:f:3", stableKey: 3 }), confidence: { score: 0.4, level: "low", factors: [] } };
  const noSnapshot = freshIndicator({ activityKey: "gantt:f:4", stableKey: 4 });
  const snapshotIds = { [subjectKeyOf(good)]: "snap-1", [subjectKeyOf(lowConf)]: "snap-3" };
  const plan = planScheduleAlerts({ indicators: [good, lowConf, noSnapshot], existingAlerts: [], isBootstrap: false, asOf: AS_OF, snapshotIds });
  assert.equal(plan.creates.length, 1); // only the confident, snapshot-backed one
  assert.equal(plan.creates[0].baselined, false);
  assert.equal(plan.creates[0].occurrence_group_id, "schedule:gantt:f:1"); // 3.6ב
  assert.equal(plan.stats.suppressedLowConfidence, 1); // 3.3 rule 3
  assert.equal(plan.stats.missingSnapshotId, 1);       // criterion 15
  assert.equal(plan.summaryCreate, null);
});

test("schedule alerts: a persisting breach refreshes; a worsening one reopens", () => {
  const ind = freshIndicator(); // 16 days late (Jul 20 -> Aug 4)
  const key = ind.subject.activityKey;
  const snapshotIds = { [subjectKeyOf(ind)]: "snap-new" };
  const base = { id: "al-1", activity_key: key, alert_type: "schedule_breach", baselined: false, lifecycle_status: "open" };
  // Same severity, small growth -> refresh only, lifecycle untouched (3.6ב).
  const steady = planScheduleAlerts({
    indicators: [ind], isBootstrap: false, asOf: AS_OF, snapshotIds,
    existingAlerts: [{ ...base, materiality_bucket: 4, working_days_late: (ind.lateness.workingDaysLate ?? 0) - 2 }]
  });
  assert.equal(steady.updates.length, 1);
  assert.equal(steady.updates[0].reason, "refresh");
  assert.equal(steady.updates[0].patch.lifecycle_status, undefined);
  // Growth beyond materialChangeDays -> material update (3.6ג).
  const grown = planScheduleAlerts({
    indicators: [ind], isBootstrap: false, asOf: AS_OF, snapshotIds,
    existingAlerts: [{ ...base, materiality_bucket: 4, working_days_late: (ind.lateness.workingDaysLate ?? 0) - 10 }]
  });
  assert.equal(grown.updates[0].reason, "material");
  assert.equal(grown.updates[0].patch.lifecycle_status, "updated");
  // A baselined placeholder reactivates only on material worsening (3.6א).
  const reactivated = planScheduleAlerts({
    indicators: [ind], isBootstrap: false, asOf: AS_OF, snapshotIds,
    existingAlerts: [{ ...base, baselined: true, materiality_bucket: 3, working_days_late: 1 }]
  });
  assert.equal(reactivated.updates[0].reason, "reactivated");
  assert.equal(reactivated.updates[0].patch.baselined, false);
  const dormant = planScheduleAlerts({
    indicators: [ind], isBootstrap: false, asOf: AS_OF, snapshotIds,
    existingAlerts: [{ ...base, baselined: true, materiality_bucket: 4, working_days_late: ind.lateness.workingDaysLate }]
  });
  assert.equal(dormant.updates.length, 0); // still suppressed, untouched
});

test("schedule alerts: milestone-only breach becomes an alert with a surrogate key", () => {
  const milestoneInd = computeIndicator({
    projectId: PROJECT, asOf: AS_OF, calendar: CAL,
    contractMilestone: { milestoneKey: "m-comp", name: "השלמת העבודות", contractDate: "2026-02-12", isProjectCompletion: true }
  });
  const snapshotIds = { [subjectKeyOf(milestoneInd)]: "snap-m" };
  const plan = planScheduleAlerts({ indicators: [milestoneInd], existingAlerts: [], isBootstrap: false, asOf: AS_OF, snapshotIds });
  assert.equal(plan.creates.length, 1); // confidence 0.75 (contract basis) passes the medium gate
  assert.equal(plan.creates[0].activity_key, "milestone:m-comp"); // NOT NULL surrogate
  assert.equal(plan.creates[0].severity_level, 5);
  assert.equal(plan.creates[0].occurrence_group_id, "schedule:milestone:m-comp");
});

test("schedule alerts: alerts close with a reason and are never deleted", () => {
  const done = freshIndicator({ percentComplete: 100, plannedFinish: "2026-09-01" }); // completed_on_time
  const plan = planScheduleAlerts({
    indicators: [done], isBootstrap: false, asOf: AS_OF, snapshotIds: {},
    existingAlerts: [
      { id: "al-1", activity_key: done.subject.activityKey, alert_type: "schedule_breach", baselined: false, lifecycle_status: "open" },
      { id: "al-2", activity_key: "gantt:f:999", alert_type: "schedule_breach", baselined: false, lifecycle_status: "open" },
      { id: "al-3", activity_key: BOOTSTRAP_SUMMARY_KEY, alert_type: "schedule_breach", baselined: false, lifecycle_status: "open" }
    ]
  });
  assert.equal(plan.resolves.length, 2); // summary is excluded — closed by a human
  const byId = new Map(plan.resolves.map((r) => [r.id, r.patch]));
  assert.equal(byId.get("al-1").resolution, "הפעילות הושלמה");
  assert.equal(byId.get("al-2").resolution, "הפעילות אינה קיימת עוד בלוח");
  assert.ok(plan.resolves.every((r) => r.patch.lifecycle_status === "resolved"));
});

// ─── runner (mirrors test/run-tests.js) ──────────────────────────────────────

test("schedule condition resolver: computes supported offset units deterministically", () => {
  assert.equal(resolveConditionDueDate({ offset_value: 14, offset_unit: "calendar_days" }, "2026-08-05").dueDate, "2026-08-19");
  assert.equal(resolveConditionDueDate({ offset_value: 2, offset_unit: "weeks" }, "2026-08-05").dueDate, "2026-08-19");
  assert.equal(resolveConditionDueDate({ offset_value: 1, offset_unit: "months" }, "2026-01-31").dueDate, "2026-02-28");
  assert.equal(addWorkingDays("2026-08-06", 2, CAL), "2026-08-10");
  assert.equal(resolveConditionDueDate({ offset_value: 7, offset_unit: "working_days" }, "2026-08-05", null).dueDate, null);
  assert.equal(resolveConditionDueDate({ offset_value: 12, offset_unit: "hours" }, "2026-08-05").reason, "subday_deadline_cannot_be_stored_as_date");
});

test("schedule condition resolver: rejects an alleged found result without a valid date", () => {
  const evidence = normalizeEvidenceResult({ status: "found", trigger_date: "sometime", confidence: 0.99 });
  assert.equal(evidence.status, "ambiguous");
  assert.equal(evidence.triggerDate, null);
});

test("schedule condition resolver: exposes an actionable OpenRouter authentication error", () => {
  assert.deepEqual(scheduleResolverError(Object.assign(new Error("User not found."), { httpStatus: 401 })), {
    code: "openrouter_auth",
    message: "מפתח OpenRouter נדחה על ידי הספק (401). יש לעדכן מפתח תקין בהגדרות לפני הפעלת סוכן החיפוש."
  });
  assert.equal(scheduleResolverError(new Error("settings_openrouter_key_missing")).code, "settings_openrouter_key_missing");
});

test("schedule condition resolver: MAIN settings key overrides and never falls back to env config", () => {
  const config = settingsOwnedAiConfig({ openRouterApiKey: "sk-env-old" }, "sk-main-settings");
  assert.equal(config.openRouterApiKey, "sk-main-settings");
  assert.throws(() => settingsOwnedAiConfig({ openRouterApiKey: "sk-env-old" }, ""), /settings_openrouter_key_missing/);
});

test("schedule condition resolver: promotes only high-confidence dated chat evidence", async () => {
  const condition = {
    id: "cond-1", condition_key: "approve-price", name: "אישור הצעת מחיר",
    anchor_description: "משליחת הצעת המחיר", offset_value: 7, offset_unit: "calendar_days",
    recurring: false, source_excerpt: "אישור תוך 7 ימים ממשלוח", confidence: 0.9
  };
  const result = await runScheduleConditionResolver({
    projectId: PROJECT, conditions: [condition], calendar: CAL, commit: false, config: { projectId: PROJECT },
    planSearch: async () => ({ searchQuestion: "מתי נשלחה הצעת המחיר?" }),
    askChat: async () => ({ answer: "ההצעה נשלחה ב-2026-08-05", sources: [{ url: "https://example.test/doc", title: "הצעה" }] }),
    verify: async () => ({ status: "found", trigger_date: "2026-08-05", evidence_quote: "נשלחה ביום 5.8.26", source_url: "https://example.test/doc", confidence: 0.92 })
  });
  assert.equal(result.summary.ready, 1);
  assert.equal(result.results[0].dueDate, "2026-08-12");
  assert.equal(result.results[0].milestoneKey, "condition:approve-price");
  const rows = promotionRows({ projectId: PROJECT, condition, evidence: result.results[0].evidence, dueDate: result.results[0].dueDate, searchQuestion: result.results[0].searchQuestion });
  assert.equal(rows.milestone.contract_date, "2026-08-12");
  assert.equal(rows.milestone.confidence, 0.9);
  assert.equal(rows.conditionPatch.status, "resolved");
  assert.equal(milestoneKeyForCondition({ ...condition, recurring: true }, "2026-08-05"), "condition:approve-price:2026-08-05");
});

test("schedule condition resolver: leaves low-confidence chat evidence for review", async () => {
  const result = await runScheduleConditionResolver({
    projectId: PROJECT,
    conditions: [{ id: "cond-2", condition_key: "notice", name: "הודעה", offset_value: 3, offset_unit: "calendar_days" }],
    calendar: CAL, commit: false, config: { projectId: PROJECT },
    planSearch: async () => ({ searchQuestion: "מתי נמסרה ההודעה?" }),
    askChat: async () => ({ answer: "כנראה באוגוסט", sources: [] }),
    verify: async () => ({ status: "found", trigger_date: "2026-08-05", confidence: 0.55, reason: "indirect mention" })
  });
  assert.equal(result.summary.needs_review, 1);
  assert.equal(result.results[0].dueDate, undefined);
});

test("schedule condition resolver: a row action processes only the requested condition id", async () => {
  const searched = [];
  const conditions = [
    { id: "cond-a", condition_key: "a", name: "A", offset_value: 1, offset_unit: "calendar_days", source_excerpt: "A" },
    { id: "cond-b", condition_key: "b", name: "B", offset_value: 2, offset_unit: "calendar_days", source_excerpt: "B" }
  ];
  const result = await runScheduleConditionResolver({
    projectId: PROJECT, conditionId: "cond-b", conditions, calendar: CAL, commit: false, config: { projectId: PROJECT },
    planSearch: async ({ condition }) => { searched.push(condition.id); return { searchQuestion: `date for ${condition.id}` }; },
    askChat: async () => ({ answer: "2026-08-05", sources: [{ url: "https://example.test/b", title: "B" }] }),
    verify: async () => ({ status: "found", trigger_date: "2026-08-05", evidence_quote: "dated B", source_url: "https://example.test/b", confidence: 0.95 })
  });
  assert.deepEqual(searched, ["cond-b"]);
  assert.equal(result.processed, 1);
  assert.equal(result.results[0].conditionId, "cond-b");
  assert.equal(result.results[0].dueDate, "2026-08-07");
});

const filterIndex = process.argv.indexOf("--filter");
const filterPattern = filterIndex >= 0 ? process.argv[filterIndex + 1] : "";
const testFilter = filterPattern ? new RegExp(filterPattern, "i") : null;
const selectedTests = testFilter ? tests.filter(({ name }) => testFilter.test(name)) : tests;

let failed = 0;
for (const { name, fn } of selectedTests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}
if (failed) process.exit(1);
console.log(`${selectedTests.length} tests passed`);
