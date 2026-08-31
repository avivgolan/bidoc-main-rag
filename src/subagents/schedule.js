// Orchestration layer of the Schedule Intelligence Service (spec 4.1).
//
// Wires the pieces together and nothing else:
//   scheduleIngestion.js  → loads and normalizes rows (the only table-aware layer)
//   scheduleEngine.js     → computes indicators (pure, no I/O)
//   this file             → stamps calculatedAt, persists snapshots, builds the
//                           workflow log, and aggregates project health.
//
// Rule 001 boundary: no schedule arithmetic happens here beyond calling the
// engine and summing its outputs. Isolation policy (spec 5.4): the only table
// this module writes is schedule_indicator_snapshots — engine-owned, created
// by the migration runbook, never an application table.

import { getConfig } from "../config.js";
import { fetchAlertsTimelineEvents, fetchLegacyAlertsTimelineEvents } from "../supabase.js";
import { getProjectDateTime } from "../clock.js";
import { computeIndicator, sweep, deriveAlert, deriveSeverity, ENGINE_VERSION, CONTRACT_VERSION } from "../scheduleEngine.js";
import { diffCalendarDays, toIsoDate } from "../scheduleCalendar.js";
import { loadScheduleInputs, scheduleDataRequest, scheduleSettings } from "../scheduleIngestion.js";
import {
  reconcileProjectContractConditions,
  resolveIndicatorProjectContext
} from "../indicator/contractConditions.js";
import { resolveConditionDueDate, runScheduleConditionResolver } from "./scheduleConditionResolver.js";

export const SCHEDULE_HEALTH_VERSION = "schedule-health.v1";

// ─── Pure helpers (unit-tested without I/O) ──────────────────────────────────

// Same source rows must yield the same snapshot identity (idempotency,
// acceptance criterion 1). The data version is derived from the schedule
// version, never from the clock.
export function scheduleDataVersion(scheduleMeta = {}) {
  return `${scheduleMeta.sourceVersionId ?? "none"}#v${scheduleMeta.versionCount ?? 0}`;
}

// Maps an indicator to a schedule_indicator_snapshots row. Exactly one of
// activity_key / milestone_key is set — mirroring the DB check constraint
// (schedule_snapshots_subject_ck), so a violation fails here first.
export function snapshotRowFromIndicator(indicator, { dataVersion = null } = {}) {
  const activityKey = indicator.subject.activityKey ?? null;
  return {
    project_id: indicator.projectId,
    activity_key: activityKey,
    milestone_key: activityKey ? null : indicator.subject.milestoneKey ?? null,
    as_of: indicator.asOf,
    status: indicator.status,
    days_late: indicator.lateness.daysLate,
    days_remaining: indicator.lateness.daysRemaining,
    working_days_late: indicator.lateness.workingDaysLate,
    working_days_remaining: indicator.lateness.workingDaysRemaining,
    basis: indicator.lateness.basis,
    basis_date: indicator.lateness.basisDate,
    confidence: indicator.confidence.score,
    payload: indicator,
    engine_version: indicator.engineVersion,
    contract_version: indicator.contractVersion,
    data_version: dataVersion
  };
}

// Aggregate project view for GET /api/schedule/health (spec 4.4) and, in
// phase 3, for healthScore.js to consume instead of overdue_commitments
// (spec 1.4). Pure aggregation over engine output — no own arithmetic on dates
// except the schedule-age diff, which is display metadata, not an indicator.
export function buildScheduleHealth({ projectId = null, indicators = [], scheduleMeta = {}, asOf = null, warnings = [] }) {
  const byStatus = {};
  let late = 0;
  let totalDaysLate = 0;
  let worst = null;
  let milestonesDelayed = 0;
  let milestonesAtRisk = 0;
  for (const ind of indicators) {
    byStatus[ind.status] = (byStatus[ind.status] || 0) + 1;
    if (ind.lateness.isLate === true) {
      late += 1;
      totalDaysLate += ind.lateness.daysLate ?? 0;
      if (!worst || (ind.lateness.daysLate ?? 0) > (worst.daysLate ?? 0)) {
        worst = { activityKey: ind.subject.activityKey, name: ind.subject.name, daysLate: ind.lateness.daysLate };
      }
    }
    if (ind.status === "milestone_delayed") milestonesDelayed += 1;
    if (ind.status === "milestone_at_risk") milestonesAtRisk += 1;
  }
  const relevancyDate = toIsoDate(scheduleMeta.relevancyDate);
  return {
    healthVersion: SCHEDULE_HEALTH_VERSION,
    engineVersion: ENGINE_VERSION,
    projectId,
    asOf,
    computed: indicators.length,
    late,
    totalDaysLate,
    worst,
    milestonesDelayed,
    milestonesAtRisk,
    byStatus,
    schedule: {
      sourceVersionId: scheduleMeta.sourceVersionId ?? null,
      displayName: scheduleMeta.displayName ?? null,
      relevancyDate,
      versionCount: scheduleMeta.versionCount ?? 0,
      // Schedule age is a first-order signal (spec 15.4.1): a stale schedule
      // degrades every indicator that leans on it.
      ageDays: relevancyDate && asOf ? diffCalendarDays(relevancyDate, asOf) : null
    },
    warnings
  };
}

export function buildScheduleWorkflowLog({ settings, scheduleMeta, sourceCounts, engineCounts, persistOutcome, warnings = [] }) {
  return {
    nodes: [
      workflowNode("schedule_source", "Schedule Source", "database", scheduleMeta?.sourceVersionId ? "done" : "skipped", {
        profile: settings?.sourceProfile, tasksTable: settings?.tasksTable, useContentDb: settings?.useContentDb === true
      }, {
        tasks: sourceCounts?.tasks ?? 0,
        previousTasks: sourceCounts?.previousTasks ?? 0,
        versionCount: scheduleMeta?.versionCount ?? 0,
        relevancyDate: scheduleMeta?.relevancyDate ?? null,
        versionConflict: scheduleMeta?.versionConflict === true
      }),
      workflowNode("schedule_engine", "Schedule Engine", "router", "done", {
        engineVersion: ENGINE_VERSION, asOf: engineCounts?.asOf ?? null
      }, {
        computed: engineCounts?.computed ?? 0,
        matched: engineCounts?.matched ?? 0,
        late: engineCounts?.late ?? 0
      }),
      workflowNode("snapshot_write", "Indicator Snapshots", "database",
        persistOutcome ? (persistOutcome.persisted ? "done" : "error") : "skipped",
        { table: persistOutcome?.table ?? null },
        persistOutcome ?? {}),
      ...(warnings.length ? [workflowNode("schedule_warnings", "Degraded Inputs", "router", "done", {}, { warnings })] : [])
    ],
    edges: [
      ["schedule_source", "schedule_engine"],
      ["schedule_engine", "snapshot_write"]
    ]
  };
}

function workflowNode(id, label, kind, status, input, output) {
  return { id, label, kind, status, input, output };
}

// ─── Snapshot persistence ────────────────────────────────────────────────────

// Insert-only, per spec 9: a snapshot is never updated or deleted — history
// accrues. Idempotency comes from reading the already-persisted subject keys
// for (project, asOf, engineVersion) and inserting only what is missing; the
// partial unique indexes (runbook step 2) are the concurrent-writer backstop.
export async function persistIndicatorSnapshots({ config = null, settings = null, projectId, indicators = [], dataVersion = null, warnings = [] }) {
  const cfg = config || getConfig();
  const resolved = settings || scheduleSettings();
  const table = resolved.snapshotsTable;
  if (!indicators.length) return { persisted: true, table, inserted: 0, skipped: 0, idsBySubject: {} };
  const asOf = indicators[0].asOf;
  const rowKey = (row) => `${row.activity_key ?? ""}|${row.milestone_key ?? ""}`;
  try {
    const existing = await scheduleDataRequest({
      config: cfg, settings: resolved,
      path: `/rest/v1/${table}?select=id,activity_key,milestone_key&project_id=eq.${encodeURIComponent(projectId)}&as_of=eq.${encodeURIComponent(asOf)}&engine_version=eq.${encodeURIComponent(ENGINE_VERSION)}`
    });
    // Alerts must reference their snapshot (criterion 15) — collect ids for
    // both already-persisted and freshly inserted rows.
    const idsBySubject = {};
    for (const row of existing) idsBySubject[rowKey(row)] = row.id;
    const rows = indicators
      .map((indicator) => snapshotRowFromIndicator(indicator, { dataVersion }))
      .filter((row) => !(rowKey(row) in idsBySubject));
    if (rows.length) {
      const inserted = await scheduleDataRequest({
        config: cfg, settings: resolved,
        path: `/rest/v1/${table}?select=id,activity_key,milestone_key`,
        options: { method: "POST", body: rows, headers: { Prefer: "return=representation" } }
      });
      for (const row of inserted) idsBySubject[rowKey(row)] = row.id;
    }
    return { persisted: true, table, inserted: rows.length, skipped: indicators.length - rows.length, idsBySubject };
  } catch (error) {
    // A missing table means the migration runbook has not run on this DB yet —
    // a degraded state, not a failure of the read path (spec 5.5).
    const reason = error.missingTable
      ? `${table}: table is missing — run the migration runbook (spec 5.5)`
      : `${table}: ${error.message}`;
    warnings.push(reason);
    return { persisted: false, table, inserted: 0, skipped: indicators.length, idsBySubject: {}, error: reason };
  }
}

// ─── Entry points ────────────────────────────────────────────────────────────

// POST /api/schedule/sweep — the proactive mode (spec 3.1 mode B).
// Persists snapshots for the FULL computed set (health and audit need them),
// then applies the caller's filters for the response.
export async function runScheduleSweep({ projectId, asOf: asOfInput = null, filters = {}, config = null, settings: settingsInput = null, persist = true, runId = null, emit = null } = {}) {
  if (!projectId) throw new Error("runScheduleSweep: projectId is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();
  const calculatedAt = getProjectDateTime(cfg.timezone);
  const asOf = toIsoDate(asOfInput) || calculatedAt.slice(0, 10);

  const trace = [];
  const step = (name, message, data = {}, status = "done") => {
    const item = { step: name, message, status, time: calculatedAt, data };
    trace.push(item);
    emit?.(runId, name, message, { ...data, status });
    return item;
  };

  const preflightWarnings = [];
  const projectContext = await resolveIndicatorProjectContext({ projectId, config: cfg, settings }).catch((error) => {
    preflightWarnings.push(`Indicator project mapping: ${error.message}`);
    return { mappingFound: false, sourceProjectId: projectId, scheduleProjectId: projectId };
  });
  let contractConditionSync = null;
  let conditionResolution = null;
  contractConditionSync = await reconcileProjectContractConditions({
    projectId,
    commit: persist,
    config: cfg,
    settings
  }).catch((error) => {
    preflightWarnings.push(`Indicator contract sync: ${error.message}`);
    return { ok: false, committed: false, reason: error.message };
  });
  step("contract_condition_sync", "Reviewed relative contract conditions reconciled", contractConditionSync,
    contractConditionSync?.ok === false ? "error" : "done");

  if (persist) {
    conditionResolution = await runScheduleConditionResolver({
      projectId: projectContext.sourceProjectId,
      limit: 25,
      commit: true,
      config: cfg,
      settings,
      projectContext,
      contractOnly: true,
      runId: runId ? `${runId}:conditions` : null
    }).catch((error) => {
      preflightWarnings.push(`Schedule condition resolver: ${error.message}`);
      return { ok: false, processed: 0, reason: error.message };
    });
    step("contract_condition_resolution", "Pending contract triggers checked", {
      processed: conditionResolution?.processed || 0,
      summary: conditionResolution?.summary || null
    }, conditionResolution?.ok === false ? "error" : "done");
  }

  const inputs = await loadScheduleInputs({
    config: cfg,
    projectId,
    engineProjectId: projectContext.scheduleProjectId,
    settings
  });
  inputs.warnings.unshift(...preflightWarnings);
  step("schedule_source", "Schedule source loaded", {
    tasks: inputs.tasks.length,
    previousTasks: inputs.previousTasks.length,
    versionCount: inputs.scheduleMeta.versionCount,
    profile: settings.sourceProfile
  });

  const engineInput = {
    projectId: projectContext.scheduleProjectId,
    tasks: inputs.tasks,
    previousTasks: inputs.previousTasks,
    contractMilestones: inputs.contractMilestones,
    calendar: inputs.calendar,
    scheduleMeta: inputs.scheduleMeta,
    thresholds: inputs.thresholds,
    asOf,
    calculatedAt
  };
  // Full set for persistence and health; completed tasks stay in so the
  // snapshot history records closure too.
  const full = sweep({ ...engineInput, filters: { excludeCompleted: false } });
  const matched = sweep({ ...engineInput, filters });
  const late = full.indicators.filter((ind) => ind.lateness.isLate === true).length;
  step("schedule_engine", "Indicators computed", { computed: full.total, matched: matched.matchedCount, late });

  const dataVersion = scheduleDataVersion(inputs.scheduleMeta);
  const persistOutcome = persist
    ? await persistIndicatorSnapshots({ config: cfg, settings, projectId: projectContext.scheduleProjectId, indicators: full.indicators, dataVersion, warnings: inputs.warnings })
    : null;
  if (persistOutcome) {
    step("snapshot_write", "Indicator snapshots persisted", persistOutcome, persistOutcome.persisted ? "done" : "error");
  }

  return {
    ok: true,
    contractVersion: CONTRACT_VERSION,
    engineVersion: ENGINE_VERSION,
    projectId,
    scheduleProjectId: projectContext.scheduleProjectId,
    asOf,
    calculatedAt,
    dataVersion,
    total: matched.total,
    matchedCount: matched.matchedCount,
    indicators: matched.indicators,
    scheduleMeta: inputs.scheduleMeta,
    persistOutcome,
    contractConditionSync,
    conditionResolution,
    warnings: inputs.warnings,
    trace,
    workflowLog: buildScheduleWorkflowLog({
      settings,
      scheduleMeta: inputs.scheduleMeta,
      sourceCounts: { tasks: inputs.tasks.length, previousTasks: inputs.previousTasks.length },
      engineCounts: { asOf, computed: full.total, matched: matched.matchedCount, late },
      persistOutcome,
      warnings: inputs.warnings
    })
  };
}

// GET /api/schedule/indicator — the lookup mode (spec 3.1 mode A).
// kind=activity resolves by activityKey (exact, or stableKey when numeric);
// kind=milestone resolves a contract milestone, attaching its linked task.
export async function runScheduleIndicator({ projectId, activityKey = null, milestoneKey = null, asOf: asOfInput = null, config = null, settings: settingsInput = null } = {}) {
  if (!projectId) throw new Error("runScheduleIndicator: projectId is required");
  if (!activityKey && !milestoneKey) throw new Error("runScheduleIndicator: activityKey or milestoneKey is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();
  const calculatedAt = getProjectDateTime(cfg.timezone);
  const asOf = toIsoDate(asOfInput) || calculatedAt.slice(0, 10);
  const projectContext = await resolveIndicatorProjectContext({ projectId, config: cfg, settings });
  const inputs = await loadScheduleInputs({
    config: cfg,
    projectId,
    engineProjectId: projectContext.scheduleProjectId,
    settings
  });

  let task = null;
  let contractMilestone = null;
  if (activityKey) {
    task = inputs.tasks.find((t) => t.activityKey === activityKey)
      ?? (/^\d+$/.test(String(activityKey)) ? inputs.tasks.find((t) => String(t.stableKey) === String(activityKey)) : null);
    if (!task) return { ok: false, notFound: true, error: `activity not found: ${activityKey}`, warnings: inputs.warnings };
    contractMilestone = inputs.contractMilestones.find((m) => m.activityKey === task.activityKey) ?? null;
  } else {
    contractMilestone = inputs.contractMilestones.find((m) => m.milestoneKey === milestoneKey) ?? null;
    if (!contractMilestone) return { ok: false, notFound: true, error: `milestone not found: ${milestoneKey}`, warnings: inputs.warnings };
    task = contractMilestone.activityKey
      ? inputs.tasks.find((t) => t.activityKey === contractMilestone.activityKey) ?? null
      : null;
  }

  const indicator = computeIndicator({
    projectId: projectContext.scheduleProjectId,
    task,
    contractMilestone,
    asOf,
    calculatedAt,
    calendar: inputs.calendar,
    scheduleMeta: inputs.scheduleMeta,
    thresholds: inputs.thresholds,
    previousTask: task ? inputs.previousTasks.find((t) => (t.stableKey ?? t.activityKey) === (task.stableKey ?? task.activityKey)) ?? null : null,
    mappingConfidence: null
  });
  indicator.severity = deriveSeverity(indicator, inputs.thresholds);
  return { ok: true, indicator, scheduleMeta: inputs.scheduleMeta, warnings: inputs.warnings };
}

// ─── Alert generation (spec 3.3-3.6, MVP phase 2) ────────────────────────────
//
// The engine decides WHETHER an indicator warrants an alert (deriveAlert);
// this section decides WHAT TO DO with that — noise control, lifecycle, and
// persistence into schedule_alerts. The application's alerts table is never
// touched (isolation policy, spec 5.4).

export const DEFAULT_ALERT_POLICY = {
  // 3.3 rule 3: low-confidence indicators do not create visible alerts unless
  // the project explicitly opts in. On a stale-schedule-only project this
  // correctly suppresses everything until a fresh schedule version arrives.
  minConfidenceLevel: "medium",
  // 3.6ג: an existing alert reopens only when lateness grew by more than this
  // (working days when available, calendar days otherwise).
  materialChangeDays: 7
};

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };
export const BOOTSTRAP_SUMMARY_KEY = "__bootstrap_summary__";

export function subjectKeyOf(indicator) {
  const activityKey = indicator.subject.activityKey ?? "";
  return `${activityKey}|${activityKey ? "" : indicator.subject.milestoneKey ?? ""}`;
}

// schedule_alerts.activity_key is NOT NULL; a milestone-only indicator (no
// linked task) uses a stable surrogate so the one-open-alert-per-subject
// index still applies to it.
export function alertActivityKey(indicator) {
  return indicator.subject.activityKey ?? `milestone:${indicator.subject.milestoneKey}`;
}

function alertRowFromIndicator(indicator, candidate, { asOf, snapshotId, baselined }) {
  return {
    project_id: indicator.projectId,
    activity_key: alertActivityKey(indicator),
    alert_type: candidate.alertType,
    severity_level: candidate.severityLevel,
    days_late: indicator.lateness.daysLate,
    days_remaining: indicator.lateness.daysRemaining,
    working_days_late: indicator.lateness.workingDaysLate,
    working_days_remaining: indicator.lateness.workingDaysRemaining,
    indicator_snapshot_id: snapshotId,
    title: candidate.alertType === "schedule_breach"
      ? `חריגה מלו"ז: ${indicator.subject.name}`
      : `לו"ז מתקרב: ${indicator.subject.name}`,
    description: indicator.explanation,
    occurrence_group_id: `schedule:${alertActivityKey(indicator)}`, // 3.6ב
    lifecycle_status: "open",
    baselined,
    materiality_bucket: candidate.severityLevel,
    first_detected_at: asOf,
    last_evaluated_at: asOf
  };
}

// Pure decision core — fully unit-testable. Given the engine's indicators and
// the currently open alerts, returns exactly what to insert, patch, and close.
export function planScheduleAlerts({ indicators = [], existingAlerts = [], isBootstrap = false, asOf, snapshotIds = {}, thresholds = null, policy: policyInput = null }) {
  const policy = { ...DEFAULT_ALERT_POLICY, ...(policyInput || {}) };
  const minRank = CONFIDENCE_RANK[policy.minConfidenceLevel] ?? 1;
  const existingByKey = new Map(existingAlerts.map((alert) => [`${alert.activity_key}|${alert.alert_type}`, alert]));
  const creates = [];
  const updates = [];
  const resolves = [];
  const stats = { candidates: 0, suppressedLowConfidence: 0, missingSnapshotId: 0 };
  const matchedIds = new Set();
  let worst = null;

  for (const indicator of indicators) {
    const candidate = deriveAlert(indicator, thresholds);
    if (!candidate) continue;
    stats.candidates += 1;
    if (!worst
      || candidate.severityLevel > worst.candidate.severityLevel
      || (candidate.severityLevel === worst.candidate.severityLevel
        && (indicator.lateness.daysLate ?? 0) > (worst.indicator.lateness.daysLate ?? 0))) {
      worst = { indicator, candidate };
    }
    const existing = existingByKey.get(`${alertActivityKey(indicator)}|${candidate.alertType}`);
    if (existing) matchedIds.add(existing.id);

    const snapshotId = snapshotIds[subjectKeyOf(indicator)] ?? null;
    if (!snapshotId) {
      // Criterion 15: an engine alert without a snapshot to point at is
      // unexplainable — refuse to create it rather than fake the reference.
      stats.missingSnapshotId += 1;
      continue;
    }
    const passesGate = (CONFIDENCE_RANK[indicator.confidence.level] ?? 0) >= minRank;

    if (isBootstrap) {
      // 3.6א: the first run creates suppressed placeholders, never a flood.
      creates.push(alertRowFromIndicator(indicator, candidate, { asOf, snapshotId, baselined: true }));
      continue;
    }
    if (!existing) {
      if (!passesGate) {
        stats.suppressedLowConfidence += 1;
        continue;
      }
      creates.push(alertRowFromIndicator(indicator, candidate, { asOf, snapshotId, baselined: false }));
      continue;
    }

    const previousLate = existing.working_days_late ?? existing.days_late;
    const currentLate = indicator.lateness.workingDaysLate ?? indicator.lateness.daysLate;
    const growth = previousLate != null && currentLate != null ? currentLate - previousLate : 0;
    const material = candidate.severityLevel > (existing.materiality_bucket ?? 0) || growth > policy.materialChangeDays;

    if (existing.baselined) {
      // Suppressed placeholder: silent while the breach merely persists,
      // reactivated only when it materially worsens (3.6א+ג).
      if (material && passesGate) {
        updates.push({
          id: existing.id,
          reason: "reactivated",
          patch: {
            baselined: false,
            lifecycle_status: "open",
            severity_level: candidate.severityLevel,
            materiality_bucket: candidate.severityLevel,
            days_late: indicator.lateness.daysLate,
            days_remaining: indicator.lateness.daysRemaining,
            working_days_late: indicator.lateness.workingDaysLate,
            working_days_remaining: indicator.lateness.workingDaysRemaining,
            indicator_snapshot_id: snapshotId,
            description: indicator.explanation,
            last_evaluated_at: asOf
          }
        });
      }
      continue;
    }

    const patch = {
      days_late: indicator.lateness.daysLate,
      days_remaining: indicator.lateness.daysRemaining,
      working_days_late: indicator.lateness.workingDaysLate,
      working_days_remaining: indicator.lateness.workingDaysRemaining,
      indicator_snapshot_id: snapshotId,
      description: indicator.explanation,
      last_evaluated_at: asOf
    };
    if (material) {
      patch.lifecycle_status = "updated";
      patch.severity_level = candidate.severityLevel;
      patch.materiality_bucket = candidate.severityLevel;
    }
    updates.push({ id: existing.id, reason: material ? "material" : "refresh", patch });
  }

  // 3.6ד: an open alert whose breach no longer exists closes with an
  // explanation and is never deleted.
  const indicatorsByActivity = new Map(indicators.map((ind) => [alertActivityKey(ind), ind]));
  for (const alert of existingAlerts) {
    if (matchedIds.has(alert.id)) continue;
    if (alert.activity_key === BOOTSTRAP_SUMMARY_KEY) continue; // closed by a human, not the scan
    const indicator = indicatorsByActivity.get(alert.activity_key) ?? null;
    const completed = indicator && (indicator.status === "completed_on_time" || indicator.status === "completed_late");
    resolves.push({
      id: alert.id,
      patch: {
        lifecycle_status: "resolved",
        resolved_at: asOf,
        last_evaluated_at: asOf,
        resolution: completed ? "הפעילות הושלמה" : indicator ? "החריגה אינה פעילה עוד" : "הפעילות אינה קיימת עוד בלוח"
      }
    });
  }

  const summaryCreate = isBootstrap && creates.length && worst
    ? {
      project_id: worst.indicator.projectId,
      activity_key: BOOTSTRAP_SUMMARY_KEY,
      alert_type: "schedule_breach",
      severity_level: worst.candidate.severityLevel,
      days_late: worst.indicator.lateness.daysLate,
      days_remaining: null,
      working_days_late: worst.indicator.lateness.workingDaysLate,
      working_days_remaining: null,
      indicator_snapshot_id: snapshotIds[subjectKeyOf(worst.indicator)],
      title: `אתחול היסטורי: ${creates.length} חריגות קיימות בלוח`,
      description: `ההרצה הראשונה של מנוע לוחות הזמנים זיהתה ${creates.length} פעילויות חורגות. כולן סומנו baselined ולא ייצרו התראות נפרדות; התראה תיפתח רק לחריגה שתחמיר מהותית מנקודה זו. החריגה הגדולה ביותר: ${worst.indicator.subject.name} (${worst.indicator.lateness.daysLate} ימים).`,
      occurrence_group_id: `schedule:${BOOTSTRAP_SUMMARY_KEY}`,
      lifecycle_status: "open",
      baselined: false,
      materiality_bucket: worst.candidate.severityLevel,
      first_detected_at: asOf,
      last_evaluated_at: asOf
    }
    : null;

  return { creates, updates, resolves, summaryCreate, stats };
}

// The daily scan (spec 4.5 trigger 1): sweep → persist snapshots → plan →
// apply. This is what makes the alerts agent proactive — a task that breached
// silently becomes an alert without anyone writing a word about it.
export async function runScheduleAlertScan({ projectId, asOf: asOfInput = null, config = null, settings: settingsInput = null, runId = null, emit = null } = {}) {
  if (!projectId) throw new Error("runScheduleAlertScan: projectId is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();
  const table = settings.alertsTable;

  const sweepResult = await runScheduleSweep({
    projectId, asOf: asOfInput, config: cfg, settings,
    persist: true, filters: { excludeCompleted: false }, runId, emit
  });
  const scheduleProjectId = sweepResult.scheduleProjectId || projectId;
  if (!sweepResult.persistOutcome?.persisted) {
    return {
      ok: false,
      error: "indicator snapshots were not persisted — engine alerts must reference a snapshot (criterion 15)",
      warnings: sweepResult.warnings,
      workflowLog: sweepResult.workflowLog
    };
  }

  const existingAlerts = await scheduleDataRequest({
    config: cfg, settings,
    path: `/rest/v1/${table}?select=*&project_id=eq.${encodeURIComponent(scheduleProjectId)}&lifecycle_status=in.(open,updated)`
  });
  const anyRow = existingAlerts.length
    ? existingAlerts
    : await scheduleDataRequest({
      config: cfg, settings,
      path: `/rest/v1/${table}?select=id&project_id=eq.${encodeURIComponent(scheduleProjectId)}&limit=1`
    });
  const isBootstrap = !anyRow.length;

  const plan = planScheduleAlerts({
    indicators: sweepResult.indicators,
    existingAlerts,
    isBootstrap,
    asOf: sweepResult.asOf,
    snapshotIds: sweepResult.persistOutcome.idsBySubject,
    thresholds: settings.thresholds,
    policy: settings.alertPolicy ?? null
  });

  const allCreates = [...(plan.summaryCreate ? [plan.summaryCreate] : []), ...plan.creates];
  if (allCreates.length) {
    await scheduleDataRequest({
      config: cfg, settings,
      path: `/rest/v1/${table}`,
      options: { method: "POST", body: allCreates, headers: { Prefer: "return=minimal" } }
    });
  }
  for (const change of [...plan.updates, ...plan.resolves]) {
    await scheduleDataRequest({
      config: cfg, settings,
      path: `/rest/v1/${table}?id=eq.${encodeURIComponent(change.id)}`,
      options: { method: "PATCH", body: change.patch, headers: { Prefer: "return=minimal" } }
    });
  }

  return {
    ok: true,
    projectId,
    asOf: sweepResult.asOf,
    calculatedAt: sweepResult.calculatedAt,
    isBootstrap,
    created: allCreates.length,
    baselined: plan.creates.filter((row) => row.baselined).length,
    updated: plan.updates.length,
    resolved: plan.resolves.length,
    stats: plan.stats,
    snapshot: { inserted: sweepResult.persistOutcome.inserted, skipped: sweepResult.persistOutcome.skipped },
    warnings: sweepResult.warnings
  };
}

// Read side for the UI (spec 15.3): triage list plus the baselined view —
// what the bootstrap silenced must stay inspectable, or it is a black box.
export async function listScheduleAlerts({ projectId, lifecycle = null, baselined = null, minSeverity = null, config = null, settings: settingsInput = null } = {}) {
  if (!projectId) throw new Error("listScheduleAlerts: projectId is required");
  const settings = settingsInput || scheduleSettings();
  const cfg = config || getConfig();
  const projectContext = await resolveIndicatorProjectContext({ projectId, config: cfg, settings });
  const filters = [`project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}`];
  if (lifecycle) filters.push(`lifecycle_status=in.(${encodeURIComponent(lifecycle)})`);
  if (baselined != null) filters.push(`baselined=eq.${baselined === true || baselined === "true"}`);
  if (minSeverity != null) filters.push(`severity_level=gte.${Number(minSeverity)}`);
  return scheduleDataRequest({
    config: cfg, settings,
    path: `/rest/v1/${settings.alertsTable}?select=*&${filters.join("&")}&order=severity_level.desc,days_late.desc.nullslast`
  });
}

const ACTIVITY_ALERT_LINKS_TABLE = "schedule_activity_alert_links";

function contentAlertDate(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})/u);
  return match ? match[1] : null;
}

export function scheduleActivityUpdateItem(row = {}, activityKey = null, assignmentMethod = null) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const rawId = String(row.id || "").replace(/^alert_/u, "");
  const sourceEventId = String(row.source_event_id || (String(row.id || "").startsWith("alert_") ? row.id : `alert_${rawId}`));
  const alertType = String(row.alert_type || metadata.alert_type || row.tags?.at(-1) || "עדכון").trim();
  const normalizedActivityKey = activityKey || null;
  const normalizedAssignmentMethod = normalizedActivityKey && ["manual", "agent_auto", "agent_approved"].includes(String(assignmentMethod || ""))
    ? String(assignmentMethod)
    : null;
  return {
    id: rawId,
    sourceEventId,
    sourceTable: "alerts",
    sourceKind: "timeline_alert",
    kind: /עדכון|update/iu.test(alertType) ? "update" : "alert",
    alertType,
    title: String(row.content || row.summary || row.alert_description || metadata.summary || metadata.alert_description || "עדכון ללא כותרת").trim(),
    date: contentAlertDate(row.data_date || metadata.data_date || row.date),
    severity: row.severity == null && row.severity_level == null ? null : Number(row.severity ?? row.severity_level),
    status: row.item_status || metadata.item_status || row.lifecycle_status || row.status || metadata.status || null,
    href: row.data_link || metadata.data_link || metadata.url || null,
    activityKey: normalizedActivityKey,
    assignmentMethod: normalizedAssignmentMethod
  };
}

export function mergeLinkedLegacyAlertEvents({ events = [], links = [], legacyEvents = [] } = {}) {
  const currentIds = new Set(events.map((event) => String(event.id || "").replace(/^alert_/u, "")));
  const linkedIds = new Set(links.map((link) => String(link.source_id || "").replace(/^alert_/u, "")));
  const recovered = legacyEvents.filter((event) => {
    const id = String(event.id || "").replace(/^alert_/u, "");
    return linkedIds.has(id) && !currentIds.has(id);
  });
  return {
    events: [...events, ...recovered].sort((left, right) => {
      const dateCompare = String(left.date || "").localeCompare(String(right.date || ""));
      return dateCompare || String(left.id || "").localeCompare(String(right.id || ""));
    }),
    recoveredCount: recovered.length
  };
}

function normalizedAlertSourceId(value) {
  return String(value || "").trim().replace(/^alert_/u, "");
}

export function scheduleAssignmentEvaluationSource(event = {}, recordOrigin = "alerts") {
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const id = normalizedAlertSourceId(event.id);
  const tags = Array.isArray(event.tags)
    ? event.tags.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const content = String(event.content || metadata.summary || metadata.alert_description || "").trim();
  return {
    id,
    created_at: metadata.created_at || null,
    data_date: contentAlertDate(metadata.data_date || event.date),
    alert_type: String(metadata.alert_type || tags.at(-1) || "עדכון").trim(),
    severity_level: event.severity == null ? metadata.severity_level ?? null : event.severity,
    item_status: metadata.item_status || null,
    lifecycle_status: metadata.lifecycle_status || null,
    status: metadata.status || null,
    summary: String(metadata.summary || content).trim(),
    alert_description: String(metadata.alert_description || content).trim(),
    question: String(metadata.question || "").trim(),
    answer: String(metadata.answer || "").trim(),
    content,
    data_link: metadata.data_link || metadata.url || null,
    hashtags: tags,
    metadata: {
      ...metadata,
      evaluation_record_origin: recordOrigin
    }
  };
}

// Evaluation may recover a backup row only when the source has an explicit
// Schedule link. Additional negative cases are current-alert reads only.
export async function loadScheduleAssignmentEvaluationSources({
  linkedSourceIds = [],
  currentOnlySourceIds = [],
  config = null,
  fetchCurrentEvents = fetchAlertsTimelineEvents,
  fetchLegacyEvents = fetchLegacyAlertsTimelineEvents
} = {}) {
  const linkedIds = [...new Set(linkedSourceIds.map(normalizedAlertSourceId).filter(Boolean))];
  const currentOnlyIds = [...new Set(currentOnlySourceIds.map(normalizedAlertSourceId).filter(Boolean))];
  const requestedIds = [...new Set([...linkedIds, ...currentOnlyIds])];
  const requested = new Set(requestedIds);
  if (!requestedIds.length) {
    return {
      sources: [],
      exclusions: [],
      requestedCount: 0,
      currentCount: 0,
      recoveredLegacyCount: 0
    };
  }

  const currentEvents = (await fetchCurrentEvents({ config, limit: 2000 }))
    .filter((event) => requested.has(normalizedAlertSourceId(event.id)));
  const currentById = new Map(currentEvents.map((event) => [normalizedAlertSourceId(event.id), event]));
  const missingLinkedIds = linkedIds.filter((id) => !currentById.has(id));
  const legacyEvents = missingLinkedIds.length
    ? await fetchLegacyEvents({ config, ids: missingLinkedIds })
    : [];
  const restored = mergeLinkedLegacyAlertEvents({
    events: currentEvents,
    links: linkedIds.map((sourceId) => ({ source_id: sourceId })),
    legacyEvents
  });
  const recoveredIds = new Set(legacyEvents
    .map((event) => normalizedAlertSourceId(event.id))
    .filter((id) => missingLinkedIds.includes(id)));
  const eventById = new Map(restored.events.map((event) => [normalizedAlertSourceId(event.id), event]));
  const sources = [];
  const exclusions = [];
  for (const sourceId of requestedIds) {
    const event = eventById.get(sourceId);
    if (!event) {
      exclusions.push({
        sourceId,
        reason: linkedIds.includes(sourceId)
          ? "linked_alert_source_missing_or_undated"
          : "current_alert_source_missing_or_undated"
      });
      continue;
    }
    const recordOrigin = recoveredIds.has(sourceId)
      ? "alerts_backup_dedupe_20260822"
      : "alerts";
    const source = scheduleAssignmentEvaluationSource(event, recordOrigin);
    if (!source.data_date) {
      exclusions.push({ sourceId, reason: "canonical_business_date_missing" });
      continue;
    }
    sources.push({ sourceId, recordOrigin, source });
  }
  return {
    sources,
    exclusions,
    requestedCount: requestedIds.length,
    currentCount: sources.filter((item) => item.recordOrigin === "alerts").length,
    recoveredLegacyCount: sources.filter((item) => item.recordOrigin === "alerts_backup_dedupe_20260822").length
  };
}

// Use the exact alert-event adapter that feeds the Timeline page. Only the
// reviewed association is Schedule-owned and persisted in the link table.
export async function listScheduleActivityUpdates({ projectId, config = null, settings: settingsInput = null } = {}) {
  if (!projectId) throw new Error("listScheduleActivityUpdates: projectId is required");
  const settings = settingsInput || scheduleSettings();
  const cfg = config || getConfig();
  const projectContext = await resolveIndicatorProjectContext({ projectId, config: cfg, settings });
  const eventsPromise = fetchAlertsTimelineEvents({ config: cfg, limit: 2000 });
  let linksWarning = null;
  const linksPromise = scheduleDataRequest({
      config: cfg,
      settings,
      path: `/rest/v1/${ACTIVITY_ALERT_LINKS_TABLE}?select=source_id,activity_key,event_date,assignment_method&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&source_table=eq.alerts`
    }).catch((error) => {
      linksWarning = `טעינת קשרי פעילות: ${error.message}`;
      return [];
    });
  const [currentEvents, links] = await Promise.all([eventsPromise, linksPromise]);
  const currentEventIds = new Set(currentEvents.map((event) => String(event.id || "").replace(/^alert_/u, "")));
  const orphanedLinkIds = links
    .map((row) => String(row.source_id || "").replace(/^alert_/u, ""))
    .filter((id) => id && !currentEventIds.has(id));
  let legacyWarning = null;
  const legacyEvents = orphanedLinkIds.length
    ? await fetchLegacyAlertsTimelineEvents({ config: cfg, ids: orphanedLinkIds }).catch((error) => {
        legacyWarning = `טעינת שיוכים היסטוריים: ${error.message}`;
        return [];
      })
    : [];
  const restored = mergeLinkedLegacyAlertEvents({ events: currentEvents, links, legacyEvents });
  const events = restored.events;
  const linkBySource = new Map(links.map((row) => [String(row.source_id), row]));
  return {
    projectId: projectContext.sourceProjectId,
    scheduleProjectId: projectContext.scheduleProjectId,
    total: events.length,
    items: events.map((event) => {
      const link = linkBySource.get(String(event.id).replace(/^alert_/u, ""));
      return scheduleActivityUpdateItem(event, link?.activity_key || null, link?.assignment_method || null);
    }),
    recoveredLegacyLinks: restored.recoveredCount,
    ...((linksWarning || legacyWarning) ? { warning: [linksWarning, legacyWarning].filter(Boolean).join("; ") } : {})
  };
}

export async function assignScheduleActivityUpdate({
  projectId,
  sourceId,
  activityKey,
  linkedBy = null,
  assignmentMethod = "manual",
  assignmentRunId = null,
  confidence = null,
  reviewNote = null,
  preventOverwrite = false,
  config = null,
  settings: settingsInput = null
} = {}) {
  if (!projectId) throw new Error("assignScheduleActivityUpdate: projectId is required");
  const normalizedSourceId = String(sourceId || "").trim();
  if (!normalizedSourceId || normalizedSourceId.length > 160) throw new Error("sourceId is required");
  const normalizedActivityKey = activityKey == null || activityKey === "" ? null : String(activityKey).trim();
  if (normalizedActivityKey && (normalizedActivityKey.length > 500 || !normalizedActivityKey.startsWith("gantt:"))) {
    throw new Error("activityKey must identify a Gantt activity");
  }
  const settings = settingsInput || scheduleSettings();
  const cfg = config || getConfig();
  const projectContext = await resolveIndicatorProjectContext({ projectId, config: cfg, settings });
  const alertsTable = "alerts";
  const [sourceRows, inputs] = await Promise.all([
    scheduleDataRequest({
      config: cfg,
      settings,
      path: `/rest/v1/${alertsTable}?select=id,created_at,data_date,alert_type,severity_level,item_status,lifecycle_status,status,summary,alert_description,answer,question,content,data_link,metadata,hashtags&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&id=eq.${encodeURIComponent(normalizedSourceId)}&limit=1`
    }),
    normalizedActivityKey ? loadScheduleInputs({
      config: cfg,
      projectId,
      engineProjectId: projectContext.scheduleProjectId,
      settings
    }) : Promise.resolve(null)
  ]);
  const source = sourceRows[0];
  if (!source) throw new Error("update or alert not found");
  const eventDate = contentAlertDate(source.data_date || source.created_at);
  if (!eventDate) throw new Error("לא ניתן לשייך התראה ללא תאריך לציר הזמן");
  if (normalizedActivityKey && !inputs.tasks.some((task) => task.activityKey === normalizedActivityKey)) {
    throw new Error("activityKey does not belong to the active schedule version");
  }
  const existing = await scheduleDataRequest({
    config: cfg,
    settings,
    path: `/rest/v1/${ACTIVITY_ALERT_LINKS_TABLE}?select=id,activity_key&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&source_table=eq.alerts&source_id=eq.${encodeURIComponent(normalizedSourceId)}&limit=1`
  });
  if (preventOverwrite && existing[0]?.activity_key) {
    throw new Error("ההתראה כבר משויכת לפעילות; הסוכן אינו דורס שיוך קיים");
  }
  const auditValues = {
    assignment_method: ["manual", "agent_auto", "agent_approved"].includes(assignmentMethod) ? assignmentMethod : "manual",
    assignment_run_id: assignmentRunId || null,
    confidence: confidence == null ? null : Math.max(0, Math.min(100, Number(confidence))),
    review_note: reviewNote ? String(reviewNote).slice(0, 1000) : null
  };
  // Every saved assignment carries its current provenance. A later manual
  // reassignment must not retain an older agent method or run identifier.
  const audit = normalizedActivityKey ? auditValues : {};
  if (existing[0]?.id && !normalizedActivityKey) {
    await scheduleDataRequest({
      config: cfg,
      settings,
      path: `/rest/v1/${ACTIVITY_ALERT_LINKS_TABLE}?id=eq.${encodeURIComponent(existing[0].id)}`,
      options: { method: "DELETE", headers: { Prefer: "return=minimal" } }
    });
  } else if (existing[0]?.id) {
    await scheduleDataRequest({
      config: cfg,
      settings,
      path: `/rest/v1/${ACTIVITY_ALERT_LINKS_TABLE}?id=eq.${encodeURIComponent(existing[0].id)}`,
      options: { method: "PATCH", body: { activity_key: normalizedActivityKey, event_date: eventDate, linked_by: linkedBy, ...audit }, headers: { Prefer: "return=minimal" } }
    });
  } else if (normalizedActivityKey) {
    await scheduleDataRequest({
      config: cfg,
      settings,
      path: `/rest/v1/${ACTIVITY_ALERT_LINKS_TABLE}`,
      options: {
        method: "POST",
        body: {
          project_id: projectContext.scheduleProjectId,
          source_event_id: `alert_${normalizedSourceId}`,
          source_table: "alerts",
          source_id: normalizedSourceId,
          activity_key: normalizedActivityKey,
          event_date: eventDate,
          linked_by: linkedBy,
          ...audit
        },
        headers: { Prefer: "return=minimal" }
      }
    });
  }
  return scheduleActivityUpdateItem(
    { ...source, id: `alert_${normalizedSourceId}` },
    normalizedActivityKey,
    normalizedActivityKey ? auditValues.assignment_method : null
  );
}

// ─── Pending contractual conditions (spec 6.8א) ──────────────────────────────
//
// Read side of the waiting pool: relative obligations that have no date yet
// because their trigger event has not arrived. They are NOT indicators and
// never reach the engine — a condition without a resolved date cannot be
// measured. Promotion to schedule_contract_milestones is what makes one
// countable.

export async function listScheduleConditions({ projectId, conditionId = null, status = "pending", category = null, config = null, settings: settingsInput = null } = {}) {
  if (!projectId) throw new Error("listScheduleConditions: projectId is required");
  const settings = settingsInput || scheduleSettings();
  const cfg = config || getConfig();
  const projectContext = await resolveIndicatorProjectContext({ projectId, config: cfg, settings });
  const filters = [`project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}`];
  if (conditionId) filters.push(`id=eq.${encodeURIComponent(conditionId)}`);
  if (status) filters.push(`status=in.(${encodeURIComponent(status)})`);
  if (category) filters.push(`category=in.(${encodeURIComponent(category)})`);
  const rows = await scheduleDataRequest({
    config: cfg, settings,
    path: `/rest/v1/${settings.conditionsTable}?select=*&${filters.join("&")}&order=category.asc,name.asc`
  });
  const needsProvisionalDate = rows.some((row) => row?.trigger_event_date
    && row?.offset_unit === "working_days"
    && !row?.metadata?.trigger_evidence?.provisionalDueDate);
  const calendarRows = needsProvisionalDate
    ? await scheduleDataRequest({
      config: cfg, settings,
      path: `/rest/v1/${settings.calendarsTable}?select=working_weekdays,holidays,holidays_through&project_id=eq.${encodeURIComponent(projectContext.scheduleProjectId)}&order=is_default.desc&limit=1`
    }).catch(() => [])
    : [];
  const conditions = enrichConditionProvisionalDueDates(rows, calendarRows[0] || null);
  return {
    projectId: projectContext.sourceProjectId,
    scheduleProjectId: projectContext.scheduleProjectId,
    conditions,
    byCategory: countBy(conditions, "category"),
    byAnchorKind: countBy(conditions, "anchor_kind")
  };
}

export function enrichConditionProvisionalDueDates(rows = [], calendar = null) {
  return rows.map((row) => {
    if (!row?.trigger_event_date || row?.metadata?.trigger_evidence?.provisionalDueDate) return row;
    const resolved = resolveConditionDueDate(row, row.trigger_event_date, calendar);
    if (!resolved.provisionalDueDate) return row;
    return {
      ...row,
      metadata: {
        ...(row.metadata || {}),
        trigger_evidence: {
          ...(row.metadata?.trigger_evidence || {}),
          provisionalDueDate: resolved.provisionalDueDate
        }
      }
    };
  });
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] || 0) + 1;
  return counts;
}

// GET /api/schedule/health — the aggregate project view (spec 4.4).
export async function runScheduleHealth({ projectId, asOf = null, config = null, settings = null } = {}) {
  const result = await runScheduleSweep({
    projectId, asOf, config, settings,
    persist: false,
    filters: { excludeCompleted: false }
  });
  return buildScheduleHealth({
    projectId,
    indicators: result.indicators,
    scheduleMeta: result.scheduleMeta,
    asOf: result.asOf,
    warnings: result.warnings
  });
}
