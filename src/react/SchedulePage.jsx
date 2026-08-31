import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_SCHEDULE_VIEW, formatIsraeliDate, makeScheduleScale, parseIsraeliDate, scheduleSubjectKey } from "./scheduleTimeline.js";
import {
  ACTIVITY_ASSIGNMENT_BATCH_LIMIT_OPTIONS,
  ACTIVITY_ASSIGNMENT_BATCH_STATUSES,
  activityAssignmentBatchConfirmationText,
  activityAssignmentReviewCandidates,
  activityAssignmentBatchStatusText,
  activityAssignmentMethodPresentation,
  applyActivityAssignmentBatchOutcome,
  buildActivityAssignmentBatchQueue,
  createActivityAssignmentBatch,
  DEFAULT_ACTIVITY_ASSIGNMENT_BATCH_LIMIT,
  DEFAULT_ACTIVITY_UPDATE_FILTERS,
  filterActivityUpdates,
  hasActiveActivityUpdateFilters,
  normalizeActivityAssignmentBatchLimit
} from "./activityAssignmentBatch.js";
import { SCHEDULE_ASSIGNMENT_REVIEW_LABEL_OPTIONS } from "../scheduleActivityAssignmentLabels.js";
import { mergeScheduleActivityUpdatesWithSharedReviews } from "./scheduleActivityAssignmentReviewState.js";

// Schedule Intelligence tab (spec section 15, phases 1-2 screens).
//
// The centerpiece is the three-axis timeline (spec 1.2): every activity row
// shows the contract axis, the contractor-plan axis, and the execution axis
// (observed/forecast) on one time scale, with the as-of line crossing them.
// A breach is not a label the user must trust — it is visible: the plan bar
// ends before the as-of line and no execution closed it.
//
// Display rules (spec 15.5) enforced here:
//   1. null is never rendered as 0 — daysLate null means "on time", full stop.
//   2. no number without its basis and basis date.
//   3. the gates block is always visible on the single-activity view.
//   4. low confidence is visually distinct.
//   5. insufficient_data is never styled like on_track.
//   6. no schedule judgment in the browser — Rule 001. Date.parse below is
//      used ONLY to position bars on a pixel scale; every number, status and
//      comparison shown comes verbatim from the engine.

const STATUS_LABELS = {
  on_track: "בזמן",
  watch: "במעקב",
  at_risk: "בסיכון",
  delayed_vs_contractor: "באיחור מול לוח הקבלן",
  delayed_vs_contract: "באיחור מול החוזה",
  milestone_at_risk: "אבן דרך בסיכון",
  milestone_delayed: "אבן דרך באיחור",
  hidden_slippage: "דחיית לו\"ז שקטה",
  completed_late: "הושלמה באיחור",
  completed_on_time: "הושלמה בזמן",
  insufficient_data: "נתונים חסרים",
  source_conflict: "סתירה בין מקורות",
  not_started: "טרם החלה",
  blocked: "חסומה"
};

const STATUS_TONE = {
  on_track: "ok",
  completed_on_time: "ok",
  watch: "watch",
  at_risk: "warn",
  milestone_at_risk: "warn",
  hidden_slippage: "warn",
  completed_late: "warn",
  delayed_vs_contractor: "bad",
  delayed_vs_contract: "bad",
  milestone_delayed: "bad",
  blocked: "bad",
  source_conflict: "conflict",
  insufficient_data: "unknown",
  not_started: "idle"
};

const BASIS_LABELS = {
  contract_finish: "החוזה",
  contractor_planned_finish: "לוח הקבלן",
  forecast_finish: "תחזית"
};

const GATE_LABELS = {
  contractAxis: "ציר חוזי",
  scheduleVersions: "גרסאות לוח",
  dependencies: "תלויות",
  observedEvents: "אירועי שטח",
  calendar: "לוח שנה"
};

const MONTHS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const AXES_ROW_CAP = 120;

async function api(path, { method = "GET", body = null, timeoutMs = 120_000, cache = "default" } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache,
      signal: controller.signal
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function scheduleLoadFailureMessage(failures = []) {
  const details = failures.map(({ label, error }) => `${label}: ${error?.message || "שגיאה לא ידועה"}`);
  const outagePattern = /(?:522|connection terminated|connection timeout|failed to fetch|abort|timeout)/iu;
  const appDataUnavailable = details.some((detail) => outagePattern.test(detail));
  const headline = appDataUnavailable
    ? "APP DATA אינו זמין כרגע (522/timeout). נתוני לוח הזמנים המוצגים חלקיים או אינם זמינים."
    : "לא ניתן היה להשלים את טעינת נתוני לוח הזמנים. הנתונים המוצגים עשויים להיות חלקיים.";
  return `${headline} לא בוצע שינוי בנתונים. אפשר לנסות שוב לאחר שחיבור Supabase יתאושש.`;
}

// Rule 1: null is "on time", never 0.
function latenessText(lateness) {
  if (!lateness) return "—";
  if (lateness.daysLate != null) {
    const working = lateness.workingDaysLate != null ? ` (${lateness.workingDaysLate} ימי עבודה)` : "";
    return `באיחור ${lateness.daysLate} ימים${working}`;
  }
  if (lateness.daysRemaining != null) {
    if (lateness.daysRemaining === 0) return "היום";
    const working = lateness.workingDaysRemaining != null ? ` (${lateness.workingDaysRemaining} ימי עבודה)` : "";
    return `נותרו ${lateness.daysRemaining} ימים${working}`;
  }
  return "—";
}

// Rule 2: a number without its basis is meaningless.
function basisText(lateness) {
  if (!lateness?.basis || !lateness?.basisDate) return "ללא בסיס";
  return `מול ${BASIS_LABELS[lateness.basis] ?? lateness.basis}: ${lateness.basisDate}`;
}

const StatusBadge = ({ status }) => (
  <span className={`schedBadge schedTone-${STATUS_TONE[status] ?? "unknown"}`}>
    {STATUS_LABELS[status] ?? status}
  </span>
);

const ConfidenceBadge = ({ confidence }) => {
  if (!confidence) return null;
  const level = confidence.level ?? "low";
  const label = level === "high" ? "ביטחון גבוה" : level === "medium" ? "ביטחון בינוני" : "ביטחון נמוך";
  return (
    <span className={`schedBadge schedConf-${level}`} title={`ציון: ${confidence.score}`}>
      {level === "low" ? "⚠ " : ""}{label}
    </span>
  );
};

const GatesBlock = ({ gates, compact = false }) => {
  if (!gates) return null;
  return (
    <div className={`schedGates ${compact ? "is-compact" : ""}`}>
      {!compact && <span className="schedGatesTitle">מה נבדק:</span>}
      {Object.entries(GATE_LABELS).map(([key, label]) => {
        const value = gates[key];
        const ok = value === "ok" || (key === "scheduleVersions" && Number(value) > 1);
        const detail = key === "scheduleVersions" ? `${label}: ${value}` : label;
        return (
          <span key={key} className={`schedGate ${ok ? "is-ok" : value === "stale" ? "is-stale" : "is-missing"}`}
            title={value === "missing" ? "לא זמין — לא נבדק, לא נלקח בחשבון" : value === "stale" ? "קיים אך לא מעודכן" : "נבדק"}>
            {ok ? "✓" : value === "stale" ? "◐" : "✗"} {detail}
          </span>
        );
      })}
    </div>
  );
};

// ─── The three-axis timeline ─────────────────────────────────────────────────

const AxisLegend = ({ showLateLines = true }) => (
  <div className="axisLegend">
    <span><i className="axisSwatch swPlan" /> תכנון הקבלן</span>
    <span><i className="axisSwatch swFill" /> % ביצוע מדווח</span>
    {showLateLines ? <span><i className="axisSwatch swLate" /> חריגה עד "נכון ל-"</span> : null}
    <span><i className="axisSwatch swForecast" >◆</i> תחזית סיום</span>
    <span><i className="axisSwatch swContract">⚑</i> אבן דרך חוזית</span>
    <span><i className="axisSwatch swTrigger">▶</i> תחילת ספירה חוזית</span>
    <span><i className="axisSwatch swObserved" /> ביצוע נצפה (BIDoc)</span>
    <span><i className="axisSwatch swActivityEvent">●</i> עדכון / התראה משויכים</span>
    <span><i className="axisSwatch swToday" /> קו "נכון ל-"</span>
  </div>
);

function AxisRow({ indicator, scale, asOf, showLateLines = true, selected, onSelect, eventCount = 0, expanded = false, onToggleEvents }) {
  const t = indicator.timing ?? {};
  const l = indicator.lateness ?? {};
  const planStart = scale.pos(t.plannedStart);
  const planEnd = scale.pos(t.plannedFinish);
  const contract = scale.pos(t.contractFinish);
  const forecast = scale.pos(t.forecastFinish);
  const obsStart = scale.pos(t.observedStart);
  const obsEnd = scale.pos(t.observedFinish);
  const basisPos = scale.pos(l.basisDate);
  const asOfPos = scale.pos(asOf);
  const percent = t.percentComplete;
  const isLate = l.isLate === true;

  return (
    <div className={`axisRow ${selected ? "is-selected" : ""}`} onClick={() => onSelect(indicator)}>
      <div className="axisTrack" dir="ltr">
        {/* Contract axis — a flag when it exists. An absent axis renders as an
            empty lane: full-width dashed "missing" markers on every row merged
            visually with the breach bars into one unreadable stripe. What was
            not checked is stated once, in the project-level gates. */}
        <div className="axisLane">
          {contract != null
            ? <span className="axisContractFlag" style={{ left: `${contract}%` }} title={`מועד חוזי: ${t.contractFinish}`}>⚑</span>
            : null}
        </div>
        {/* Contractor plan axis */}
        <div className="axisLane">
          {planStart != null && planEnd != null && (
            <div className={`axisBarPlan ${indicator.subject.isMilestone ? "is-milestone" : ""}`}
              style={{ left: `${planStart}%`, width: `${Math.max(planEnd - planStart, 0.6)}%` }}
              title={`תכנון: ${t.plannedStart} → ${t.plannedFinish}`}>
              {percent != null && percent > 0
                ? <div className="axisBarFill" style={{ width: `${percent}%` }} title={`${percent}% ביצוע מדווח`} />
                : null}
            </div>
          )}
          {showLateLines && isLate && basisPos != null && asOfPos != null && asOfPos > basisPos && (
            <div className="axisBarLate" style={{ left: `${basisPos}%`, width: `${asOfPos - basisPos}%` }}
              title={`${latenessText(l)} — ${basisText(l)}`} />
          )}
        </div>
        {/* Execution axis (BIDoc): observed when it exists, forecast otherwise.
            Nothing at all when neither exists — an empty lane is the honest
            rendering of "no execution evidence", not a dashed placeholder. */}
        <div className="axisLane">
          {obsStart != null || obsEnd != null ? (
            <div className="axisBarObserved"
              style={{ left: `${obsStart ?? obsEnd}%`, width: `${Math.max((obsEnd ?? obsStart) - (obsStart ?? obsEnd), 0.6)}%` }}
              title={`ביצוע נצפה: ${t.observedStart ?? "?"} → ${t.observedFinish ?? "?"}`} />
          ) : forecast != null ? (
            <span className="axisForecast" style={{ left: `${forecast}%` }} title={`תחזית סיום: ${t.forecastFinish}`}>◆</span>
          ) : null}
        </div>
      </div>
      <div className="axisName">
        <span className="axisNameTitleLine">
          {eventCount ? (
            <button type="button" className="axisExpandBtn" aria-expanded={expanded}
              aria-label={`${expanded ? "סגור" : "פתח"} ${eventCount} עדכונים והתראות`}
              onClick={(event) => { event.stopPropagation(); onToggleEvents(); }}>
              {expanded ? "▾" : "◂"}<b>{eventCount}</b>
            </button>
          ) : null}
          <span className="axisNameText" title={indicator.subject.name}>
            {indicator.subject.isMilestone ? "◆ " : ""}{indicator.subject.name}
          </span>
        </span>
        <span className="axisNameMeta">
          <StatusBadge status={indicator.status} />
          <span className="axisLateText">{latenessText(l)}</span>
        </span>
      </div>
    </div>
  );
}

function AxisEventRow({ item, scale }) {
  const left = scale.pos(item.date);
  return (
    <div className="axisEventRow">
      <div className="axisTrack" dir="ltr">
        {left != null ? (
          <span className={`axisEventPoint is-${item.kind}`} style={{ left: `${left}%` }}
            title={`${item.alertType} · ${item.date} · ${item.title}`}>●</span>
        ) : null}
      </div>
      <div className="axisName axisEventName">
        <span className={`activityUpdateKind is-${item.kind}`}>{item.kind === "update" ? "עדכון" : "התראה"}</span>
        <span className="axisNameText" title={item.title}>{item.title}</span>
        <time>{item.date || "ללא תאריך"}</time>
      </div>
    </div>
  );
}

function ThreeAxesView({ indicators, allIndicators, pendingConditions, timelineItems, asOf, showLateLines, showAsOfMarker, selected, onSelect }) {
  const [expandedActivities, setExpandedActivities] = useState(() => new Set());
  const provisionalMarkers = useMemo(() => (pendingConditions ?? []).flatMap((condition) => {
    const date = condition?.metadata?.trigger_evidence?.provisionalDueDate;
    return date ? [{ date, name: condition.name || "אבן דרך חוזית", provisional: true }] : [];
  }), [pendingConditions]);
  const triggerMarkers = useMemo(() => {
    const byDate = new Map();
    for (const condition of pendingConditions ?? []) {
      const date = condition?.trigger_event_date;
      if (!date) continue;
      const current = byDate.get(date) || { date, names: [] };
      const name = condition.name || "נקודת זמן חוזית";
      if (!current.names.includes(name)) current.names.push(name);
      byDate.set(date, current);
    }
    return [...byDate.values()].map((marker) => ({
      date: marker.date,
      name: marker.names.join(" · "),
      count: marker.names.length
    }));
  }, [pendingConditions]);
  const scaleIndicators = useMemo(() => [
    ...(allIndicators ?? indicators),
    ...provisionalMarkers.map((marker) => ({ timing: { contractFinish: marker.date } })),
    ...triggerMarkers.map((marker) => ({ timing: { contractFinish: marker.date } })),
    ...(timelineItems ?? []).filter((item) => item.activityKey && item.date).map((item) => ({ timing: { contractFinish: item.date } }))
  ], [allIndicators, indicators, provisionalMarkers, triggerMarkers, timelineItems]);
  const scaleRows = showAsOfMarker ? indicators : (allIndicators ?? indicators);
  const scale = useMemo(
    () => makeScheduleScale(scaleRows, showAsOfMarker ? asOf : null, scaleIndicators),
    [scaleRows, scaleIndicators, asOf, showAsOfMarker]
  );
  // The contract axis, chart-wide: every contractual milestone date extracted
  // from the contract renders as a labeled vertical line across all rows —
  // the supervisor sees plan and execution against the contract, not a glyph.
  // Sourced from the unfiltered indicator set: a milestone that isn't itself
  // late (e.g. "רק באיחור") must not vanish from the contract axis just
  // because it dropped out of the row list.
  const contractMarkers = useMemo(() => {
    const byDate = new Map();
    for (const ind of allIndicators ?? indicators) {
      const date = ind.timing?.contractFinish;
      if (!date || byDate.has(date)) continue;
      byDate.set(date, {
        date,
        name: ind.subject?.milestoneKey ? ind.subject.name : "אבן דרך חוזית"
      });
    }
    for (const marker of provisionalMarkers) {
      if (!byDate.has(marker.date)) byDate.set(marker.date, marker);
    }
    return [...byDate.values()];
  }, [indicators, allIndicators, provisionalMarkers]);
  const eventsByActivity = useMemo(() => {
    const grouped = new Map();
    for (const item of timelineItems ?? []) {
      if (!item.activityKey || !item.date) continue;
      const list = grouped.get(item.activityKey) || [];
      list.push(item);
      grouped.set(item.activityKey, list);
    }
    for (const list of grouped.values()) list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return grouped;
  }, [timelineItems]);
  const toggleActivity = (key) => setExpandedActivities((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  if (!scale) return <div className="schedEmpty">אין תאריכים להצגה</div>;
  const shown = indicators.slice(0, AXES_ROW_CAP);
  const asOfPos = showAsOfMarker ? scale.pos(asOf) : null;
  const visibleLateLines = showLateLines && showAsOfMarker;
  return (
    <div className="axesView">
      <AxisLegend showLateLines={visibleLateLines} />
      <div className="axesBody">
        <div className="axesTimeArea" dir="ltr">
          <div className="axesMonths">
            {scale.months.map((m) => (
              <span key={m.iso} className="axesMonthTick" style={{ left: `${m.left}%` }}>
                {MONTHS_HE[m.month]} {String(m.year).slice(2)}
              </span>
            ))}
          </div>
          <div className="axesRowsOverlay">
            {scale.months.map((m) => (
              <span key={m.iso} className="axesGridLine" style={{ left: `${m.left}%` }} />
            ))}
            {triggerMarkers.map((marker) => {
              const left = scale.pos(marker.date);
              if (left == null) return null;
              const label = `תחילת ספירה: ${marker.name} · ${formatIsraeliDate(marker.date)}`;
              return (
                <span key={`trigger:${marker.date}`} className="axesTriggerLine" style={{ left: `${left}%` }} title={label}>
                  <label>▶ {label}{marker.count > 1 ? ` (${marker.count})` : ""}</label>
                </span>
              );
            })}
            {contractMarkers.map((marker) => {
              const left = scale.pos(marker.date);
              if (left == null) return null;
              return (
                <span key={`${marker.date}:${marker.name}`} className={`axesContractLine ${marker.provisional ? "is-provisional" : ""}`}
                  style={{ left: `${left}%` }}
                  title={marker.provisional ? "מועד משוער בלבד — ממתין להשלמת לוח ימי העבודה והחגים" : undefined}>
                  <label>⚑ {marker.provisional ? "משוער: " : ""}{marker.name} · {marker.date}</label>
                </span>
              );
            })}
            {asOfPos != null && (
              <span className="axesTodayLine" style={{ left: `${asOfPos}%` }}>
                <label>נכון ל-{asOf}</label>
              </span>
            )}
          </div>
        </div>
        <div className="axesRows">
          {shown.map((ind) => {
            const key = scheduleSubjectKey(ind);
            const events = eventsByActivity.get(key) || [];
            const expanded = expandedActivities.has(key);
            return (
              <React.Fragment key={key}>
                <AxisRow indicator={ind} scale={scale} asOf={asOf} showLateLines={visibleLateLines}
                  selected={scheduleSubjectKey(selected) === key} onSelect={onSelect}
                  eventCount={events.length} expanded={expanded} onToggleEvents={() => toggleActivity(key)} />
                {expanded ? events.map((item) => <AxisEventRow key={`${item.sourceTable}:${item.id}`} item={item} scale={scale} />) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {indicators.length > AXES_ROW_CAP ? (
        <div className="axesCapNote">מוצגות {AXES_ROW_CAP} הפעילויות החמורות מתוך {indicators.length} — צמצם עם הפילטרים למעלה</div>
      ) : null}
    </div>
  );
}

function ActivityPicker({ activities, value, disabled, busy, onChange }) {
  const detailsRef = useRef(null);
  const [query, setQuery] = useState("");
  const selected = activities.find((activity) => activity.key === value);
  const filtered = activities.filter((activity) => `${activity.name} ${activity.dateLabel}`.toLocaleLowerCase("he").includes(query.trim().toLocaleLowerCase("he"))).slice(0, 80);
  const choose = (key) => {
    onChange(key);
    setQuery("");
    if (detailsRef.current) detailsRef.current.open = false;
  };
  return (
    <details ref={detailsRef} className="activityPicker">
      <summary className={!value ? "is-empty" : ""} aria-disabled={disabled || busy} onClick={(event) => {
        if (disabled || busy) event.preventDefault();
      }}>{busy ? "שומר…" : selected ? `${selected.name} · ${selected.dateLabel}` : "בחר פעילות"}</summary>
      <div className="activityPickerMenu">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש פעילות…" autoFocus />
        {value ? <button type="button" className="activityPickerClear" onClick={() => choose(null)}>נקה שיוך</button> : null}
        <div className="activityPickerOptions">
          {filtered.map((activity) => (
            <button type="button" key={activity.key} className={activity.key === value ? "is-selected" : ""}
              onClick={() => choose(activity.key)} title={activity.name}>
              <span>{activity.name}</span><small>{activity.dateLabel}</small>
            </button>
          ))}
          {!filtered.length ? <span className="activityPickerEmpty">לא נמצאה פעילות</span> : null}
        </div>
      </div>
    </details>
  );
}

function ActivityUpdatesTable({
  items, activities, busyId, onAssign, agentBusyId, agentResults, onRunAgent, onConfirmAgent, onRejectAgent,
  agentBatch, onStartAgentBatch, onStopAgentBatch, onResumeAgentBatch, onRestartAgentBatch,
  timeFilterEnabled, onTimeFilterChange, batchLimit, onBatchLimitChange, labelCoverage
}) {
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_ACTIVITY_UPDATE_FILTERS }));
  const [visibleCount, setVisibleCount] = useState(100);
  const deferredQuery = useDeferredValue(filters.query);
  const deferredText = useDeferredValue(filters.text);
  const deferredActivity = useDeferredValue(filters.activity);
  const effectiveFilters = useMemo(() => ({
    ...filters,
    query: deferredQuery,
    text: deferredText,
    activity: deferredActivity
  }), [filters, deferredQuery, deferredText, deferredActivity]);
  const filtered = useMemo(
    () => filterActivityUpdates(items, activities, effectiveFilters),
    [items, activities, effectiveFilters]
  );
  const assigned = filtered.filter((item) => item.activityKey).length;
  const sharedReviewCount = Object.values(agentResults || {}).filter((result) => result?.persistedReview && !result?.approved && !result?.rejected).length;
  const eligibleCount = useMemo(() => buildActivityAssignmentBatchQueue(filtered).length, [filtered]);
  const boundedBatchCount = Math.min(eligibleCount, normalizeActivityAssignmentBatchLimit(batchLimit));
  const severityOptions = useMemo(() => [...new Set(items.map((item) => item.severity).filter((value) => value !== null && value !== undefined))]
    .sort((a, b) => Number(a) - Number(b)), [items]);
  const statusOptions = useMemo(() => [...new Set(items.map((item) => String(item.status || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "he")), [items]);
  const filtersActive = hasActiveActivityUpdateFilters(filters);
  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(100);
  }, []);
  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_ACTIVITY_UPDATE_FILTERS });
    setVisibleCount(100);
  }, []);
  const batchActive = agentBatch.status === ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING
    || agentBatch.status === ACTIVITY_ASSIGNMENT_BATCH_STATUSES.STOPPING;
  const anotherRowActionActive = Boolean(agentBusyId || busyId);
  const batchStatusText = activityAssignmentBatchStatusText(agentBatch);
  return (
    <section className="activityUpdatesPanel" aria-labelledby="activity-updates-title">
      <div className="activityUpdatesHead">
        <div>
          <h3 id="activity-updates-title">עדכונים והתראות על ציר הזמן</h3>
          <p aria-live="polite">
            {filtersActive ? `${filtered.length} מתוך ${items.length}` : items.length} פריטים · {assigned} משויכים לפעילות
            {sharedReviewCount ? ` · ${sharedReviewCount} ממתינים להחלטת צוות` : ""}
            {labelCoverage ? ` · ${labelCoverage.caseCount || 0} תוויות כיול מפורשות` : ""}
          </p>
        </div>
        <div className="activityUpdatesHeadTools">
          <div className="activityAgentBatchControls" aria-label="בדיקה קבוצתית של התראות לא משויכות">
            <label className="activityAgentBatchLimit">
              <span>כמות לבדיקה</span>
              <select value={batchLimit} disabled={batchActive}
                onChange={(event) => onBatchLimitChange(normalizeActivityAssignmentBatchLimit(event.target.value))}>
                {ACTIVITY_ASSIGNMENT_BATCH_LIMIT_OPTIONS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}
              </select>
            </label>
            <label className="activityAgentTimeFilter" title="בריצה קבוצתית בלבד: דלג על התראות שאינן קשורות לזמן, עיכוב, תאריך או לוח זמנים">
              <input type="checkbox" checked={timeFilterEnabled} disabled={batchActive}
                onChange={(event) => onTimeFilterChange(event.target.checked)} />
              <span>סינון זמן</span>
            </label>
            {agentBatch.status === ACTIVITY_ASSIGNMENT_BATCH_STATUSES.PAUSED ? (
              <>
                <button type="button" className="activityAgentBatchButton is-primary" disabled={anotherRowActionActive}
                  onClick={onResumeAgentBatch}>המשך מאותה נקודה</button>
                <button type="button" className="activityAgentBatchButton" disabled={anotherRowActionActive || !eligibleCount}
                  onClick={() => onRestartAgentBatch(filtered, batchLimit)}>הרץ מחדש</button>
              </>
            ) : agentBatch.status === ACTIVITY_ASSIGNMENT_BATCH_STATUSES.COMPLETED ? (
              <button type="button" className="activityAgentBatchButton" disabled={!eligibleCount}
                onClick={() => onRestartAgentBatch(filtered, batchLimit)}>הרץ מחדש</button>
            ) : (
              <>
                <button type="button" className="activityAgentBatchButton is-primary" disabled={batchActive || anotherRowActionActive || !eligibleCount}
                  onClick={() => onStartAgentBatch(filtered, batchLimit)}>{eligibleCount ? `בדוק ${boundedBatchCount} מתוך ${eligibleCount} לא משויכות` : "אין התראות לא משויכות לבדיקה"}</button>
                {batchActive ? (
                  <button type="button" className="activityAgentBatchButton is-stop"
                    disabled={agentBatch.status === ACTIVITY_ASSIGNMENT_BATCH_STATUSES.STOPPING}
                    onClick={onStopAgentBatch}>{agentBatch.status === ACTIVITY_ASSIGNMENT_BATCH_STATUSES.STOPPING ? "עוצר…" : "עצור"}</button>
                ) : null}
              </>
            )}
          </div>
          {eligibleCount ? <p className="activityAgentBatchExplanation">{eligibleCount} התראות ממתינות לבדיקה. המספר אינו מציין שיוכים שבוצעו.</p> : null}
          {batchStatusText ? (
            <div className={`activityAgentBatchStatus is-${agentBatch.status}`} role="status" aria-live="polite">
              <progress max={Math.max(agentBatch.total, 1)} value={agentBatch.processed} aria-label={batchStatusText} />
              <span>{batchStatusText}</span>
            </div>
          ) : null}
          <div className="activityUpdatesGlobalFilter">
            <input type="search" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="חיפוש כללי בעדכונים והתראות…" aria-label="חיפוש כללי בעדכונים והתראות" />
            <button type="button" onClick={clearFilters} disabled={!filtersActive}>נקה מסננים</button>
          </div>
        </div>
      </div>
      <div className="activityUpdatesTableWrap">
        <table className="activityUpdatesTable">
          <thead>
            <tr className="activityUpdatesHeaderRow"><th>סוג</th><th>תאריך</th><th>התראה / עדכון</th><th>חומרה</th><th>סטטוס</th><th>שיוך לפעילות בלוח</th></tr>
            <tr className="activityUpdatesFilterRow">
              <th>
                <select value={filters.kind} onChange={(event) => updateFilter("kind", event.target.value)} aria-label="סינון לפי סוג">
                  <option value="">כל הסוגים</option><option value="alert">התראות</option><option value="update">עדכונים</option>
                </select>
              </th>
              <th>
                <div className="activityUpdatesDateFilter">
                  <label><span>מ־</span><input type="date" value={filters.dateFrom} max={filters.dateTo || undefined}
                    onChange={(event) => updateFilter("dateFrom", event.target.value)} aria-label="סינון מתאריך" /></label>
                  <label><span>עד</span><input type="date" value={filters.dateTo} min={filters.dateFrom || undefined}
                    onChange={(event) => updateFilter("dateTo", event.target.value)} aria-label="סינון עד תאריך" /></label>
                </div>
              </th>
              <th><input type="search" value={filters.text} onChange={(event) => updateFilter("text", event.target.value)}
                placeholder="חיפוש בתוכן…" aria-label="סינון לפי תוכן ההתראה או העדכון" /></th>
              <th>
                <select value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)} aria-label="סינון לפי חומרה">
                  <option value="">הכול</option>{severityOptions.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                </select>
              </th>
              <th>
                <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} aria-label="סינון לפי סטטוס">
                  <option value="">כל הסטטוסים</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </th>
              <th>
                <div className="activityUpdatesAssignmentFilter">
                  <select value={filters.assignmentState} onChange={(event) => updateFilter("assignmentState", event.target.value)} aria-label="סינון לפי מצב שיוך">
                    <option value="">כל השיוכים</option><option value="assigned">משויכים בלבד</option><option value="unassigned">לא משויכים</option>
                  </select>
                  <input type="search" value={filters.activity} onChange={(event) => updateFilter("activity", event.target.value)}
                    placeholder="שם פעילות…" aria-label="סינון לפי שם הפעילות המשויכת" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, visibleCount).map((item) => {
              const agentResult = agentResults?.[item.id];
              const isAgentBusy = agentBusyId === item.id;
              const reviewCandidates = activityAssignmentReviewCandidates(agentResult);
              const reviewChoiceBusy = isAgentBusy || busyId === item.id || batchActive;
              const hasPersistedAuditRun = Boolean(agentResult?.runId && agentResult?.auditPersisted);
              const canRecordReviewedLabel = Boolean(agentResult?.persistedReview && agentResult?.reviewId);
              const assignmentPresentation = activityAssignmentMethodPresentation(item);
              return (
                <React.Fragment key={`${item.sourceTable}:${item.id}`}>
                  <tr className={item.activityKey ? "is-assigned" : ""}>
                    <td><span className={`activityUpdateKind is-${item.kind}`}>{item.kind === "update" ? "עדכון" : "התראה"}</span></td>
                    <td className="activityUpdateDate">{item.date || <span title="נדרש data_date אמיתי">ללא תאריך</span>}</td>
                    <td><div className="activityUpdateTitle" title={item.title}>{item.href ? <a href={item.href} target="_blank" rel="noreferrer">{item.title}</a> : item.title}</div><small>{item.alertType}</small></td>
                    <td>{item.severity ?? "—"}</td><td>{item.status || "—"}</td>
                    <td>
                      <div className="activityAssignmentActions">
                        <ActivityPicker activities={activities} value={item.activityKey} disabled={!item.date || batchActive || agentResult?.detachedFromCurrentFeed}
                          busy={busyId === item.id} onChange={(activityKey) => onAssign(item, activityKey)} />
                        {assignmentPresentation ? (
                          <span className={`activityAssignmentMethod is-${assignmentPresentation.key}`}>{assignmentPresentation.label}</span>
                        ) : (
                          <button type="button" className="activityAgentButton" disabled={!item.date || isAgentBusy || busyId === item.id || batchActive || agentResult?.detachedFromCurrentFeed}
                            onClick={() => onRunAgent(item)} title="בדוק התאמה והצג הצעות לפעילות עבור שורה זו">
                            {isAgentBusy ? "בודק התאמה…" : "בדיקת התאמה"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {agentResult ? (
                    <tr className="activityAgentResultRow">
                      <td colSpan={6}>
                        {agentResult.error ? <div className="activityAgentResult is-error">{agentResult.error}</div> : agentResult.status === "filtered_out" ? (
                          <div className="activityAgentResult is-filtered">
                            <div className="activityAgentResultHead">
                              <strong>דולג על ידי סינון זמן</strong>
                              <span>ביטחון {agentResult.timeFilter?.confidence ?? 0}%</span>
                            </div>
                            <p>{agentResult.timeFilter?.reason || "ההתראה אינה קשורה לזמן, עיכוב, תאריך או לוח זמנים."}</p>
                          </div>
                        ) : (
                          <div className={`activityAgentResult ${agentResult.decision?.autoAssigned ? "is-auto" : ""}`}>
                            <div className="activityAgentResultHead">
                              <strong>{agentResult.decision?.autoAssigned ? "שויך אוטומטית" : agentResult.decision?.selectedActivityName || "לא נמצאה התאמה חד־משמעית"}</strong>
                              <span>
                                ציון התאמה {agentResult.decision?.rankingScore ?? agentResult.decision?.confidence ?? 0}
                                {` · פער ${agentResult.decision?.rankingGap ?? agentResult.decision?.margin ?? 0}`}
                                {Number.isFinite(agentResult.decision?.calibratedProbability)
                                  ? ` · הסתברות מכוילת ${Math.round(agentResult.decision.calibratedProbability * 100)}%`
                                  : ""}
                              </span>
                            </div>
                            {agentResult.persistedReview ? (
                              <span className={`activityAgentSharedReviewBadge ${agentResult.approved || agentResult.rejected ? "is-resolved" : ""}`}>
                                {agentResult.approved ? "נבחרה פעילות · הרשומה סומנה כטופלה" : agentResult.rejected ? "ההצעות נדחו · הרשומה סומנה כטופלה" : "כרטיס הבדיקה נשמר · ממתין להחלטת צוות"}
                              </span>
                            ) : null}
                            {agentResult.detachedFromCurrentFeed ? (
                              <small className="activityAgentWarning">ההתראה המקורית אינה נמצאת עוד בפיד הפעיל. ההחלטה תישמר כתווית כיול בלבד ולא תשנה שיוך בלוח.</small>
                            ) : null}
                            <p>{agentResult.decision?.reason}</p>
                            {reviewCandidates.length ? (
                              <div className="activityAgentReview" aria-label="בחירת פעילות מתוך הצעות הסוכן">
                                <strong className="activityAgentReviewPrompt">נדרשת החלטה שלך - בחר את הפעילות המתאימה:</strong>
                                <div className="activityAgentCandidates" role="group" aria-label="פעילויות מוצעות">
                                  {reviewCandidates.map(candidate => (
                                    <button type="button" key={candidate.activityKey} disabled={reviewChoiceBusy}
                                      onClick={() => canRecordReviewedLabel || hasPersistedAuditRun
                                        ? onConfirmAgent(item, agentResult, candidate)
                                        : onAssign(item, candidate.activityKey)}>
                                      <span>{candidate.name}</span><small>ציון התאמה {candidate.finalScore} · {candidate.plannedStart || "?"}–{candidate.plannedFinish || "?"}</small>
                                    </button>
                                  ))}
                                  {canRecordReviewedLabel ? SCHEDULE_ASSIGNMENT_REVIEW_LABEL_OPTIONS.map((option) => (
                                    <button type="button" className="is-reject" key={option.type} disabled={reviewChoiceBusy}
                                      onClick={() => onRejectAgent(item, agentResult, option)}>{option.labelHe}</button>
                                  )) : hasPersistedAuditRun ? (
                                    <button type="button" className="is-reject" disabled={reviewChoiceBusy}
                                      onClick={() => onRejectAgent(item, agentResult, SCHEDULE_ASSIGNMENT_REVIEW_LABEL_OPTIONS[0])}>אף אפשרות אינה מתאימה</button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                            {(agentResult.warnings || []).map(warning => <small className="activityAgentWarning" key={warning}>⚠ {warning}</small>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
            {!filtered.length ? <tr><td colSpan={6} className="schedEmpty">אין פריטים התואמים למסננים שנבחרו</td></tr> : null}
          </tbody>
        </table>
      </div>
      {visibleCount < filtered.length ? <button type="button" className="activityUpdatesMore" onClick={() => setVisibleCount((count) => count + 100)}>טען עוד 100</button> : null}
    </section>
  );
}

// ─── Detail (single activity, spec 15.4.3) ───────────────────────────────────

const IndicatorDetail = ({ indicator, onClose }) => {
  if (!indicator) return null;
  const t = indicator.timing ?? {};
  const v = indicator.variances ?? {};
  return (
    <div className="schedDetail">
      <div className="schedDetailHead">
        <div>
          <StatusBadge status={indicator.status} />
          <ConfidenceBadge confidence={indicator.confidence} />
          {indicator.severity != null && <span className="schedBadge schedSeverity">חומרה {indicator.severity}</span>}
        </div>
        <button type="button" className="schedClose" onClick={onClose}>✕</button>
      </div>
      <h3 className="schedDetailTitle">{indicator.subject?.name}</h3>
      <div className="schedDetailMeta">
        {latenessText(indicator.lateness)} · {basisText(indicator.lateness)}
      </div>
      <p className="schedExplanation">{indicator.explanation}</p>
      <div className="schedTimingGrid">
        <div><span>התחלה מתוכננת</span><b>{t.plannedStart ?? "—"}</b></div>
        <div><span>סיום מתוכנן</span><b>{t.plannedFinish ?? "—"}</b></div>
        <div><span>סיום חוזי</span><b>{t.contractFinish ?? "—"}</b></div>
        <div><span>תחזית סיום</span><b>{t.forecastFinish ?? "—"}</b></div>
        <div><span>סיום בפועל</span><b>{t.observedFinish ?? "—"}</b></div>
        <div><span>% ביצוע</span><b>{t.percentComplete ?? "—"}</b></div>
        <div><span>סטייה מגרסה קודמת</span><b>{v.contractorVersionSlippageDays != null ? `${v.contractorVersionSlippageDays} ימים` : "—"}</b></div>
        <div><span>Float נותר</span><b>{v.remainingFloatDays != null ? `${v.remainingFloatDays} ימים` : "— (אין נתוני תלויות)"}</b></div>
      </div>
      <GatesBlock gates={indicator.gates} />
      {indicator.evidence?.length ? (
        <div className="schedEvidence">
          <div className="schedGatesTitle">ראיות:</div>
          {indicator.evidence.map((item) => (
            <div key={item.evidenceId} className="schedEvidenceRow">
              <span className="schedEvidenceKind">{item.kind}</span>
              <span>{item.excerpt}</span>
              {item.eventDate ? <span className="schedEvidenceDate">{item.eventDate}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ─── Pending conditions box (spec 6.8א) ──────────────────────────────────────
//
// Obligations that have no date yet because their trigger has not arrived.
// They deliberately do NOT appear on the timeline: a condition without a
// resolved date has no position in time. This box is where they wait.

const CATEGORY_LABELS = {
  execution: "ביצוע",
  payment: "תשלומים",
  notice: "הודעות",
  guarantee: "ערבויות",
  insurance: "ביטוחים",
  warranty: "בדק ואחריות",
  other: "אחר"
};

const UNIT_LABELS = {
  hours: "שעות",
  working_days: "ימי עבודה",
  calendar_days: "ימים",
  weeks: "שבועות",
  months: "חודשים"
};

const ANCHOR_KIND_LABELS = {
  event: "אירוע נכנס",
  schedule_task: "נקודה בלוח הקבלן",
  milestone: "אבן דרך אחרת",
  unspecified: "לא הוגדר"
};

function offsetText(condition) {
  if (condition.offset_value == null) return "ללא כימות";
  const unit = UNIT_LABELS[condition.offset_unit] ?? condition.offset_unit ?? "";
  return `${Number(condition.offset_value)} ${unit}`.trim();
}

function conditionSourceHref(condition) {
  const workspaceId = condition?.metadata?.contracts_workspace_id;
  const decisionId = condition?.source_contract_decision_id;
  if (!workspaceId || !decisionId) return null;
  const params = new URLSearchParams({ decisionId });
  if (condition.source_page) params.set("page", String(condition.source_page));
  return `/api/contracts/workspaces/${encodeURIComponent(workspaceId)}/source-link?${params}`;
}

const PendingConditionsBox = ({
  data,
  expanded,
  onToggle,
  resolvingId,
  onResolve,
  onManualResolve,
  manualDates,
  onManualDateChange,
  rowResults
}) => {
  const conditions = data?.conditions ?? [];
  const grouped = Object.entries(
    conditions.reduce((acc, c) => {
      (acc[c.category] ||= []).push(c);
      return acc;
    }, {})
  );
  return (
    <div className="condBox">
      <button type="button" className="condHead" onClick={onToggle}
        aria-expanded={expanded} aria-controls="schedule-conditions-body">
        <span className="condHeadTitle">
          ⏳ פנקס זמנים יחסיים מהחוזה
          <span className="condHeadCount">{conditions.length}</span>
        </span>
        <span className="condHeadHint">
          כל נקודת זמן שנמשכה מהחוזה, הפעולה שמפעילה אותה והתאריך שנקלט בפועל
        </span>
        <span className="condChevron">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded ? (
        <div id="schedule-conditions-body" className="condBody">
          <div className="condResolverBar">
            <div>
              <strong>אותו שדה — הזנה ידנית היום, השלמה אוטומטית בהמשך</strong>
              <span>בחירת תאריך מפעילה את מנוע הלו״ז הדטרמיניסטי. איתור אוטומטי מחפש את אותו אירוע ב־Gantt, באירועים מזוהים ורק אז ב־RAG.</span>
            </div>
          </div>
          {!grouped.length ? (
            <div className="condEmptyState">
              <span className="condEmptyIcon">⌛</span>
              <div>
                <strong>התנאים היחסיים טרם סונכרנו למאגר הלו״ז</strong>
                <span>לאחר הפעלת חיבור Indicator הם יופיעו כאן אוטומטית, ללא חילוץ חוזר של החוזה.</span>
              </div>
            </div>
          ) : grouped.map(([category, items]) => (
            <div key={category} className="condGroup">
              <div className="condGroupTitle">
                {CATEGORY_LABELS[category] ?? category}
                <span className="condGroupCount">{items.length}</span>
              </div>
              <div className="condTableWrap">
                <table className="condTable">
                  <thead>
                    <tr>
                      <th>ההתחייבות החוזית והזמן</th>
                      <th>האירוע שמפעיל את הספירה</th>
                      <th>תאריך האירוע בפועל</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => {
                      const result = rowResults?.[c.id];
                      const isBusy = resolvingId === c.id;
                      const sourceHref = conditionSourceHref(c);
                      const pendingReason = c.metadata?.pending_reason;
                      const hasManualDraft = manualDates && Object.prototype.hasOwnProperty.call(manualDates, c.id);
                      const selectedDateInput = hasManualDraft
                        ? manualDates[c.id]
                        : formatIsraeliDate(c.trigger_event_date ?? "");
                      const selectedDate = parseIsraeliDate(selectedDateInput);
                      const invalidDate = Boolean(selectedDateInput) && !selectedDate;
                      const isResolved = c.status === "resolved";
                      return (
                        <tr key={c.id} className={isResolved ? "is-resolved" : ""} title={c.source_excerpt}>
                          <td className="condContractPoint">
                            <div className="condOffsetLine">
                              <b>{offsetText(c)}</b>
                              <span className={`condState is-${c.status}`}>{isResolved ? "הושלם" : "ממתין"}</span>
                            </div>
                            <strong className="condName">{c.name}</strong>
                            {c.metadata?.action_description_he ? (
                              <span className="condActionDescription">
                                <b>מה החוזה מחייב:</b> {c.metadata.action_description_he}
                              </span>
                            ) : null}
                            <span className="condPage">
                              {sourceHref ? (
                                <a href={sourceHref} target="_blank" rel="noreferrer" title="פתיחת מסמך החוזה בקישור מאובטח קצר־חיים">
                                  {c.metadata?.source_filename || "מסמך החוזה"}{c.source_page ? ` · עמ׳ ${c.source_page}` : ""}
                                </a>
                              ) : c.source_page ? `עמ׳ ${c.source_page}` : "מקור חוזי"}
                            </span>
                          </td>
                          <td className="condTriggerCell">
                            <strong>{c.anchor_description || "האירוע המפעיל טרם תואר"}</strong>
                            <span className={`condAnchor is-${c.anchor_kind}`}>{ANCHOR_KIND_LABELS[c.anchor_kind] ?? c.anchor_kind}</span>
                            {pendingReason ? <span className="condPendingReason">{pendingReason}</span> : null}
                            {c.source_excerpt ? (
                              <details className="condSourceExcerpt">
                                <summary>הצג ציטוט מהחוזה</summary>
                                <p>{c.source_excerpt}</p>
                              </details>
                            ) : null}
                          </td>
                          <td className="condDateCell">
                            <div className="condDateEntry">
                              <input
                                type="text"
                                inputMode="numeric"
                                dir="ltr"
                                lang="he-IL"
                                placeholder="dd/mm/yyyy"
                                pattern="[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}"
                                value={selectedDateInput}
                                disabled={isResolved || Boolean(resolvingId)}
                                aria-label={`תאריך האירוע בפועל עבור ${c.name}`}
                                aria-invalid={invalidDate}
                                aria-describedby={`condition-date-hint-${c.id}`}
                                onChange={(event) => onManualDateChange(c.id, event.target.value)}
                                onBlur={() => {
                                  if (selectedDate) onManualDateChange(c.id, formatIsraeliDate(selectedDate));
                                }}
                              />
                              {!isResolved ? (
                                <button
                                  type="button"
                                  className="condManualBtn"
                                  onClick={() => onManualResolve(c, selectedDate)}
                                  disabled={!selectedDate || Boolean(resolvingId)}
                                >
                                  {isBusy ? "שומר…" : "שמור וחשב מועד"}
                                </button>
                              ) : <span className="condVerifiedDate">תאריך מאומת</span>}
                            </div>
                            <span id={`condition-date-hint-${c.id}`} className={`condDateHint ${invalidDate ? "is-error" : ""}`}>
                              {invalidDate ? "יש להזין תאריך תקין בפורמט יום/חודש/שנה" : "פורמט: יום/חודש/שנה"}
                            </span>
                            {!isResolved ? (
                              <button type="button" className="condResolveBtn" onClick={() => onResolve(c)} disabled={Boolean(resolvingId)}>
                                {isBusy ? "מנוע הלו״ז מחפש…" : "איתור אוטומטי במנוע הלו״ז"}
                              </button>
                            ) : null}
                            {result ? (
                              <span className={`condRowResult is-${result.status}`} title={result.reason || result.evidence?.reason || ""}>
                                {result.status === "not_found" ? "לא נמצא תאריך" : result.status === "needs_review" ? (result.provisionalDueDate ? `מועד משוער: ${formatIsraeliDate(result.provisionalDueDate)}` : "נדרשת בדיקה") : result.status === "error" ? result.reason || "החיפוש נכשל" : formatIsraeliDate(result.dueDate) || "הושלם"}
                                {result.errorCode === "openrouter_auth" ? <a className="condSettingsLink" href="#settings">עדכון מפתח בהגדרות</a> : null}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ScheduleAlertsBox = ({ alerts, expanded, onToggle }) => {
  const worstSeverity = alerts.reduce((highest, alert) => Math.max(highest, Number(alert.severity_level) || 0), 0);
  return (
    <section className="schedAlertsBox" aria-label="חריגות והתראות פעילות">
      <button type="button" className="schedAlertsHead" onClick={onToggle}
        aria-expanded={expanded} aria-controls="schedule-alerts-body">
        <span className="schedAlertsHeadTitle">
          חריגות והתראות פעילות
          <span className="schedAlertsCount">{alerts.length}</span>
        </span>
        <span className="schedAlertsHeadHint">
          {worstSeverity ? `החומרה הגבוהה ביותר: ${worstSeverity}` : "אין חומרה פעילה"}
        </span>
        <span className="schedAlertsChevron" aria-hidden="true">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded ? (
        <div id="schedule-alerts-body" className="schedAlerts">
          {alerts.map((alert) => (
            <article key={alert.id} className="schedAlertRow">
              <span className="schedBadge schedSeverity">חומרה {alert.severity_level}</span>
              <b>{alert.title}</b>
              <span className="schedAlertDesc">{alert.description}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const HealthStrip = ({ health }) => {
  if (!health) return null;
  const age = health.schedule?.ageDays;
  return (
    <div className="schedHealth">
      <div className="schedCard">
        <div className="schedCardValue">{health.late} <span className="schedCardOf">מתוך {health.computed}</span></div>
        <div className="schedCardLabel">פעילויות באיחור</div>
      </div>
      <div className="schedCard">
        <div className="schedCardValue">{health.totalDaysLate?.toLocaleString?.() ?? health.totalDaysLate}</div>
        <div className="schedCardLabel">סה"כ ימי איחור</div>
      </div>
      <div className="schedCard">
        <div className="schedCardValue">{health.worst ? `${health.worst.daysLate} ימים` : "—"}</div>
        <div className="schedCardLabel" title={health.worst?.name}>החריגה הגדולה: {health.worst?.name ?? "—"}</div>
      </div>
      <div className="schedCard">
        <div className="schedCardValue">{health.milestonesDelayed}</div>
        <div className="schedCardLabel">אבני דרך באיחור</div>
      </div>
      <div className={`schedCard ${age != null && age > 90 ? "schedCardAlarm" : ""}`}>
        <div className="schedCardValue">{age ?? "—"} ימים</div>
        <div className="schedCardLabel">
          גיל הלוח ({health.schedule?.relevancyDate ?? "—"})
          {age != null && age > 90 ? " — לוח מיושן, הביטחון מופחת" : ""}
        </div>
      </div>
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [asOf, setAsOf] = useState("");
  const [projectEndDate, setProjectEndDate] = useState("");
  const [projectEndDateBusy, setProjectEndDateBusy] = useState(false);
  const [projectEndDateNotice, setProjectEndDateNotice] = useState("");
  const [health, setHealth] = useState(null);
  const [sweepResult, setSweepResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activityUpdates, setActivityUpdates] = useState({ total: 0, items: [] });
  const [activityUpdateBusyId, setActivityUpdateBusyId] = useState(null);
  const [activityAgentBusyId, setActivityAgentBusyId] = useState(null);
  const [activityAgentResults, setActivityAgentResults] = useState({});
  const [activityAssignmentLabelCoverage, setActivityAssignmentLabelCoverage] = useState(null);
  const [activityAgentBatch, setActivityAgentBatch] = useState(() => createActivityAssignmentBatch());
  const [activityAgentTimeFilter, setActivityAgentTimeFilter] = useState(false);
  const [activityAgentBatchLimit, setActivityAgentBatchLimit] = useState(DEFAULT_ACTIVITY_ASSIGNMENT_BATCH_LIMIT);
  const activityAgentBatchControlRef = useRef({ token: 0, stopRequested: false, active: false });
  const [baselinedCount, setBaselinedCount] = useState(null);
  const [conditions, setConditions] = useState(null);
  const [conditionsOpen, setConditionsOpen] = useState(DEFAULT_SCHEDULE_VIEW.conditionsOpen);
  const [alertsOpen, setAlertsOpen] = useState(DEFAULT_SCHEDULE_VIEW.alertsOpen);
  const [resolverBusyId, setResolverBusyId] = useState(null);
  const [resolverResults, setResolverResults] = useState({});
  const [resolverNotice, setResolverNotice] = useState("");
  const [manualConditionDates, setManualConditionDates] = useState({});
  const [view, setView] = useState(DEFAULT_SCHEDULE_VIEW.view);
  const [onlyLate, setOnlyLate] = useState(DEFAULT_SCHEDULE_VIEW.onlyLate);
  const [minDaysLate, setMinDaysLate] = useState("");
  const [showLateLines, setShowLateLines] = useState(DEFAULT_SCHEDULE_VIEW.showLateLines);
  const [showAsOfMarker, setShowAsOfMarker] = useState(DEFAULT_SCHEDULE_VIEW.showAsOfMarker);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);

  const loadProjects = useCallback(async () => {
    const result = await api("/api/schedule/projects", { timeoutMs: 45_000 });
    setProjects(result.projects ?? []);
    return result.projects ?? [];
  }, []);

  const loadData = useCallback(async (pid, asOfValue, projectEndDateValue = "") => {
    if (!pid) return;
    activityAgentBatchControlRef.current.token += 1;
    activityAgentBatchControlRef.current.stopRequested = false;
    activityAgentBatchControlRef.current.active = false;
    setActivityAgentBatch(createActivityAssignmentBatch());
    setLoading(true);
    setError("");
    setActivityAgentResults({});
    setActivityAssignmentLabelCoverage(null);
    try {
      const calculationDate = asOfValue || projectEndDateValue || "";
      const asOfQuery = calculationDate ? `&asOf=${encodeURIComponent(calculationDate)}` : "";
      const loadPart = async (promise, fallback, label) => {
        try {
          return { value: await promise, warning: "", error: null, label };
        } catch (error) {
          return { value: fallback, warning: `${label}: ${error.message}`, error, label };
        }
      };
      const [healthLoad, sweepLoad, alertsLoad, baselinedLoad, conditionsLoad, updatesLoad, sharedReviewsLoad] = await Promise.all([
        loadPart(
          api(`/api/schedule/health?projectId=${encodeURIComponent(pid)}${asOfQuery}`, { timeoutMs: 45_000 }),
          null,
          "טעינת מדדי מצב"
        ),
        loadPart(api("/api/schedule/sweep", {
          method: "POST",
          body: { projectId: pid, asOf: calculationDate || null, persist: false, filters: { excludeCompleted: false } },
          timeoutMs: 45_000
        }), { indicators: [], warnings: [] }, "חישוב לוח הזמנים"),
        loadPart(
          api(`/api/schedule/alerts?projectId=${encodeURIComponent(pid)}&baselined=false&lifecycle=open,updated`, { timeoutMs: 45_000 }),
          { alerts: [] },
          "טעינת התראות"
        ),
        loadPart(
          api(`/api/schedule/alerts?projectId=${encodeURIComponent(pid)}&baselined=true`, { timeoutMs: 45_000 }),
          { count: 0 },
          "טעינת היסטוריית התראות"
        ),
        loadPart(
          api(`/api/schedule/conditions?projectId=${encodeURIComponent(pid)}&status=pending,resolved`, { timeoutMs: 45_000 }),
          { conditions: [] },
          "טעינת אבני דרך חוזיות"
        ),
        loadPart(
          api(`/api/schedule/activity-updates?projectId=${encodeURIComponent(pid)}`, { timeoutMs: 45_000 }),
          { total: 0, items: [] },
          "טעינת עדכונים והתראות"
        ),
        loadPart(
          api(`/api/schedule/activity-updates/assignment-agent/reviews?projectId=${encodeURIComponent(pid)}&status=pending`, { cache: "no-store" }),
          { reviews: [] },
          "טעינת החלטות צוות"
        )
      ]);
      const healthResult = healthLoad.value;
      const sweep = sweepLoad.value;
      const visibleAlerts = alertsLoad.value;
      const baselined = baselinedLoad.value;
      const pendingConditions = conditionsLoad.value;
      const updates = updatesLoad.value;
      const sharedReviews = sharedReviewsLoad.value;
      setActivityAssignmentLabelCoverage(sharedReviews.labelCoverage || null);
      const failedRequiredLoads = [healthLoad, sweepLoad].filter((part) => part.error);
      if (failedRequiredLoads.length) setError(scheduleLoadFailureMessage(failedRequiredLoads));
      setHealth(healthResult);
      setSweepResult(sweep);
      setAlerts(visibleAlerts.alerts ?? []);
      setBaselinedCount(baselined.count ?? 0);
      setConditions(pendingConditions);
      const mergedActivityUpdates = mergeScheduleActivityUpdatesWithSharedReviews(updates.items, sharedReviews.reviews);
      setActivityUpdates({ total: mergedActivityUpdates.items.length, items: mergedActivityUpdates.items });
      setActivityAgentResults(mergedActivityUpdates.agentResults);
      setWarnings([...new Set([
        ...(healthResult?.warnings ?? []),
        ...(sweep.warnings ?? []),
        healthLoad.warning,
        sweepLoad.warning,
        alertsLoad.warning,
        baselinedLoad.warning,
        conditionsLoad.warning,
        updatesLoad.warning,
        sharedReviewsLoad.warning
      ].filter(Boolean))]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProjectEndDate = useCallback(async () => {
    if (!projectId) return;
    setProjectEndDateBusy(true);
    setProjectEndDateNotice("");
    setError("");
    try {
      const result = await api("/api/schedule/project-end-date", {
        method: "POST",
        body: { projectId, projectEndDate: projectEndDate || null }
      });
      const savedDate = result.projectEndDate || "";
      setProjects((current) => current.map((project) => project.projectId === projectId
        ? { ...project, projectEndDate: savedDate || null }
        : project));
      setProjectEndDateNotice(savedDate ? `תאריך סיום הפרויקט נשמר: ${savedDate}` : "תאריך סיום הפרויקט נוקה; הפרויקט מוגדר כפעיל.");
      await loadData(projectId, asOf, savedDate);
    } catch (err) {
      setError(err.message);
    } finally {
      setProjectEndDateBusy(false);
    }
  }, [projectId, projectEndDate, asOf, loadData]);

  const assignActivityUpdate = useCallback(async (item, activityKey) => {
    if (!projectId || !item?.id) return;
    setActivityUpdateBusyId(item.id);
    setError("");
    try {
      const result = await api("/api/schedule/activity-updates/assign", {
        method: "POST",
        body: { projectId, sourceId: item.id, activityKey }
      });
      setActivityUpdates((current) => ({
        ...current,
        items: current.items.map((existing) => existing.id === item.id ? result.item : existing)
      }));
      if (result.reviewQueueWarning) setWarnings((current) => [...new Set([...current, `סנכרון החלטת צוות: ${result.reviewQueueWarning}`])]);
      setActivityAgentResults((current) => {
        if (!current[item.id]) return current;
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setActivityUpdateBusyId(null);
    }
  }, [projectId]);

  const runActivityAssignmentAgent = useCallback(async (item, { timeFilter = false, reviewOnly = false } = {}) => {
    if (!projectId || !item?.id) return { ok: false, error: "חסרים פרויקט או מזהה התראה" };
    setActivityAgentBusyId(item.id);
    setError("");
    setActivityAgentResults(current => ({ ...current, [item.id]: null }));
    try {
      const result = await api("/api/schedule/activity-updates/assignment-agent/run", {
        method: "POST",
        body: {
          projectId,
          sourceId: item.id,
          ...(timeFilter ? { timeFilter: true } : {}),
          ...(reviewOnly ? { reviewOnly: true } : {})
        },
        timeoutMs: 900_000
      });
      setActivityAgentResults(current => ({ ...current, [item.id]: result }));
      if (result.workflowLog && typeof window.__bidocSetWorkflowFromReact === "function") {
        window.__bidocSetWorkflowFromReact(result);
      }
      if (result.assignment) {
        setActivityUpdates(current => ({
          ...current,
          items: current.items.map(existing => existing.id === item.id ? result.assignment : existing)
        }));
      }
      return { ok: true, result };
    } catch (err) {
      setActivityAgentResults(current => ({ ...current, [item.id]: { error: err.message } }));
      return { ok: false, error: err.message };
    } finally {
      setActivityAgentBusyId(null);
    }
  }, [projectId]);

  const runActivityAssignmentBatch = useCallback(async ({ queue, startIndex = 0, initialStats = null, timeFilter = false }) => {
    if (activityAgentBatchControlRef.current.active) return;
    if (!queue.length || startIndex >= queue.length) {
      setActivityAgentBatch(createActivityAssignmentBatch({
        status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.COMPLETED,
        queue,
        total: queue.length,
        nextIndex: queue.length,
        processed: Number(initialStats?.processed) || 0,
        assigned: Number(initialStats?.assigned) || 0,
        review: Number(initialStats?.review) || 0,
        skipped: Number(initialStats?.skipped) || 0,
        failed: Number(initialStats?.failed) || 0
      }));
      return;
    }
    const token = activityAgentBatchControlRef.current.token + 1;
    activityAgentBatchControlRef.current = { token, stopRequested: false, active: true };
    let stats = {
      processed: Number(initialStats?.processed) || 0,
      assigned: Number(initialStats?.assigned) || 0,
      review: Number(initialStats?.review) || 0,
      skipped: Number(initialStats?.skipped) || 0,
      failed: Number(initialStats?.failed) || 0
    };
    const base = { queue, total: queue.length, timeFilter: timeFilter === true };
    setActivityAgentBatch(createActivityAssignmentBatch({
      ...base,
      ...stats,
      status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING,
      nextIndex: startIndex,
      currentId: queue[startIndex]?.id || null
    }));

    for (let index = startIndex; index < queue.length; index += 1) {
      if (activityAgentBatchControlRef.current.token !== token) return;
      if (activityAgentBatchControlRef.current.stopRequested) {
        activityAgentBatchControlRef.current.active = false;
        setActivityAgentBatch(createActivityAssignmentBatch({
          ...base, ...stats, status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.PAUSED, nextIndex: index
        }));
        return;
      }
      setActivityAgentBatch(createActivityAssignmentBatch({
        ...base,
        ...stats,
        status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING,
        nextIndex: index,
        currentId: queue[index].id
      }));
      const outcome = await runActivityAssignmentAgent(queue[index], { timeFilter, reviewOnly: true });
      if (activityAgentBatchControlRef.current.token !== token) return;
      stats = applyActivityAssignmentBatchOutcome(stats, outcome);
      const nextIndex = index + 1;
      if (activityAgentBatchControlRef.current.stopRequested) {
        activityAgentBatchControlRef.current.active = false;
        setActivityAgentBatch(createActivityAssignmentBatch({
          ...base,
          ...stats,
          status: nextIndex < queue.length ? ACTIVITY_ASSIGNMENT_BATCH_STATUSES.PAUSED : ACTIVITY_ASSIGNMENT_BATCH_STATUSES.COMPLETED,
          nextIndex
        }));
        return;
      }
      if (nextIndex >= queue.length) activityAgentBatchControlRef.current.active = false;
      setActivityAgentBatch(createActivityAssignmentBatch({
        ...base,
        ...stats,
        status: nextIndex >= queue.length ? ACTIVITY_ASSIGNMENT_BATCH_STATUSES.COMPLETED : ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING,
        nextIndex,
        currentId: nextIndex < queue.length ? queue[nextIndex].id : null
      }));
    }
  }, [runActivityAssignmentAgent]);

  const clearActivityAgentBatchResults = useCallback((queue) => {
    const ids = new Set(queue.map((item) => String(item.id)));
    setActivityAgentResults(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => !ids.has(String(id)))
    ));
  }, []);

  const startActivityAssignmentBatch = useCallback((scopedItems = activityUpdates.items, requestedLimit = activityAgentBatchLimit) => {
    const eligibleQueue = buildActivityAssignmentBatchQueue(scopedItems);
    const queue = buildActivityAssignmentBatchQueue(scopedItems, { limit: normalizeActivityAssignmentBatchLimit(requestedLimit) });
    if (!queue.length) return;
    const confirmationText = activityAssignmentBatchConfirmationText({
      batchSize: queue.length,
      eligibleCount: eligibleQueue.length
    });
    if (typeof window !== "undefined" && !window.confirm(confirmationText)) return;
    clearActivityAgentBatchResults(queue);
    void runActivityAssignmentBatch({ queue, timeFilter: activityAgentTimeFilter });
  }, [activityUpdates.items, activityAgentBatchLimit, activityAgentTimeFilter, clearActivityAgentBatchResults, runActivityAssignmentBatch]);

  const stopActivityAssignmentBatch = useCallback(() => {
    if (activityAgentBatch.status !== ACTIVITY_ASSIGNMENT_BATCH_STATUSES.RUNNING) return;
    activityAgentBatchControlRef.current.stopRequested = true;
    setActivityAgentBatch(current => ({ ...current, status: ACTIVITY_ASSIGNMENT_BATCH_STATUSES.STOPPING }));
  }, [activityAgentBatch.status]);

  const resumeActivityAssignmentBatch = useCallback(() => {
    if (activityAgentBatch.status !== ACTIVITY_ASSIGNMENT_BATCH_STATUSES.PAUSED) return;
    void runActivityAssignmentBatch({
      queue: activityAgentBatch.queue,
      startIndex: activityAgentBatch.nextIndex,
      initialStats: activityAgentBatch,
      timeFilter: activityAgentBatch.timeFilter
    });
  }, [activityAgentBatch, runActivityAssignmentBatch]);

  const restartActivityAssignmentBatch = useCallback((scopedItems = activityUpdates.items, requestedLimit = activityAgentBatchLimit) => {
    startActivityAssignmentBatch(scopedItems, requestedLimit);
  }, [activityUpdates.items, activityAgentBatchLimit, startActivityAssignmentBatch]);

  const confirmActivityAssignmentAgent = useCallback(async (item, run, candidate) => {
    if (!projectId || !run?.runId || !candidate?.activityKey) return;
    setActivityAgentBusyId(item.id);
    setError("");
    try {
      const labelOnly = Boolean(run.persistedReview && run.detachedFromCurrentFeed);
      const result = await api(labelOnly
        ? "/api/schedule/activity-updates/assignment-agent/review-label"
        : "/api/schedule/activity-updates/assignment-agent/confirm", {
        method: "POST",
        body: {
          projectId,
          runId: run.runId,
          sourceId: item.id,
          activityKey: candidate.activityKey,
          labelType: "confirmed_match",
          reason: "הבודק אישר את הפעילות המוצעת כתווית כיול."
        }
      });
      if (!labelOnly) {
        setActivityUpdates(current => ({
          ...current,
          items: current.items.map(existing => existing.id === item.id ? result.item : existing)
        }));
      }
      if (result.reviewQueueWarning) setWarnings((current) => [...new Set([...current, `סנכרון החלטת צוות: ${result.reviewQueueWarning}`])]);
      setActivityAgentResults(current => ({
        ...current,
        [item.id]: {
          ...run,
          auditPersisted: false,
          decision: {
            ...run.decision,
            autoAssigned: false,
            selectedActivityName: candidate.name,
            rankingScore: candidate.finalScore,
            calibratedProbability: null,
            calibration: { status: "not_applicable", probability: null, artifactId: null, reason: "manual_review" },
            confidence: candidate.finalScore,
            reason: "הצעת הסוכן אושרה ונשמרה."
          },
          approved: true
        }
      }));
    } catch (err) {
      setActivityAgentResults(current => ({ ...current, [item.id]: { ...run, error: err.message } }));
    } finally {
      setActivityAgentBusyId(null);
    }
  }, [projectId]);

  const rejectActivityAssignmentAgent = useCallback(async (item, run, labelOption = SCHEDULE_ASSIGNMENT_REVIEW_LABEL_OPTIONS[0]) => {
    if (!projectId || !run?.runId) return;
    setActivityAgentBusyId(item.id);
    setError("");
    try {
      const result = await api(run.auditPersisted && !run.detachedFromCurrentFeed
        ? "/api/schedule/activity-updates/assignment-agent/reject"
        : "/api/schedule/activity-updates/assignment-agent/review-label", {
        method: "POST",
        body: {
          projectId,
          runId: run.runId,
          sourceId: item.id,
          labelType: labelOption.type,
          reason: labelOption.reasonHe
        }
      });
      if (result.reviewQueueWarning) setWarnings((current) => [...new Set([...current, `סנכרון החלטת צוות: ${result.reviewQueueWarning}`])]);
      setActivityAgentResults(current => ({
        ...current,
        [item.id]: {
          ...run,
          auditPersisted: false,
          decision: { ...run.decision, reason: labelOption.reasonHe },
          evaluationLabelType: labelOption.type,
          rejected: true
        }
      }));
    } catch (err) {
      setActivityAgentResults(current => ({ ...current, [item.id]: { ...run, error: err.message } }));
    } finally {
      setActivityAgentBusyId(null);
    }
  }, [projectId]);

  const runScan = useCallback(async () => {
    if (!projectId) return;
    setScanBusy(true);
    setError("");
    try {
      const calculationDate = asOf || projectEndDate || null;
      await api("/api/schedule/alert-scan", { method: "POST", body: { projectId, asOf: calculationDate }, timeoutMs: 240_000 });
      await loadData(projectId, asOf, projectEndDate);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanBusy(false);
    }
  }, [projectId, asOf, projectEndDate, loadData]);

  const resolveCondition = useCallback(async (condition, manualTriggerDate = null) => {
    if (!projectId || !condition?.id) return;
    setResolverBusyId(condition.id);
    setError("");
    setResolverNotice("");
    try {
      const result = await api("/api/schedule/conditions/resolve", {
        method: "POST",
        body: {
          projectId,
          conditionId: condition.id,
          commit: true,
          minConfidence: 0.8,
          ...(manualTriggerDate ? { manualTriggerDate } : {})
        },
        timeoutMs: 900_000
      });
      const rowResult = result.results?.[0] ?? { status: "error", reason: "הסוכן לא החזיר תוצאה" };
      setResolverResults((current) => ({ ...current, [condition.id]: rowResult }));
      if (rowResult.status === "resolved") {
        setResolverNotice(`הושלם: ${condition.name} — האירוע ${rowResult.evidence?.triggerDate || manualTriggerDate || "אותר"}, והמועד החוזי ${rowResult.dueDate} נשמר.`);
        await loadData(projectId, asOf, projectEndDate);
      } else if (rowResult.triggerSaved) {
        const provisional = rowResult.provisionalDueDate ? ` מועד משוער ${rowResult.provisionalDueDate} סומן בדגלון כתום על הציר.` : "";
        setResolverNotice(`תאריך האירוע ${rowResult.evidence?.triggerDate || manualTriggerDate} נשמר.${provisional} המועד החוזי הסופי ממתין להשלמת לוח ימי העבודה והחגים.`);
        await loadData(projectId, asOf, projectEndDate);
      }
    } catch (err) {
      setResolverResults((current) => ({ ...current, [condition.id]: { status: "error", reason: err.message } }));
      setError(err.message);
    } finally {
      setResolverBusyId(null);
    }
  }, [projectId, asOf, projectEndDate, loadData]);

  useEffect(() => {
    let cancelled = false;
    loadProjects().then((list) => {
      if (cancelled || !list.length) return;
      setProjectId((current) => current || list[0].projectId);
      setProjectEndDate((current) => current || list[0].projectEndDate || "");
    }).catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, [loadProjects]);

  useEffect(() => () => {
    activityAgentBatchControlRef.current.token += 1;
    activityAgentBatchControlRef.current.stopRequested = true;
    activityAgentBatchControlRef.current.active = false;
  }, []);

  useEffect(() => {
    if (!projectId) return;
    if (location.hash === "#schedule") loadData(projectId, asOf, projectEndDate);
    const onActivate = () => loadData(projectId, asOf, projectEndDate);
    window.addEventListener("bidoc:schedule-activated", onActivate);
    return () => window.removeEventListener("bidoc:schedule-activated", onActivate);
  }, [projectId, asOf, projectEndDate, loadData]);

  const rows = useMemo(() => {
    const indicators = sweepResult?.indicators ?? [];
    const filtered = indicators.filter((ind) => {
      if (onlyLate && ind.lateness?.isLate !== true) return false;
      if (minDaysLate && !(ind.lateness?.daysLate >= Number(minDaysLate))) return false;
      return true;
    });
    // Contract milestones pin to the top: the contract axis is the highest
    // authority and must never fall off the row cap. Stable sort keeps the
    // engine's most-late-first order within each group.
    return [...filtered].sort((a, b) =>
      Number(b.subject.kind === "milestone") - Number(a.subject.kind === "milestone"));
  }, [sweepResult, onlyLate, minDaysLate]);

  const meta = sweepResult?.scheduleMeta;
  const activityOptions = useMemo(() => {
    const shortDate = (value) => {
      const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
      return match ? `${match[3]}.${match[2]}.${match[1].slice(2)}` : "ללא תאריך";
    };
    const byKey = new Map();
    for (const indicator of sweepResult?.indicators ?? []) {
      const key = indicator.subject?.activityKey;
      if (key && !byKey.has(key)) {
        const start = indicator.timing?.plannedStart;
        const finish = indicator.timing?.plannedFinish;
        byKey.set(key, {
          key,
          name: indicator.subject?.name || key,
          start: start || "",
          dateLabel: start || finish ? `${shortDate(start)}–${shortDate(finish)}` : "ללא תאריכי תכנון"
        });
      }
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "he") || a.start.localeCompare(b.start));
  }, [sweepResult]);
  // Project-level gates: the best state any indicator reached per gate —
  // one linked contract milestone means the contract axis EXISTS for the
  // project, even if most activities are not linked to it.
  const projectGates = useMemo(() => {
    const indicators = sweepResult?.indicators ?? [];
    if (!indicators.length) return null;
    const rank = { ok: 2, stale: 1, missing: 0 };
    const gates = {};
    for (const key of Object.keys(GATE_LABELS)) {
      if (key === "scheduleVersions") {
        gates[key] = Math.max(...indicators.map((ind) => Number(ind.gates?.scheduleVersions) || 0));
      } else {
        gates[key] = indicators.reduce(
          (best, ind) => ((rank[ind.gates?.[key]] ?? 0) > (rank[best] ?? 0) ? ind.gates[key] : best),
          "missing");
      }
    }
    return gates;
  }, [sweepResult]);

  return (
    <div className="schedulePage" dir="rtl">
      <div className="schedToolbar">
        <div>
          <h2 className="schedTitle">לוח זמנים — שלושת הצירים</h2>
          {meta ? (
            <div className="schedSubtitle">
              נכון ל-<b>{sweepResult.asOf}</b> · מקור: <b>{meta.displayName ?? meta.sourceVersionId}</b> (Data Date: {meta.relevancyDate ?? "?"})
              · {meta.versionCount} {meta.versionCount === 1 ? "גרסה" : "גרסאות"}
            </div>
          ) : null}
        </div>
        <div className="schedControls">
          <select value={projectId} aria-label="בחירת פרויקט" onChange={(e) => {
            const nextId = e.target.value;
            setProjectId(nextId);
            setProjectEndDate(projects.find((project) => project.projectId === nextId)?.projectEndDate || "");
            setProjectEndDateNotice("");
          }} className="schedSelect">
            {!projects.length && <option value="">אין לוחות זמנים</option>}
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name || `${p.projectId.slice(0, 8)}…`} ({p.files} קבצים, עדכני ל-{p.latestRelevancyDate ?? "?"})
              </option>
            ))}
          </select>
          <label className="schedDateField" htmlFor="schedule-as-of">נכון ל־
            <input id="schedule-as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="schedDate" title="ריק = תאריך סיום הפרויקט, או היום בפרויקט פעיל" />
          </label>
          <button type="button" className="schedBtn" onClick={() => loadData(projectId, asOf, projectEndDate)} disabled={loading || !projectId}>
            {loading ? "טוען…" : "רענן"}
          </button>
          <button type="button" className="schedBtn schedBtnPrimary" onClick={runScan} disabled={scanBusy || !projectId}
            title="סריקה מלאה: חישוב אינדיקטורים, שמירת Snapshots ועדכון התראות">
            {scanBusy ? "סורק…" : "סריקת התראות"}
          </button>
        </div>
      </div>

      <div className="schedProjectEndControl">
        <label htmlFor="schedule-project-end">תאריך סיום הפרויקט</label>
        <input id="schedule-project-end" type="date" value={projectEndDate}
          onChange={(event) => { setProjectEndDate(event.target.value); setProjectEndDateNotice(""); }}
          disabled={!projectId || projectEndDateBusy} />
        <button type="button" className="schedBtn" onClick={saveProjectEndDate} disabled={!projectId || projectEndDateBusy}>
          {projectEndDateBusy ? "שומר…" : "שמור תאריך סיום"}
        </button>
        <span>ריק = פרויקט פעיל. התאריך השמור עוצר את חישוב האיחור בפרויקטים שהסתיימו.</span>
        {projectEndDateNotice ? <strong role="status">{projectEndDateNotice}</strong> : null}
      </div>

      {/* What the engine could and could not compare — project level, always visible */}
      {projectGates ? <GatesBlock gates={projectGates} compact /> : null}

      {error ? (
        <div className="schedError" role="alert">
          <span>{error}</span>
          <button type="button" className="schedBtn" onClick={() => loadData(projectId, asOf, projectEndDate)} disabled={loading || !projectId}>
            {loading ? "מנסה שוב…" : "נסה שוב"}
          </button>
        </div>
      ) : null}
      {warnings.length ? (
        <div className="schedWarnings">{warnings.map((w) => <div key={w}>⚠ {w}</div>)}</div>
      ) : null}

      <HealthStrip health={health} />

      {alerts.length ? (
        <ScheduleAlertsBox alerts={alerts} expanded={alertsOpen} onToggle={() => setAlertsOpen((current) => !current)} />
      ) : null}
      {baselinedCount ? (
        <div className="schedBaselinedNote">
          {baselinedCount} חריגות סומנו baselined באתחול ההיסטורי — גלויות בצירים למטה, ולא ייצרו התראה עד החמרה מהותית.
        </div>
      ) : null}

      {resolverNotice ? <div className="condResolverResult" role="status">{resolverNotice}</div> : null}
      <PendingConditionsBox
        data={conditions}
        expanded={conditionsOpen}
        onToggle={() => setConditionsOpen((v) => !v)}
        resolvingId={resolverBusyId}
        onResolve={resolveCondition}
        onManualResolve={resolveCondition}
        manualDates={manualConditionDates}
        onManualDateChange={(conditionId, value) => setManualConditionDates((current) => ({ ...current, [conditionId]: value }))}
        rowResults={resolverResults}
      />

      <div className="schedFilters">
        <div className="schedViewToggle">
          <button type="button" className={view === "axes" ? "is-active" : ""} onClick={() => setView("axes")}>צירים</button>
          <button type="button" className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}>טבלה</button>
        </div>
        <label><input type="checkbox" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} /> רק באיחור</label>
        <button type="button" className={`schedLateLinesToggle ${showLateLines ? "is-active" : ""}`}
          aria-pressed={showLateLines} disabled={!showAsOfMarker} onClick={() => setShowLateLines((current) => !current)}>
          {showLateLines ? "הסתר קווי איחור אדומים" : "הצג קווי איחור אדומים"}
        </button>
        <button type="button" className={`schedAsOfToggle ${showAsOfMarker ? "is-active" : ""}`}
          aria-pressed={showAsOfMarker} onClick={() => setShowAsOfMarker((current) => !current)}
          title="בהסתרה, הציר מצטמצם מהפעילות הראשונה עד הסמן האחרון בלוח הזמנים">
          {showAsOfMarker ? "הסתר נכון ל־ וצמצם ציר" : "הצג נכון ל־"}
        </button>
        <label>מינימום ימי איחור: <input type="number" min="1" value={minDaysLate} onChange={(e) => setMinDaysLate(e.target.value)} className="schedNum" /></label>
        <span className="schedCount">{rows.length} פעילויות</span>
      </div>

      {view === "axes" ? (
        <ThreeAxesView indicators={rows} allIndicators={sweepResult?.indicators} pendingConditions={conditions?.conditions}
          timelineItems={activityUpdates.items} asOf={sweepResult?.asOf} showLateLines={showLateLines}
          showAsOfMarker={showAsOfMarker} selected={selected} onSelect={setSelected} />
      ) : (
        <div className="schedTableWrap">
          <table className="schedTable">
            <thead>
              <tr>
                <th>פעילות</th><th>סטטוס</th><th>איחור / נותר</th><th>בסיס</th><th>% ביצוע</th><th>ביטחון</th><th>חומרה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ind) => (
                <tr key={scheduleSubjectKey(ind)} onClick={() => setSelected(ind)}
                  className={scheduleSubjectKey(selected) === scheduleSubjectKey(ind) ? "is-selected" : ""}>
                  <td className="schedName">{ind.subject.name}{ind.subject.isMilestone ? " ◆" : ""}</td>
                  <td><StatusBadge status={ind.status} /></td>
                  <td>{latenessText(ind.lateness)}</td>
                  <td className="schedBasis">{basisText(ind.lateness)}</td>
                  <td>{ind.timing?.percentComplete ?? "—"}</td>
                  <td><ConfidenceBadge confidence={ind.confidence} /></td>
                  <td>{ind.severity ?? "—"}</td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr><td colSpan={7} className="schedEmpty">אין פעילויות תואמות לפילטר</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <IndicatorDetail indicator={selected} onClose={() => setSelected(null)} />
      <ActivityUpdatesTable items={activityUpdates.items} activities={activityOptions}
        busyId={activityUpdateBusyId} onAssign={assignActivityUpdate}
        agentBusyId={activityAgentBusyId} agentResults={activityAgentResults}
        onRunAgent={runActivityAssignmentAgent} onConfirmAgent={confirmActivityAssignmentAgent}
        onRejectAgent={rejectActivityAssignmentAgent} agentBatch={activityAgentBatch}
        onStartAgentBatch={startActivityAssignmentBatch} onStopAgentBatch={stopActivityAssignmentBatch}
        onResumeAgentBatch={resumeActivityAssignmentBatch} onRestartAgentBatch={restartActivityAssignmentBatch}
        timeFilterEnabled={activityAgentTimeFilter} onTimeFilterChange={setActivityAgentTimeFilter}
        batchLimit={activityAgentBatchLimit} onBatchLimitChange={setActivityAgentBatchLimit}
        labelCoverage={activityAssignmentLabelCoverage} />
    </div>
  );
}
