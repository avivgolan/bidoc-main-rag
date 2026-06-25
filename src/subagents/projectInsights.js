import { TOOL_NAMES } from "../config.js";
import { chatCompletion, extractJsonObject } from "../openrouter.js";
import { buildGraphSearchPayload, summarizeGraphContext } from "../projectGraph.js";
import { annotateToolCall, buildSourceQualitySummary, detectConflicts } from "../sourceQuality.js";
import { fetchTimelineEventPage, graphSearch, hybridSearch } from "../supabase.js";
import { callN8nTool } from "../tools.js";
import { runAlertAgent } from "./alert.js";

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
  const indexScan = await collectIndexRecords({ config, dateFrom: safeDateFrom, dateTo: safeDateTo, limit: boundedLimit, excludedKeys });
  step("index_scan", "Content index scanned", {
    records: indexScan.records.length,
    skipped: indexScan.skipped,
    dateFrom: safeDateFrom,
    dateTo: safeDateTo,
    limit: boundedLimit,
    expansion: Boolean(expansion)
  });

  const hybridRecords = await searchFocusRecords({ config, focusQuery, dateFrom: safeDateFrom, dateTo: safeDateTo, runId, emit });
  const filteredHybridRecords = filterExcludedRecords(hybridRecords, excludedKeys);
  step("focus_retrieval", "Focus retrieval completed", {
    focusQuery: focusQuery || null,
    records: filteredHybridRecords.length,
    skipped: hybridRecords.length - filteredHybridRecords.length
  });

  const records = dedupeRecords([...filteredHybridRecords, ...indexScan.records])
    .filter((record) => !excludedKeys.has(sourceKey(record)))
    .slice(0, boundedLimit);

  const toolContext = await runExistingProjectTools({
    config,
    query: String(focusQuery || "").trim() || DEFAULT_INSIGHTS_QUERY,
    records,
    dateFrom: safeDateFrom,
    dateTo: safeDateTo,
    runId,
    emit
  });

  const findings = detectProjectFindings(records, { focusQuery });
  step("signal_detection", "Project findings detected", {
    findings: findings.length,
    evidence: findings.reduce((sum, item) => sum + item.evidence.length, 0)
  });

  const summary = summarizeProjectRecords(records, { focusQuery, dateFrom: safeDateFrom, dateTo: safeDateTo });
  summary.excludedRecords = excludedKeys.size;
  summary.skippedRecords = indexScan.skipped + (hybridRecords.length - filteredHybridRecords.length);
  summary.expansion = Boolean(expansion);

  const insights = await synthesizeInsights({ config, records, findings, summary, focusQuery, toolContext, runId, emit });
  step("insight_ranking", "Insights synthesized from findings", {
    sourceTables: Object.keys(summary.sourceCounts).length,
    topSeverity: insights[0]?.severity || null,
    findings: findings.length,
    insights: insights.length,
    mode: insights.some((item) => item.ai_generated) ? "ai" : "heuristic"
  });

  const workflowLog = buildProjectInsightsWorkflowLog({ trace, summary, insights, findings, toolContext });
  return {
    ok: true,
    summary,
    findings,
    insights,
    toolContext: compactProjectToolContext(toolContext),
    recordsSample: records.slice(0, 12).map((record) => toEvidence(record)),
    scannedSourceKeys: records.map((record) => sourceKey(record)).filter(Boolean),
    hasMore: Boolean(indexScan.hasMore),
    workflowLog
  };
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
    .filter(() => toolsRuntime.enabled !== false)
    .slice(0, Number(toolsRuntime.parallelLimit || 6));

  emit?.(runId, "n8n_tools", "Calling existing project tools", { tools: n8nTools, status: n8nTools.length ? "running" : "skipped" });
  const n8nResults = await Promise.all(n8nTools.map((toolName) =>
    callN8nTool({ toolName, query, dateFrom, dateTo, sessionId: runId, config }).then((result) => {
      emit?.(runId, "n8n_tools", `Tool ${toolName} completed`, { ok: result.ok, skipped: result.skipped || false, error: result.error || null });
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

async function synthesizeInsights({ config, records, findings, summary, focusQuery, toolContext, runId, emit }) {
  if (!findings.length) return [];
  const fallbackInsights = buildDeterministicInsights({ findings });
  if (!config?.openRouterApiKey) return fallbackInsights;

  const candidateFindings = findings.slice(0, 12).map((finding) => ({
    id: finding.id,
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    confidence: finding.confidence,
    finding: finding.finding || finding.statement || "",
    evidence: (finding.evidence || []).slice(0, 4).map((item) => ({
      title: item.title,
      source_table: item.source_table,
      source_id: item.source_id,
      date: item.date,
      excerpt: item.excerpt
    }))
  }));
  const candidateRecords = records.slice(0, 40).map((record, index) => {
    const normalized = normalizeRecord(record);
    return {
      index,
      title: normalized.title,
      date: normalized.date,
      source_table: normalized.source_table,
      source_id: normalized.source_id,
      severity_or_risk: normalized.severity_or_risk,
      text: normalized.text.slice(0, 900)
    };
  });

  try {
    emit?.(runId, "ai_synthesis", "AI insight synthesis started", { findings: candidateFindings.length, records: candidateRecords.length, status: "running" });
    const content = await chatCompletion({
      apiKey: config.openRouterApiKey,
      model: config.models?.main || "openai/gpt-4o-mini",
      temperature: 0.15,
      maxTokens: 3600,
      timeoutMs: 90_000,
      responseFormat: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are an AI project insights agent for a construction project.",
            "Return ONLY valid JSON.",
            "Findings are evidence-backed observations. Insights must synthesize multiple findings into a meaningful project pattern, implication, risk, or opportunity.",
            "Do not simply rename or repeat a finding as an insight.",
            "Every insight must include supporting_finding_ids from the provided findings.",
            "Do not create a legal claim file. Do not make legal, entitlement, cost, or critical path conclusions.",
            "Use Hebrew for user-facing text.",
            "Schema: {\"insights\":[{\"title\":\"string\",\"category\":\"blocker|decision|missing_info|repeated_topic|commercial|quality_safety|entity\",\"severity\":\"high|medium|low\",\"confidence\":0.0,\"insight\":\"string\",\"why_it_matters\":\"string\",\"recommended_action\":\"string\",\"uncertainty\":\"string\",\"supporting_finding_ids\":[\"finding_id\"]}]}"
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            focusQuery: focusQuery || null,
            summary,
            findings: candidateFindings,
            records: candidateRecords,
            graphContext: toolContext?.graphContext || [],
            alertAgent: toolContext?.alertResult || null,
            toolResults: compactToolResults(toolContext?.toolCalls || []),
            sourceQuality: toolContext?.sourceQuality || null,
            conflicts: toolContext?.conflicts || []
          }, null, 2)
        }
      ]
    });
    const parsed = parseInsightJson(content);
    const aiInsights = normalizeAiInsights(parsed?.insights, findings);
    if (!aiInsights.length) return fallbackInsights;
    emit?.(runId, "ai_synthesis", "AI insight synthesis completed", { insights: aiInsights.length, status: "done" });
    return aiInsights;
  } catch (error) {
    emit?.(runId, "ai_synthesis_warning", "AI synthesis failed; using deterministic fallback", { error: error.message, status: "warning" });
    return fallbackInsights;
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

async function searchFocusRecords({ config, focusQuery, dateFrom, dateTo, runId, emit }) {
  const query = String(focusQuery || "").trim();
  if (!query) return [];
  try {
    const rows = await hybridSearch({ config, query, dateFrom, dateTo, topK: 80 });
    return Array.isArray(rows) ? rows.map((row) => normalizeRecord(row, "hybrid")) : [];
  } catch (error) {
    emit?.(runId, "focus_retrieval_warning", "Hybrid focus search failed; using index scan only", { error: error.message, status: "warning" });
    return [];
  }
}

export function detectProjectSignals(records = [], { focusQuery = "" } = {}) {
  return detectProjectFindings(records, { focusQuery });
}

export function detectProjectFindings(records = [], { focusQuery = "" } = {}) {
  const normalized = records.map((record) => normalizeRecord(record)).filter((record) => record.text);
  const findings = SIGNALS.map((signal) => {
    const matches = normalized
      .map((record) => ({ record, score: scoreRecord(record, signal, focusQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (!matches.length) return null;
    const evidence = matches.map((item) => toEvidence(item.record, signal.terms));
    const confidence = Math.min(0.92, 0.35 + evidence.length * 0.07 + matches.reduce((sum, item) => sum + item.score, 0) * 0.015);
    const text = buildFindingText(signal, evidence);
    return {
      id: `finding_${signal.id}`,
      signal_id: signal.id,
      title: signal.title,
      category: signal.category,
      severity: signal.severity,
      confidence: Number(confidence.toFixed(2)),
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

export function buildProjectInsightsWorkflowLog({ trace = [], summary = {}, insights = [], findings = [], toolContext = {} } = {}) {
  const nodes = [
    { id: "index_scan", label: "Index Scan", kind: "database", status: "done" },
    { id: "focus_retrieval", label: "Focus Retrieval", kind: "vector", status: "done" },
    { id: "graph_search", label: "Project Graph Search", kind: "database", status: nodeStatus(toolContext.toolCalls, "graph_search") },
    { id: "alert_agent", label: "Alert Agent", kind: "ai", status: nodeStatus(toolContext.toolCalls, "alert") },
    { id: "n8n_tools", label: "n8n Tool Adapters", kind: "tool", status: n8nNodeStatus(toolContext.n8nResults) },
    { id: "source_quality", label: "Source Quality", kind: "router", status: "done" },
    { id: "conflict_detection", label: "Conflict Detection", kind: "router", status: toolContext.conflicts?.length ? "error" : "done" },
    { id: "signal_detection", label: "Finding Detection", kind: "router", status: "done" },
    { id: "ai_synthesis", label: "AI Insight Synthesis", kind: "ai", status: "done" },
    { id: "insight_ranking", label: "Insight Ranking", kind: "router", status: "done" },
    { id: "insights_output", label: "Insights Output", kind: "output", status: "done" }
  ];
  const edges = [
    { from: "index_scan", to: "focus_retrieval" },
    { from: "focus_retrieval", to: "graph_search" },
    { from: "graph_search", to: "alert_agent" },
    { from: "alert_agent", to: "n8n_tools" },
    { from: "n8n_tools", to: "source_quality" },
    { from: "source_quality", to: "conflict_detection" },
    { from: "conflict_detection", to: "signal_detection" },
    { from: "signal_detection", to: "ai_synthesis" },
    { from: "ai_synthesis", to: "insight_ranking" },
    { from: "insight_ranking", to: "insights_output" }
  ];
  return {
    nodes,
    edges,
    nodeDetails: {
      index_scan: { summary: `${summary.totalRecords || 0} index records scanned`, logs: trace.filter((item) => item.step === "index_scan") },
      focus_retrieval: { summary: `Focus query: ${summary.focusQuery || "none"}`, logs: trace.filter((item) => item.step === "focus_retrieval" || item.step === "focus_retrieval_warning") },
      graph_search: { summary: `${toolContext.graphContext?.length || 0} graph relationships returned`, output: toolContext.graphContext || [], logs: trace.filter((item) => item.step === "graph_search") },
      alert_agent: { summary: toolContext.alertResult ? `${toolContext.alertResult.resultsCount || 0} alert records checked` : "Alert Agent unavailable or skipped", output: toolContext.alertResult || null, logs: trace.filter((item) => item.step === "alert_agent") },
      n8n_tools: { summary: `${toolContext.n8nResults?.length || 0} project tools called`, output: compactToolResults(toolContext.toolCalls || []), logs: trace.filter((item) => item.step === "n8n_tools") },
      source_quality: { summary: toolContext.sourceQuality?.overall || "not scored", output: toolContext.sourceQuality || null, logs: trace.filter((item) => item.step === "source_quality") },
      conflict_detection: { summary: `${toolContext.conflicts?.length || 0} conflicts`, output: toolContext.conflicts || [], logs: trace.filter((item) => item.step === "conflict_detection") },
      signal_detection: { summary: `${findings.length || insights.length} findings detected`, logs: trace.filter((item) => item.step === "signal_detection") },
      ai_synthesis: { summary: "Synthesize insights from findings; deterministic fallback when AI is unavailable", logs: trace.filter((item) => item.step === "ai_synthesis" || item.step === "ai_synthesis_warning") },
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
    if (!supportingIds.length) return null;
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

export function buildDeterministicInsights({ findings = [] } = {}) {
  if (findings.length < 2) return [];
  const bySignal = new Map(findings.map((finding) => [finding.signal_id || String(finding.id || "").replace(/^finding_/, ""), finding]));
  const plans = [
    {
      ids: ["blockers", "approvals"],
      title: "צוואר בקבוק סביב אישורים ותיאום",
      category: "blocker",
      severity: "high",
      insight: "הממצאים מצביעים על קשר בין חסמים או עיכובים לבין אישורים והחלטות פתוחות. זה מרמז על צוואר בקבוק תיאומי ולא רק על רשימת פריטים פתוחים.",
      why_it_matters: "כאשר אישורים פתוחים מופיעים יחד עם חסמים, הסיכון הוא שהעבודה תיתקע שוב גם אחרי טיפול נקודתי.",
      recommended_action: "לרכז את כל האישורים הפתוחים לפי גורם מאשר, להגדיר בעל אחריות ותאריך יעד לכל החלטה.",
      uncertainty: "נדרש לוודא מול המקורות אילו אישורים עדיין פתוחים בפועל."
    },
    {
      ids: ["blockers", "missing_info"],
      title: "חסמים שמוזנים ממידע חסר",
      category: "missing_info",
      severity: "high",
      insight: "הופעה משותפת של חסמים ומידע חסר מצביעה שהבעיה אינה רק ביצועית, אלא גם פער בנתונים או בהחלטות שמונע סגירה.",
      why_it_matters: "בלי השלמת המידע, טיפול בחסם עלול להיות זמני או לחזור שוב בהמשך.",
      recommended_action: "להפריד בין חסמים שניתן לפתור מיד לבין חסמים שתלויים במסמך, החלטה או הבהרה חסרה.",
      uncertainty: "הקשר בין החסמים למידע החסר דורש אימות מול המסמכים המקוריים."
    },
    {
      ids: ["commercial", "approvals"],
      title: "החלטות פתוחות עם משקל מסחרי",
      category: "commercial",
      severity: "medium",
      insight: "הממצאים מחברים בין נושאים מסחריים לבין אישורים או החלטות, ולכן חלק מההחלטות הפתוחות עלולות להשפיע גם על עלויות או הזמנות.",
      why_it_matters: "זה מאפשר לתעדף בדיקה של החלטות שיש להן משמעות כספית, ולא רק תפעולית.",
      recommended_action: "להצליב את ההחלטות הפתוחות מול הזמנות, חשבוניות ושינויים לפני סגירה.",
      uncertainty: "אין להסיק סכום או זכאות; נדרש אימות מול מסמכי מקור."
    },
    {
      ids: ["quality_safety", "blockers"],
      title: "איכות ובטיחות עלולות להפוך לחסם ביצוע",
      category: "quality_safety",
      severity: "high",
      insight: "כאשר אותות איכות או בטיחות מופיעים לצד חסמים, יש סיכון שהטיפול המקצועי יהפוך לגורם שמעכב המשך ביצוע.",
      why_it_matters: "נושאי איכות ובטיחות דורשים סגירה מתועדת כדי לא ליצור עצירה חוזרת או עבודה כפולה.",
      recommended_action: "לבדוק אילו ליקויים עדיין פתוחים, מי מאשר סגירה ומה התיעוד הנדרש.",
      uncertainty: "צריך לוודא אם הליקויים פתוחים או שכבר טופלו."
    }
  ];

  const output = [];
  for (const plan of plans) {
    const support = plan.ids.map((id) => bySignal.get(id)).filter(Boolean);
    if (support.length < 2) continue;
    output.push(insightFromPlan(plan, support, output.length));
  }
  if (!output.length && findings.length >= 2) {
    output.push(insightFromPlan({
      title: "דפוס רוחבי שדורש בדיקה ממוקדת",
      category: "repeated_topic",
      severity: findings.some((item) => item.severity === "high") ? "high" : "medium",
      insight: "כמה ממצאים בלתי תלויים מופיעים באותה סריקה, ולכן כדאי להתייחס אליהם כדפוס בדיקה ולא כרשימת משימות נפרדות.",
      why_it_matters: "חיבור הממצאים יכול לעזור לתעדף את הבדיקה הבאה ולמנוע טיפול נקודתי מדי.",
      recommended_action: "לעבור על הממצאים התומכים, לסמן אילו עדיין פתוחים, ואז להחליט מי בעל האחריות לכל קבוצה.",
      uncertainty: "הקשר בין הממצאים הוא ראשוני ומבוסס על אותות מהאינדקס."
    }, findings.slice(0, 3), output.length));
  }
  return output;
}

function insightFromPlan(plan, support, index) {
  const confidence = Math.min(0.9, 0.45 + support.length * 0.1 + support.reduce((sum, item) => sum + Number(item.confidence || 0), 0) * 0.08);
  return {
    id: `insight_${index + 1}`,
    title: plan.title,
    category: plan.category,
    severity: plan.severity,
    confidence: Number(confidence.toFixed(2)),
    insight: plan.insight,
    finding: plan.insight,
    why_it_matters: plan.why_it_matters,
    recommended_action: plan.recommended_action,
    uncertainty: plan.uncertainty,
    supporting_finding_ids: support.map((item) => item.id),
    human_status: "new",
    evidence: support.flatMap((item) => item.evidence || []).slice(0, 6)
  };
}

function summarizeProjectRecords(records, { focusQuery, dateFrom, dateTo }) {
  const sourceCounts = {};
  const dates = [];
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
    dateFrom: dateFrom || dates[0] || null,
    dateTo: dateTo || dates.at(-1) || null,
    focusQuery: String(focusQuery || "").trim() || null
  };
}

function scoreRecord(record, signal, focusQuery) {
  const text = record.text.toLowerCase();
  const termHits = signal.terms.reduce((count, term) => count + (text.includes(String(term).toLowerCase()) ? 1 : 0), 0);
  if (!termHits) return 0;
  const focus = String(focusQuery || "").trim().toLowerCase();
  const focusBonus = focus ? scoreFocusOverlap(text, focus) : 0;
  const severityBonus = String(record.severity_or_risk || "").match(/high|critical|גבוה|קריטי/i) ? 2 : 0;
  return termHits + focusBonus + severityBonus;
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
  return {
    ...record,
    source,
    title,
    summary,
    date: record.primary_date || record.data_date || record.created_at || record.date || metadata.primary_date || null,
    source_table: record.source_table || metadata.source_table || record.table || source || "index",
    source_id: record.source_id || metadata.source_id || record.id || "",
    source_url: record.source_url || record.data_link || metadata.source_url || "",
    severity_or_risk: record.severity_or_risk || record.severity_level || metadata.severity_or_risk || "",
    text: [title, summary, record.index_text, record.content, metadata.index_text].filter(Boolean).join(" ")
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

export function toProjectInsightEvidence(record = {}, terms = []) {
  const normalized = normalizeRecord(record);
  return {
    id: normalized.id || normalized.source_id || "",
    source_table: normalized.source_table,
    source_id: normalized.source_id,
    date: normalized.date,
    title: normalized.title || "מקור מהאינדקס",
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

function boundedConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.55;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

function stringOr(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}
