import { TOOL_NAMES } from "../config.js";
import { chatCompletion, extractJsonObject } from "../openrouter.js";
import { buildGraphSearchPayload, summarizeGraphContext } from "../projectGraph.js";
import { annotateToolCall, buildSourceQualitySummary, detectConflicts } from "../sourceQuality.js";
import { fetchAlertsTimelineEvents, fetchTimelineEventPage, graphSearch, hybridSearch, listEntityMentionEdges } from "../supabase.js";
import { callN8nTool } from "../tools.js";
import { callInternalContentTool, isInternalContentTool } from "./contentTools.js";
import { runAlertAgent } from "./alert.js";
import { buildInsightAiContext, buildInsightEvidence, clusterCanonicalEvents, computeBaselineWindow, computeTrendAnalysis, critiqueAndRankInsights, dedupeInsightEvidence, runInsightEvidencePipeline } from "./insightPipeline.js";
import { generateRootCauseHypotheses } from "./rootCauseHypothesis.js";
import { runGraphEnrichment } from "./graphEnrichment.js";
import { computeHealthScore } from "./healthScore.js";

const SIGNALS = [
  {
    id: "blockers",
    title: "חסמים ועיכובים",
    category: "risk",
    severity: "high",
    terms: ["עיכוב", "עיכובים", "איחור", "חסם", "חסמים", "תקוע", "ממתין", "לא אושר", "delay", "delayed", "late", "blocker", "blocked", "pending", "waiting"]
  },
  {
    id: "approvals",
    title: "אישורים והחלטות שצריך לעקוב אחריהם",
    category: "decision",
    severity: "medium",
    terms: ["אישור", "אישורים", "אושר", "לאישור", "החלטה", "decision", "approval", "approved", "permit"]
  },
  {
    id: "missing_info",
    title: "מידע חסר ושאלות פתוחות",
    category: "gap",
    severity: "medium",
    terms: ["חסר", "חוסרים", "לא התקבל", "לא נשלח", "אין מידע", "להשלים", "missing", "incomplete", "not received", "open question"]
  },
  {
    id: "commercial",
    title: "אותות מסחריים ועלויות",
    category: "commercial",
    severity: "medium",
    terms: ["עלות", "עלויות", "כספי", "חשבונית", "תקציב", "חריגה", "שח", "ILS", "NIS", "invoice", "cost", "budget", "variation", "claim"]
  },
  {
    id: "quality_safety",
    title: "איכות, בטיחות וחריגות ביצוע",
    category: "quality",
    severity: "high",
    terms: ["בטיחות", "איכות", "ליקוי", "חריגה", "תיקון", "אי התאמה", "safety", "quality", "defect", "exception", "nonconformance"]
  }
];

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };
const DEFAULT_INSIGHTS_QUERY = "תובנות פרויקט: חסמים, החלטות פתוחות, מידע חסר, סיכונים, איכות, בטיחות ועלויות";
const FOCUS_STOPWORDS = new Set(["של", "עם", "את", "על", "לא", "זה", "זו", "או", "אם", "the", "and", "for", "not", "with", "from"]);

export async function runProjectInsightsAnalysis({
  config,
  focusQuery = "",
  dateFrom = null,
  dateTo = null,
  limit = 350,
  excludeSourceKeys = [],
  selectedHashtags = [],
  hashtagMode = "boost",
  expansion = false,
  runId = null,
  emit = null
}) {
  const trace = [];
  const safeDateFrom = cleanOptionalDate(dateFrom);
  const safeDateTo = cleanOptionalDate(dateTo);
  const step = (name, message, data = {}, status = "done") => {
    const item = { step: name, message, status, time: new Date().toISOString(), data };
    trace.push(item);
    emit?.(runId, name, message, { ...data, status });
    return item;
  };

  const boundedLimit = Math.max(25, Math.min(Number(limit) || 350, 1000));
  const excludedKeys = normalizeSourceKeySet(excludeSourceKeys);

  const primeEnabled = config?.insights?.primeFromAlerts !== false;
  const userFocusQuery = String(focusQuery || "").trim();
  const alertDirection = primeEnabled
    ? await primeFromAlerts({ config, dateFrom: safeDateFrom, dateTo: safeDateTo, userFocusQuery })
    : { alertCount: 0, hashtags: [], terms: [], derivedQuery: "", refinedQuery: "", refined: "disabled" };
  step("alerts_priming", alertDirection.alertCount ? "Alerts analyzed for search direction" : "No alerts to prime from", {
    alertCount: alertDirection.alertCount,
    hashtags: alertDirection.hashtags,
    terms: alertDirection.terms,
    refined: alertDirection.refined,
    focusQuery: alertDirection.refinedQuery || alertDirection.derivedQuery || null
  });

  // Alerts give direction on what to search for in the index; the user's own focus query wins.
  const effectiveFocusQuery = userFocusQuery || alertDirection.refinedQuery || alertDirection.derivedQuery || "";

  const indexScan = await collectIndexRecords({ config, dateFrom: safeDateFrom, dateTo: safeDateTo, limit: boundedLimit, excludedKeys });
  step("index_scan", "Content index scanned", {
    records: indexScan.records.length,
    skipped: indexScan.skipped,
    dateFrom: safeDateFrom,
    dateTo: safeDateTo,
    limit: boundedLimit,
    expansion: Boolean(expansion)
  });

  const hashtagContext = buildHashtagContext(indexScan.records, { selectedHashtags, mode: hashtagMode, alertHashtags: alertDirection.hashtags });
  step("hashtag_analysis", "Hashtag context prepared", {
    selected: hashtagContext.selected,
    active: hashtagContext.active,
    top: hashtagContext.top.slice(0, 8),
    fromAlerts: hashtagContext.fromAlerts || [],
    mode: hashtagContext.mode
  });

  const hybridRecords = await searchFocusRecords({ config, focusQuery: effectiveFocusQuery, dateFrom: safeDateFrom, dateTo: safeDateTo, activeHashtags: hashtagContext.active, runId, emit });
  const filteredHybridRecords = filterExcludedRecords(hybridRecords, excludedKeys);
  step("focus_retrieval", "Focus retrieval completed", {
    focusQuery: effectiveFocusQuery || null,
    focusSource: userFocusQuery ? "user" : (alertDirection.alertCount ? "alerts" : "none"),
    activeHashtags: hashtagContext.active,
    records: filteredHybridRecords.length,
    skipped: hybridRecords.length - filteredHybridRecords.length
  });

  const candidateRecords = dedupeRecords([...filteredHybridRecords, ...indexScan.records])
    .filter((record) => !excludedKeys.has(sourceKey(record)));
  let records = sortRecordsByHashtagBoost(candidateRecords, hashtagContext.active)
    .slice(0, boundedLimit);

  // Entity-aware clustering (phase-2 Task 4 / G3, default off): pull the entity
  // mention links produced by the Graph Entity Enrichment Agent.
  const pipelineEnabled = config?.insights?.evidencePipeline !== false;
  let entityLinks = [];
  // Keep the graph fresh when both graph flags are on: a small incremental
  // enrichment over the last two weeks of records, bounded so a typical run adds
  // seconds, not minutes. Failures never block the analysis.
  if (pipelineEnabled && config?.insights?.graphClustering === true && config?.insights?.graphEnrichment === true) {
    try {
      const enrichmentWindowStart = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const enrichment = await runGraphEnrichment({
        config,
        source: "index",
        mode: "incremental",
        limit: 60,
        dateFrom: enrichmentWindowStart,
        runId,
        emit
      });
      step("graph_enrichment", enrichment.records
        ? `Enriched ${enrichment.records} recent records with ${enrichment.entities} entity mentions`
        : "Graph entities are up to date for recent records", {
        records: enrichment.records,
        entities: enrichment.entities,
        skippedExisting: enrichment.skippedExisting,
        windowStart: enrichmentWindowStart,
        status: enrichment.records ? "done" : "skipped"
      });
    } catch (error) {
      step("graph_enrichment", "Incremental graph enrichment failed; analysis continues", { error: error.message }, "warning");
    }
  }
  if (pipelineEnabled && config?.insights?.graphClustering === true) {
    try {
      entityLinks = await listEntityMentionEdges({ config });
      step("graph_entity_links", entityLinks.length ? "Entity mention links loaded from the graph" : "No enriched entities in the graph yet", {
        links: entityLinks.length,
        status: entityLinks.length ? "done" : "skipped"
      });
    } catch (error) {
      step("graph_entity_links", "Entity link loading failed; clustering continues without entities", { error: error.message }, "warning");
    }
  }

  // Deterministic evidence pipeline (normalize -> dedupe -> cluster/timeline -> analytics -> patterns).
  // Feature flag: config.insights.evidencePipeline === false disables it and restores the old flow.
  let pipeline = pipelineEnabled
    ? runInsightEvidencePipeline({ records, analysisWindow: { from: safeDateFrom, to: safeDateTo }, entityLinks })
    : null;
  if (pipeline) {
    step("evidence_normalization", "Evidence normalized with lineage and statement types", {
      evidence: pipeline.evidence.length,
      derived: pipeline.evidence.filter((item) => item.lineage.origin_type === "derived").length,
      commitments: pipeline.evidence.filter((item) => item.evidence_type === "commitment").length
    });
    step("deduplication", "Canonical events built", {
      canonicalEvents: pipeline.canonicalEvents.length,
      merged: pipeline.evidence.length - pipeline.canonicalEvents.length
    });
    step("clustering_timeline", "Topic clusters and timelines built", {
      clusters: pipeline.clusters.length,
      open: pipeline.clusters.filter((cluster) => ["open", "in_progress"].includes(cluster.latest_status)).length,
      closed: pipeline.clusters.filter((cluster) => cluster.closed).length,
      contradictions: pipeline.clusters.filter((cluster) => cluster.contradiction).length
    });
    step("analytics_engine", "Deterministic analytics computed", {
      version: pipeline.analytics.analytics_version,
      referenceDate: pipeline.analytics.reference_date,
      openClusters: pipeline.analytics.project_metrics.open_clusters.value,
      overdueCommitments: pipeline.analytics.project_metrics.overdue_commitments.value
    });
    step("pattern_detection", pipeline.patterns.length ? "Candidate insight patterns detected" : "No explicit insight patterns detected", {
      patterns: pipeline.patterns.length,
      byType: pipeline.patterns.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {})
    });
  }

  // Follow-up retrieval: for clusters flagged as open patterns, search the index for
  // later closure/status evidence so a resolved topic is not reported as an active risk.
  let followupRecordCount = 0;
  if (pipeline && config?.insights?.closureFollowup !== false) {
    const followup = await searchClosureEvidence({
      config,
      pipeline,
      existingKeys: new Set(records.map((record) => sourceKey(record))),
      excludedKeys,
      dateFrom: safeDateFrom,
      dateTo: safeDateTo,
      runId,
      emit
    });
    followupRecordCount = followup.records.length;
    if (followup.records.length) {
      records = dedupeRecords([...records, ...followup.records]).slice(0, boundedLimit + 30);
      pipeline = runInsightEvidencePipeline({ records, analysisWindow: { from: safeDateFrom, to: safeDateTo }, entityLinks });
    }
    step("closure_followup", followup.records.length
      ? "Closure follow-up search added later evidence; pipeline recomputed"
      : (followup.targets ? "Closure follow-up search found no new evidence" : "No open patterns required a closure follow-up"), {
      targets: followup.targets,
      queries: followup.queries,
      newRecords: followup.records.length,
      status: followup.targets ? "done" : "skipped"
    });
  }

  // Cross-window trend (phase-2 spec Task 1, default off): retrieve the preceding
  // window of equal length and compare the same versioned metrics against it.
  if (pipeline && config?.insights?.crossWindowTrend === true && safeDateFrom && safeDateTo) {
    const baselineWindow = computeBaselineWindow(safeDateFrom, safeDateTo);
    if (baselineWindow) {
      try {
        const baselineScan = await collectIndexRecords({
          config,
          dateFrom: baselineWindow.from,
          dateTo: baselineWindow.to,
          limit: boundedLimit,
          excludedKeys: new Set()
        });
        const baselineEvidence = buildInsightEvidence(dedupeRecords(baselineScan.records));
        const baselineClusters = clusterCanonicalEvents(dedupeInsightEvidence(baselineEvidence));
        pipeline.analytics.trends = computeTrendAnalysis({
          evidence: pipeline.evidence,
          clusters: pipeline.clusters,
          analysisWindow: { from: safeDateFrom, to: safeDateTo },
          baseline: { evidence: baselineEvidence, clusters: baselineClusters, window: baselineWindow }
        });
        step("trend_analysis", "Cross-window trend computed against the previous period", {
          baselineWindow,
          baselineRecords: baselineScan.records.length,
          status: pipeline.analytics.trends.status,
          coverageGap: pipeline.analytics.trends.coverage_gap ?? null
        });
      } catch (error) {
        step("trend_analysis", "Cross-window trend failed; in-window trend retained", { error: error.message }, "warning");
      }
    }
  }

  // Root Cause Hypothesis Engine (phase-2 spec Task 2, default off): inference-only
  // causal candidates for the strongest detected patterns.
  let rootCauseHypotheses = [];
  if (pipeline && config?.insights?.rootCauseHypotheses === true && pipeline.patterns.length) {
    rootCauseHypotheses = await generateRootCauseHypotheses({
      config,
      patterns: pipeline.patterns,
      clusters: pipeline.clusters,
      evidence: pipeline.evidence,
      runId,
      emit
    });
    step("root_cause_hypotheses", rootCauseHypotheses.length
      ? `${rootCauseHypotheses.length} inference-only hypotheses generated`
      : "No supported root-cause hypotheses", {
      hypotheses: rootCauseHypotheses.length,
      requiresValidation: rootCauseHypotheses.every((item) => item.requires_validation === true)
    });
  }

  const toolContext = await runExistingProjectTools({
    config,
    query: effectiveFocusQuery || DEFAULT_INSIGHTS_QUERY,
    records,
    dateFrom: safeDateFrom,
    dateTo: safeDateTo,
    runId,
    emit
  });

  const summary = summarizeProjectRecords(records, { focusQuery: effectiveFocusQuery, dateFrom: safeDateFrom, dateTo: safeDateTo });
  summary.hashtagContext = hashtagContext;
  summary.alertDirection = alertDirection;
  summary.excludedRecords = excludedKeys.size;
  summary.skippedRecords = indexScan.skipped + (hybridRecords.length - filteredHybridRecords.length);
  summary.expansion = Boolean(expansion);

  const evidenceContext = pipeline ? buildInsightAiContext(pipeline) : null;
  if (evidenceContext && rootCauseHypotheses.length) evidenceContext.root_cause_hypotheses = rootCauseHypotheses;
  const { findings, insights: rawInsights } = await generateProjectInsights({ config, records, summary, focusQuery: effectiveFocusQuery, hashtagContext, alertDirection, toolContext, evidenceContext, runId, emit });
  step("signal_detection", "Findings generated from records", {
    findings: findings.length,
    activeHashtags: hashtagContext.active,
    evidence: findings.reduce((sum, item) => sum + (item.evidence?.length || 0), 0)
  });

  // Insight critic: deterministic validation + ranking of the AI output (plan sections 8-9).
  const critic = pipeline
    ? critiqueAndRankInsights({ insights: rawInsights, findings, clusters: pipeline.clusters, patterns: pipeline.patterns })
    : { accepted: rawInsights, rejected: [], score_version: null };
  const insights = critic.accepted;
  if (pipeline) {
    step("insight_critic", `${insights.length} insights accepted, ${critic.rejected.length} rejected`, {
      accepted: insights.length,
      rejected: critic.rejected,
      scoreVersion: critic.score_version
    });
  }
  step("insight_ranking", "Insights synthesized from findings", {
    sourceTables: Object.keys(summary.sourceCounts).length,
    topSeverity: insights[0]?.severity || null,
    findings: findings.length,
    insights: insights.length,
    mode: (findings.length || insights.length) ? "ai" : "none"
  });

  // Executive Health Score (phase-2 spec Task 3, default off). Summary output only —
  // it is intentionally NOT added to the AI synthesis payload (plan: a score is never
  // evidence for an insight).
  let healthScore = null;
  if (pipeline && config?.insights?.healthScore === true) {
    healthScore = computeHealthScore({
      analytics: pipeline.analytics,
      clusters: pipeline.clusters,
      patterns: pipeline.patterns,
      analysisWindow: { from: safeDateFrom, to: safeDateTo }
    });
    step("health_score", healthScore.score != null
      ? `Health score ${healthScore.score} (${healthScore.status})`
      : `Health score not computed (${healthScore.reason || healthScore.status})`, {
      score: healthScore.score,
      status: healthScore.status,
      criticalFlags: healthScore.critical_flags?.length || 0,
      version: healthScore.score_version
    });
  }

  // Per-run observability (plan section 17): stage counts, versions, rejections, timing.
  const observability = {
    request: {
      focusQuery: effectiveFocusQuery || null,
      focusSource: userFocusQuery ? "user" : (alertDirection.alertCount ? "alerts" : "none"),
      dateFrom: safeDateFrom,
      dateTo: safeDateTo,
      limit: boundedLimit,
      expansion: Boolean(expansion),
      excludedSourceKeys: excludedKeys.size
    },
    retrieval: {
      indexRecords: indexScan.records.length,
      hybridRecords: filteredHybridRecords.length,
      followupRecords: followupRecordCount,
      recordsAnalyzed: records.length,
      skippedRecords: summary.skippedRecords
    },
    pipeline: pipeline ? {
      evidence: pipeline.evidence.length,
      canonicalEvents: pipeline.canonicalEvents.length,
      mergedDuplicates: pipeline.evidence.length - pipeline.canonicalEvents.length,
      clusters: pipeline.clusters.length,
      openClusters: pipeline.analytics.project_metrics.open_clusters.value,
      closedClusters: pipeline.analytics.project_metrics.closed_clusters.value,
      contradictions: pipeline.analytics.project_metrics.contradictions.value,
      patternsByType: pipeline.patterns.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {}),
      trendStatus: pipeline.analytics.trends?.status || null,
      entityStats: pipeline.entityStats || null,
      dataCoverage: pipeline.analytics.data_quality
    } : null,
    synthesis: {
      findings: findings.length,
      candidateInsights: rawInsights.length,
      acceptedInsights: insights.length,
      rejectedInsights: critic.rejected.length,
      rejectionReasons: critic.rejected.reduce((acc, item) => ({ ...acc, [item.reason]: (acc[item.reason] || 0) + 1 }), {})
    },
    versions: {
      pipeline: pipeline?.pipeline_version || null,
      analytics: pipeline?.analytics?.analytics_version || null,
      trend: pipeline?.analytics?.trends?.trend_version || null,
      ranking: critic.score_version,
      promptSource: config?.prompts?.project_insights ? "settings_override" : "default"
    },
    timing: {
      startedAt: trace[0]?.time || null,
      finishedAt: trace.at(-1)?.time || null,
      steps: trace.map((item) => ({ step: item.step, time: item.time }))
    }
  };
  summary.observability = observability;

  const workflowLog = buildProjectInsightsWorkflowLog({ trace, summary, insights, findings, toolContext, pipeline, critic });
  return {
    ok: true,
    summary,
    findings,
    insights,
    observability,
    analytics: pipeline?.analytics || null,
    patterns: pipeline?.patterns || [],
    rootCauseHypotheses,
    healthScore,
    clusters: pipeline ? compactClusters(pipeline.clusters) : [],
    critic: pipeline ? { rejected: critic.rejected, score_version: critic.score_version } : null,
    toolContext: compactProjectToolContext(toolContext),
    recordsSample: records.slice(0, 12).map((record) => toEvidence(record)),
    scannedSourceKeys: records.map((record) => sourceKey(record)).filter(Boolean),
    hasMore: Boolean(indexScan.hasMore),
    workflowLog
  };
}

function compactClusters(clusters = []) {
  return clusters.slice(0, 20).map((cluster) => ({
    cluster_id: cluster.cluster_id,
    topic: cluster.topic,
    hashtags: cluster.hashtags,
    entities: (cluster.entities || []).map((entity) => ({ label: entity.label, kind: entity.kind })),
    latest_status: cluster.latest_status,
    closed: cluster.closed,
    contradiction: cluster.contradiction,
    expected_date: cluster.expected_date,
    occurrence_count: cluster.occurrence_count,
    independent_source_count: cluster.independent_source_count,
    first_date: cluster.first_date,
    last_date: cluster.last_date,
    timeline: cluster.timeline.slice(-6)
  }));
}

async function collectIndexRecords({ config, dateFrom, dateTo, limit, excludedKeys }) {
  const records = [];
  let cursor = null;
  let hasMore = false;
  let skipped = 0;
  let pages = 0;
  do {
    const page = await fetchTimelineEventPage({
      config,
      source: "index",
      sort: "desc",
      from: dateFrom || null,
      to: dateTo || null,
      limit,
      cursor
    });
    pages += 1;
    for (const event of page.events || []) {
      if (excludedKeys.has(sourceKey(event))) {
        skipped += 1;
        continue;
      }
      records.push(event);
      if (records.length >= limit) break;
    }
    cursor = page.page?.nextCursor || null;
    hasMore = Boolean(page.page?.hasMore);
  } while (records.length < limit && cursor && pages < 8);
  return { records, skipped, hasMore };
}

function filterExcludedRecords(records = [], excludedKeys = new Set()) {
  return (records || []).filter((record) => !excludedKeys.has(sourceKey(record)));
}

function buildHashtagContext(records = [], { selectedHashtags = [], mode = "boost", alertHashtags = [] } = {}) {
  const selected = normalizeRecordTags(selectedHashtags);
  const fromAlerts = normalizeRecordTags(alertHashtags);
  const top = topHashtagsFromRecords(records, 20);
  // Priority: explicit user selection > alert-derived direction > top index hashtags.
  const active = selected.length
    ? selected
    : (fromAlerts.length ? fromAlerts.slice(0, 8) : top.slice(0, 8).map((item) => item.tag));
  return {
    mode: mode === "boost" ? "boost" : "boost",
    selected,
    fromAlerts,
    active,
    top
  };
}

function sortRecordsByHashtagBoost(records = [], activeHashtags = []) {
  if (!activeHashtags?.length) return records;
  return [...records].sort((a, b) => hashtagOverlap(b.hashtags || b.tags, activeHashtags) - hashtagOverlap(a.hashtags || a.tags, activeHashtags));
}

/**
 * Reads the project alerts and derives a search direction for the index run:
 * dominant hashtags + severity-weighted recurring terms, plus a query string.
 * When OpenRouter is configured, an optional short LLM step refines the themes
 * into a natural-language Hebrew focus query (deterministic fallback otherwise).
 * Alerts steer retrieval/ranking; they never become findings themselves.
 */
async function primeFromAlerts({ config, dateFrom, dateTo, userFocusQuery = "" }) {
  const empty = { alertCount: 0, hashtags: [], terms: [], derivedQuery: "", refinedQuery: "", refined: "none" };
  let alerts = [];
  try {
    alerts = await fetchAlertsTimelineEvents({ config, limit: 2000 });
  } catch {
    return empty;
  }
  if (!Array.isArray(alerts) || !alerts.length) return empty;

  const scoped = alerts.filter((event) => {
    if (!event.date) return true;
    if (dateFrom && event.date < dateFrom) return false;
    if (dateTo && event.date > dateTo) return false;
    return true;
  });
  if (!scoped.length) return empty;

  const hashtags = topHashtagsFromRecords(scoped, 10).map((item) => item.tag);

  const termCounts = new Map();
  for (const alert of scoped) {
    const weight = Math.max(1, Number(alert.severity) || 1);
    const normalized = normalizeRecord(alert);
    const text = `${normalized.title || ""} ${normalized.summary || normalized.text || ""}`;
    for (const token of tokenizeFocusText(text)) {
      termCounts.set(token, (termCounts.get(token) || 0) + weight);
    }
  }
  const terms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he"))
    .slice(0, 8)
    .map(([term]) => term);

  const derivedQuery = [...terms, ...hashtags.map((tag) => `#${tag}`)].join(" ").trim();
  const direction = { alertCount: scoped.length, hashtags, terms, derivedQuery, refinedQuery: "", refined: "deterministic" };

  // With a user focus query we keep their intent (alert hashtags still steer ranking); no need to synthesize a query.
  if (userFocusQuery) return direction;

  // Optional LLM refinement into a natural-language Hebrew search direction.
  if (config?.openRouterApiKey && (terms.length || hashtags.length)) {
    try {
      const content = await chatCompletion({
        apiKey: config.openRouterApiKey,
        model: config.models?.lite || config.models?.classifier || "openai/gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 400,
        timeoutMs: 30_000,
        responseFormat: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You turn construction-project alert themes into a short search direction for an index of project records.",
              "Return ONLY valid JSON: {\"focusQuery\":\"string\",\"topics\":[\"string\"]}.",
              "focusQuery is a concise Hebrew phrase (<=140 chars) describing what to look for in the index based on the alerts.",
              "Do not invent themes that are not implied by the provided hashtags/terms."
            ].join("\n")
          },
          {
            role: "user",
            content: JSON.stringify({ hashtags, terms, alertCount: scoped.length })
          }
        ]
      });
      const parsed = extractJsonObject(content);
      const refinedQuery = String(parsed?.focusQuery || "").trim();
      if (refinedQuery) return { ...direction, refinedQuery, refined: "ai" };
    } catch {
      // fall back to the deterministic direction
    }
  }
  return direction;
}

function cleanOptionalDate(value) {
  const text = String(value || "").trim();
  return text && text !== "undefined" && text !== "null" ? text : null;
}

async function runExistingProjectTools({ config, query, records, dateFrom, dateTo, runId, emit }) {
  const toolCalls = [];
  let graphContext = [];
  let alertResult = null;

  toolCalls.push(annotateToolCall({
    toolName: "hybrid_search",
    ok: true,
    rawQuery: query,
    data: records,
    sources: records.map((record) => toEvidence(record)).filter((item) => item.source_url).map((item) => ({ url: item.source_url, label: item.title }))
  }));

  if (config.graph?.enabled !== false && records.length) {
    const limit = Number(config.graph?.searchLimit || 30);
    const payload = buildGraphSearchPayload({ query, records: records.slice(0, 60), maxRows: limit });
    try {
      emit?.(runId, "graph_search", "Running Project Graph Search", { sourceRefs: payload.source_refs.length, status: "running" });
      const graph = await graphSearch({ config, payload, limit });
      graphContext = summarizeGraphContext(graph, 16);
      toolCalls.push(annotateToolCall({
        toolName: "graph_search",
        ok: !graph.skipped,
        skipped: Boolean(graph.skipped),
        rawQuery: query,
        data: graphContext,
        error: graph.skipped ? graph.reason || graph.error || "No graph context found" : null,
        sources: []
      }));
      emit?.(runId, "graph_search", graph.skipped ? "Project Graph Search skipped" : "Project Graph Search completed", {
        mode: graph.mode || "unknown",
        records: graphContext.length,
        error: graph.error || null,
        status: graph.skipped ? "skipped" : "done"
      });
    } catch (error) {
      toolCalls.push(annotateToolCall({ toolName: "graph_search", ok: false, rawQuery: query, error: error.message, data: null, sources: [] }));
      emit?.(runId, "graph_search", "Project Graph Search failed", { error: error.message, status: "error" });
    }
  }

  if (config.n8n?.runtime?.alertAgentEnabled !== false) {
    try {
      emit?.(runId, "alert_agent", "Running Alert Agent", { query, status: "running" });
      alertResult = await runAlertAgent({ query, dateFrom, dateTo });
      toolCalls.push(annotateToolCall({ toolName: "alert", ok: true, rawQuery: query, data: alertResult, sources: [] }));
      emit?.(runId, "alert_agent", "Alert Agent completed", { resultsCount: alertResult.resultsCount || 0, status: "done" });
    } catch (error) {
      toolCalls.push(annotateToolCall({ toolName: "alert", ok: false, rawQuery: query, error: error.message, data: null, sources: [] }));
      emit?.(runId, "alert_agent", "Alert Agent failed", { error: error.message, status: "error" });
    }
  }

  const toolsRuntime = config.n8n?.runtime || {};
  const n8nTools = TOOL_NAMES
    .filter((toolName) => !["alert", "meeting_evidence_search"].includes(toolName))
    // Internal content tools bypass the n8n runtime kill-switch.
    .filter((toolName) => toolsRuntime.enabled !== false || isInternalContentTool(toolName, config))
    .slice(0, Number(toolsRuntime.parallelLimit || 6));

  emit?.(runId, "n8n_tools", "Calling existing project tools", { tools: n8nTools, status: n8nTools.length ? "running" : "skipped" });
  const n8nResults = await Promise.all(n8nTools.map((toolName) =>
    (isInternalContentTool(toolName, config)
      ? callInternalContentTool({ config, toolName, query, dateFrom, dateTo })
      : callN8nTool({ toolName, query, dateFrom, dateTo, sessionId: runId, config })
    ).then((result) => {
      emit?.(runId, "n8n_tools", `Tool ${toolName} completed`, { ok: result.ok, internal: result.internal || false, skipped: result.skipped || false, error: result.error || null });
      return result;
    })
  ));
  for (const result of n8nResults) toolCalls.push(annotateToolCall(result));

  const sourceQuality = buildSourceQualitySummary(toolCalls);
  const conflicts = detectConflicts(toolCalls);
  emit?.(runId, "source_quality", "Source quality scored", { ...sourceQuality, status: "done" });
  emit?.(runId, "conflict_detection", conflicts.length ? "Potential source conflicts detected" : "No obvious source conflicts detected", { conflicts, status: conflicts.length ? "warning" : "done" });

  return { graphContext, alertResult, toolCalls, sourceQuality, conflicts, n8nResults };
}

const DEFAULT_PROJECT_INSIGHTS_PROMPT = [
  "You are the BIDOC construction-project Insight Synthesis Agent.",
  "A retrieved record is a finding, not necessarily an insight. INSIGHT = EVIDENCE + CONNECTION + PROJECT IMPLICATION + REQUIRED ATTENTION.",
  "You are given real project records from the index (each with a numeric `index`) plus deterministic support inputs:",
  "- `evidence_clusters`: topic clusters with chronological timelines, latest status, closure and contradiction flags.",
  "- `analytics_context`: deterministic calculated metrics (with formula versions and analysis window). Do not recalculate supplied metrics.",
  "- `candidate_patterns`: rule-detected patterns (unfulfilled_commitment, status_deterioration, persistent_open_issue, contradiction, closure, dependency_risk). Treat them as leads to verify against the evidence, not as proven conclusions.",
  "- A dependency_risk pattern links open topics through a shared entity. Phrase it as \"נדרש לבדוק האם X משפיע על Y\" — never as a confirmed blockage.",
  "- `root_cause_hypotheses`: inference-only causal candidates. NEVER present them as confirmed causes; when used, keep them phrased as hypotheses requiring validation and mention the missing evidence.",
  "Ground everything ONLY in the provided inputs — never invent records, facts, dates, causes, dependencies, or statuses.",
  "Evidence rules:",
  "- Never treat a commitment, request, or estimate as completed work.",
  "- The latest dated update in a cluster timeline wins; never present an older status as current.",
  "- When a cluster is closed, do not present it as an active risk.",
  "- When sources contradict, present the contradiction, set the insight `status` to \"requires_validation\", and do not pick a side without evidence.",
  "- Separate confirmed facts from inference; use cautious phrasing (\"נדרש לבדוק האם...\", \"לא נמצאה ראיה לכך ש...\") for anything not explicitly stated in the evidence.",
  "Produce two layers:",
  "1) findings: evidence-backed observations. Each finding MUST cite the records it is based on via `evidence_record_indexes` (the numeric `index` values of the provided records). Give each finding a short unique `id` (e.g. \"f1\").",
  "2) insights: connect MULTIPLE findings into a management-level conclusion with a project implication and a required action. A single finding may support an insight only for a clearly critical event (stop-work order, explicit schedule deviation, formal decision, safety incident). Each insight MUST list `supporting_finding_ids`. Prefer cluster timelines and candidate patterns as the connection basis. Do not repeat a finding as an insight and do not duplicate the same issue across insights.",
  "Quality bar: fewer, stronger insights. If the evidence supports findings but no meaningful connected insight, return the findings with an empty insights array — do not pad with weak insights.",
  "Use hashtags as context/grouping only when supported by evidence; never infer a conclusion from a hashtag alone.",
  "Do not create a legal claim file. Do not make legal, entitlement, cost, or critical-path conclusions.",
  "Return at most 8 findings and 5 insights, prioritising the most significant. Keep each text field concise.",
  "The findings array MUST NOT be empty when insights are present — every insight must trace back to findings that cite record indexes.",
  "Use Hebrew for all user-facing text. Return ONLY valid JSON.",
  "Schema: {\"findings\":[{\"id\":\"string\",\"title\":\"string\",\"category\":\"blocker|decision|missing_info|repeated_topic|commercial|quality_safety|entity\",\"severity\":\"high|medium|low\",\"confidence\":0.0,\"finding\":\"string\",\"why_it_matters\":\"string\",\"recommended_action\":\"string\",\"hashtags\":[\"string\"],\"evidence_record_indexes\":[0]}],\"insights\":[{\"title\":\"string\",\"category\":\"blocker|decision|missing_info|repeated_topic|commercial|quality_safety|entity\",\"severity\":\"high|medium|low\",\"confidence\":0.0,\"insight\":\"string\",\"why_it_matters\":\"string\",\"recommended_action\":\"string\",\"uncertainty\":\"string\",\"status\":\"active|requires_validation|resolved\",\"based_on_patterns\":[\"pattern_id\"],\"supporting_finding_ids\":[\"string\"]}]}"
].join("\n");

// Generates BOTH findings and insights from the real index records via one AI call.
// Findings are grounded by citing record indexes; nothing is hardcoded. When the AI is
// unavailable or fails, returns empty layers (no templated fallback).
async function generateProjectInsights({ config, records, summary, focusQuery, hashtagContext, alertDirection = null, toolContext, evidenceContext = null, runId, emit }) {
  const empty = { findings: [], insights: [] };
  if (!records.length) return empty;
  if (!config?.openRouterApiKey) {
    emit?.(runId, "ai_synthesis_warning", "AI synthesis unavailable: OpenRouter key missing", { status: "warning" });
    return empty;
  }

  const candidateRecords = records.slice(0, 40).map((record, index) => {
    const normalized = normalizeRecord(record);
    return {
      index,
      title: normalized.title,
      date: normalized.date,
      source_table: normalized.source_table,
      source_id: normalized.source_id,
      severity_or_risk: normalized.severity_or_risk,
      hashtags: normalized.hashtags,
      text: normalized.text.slice(0, 900)
    };
  });

  const systemPrompt = config.prompts?.project_insights || DEFAULT_PROJECT_INSIGHTS_PROMPT;
  const userPayload = JSON.stringify({
    focusQuery: focusQuery || null,
    summary,
    hashtagContext,
    alertDirection: alertDirection || summary?.alertDirection || null,
    evidence_clusters: evidenceContext?.evidence_clusters || [],
    analytics_context: evidenceContext?.analytics_context || null,
    candidate_patterns: evidenceContext?.candidate_patterns || [],
    root_cause_hypotheses: evidenceContext?.root_cause_hypotheses || [],
    records: candidateRecords,
    graphContext: toolContext?.graphContext || [],
    alertAgent: toolContext?.alertResult || null,
    toolResults: compactToolResults(toolContext?.toolCalls || []),
    sourceQuality: toolContext?.sourceQuality || null,
    conflicts: toolContext?.conflicts || []
  }, null, 2);
  const callModel = (messages, modelOverride = null) => chatCompletion({
    apiKey: config.openRouterApiKey,
    model: modelOverride || config.models?.main || "openai/gpt-4o-mini",
    temperature: 0.15,
    maxTokens: 8000,
    timeoutMs: 150_000,
    responseFormat: { type: "json_object" },
    messages
  });
  // Slow main models (gemini-2.5-pro) sometimes exceed the timeout on large payloads;
  // a degraded-but-grounded lite result beats returning nothing.
  const callModelWithFallback = async (messages) => {
    try {
      return await callModel(messages);
    } catch (error) {
      if (!/timed out/i.test(error.message)) throw error;
      emit?.(runId, "ai_synthesis", "Main model timed out; retrying with the lite model", { status: "running", fallbackModel: config.models?.lite || "openai/gpt-4o-mini" });
      return callModel(messages, config.models?.lite || "openai/gpt-4o-mini");
    }
  };

  try {
    emit?.(runId, "ai_synthesis", "AI insight synthesis started", { records: candidateRecords.length, status: "running" });
    const baseMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPayload }
    ];
    const content = await callModelWithFallback(baseMessages);
    let parsed = tryParseInsightObject(content);
    let findings = parsed ? normalizeAiFindings(parsed.findings, records) : [];
    let insights = parsed ? normalizeAiInsights(parsed.insights, findings) : [];

    // One corrective retry when the model broke the contract: invalid JSON, or
    // insights without the grounded findings layer. If the retry also fails, the
    // critic rejects ungrounded insights (better none than unsupported).
    const brokeJson = !parsed;
    const skippedFindings = Boolean(parsed && !findings.length && Array.isArray(parsed.insights) && parsed.insights.length);
    if (brokeJson || skippedFindings) {
      const correction = brokeJson
        ? "Your previous response was not valid JSON. Return the full response again as strictly valid JSON only, matching the schema exactly, with both \"findings\" and \"insights\" arrays. No commentary, no code fences, no stray characters."
        : "Your response omitted the required findings layer, so the insights cannot be grounded. Return the full JSON again: include 4-8 findings, each citing the provided record indexes via evidence_record_indexes and carrying a short unique id, and make every insight's supporting_finding_ids reference those finding ids. Return ONLY valid JSON with both \"findings\" and \"insights\"."
      emit?.(runId, "ai_synthesis", brokeJson ? "AI output was not valid JSON; retrying once" : "AI returned insights without findings; requesting grounded findings", {
        status: "running",
        retry: true,
        contentLength: String(content || "").length,
        contentPreview: String(content || "").slice(0, 300)
      });
      try {
        const retryContent = await callModelWithFallback([
          ...baseMessages,
          { role: "assistant", content: String(content || "").slice(0, 6000) },
          { role: "user", content: correction }
        ]);
        const retryParsed = tryParseInsightObject(retryContent);
        if (retryParsed) {
          const retryFindings = normalizeAiFindings(retryParsed.findings, records);
          if (retryFindings.length || !findings.length) {
            findings = retryFindings.length ? retryFindings : findings;
            const retryInsightsRaw = Array.isArray(retryParsed.insights) && retryParsed.insights.length
              ? retryParsed.insights
              : (parsed?.insights || []);
            insights = normalizeAiInsights(retryInsightsRaw, findings);
          }
        } else if (brokeJson) {
          emit?.(runId, "ai_synthesis_warning", "AI synthesis returned unparseable output twice", {
            contentLength: String(retryContent || "").length,
            contentPreview: String(retryContent || "").slice(0, 400),
            status: "warning"
          });
          return empty;
        }
      } catch (retryError) {
        emit?.(runId, "ai_synthesis_warning", "AI synthesis retry failed", { error: retryError.message, status: "warning" });
        if (brokeJson) return empty;
      }
    }
    const produced = findings.length || insights.length;
    emit?.(runId, produced ? "ai_synthesis" : "ai_synthesis_warning", produced ? "AI synthesis completed" : "AI returned no findings", {
      findings: findings.length,
      insights: insights.length,
      status: produced ? "done" : "warning",
      __debugRawFindings: Array.isArray(parsed?.findings) ? parsed.findings.length : typeof parsed?.findings,
      __debugRawInsights: Array.isArray(parsed?.insights) ? parsed.insights.length : typeof parsed?.insights,
      __debugPreview: String(content || "").slice(0, 400)
    });
    return { findings, insights };
  } catch (error) {
    emit?.(runId, "ai_synthesis_warning", "AI synthesis failed", { error: error.message, status: "warning" });
    return empty;
  }
}

// Maps AI-produced findings onto grounded evidence pulled from the actual records they cite.
function normalizeAiFindings(items, records) {
  if (!Array.isArray(items)) return [];
  const normalizedRecords = (records || []).map((record) => normalizeRecord(record));
  const seenIds = new Set();
  return items.slice(0, 12).map((item, i) => {
    let id = stringOr(item.id, "").replace(/\s+/g, "_");
    if (!id || seenIds.has(id)) id = `ai_finding_${i + 1}`;
    seenIds.add(id);
    const refs = item.evidence_record_indexes || item.evidenceRecordIndexes || item.record_indexes || item.evidence_records || [];
    const evidence = (Array.isArray(refs) ? refs : [])
      .map((n) => normalizedRecords[Number(n)])
      .filter(Boolean)
      .slice(0, 6)
      .map((record) => toEvidence(record));
    const text = stringOr(item.finding || item.statement, "");
    return {
      id,
      title: stringOr(item.title, "ממצא מהאינדקס"),
      category: normalizeCategory(item.category),
      severity: normalizeSeverity(item.severity),
      confidence: boundedConfidence(item.confidence),
      finding: text,
      statement: text,
      why_it_matters: stringOr(item.why_it_matters, ""),
      recommended_action: stringOr(item.recommended_action, ""),
      hashtags: normalizeRecordTags(item.hashtags),
      human_status: "new",
      ai_generated: true,
      evidence
    };
  }).filter((finding) => finding.finding || finding.evidence.length);
}

function parseInsightObject(content) {
  const obj = extractJsonObject(content);
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return { findings: obj.findings, insights: obj.insights };
  }
  const legacy = parseInsightJson(content);
  return { findings: [], insights: legacy?.insights };
}

// Returns null instead of throwing; also retries after stripping trailing commas,
// which some models emit even in JSON mode.
function tryParseInsightObject(content) {
  try {
    return parseInsightObject(content);
  } catch {
    try {
      const repaired = String(content || "").replace(/,\s*([}\]])/g, "$1");
      return parseInsightObject(repaired);
    } catch {
      return null;
    }
  }
}

export function parseInsightJson(content) {
  const raw = String(content || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || raw;
  const arrayStart = candidate.indexOf("[");
  const arrayEnd = candidate.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart && (candidate[0] === "[" || fenced)) {
    try {
      return { insights: JSON.parse(candidate.slice(arrayStart, arrayEnd + 1)) };
    } catch {
      // Continue with object extraction below.
    }
  }
  try {
    const parsed = extractJsonObject(candidate);
    return Array.isArray(parsed) ? { insights: parsed } : parsed;
  } catch (firstError) {
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      try {
        return { insights: JSON.parse(candidate.slice(arrayStart, arrayEnd + 1)) };
      } catch {
        // Fall through to the original parse error so the run log stays accurate.
      }
    }
    throw firstError;
  }
}

// Targets the top open-pattern clusters (unfulfilled commitment / persistent issue)
// with a hybrid search for closure or status-change evidence. Read-only, capped at
// 3 clusters; failures degrade to "no follow-up" without failing the run.
async function searchClosureEvidence({ config, pipeline, existingKeys, excludedKeys, dateFrom, dateTo, runId, emit }) {
  const openPatternClusterIds = [...new Set(pipeline.patterns
    .filter((item) => ["unfulfilled_commitment", "persistent_open_issue"].includes(item.type))
    .map((item) => item.cluster_id))];
  const targets = openPatternClusterIds
    .map((clusterId) => pipeline.clusters.find((cluster) => cluster.cluster_id === clusterId))
    .filter((cluster) => cluster && !cluster.closed)
    .sort((a, b) => b.evidence_ids.length - a.evidence_ids.length)
    .slice(0, 3);
  if (!targets.length) return { targets: 0, queries: [], records: [] };

  const queries = targets.map((cluster) => `${cluster.topic} סטטוס עדכני הושלם נסגר בוצע`);
  const found = [];
  for (const [index, cluster] of targets.entries()) {
    try {
      const rows = await hybridSearch({
        config,
        query: queries[index],
        dateFrom: cluster.last_date || dateFrom,
        dateTo,
        hashtags: cluster.hashtags,
        topK: 10
      });
      for (const row of Array.isArray(rows) ? rows : []) {
        const normalized = normalizeRecord(row, "hybrid");
        const key = sourceKey(normalized);
        if (!key || existingKeys.has(key) || excludedKeys.has(key)) continue;
        existingKeys.add(key);
        found.push(normalized);
      }
    } catch (error) {
      emit?.(runId, "closure_followup", `Closure follow-up search failed for ${cluster.topic}`, { error: error.message, status: "warning" });
    }
  }
  return { targets: targets.length, queries, records: found };
}

async function searchFocusRecords({ config, focusQuery, dateFrom, dateTo, activeHashtags = [], runId, emit }) {
  const query = String(focusQuery || "").trim();
  if (!query) return [];
  try {
    const rows = await hybridSearch({ config, query, dateFrom, dateTo, hashtags: activeHashtags, topK: 80 });
    return Array.isArray(rows) ? rows.map((row) => normalizeRecord(row, "hybrid")) : [];
  } catch (error) {
    emit?.(runId, "focus_retrieval_warning", "Hybrid focus search failed; using index scan only", { error: error.message, status: "warning" });
    return [];
  }
}

// Aggregates saved insight runs into cross-run quality metrics (phase-2 spec Task 6,
// plan section 17). Tolerates legacy rows without an observability object. Metrics
// that need human judgement (precision, hallucination rate) are intentionally absent.
export function aggregateInsightQualityMetrics(runs = []) {
  const rows = Array.isArray(runs) ? runs : [];
  const withObservability = [];
  let totalInsights = 0;
  let multiFindingInsights = 0;
  let insightsWithAction = 0;
  const rejectionReasons = {};
  const durations = [];

  for (const run of rows) {
    const observability = run?.observability || run?.metadata?.observability || run?.summary?.observability || null;
    if (observability) {
      withObservability.push(observability);
      for (const [reason, count] of Object.entries(observability.synthesis?.rejectionReasons || {})) {
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + Number(count || 0);
      }
      const started = Date.parse(observability.timing?.startedAt || "");
      const finished = Date.parse(observability.timing?.finishedAt || "");
      if (Number.isFinite(started) && Number.isFinite(finished) && finished >= started) durations.push(finished - started);
    }
    for (const insight of Array.isArray(run?.insights) ? run.insights : []) {
      totalInsights += 1;
      if ((insight?.supporting_finding_ids?.length || 0) >= 2) multiFindingInsights += 1;
      if (String(insight?.recommended_action || "").trim()) insightsWithAction += 1;
    }
  }

  const sum = (selector) => withObservability.reduce((acc, item) => acc + (Number(selector(item)) || 0), 0);
  const avg = (selector) => withObservability.length ? Number((sum(selector) / withObservability.length).toFixed(2)) : null;
  const findingsTotal = sum((item) => item.synthesis?.findings);
  const acceptedTotal = sum((item) => item.synthesis?.acceptedInsights);

  return {
    metrics_version: "insight-quality-metrics-v1",
    runs: rows.length,
    runs_with_observability: withObservability.length,
    avg_findings_per_run: avg((item) => item.synthesis?.findings),
    avg_accepted_insights_per_run: avg((item) => item.synthesis?.acceptedInsights),
    avg_rejected_insights_per_run: avg((item) => item.synthesis?.rejectedInsights),
    findings_to_accepted_ratio: findingsTotal ? Number((acceptedTotal / findingsTotal).toFixed(3)) : null,
    rejection_reasons: rejectionReasons,
    pct_insights_with_multiple_findings: totalInsights ? Number((multiFindingInsights / totalInsights).toFixed(3)) : null,
    pct_insights_with_recommended_action: totalInsights ? Number((insightsWithAction / totalInsights).toFixed(3)) : null,
    avg_run_duration_ms: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    total_insights: totalInsights
  };
}

export function detectProjectSignals(records = [], { focusQuery = "", activeHashtags = [] } = {}) {
  return detectProjectFindings(records, { focusQuery, activeHashtags });
}

export function detectProjectFindings(records = [], { focusQuery = "", activeHashtags = [] } = {}) {
  const normalized = records.map((record) => normalizeRecord(record)).filter((record) => record.text);
  const findings = SIGNALS.map((signal) => {
    const matches = normalized
      .map((record) => ({ record, score: scoreRecord(record, signal, focusQuery, activeHashtags) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (!matches.length) return null;
    const evidence = matches.map((item) => toEvidence(item.record, signal.terms));
    const hashtags = topHashtagsFromRecords(matches.map((item) => item.record), 8).map((item) => item.tag);
    const confidence = Math.min(0.92, 0.35 + evidence.length * 0.07 + matches.reduce((sum, item) => sum + item.score, 0) * 0.015);
    const text = buildFindingText(signal, evidence);
    return {
      id: `finding_${signal.id}`,
      signal_id: signal.id,
      title: signal.title,
      category: signal.category,
      severity: signal.severity,
      confidence: Number(confidence.toFixed(2)),
      hashtags,
      evidence,
      finding: text,
      statement: text,
      why_it_matters: buildWhyItMatters(signal),
      recommended_action: buildRecommendedAction(signal),
      human_status: "new"
    };
  }).filter(Boolean);

  return findings.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff) return severityDiff;
    return b.confidence - a.confidence;
  });
}

export function buildProjectInsightsWorkflowLog({ trace = [], summary = {}, insights = [], findings = [], toolContext = {}, pipeline = null, critic = null } = {}) {
  const pipelineStatus = pipeline ? "done" : "skipped";
  const nodes = [
    { id: "alerts_priming", label: "Alerts Priming", kind: "database", status: "done" },
    { id: "index_scan", label: "Index Scan", kind: "database", status: "done" },
    { id: "hashtag_analysis", label: "Hashtag Analysis", kind: "router", status: "done" },
    { id: "focus_retrieval", label: "Focus Retrieval", kind: "vector", status: "done" },
    { id: "evidence_normalization", label: "Evidence Normalizer", kind: "router", status: pipelineStatus },
    { id: "deduplication", label: "Deduplication", kind: "router", status: pipelineStatus },
    { id: "clustering_timeline", label: "Clustering + Timeline", kind: "router", status: pipelineStatus },
    { id: "analytics_engine", label: "Analytics Engine", kind: "router", status: pipelineStatus },
    { id: "pattern_detection", label: "Pattern Detection", kind: "router", status: pipelineStatus },
    { id: "closure_followup", label: "Closure Follow-up Search", kind: "vector", status: pipelineStatus },
    { id: "root_cause_hypotheses", label: "Root Cause Hypotheses", kind: "ai", status: trace.some((item) => item.step === "root_cause_hypotheses") ? "done" : "skipped" },
    { id: "graph_search", label: "Project Graph Search", kind: "database", status: nodeStatus(toolContext.toolCalls, "graph_search") },
    { id: "alert_agent", label: "Alert Agent", kind: "ai", status: nodeStatus(toolContext.toolCalls, "alert") },
    { id: "n8n_tools", label: "n8n Tool Adapters", kind: "tool", status: n8nNodeStatus(toolContext.n8nResults) },
    { id: "source_quality", label: "Source Quality", kind: "router", status: "done" },
    { id: "conflict_detection", label: "Conflict Detection", kind: "router", status: toolContext.conflicts?.length ? "error" : "done" },
    { id: "signal_detection", label: "Finding Detection", kind: "router", status: "done" },
    { id: "ai_synthesis", label: "AI Insight Synthesis", kind: "ai", status: "done" },
    { id: "insight_critic", label: "Insight Critic", kind: "router", status: pipelineStatus },
    { id: "insight_ranking", label: "Insight Ranking", kind: "router", status: "done" },
    { id: "insights_output", label: "Insights Output", kind: "output", status: "done" }
  ];
  const edges = [
    { from: "alerts_priming", to: "index_scan" },
    { from: "index_scan", to: "hashtag_analysis" },
    { from: "hashtag_analysis", to: "focus_retrieval" },
    { from: "focus_retrieval", to: "evidence_normalization" },
    { from: "evidence_normalization", to: "deduplication" },
    { from: "deduplication", to: "clustering_timeline" },
    { from: "clustering_timeline", to: "analytics_engine" },
    { from: "analytics_engine", to: "pattern_detection" },
    { from: "pattern_detection", to: "closure_followup" },
    { from: "closure_followup", to: "root_cause_hypotheses" },
    { from: "root_cause_hypotheses", to: "graph_search" },
    { from: "graph_search", to: "alert_agent" },
    { from: "alert_agent", to: "n8n_tools" },
    { from: "n8n_tools", to: "source_quality" },
    { from: "source_quality", to: "conflict_detection" },
    { from: "conflict_detection", to: "signal_detection" },
    { from: "signal_detection", to: "ai_synthesis" },
    { from: "ai_synthesis", to: "insight_critic" },
    { from: "insight_critic", to: "insight_ranking" },
    { from: "insight_ranking", to: "insights_output" }
  ];
  return {
    nodes,
    edges,
    nodeDetails: {
      alerts_priming: { summary: `${summary.alertDirection?.alertCount || 0} alerts, ${summary.alertDirection?.hashtags?.length || 0} themes`, output: summary.alertDirection || null, logs: trace.filter((item) => item.step === "alerts_priming") },
      index_scan: { summary: `${summary.totalRecords || 0} index records scanned`, logs: trace.filter((item) => item.step === "index_scan") },
      hashtag_analysis: { summary: `${summary.hashtagContext?.active?.length || 0} active hashtags`, output: summary.hashtagContext || null, logs: trace.filter((item) => item.step === "hashtag_analysis") },
      focus_retrieval: { summary: `Focus query: ${summary.focusQuery || "none"}`, logs: trace.filter((item) => item.step === "focus_retrieval" || item.step === "focus_retrieval_warning") },
      evidence_normalization: { summary: pipeline ? `${pipeline.evidence.length} evidence items normalized` : "Pipeline disabled", output: pipeline ? { evidence: pipeline.evidence.slice(0, 10), pipeline_version: pipeline.pipeline_version } : null, logs: trace.filter((item) => item.step === "evidence_normalization") },
      deduplication: { summary: pipeline ? `${pipeline.canonicalEvents.length} canonical events (${pipeline.evidence.length - pipeline.canonicalEvents.length} merged)` : "Pipeline disabled", output: pipeline ? pipeline.canonicalEvents.slice(0, 10) : null, logs: trace.filter((item) => item.step === "deduplication") },
      clustering_timeline: { summary: pipeline ? `${pipeline.clusters.length} topic clusters with timelines` : "Pipeline disabled", output: pipeline ? pipeline.clusters.slice(0, 8) : null, logs: trace.filter((item) => item.step === "clustering_timeline") },
      analytics_engine: { summary: pipeline ? `Deterministic metrics (${pipeline.analytics.analytics_version})` : "Pipeline disabled", output: pipeline ? pipeline.analytics : null, logs: trace.filter((item) => item.step === "analytics_engine") },
      pattern_detection: { summary: pipeline ? `${pipeline.patterns.length} candidate patterns` : "Pipeline disabled", output: pipeline ? pipeline.patterns : null, logs: trace.filter((item) => item.step === "pattern_detection") },
      closure_followup: { summary: pipeline ? "Search for later closure/status evidence on open patterns" : "Pipeline disabled", logs: trace.filter((item) => item.step === "closure_followup") },
      root_cause_hypotheses: { summary: "Inference-only causal hypotheses for the strongest patterns (feature-flagged)", logs: trace.filter((item) => item.step === "root_cause_hypotheses" || item.step === "trend_analysis") },
      graph_search: { summary: `${toolContext.graphContext?.length || 0} graph relationships returned`, output: toolContext.graphContext || [], logs: trace.filter((item) => item.step === "graph_search") },
      alert_agent: { summary: toolContext.alertResult ? `${toolContext.alertResult.resultsCount || 0} alert records checked` : "Alert Agent unavailable or skipped", output: toolContext.alertResult || null, logs: trace.filter((item) => item.step === "alert_agent") },
      n8n_tools: { summary: `${toolContext.n8nResults?.length || 0} project tools called`, output: compactToolResults(toolContext.toolCalls || []), logs: trace.filter((item) => item.step === "n8n_tools") },
      source_quality: { summary: toolContext.sourceQuality?.overall || "not scored", output: toolContext.sourceQuality || null, logs: trace.filter((item) => item.step === "source_quality") },
      conflict_detection: { summary: `${toolContext.conflicts?.length || 0} conflicts`, output: toolContext.conflicts || [], logs: trace.filter((item) => item.step === "conflict_detection") },
      signal_detection: { summary: `${findings.length || insights.length} findings detected`, logs: trace.filter((item) => item.step === "signal_detection") },
      ai_synthesis: { summary: "Synthesize insights from findings; deterministic fallback when AI is unavailable", logs: trace.filter((item) => item.step === "ai_synthesis" || item.step === "ai_synthesis_warning") },
      insight_critic: { summary: critic ? `${critic.accepted?.length ?? insights.length} accepted, ${critic.rejected?.length || 0} rejected (${critic.score_version || "no ranking"})` : "Pipeline disabled", output: critic ? { rejected: critic.rejected || [], score_version: critic.score_version } : null, logs: trace.filter((item) => item.step === "insight_critic") },
      insight_ranking: { summary: `${insights.length} insights linked to findings`, logs: trace.filter((item) => item.step === "insight_ranking") },
      insights_output: { summary: "Insights and supporting findings ready for review", logs: trace }
    },
    summary
  };
}

function nodeStatus(toolCalls = [], toolName) {
  const call = (toolCalls || []).find((item) => item.toolName === toolName);
  if (!call) return "skipped";
  if (call.skipped) return "skipped";
  return call.ok ? "done" : "error";
}

function n8nNodeStatus(results = []) {
  if (!results?.length) return "skipped";
  if (results.some((item) => item.ok)) return "done";
  if (results.some((item) => !item.skipped)) return "error";
  return "skipped";
}

function compactToolResults(toolCalls = []) {
  return (toolCalls || []).map((call) => ({
    toolName: call.toolName,
    ok: call.ok,
    skipped: call.skipped || false,
    error: call.error || null,
    sourceQuality: call.sourceQuality || null,
    preview: compactPreview(call.data)
  }));
}

function compactPreview(value) {
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.slice(0, 900);
}

function compactProjectToolContext(toolContext = {}) {
  return {
    graphContext: (toolContext.graphContext || []).slice(0, 8),
    alertResult: toolContext.alertResult ? {
      ok: toolContext.alertResult.ok,
      resultsCount: toolContext.alertResult.resultsCount || 0,
      answer: String(toolContext.alertResult.answer || "").slice(0, 1200)
    } : null,
    sourceQuality: toolContext.sourceQuality || null,
    conflicts: toolContext.conflicts || [],
    toolCalls: compactToolResults(toolContext.toolCalls || []),
    n8nResults: (toolContext.n8nResults || []).map((item) => ({
      toolName: item.toolName,
      ok: item.ok,
      skipped: item.skipped || false,
      error: item.error || null,
      sources: item.sources || []
    }))
  };
}

function normalizeAiInsights(items, findings) {
  if (!Array.isArray(items)) return [];
  const findingMap = new Map((findings || []).map((finding) => [finding.id, finding]));
  return items.slice(0, 8).map((item, index) => {
    const supportingIds = normalizeSupportingFindingIds(item.supporting_finding_ids || item.supportingFindingIds, findingMap);
    const insightText = stringOr(item.insight || item.finding, "");
    if (!insightText) return null;
    return {
      id: `ai_insight_${index + 1}`,
      title: stringOr(item.title, "תובנה מהפרויקט"),
      category: normalizeCategory(item.category),
      severity: normalizeSeverity(item.severity),
      confidence: boundedConfidence(item.confidence),
      insight: stringOr(item.insight || item.finding, ""),
      finding: stringOr(item.insight || item.finding, ""),
      why_it_matters: stringOr(item.why_it_matters, ""),
      recommended_action: stringOr(item.recommended_action, ""),
      uncertainty: stringOr(item.uncertainty, ""),
      status: normalizeInsightStatus(item.status),
      based_on_patterns: Array.isArray(item.based_on_patterns) ? item.based_on_patterns.map((id) => String(id || "").trim()).filter(Boolean).slice(0, 6) : [],
      supporting_finding_ids: supportingIds,
      human_status: "new",
      ai_generated: true,
      evidence: supportingIds.flatMap((id) => findingMap.get(id)?.evidence || []).slice(0, 6)
    };
  }).filter(Boolean);
}

function normalizeSupportingFindingIds(value, findingMap) {
  const ids = Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return [...new Set(ids.filter((id) => findingMap.has(id)))];
}

function summarizeProjectRecords(records, { focusQuery, dateFrom, dateTo }) {
  const sourceCounts = {};
  const dates = [];
  const topHashtags = topHashtagsFromRecords(records, 12);
  for (const record of records) {
    const normalized = normalizeRecord(record);
    const source = normalized.source_table || normalized.source || "unknown";
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    if (normalized.date) dates.push(normalized.date.slice(0, 10));
  }
  dates.sort();
  return {
    totalRecords: records.length,
    sourceCounts,
    topHashtags,
    dateFrom: dateFrom || dates[0] || null,
    dateTo: dateTo || dates.at(-1) || null,
    focusQuery: String(focusQuery || "").trim() || null
  };
}

function scoreRecord(record, signal, focusQuery, activeHashtags = []) {
  const text = record.text.toLowerCase();
  const termHits = signal.terms.reduce((count, term) => count + (text.includes(String(term).toLowerCase()) ? 1 : 0), 0);
  if (!termHits) return 0;
  const focus = String(focusQuery || "").trim().toLowerCase();
  const focusBonus = focus ? scoreFocusOverlap(text, focus) : 0;
  const hashtagBonus = hashtagOverlap(record.hashtags || record.tags, activeHashtags) * 1.25;
  const severityBonus = String(record.severity_or_risk || "").match(/high|critical|גבוה|קריטי/i) ? 2 : 0;
  return termHits + focusBonus + hashtagBonus + severityBonus;
}

function scoreFocusOverlap(text, focus) {
  if (!focus) return 0;
  if (text.includes(focus)) return 2;
  const textTokens = tokenizeFocusText(text);
  const focusTokens = tokenizeFocusText(focus);
  if (!textTokens.length || !focusTokens.length) return 0;
  const textTokenSet = new Set(textTokens);
  const textStemSet = new Set(textTokens.map(focusStem).filter(Boolean));
  let hits = 0;
  for (const token of new Set(focusTokens)) {
    const stem = focusStem(token);
    if (textTokenSet.has(token) || (stem && textStemSet.has(stem))) hits += 1;
  }
  const ratio = hits / Math.max(focusTokens.length, 1);
  return Math.min(3, hits * 0.55 + ratio * 1.4);
}

function tokenizeFocusText(value) {
  return String(value || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.map(normalizeFocusToken)
    .filter((token) => token.length >= 3 && !FOCUS_STOPWORDS.has(token)) || [];
}

function normalizeFocusToken(token) {
  let text = String(token || "").trim();
  if (/^[\u0590-\u05ff]+$/u.test(text) && text.length > 4) text = text.replace(/^[הווכלבמש]+/u, "");
  return text;
}

function focusStem(token) {
  const text = normalizeFocusToken(token);
  return text.length < 4 ? text : text.slice(0, 3);
}

function normalizeRecord(record = {}, source = "") {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const title = record.title || metadata.title || record.question || record.source_id || record.id || "";
  const summary = record.summary || record.content || record.answer || record.index_text || record.text || metadata.summary || "";
  const hashtags = normalizeRecordTags(record.tags || record.hashtags || metadata.hashtags || metadata.tags);
  const hashtagText = hashtags.map((tag) => `#${tag}`).join(" ");
  return {
    ...record,
    source,
    title,
    summary,
    date: record.primary_date || record.data_date || record.created_at || record.date || metadata.primary_date || null,
    // Dedicated ingestion fields when the index provides them (phase-2 spec Task 5);
    // the pipeline falls back to `date` for both when absent.
    event_date: record.event_date || metadata.event_date || null,
    document_date: record.document_date || metadata.document_date || null,
    source_table: record.source_table || metadata.source_table || record.table || source || "index",
    source_id: record.source_id || metadata.source_id || record.id || "",
    source_url: record.source_url || record.data_link || metadata.source_url || "",
    severity_or_risk: record.severity_or_risk || record.severity_level || metadata.severity_or_risk || "",
    tags: hashtags,
    hashtags,
    text: [title, summary, record.index_text, record.content, metadata.index_text, hashtagText].filter(Boolean).join(" ")
  };
}

function dedupeRecords(records) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const normalized = normalizeRecord(record);
    const key = sourceKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

export function projectInsightSourceKey(record = {}) {
  return sourceKey(record);
}

function sourceKey(record = {}) {
  const normalized = normalizeRecord(record);
  return [normalized.source_table, normalized.source_id, normalized.id, normalized.title]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(":");
}

function normalizeSourceKeySet(value = []) {
  const items = Array.isArray(value) ? value : [];
  return new Set(items.map((item) => String(item || "").trim()).filter(Boolean));
}

function normalizeRecordTags(value) {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]+/)
      : [];
  return [...new Set(input
    .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
    .filter(Boolean))];
}

function topHashtagsFromRecords(records = [], limit = 12) {
  const counts = new Map();
  for (const record of records || []) {
    const tags = normalizeRecord(record).hashtags;
    for (const tag of tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "he"))
    .slice(0, limit);
}

function hashtagOverlap(recordTags = [], activeHashtags = []) {
  const active = new Set(normalizeRecordTags(activeHashtags).map((tag) => tag.toLowerCase()));
  if (!active.size) return 0;
  return normalizeRecordTags(recordTags)
    .map((tag) => tag.toLowerCase())
    .filter((tag, index, all) => all.indexOf(tag) === index && active.has(tag))
    .length;
}

export function toProjectInsightEvidence(record = {}, terms = []) {
  const normalized = normalizeRecord(record);
  return {
    id: normalized.id || normalized.source_id || "",
    source_table: normalized.source_table,
    source_id: normalized.source_id,
    date: normalized.date,
    title: normalized.title || "מקור מהאינדקס",
    hashtags: normalized.hashtags,
    excerpt: excerptAroundTerm(normalized.text, terms),
    source_url: normalized.source_url || null
  };
}

const toEvidence = toProjectInsightEvidence;

function excerptAroundTerm(text = "", terms = []) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const lower = clean.toLowerCase();
  const termList = Array.isArray(terms) ? terms : [];
  const term = termList.find((item) => lower.includes(String(item).toLowerCase()));
  const index = term ? lower.indexOf(String(term).toLowerCase()) : 0;
  const start = Math.max(0, index - 90);
  const end = Math.min(clean.length, index + 210);
  return `${start > 0 ? "..." : ""}${clean.slice(start, end)}${end < clean.length ? "..." : ""}`;
}

function buildFindingText(signal, evidence) {
  const count = evidence.length;
  if (signal.id === "blockers") return `נמצאו ${count} מקורות באינדקס שמצביעים על חסמים, המתנות או עיכובים שכדאי לתעדף לבדיקה.`;
  if (signal.id === "approvals") return `נמצאו ${count} מקורות סביב אישורים או החלטות שיכולים להשפיע על התקדמות הפרויקט.`;
  if (signal.id === "missing_info") return `נמצאו ${count} מקורות שמרמזים על חוסרי מידע או פריטים פתוחים להשלמה.`;
  if (signal.id === "commercial") return `נמצאו ${count} מקורות עם אותות מסחריים, עלויות, חשבוניות או חריגות תקציב לבדיקה.`;
  return `נמצאו ${count} מקורות עם אותות איכות, בטיחות או חריגות ביצוע.`;
}

function buildWhyItMatters(signal) {
  if (signal.id === "blockers") return "חסמים חוזרים יכולים להסביר האטה בפרויקט ולכוון את הצוות לנקודות שדורשות טיפול מהיר.";
  if (signal.id === "approvals") return "אישורים והחלטות פתוחות הם צווארי בקבוק נפוצים בתיאום ובביצוע.";
  if (signal.id === "missing_info") return "מידע חסר מקשה על קבלת החלטות ועלול לגרום לעבודה כפולה או המתנה מיותרת.";
  if (signal.id === "commercial") return "אותות מסחריים מוקדמים עוזרים לזהות חריגות, כפילויות או נושאים שדורשים בדיקת מסמכים.";
  return "נושאי איכות ובטיחות דורשים מעקב קרוב כי הם יכולים להשפיע על ביצוע, אישורים וסדרי עדיפויות.";
}

function buildRecommendedAction(signal) {
  if (signal.id === "blockers") return "לפתוח את המקורות, לאשר מה עדיין פתוח, ולהגדיר בעל אחריות ותאריך יעד.";
  if (signal.id === "approvals") return "לבדוק מי הגורם המאשר ומה חסר כדי לסגור את ההחלטה.";
  if (signal.id === "missing_info") return "להשלים את המסמכים או לבקש הבהרה מהגורם הרלוונטי.";
  if (signal.id === "commercial") return "להצליב מול חשבוניות, הזמנות ושינויים לפני הסקת מסקנה.";
  return "להעביר לבדיקה מקצועית ולוודא שיש תיעוד מלא של הטיפול.";
}

function normalizeCategory(value) {
  const allowed = new Set(["blocker", "decision", "missing_info", "repeated_topic", "commercial", "quality_safety", "entity", "risk", "gap", "quality"]);
  const text = String(value || "").trim();
  return allowed.has(text) ? text : "repeated_topic";
}

function normalizeSeverity(value) {
  const text = String(value || "").toLowerCase();
  return ["high", "medium", "low"].includes(text) ? text : "medium";
}

function normalizeInsightStatus(value) {
  const text = String(value || "").toLowerCase().trim();
  return ["active", "requires_validation", "resolved"].includes(text) ? text : "active";
}

function boundedConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.55;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

function stringOr(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}
