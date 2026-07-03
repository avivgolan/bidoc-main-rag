import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_FROM = "2024-02-01";
const DEFAULT_TO = "2026-01-01";
const DEFAULT_LIMIT = 350;

const Icon = ({ path, size = 16, strokeWidth = 2, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {Array.isArray(path) ? path.map((d, index) => <path key={index} d={d} />) : <path d={path} />}
  </svg>
);

const icons = {
  spark: ["M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"],
  refresh: ["M23 4v6h-6", "M1 20v-6h6", "M3.5 9a9 9 0 0 1 14.8-3.5L23 10", "M1 14l4.7 4.5A9 9 0 0 0 20.5 15"],
  play: "M5 3l14 9-14 9V3z",
  plus: "M12 5v14M5 12h14",
  history: ["M12 8v5l3 2", "M3 12a9 9 0 1 0 3-6.7", "M3 3v6h6"],
  chart: ["M3 3v18h18", "M8 17V9", "M13 17V6", "M18 17v-4"],
  check: "M20 6L9 17l-5-5",
  alert: "M10.3 3.3L1.5 18A2 2 0 0 0 3.2 21h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  workflow: ["M18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M13 6h3a2 2 0 0 1 2 2v4", "M6 9v7a2 2 0 0 0 2 2h7"],
  chevron: "M9 18l6-6-6-6",
};

async function apiFetch(url, opts = {}) {
  const { timeoutMs = 30000, ...fetchOptions } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(fetchOptions.headers || {}) },
      ...fetchOptions,
      body: fetchOptions.body && typeof fetchOptions.body !== "string"
        ? JSON.stringify(fetchOptions.body)
        : fetchOptions.body,
      signal: controller.signal,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function uniq(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function normalizeFindings(result = {}, legacyInsightsAsFindings = false) {
  const direct = Array.isArray(result.findings) ? result.findings : Array.isArray(result.metadata?.findings) ? result.metadata.findings : [];
  if (direct.length) return direct;
  if (!legacyInsightsAsFindings) return [];
  return (Array.isArray(result.insights) ? result.insights : []).map((item, index) => ({
    id: item.id || `legacy_${index + 1}`,
    title: item.title || "ממצא",
    category: item.category,
    severity: item.severity,
    confidence: item.confidence,
    finding: item.finding || item.insight || item.summary || "",
    why_it_matters: item.why_it_matters,
    recommended_action: item.recommended_action,
    evidence: item.evidence || item.sources || [],
  }));
}

function normalizeInsights(result = {}) {
  const cards = Array.isArray(result.insights) ? result.insights : [];
  if (!cards.length) return [];
  if (Array.isArray(result.findings) || Array.isArray(result.metadata?.findings)) return cards;
  return cards.filter((item) => Array.isArray(item?.supporting_finding_ids) && item.supporting_finding_ids.length);
}

function mergeInsights(previous, next) {
  if (!previous || previous.ok === false) return next;
  const previousFindings = normalizeFindings(previous, true);
  const nextFindings = normalizeFindings(next);
  const previousInsights = normalizeInsights(previous);
  const nextInsights = normalizeInsights(next);
  return {
    ...next,
    summary: {
      ...(next.summary || {}),
      totalRecords: Number(previous.summary?.totalRecords || 0) + Number(next.summary?.totalRecords || 0),
      expandedRuns: Number(previous.summary?.expandedRuns || 1) + 1,
    },
    findings: dedupeCards([...previousFindings, ...nextFindings]),
    insights: dedupeCards([...previousInsights, ...nextInsights]),
    workflowLog: next.workflowLog || previous.workflowLog,
  };
}

function dedupeCards(cards = []) {
  const seen = new Set();
  const result = [];
  for (const card of cards) {
    const key = String(card.id || card.title || card.finding || card.insight || JSON.stringify(card)).slice(0, 180);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }
  return result;
}

function normalizeRun(run = {}) {
  const metadata = run.metadata || {};
  const envelope = { ...run, metadata };
  return {
    ok: run.status !== "error",
    error: run.error || "",
    runId: run.run_id || run.runId || "",
    summary: {
      ...(metadata.summary || {}),
      focusQuery: run.focus_query || metadata.summary?.focusQuery || "",
      dateFrom: run.date_from || metadata.summary?.dateFrom || "",
      dateTo: run.date_to || metadata.summary?.dateTo || "",
      totalRecords: run.scanned_count || metadata.summary?.totalRecords || 0,
    },
    insights: normalizeInsights(envelope),
    findings: normalizeFindings(envelope, true),
    workflowLog: run.workflow_log || metadata.workflowLog || null,
    scannedSourceKeys: run.scanned_source_keys || metadata.scannedSourceKeys || [],
    healthScore: metadata.healthScore || run.healthScore,
    trends: metadata.trends || run.trends,
    rootCauseHypotheses: metadata.rootCauseHypotheses || run.rootCauseHypotheses,
  };
}

function categoryLabel(value) {
  return ({
    blocker: "חסם",
    decision: "החלטה",
    missing_info: "מידע חסר",
    repeated_topic: "נושא חוזר",
    commercial: "מסחרי",
    quality_safety: "איכות/בטיחות",
    entity: "ישות",
  })[value] || value || "כללי";
}

function severityLabel(value) {
  return ({ high: "גבוה", medium: "בינוני", low: "נמוך" })[value] || value || "בינוני";
}

function relativeTime(value) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

function evidenceItems(item = {}) {
  const raw = item.evidence || item.sources || item.records || item.evidence_records || [];
  return Array.isArray(raw) ? raw.slice(0, 5) : [];
}

export function InsightsPage() {
  const [focusQuery, setFocusQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_TO);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [flags, setFlags] = useState({ crossWindowTrend: false, rootCauseHypotheses: false, healthScore: false, graphClustering: false });
  const [chartSource, setChartSource] = useState("alerts");
  const [sortAlpha, setSortAlpha] = useState(false);
  const [hashtags, setHashtags] = useState([]);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState({ state: "idle", text: "מוכן להרצת סוכן התובנות" });
  const [liveSteps, setLiveSteps] = useState([]);
  const [scannedKeys, setScannedKeys] = useState([]);
  const [runCount, setRunCount] = useState(0);
  const eventSourceRef = useRef(null);
  const resultsRef = useRef(null);

  const sortedHashtags = useMemo(() => {
    const items = hashtags.slice(0, 30);
    return sortAlpha ? [...items].sort((a, b) => String(a.tag).localeCompare(String(b.tag), "he")) : items;
  }, [hashtags, sortAlpha]);

  const maxHashtag = useMemo(() => Math.max(...sortedHashtags.map((item) => Number(item.count || 0)), 1), [sortedHashtags]);
  const insights = useMemo(() => normalizeInsights(result || {}), [result]);
  const findings = useMemo(() => normalizeFindings(result || {}, true), [result]);
  const canExpand = Boolean(result && result.ok !== false && (scannedKeys.length || result.scannedSourceKeys?.length));

  const loadHashtags = useCallback(async (next = {}) => {
    const source = next.source || chartSource;
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("source", source);
    const data = await apiFetch(`/api/insights/hashtags?${params}`, { timeoutMs: 15000 });
    setHashtags(Array.isArray(data.hashtags) ? data.hashtags : []);
    setChartSource(source);
  }, [chartSource, dateFrom, dateTo]);

  const loadHistory = useCallback(async () => {
    const data = await apiFetch("/api/insights/runs?limit=30", { timeoutMs: 20000 });
    setHistory(Array.isArray(data.runs) ? data.runs : []);
  }, []);

  useEffect(() => {
    loadHashtags().catch((error) => setStatus({ state: "error", text: `לא ניתן לטעון האשטגים: ${error.message}` }));
  }, [loadHashtags]);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, [loadHistory]);

  useEffect(() => () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
  }, []);

  function toggleFlag(key) {
    setFlags((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleHashtag(tag) {
    setSelectedHashtags((current) => current.includes(tag)
      ? current.filter((item) => item !== tag)
      : [...current, tag]);
  }

  function startLiveRun(runId) {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setLiveSteps([]);
    try {
      const source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
      source.addEventListener("log", (event) => {
        try {
          const item = JSON.parse(event.data);
          if (item.step === "complete" || item.step === "error") return;
          const label = stepLabel(item);
          setLiveSteps((steps) => steps[steps.length - 1] === label ? steps : [...steps, label]);
        } catch {}
      });
      source.onerror = () => {};
      eventSourceRef.current = source;
    } catch {
      eventSourceRef.current = null;
    }
  }

  async function runAnalysis({ expansion = false } = {}) {
    if (running) return;
    setRunning(true);
    const excluded = expansion ? scannedKeys : [];
    const runId = `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setStatus({
      state: "running",
      text: expansion ? `מרחיב תשובה ומדלג על ${excluded.length.toLocaleString()} מקורות שכבר נותחו...` : "מריץ ניתוח על נתוני האינדקס...",
    });
    if (!expansion) {
      setResult(null);
      setScannedKeys([]);
      setRunCount(0);
      setSelectedRunId("");
    }
    startLiveRun(runId);
    try {
      const data = await apiFetch("/api/insights/analyze", {
        method: "POST",
        timeoutMs: 900000,
        body: {
          runId,
          focusQuery,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          limit: Number(limit || DEFAULT_LIMIT),
          selectedHashtags,
          hashtagMode: "boost",
          insights: Object.fromEntries(Object.entries(flags).filter(([, value]) => value)),
          excludeSourceKeys: excluded,
          expansion,
          parentRunId: expansion ? result?.runId || selectedRunId || null : null,
        },
      });
      const nextResult = expansion ? mergeInsights(result, data) : data;
      setResult(nextResult);
      setScannedKeys((current) => uniq([...current, ...(data.scannedSourceKeys || [])]));
      setRunCount((current) => current + 1);
      setSelectedRunId(nextResult?.runId || data.runId || "");
      setStatus({ state: "done", text: "ניתוח התובנות הסתיים" });
      window.__bidocSetWorkflowFromReact?.(data);
      await loadHistory().catch(() => {});
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (error) {
      setResult(expansion && result ? { ...result, expansionError: error.message } : { ok: false, error: error.message });
      setStatus({ state: "error", text: `ניתוח התובנות נכשל: ${error.message}` });
    } finally {
      if (eventSourceRef.current) eventSourceRef.current.close();
      eventSourceRef.current = null;
      setRunning(false);
    }
  }

  function selectRun(run) {
    const normalized = normalizeRun(run);
    setResult(normalized);
    setSelectedRunId(normalized.runId);
    setScannedKeys(Array.isArray(run.scanned_source_keys) ? run.scanned_source_keys : normalized.scannedSourceKeys || []);
    setRunCount(Number(normalized.summary?.expandedRuns || run.metadata?.runCount || (run.is_expansion ? 2 : 1) || 1));
    setFocusQuery(run.focus_query || normalized.summary?.focusQuery || "");
    if (run.date_from || normalized.summary?.dateFrom) setDateFrom(run.date_from || normalized.summary.dateFrom);
    if (run.date_to || normalized.summary?.dateTo) setDateTo(run.date_to || normalized.summary.dateTo);
    if (run.source_limit) setLimit(Number(run.source_limit));
    setStatus({ state: "done", text: "דוח תובנות נטען מההיסטוריה" });
    window.__bidocSetWorkflowFromReact?.(normalized);
  }

  return (
    <div className="reactInsights" dir="rtl">
      <header className="riHero">
        <div className="riHeroMain">
          <span className="riEyebrow"><Icon path={icons.spark} size={14} /> Project Intelligence</span>
          <h2>סוכן תובנות</h2>
          <p>מסך עבודה לריצות עומק על אינדקס הפרויקט: איתור חסמים, החלטות פתוחות, ישויות משפיעות, מגמות וסיכונים עם ראיות.</p>
        </div>
        <div className="riHeroStats">
          <Metric label="ריצות שמורות" value={history.length || "0"} />
          <Metric label="האשטגים פעילים" value={selectedHashtags.length || "0"} />
          <Metric label="מקורות בסריקה" value={Number(limit || 0).toLocaleString()} />
        </div>
      </header>

      <section className="riCommand">
        <div className="riCommandGrid">
          <label className="riField riFieldWide">
            <span>מיקוד אופציונלי</span>
            <input value={focusQuery} onChange={(event) => setFocusQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  runAnalysis({ expansion: event.shiftKey });
                }
              }}
              placeholder="לדוגמה: חסמים בפרויקט, אישורים פתוחים, עלויות חריגות" />
          </label>
          <label className="riField">
            <span>מתאריך</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="riField">
            <span>עד תאריך</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="riField">
            <span>כמות מקורות</span>
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              <option value="200">200</option>
              <option value="350">350</option>
              <option value="700">700</option>
            </select>
          </label>
        </div>

        <div className="riEngineRow">
          <span>מנועי עומק</span>
          <Toggle checked={flags.crossWindowTrend} onClick={() => toggleFlag("crossWindowTrend")} label="מגמות" />
          <Toggle checked={flags.rootCauseHypotheses} onClick={() => toggleFlag("rootCauseHypotheses")} label="סיבת שורש" />
          <Toggle checked={flags.healthScore} onClick={() => toggleFlag("healthScore")} label="ציון בריאות" />
          <Toggle checked={flags.graphClustering} onClick={() => toggleFlag("graphClustering")} label="גרף" />
        </div>

        <div className="riActionRow">
          <button className="riBtn riBtnPrimary" disabled={running} onClick={() => runAnalysis()}>
            <Icon path={icons.play} size={15} /> {running ? "מנתח..." : "נתח את הפרויקט"}
          </button>
          <button className="riBtn" disabled={running || !canExpand} onClick={() => runAnalysis({ expansion: true })}>
            <Icon path={icons.plus} size={15} /> הרחב תשובה
          </button>
          <button className="riBtn" onClick={() => loadHashtags().catch((error) => setStatus({ state: "error", text: error.message }))}>
            <Icon path={icons.refresh} size={15} /> רענן האשטגים
          </button>
          <span className="riShortcut">Ctrl+Enter להרצה · Ctrl+Shift+Enter להרחבה</span>
        </div>
      </section>

      <section className="riSplit">
        <HashtagPanel
          hashtags={sortedHashtags}
          max={maxHashtag}
          selected={selectedHashtags}
          source={chartSource}
          sortAlpha={sortAlpha}
          onToggleTag={toggleHashtag}
          onSource={source => loadHashtags({ source }).catch((error) => setStatus({ state: "error", text: error.message }))}
          onSort={setSortAlpha}
          onClear={() => setSelectedHashtags([])}
        />
        <HistoryPanel
          history={history}
          open={historyOpen}
          selectedRunId={selectedRunId}
          onToggle={() => setHistoryOpen(open => !open)}
          onRefresh={() => loadHistory().catch((error) => setStatus({ state: "error", text: error.message }))}
          onSelect={selectRun}
        />
      </section>

      <StatusPanel status={status} liveSteps={liveSteps} result={result} runCount={runCount} scannedKeys={scannedKeys} insights={insights} findings={findings} />

      <section className="riResults" ref={resultsRef}>
        {running && !result ? <SkeletonResults /> : <Results result={result} insights={insights} findings={findings} />}
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="riMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Toggle({ checked, onClick, label }) {
  return (
    <button type="button" className="riToggle" aria-pressed={checked} onClick={onClick}>
      <span aria-hidden="true" />
      {label}
    </button>
  );
}

function HashtagPanel({ hashtags, max, selected, source, sortAlpha, onToggleTag, onSource, onSort, onClear }) {
  return (
    <section className="riPanel riHashtags">
      <header>
        <div>
          <span className="riEyebrow"><Icon path={icons.chart} size={13} /> Hashtag Analytics</span>
          <h3>אותות חוזרים באינדקס</h3>
        </div>
        <div className="riSegment">
          <button aria-pressed={source === "alerts"} onClick={() => onSource("alerts")}>Alerts</button>
          <button aria-pressed={source === "index"} onClick={() => onSource("index")}>אינדקס</button>
        </div>
      </header>
      <div className="riChartControls">
        <button className="riMiniBtn" aria-pressed={sortAlpha} onClick={() => onSort(true)}>א-ב</button>
        <button className="riMiniBtn" aria-pressed={!sortAlpha} onClick={() => onSort(false)}>כמות</button>
        {selected.length ? <button className="riMiniBtn" onClick={onClear}>נקה בחירה</button> : <span>לחץ על תגית כדי לחזק אותה בניתוח הבא</span>}
      </div>
      <div className="riSelectedTags">
        {selected.length ? selected.map(tag => <button key={tag} onClick={() => onToggleTag(tag)}>#{tag} ×</button>) : <span>אין תגיות נבחרות</span>}
      </div>
      <div className="riBars">
        {hashtags.length ? hashtags.map((item) => {
          const isSelected = selected.includes(item.tag);
          return (
            <button key={item.tag} className="riBar" data-selected={isSelected ? "true" : "false"} onClick={() => onToggleTag(item.tag)}>
              <span>#{item.tag}</span>
              <i style={{ "--bar": `${Math.max(5, (Number(item.count || 0) / max) * 100)}%` }} />
              <b>{Number(item.count || 0).toLocaleString()}</b>
            </button>
          );
        }) : <div className="riEmpty">אין נתוני האשטגים לטווח הנבחר.</div>}
      </div>
    </section>
  );
}

function HistoryPanel({ history, open, selectedRunId, onToggle, onRefresh, onSelect }) {
  return (
    <section className="riPanel riHistory" data-open={open ? "true" : "false"}>
      <header>
        <div>
          <span className="riEyebrow"><Icon path={icons.history} size={13} /> Run History</span>
          <h3>היסטוריית תובנות</h3>
        </div>
        <div className="riHistoryActions">
          <button className="riMiniBtn" onClick={onToggle} aria-expanded={open}>{open ? "הסתר" : `הצג (${history.length})`}</button>
          <button className="riMiniBtn" onClick={onRefresh}>רענן</button>
        </div>
      </header>
      {open && (
        <div className="riHistoryList">
          {history.length ? history.map((run) => {
            const normalized = normalizeRun(run);
            const active = selectedRunId && selectedRunId === normalized.runId;
            return (
              <button key={normalized.runId || run.created_at} className="riHistoryItem" aria-pressed={active} onClick={() => onSelect(run)}>
                <strong>{run.focus_query || normalized.summary?.focusQuery || "סריקה כללית"}</strong>
                <span>{normalized.insights.length} תובנות · {normalized.findings.length} ממצאים · {Number(run.scanned_count || normalized.summary?.totalRecords || 0).toLocaleString()} מקורות</span>
                <small>{run.status === "error" ? "שגיאה" : run.is_expansion ? "הרחבה" : "ריצה"} · {relativeTime(run.created_at)}</small>
              </button>
            );
          }) : <div className="riEmpty">אין עדיין ריצות שמורות.</div>}
        </div>
      )}
    </section>
  );
}

function StatusPanel({ status, liveSteps, result, runCount, scannedKeys, insights, findings }) {
  const summary = result?.summary || {};
  const scanned = scannedKeys.length || result?.scannedSourceKeys?.length || Number(summary.totalRecords || 0);
  return (
    <section className="riStatus" data-state={status.state}>
      <div>
        <strong>{status.text}</strong>
        {result && result.ok !== false && (
          <span>{Number(summary.totalRecords || 0).toLocaleString()} מקורות · {insights.length} תובנות · {findings.length} ממצאים · {runCount || summary.expandedRuns || 1} ריצות</span>
        )}
      </div>
      {result?.workflowLog && (
        <button className="riMiniBtn" onClick={() => window.__bidocActivateTab?.("workflow")}>
          <Icon path={icons.workflow} size={13} /> פתח Workflow
        </button>
      )}
      {!result && scanned > 0 && <span>{scanned.toLocaleString()} מקורות נסרקו</span>}
      {liveSteps.length > 0 && (
        <div className="riLiveSteps">
          {liveSteps.slice(-7).map((step, index) => (
            <span key={`${step}_${index}`} className={index === liveSteps.slice(-7).length - 1 ? "active" : "done"}>
              {index === liveSteps.slice(-7).length - 1 ? <i className="progressSpinner" /> : <Icon path={icons.check} size={11} />}
              {step}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Results({ result, insights, findings }) {
  if (!result) {
    return (
      <div className="riWelcome">
        <span><Icon path={icons.spark} size={22} /></span>
        <h3>הרץ ניתוח AI על נתוני הפרויקט</h3>
        <p>הסוכן יסרוק את האינדקס, יחבר ממצאים לדפוסים, ויציג תובנות עם פעולה מומלצת וראיות.</p>
      </div>
    );
  }
  if (result.ok === false) {
    return <div className="riError"><Icon path={icons.alert} size={18} /> {result.error || "ניתוח התובנות נכשל."}</div>;
  }

  const enginePanels = <EnginePanels result={result} />;
  if (!insights.length && !findings.length && !result.healthScore && !result.trends && !result.rootCauseHypotheses) {
    return <div className="riEmpty">לא נמצאו אותות מספיק חזקים בסריקה הזו. אפשר להרחיב תשובה כדי לסרוק מקורות נוספים.</div>;
  }

  const linked = new Set(insights.flatMap((insight) => insight.supporting_finding_ids || []).map(String));
  const orphanFindings = findings.filter((finding) => !linked.has(String(finding.id || "")));

  return (
    <>
      {enginePanels}
      <section className="riResultSection">
        <header><h3>תובנות AI</h3><span>{insights.length} תובנות מסונתזות</span></header>
        {insights.length ? (
          <div className="riInsightGrid">
            {insights.map((insight, index) => (
              <InsightCard key={insight.id || insight.title || index} insight={insight} findings={findings} />
            ))}
          </div>
        ) : <div className="riEmpty">נמצאו ממצאים, אבל אין עדיין חיבור מספיק חזק ביניהם כדי לקרוא לזה תובנה.</div>}
      </section>
      {orphanFindings.length > 0 && (
        <section className="riResultSection">
          <header><h3>ממצאים שלא הפכו לתובנה</h3><span>{orphanFindings.length} ממצאים</span></header>
          <div className="riFindingsList">
            {orphanFindings.map((finding, index) => <FindingCard key={finding.id || index} finding={finding} />)}
          </div>
        </section>
      )}
    </>
  );
}

function EnginePanels({ result }) {
  const panels = [];
  if (result.healthScore) panels.push(<HealthPanel key="health" health={result.healthScore} />);
  if (Array.isArray(result.trends?.metrics) && result.trends.metrics.length) panels.push(<TrendPanel key="trends" trends={result.trends} />);
  if (Array.isArray(result.rootCauseHypotheses) && result.rootCauseHypotheses.length) panels.push(<HypothesisPanel key="hypotheses" hypotheses={result.rootCauseHypotheses} />);
  return panels.length ? <section className="riEnginePanels">{panels}</section> : null;
}

function HealthPanel({ health = {} }) {
  const dimensions = health.dimensions || health.subscores || {};
  return (
    <article className="riEnginePanel">
      <header><span>Executive Health</span><h4>{health.score ?? "N/A"}</h4></header>
      <div className="riHealthRows">
        {Object.entries(dimensions).map(([key, value]) => {
          const score = typeof value === "object" ? value.score : value;
          return <div key={key} className="riHealthRow"><span>{key}</span><i style={{ "--bar": `${Number(score || 0)}%` }} /><b>{score ?? "—"}</b></div>;
        })}
      </div>
      {Array.isArray(health.critical_flags) && health.critical_flags.length > 0 && <p>{health.critical_flags.join(" · ")}</p>}
    </article>
  );
}

function TrendPanel({ trends = {} }) {
  return (
    <article className="riEnginePanel">
      <header><span>Previous Window</span><h4>מגמות</h4></header>
      <div className="riTrendRows">
        {trends.metrics.slice(0, 6).map((metric) => (
          <div key={metric.metric || metric.name} data-tone={metric.assessment === "worse" ? "bad" : metric.assessment === "better" ? "good" : "neutral"}>
            <span>{metric.label || metric.metric}</span>
            <small>{metric.current ?? "—"} ← {metric.baseline ?? "—"}</small>
            <b>{metric.direction || metric.assessment || "stable"}</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function HypothesisPanel({ hypotheses = [] }) {
  return (
    <article className="riEnginePanel">
      <header><span>Requires Validation</span><h4>השערות סיבת שורש</h4></header>
      <div className="riHypotheses">
        {hypotheses.slice(0, 4).map((item, index) => (
          <div key={item.id || index}>
            <b>{item.title || item.hypothesis || "השערה לבדיקה"}</b>
            <p>{item.hypothesis || item.rationale || item.summary}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function InsightCard({ insight, findings }) {
  const [open, setOpen] = useState(false);
  const supporting = (insight.supporting_finding_ids || [])
    .map((id) => findings.find((finding) => String(finding.id || "") === String(id)))
    .filter(Boolean);
  return (
    <article className="riInsightCard" data-severity={insight.severity || "medium"}>
      <header>
        <span>{categoryLabel(insight.category)}</span>
        <b>{severityLabel(insight.severity)}</b>
      </header>
      <h4>{insight.title || "תובנה"}</h4>
      <p>{insight.insight || insight.finding || insight.summary}</p>
      {insight.why_it_matters && <InfoLine title="למה זה חשוב" text={insight.why_it_matters} />}
      {insight.recommended_action && <InfoLine title="פעולה מומלצת" text={insight.recommended_action} />}
      {insight.uncertainty && <InfoLine title="אי ודאות" text={insight.uncertainty} />}
      {supporting.length > 0 && (
        <div className="riSupporting">
          <button onClick={() => setOpen(value => !value)}><Icon path={icons.chevron} size={13} /> {open ? "הסתר ממצאים" : `${supporting.length} ממצאים תומכים`}</button>
          {open && supporting.map((finding, index) => <FindingCard key={finding.id || index} finding={finding} compact />)}
        </div>
      )}
    </article>
  );
}

function FindingCard({ finding, compact = false }) {
  const evidence = evidenceItems(finding);
  return (
    <article className="riFindingCard" data-compact={compact ? "true" : "false"} data-severity={finding.severity || "medium"}>
      <header><span>{categoryLabel(finding.category)}</span><b>{severityLabel(finding.severity)}</b></header>
      <h4>{finding.title || "ממצא"}</h4>
      <p>{finding.finding || finding.insight || finding.summary}</p>
      {!compact && finding.recommended_action && <InfoLine title="פעולה מומלצת" text={finding.recommended_action} />}
      {evidence.length > 0 && (
        <details className="riEvidence">
          <summary>{evidence.length} ראיות</summary>
          {evidence.map((item, index) => <p key={index}>{typeof item === "string" ? item : item.summary || item.text || item.title || JSON.stringify(item)}</p>)}
        </details>
      )}
    </article>
  );
}

function InfoLine({ title, text }) {
  return <div className="riInfoLine"><b>{title}</b><span>{text}</span></div>;
}

function SkeletonResults() {
  return (
    <section className="riResultSection">
      <header><h3>תובנות AI</h3><span>מנתח...</span></header>
      <div className="riInsightGrid">
        <div className="insightSkeleton" />
        <div className="insightSkeleton" />
        <div className="insightSkeleton" />
      </div>
    </section>
  );
}

function stepLabel(item = {}) {
  return ({
    index_scan: "סורק אינדקס",
    alert_direction: "מנתח התראות",
    hashtag_analysis: "מנתח האשטגים",
    focus_retrieval: "מרחיב אחזור",
    graph_enrichment: "מעשיר גרף",
    graph_search: "מחפש קשרים",
    evidence_pipeline: "מזקק ראיות",
    closure_followup: "בודק סגירות",
    ai_synthesis: "מסנתז תובנות",
    insight_critic: "מבקר תובנות",
    insight_ranking: "מדרג תובנות",
    health_score: "מחשב בריאות",
  })[item.step] || item.label || item.message || item.step || "מעבד";
}
