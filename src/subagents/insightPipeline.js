// Deterministic evidence pipeline for Project Insights.
// Sits between raw index/hybrid records and the AI synthesis step:
//   normalize -> dedupe (canonical events) -> cluster + timeline -> analytics -> patterns -> critic.
// No LLM calls, no I/O; same input + same reference date must return the same output.

const PIPELINE_VERSION = "insight-pipeline-v1";
const ANALYTICS_VERSION = "insights-analytics-v1";
const RANKING_VERSION = "insight-ranking-v1";
const TREND_VERSION = "insight-trend-v1";
const TREND_MIN_SAMPLE = 5;
const ANALYTICS_TIMEZONE = "Asia/Jerusalem";

const STATEMENT_RULES = [
  // Hebrew final letters: "הושלם" (final mem) is not a substring of "הושלמו", so both stems are listed.
  { type: "closure", status: "closed", pattern: /הושלם|הושלמ|הסתיים|הסתיימ|נסגר|טופל|completed|resolved|closed/i },
  { type: "commitment", status: "open", pattern: /התחייב|מתחייב|יסתיים עד|יושלם עד|לסיים עד|להשלים עד|יימסר עד|יבוצע עד|commitment|committed to/i },
  { type: "decision", status: "open", pattern: /הוחלט|החלטה|סוכם כי|סוכם ש|decided|decision/i },
  { type: "warning", status: "open", pattern: /אזהרה|התראה|סיכון|חשש|ליקוי בטיחות|warning|hazard/i },
  { type: "request", status: "open", pattern: /מבקש|מבקשים|נדרש להגיש|יש להגיש|בקשה ל|requested|request for/i },
  { type: "question", status: "open", pattern: /שאלה פתוחה|לא ברור|טרם ידוע|open question/i },
  { type: "estimate", status: "unknown", pattern: /צפי ל|הערכה|מוערך|צפוי ל|estimated|forecast/i },
  { type: "status_update", status: "in_progress", pattern: /בביצוע|בתהליך|בעבודה|עדיין|טרם הושלם|טרם בוצע|in progress|ongoing/i }
];

const OPEN_HINT = /עדיין|טרם|לא הושלם|לא בוצע|פתוח|ממתין|pending|open|waiting/i;
const NEGATED_CLOSURE = /(?:לא|טרם|אינו|איננו|not(?:\s+yet)?)\s+(?:הושלם|הושלמ|הסתיים|הסתיימ|נסגר|טופל|completed|resolved|closed)/i;
const DERIVED_SOURCE = /alert|summar|התראה|סיכום/i;
const SEVERITY_RANK = [
  { rank: 3, pattern: /critical|high|קריטי|גבוה|חמור/i },
  { rank: 2, pattern: /medium|בינוני/i },
  { rank: 1, pattern: /low|נמוך/i }
];
const HEBREW_PREFIXES = /^[הוכלבמש]+/u;
const TOKEN_STOPWORDS = new Set(["של", "עם", "את", "על", "לא", "זה", "זו", "או", "אם", "the", "and", "for", "not", "with", "from"]);

export function classifyEvidenceStatement(text = "") {
  const value = String(text || "");
  for (const rule of STATEMENT_RULES) {
    if (rule.pattern.test(value)) {
      // "לא הושלמו" / "טרם הסתיים" are open updates, not closures.
      if (rule.type === "closure" && NEGATED_CLOSURE.test(value)) {
        return { evidence_type: "status_update", status: "open" };
      }
      // "עדיין בביצוע" style texts are open work even when phrased as a status update.
      if (rule.type === "status_update") return { evidence_type: "status_update", status: "in_progress" };
      return { evidence_type: rule.type, status: rule.status };
    }
  }
  if (OPEN_HINT.test(value)) return { evidence_type: "reported_claim", status: "open" };
  return { evidence_type: "reported_claim", status: "unknown" };
}

// Extracts a committed/target date ("עד 18.6", "עד ה-2026-06-18", "by 18/6/2026").
// Year fallback uses the reference (event) date; a committed date far behind the
// reference is assumed to roll into the next year. Heuristic — documented in the gap analysis.
export function extractExpectedDate(text = "", referenceDate = null) {
  const value = String(text || "");
  const iso = value.match(/(?:עד|until|by)\s*(?:ה[-\s]?)?(\d{4}-\d{2}-\d{2})/i);
  if (iso) return iso[1];
  const dayMonth = value.match(/(?:עד|until|by)\s*(?:ה[-\s]?)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/i);
  if (!dayMonth) return null;
  const day = Number(dayMonth[1]);
  const month = Number(dayMonth[2]);
  if (!day || !month || day > 31 || month > 12) return null;
  const reference = parseDate(referenceDate);
  let year = dayMonth[3] ? Number(dayMonth[3]) : (reference ? reference.getUTCFullYear() : null);
  if (!year) return null;
  if (year < 100) year += 2000;
  let candidate = Date.UTC(year, month - 1, day);
  if (reference && !dayMonth[3] && candidate < reference.getTime() - 180 * 86400000) {
    candidate = Date.UTC(year + 1, month - 1, day);
  }
  return new Date(candidate).toISOString().slice(0, 10);
}

// records are expected in the normalized shape produced by projectInsights.normalizeRecord.
// entitiesByRef (optional): Map of "source_table:source_id" -> [{entity_id,label,kind}]
// from the Graph Entity Enrichment Agent.
export function buildInsightEvidence(records = [], { entitiesByRef = null } = {}) {
  return (Array.isArray(records) ? records : []).map((record, index) => {
    const subject = String(record.title || "").trim();
    const text = String(record.text || record.summary || "").replace(/\s+/g, " ").trim();
    const date = cleanDate(record.date);
    const classified = classifyEvidenceStatement(text || subject);
    const derived = DERIVED_SOURCE.test(String(record.source_table || "")) || record.source === "alert";
    const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const sourceRef = `${record.source_table || "index"}:${record.source_id || ""}`;
    return {
      source_ref: sourceRef,
      entities: entitiesByRef?.get(sourceRef) || [],
      evidence_id: `ev-${index + 1}`,
      record_key: recordKey(record),
      source_table: record.source_table || "index",
      source_id: record.source_id || "",
      source_url: record.source_url || null,
      // Dedicated ingestion fields win when present (phase-2 spec Task 5); most index
      // records still carry a single date, which then serves as both.
      event_date: cleanDate(record.event_date) || date,
      document_date: cleanDate(record.document_date) || date,
      subject,
      hashtags: Array.isArray(record.hashtags) ? record.hashtags : [],
      severity_or_risk: record.severity_or_risk || "",
      evidence_type: classified.evidence_type,
      status: classified.status,
      expected_date: extractExpectedDate(text || subject, date),
      text: text.slice(0, 500),
      lineage: {
        origin_type: derived ? "derived" : "primary",
        derived_from: derived ? String(metadata.source_id || metadata.document_id || "") || null : null
      }
    };
  }).filter((item) => item.subject || item.text);
}

// Merges duplicates and near-duplicates into canonical events. A summary/alert derived
// from the same origin never raises independent_source_count (plan tests 3 + 15).
export function dedupeInsightEvidence(evidence = []) {
  const groups = [];
  for (const item of evidence) {
    const stems = stemSet(`${item.subject} ${item.text}`);
    const match = groups.find((group) => sameCanonicalEvent(group, item, stems));
    if (match) {
      match.items.push(item);
      for (const stem of stems) match.stems.add(stem);
    } else {
      groups.push({ items: [item], stems });
    }
  }
  return groups.map((group, index) => {
    const items = [...group.items].sort((a, b) => compareDates(a.event_date, b.event_date));
    const primary = items.find((item) => item.lineage.origin_type === "primary") || items[0];
    const primaryKeys = new Set(items.filter((item) => item.lineage.origin_type === "primary").map((item) => item.record_key));
    const derivedOrigins = new Set(items
      .filter((item) => item.lineage.origin_type === "derived")
      .map((item) => item.lineage.derived_from)
      .filter(Boolean));
    return {
      canonical_event_id: `event-${index + 1}`,
      canonical_text: primary.text || primary.subject,
      subject: primary.subject,
      event_date: primary.event_date,
      evidence_type: primary.evidence_type,
      status: latestKnownStatus(items),
      expected_date: items.map((item) => item.expected_date).find(Boolean) || null,
      hashtags: uniqueTags(items.flatMap((item) => item.hashtags)),
      entities: uniqueEntities(items.flatMap((item) => item.entities || [])),
      severity_or_risk: primary.severity_or_risk,
      evidence_ids: items.map((item) => item.evidence_id),
      source_records: items.map((item) => item.record_key),
      independent_source_count: primaryKeys.size || Math.max(derivedOrigins.size, 1)
    };
  });
}

function sameCanonicalEvent(group, item, stems) {
  const sample = group.items[0];
  if (item.lineage.derived_from && group.items.some((existing) =>
    existing.record_key === item.lineage.derived_from
    || existing.source_id === item.lineage.derived_from
    || existing.lineage.derived_from === item.lineage.derived_from)) {
    return true;
  }
  const dateClose = !sample.event_date || !item.event_date
    || Math.abs(daysBetween(sample.event_date, item.event_date) ?? 99) <= 1;
  return dateClose && jaccard(group.stems, stems) >= 0.65;
}

// Groups canonical events into topic clusters and builds a chronological timeline
// per cluster, including latest status, closure, and contradiction detection.
// Real entities (graph enrichment) act as a merge booster like hashtags — but only
// alongside some topical overlap, so one contractor working two unrelated issues
// does not collapse them into one cluster. Hub entities (attached to many records)
// are never a merge signal.
export function clusterCanonicalEvents(canonicalEvents = [], { hubEntityIds = new Set() } = {}) {
  const events = [...canonicalEvents].sort((a, b) => compareDates(a.event_date, b.event_date));
  const clusters = [];
  for (const event of events) {
    const stems = stemSet(event.subject || event.canonical_text);
    const tags = new Set(event.hashtags.map((tag) => tag.toLowerCase()));
    const entityIds = new Set((event.entities || []).map((item) => item.entity_id).filter((id) => id && !hubEntityIds.has(id)));
    const match = clusters.find((cluster) => {
      const subjectOverlap = jaccard(cluster.stems, stems);
      const sharedTags = [...tags].filter((tag) => cluster.tags.has(tag)).length;
      const sharedEntities = [...entityIds].filter((id) => cluster.entityIds.has(id)).length;
      return subjectOverlap >= 0.45
        || sharedTags >= 2
        || ((sharedTags >= 1 || sharedEntities >= 1) && subjectOverlap >= 0.2);
    });
    if (match) {
      match.events.push(event);
      for (const stem of stems) match.stems.add(stem);
      for (const tag of tags) match.tags.add(tag);
      for (const id of entityIds) match.entityIds.add(id);
    } else {
      clusters.push({ events: [event], stems, tags, entityIds });
    }
  }
  return clusters.map((cluster, index) => {
    const timeline = cluster.events.map((event) => ({
      date: event.event_date,
      event_type: event.evidence_type,
      status: event.status,
      text: (event.canonical_text || "").slice(0, 240),
      canonical_event_id: event.canonical_event_id,
      evidence_ids: event.evidence_ids
    }));
    const dated = timeline.filter((entry) => entry.date);
    const latestStatus = latestKnownStatus(cluster.events.map((event) => ({ event_date: event.event_date, status: event.status })));
    const commitment = cluster.events.find((event) => event.evidence_type === "commitment" || event.expected_date);
    return {
      cluster_id: `cluster-${index + 1}`,
      topic: representativeTopic(cluster.events),
      hashtags: uniqueTags(cluster.events.flatMap((event) => event.hashtags)).slice(0, 6),
      entities: uniqueEntities(cluster.events.flatMap((event) => event.entities || [])).slice(0, 8),
      event_ids: cluster.events.map((event) => event.canonical_event_id),
      evidence_ids: cluster.events.flatMap((event) => event.evidence_ids),
      record_keys: [...new Set(cluster.events.flatMap((event) => event.source_records))],
      timeline,
      first_date: dated[0]?.date || null,
      last_date: dated.at(-1)?.date || null,
      latest_status: latestStatus,
      closed: latestStatus === "closed",
      contradiction: detectClusterContradiction(timeline),
      expected_date: commitment?.expected_date || null,
      commitment_event_id: commitment?.canonical_event_id || null,
      occurrence_count: new Set(dated.map((entry) => entry.date)).size || cluster.events.length,
      independent_source_count: Math.max(1, cluster.events.reduce((sum, event) => sum + event.independent_source_count, 0))
    };
  });
}

function detectClusterContradiction(timeline = []) {
  const dated = timeline.filter((entry) => entry.date);
  for (let i = 0; i < dated.length; i += 1) {
    if (dated[i].status !== "closed") continue;
    const later = dated.slice(i + 1).find((entry) => ["open", "in_progress"].includes(entry.status) && entry.date > dated[i].date);
    if (later) {
      return { type: "closed_then_open", closed_on: dated[i].date, reopened_on: later.date };
    }
    const sameDay = dated.find((entry) => entry !== dated[i] && entry.date === dated[i].date && ["open", "in_progress"].includes(entry.status));
    if (sameDay) {
      return { type: "conflicting_status_same_date", date: dated[i].date };
    }
  }
  return null;
}

// Deterministic metrics only. Missing data is null + insufficient_data, never zero.
export function computeInsightAnalytics({ clusters = [], evidence = [], analysisWindow = null, referenceDate = null } = {}) {
  const reference = resolveReferenceDate(analysisWindow, referenceDate);
  const openClusters = clusters.filter((cluster) => ["open", "in_progress"].includes(cluster.latest_status));
  const closedClusters = clusters.filter((cluster) => cluster.closed);
  const unknownClusters = clusters.filter((cluster) => cluster.latest_status === "unknown");
  const overdue = clusters.filter((cluster) => cluster.expected_date && !cluster.closed && cluster.expected_date < reference);

  const openAges = openClusters
    .map((cluster) => daysBetween(cluster.first_date, reference))
    .filter((value) => value != null);

  const datedEvidence = evidence.filter((item) => item.event_date).length;
  const withSourceId = evidence.filter((item) => item.source_id).length;
  const derivedCount = evidence.filter((item) => item.lineage.origin_type === "derived").length;

  const perCluster = {};
  for (const cluster of clusters) {
    perCluster[cluster.cluster_id] = {
      latest_status: cluster.latest_status,
      age_days: daysBetween(cluster.first_date, reference),
      days_past_commitment: cluster.expected_date && !cluster.closed
        ? Math.max(0, daysBetween(cluster.expected_date, reference) ?? 0)
        : null,
      occurrence_count: cluster.occurrence_count,
      independent_source_count: cluster.independent_source_count,
      contradiction: Boolean(cluster.contradiction)
    };
  }

  return {
    analytics_version: ANALYTICS_VERSION,
    analysis_window: {
      from: analysisWindow?.from || null,
      to: analysisWindow?.to || null,
      timezone: ANALYTICS_TIMEZONE
    },
    reference_date: reference,
    project_metrics: {
      total_evidence: metric(evidence.length, "total-evidence-v1"),
      canonical_events: metric(clusters.reduce((sum, cluster) => sum + cluster.event_ids.length, 0), "canonical-events-v1"),
      clusters: metric(clusters.length, "clusters-v1"),
      open_clusters: metric(openClusters.length, "open-clusters-v1"),
      closed_clusters: metric(closedClusters.length, "closed-clusters-v1"),
      unknown_status_clusters: metric(unknownClusters.length, "unknown-status-clusters-v1"),
      overdue_commitments: metric(overdue.length, "overdue-commitments-v1"),
      contradictions: metric(clusters.filter((cluster) => cluster.contradiction).length, "contradictions-v1"),
      oldest_open_cluster_age_days: openAges.length
        ? metric(Math.max(...openAges), "open-age-v1")
        : insufficientMetric("open-age-v1")
    },
    per_cluster: perCluster,
    trends: computeTrendAnalysis({ evidence, clusters, analysisWindow, referenceDate: reference }),
    data_quality: {
      dated_evidence_ratio: ratioMetric(datedEvidence, evidence.length, "dated-evidence-ratio-v1"),
      evidence_with_source_id_ratio: ratioMetric(withSourceId, evidence.length, "source-id-ratio-v1"),
      derived_source_ratio: ratioMetric(derivedCount, evidence.length, "derived-source-ratio-v1")
    }
  };
}

// Trend Analyzer — sub-component of the analytics engine, never a parallel pipeline.
// v1 baseline definition: the first half of the analysis window is the baseline period
// and the second half is the current period (both computed from the same evidence set,
// same formula version). Cross-window baselines (previous month etc.) require extra
// retrieval and are specified in docs/insight-agent-phase2-spec.md.
export function computeTrendAnalysis({ evidence = [], clusters = [], analysisWindow = null, referenceDate = null, baseline = null } = {}) {
  if (baseline) {
    return computeCrossWindowTrend({ evidence, clusters, analysisWindow, referenceDate, baseline });
  }
  const dated = evidence.filter((item) => item.event_date);
  const from = cleanDate(analysisWindow?.from) || dated.map((item) => item.event_date).sort()[0] || null;
  const to = resolveReferenceDate(analysisWindow, referenceDate);
  const spanDays = daysBetween(from, to);
  if (!from || !to || spanDays == null || spanDays < 2 || !dated.length) {
    return { trend_version: TREND_VERSION, status: "insufficient_data", metrics: [] };
  }
  const midpoint = addDays(from, Math.floor(spanDays / 2));
  const baselinePeriod = { from, to: midpoint };
  const current = { from: midpoint, to };
  const inPeriod = (date, period) => date && date >= period.from && date < (period === current ? nextDay(period.to) : period.to);

  const baselineEvidence = dated.filter((item) => inPeriod(item.event_date, baselinePeriod));
  const currentEvidence = dated.filter((item) => inPeriod(item.event_date, current));
  const sampleOk = baselineEvidence.length >= TREND_MIN_SAMPLE && currentEvidence.length >= TREND_MIN_SAMPLE;

  const openCount = (items) => items.filter((item) => ["open", "in_progress"].includes(item.status)).length;
  const closureCount = (items) => items.filter((item) => item.evidence_type === "closure").length;
  const newClusters = (period) => clusters.filter((cluster) => cluster.first_date && inPeriod(cluster.first_date, period)).length;

  // polarity: does an increase in the metric point at deterioration or improvement?
  const definitions = [
    { metric_id: "open_statements", baselineValue: openCount(baselineEvidence), currentValue: openCount(currentEvidence), increase_means: "deteriorating" },
    { metric_id: "closure_statements", baselineValue: closureCount(baselineEvidence), currentValue: closureCount(currentEvidence), increase_means: "improving" },
    { metric_id: "new_topics", baselineValue: newClusters(baselinePeriod), currentValue: newClusters(current), increase_means: "deteriorating" },
    { metric_id: "evidence_volume", baselineValue: baselineEvidence.length, currentValue: currentEvidence.length, increase_means: "neutral" }
  ];

  const metrics = definitions.map((definition) => {
    const absoluteChange = definition.currentValue - definition.baselineValue;
    const percentageChange = definition.baselineValue > 0
      ? Number(((absoluteChange / definition.baselineValue) * 100).toFixed(1))
      : null;
    const direction = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "stable";
    const assessment = !sampleOk || definition.increase_means === "neutral" || direction === "stable"
      ? (direction === "stable" ? "stable" : "unknown")
      : (direction === "up"
        ? definition.increase_means
        : (definition.increase_means === "deteriorating" ? "improving" : "deteriorating"));
    return {
      metric_id: definition.metric_id,
      metric_version: TREND_VERSION,
      baseline_period: { ...baselinePeriod, value: definition.baselineValue },
      current_period: { ...current, value: definition.currentValue },
      absolute_change: absoluteChange,
      percentage_change: percentageChange,
      direction,
      assessment,
      sample_status: sampleOk ? "valid" : "insufficient_sample",
      confidence: sampleOk ? (Math.abs(absoluteChange) >= 3 ? "high" : "medium") : "low"
    };
  });

  return {
    trend_version: TREND_VERSION,
    status: sampleOk ? "calculated" : "insufficient_sample",
    baseline_definition: "first_half_of_analysis_window",
    metrics
  };
}

// Cross-window mode (phase-2 spec Task 1): the baseline is a separately retrieved
// preceding window with its own evidence/clusters, computed with the same formula
// version. A material coverage difference invalidates the comparison rather than
// producing a false trend (plan section 27 validity conditions).
function computeCrossWindowTrend({ evidence, clusters, analysisWindow, referenceDate, baseline }) {
  const currentWindow = {
    from: cleanDate(analysisWindow?.from),
    to: resolveReferenceDate(analysisWindow, referenceDate)
  };
  const baselineWindow = { from: cleanDate(baseline.window?.from), to: cleanDate(baseline.window?.to) };
  if (!currentWindow.from || !currentWindow.to || !baselineWindow.from || !baselineWindow.to) {
    return { trend_version: TREND_VERSION, status: "insufficient_data", baseline_definition: "previous_window", metrics: [] };
  }

  const currentStats = periodStats(evidence, clusters);
  const baselineStats = periodStats(baseline.evidence || [], baseline.clusters || []);
  const sampleOk = baselineStats.volume >= TREND_MIN_SAMPLE && currentStats.volume >= TREND_MIN_SAMPLE;
  const coverageGap = baselineStats.datedRatio != null && currentStats.datedRatio != null
    ? Math.abs(baselineStats.datedRatio - currentStats.datedRatio)
    : null;
  const coverageMismatch = coverageGap != null && coverageGap > 0.25;
  const sampleStatus = coverageMismatch ? "coverage_mismatch" : (sampleOk ? "valid" : "insufficient_sample");

  const definitions = [
    { metric_id: "open_statements", baselineValue: baselineStats.open, currentValue: currentStats.open, increase_means: "deteriorating" },
    { metric_id: "closure_statements", baselineValue: baselineStats.closures, currentValue: currentStats.closures, increase_means: "improving" },
    { metric_id: "new_topics", baselineValue: baselineStats.clusters, currentValue: currentStats.clusters, increase_means: "deteriorating" },
    { metric_id: "evidence_volume", baselineValue: baselineStats.volume, currentValue: currentStats.volume, increase_means: "neutral" }
  ];

  const metrics = definitions.map((definition) => {
    const absoluteChange = definition.currentValue - definition.baselineValue;
    const direction = absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "stable";
    const trustworthy = sampleStatus === "valid" && definition.increase_means !== "neutral" && direction !== "stable";
    return {
      metric_id: definition.metric_id,
      metric_version: TREND_VERSION,
      baseline_period: { ...baselineWindow, value: definition.baselineValue, coverage: baselineStats.datedRatio },
      current_period: { ...currentWindow, value: definition.currentValue, coverage: currentStats.datedRatio },
      absolute_change: absoluteChange,
      percentage_change: definition.baselineValue > 0 ? Number(((absoluteChange / definition.baselineValue) * 100).toFixed(1)) : null,
      direction,
      assessment: !trustworthy
        ? (direction === "stable" ? "stable" : "unknown")
        : (direction === "up" ? definition.increase_means : (definition.increase_means === "deteriorating" ? "improving" : "deteriorating")),
      sample_status: sampleStatus,
      confidence: sampleStatus === "valid" ? (Math.abs(absoluteChange) >= 3 ? "high" : "medium") : "low"
    };
  });

  return {
    trend_version: TREND_VERSION,
    status: coverageMismatch ? "coverage_mismatch" : (sampleOk ? "calculated" : "insufficient_sample"),
    baseline_definition: "previous_window",
    coverage_gap: coverageGap,
    metrics
  };
}

function periodStats(evidence = [], clusters = []) {
  const dated = evidence.filter((item) => item.event_date);
  return {
    volume: evidence.length,
    open: evidence.filter((item) => ["open", "in_progress"].includes(item.status)).length,
    closures: evidence.filter((item) => item.evidence_type === "closure").length,
    clusters: clusters.length,
    datedRatio: evidence.length ? Number((dated.length / evidence.length).toFixed(3)) : null
  };
}

// Helper for callers that retrieve the baseline window themselves.
export function computeBaselineWindow(from, to) {
  const cleanFrom = cleanDate(from);
  const cleanTo = cleanDate(to);
  const span = daysBetween(cleanFrom, cleanTo);
  if (!cleanFrom || !cleanTo || span == null || span < 1) return null;
  return { from: addDays(cleanFrom, -span), to: cleanFrom };
}

// Explicit insight-pattern rules from the upgrade plan (section 6). Patterns are
// candidates for the synthesizer/critic, not insights by themselves.
export function detectInsightPatterns({ clusters = [], analytics = null, hubEntityIds = new Set() } = {}) {
  const reference = analytics?.reference_date || null;
  const patterns = [];

  // Dependency risk (plan section 6.5): two OPEN clusters sharing a real non-hub
  // entity. Always a lead to verify ("נדרש לבדוק האם"), never a confirmed blockage.
  const entityToOpenClusters = new Map();
  for (const cluster of clusters) {
    if (!["open", "in_progress"].includes(cluster.latest_status)) continue;
    for (const entity of cluster.entities || []) {
      if (!entity.entity_id || hubEntityIds.has(entity.entity_id)) continue;
      if (!entityToOpenClusters.has(entity.entity_id)) entityToOpenClusters.set(entity.entity_id, { entity, clusters: [] });
      entityToOpenClusters.get(entity.entity_id).clusters.push(cluster);
    }
  }
  let dependencyCount = 0;
  for (const { entity, clusters: linked } of entityToOpenClusters.values()) {
    if (linked.length < 2 || dependencyCount >= 5) continue;
    dependencyCount += 1;
    patterns.push(pattern("dependency_risk", linked[0], "medium", {
      entity: entity.label,
      entity_kind: entity.kind,
      cluster_ids: linked.map((cluster) => cluster.cluster_id),
      topics: linked.map((cluster) => cluster.topic).slice(0, 4)
    }, true));
  }

  for (const cluster of clusters) {
    if (cluster.expected_date && !cluster.closed) {
      const laterUpdate = cluster.timeline.find((entry) =>
        entry.date && entry.date > cluster.expected_date && ["open", "in_progress"].includes(entry.status));
      const pastDue = reference && cluster.expected_date < reference;
      if (laterUpdate || pastDue) {
        patterns.push(pattern("unfulfilled_commitment", cluster, laterUpdate ? "high" : "medium", {
          expected_date: cluster.expected_date,
          latest_status: cluster.latest_status,
          later_update_on: laterUpdate?.date || null
        }));
      }
    }
    const deterioration = detectSeverityDeterioration(cluster);
    if (deterioration) patterns.push(pattern("status_deterioration", cluster, "medium", deterioration));
    if (!cluster.closed && cluster.occurrence_count >= 3 && (daysBetween(cluster.first_date, cluster.last_date) ?? 0) >= 14) {
      patterns.push(pattern("persistent_open_issue", cluster, "high", {
        occurrences: cluster.occurrence_count,
        span_days: daysBetween(cluster.first_date, cluster.last_date)
      }));
    }
    if (cluster.contradiction) {
      patterns.push(pattern("contradiction", cluster, "medium", cluster.contradiction, true));
    }
    if (cluster.closed) {
      patterns.push(pattern("closure", cluster, "high", { closed_on: cluster.last_date }));
    }
  }
  return patterns;
}

function detectSeverityDeterioration(cluster) {
  const ranked = cluster.timeline
    .map((entry) => ({ date: entry.date, rank: severityRank(entry.text) }))
    .filter((entry) => entry.date && entry.rank != null);
  if (ranked.length < 2) return null;
  const first = ranked[0];
  const last = ranked.at(-1);
  if (last.rank > first.rank) {
    return { from_rank: first.rank, to_rank: last.rank, from_date: first.date, to_date: last.date };
  }
  return null;
}

// Post-LLM validation and ranking (plan sections 8-9). Rejects insights that have no
// identifiable supporting evidence, restate resolved topics, or duplicate one another.
export function critiqueAndRankInsights({ insights = [], findings = [], clusters = [], patterns = [], maxInsights = 5 } = {}) {
  const findingMap = new Map((findings || []).map((finding) => [finding.id, finding]));
  const clusterByRecordKey = new Map();
  for (const cluster of clusters) {
    for (const key of cluster.record_keys || []) clusterByRecordKey.set(key, cluster);
  }
  const activePatternClusters = new Set(patterns
    .filter((item) => ["unfulfilled_commitment", "status_deterioration", "persistent_open_issue"].includes(item.type))
    .map((item) => item.cluster_id));
  const contradictionClusters = new Set(patterns.filter((item) => item.type === "contradiction").map((item) => item.cluster_id));

  const rejected = [];
  const candidates = [];
  for (const insight of insights) {
    const supportingIds = Array.isArray(insight.supporting_finding_ids) ? insight.supporting_finding_ids : [];
    const supporting = supportingIds.map((id) => findingMap.get(id)).filter(Boolean);
    if (!supporting.length) {
      rejected.push(rejection(insight, "no_supporting_findings"));
      continue;
    }
    if (!supporting.some((finding) => Array.isArray(finding.evidence) && finding.evidence.length)) {
      rejected.push(rejection(insight, "findings_without_evidence"));
      continue;
    }
    const mappedClusters = mapInsightClusters(supporting, clusterByRecordKey);
    const mentionsClosure = /נסגר|נפתר|הושלם|הושלמ|הסתיים|הסתיימ|closure|resolved|closed/i.test(`${insight.title || ""} ${insight.insight || insight.finding || ""}`);
    if (mappedClusters.length && mappedClusters.every((cluster) => cluster.closed) && !mentionsClosure) {
      rejected.push(rejection(insight, "topic_already_resolved"));
      continue;
    }
    const hasContradiction = mappedClusters.some((cluster) => contradictionClusters.has(cluster.cluster_id));
    const patternBacked = mappedClusters.some((cluster) => activePatternClusters.has(cluster.cluster_id));
    const status = hasContradiction
      ? "requires_validation"
      : (mappedClusters.length && mappedClusters.every((cluster) => cluster.closed) ? "resolved" : (insight.status || "active"));
    const score = scoreInsight(insight, supporting, { patternBacked, hasContradiction });
    candidates.push({ ...insight, status, score, score_version: RANKING_VERSION, pattern_backed: patternBacked });
  }

  candidates.sort((a, b) => b.score - a.score);
  const accepted = [];
  for (const candidate of candidates) {
    const duplicate = accepted.find((existing) =>
      jaccard(stemSet(`${existing.title} ${existing.insight || existing.finding || ""}`), stemSet(`${candidate.title} ${candidate.insight || candidate.finding || ""}`)) >= 0.7);
    if (duplicate) {
      rejected.push(rejection(candidate, "duplicate_insight"));
      continue;
    }
    accepted.push(candidate);
  }
  return {
    accepted: accepted.slice(0, maxInsights),
    rejected: rejected.concat(accepted.slice(maxInsights).map((item) => rejection(item, "over_insight_limit"))),
    score_version: RANKING_VERSION
  };
}

function mapInsightClusters(supportingFindings, clusterByRecordKey) {
  const clusters = new Map();
  for (const finding of supportingFindings) {
    for (const evidence of finding.evidence || []) {
      const key = recordKey(evidence);
      const cluster = clusterByRecordKey.get(key);
      if (cluster) clusters.set(cluster.cluster_id, cluster);
    }
  }
  return [...clusters.values()];
}

function scoreInsight(insight, supporting, { patternBacked, hasContradiction }) {
  const severityWeight = { high: 40, medium: 25, low: 10 }[insight.severity] ?? 20;
  const confidence = Number.isFinite(Number(insight.confidence)) ? Number(insight.confidence) : 0.5;
  const evidenceCount = supporting.reduce((sum, finding) => sum + (finding.evidence?.length || 0), 0);
  return Math.round(
    severityWeight
    + confidence * 20
    + Math.min(supporting.length, 3) * 8
    + Math.min(evidenceCount, 4) * 2
    + (patternBacked ? 10 : 0)
    - (hasContradiction ? 8 : 0)
  );
}

export function runInsightEvidencePipeline({ records = [], analysisWindow = null, referenceDate = null, entityLinks = [] } = {}) {
  const entitiesByRef = new Map();
  for (const link of Array.isArray(entityLinks) ? entityLinks : []) {
    if (!link?.record_ref || !link?.entity_id) continue;
    if (!entitiesByRef.has(link.record_ref)) entitiesByRef.set(link.record_ref, []);
    entitiesByRef.get(link.record_ref).push({ entity_id: link.entity_id, label: link.label || link.entity_id, kind: link.kind || "entity" });
  }
  const evidence = buildInsightEvidence(records, { entitiesByRef: entitiesByRef.size ? entitiesByRef : null });
  const hubEntityIds = computeHubEntities(evidence, 6);
  const canonicalEvents = dedupeInsightEvidence(evidence);
  const clusters = clusterCanonicalEvents(canonicalEvents, { hubEntityIds });
  const analytics = computeInsightAnalytics({ clusters, evidence, analysisWindow, referenceDate });
  const patterns = detectInsightPatterns({ clusters, analytics, hubEntityIds });
  return {
    pipeline_version: PIPELINE_VERSION,
    evidence,
    canonicalEvents,
    clusters,
    analytics,
    patterns,
    entityStats: { links: (entityLinks || []).length, matchedRecords: entitiesByRef.size, hubs: hubEntityIds.size }
  };
}

// An entity attached to more than `limit` distinct records behaves like a stopword
// (e.g. the project company itself) — excluded from merging and dependency signals.
function computeHubEntities(evidence = [], limit = 6) {
  const refsByEntity = new Map();
  for (const item of evidence) {
    for (const entity of item.entities || []) {
      if (!refsByEntity.has(entity.entity_id)) refsByEntity.set(entity.entity_id, new Set());
      refsByEntity.get(entity.entity_id).add(item.source_ref);
    }
  }
  return new Set([...refsByEntity.entries()].filter(([, refs]) => refs.size > limit).map(([id]) => id));
}

function uniqueEntities(entities = []) {
  const seen = new Map();
  for (const entity of entities) {
    if (entity?.entity_id && !seen.has(entity.entity_id)) seen.set(entity.entity_id, entity);
  }
  return [...seen.values()];
}

// Compact, JSON-safe context for the AI synthesis payload — clusters with timelines,
// deterministic analytics, and candidate patterns instead of raw record dumps only.
export function buildInsightAiContext(pipeline = null) {
  if (!pipeline) return null;
  const clusters = [...pipeline.clusters]
    .sort((a, b) => b.evidence_ids.length - a.evidence_ids.length)
    .slice(0, 12)
    .map((cluster) => ({
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
      timeline: cluster.timeline.slice(-6)
    }));
  return {
    pipeline_version: pipeline.pipeline_version,
    evidence_clusters: clusters,
    analytics_context: pipeline.analytics,
    candidate_patterns: pipeline.patterns.map((item) => ({
      pattern_id: item.pattern_id,
      type: item.type,
      cluster_id: item.cluster_id,
      confidence: item.confidence,
      requires_validation: item.requires_validation,
      details: item.details
    }))
  };
}

function pattern(type, cluster, confidence, details, requiresValidation = false) {
  return {
    pattern_id: `pattern-${type}-${cluster.cluster_id}`,
    type,
    cluster_id: cluster.cluster_id,
    evidence_ids: cluster.evidence_ids,
    confidence,
    requires_validation: requiresValidation || confidence !== "high",
    details
  };
}

function rejection(insight, reason) {
  return { id: insight.id || null, title: insight.title || "", reason };
}

function metric(value, version) {
  return { value, status: "calculated", metric_version: version };
}

function insufficientMetric(version) {
  return { value: null, status: "insufficient_data", metric_version: version };
}

function ratioMetric(numerator, denominator, version) {
  if (!denominator) return { value: null, numerator, denominator, status: "insufficient_data", metric_version: version };
  return { value: Number((numerator / denominator).toFixed(3)), numerator, denominator, status: "calculated", metric_version: version };
}

function resolveReferenceDate(analysisWindow, referenceDate) {
  const today = cleanDate(referenceDate) || new Date().toISOString().slice(0, 10);
  const windowTo = cleanDate(analysisWindow?.to);
  return windowTo && windowTo < today ? windowTo : today;
}

function latestKnownStatus(items = []) {
  const dated = items
    .filter((item) => item.status && item.status !== "unknown")
    .sort((a, b) => compareDates(a.event_date, b.event_date));
  return dated.at(-1)?.status || "unknown";
}

function representativeTopic(events = []) {
  const withEvidence = [...events].sort((a, b) => b.evidence_ids.length - a.evidence_ids.length);
  return withEvidence[0]?.subject || withEvidence[0]?.canonical_text?.slice(0, 80) || "נושא ללא כותרת";
}

function severityRank(text = "") {
  for (const item of SEVERITY_RANK) {
    if (item.pattern.test(String(text || ""))) return item.rank;
  }
  return null;
}

function recordKey(record = {}) {
  return [record.source_table, record.source_id, record.id, record.title]
    .filter(Boolean)
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(":");
}

function uniqueTags(tags = []) {
  return [...new Set(tags.map((tag) => String(tag || "").trim()).filter(Boolean))];
}

function stemSet(text = "") {
  const tokens = String(text || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
  const stems = new Set();
  for (const token of tokens) {
    let value = token;
    if (/^[֐-׿]+$/u.test(value) && value.length > 4) value = value.replace(HEBREW_PREFIXES, "");
    if (value.length < 3 || TOKEN_STOPWORDS.has(value)) continue;
    stems.add(value.length > 4 ? value.slice(0, 4) : value);
  }
  return stems;
}

function jaccard(setA, setB) {
  if (!setA?.size || !setB?.size) return 0;
  let shared = 0;
  for (const item of setA) if (setB.has(item)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

function cleanDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function parseDate(value) {
  const clean = cleanDate(value);
  return clean ? new Date(`${clean}T00:00:00Z`) : null;
}

function compareDates(a, b) {
  const left = cleanDate(a) || "9999-12-31";
  const right = cleanDate(b) || "9999-12-31";
  return left < right ? -1 : left > right ? 1 : 0;
}

function daysBetween(from, to) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addDays(date, days) {
  const parsed = parseDate(date);
  if (!parsed) return null;
  return new Date(parsed.getTime() + days * 86400000).toISOString().slice(0, 10);
}

function nextDay(date) {
  return addDays(date, 1);
}
