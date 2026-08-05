// Loading layer of the Schedule Intelligence Service.
// Spec: docs/BIDoc_Schedule_Intelligence_Engine_Spec.md, sections 5.5 and 14.1.
//
// This is the ONLY module that knows which tables the contractor schedule
// lives in. The engine (scheduleEngine.js) receives normalized arrays and
// never sees a table name; switching source profiles is a settings change,
// not a code change (acceptance criterion 25).
//
//   profile "dev"     → MAIN / App DB,   gantt_files_test + gantt_tasks_test
//   profile "content" → Content DB,      gantt_files      + gantt_tasks
//
// The engine's own tables (schedule_calendars, schedule_contract_*) live in
// the same DB as the active source — a snapshot must sit next to the schedule
// it describes (spec 5.5).

import { getConfig, readLocalSettings, supabaseHeaders } from "./config.js";
import { contentSupabaseConfig } from "./supabase.js";

export const SCHEDULE_SOURCE_PROFILES = {
  dev: { filesTable: "gantt_files_test", tasksTable: "gantt_tasks_test", useContentDb: false },
  content: { filesTable: "gantt_files", tasksTable: "gantt_tasks", useContentDb: true }
};

export const DEFAULT_SCHEDULE_SETTINGS = {
  sourceProfile: "dev",
  ...SCHEDULE_SOURCE_PROFILES.dev,
  calendarsTable: "schedule_calendars",
  milestonesTable: "schedule_contract_milestones",
  extensionsTable: "schedule_contract_extensions",
  snapshotsTable: "schedule_indicator_snapshots",
  alertsTable: "schedule_alerts",
  thresholds: null,
  alertPolicy: null
};

// Merge order: defaults ← profile preset ← explicit overrides. An explicit
// filesTable/tasksTable/useContentDb in settings always wins over the profile,
// so a one-off table rename never requires a new profile.
export function scheduleSettings(saved = undefined) {
  const raw = saved !== undefined ? (saved || {}) : (readLocalSettings().schedule || {});
  const profileName = SCHEDULE_SOURCE_PROFILES[raw.sourceProfile] ? raw.sourceProfile : DEFAULT_SCHEDULE_SETTINGS.sourceProfile;
  const profile = SCHEDULE_SOURCE_PROFILES[profileName];
  const explicit = {};
  for (const key of ["filesTable", "tasksTable", "useContentDb", "calendarsTable", "milestonesTable", "extensionsTable", "snapshotsTable", "alertsTable", "thresholds", "alertPolicy"]) {
    if (raw[key] !== undefined && raw[key] !== null) explicit[key] = raw[key];
  }
  return { ...DEFAULT_SCHEDULE_SETTINGS, ...profile, sourceProfile: profileName, ...explicit };
}

// ─── Normalization (spec 5.2) ────────────────────────────────────────────────

export function buildActivityKey(fileId, taskUid) {
  return `gantt:${fileId}:${taskUid}`;
}

export function normalizeGanttTask(row, { fileId = null } = {}) {
  if (!row || typeof row !== "object") return null;
  const versionId = row.file_id ?? fileId;
  if (versionId == null || row.task_uid == null) return null;
  const percent = Number(row.percent_complete);
  const outline = Number(row.outline_level);
  return {
    activityKey: buildActivityKey(versionId, row.task_uid),
    stableKey: row.task_uid, // identity across schedule versions (file_id changes per upload)
    name: String(row.task_name ?? ""),
    plannedStart: row.start_date ?? null,
    plannedFinish: row.finish_date ?? null,
    percentComplete: Number.isFinite(percent) ? percent : null,
    isSummary: row.is_summary === true,
    isMilestone: row.is_milestone === true,
    outlineLevel: Number.isFinite(outline) ? outline : null,
    sourceVersionId: versionId,
    // Future parser extensions (spec 6.1 request list) — passed through when
    // the client starts persisting them, null/absent until then.
    totalFloatDays: Number.isFinite(Number(row.total_slack)) ? Number(row.total_slack) : null,
    predecessors: Array.isArray(row.predecessors) ? row.predecessors : undefined
  };
}

// Current = latest relevancy_date (the Data Date — NOT uploaded_at; a schedule
// uploaded later does not necessarily describe a later state, spec 6.1).
// Two versions sharing the top relevancy_date is a source_conflict.
export function pickCurrentVersion(files = []) {
  const usable = files.filter((file) => file && file.file_id != null);
  if (!usable.length) return { current: null, previous: null, versionConflict: false };
  const dateOf = (file) => String(file.relevancy_date ?? file.uploaded_at ?? "");
  const sorted = [...usable].sort((a, b) =>
    dateOf(b).localeCompare(dateOf(a))
    || String(b.uploaded_at ?? "").localeCompare(String(a.uploaded_at ?? ""))
    || String(b.file_id).localeCompare(String(a.file_id))
  );
  const current = sorted[0];
  const previous = sorted[1] ?? null;
  const versionConflict = Boolean(
    previous
    && current.relevancy_date != null
    && String(current.relevancy_date) === String(previous.relevancy_date)
  );
  return { current, previous, versionConflict };
}

// ─── Data access — the only place that picks a database ──────────────────────

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function resolveTarget(config, settings) {
  if (settings.useContentDb) {
    const content = contentSupabaseConfig(config);
    return { supabaseUrl: content.supabaseUrl, supabaseServiceRoleKey: content.supabaseServiceRoleKey, label: "Content Supabase" };
  }
  return { supabaseUrl: config.supabaseUrl, supabaseServiceRoleKey: config.supabaseServiceRoleKey, label: "App Supabase" };
}

function isMissingTableError(status, message) {
  return status === 404 || /could not find the table|does not exist|schema cache/i.test(String(message || ""));
}

async function scheduleFetch({ config, settings, path, options = {} }) {
  const target = resolveTarget(config, settings);
  if (!target.supabaseUrl || !target.supabaseServiceRoleKey) {
    throw new Error(`${target.label} is not configured for the schedule source profile "${settings.sourceProfile}"`);
  }
  const response = await fetch(`${trimSlash(target.supabaseUrl)}${path}`, {
    method: options.method || "GET",
    headers: supabaseHeaders(target.supabaseServiceRoleKey, options.headers || {}),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.message || `Supabase request failed: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.missingTable = isMissingTableError(response.status, message);
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

// Public data-access door for the orchestration layer (subagents/schedule.js).
// The orchestrator decides WHAT to read or write (snapshots, engine alerts);
// this module alone decides WHERE — keeping the profile switch a settings-only
// change and the engine-table writes inside the isolation policy (spec 5.4:
// schedule_* tables only, never application tables).
export async function scheduleDataRequest({ config = null, settings = null, path, options = {} }) {
  return scheduleFetch({ config: config || getConfig(), settings: settings || scheduleSettings(), path, options });
}

const TASK_COLUMNS = "file_id,task_uid,task_name,start_date,finish_date,percent_complete,is_summary,is_milestone,outline_level";
const FILE_COLUMNS = "file_id,project_id,display_name,task_count,start_date,end_date,last_saved,uploaded_at,relevancy_date";

// ─── Loaders ─────────────────────────────────────────────────────────────────

// Loads the contractor schedule: current version's tasks, previous version's
// tasks (slippage), and scheduleMeta for the engine. Every query is scoped by
// project_id — there is no default project (criterion 24).
export async function loadScheduleSource({ config = null, projectId, settings: settingsInput = null }) {
  if (!projectId) throw new Error("loadScheduleSource: projectId is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();

  const files = await scheduleFetch({
    config: cfg, settings,
    path: `/rest/v1/${settings.filesTable}?select=${FILE_COLUMNS}&project_id=eq.${encodeURIComponent(projectId)}&order=relevancy_date.desc,uploaded_at.desc`
  });
  const { current, previous, versionConflict } = pickCurrentVersion(files);
  if (!current) {
    return {
      tasks: [], previousTasks: [], files: [],
      scheduleMeta: { relevancyDate: null, versionCount: 0, displayName: null, sourceVersionId: null, versionConflict: false },
      settings
    };
  }

  const loadTasks = (fileId) => scheduleFetch({
    config: cfg, settings,
    path: `/rest/v1/${settings.tasksTable}?select=${TASK_COLUMNS}&project_id=eq.${encodeURIComponent(projectId)}&file_id=eq.${encodeURIComponent(fileId)}&order=task_uid.asc`
  });

  const currentRows = await loadTasks(current.file_id);
  const previousRows = previous ? await loadTasks(previous.file_id) : [];

  return {
    tasks: currentRows.map((row) => normalizeGanttTask(row, { fileId: current.file_id })).filter(Boolean),
    previousTasks: previousRows.map((row) => normalizeGanttTask(row, { fileId: previous?.file_id })).filter(Boolean),
    files,
    scheduleMeta: {
      relevancyDate: current.relevancy_date ?? null,
      versionCount: files.length,
      displayName: current.display_name ?? null,
      sourceVersionId: current.file_id,
      versionConflict
    },
    settings
  };
}

// Engine tables may not exist yet (runbook not run on this DB). That is a
// degraded state, not a crash: the engine reports it through gates
// (calendar: "missing", contractAxis: "missing") and lowered confidence.
async function loadOptional({ config, settings, path, warningLabel, warnings }) {
  try {
    return await scheduleFetch({ config, settings, path });
  } catch (error) {
    if (error.missingTable) {
      warnings.push(`${warningLabel}: table is missing — run the migration runbook (spec 5.5)`);
      return [];
    }
    throw error;
  }
}

export async function loadScheduleCalendar({ config = null, projectId, settings: settingsInput = null, warnings = [] }) {
  if (!projectId) throw new Error("loadScheduleCalendar: projectId is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();
  const rows = await loadOptional({
    config: cfg, settings, warnings, warningLabel: settings.calendarsTable,
    path: `/rest/v1/${settings.calendarsTable}?select=working_weekdays,holidays,holidays_through,is_default,name&project_id=eq.${encodeURIComponent(projectId)}&order=is_default.desc,name.asc&limit=1`
  });
  return rows[0] ?? null;
}

export async function loadContractMilestones({ config = null, projectId, settings: settingsInput = null, warnings = [] }) {
  if (!projectId) throw new Error("loadContractMilestones: projectId is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();
  const milestones = await loadOptional({
    config: cfg, settings, warnings, warningLabel: settings.milestonesTable,
    path: `/rest/v1/${settings.milestonesTable}?select=milestone_key,name,contract_date,is_project_completion,activity_key,source_document_id,confidence&project_id=eq.${encodeURIComponent(projectId)}&status=eq.active&order=contract_date.asc`
  });
  if (!milestones.length) return [];
  const extensions = await loadOptional({
    config: cfg, settings, warnings, warningLabel: settings.extensionsTable,
    path: `/rest/v1/${settings.extensionsTable}?select=milestone_key,extension_days,status,approved_date,source_document_id&project_id=eq.${encodeURIComponent(projectId)}&order=created_at.asc`
  });
  const extensionsByKey = new Map();
  for (const ext of extensions) {
    if (!extensionsByKey.has(ext.milestone_key)) extensionsByKey.set(ext.milestone_key, []);
    extensionsByKey.get(ext.milestone_key).push({ extensionDays: ext.extension_days, status: ext.status ?? "approved" });
  }
  return milestones.map((row) => ({
    milestoneKey: row.milestone_key,
    name: row.name ?? "",
    contractDate: row.contract_date,
    isProjectCompletion: row.is_project_completion === true,
    activityKey: row.activity_key ?? null,
    sourceDocumentId: row.source_document_id ?? null,
    confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : 1,
    extensions: extensionsByKey.get(row.milestone_key) ?? []
  }));
}

// Discovery for the UI project selector (spec 15.2): which projects have a
// contractor schedule in the active source profile.
export async function listScheduleProjects({ config = null, settings: settingsInput = null } = {}) {
  const settings = settingsInput || scheduleSettings();
  const rows = await scheduleFetch({
    config: config || getConfig(), settings,
    path: `/rest/v1/${settings.filesTable}?select=project_id,relevancy_date&order=relevancy_date.desc`
  });
  const byProject = new Map();
  for (const row of rows) {
    if (!row?.project_id) continue;
    const entry = byProject.get(row.project_id) || { projectId: row.project_id, files: 0, latestRelevancyDate: null };
    entry.files += 1;
    if (!entry.latestRelevancyDate || String(row.relevancy_date ?? "") > entry.latestRelevancyDate) {
      entry.latestRelevancyDate = row.relevancy_date ?? null;
    }
    byProject.set(row.project_id, entry);
  }
  return [...byProject.values()];
}

// One-call convenience for the orchestrator: everything sweep()/computeIndicator()
// need, plus warnings about degraded inputs (missing engine tables).
export async function loadScheduleInputs({ config = null, projectId, settings: settingsInput = null }) {
  if (!projectId) throw new Error("loadScheduleInputs: projectId is required");
  const cfg = config || getConfig();
  const settings = settingsInput || scheduleSettings();
  const warnings = [];
  const source = await loadScheduleSource({ config: cfg, projectId, settings });
  const calendar = await loadScheduleCalendar({ config: cfg, projectId, settings, warnings });
  const contractMilestones = await loadContractMilestones({ config: cfg, projectId, settings, warnings });
  return {
    projectId,
    tasks: source.tasks,
    previousTasks: source.previousTasks,
    scheduleMeta: source.scheduleMeta,
    calendar,
    contractMilestones,
    thresholds: settings.thresholds ?? null,
    settings,
    warnings
  };
}
