import React, { useCallback, useEffect, useMemo, useState } from "react";

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

async function api(path, { method = "GET", body = null, timeoutMs = 120_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
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

// Presentation-only date scaling (see header note — Rule 001 stays server-side).
function makeScale(indicators, asOf) {
  let min = Infinity;
  let max = -Infinity;
  const consider = (value) => {
    if (!value) return;
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isNaN(ms)) {
      if (ms < min) min = ms;
      if (ms > max) max = ms;
    }
  };
  consider(asOf);
  for (const ind of indicators) {
    const t = ind.timing ?? {};
    // forecastFinish is deliberately NOT part of the domain: a 5%-progress
    // task forecasts years out and would squash every other bar into pixels.
    // Out-of-range forecasts clamp to the edge (pos() clamps) with a tooltip.
    consider(t.plannedStart); consider(t.plannedFinish); consider(t.contractFinish);
    consider(t.observedStart); consider(t.observedFinish);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
  const pad = (max - min) * 0.03;
  min -= pad; max += pad;
  const pos = (value) => {
    const ms = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(ms)) return null;
    return Math.min(100, Math.max(0, ((ms - min) / (max - min)) * 100));
  };
  const months = [];
  const cursor = new Date(min);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= max) {
    const iso = cursor.toISOString().slice(0, 10);
    const left = pos(iso);
    if (left != null) months.push({ iso, left, label: `${MONTHS_HE[cursor.getUTCMonth()]} ${String(cursor.getUTCFullYear()).slice(2)}` });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return { pos, months };
}

const AxisLegend = () => (
  <div className="axisLegend">
    <span><i className="axisSwatch swPlan" /> תכנון הקבלן</span>
    <span><i className="axisSwatch swFill" /> % ביצוע מדווח</span>
    <span><i className="axisSwatch swLate" /> חריגה עד "נכון ל-"</span>
    <span><i className="axisSwatch swForecast" >◆</i> תחזית סיום</span>
    <span><i className="axisSwatch swContract">⚑</i> אבן דרך חוזית</span>
    <span><i className="axisSwatch swObserved" /> ביצוע נצפה (BIDoc)</span>
    <span><i className="axisSwatch swToday" /> קו "נכון ל-"</span>
  </div>
);

function AxisRow({ indicator, scale, asOf, selected, onSelect }) {
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
          {isLate && basisPos != null && asOfPos != null && asOfPos > basisPos && (
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
        <span className="axisNameText" title={indicator.subject.name}>
          {indicator.subject.isMilestone ? "◆ " : ""}{indicator.subject.name}
        </span>
        <span className="axisNameMeta">
          <StatusBadge status={indicator.status} />
          <span className="axisLateText">{latenessText(l)}</span>
        </span>
      </div>
    </div>
  );
}

function ThreeAxesView({ indicators, allIndicators, asOf, selected, onSelect }) {
  const scale = useMemo(() => makeScale(indicators, asOf), [indicators, asOf]);
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
    return [...byDate.values()];
  }, [indicators, allIndicators]);
  if (!scale) return <div className="schedEmpty">אין תאריכים להצגה</div>;
  const shown = indicators.slice(0, AXES_ROW_CAP);
  const asOfPos = scale.pos(asOf);
  return (
    <div className="axesView">
      <AxisLegend />
      <div className="axesBody">
        <div className="axesTimeArea" dir="ltr">
          <div className="axesMonths">
            {scale.months.map((m) => (
              <span key={m.iso} className="axesMonthTick" style={{ left: `${m.left}%` }}>{m.label}</span>
            ))}
          </div>
          <div className="axesRowsOverlay">
            {scale.months.map((m) => (
              <span key={m.iso} className="axesGridLine" style={{ left: `${m.left}%` }} />
            ))}
            {contractMarkers.map((marker) => {
              const left = scale.pos(marker.date);
              if (left == null) return null;
              return (
                <span key={marker.date} className="axesContractLine" style={{ left: `${left}%` }}>
                  <label>⚑ {marker.name} · {marker.date}</label>
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
          {shown.map((ind) => (
            <AxisRow key={ind.subject.activityKey} indicator={ind} scale={scale} asOf={asOf}
              selected={selected?.subject.activityKey === ind.subject.activityKey} onSelect={onSelect} />
          ))}
        </div>
      </div>
      {indicators.length > AXES_ROW_CAP ? (
        <div className="axesCapNote">מוצגות {AXES_ROW_CAP} הפעילויות החמורות מתוך {indicators.length} — צמצם עם הפילטרים למעלה</div>
      ) : null}
    </div>
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

const PendingConditionsBox = ({ data, expanded, onToggle, resolvingId, onResolve, rowResults }) => {
  const conditions = data?.conditions ?? [];
  if (!conditions.length) return null;
  const grouped = Object.entries(
    conditions.reduce((acc, c) => {
      (acc[c.category] ||= []).push(c);
      return acc;
    }, {})
  );
  return (
    <div className="condBox">
      <button type="button" className="condHead" onClick={onToggle}>
        <span className="condHeadTitle">
          ⏳ אבני דרך הממתינות לטריגר
          <span className="condHeadCount">{conditions.length}</span>
        </span>
        <span className="condHeadHint">
          התחייבויות יחסיות מהחוזה — יקבלו תאריך ויעלו על ציר הזמן ברגע שהאירוע המפעיל ייקלט
        </span>
        <span className="condChevron">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded ? (
        <div className="condBody">
          <div className="condResolverBar">
            <div>
              <strong>סוכן איתור תאריכים</strong>
              <span>כל כפתור מפעיל חיפוש נפרד שמוגבל להתניה, לאירוע ולתאריך של אותה שורה בלבד.</span>
            </div>
          </div>
          {grouped.map(([category, items]) => (
            <div key={category} className="condGroup">
              <div className="condGroupTitle">
                {CATEGORY_LABELS[category] ?? category}
                <span className="condGroupCount">{items.length}</span>
              </div>
              <div className="condTableWrap">
                <table className="condTable">
                  <thead>
                    <tr><th>אבן הדרך</th><th>הכלל החוזי</th><th>סוג הטריגר</th><th>מקור</th><th>פעולה</th></tr>
                  </thead>
                  <tbody>
                    {items.map((c) => {
                      const result = rowResults?.[c.id];
                      const isBusy = resolvingId === c.id;
                      return (
                        <tr key={c.id} title={c.source_excerpt}>
                          <td className="condName">{c.name}</td>
                          <td className="condRule"><b>{offsetText(c)}</b> מ־{c.anchor_description}</td>
                          <td><span className={`condAnchor is-${c.anchor_kind}`}>{ANCHOR_KIND_LABELS[c.anchor_kind] ?? c.anchor_kind}</span></td>
                          <td className="condPage">{c.source_page ? `עמ׳ ${c.source_page}` : "—"}</td>
                          <td className="condActionCell">
                            <button type="button" className="condResolveBtn" onClick={() => onResolve(c)} disabled={Boolean(resolvingId)}>
                              {isBusy ? "סוכן AI מחפש…" : "חפש והשלם עם AI"}
                            </button>
                            {result ? (
                              <span className={`condRowResult is-${result.status}`} title={result.reason || result.evidence?.reason || ""}>
                                {result.status === "not_found" ? "לא נמצא תאריך" : result.status === "needs_review" ? "נדרשת בדיקה" : result.status === "error" ? result.reason || "החיפוש נכשל" : result.dueDate || "הושלם"}
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
  const [health, setHealth] = useState(null);
  const [sweepResult, setSweepResult] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [baselinedCount, setBaselinedCount] = useState(null);
  const [conditions, setConditions] = useState(null);
  const [conditionsOpen, setConditionsOpen] = useState(true);
  const [resolverBusyId, setResolverBusyId] = useState(null);
  const [resolverResults, setResolverResults] = useState({});
  const [resolverNotice, setResolverNotice] = useState("");
  const [view, setView] = useState("axes");
  const [onlyLate, setOnlyLate] = useState(true);
  const [minDaysLate, setMinDaysLate] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);

  const loadProjects = useCallback(async () => {
    const result = await api("/api/schedule/projects");
    setProjects(result.projects ?? []);
    return result.projects ?? [];
  }, []);

  const loadData = useCallback(async (pid, asOfValue) => {
    if (!pid) return;
    setLoading(true);
    setError("");
    try {
      const asOfQuery = asOfValue ? `&asOf=${encodeURIComponent(asOfValue)}` : "";
      const optional = (promise, fallback, label) => promise.catch(err => ({
        ...fallback,
        warning: `${label}: ${err.message}`
      }));
      const [healthResult, sweep, visibleAlerts, baselined, pendingConditions] = await Promise.all([
        api(`/api/schedule/health?projectId=${encodeURIComponent(pid)}${asOfQuery}`),
        api("/api/schedule/sweep", {
          method: "POST",
          body: { projectId: pid, asOf: asOfValue || null, persist: false, filters: { excludeCompleted: false } }
        }),
        optional(
          api(`/api/schedule/alerts?projectId=${encodeURIComponent(pid)}&baselined=false&lifecycle=open,updated`),
          { alerts: [] },
          "טעינת התראות"
        ),
        optional(
          api(`/api/schedule/alerts?projectId=${encodeURIComponent(pid)}&baselined=true`),
          { count: 0 },
          "טעינת היסטוריית התראות"
        ),
        optional(
          api(`/api/schedule/conditions?projectId=${encodeURIComponent(pid)}&status=pending`),
          { conditions: [] },
          "טעינת אבני דרך חוזיות"
        )
      ]);
      setHealth(healthResult);
      setSweepResult(sweep);
      setAlerts(visibleAlerts.alerts ?? []);
      setBaselinedCount(baselined.count ?? 0);
      setConditions(pendingConditions);
      setWarnings([...new Set([
        ...(healthResult.warnings ?? []),
        ...(sweep.warnings ?? []),
        visibleAlerts.warning,
        baselined.warning,
        pendingConditions.warning
      ].filter(Boolean))]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runScan = useCallback(async () => {
    if (!projectId) return;
    setScanBusy(true);
    setError("");
    try {
      await api("/api/schedule/alert-scan", { method: "POST", body: { projectId, asOf: asOf || null }, timeoutMs: 240_000 });
      await loadData(projectId, asOf);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanBusy(false);
    }
  }, [projectId, asOf, loadData]);

  const resolveCondition = useCallback(async (condition) => {
    if (!projectId || !condition?.id) return;
    setResolverBusyId(condition.id);
    setError("");
    setResolverNotice("");
    try {
      const result = await api("/api/schedule/conditions/resolve", {
        method: "POST",
        body: { projectId, conditionId: condition.id, commit: true, minConfidence: 0.8 },
        timeoutMs: 900_000
      });
      const rowResult = result.results?.[0] ?? { status: "error", reason: "הסוכן לא החזיר תוצאה" };
      setResolverResults((current) => ({ ...current, [condition.id]: rowResult }));
      if (rowResult.status === "resolved") {
        setResolverNotice(`הושלם: ${condition.name} — המועד החוזי ${rowResult.dueDate} נשמר בבסיס הנתונים.`);
        await loadData(projectId, asOf);
      }
    } catch (err) {
      setResolverResults((current) => ({ ...current, [condition.id]: { status: "error", reason: err.message } }));
      setError(err.message);
    } finally {
      setResolverBusyId(null);
    }
  }, [projectId, asOf, loadData]);

  useEffect(() => {
    let cancelled = false;
    loadProjects().then((list) => {
      if (cancelled || !list.length) return;
      setProjectId((current) => current || list[0].projectId);
    }).catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, [loadProjects]);

  useEffect(() => {
    if (!projectId) return;
    if (location.hash === "#schedule") loadData(projectId, asOf);
    const onActivate = () => loadData(projectId, asOf);
    window.addEventListener("bidoc:schedule-activated", onActivate);
    return () => window.removeEventListener("bidoc:schedule-activated", onActivate);
  }, [projectId, asOf, loadData]);

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
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="schedSelect">
            {!projects.length && <option value="">אין לוחות זמנים</option>}
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectId.slice(0, 8)}… ({p.files} קבצים, עדכני ל-{p.latestRelevancyDate ?? "?"})
              </option>
            ))}
          </select>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="schedDate" title="נכון לתאריך (ריק = היום)" />
          <button type="button" className="schedBtn" onClick={() => loadData(projectId, asOf)} disabled={loading || !projectId}>
            {loading ? "טוען…" : "רענן"}
          </button>
          <button type="button" className="schedBtn schedBtnPrimary" onClick={runScan} disabled={scanBusy || !projectId}
            title="סריקה מלאה: חישוב אינדיקטורים, שמירת Snapshots ועדכון התראות">
            {scanBusy ? "סורק…" : "סריקת התראות"}
          </button>
        </div>
      </div>

      {/* What the engine could and could not compare — project level, always visible */}
      {projectGates ? <GatesBlock gates={projectGates} compact /> : null}

      {error ? <div className="schedError">{error}</div> : null}
      {warnings.length ? (
        <div className="schedWarnings">{warnings.map((w) => <div key={w}>⚠ {w}</div>)}</div>
      ) : null}

      <HealthStrip health={health} />

      {alerts.length ? (
        <div className="schedAlerts">
          {alerts.map((alert) => (
            <div key={alert.id} className="schedAlertRow">
              <span className="schedBadge schedSeverity">חומרה {alert.severity_level}</span>
              <b>{alert.title}</b>
              <span className="schedAlertDesc">{alert.description}</span>
            </div>
          ))}
        </div>
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
        rowResults={resolverResults}
      />

      <div className="schedFilters">
        <div className="schedViewToggle">
          <button type="button" className={view === "axes" ? "is-active" : ""} onClick={() => setView("axes")}>צירים</button>
          <button type="button" className={view === "table" ? "is-active" : ""} onClick={() => setView("table")}>טבלה</button>
        </div>
        <label><input type="checkbox" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)} /> רק באיחור</label>
        <label>מינימום ימי איחור: <input type="number" min="1" value={minDaysLate} onChange={(e) => setMinDaysLate(e.target.value)} className="schedNum" /></label>
        <span className="schedCount">{rows.length} פעילויות</span>
      </div>

      {view === "axes" ? (
        <ThreeAxesView indicators={rows} allIndicators={sweepResult?.indicators} asOf={sweepResult?.asOf} selected={selected} onSelect={setSelected} />
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
                <tr key={ind.subject.activityKey} onClick={() => setSelected(ind)}
                  className={selected?.subject.activityKey === ind.subject.activityKey ? "is-selected" : ""}>
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
    </div>
  );
}
