// Executive Health Score (upgrade plan section 28, priority P10).
// Deterministic, versioned, explainable. Core rules the plan mandates:
// - missing data is never a healthy score (insufficient_data, not 100);
// - fewer than 2 valid dimensions => no overall score at all (not_computed);
// - critical events cap the score and surface as flags instead of averaging away;
// - the score is a summary tool only — it is never fed back as evidence for insights.

const SCORE_VERSION = "project-health-v1";
const MIN_DIMENSION_COVERAGE = 0.5;
const MIN_DIMENSION_EVIDENCE = 10;
const MIN_VALID_DIMENSIONS = 2;
const CRITICAL_CAP = 60;
const OVERDUE_CRITICAL_DAYS = 30;

export function computeHealthScore({ analytics = null, clusters = [], patterns = [], analysisWindow = null } = {}) {
  const base = {
    score_version: SCORE_VERSION,
    period: {
      from: analysisWindow?.from || analytics?.analysis_window?.from || null,
      to: analysisWindow?.to || analytics?.analysis_window?.to || null
    },
    change_from_previous_period: null
  };
  if (!analytics) {
    return { ...base, score: null, status: "not_computed", reason: "no_analytics", data_coverage: null, confidence: "none", subscores: {}, missing_dimensions: [], critical_flags: [] };
  }

  const coverage = metricValue(analytics.data_quality?.dated_evidence_ratio);
  const totalEvidence = metricValue(analytics.project_metrics?.total_evidence) || 0;
  const coverageOk = coverage != null && coverage >= MIN_DIMENSION_COVERAGE && totalEvidence >= MIN_DIMENSION_EVIDENCE;

  const patternCounts = patterns.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {});
  const subscores = {
    schedule: scheduleDimension(analytics, patternCounts, coverage, coverageOk),
    coordination: coordinationDimension(analytics, patternCounts, coverage, coverageOk),
    decision_velocity: decisionVelocityDimension(analytics, coverage, coverageOk),
    information_readiness: informationReadinessDimension(analytics)
  };

  const validDimensions = Object.entries(subscores).filter(([, dim]) => dim.score != null);
  const missingDimensions = Object.entries(subscores).filter(([, dim]) => dim.score == null).map(([name]) => name);

  const criticalFlags = detectCriticalFlags({ analytics, clusters, patterns });

  if (validDimensions.length < MIN_VALID_DIMENSIONS) {
    return {
      ...base,
      score: null,
      status: "not_computed",
      reason: "insufficient_valid_dimensions",
      data_coverage: coverage,
      confidence: "none",
      subscores,
      missing_dimensions: missingDimensions,
      critical_flags: criticalFlags
    };
  }

  let score = Math.round(validDimensions.reduce((sum, [, dim]) => sum + dim.score, 0) / validDimensions.length);
  let capped = false;
  if (criticalFlags.length && score > CRITICAL_CAP) {
    score = CRITICAL_CAP;
    capped = true;
  }
  const fullyCovered = coverage != null && coverage >= 0.75 && missingDimensions.length === 0;

  return {
    ...base,
    score,
    status: fullyCovered ? "calculated" : "provisional",
    data_coverage: coverage,
    confidence: fullyCovered ? "high" : (coverageOk ? "medium" : "low"),
    subscores,
    missing_dimensions: missingDimensions,
    critical_flags: criticalFlags,
    critical_cap_applied: capped
  };
}

function scheduleDimension(analytics, patternCounts, coverage, coverageOk) {
  const overdue = metricValue(analytics.project_metrics?.overdue_commitments);
  if (!coverageOk || overdue == null) return insufficientDimension(coverage);
  const unfulfilled = patternCounts.unfulfilled_commitment || 0;
  return dimension(100 - overdue * 15 - unfulfilled * 10, coverage);
}

function coordinationDimension(analytics, patternCounts, coverage, coverageOk) {
  const contradictions = metricValue(analytics.project_metrics?.contradictions);
  if (!coverageOk || contradictions == null) return insufficientDimension(coverage);
  const persistent = patternCounts.persistent_open_issue || 0;
  return dimension(100 - contradictions * 20 - persistent * 10, coverage);
}

function decisionVelocityDimension(analytics, coverage, coverageOk) {
  const oldestOpen = analytics.project_metrics?.oldest_open_cluster_age_days;
  if (!coverageOk || !oldestOpen || oldestOpen.status !== "calculated" || oldestOpen.value == null) {
    return insufficientDimension(coverage);
  }
  // Up to a week of open age is normal; every extra day costs 2 points.
  return dimension(100 - Math.max(0, oldestOpen.value - 7) * 2, coverage);
}

function informationReadinessDimension(analytics) {
  const dated = metricValue(analytics.data_quality?.dated_evidence_ratio);
  const sourced = metricValue(analytics.data_quality?.evidence_with_source_id_ratio);
  if (dated == null || sourced == null) return insufficientDimension(dated);
  return dimension(Math.round(100 * (dated * 0.5 + sourced * 0.5)), dated);
}

function detectCriticalFlags({ analytics, clusters, patterns }) {
  const flags = [];
  const safetyPattern = /בטיחות|safety|צו הפסקת עבודה|stop.?work/i;
  for (const pattern of patterns) {
    const cluster = clusters.find((item) => item.cluster_id === pattern.cluster_id);
    const clusterText = `${cluster?.topic || ""} ${(cluster?.hashtags || []).join(" ")}`;
    if (pattern.type === "contradiction" && safetyPattern.test(clusterText)) {
      flags.push({ flag: "safety_contradiction", cluster_id: pattern.cluster_id, topic: cluster?.topic || null });
    }
  }
  for (const [clusterId, metrics] of Object.entries(analytics.per_cluster || {})) {
    if (metrics.days_past_commitment != null && metrics.days_past_commitment > OVERDUE_CRITICAL_DAYS) {
      const cluster = clusters.find((item) => item.cluster_id === clusterId);
      flags.push({ flag: "commitment_overdue_30d", cluster_id: clusterId, topic: cluster?.topic || null, days_past_commitment: metrics.days_past_commitment });
    }
    if (metrics.latest_status !== "closed" && safetyPattern.test(clusters.find((item) => item.cluster_id === clusterId)?.topic || "") && metrics.age_days != null && metrics.age_days > 7) {
      flags.push({ flag: "open_safety_issue", cluster_id: clusterId, age_days: metrics.age_days });
    }
  }
  return flags;
}

function dimension(rawScore, coverage) {
  return { score: clamp(Math.round(rawScore)), coverage: coverage ?? null };
}

function insufficientDimension(coverage) {
  return { score: null, coverage: coverage ?? null, status: "insufficient_data" };
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function metricValue(metric) {
  if (!metric || metric.status === "insufficient_data") return null;
  return typeof metric.value === "number" ? metric.value : null;
}
