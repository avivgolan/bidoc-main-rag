export const ACTIVITY_ASSIGNMENT_BATCH_STATUSES = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  STOPPING: "stopping",
  PAUSED: "paused",
  COMPLETED: "completed"
});

export const ACTIVITY_ASSIGNMENT_BATCH_LIMIT_OPTIONS = Object.freeze([10, 25, 50]);
export const DEFAULT_ACTIVITY_ASSIGNMENT_BATCH_LIMIT = ACTIVITY_ASSIGNMENT_BATCH_LIMIT_OPTIONS[0];

export const ACTIVITY_ASSIGNMENT_METHOD_PRESENTATIONS = Object.freeze({
  manual: Object.freeze({ key: "manual", label: "שויך ידנית" }),
  agent_approved: Object.freeze({ key: "agent-approved", label: "הוצע על ידי הסוכן ואושר" }),
  agent_auto: Object.freeze({ key: "agent-auto", label: "שויך אוטומטית" }),
  existing: Object.freeze({ key: "existing", label: "שיוך קיים" })
});

export const DEFAULT_ACTIVITY_UPDATE_FILTERS = Object.freeze({
  query: "",
  kind: "",
  dateFrom: "",
  dateTo: "",
  text: "",
  severity: "",
  status: "",
  assignmentState: "",
  activity: ""
});

function normalizedSearchValue(value) {
  return String(value ?? "").trim().toLocaleLowerCase("he");
}

export function hasActiveActivityUpdateFilters(filters = {}) {
  return Object.keys(DEFAULT_ACTIVITY_UPDATE_FILTERS)
    .some((key) => normalizedSearchValue(filters[key]));
}

export function filterActivityUpdates(items = [], activities = [], filters = {}) {
  const normalizedFilters = { ...DEFAULT_ACTIVITY_UPDATE_FILTERS, ...filters };
  const activityNameByKey = new Map(
    (Array.isArray(activities) ? activities : []).map((activity) => [String(activity?.key || ""), activity?.name || ""])
  );
  const query = normalizedSearchValue(normalizedFilters.query);
  const text = normalizedSearchValue(normalizedFilters.text);
  const activityQuery = normalizedSearchValue(normalizedFilters.activity);

  return (Array.isArray(items) ? items : []).filter((item) => {
    const activityKey = String(item?.activityKey || "");
    const activityName = activityNameByKey.get(activityKey) || "";
    const date = String(item?.date || "");
    const itemText = normalizedSearchValue(`${item?.title || ""} ${item?.alertType || ""}`);
    const globalText = normalizedSearchValue([
      item?.kind === "update" ? "עדכון" : "התראה",
      date,
      item?.title,
      item?.alertType,
      item?.severity,
      item?.status,
      activityName
    ].join(" "));

    if (query && !globalText.includes(query)) return false;
    if (normalizedFilters.kind && item?.kind !== normalizedFilters.kind) return false;
    if (normalizedFilters.dateFrom && (!date || date < normalizedFilters.dateFrom)) return false;
    if (normalizedFilters.dateTo && (!date || date > normalizedFilters.dateTo)) return false;
    if (text && !itemText.includes(text)) return false;
    if (normalizedFilters.severity !== "" && String(item?.severity ?? "") !== String(normalizedFilters.severity)) return false;
    if (normalizedFilters.status !== "" && String(item?.status || "") !== String(normalizedFilters.status)) return false;
    if (normalizedFilters.assignmentState === "assigned" && !activityKey) return false;
    if (normalizedFilters.assignmentState === "unassigned" && activityKey) return false;
    if (activityQuery && !normalizedSearchValue(activityName).includes(activityQuery)) return false;
    return true;
  });
}

export function createActivityAssignmentBatch(overrides = {}) {
  return {
    status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.IDLE,
    queue: [],
    nextIndex: 0,
    processed: 0,
    total: 0,
    assigned: 0,
    review: 0,
    skipped: 0,
    failed: 0,
    currentId: null,
    timeFilter: false,
    ...overrides
  };
}

export function normalizeActivityAssignmentBatchLimit(value) {
  const normalized = Number(value);
  return ACTIVITY_ASSIGNMENT_BATCH_LIMIT_OPTIONS.includes(normalized)
    ? normalized
    : DEFAULT_ACTIVITY_ASSIGNMENT_BATCH_LIMIT;
}

export function buildActivityAssignmentBatchQueue(items = [], {
  limit = Number.POSITIVE_INFINITY,
  excludedSourceIds = []
} = {}) {
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.max(0, Math.floor(Number(limit)))
    : Number.POSITIVE_INFINITY;
  if (normalizedLimit === 0) return [];
  const excluded = new Set((Array.isArray(excludedSourceIds) ? excludedSourceIds : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean));
  const seen = new Set();
  const queue = [];
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item?.id || "").trim();
    if (!id || !item?.date || item?.activityKey || seen.has(id) || excluded.has(id)) continue;
    seen.add(id);
    queue.push(item);
    if (queue.length >= normalizedLimit) break;
  }
  return queue;
}

export function activityAssignmentBatchConfirmationText({ batchSize = 0, eligibleCount = 0 } = {}) {
  return [
    `המערכת תבדוק ${Number(batchSize) || 0} מתוך ${Number(eligibleCount) || 0} ההתראות הלא משויכות.`,
    "הריצה הקבוצתית היא במצב בדיקה בלבד ואינה כותבת שיוכים אוטומטיים.",
    "תוצאות לא ודאיות יישמרו להחלטה אנושית. להמשיך?"
  ].join("\n\n");
}

export function activityAssignmentMethodPresentation(item = {}) {
  if (!item?.activityKey) return null;
  return ACTIVITY_ASSIGNMENT_METHOD_PRESENTATIONS[item.assignmentMethod]
    || ACTIVITY_ASSIGNMENT_METHOD_PRESENTATIONS.existing;
}

export function activityAssignmentReviewCandidates(result, limit = 2) {
  if (!result || result.status === "filtered_out" || result.decision?.autoAssigned) return [];
  const safeLimit = Math.max(0, Math.min(2, Number(limit) || 0));
  return (Array.isArray(result.candidates) ? result.candidates : [])
    .filter((candidate) => candidate?.activityKey && candidate?.name)
    .slice(0, safeLimit);
}

export function activityAssignmentReviewHeader(item = {}, result = {}) {
  const alertTitle = String(item?.title || result?.event?.title || "").trim() || "התראה ללא כותרת";
  const recommendation = result?.decision?.autoAssigned
    ? "שויך אוטומטית"
    : String(result?.decision?.selectedActivityName || "").trim() || "לא נמצאה התאמה חד-משמעית";
  return { alertTitle, recommendation };
}

export function applyActivityAssignmentBatchOutcome(stats, outcome) {
  const next = {
    processed: Number(stats?.processed) || 0,
    assigned: Number(stats?.assigned) || 0,
    review: Number(stats?.review) || 0,
    skipped: Number(stats?.skipped) || 0,
    failed: Number(stats?.failed) || 0
  };
  next.processed += 1;
  if (!outcome?.ok) next.failed += 1;
  else if (outcome.result?.status === "filtered_out" || outcome.result?.timeFilter?.skipped === true) next.skipped += 1;
  else if (outcome.result?.assignment) next.assigned += 1;
  else next.review += 1;
  return next;
}

export function activityAssignmentBatchStatusText(batch) {
  const processed = Number(batch?.processed) || 0;
  const total = Number(batch?.total) || 0;
  switch (batch?.status) {
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING:
      return `${batch?.timeFilter ? "מסנן ובודק" : "בודק"} שורה ${Math.min(processed + 1, total)} מתוך ${total}`;
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.STOPPING:
      return "בקשת העצירה נקלטה - מסיים את השורה הפעילה";
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.PAUSED:
      return `הריצה נעצרה אחרי ${processed} מתוך ${total}`;
    case ACTIVITY_ASSIGNMENT_BATCH_STATUSES.COMPLETED:
      return `הריצה הסתיימה: ${processed} נבדקו · ${batch.assigned || 0} שויכו · ${batch.review || 0} הועברו להחלטה · ${batch.skipped || 0} דולגו · ${batch.failed || 0} נכשלו`;
    default:
      return "";
  }
}
