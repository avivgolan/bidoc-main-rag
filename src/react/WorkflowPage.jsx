import React, { useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid React shell for the Workflow page.
//
// React owns the LAYOUT and chrome (header, run-history strip, metric cards,
// toolbar, graph board, bottom panel, inspector, AI report). The live Cytoscape
// graph and all streaming data are still driven by the existing vanilla code in
// public/app.js, which looks elements up by the IDs/classes reproduced here.
//
// Critical contract: every id="" and the classes app.js toggles (.collapsed on
// #liveRun, .active on the toolbar buttons, .runHistoryItem, etc.) MUST stay
// exactly as app.js expects. After mount we call window.__bidocInitWorkflow()
// so app.js wires + renders regardless of mount order.
// ─────────────────────────────────────────────────────────────────────────────

const Icon = ({ path, size = 16, strokeWidth = 2, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
  </svg>
);

const hdrIcons = {
  report:  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  log:     "M4 6h16M4 12h16M4 18h10",
  copy:    "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
  clear:   "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
};

// Metric cards — ids/classes preserved; app.js writes the values.
const METRICS = [
  { id: "tokens",       valueId: "wfMetric_totalTokens", subId: "wfMetricSub_totalTokens", title: "Total Tokens",   value: "0",
    icon: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"] },
  { id: "cost",         valueId: "wfMetric_totalCost", subId: "wfMetricSub_totalCost", title: "Total Cost", value: "$0.0000",
    icon: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"] },
  { id: "latency",      valueId: "wfMetric_latency", subId: "wfMetricSub_latency", title: "Latency (P95)", value: "0.00s",
    icon: ["M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20z", "M12 6v6l4 2"] },
  { id: "cacheHitRate", valueId: "wfMetric_cacheHitRate", subId: "wfMetricSub_cacheHitRate", title: "Cache Hit Rate", value: "0%",
    icon: ["M23 4v6h-6", "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"] },
  { id: "cache",        valueId: "wfMetric_cache", subId: "wfMetricSub_cache", title: "Cache", value: "HIT / MISS",
    icon: ["M12 8c5 0 9-1.34 9-3s-4-3-9-3-9 1.34-9 3 4 3 9 3z", "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3", "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"] },
  { id: "successRate",  valueId: "wfMetric_successRate", subId: "wfMetricSub_successRate", title: "Success Rate", value: "100%",
    icon: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"] },
];

const BOTTOM_TABS = [
  { id: "overview", label: "סקירה" },
  { id: "filters",  label: "פילטר" },
  { id: "events",   label: "אירועים" },
  { id: "logs",     label: "לוגים" },
  { id: "metrics",  label: "מדדים" },
];

function MetricCard({ m }) {
  return (
    <div className="metricCard" id={`metricCard_${m.id}`}>
      <span className="metricIcon"><Icon path={m.icon} size={18} /></span>
      <div className="metricContent">
        <span className="metricTitle">{m.title}</span>
        <strong className="metricValue" id={m.valueId}>{m.value}</strong>
        <span className="metricSub" id={m.subId}>—</span>
      </div>
    </div>
  );
}

export function WorkflowPage() {
  // After the island mounts, let app.js wire listeners + render any existing run.
  // The island can mount before app.js finishes loading and defines the hook, so
  // poll briefly until it exists, then call it once.
  useEffect(() => {
    window.__bidocWorkflowMounted = true;
    let tries = 0;
    let timer = null;
    const tryInit = () => {
      if (typeof window.__bidocInitWorkflow === "function") {
        window.__bidocInitWorkflow();
        return;
      }
      if (tries++ < 60) timer = setTimeout(tryInit, 50);
    };
    tryInit();
    return () => { if (timer) clearTimeout(timer); };
  }, []);

  return (
    <div className="wfShell" dir="rtl">
      <header className="wfHeader">
        <div className="wfHeaderTitle">
          <h2>זרימת עבודה</h2>
          <p className="wfHeaderSub">תצוגת הרכיבים, הקווים והלוגים של ההרצה האחרונה — בזמן אמת.</p>
        </div>
        <div className="wfHeaderActions">
          <button id="runAiReport" type="button" className="wfBtn wfBtnPrimary">
            <Icon path={hdrIcons.report} size={15} /> דוח AI
          </button>
          <button id="toggleFullLog" type="button" className="wfBtn">
            <Icon path={hdrIcons.log} size={15} /> לוג מלא
          </button>
          <button id="copyLog" type="button" className="wfBtn">
            <Icon path={hdrIcons.copy} size={15} /> העתק
          </button>
          <button id="clearWorkflow" type="button" className="wfBtn wfBtnDanger">
            <Icon path={hdrIcons.clear} size={15} /> נקה
          </button>
        </div>
      </header>

      <div className="workflowLayout">
        <aside className="runHistoryStrip" id="runHistoryStrip">
          <div className="runHistoryStripHeader">היסטוריית ריצות</div>
          <div className="runHistoryList" id="runHistoryList">
            <div className="runHistoryEmpty">אין ריצות שמורות</div>
          </div>
        </aside>

        <div className="workflowMain">
          <section className="liveRun collapsed" id="liveRun">
            <header id="liveRunHeader" style={{ cursor: "pointer", userSelect: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg id="liveRunChevron" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transition: "transform 0.2s", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <strong>לוג ריצה חי</strong>
              </div>
              <span id="liveRunStatus">ממתין לבקשה</span>
            </header>
            <div className="liveRunList" id="liveRunList"></div>
            <pre className="fullLogView" id="fullLogView" hidden></pre>
          </section>

          <section className="workflowMetricCards" id="workflowMetricCards" hidden>
            {METRICS.map(m => <MetricCard key={m.id} m={m} />)}
          </section>

          <section className="openRouterMetrics" id="openRouterMetrics" hidden aria-hidden="true">
            <span id="openRouterCalls">0</span>
            <span id="openRouterInputTokens">0</span>
            <span id="openRouterOutputTokens">0</span>
            <span id="openRouterCost">$0.0000</span>
            <span id="openRouterSpeed">—</span>
          </section>

          <div className="workflowHint" id="workflowHint">
            שלח הודעה בצ׳אט כדי לראות את רכיבי המערכת, הקווים ביניהם והלוגים של ההרצה האחרונה.
          </div>

          <div className="workflowToolbar" id="workflowToolbar" hidden>
            <div className="workflowSearchGroup">
              <input id="workflowSearch" type="search" placeholder="Search node, input, output" autoComplete="off" />
              <select id="workflowStatusFilter" aria-label="Filter workflow status">
                <option value="">All statuses</option>
                <option value="done">Done</option>
                <option value="error">Error</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div className="workflowToolGroup">
              <button id="workflowErrorsOnly" type="button" title="Show errors only">Errors</button>
              <button id="workflowSlowNodes" type="button" title="Highlight slow nodes">Slow</button>
              <button id="workflowExpensiveNodes" type="button" title="Highlight expensive nodes">Cost</button>
              <button id="workflowFallbackNodes" type="button" title="Highlight fallback route">Fallback</button>
              <button id="workflowRegressionNodes" type="button" title="Highlight regressions">Regressions</button>
              <button id="clearWorkflowCompare" type="button" title="Clear run comparison" hidden>Clear Compare</button>
              <button id="fitWorkflow" type="button" title="Fit to screen">Fit</button>
              <button id="toggleWorkflowCards" type="button" title="Expand or collapse node cards">Collapse</button>
              <button id="resetWorkflowFilters" type="button" title="Reset workflow filters">Reset</button>
            </div>
            <div className="workflowIssueSummary" id="workflowIssueSummary">0 matches</div>
          </div>

          <div className="workflowCompareSummary" id="workflowCompareSummary" hidden></div>

          <div className="workflowBoard" id="workflowBoard">
            <div id="workflowCy"></div>
          </div>

          <div className="workflowBottomPanel" id="workflowBottomPanel" hidden>
            <div className="workflowBottomTabBar">
              <div className="workflowBottomTabs">
                {BOTTOM_TABS.map((t, i) => (
                  <button key={t.id} className={`bottomTab${i === 0 ? " active" : ""}`} data-bottom-tab={t.id}>{t.label}</button>
                ))}
              </div>
              <button id="wfExportBtn" className="wfExportBtn" type="button">
                <Icon path={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} size={14} strokeWidth={2.2} />
                יצוא ריצה
              </button>
            </div>
            <div className="workflowBottomTabContent">
              <div className="bottomTabPane active" id="wfPane_overview">
                <table className="wfOverviewTable">
                  <thead>
                    <tr>
                      <th>Run ID</th><th>Started At</th><th>Duration</th><th>Status</th>
                      <th>Model</th><th>Environment</th><th>Workflow Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td id="wfOverview_runId">—</td>
                      <td id="wfOverview_startedAt">—</td>
                      <td id="wfOverview_duration">—</td>
                      <td id="wfOverview_status">—</td>
                      <td id="wfOverview_model">—</td>
                      <td id="wfOverview_environment">—</td>
                      <td id="wfOverview_version">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="bottomTabPane" id="wfPane_filters" hidden>
                <div className="panePlaceholder">תוכן פילטרים זמין דרך סרגל הכלים העליון.</div>
              </div>
              <div className="bottomTabPane" id="wfPane_events" hidden>
                <div className="panePlaceholder">בחר רכיב בגרף כדי לראות אירועים רלוונטיים.</div>
              </div>
              <div className="bottomTabPane" id="wfPane_logs" hidden>
                <div className="panePlaceholder">לוג ריצה מלא זמין דרך כפתור "לוג מלא" למעלה.</div>
              </div>
              <div className="bottomTabPane" id="wfPane_metrics" hidden>
                <div className="panePlaceholder">מדדי ביצוע מפורטים זמינים בפאנל הפירוט של הרכיבים.</div>
              </div>
            </div>
          </div>

          <aside className="workflowInspector" id="workflowInspector">
            <div className="workflowInspectorEmpty">בחר רכיב בגרף כדי לראות Input / Output.</div>
          </aside>

          <section className="workflowAiReport" id="workflowAiReport" hidden>
            <header>
              <strong>דוח AI</strong>
              <span id="workflowAiReportStatus">ממתין להרצה</span>
            </header>
            <div id="workflowAiReportBody"></div>
          </section>
        </div>
      </div>
    </div>
  );
}
