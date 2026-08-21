function roleStatus(role = {}) {
  const error = String(role?.error || "");
  if (!error) return "done";
  if (["not_run", "not_required", "not_requested", "disabled"].includes(error)) return "skipped";
  return "error";
}

function roleParameters(configuration = {}, roleName) {
  const role = configuration?.roles?.[roleName] || {};
  return {
    enabled: role.enabled === true,
    model: role.model || null,
    temperature: role.temperature ?? null,
    maxTokens: role.maxTokens ?? null,
    candidateLimit: role.candidateLimit ?? null,
    timeoutMs: configuration.timeoutMs ?? null,
    topP: roleName === "embedding" ? null : 1,
    frequencyPenalty: roleName === "embedding" ? null : 0,
    presencePenalty: roleName === "embedding" ? null : 0,
    responseFormat: roleName === "embedding" ? null : "json_object",
    promptHash: role.promptHash || null
  };
}

function compactCandidate(candidate = {}) {
  return {
    rank: candidate.rank ?? null,
    activityKey: candidate.activityKey || null,
    name: candidate.name || null,
    plannedStart: candidate.plannedStart || null,
    plannedFinish: candidate.plannedFinish || null,
    finalScore: candidate.finalScore ?? null,
    signals: candidate.signals || {},
    supportingEvidence: candidate.supportingEvidence || [],
    contradictingEvidence: candidate.contradictingEvidence || []
  };
}

export function buildScheduleActivityAssignmentWorkflowLog({
  result = {},
  configuration = {},
  scheduleMeta = {},
  taskCount = 0,
  openRouterUsage = { calls: [], totals: {} },
  trace = [],
  startedAt = null,
  finishedAt = null
} = {}) {
  const calls = Array.isArray(openRouterUsage?.calls) ? openRouterUsage.calls : [];
  const workflowRunId = result.workflowRunId || result.runId || null;
  const callsFor = (step) => calls.filter((call) => call.step === step);
  const filteredOut = result.status === "filtered_out";
  const node = (id, label, kind, status, input, output) => ({
    id,
    label,
    kind,
    status,
    input,
    output,
    ...(callsFor(id).length ? { openrouter: callsFor(id) } : {})
  });
  const roles = result.roles || {};
  const candidates = (result.candidates || []).slice(0, 8).map(compactCandidate);
  const nodes = [
    node("assignment_start", "Schedule Assignment Trigger", "trigger", "done", {
      projectId: result.projectId || null,
      scheduleProjectId: result.scheduleProjectId || null,
      sourceId: result.sourceId || null,
      commit: result.dryRun !== true,
      timeFilterEnabled: result.timeFilter?.enabled === true,
      engineVersion: result.engineVersion || null
    }, { workflowRunId, auditRunId: result.runId || null, startedAt }),
    node("assignment_alert", "Load Alert / Update", "database", "done", {
      sourceTable: "alerts",
      sourceId: result.sourceId || null
    }, result.event || {}),
    node("assignment_time_filter", "Time Relevance Filter", "router",
      result.timeFilter?.enabled ? roleStatus(roles.timeFilter) : "skipped",
      {
        enabled: result.timeFilter?.enabled === true,
        confidenceThreshold: configuration.timeFilterConfidenceThreshold ?? null,
        role: roleParameters(configuration, "timeFilter")
      }, result.timeFilter || { enabled: false, skipped: false }),
    node("assignment_schedule", "Load Active Gantt", "database", filteredOut ? "skipped" : "done", {
      sourceVersionId: scheduleMeta.sourceVersionId || null
    }, {
      taskCount,
      sourceVersionId: scheduleMeta.sourceVersionId || null,
      displayName: scheduleMeta.displayName || null,
      relevancyDate: scheduleMeta.relevancyDate || null
    }),
    node("assignment_audit_start", "Initialize Assignment Audit", "database", filteredOut ? "skipped" : result.auditPersisted ? "done" : "error", {
      runsTable: "schedule_activity_assignment_runs",
      thresholdSnapshot: configuration.autoAssignmentThreshold ?? null,
      marginSnapshot: configuration.minimumRunnerUpMargin ?? null
    }, {
      initialized: result.auditPersisted === true,
      auditRunId: result.runId || null
    }),
    node("assignment_extractor", "Event Extractor", "ai", filteredOut ? "skipped" : roleStatus(roles.extractor), {
      role: roleParameters(configuration, "extractor"),
      event: result.event || null
    }, {
      extractedEvent: result.extractedEvent || null,
      roleResult: roles.extractor || null
    }),
    node("assignment_candidates", "Candidate Retrieval & Scoring", "code", filteredOut ? "skipped" : "done", {
      tools: configuration.tools || {},
      weights: configuration.weights || {},
      maximumCandidates: configuration.maxCandidates ?? null,
      maximumJudgeCandidates: 5,
      event: result.extractedEvent || result.event || null
    }, {
      candidateCount: result.candidates?.length || 0,
      candidates
    }),
    node("assignment_embedding", "Semantic Embedding Search", "vector", filteredOut ? "skipped" : roleStatus(roles.embedding), {
      enabled: configuration.tools?.semantic === true,
      role: roleParameters(configuration, "embedding")
    }, roles.embedding || null),
    node("assignment_matcher", "Professional Activity Matcher", "ai", filteredOut ? "skipped" : roleStatus(roles.matcher), {
      role: roleParameters(configuration, "matcher"),
      candidateCount: candidates.length
    }, roles.matcher || null),
    node("assignment_validator", "Schedule Validator", "ai", filteredOut ? "skipped" : roleStatus(roles.validator), {
      role: roleParameters(configuration, "validator"),
      candidateCount: candidates.length
    }, roles.validator || null),
    node("assignment_judge", "Decision Judge", "ai", filteredOut ? "skipped" : roleStatus(roles.judge), {
      role: roleParameters(configuration, "judge"),
      nearThresholdRange: configuration.judgeNearThresholdRange ?? null,
      maximumJudgeCandidates: 5
    }, roles.judge || null),
    node("assignment_policy", "Safety & Auto-Assignment Gate", "router", filteredOut ? "skipped" : "done", {
      autoAssignmentEnabled: configuration.autoAssignmentEnabled === true,
      autoAssignmentThreshold: configuration.autoAssignmentThreshold ?? null,
      minimumRunnerUpMargin: configuration.minimumRunnerUpMargin ?? null,
      suggestionThreshold: configuration.suggestionThreshold ?? null,
      maxModelCalls: configuration.maxModelCalls ?? null
    }, result.decision || null),
    node("assignment_audit", "Persist Assignment Audit", "database", filteredOut ? "skipped" : result.auditPersisted ? "done" : "error", {
      runsTable: "schedule_activity_assignment_runs",
      candidatesTable: "schedule_activity_assignment_candidates"
    }, {
      persisted: result.auditPersisted === true,
      auditRunId: result.runId || null
    }),
    node("assignment_write", "Commit Activity Link", "database", result.assignment ? "done" : "skipped", {
      commitRequested: result.dryRun !== true,
      method: result.assignment ? "agent_auto" : null
    }, result.assignment || { assigned: false, reason: result.decision?.reason || null }),
    node("assignment_result", "Assignment Result", "output", "done", {
      workflowRunId,
      auditRunId: result.runId || null
    }, {
      status: result.status || null,
      selectedActivityKey: result.decision?.selectedActivityKey || null,
      selectedActivityName: result.decision?.selectedActivityName || null,
      confidence: result.decision?.confidence ?? null,
      margin: result.decision?.margin ?? null,
      warnings: result.warnings || [],
      finishedAt
    })
  ];
  const edges = [
    ["assignment_start", "assignment_alert"],
    ["assignment_alert", "assignment_time_filter"],
    ["assignment_time_filter", "assignment_schedule"],
    ["assignment_schedule", "assignment_audit_start"],
    ["assignment_audit_start", "assignment_extractor"],
    ["assignment_extractor", "assignment_candidates"],
    ["assignment_candidates", "assignment_embedding"],
    ["assignment_embedding", "assignment_matcher"],
    ["assignment_embedding", "assignment_validator"],
    ["assignment_matcher", "assignment_judge"],
    ["assignment_validator", "assignment_judge"],
    ["assignment_judge", "assignment_policy"],
    ["assignment_policy", "assignment_audit"],
    ["assignment_audit", "assignment_write"],
    ["assignment_write", "assignment_result"]
  ];
  return {
    kind: "schedule_activity_assignment",
    runId: workflowRunId,
    startedAt,
    finishedAt,
    nodes,
    edges: edges.map(([from, to]) => ({ from, to })),
    trace,
    openRouterUsage,
    configuration: {
      engineVersion: result.engineVersion || null,
      thresholds: {
        timeFilterConfidenceThreshold: configuration.timeFilterConfidenceThreshold ?? null,
        autoAssignmentThreshold: configuration.autoAssignmentThreshold ?? null,
        minimumRunnerUpMargin: configuration.minimumRunnerUpMargin ?? null,
        suggestionThreshold: configuration.suggestionThreshold ?? null
      },
      weights: configuration.weights || {},
      tools: configuration.tools || {},
      limits: {
        maximumCandidates: configuration.maxCandidates ?? null,
        maximumJudgeCandidates: 5,
        maxModelCalls: configuration.maxModelCalls ?? null,
        timeoutMs: configuration.timeoutMs ?? null
      },
      roles: Object.fromEntries(Object.keys(configuration.roles || {}).map((roleName) => [roleName, roleParameters(configuration, roleName)]))
    }
  };
}
