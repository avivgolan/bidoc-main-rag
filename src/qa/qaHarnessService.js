import crypto from "node:crypto";
import { runChatPipeline } from "../agent.js";
import { getConfig } from "../config.js";
import { completeRun, createRun, failRun, getRunEvents } from "../runLog.js";
import {
  DEFAULT_EVALUATION_PROFILE,
  QA_DEFAULT_PROFILE,
  QA_EVALUATOR_VERSION,
  QA_ROLES,
  QaServiceError,
  assertProjectAccess,
  boundedInteger,
  enforceWorkloadBudget,
  normalizeContext,
  normalizeQaError,
  optionalString,
  requireRole,
  requiredId,
  requiredString,
  safeErrorMessage,
  validateAddCasesInput,
  validateBudget,
  validateCreateSuiteInput,
  validateExpectedBehavior,
  validateIdempotencyKey
} from "./contracts.js";
import { evaluateCaseRun } from "./evaluator.js";
import { taxonomyFor } from "./failureTaxonomy.js";
import { SupabaseQaRepository } from "./supabaseQaRepository.js";
import { normalizeCaseExecution } from "./traceCollector.js";

const DEFAULT_POLICY = Object.freeze({
  maxCases: 100,
  maxParallel: 4,
  maxRepeats: 3,
  maxEstimatedCost: 20,
  estimatedCostPerCase: 0.05
});

export class QaHarnessService {
  constructor({
    repository = new SupabaseQaRepository(),
    pipeline = runChatPipeline,
    configProvider = getConfig,
    semanticJudge,
    policy = {},
    scheduler = (task) => setImmediate(task)
  } = {}) {
    this.repository = repository;
    this.pipeline = pipeline;
    this.configProvider = configProvider;
    this.semanticJudge = semanticJudge;
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.scheduler = scheduler;
    this.activeRuns = new Map();
  }

  async createTestSuite(rawContext, input) {
    const context = normalizeContext(rawContext);
    requireRole(context, QA_ROLES.OPERATOR);
    const data = validateCreateSuiteInput(input);
    const projectId = assertProjectAccess(context, data.project_id, { optional: true });
    const existing = await this.repository.findSuiteByIdempotency({
      organizationId: context.organizationId,
      actorId: context.actorId,
      idempotencyKey: data.idempotency_key
    });
    if (existing) return suiteSummary(existing, { idempotentReplay: true });
    try {
      const suite = await this.repository.createSuite({
        organization_id: context.organizationId,
        project_id: projectId,
        name: data.name,
        description: data.description,
        domain: data.domain,
        status: "draft",
        is_regression: data.is_regression,
        is_golden: false,
        tags: data.tags,
        created_by: context.actorId,
        idempotency_key: data.idempotency_key
      });
      return suiteSummary(suite);
    } catch (error) {
      const replay = await this.repository.findSuiteByIdempotency({
        organizationId: context.organizationId,
        actorId: context.actorId,
        idempotencyKey: data.idempotency_key
      }).catch(() => null);
      if (replay) return suiteSummary(replay, { idempotentReplay: true });
      throw error;
    }
  }

  async getTestSuite(rawContext, input) {
    const context = normalizeContext(rawContext);
    requireRole(context, QA_ROLES.VIEWER);
    const suiteId = requiredId(input?.suite_id || input?.suiteId, "suite_id");
    const suite = await this.#requireSuite(context, suiteId);
    assertStoredProjectAccess(context, suite.project_id);
    const includeCases = Boolean(input?.include_cases);
    if (!includeCases) return { suite: suiteSummary(suite), cases: null, pagination: null };
    const limit = boundedInteger(input?.limit ?? 50, "limit", 1, 100);
    const offset = decodeCursor(input?.cursor);
    const allCases = await this.repository.listCases({ organizationId: context.organizationId, suiteId });
    const items = allCases.slice(offset, offset + limit).map(caseSummary);
    return {
      suite: suiteSummary(suite),
      cases: items,
      pagination: {
        count: items.length,
        total: allCases.length,
        next_cursor: offset + limit < allCases.length ? encodeCursor(offset + limit) : null
      }
    };
  }

  async addTestCases(rawContext, input) {
    const context = normalizeContext(rawContext);
    requireRole(context, QA_ROLES.OPERATOR);
    const data = validateAddCasesInput(input);
    const suite = await this.#requireSuite(context, data.suite_id);
    assertStoredProjectAccess(context, suite.project_id);
    if (suite.status === "deprecated") {
      throw new QaServiceError("SUITE_DEPRECATED", "Cannot add cases to a deprecated suite", { status: 409 });
    }
    const result = { created: 0, updated: 0, rejected: 0, validation_errors: 0, cases: [] };
    for (const testCase of data.cases) {
      const existing = await this.repository.findCaseByKey({
        organizationId: context.organizationId,
        suiteId: suite.id,
        caseKey: testCase.case_key
      });
      const row = {
        question: testCase.question,
        expected_behavior: testCase.expected_behavior,
        tags: testCase.tags,
        priority: testCase.priority,
        origin: testCase.origin,
        is_golden: false,
        is_critical: testCase.is_critical,
        enabled: testCase.enabled,
        created_by: existing?.created_by || context.actorId,
        last_idempotency_key: data.idempotency_key
      };
      if (existing) {
        const samePayload = casePayloadMatches(existing, row);
        if (existing.last_idempotency_key === data.idempotency_key) {
          if (!samePayload) {
            throw new QaServiceError("IDEMPOTENCY_CONFLICT", "idempotency_key was already used with different case data", {
              status: 409,
              details: { case_key: existing.case_key }
            });
          }
          result.cases.push({ id: existing.id, case_key: existing.case_key, action: "replayed", version: existing.version });
          continue;
        }
        if (samePayload) {
          result.cases.push({ id: existing.id, case_key: existing.case_key, action: "unchanged", version: existing.version });
          continue;
        }
        const updated = await this.repository.updateCase({
          organizationId: context.organizationId,
          caseId: existing.id,
          patch: { ...row, version: Number(existing.version || 1) + 1 }
        });
        result.updated += 1;
        result.cases.push({ id: updated.id, case_key: updated.case_key, action: "updated", version: updated.version });
      } else {
        const created = await this.repository.createCase({
          organization_id: context.organizationId,
          suite_id: suite.id,
          case_key: testCase.case_key,
          version: 1,
          ...row
        });
        result.created += 1;
        result.cases.push({ id: created.id, case_key: created.case_key, action: "created", version: created.version });
      }
    }
    return result;
  }

  async runQuery(rawContext, input) {
    const context = normalizeContext(rawContext);
    requireRole(context, QA_ROLES.OPERATOR);
    const question = requiredString(input?.question, "question", 8000);
    const projectId = assertProjectAccess(context, input?.project_id || input?.projectId, { optional: true });
    const idempotencyKey = validateIdempotencyKey(input?.idempotency_key);
    const expected = validateExpectedBehavior(input?.expected_behavior || input?.expectedBehavior || {});
    const budget = validateBudget(input?.budget || {}, this.policy);
    enforceWorkloadBudget({ caseCount: 1, repeatEach: 1, parallelism: 1, budget });
    validatePhase1ConfigReference(input?.config_reference || input?.configReference || "production");

    const existing = await this.repository.findRunByIdempotency({
      organizationId: context.organizationId,
      actorId: context.actorId,
      idempotencyKey
    });
    if (existing) return this.#runQueryResult(context, existing, true);

    const run = await this.repository.createRun({
      suite_id: null,
      run_type: "manual",
      status: "running",
      config_snapshot_id: null,
      candidate_id: null,
      organization_id: context.organizationId,
      project_id: projectId,
      data_snapshot_at: new Date().toISOString(),
      corpus_version: null,
      repeat_each: 1,
      options: { expected_behavior: expected, capture: input?.capture || {}, isolated_session: true },
      summary: {},
      usage_metrics: {},
      estimated_cost: budget.estimated_cost_per_case,
      idempotency_key: idempotencyKey,
      created_by: context.actorId,
      started_at: new Date().toISOString()
    });

    await this.#executeAndPersist({ context, run, testCase: null, question, expectedBehavior: expected, repetition: 1 });
    await this.#finalizeRun(context, run.id, { undispatched: 0 });
    const completed = await this.repository.getRun({ organizationId: context.organizationId, runId: run.id });
    return this.#runQueryResult(context, completed, false);
  }

  async runTestSuite(rawContext, input) {
    const context = normalizeContext(rawContext);
    requireRole(context, QA_ROLES.OPERATOR);
    const suiteId = requiredId(input?.suite_id || input?.suiteId, "suite_id");
    const idempotencyKey = validateIdempotencyKey(input?.idempotency_key);
    const suite = await this.#requireSuite(context, suiteId);
    const selectedProjectId = input?.project_id || input?.projectId || suite.project_id || context.currentProjectId;
    const projectId = assertProjectAccess(context, selectedProjectId, { optional: true });
    if (suite.project_id && projectId && suite.project_id !== projectId) {
      throw new QaServiceError("AUTHORIZATION_DENIED", "Suite project scope does not match requested project", { status: 403 });
    }
    validatePhase1ConfigReference(input?.config_reference || input?.configReference || "production");
    const repeatEach = boundedInteger(input?.repeat_each ?? input?.repeatEach ?? 1, "repeat_each", 1, 10);
    const parallelism = boundedInteger(input?.parallelism ?? 2, "parallelism", 1, 20);
    const budget = validateBudget(input?.budget || {}, this.policy);
    const cases = await this.repository.listCases({ organizationId: context.organizationId, suiteId, enabledOnly: true });
    if (!cases.length) throw new QaServiceError("SUITE_EMPTY", "Suite has no enabled test cases", { status: 409 });
    const workload = enforceWorkloadBudget({ caseCount: cases.length, repeatEach, parallelism, budget });
    const existing = await this.repository.findRunByIdempotency({
      organizationId: context.organizationId,
      actorId: context.actorId,
      idempotencyKey
    });
    if (existing) return acceptedRun(existing, workload, true);

    const runType = String(input?.run_type || "baseline");
    if (!["baseline", "regression", "manual", "production_sample"].includes(runType)) {
      throw new QaServiceError("VALIDATION_ERROR", "run_type is not supported in Phase 1");
    }
    const run = await this.repository.createRun({
      suite_id: suite.id,
      run_type: runType,
      status: "queued",
      config_snapshot_id: null,
      candidate_id: null,
      organization_id: context.organizationId,
      project_id: projectId,
      data_snapshot_at: new Date().toISOString(),
      corpus_version: optionalString(input?.corpus_version, "corpus_version", 200),
      repeat_each: repeatEach,
      options: {
        parallelism,
        stop_on_critical: input?.stop_on_critical === true,
        case_count: cases.length,
        total_executions: workload.totalExecutions,
        isolated_sessions: true,
        side_effects_allowed: false,
        budget
      },
      summary: {},
      usage_metrics: {},
      estimated_cost: workload.estimatedCost,
      idempotency_key: idempotencyKey,
      created_by: context.actorId
    });

    const task = () => this.#executeSuiteRun({
      context,
      run,
      cases,
      repeatEach,
      parallelism,
      stopOnCritical: input?.stop_on_critical === true
    });
    const promise = new Promise((resolve) => this.scheduler(() => Promise.resolve(task()).then(resolve, resolve)));
    this.activeRuns.set(run.id, promise.finally(() => this.activeRuns.delete(run.id)));
    return acceptedRun(run, workload, false);
  }

  async getRun(rawContext, input) {
    const context = normalizeContext(rawContext);
    requireRole(context, QA_ROLES.VIEWER);
    const runId = requiredId(input?.run_id || input?.runId, "run_id");
    const detail = String(input?.detail || "summary").toLowerCase();
    if (!["summary", "failures", "full"].includes(detail)) {
      throw new QaServiceError("VALIDATION_ERROR", "detail must be summary, failures, or full");
    }
    const run = await this.#requireRun(context, runId);
    assertStoredProjectAccess(context, run.project_id);
    if (detail === "summary") return { run: runSummary(run), case_runs: null, pagination: null };
    const limit = boundedInteger(input?.limit ?? 50, "limit", 1, 100);
    const offset = decodeCursor(input?.cursor);
    const joined = await this.#joinedCaseRuns(context, run.id);
    const filtered = joined.filter((item) => {
      if (detail === "failures" && item.evaluation?.status === "pass") return false;
      if (input?.status && item.status !== input.status) return false;
      if (input?.failure_code && !item.evaluation?.failure_codes?.includes(input.failure_code)) return false;
      if (input?.severity && item.evaluation?.severity !== input.severity) return false;
      return true;
    });
    return {
      run: runSummary(run),
      case_runs: filtered.slice(offset, offset + limit),
      pagination: {
        count: Math.min(limit, Math.max(0, filtered.length - offset)),
        total: filtered.length,
        next_cursor: offset + limit < filtered.length ? encodeCursor(offset + limit) : null
      }
    };
  }

  async analyzeRun(rawContext, input) {
    const context = normalizeContext(rawContext);
    const reevaluate = input?.reevaluate === true;
    requireRole(context, reevaluate ? QA_ROLES.OPERATOR : QA_ROLES.VIEWER);
    const runId = requiredId(input?.run_id || input?.runId, "run_id");
    const run = await this.#requireRun(context, runId);
    assertStoredProjectAccess(context, run.project_id);
    let joined = await this.#joinedCaseRuns(context, run.id);
    if (reevaluate) {
      const cases = run.suite_id
        ? await this.repository.listCases({ organizationId: context.organizationId, suiteId: run.suite_id })
        : [];
      const caseMap = new Map(cases.map((testCase) => [testCase.id, testCase]));
      for (const item of joined) {
        const testCase = caseMap.get(item.case_id);
        const evaluation = await this.#evaluate(item, testCase?.expected_behavior || run.options?.expected_behavior || {}, Boolean(testCase?.is_critical));
        await this.repository.createEvaluation({
          organization_id: context.organizationId,
          case_run_id: item.id,
          ...evaluation
        });
      }
      joined = await this.#joinedCaseRuns(context, run.id);
    }
    const analysis = analyzeJoinedRun(run, joined);
    if (reevaluate || !run.summary || !Object.keys(run.summary).length) {
      await this.repository.updateRun({
        organizationId: context.organizationId,
        runId: run.id,
        patch: { summary: analysis, usage_metrics: analysis.usage, estimated_cost: analysis.cost.total }
      });
    }
    return analysis;
  }

  async waitForRun(runId) {
    const promise = this.activeRuns.get(runId);
    if (promise) await promise;
  }

  async #executeSuiteRun({ context, run, cases, repeatEach, parallelism, stopOnCritical }) {
    try {
      await this.repository.updateRun({
        organizationId: context.organizationId,
        runId: run.id,
        patch: { status: "running", started_at: new Date().toISOString() }
      });
      const jobs = cases.flatMap((testCase) => Array.from({ length: repeatEach }, (_, index) => ({ testCase, repetition: index + 1 })));
      let cursor = 0;
      let dispatched = 0;
      let stop = false;
      const workers = Array.from({ length: Math.min(parallelism, jobs.length) }, async () => {
        while (true) {
          if (stop) return;
          const index = cursor++;
          if (index >= jobs.length) return;
          dispatched += 1;
          const job = jobs[index];
          try {
            const result = await this.#executeAndPersist({
              context,
              run,
              testCase: job.testCase,
              question: job.testCase.question,
              expectedBehavior: job.testCase.expected_behavior,
              repetition: job.repetition
            });
            if (stopOnCritical && result.evaluation?.hard_fail) stop = true;
          } catch (error) {
            if (stopOnCritical && job.testCase.is_critical) stop = true;
          }
        }
      });
      await Promise.all(workers);
      const undispatched = stop ? Math.max(0, jobs.length - dispatched) : 0;
      await this.#finalizeRun(context, run.id, { undispatched });
    } catch (error) {
      await this.repository.updateRun({
        organizationId: context.organizationId,
        runId: run.id,
        patch: {
          status: "failed",
          summary: { operational_error: { code: normalizeQaError(error).code, message: safeErrorMessage(error) } },
          completed_at: new Date().toISOString()
        }
      }).catch(() => null);
      throw error;
    }
  }

  async #executeAndPersist({ context, run, testCase, question, expectedBehavior, repetition }) {
    const executionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const caseRun = await this.repository.createCaseRun({
      run_id: run.id,
      case_id: testCase?.id || null,
      organization_id: context.organizationId,
      project_id: run.project_id || null,
      repetition,
      status: "running",
      execution_id: executionId,
      question,
      answer: null,
      started_at: startedAt
    });
    createRun(executionId);
    let output = null;
    let pipelineError = null;
    try {
      output = await this.pipeline({
        message: question,
        sessionId: `qa_${executionId}`,
        userId: null,
        config: qaExecutionConfig(this.configProvider(), run.project_id),
        runId: executionId,
        sourcesEnabled: true,
        deepResearch: false,
        attachments: [],
        ephemeral: true,
        executionMode: "qa",
        persistChatHistory: false
      });
      completeRun(executionId, { type: "qa", qaRunId: run.id });
    } catch (error) {
      pipelineError = error;
      failRun(executionId, error);
      output = { answer: "", classification: {}, sources: [], toolCalls: [], trace: [{ step: "pipeline", ok: false, error: safeErrorMessage(error) }], workflowLog: {} };
    }
    const completedAt = new Date().toISOString();
    const normalized = normalizeCaseExecution({
      executionId,
      question,
      output,
      events: getRunEvents(executionId),
      startedAt,
      completedAt,
      error: pipelineError
    });
    const stored = await this.repository.updateCaseRun({
      organizationId: context.organizationId,
      caseRunId: caseRun.id,
      patch: normalized
    });
    const evaluation = await this.#evaluate(stored, expectedBehavior, Boolean(testCase?.is_critical));
    const savedEvaluation = await this.repository.createEvaluation({
      organization_id: context.organizationId,
      case_run_id: stored.id,
      ...evaluation
    });
    return { caseRun: stored, evaluation: savedEvaluation };
  }

  async #evaluate(caseRun, expectedBehavior, isCritical) {
    return evaluateCaseRun({
      caseRun,
      expectedBehavior,
      isCritical,
      profile: DEFAULT_EVALUATION_PROFILE,
      config: this.configProvider(),
      ...(this.semanticJudge ? { semanticJudge: this.semanticJudge } : {})
    });
  }

  async #finalizeRun(context, runId, { undispatched = 0 }) {
    const run = await this.#requireRun(context, runId);
    const joined = await this.#joinedCaseRuns(context, run.id);
    const failedExecutions = joined.filter((item) => item.status === "failed").length;
    const status = undispatched > 0 || failedExecutions > 0
      ? joined.length ? "partial" : "failed"
      : "completed";
    const analysis = analyzeJoinedRun({ ...run, status }, joined, { undispatched });
    return this.repository.updateRun({
      organizationId: context.organizationId,
      runId: run.id,
      patch: {
        status,
        summary: analysis,
        usage_metrics: analysis.usage,
        estimated_cost: analysis.cost.total,
        completed_at: new Date().toISOString()
      }
    });
  }

  async #runQueryResult(context, run, idempotentReplay) {
    const joined = await this.#joinedCaseRuns(context, run.id);
    const item = joined[0] || null;
    return {
      run: runSummary(run),
      execution: item ? withoutEvaluation(item) : null,
      evaluation: item?.evaluation || null,
      usage: item?.usage_metrics || {},
      latency_ms: item?.latency_ms ?? null,
      cost: item?.estimated_cost ?? null,
      idempotent_replay: idempotentReplay
    };
  }

  async #joinedCaseRuns(context, runId) {
    const caseRuns = await this.repository.listCaseRuns({ organizationId: context.organizationId, runId });
    const evaluations = await this.repository.listEvaluations({
      organizationId: context.organizationId,
      caseRunIds: caseRuns.map((item) => item.id)
    });
    const latest = new Map();
    for (const evaluation of evaluations.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))) {
      if (!latest.has(evaluation.case_run_id)) latest.set(evaluation.case_run_id, evaluation);
    }
    return caseRuns.map((item) => ({ ...item, evaluation: latest.get(item.id) || null }));
  }

  async #requireSuite(context, suiteId) {
    const suite = await this.repository.getSuite({ organizationId: context.organizationId, suiteId });
    if (!suite) throw new QaServiceError("SUITE_NOT_FOUND", "QA test suite was not found", { status: 404 });
    return suite;
  }

  async #requireRun(context, runId) {
    const run = await this.repository.getRun({ organizationId: context.organizationId, runId });
    if (!run) throw new QaServiceError("RUN_NOT_FOUND", "QA run was not found", { status: 404 });
    return run;
  }
}

export function qaExecutionConfig(baseConfig, projectId) {
  const externalTools = Object.fromEntries(Object.keys(baseConfig?.n8n?.tools || {}).map((name) => [name, ""]));
  return {
    ...baseConfig,
    projectId: projectId || null,
    qa: {
      executionMode: "qa",
      persistChatHistory: false,
      sideEffectsAllowed: false,
      externalToolsAllowed: false
    },
    n8n: {
      ...(baseConfig?.n8n || {}),
      tools: externalTools
    }
  };
}

export function analyzeJoinedRun(run, joined, { undispatched = 0 } = {}) {
  const evaluations = joined.map((item) => item.evaluation).filter(Boolean);
  const scoreValues = evaluations.map((item) => Number(item.overall_score || 0));
  const failureDistribution = countValues(evaluations.flatMap((item) => item.failure_codes || []));
  const severityDistribution = countValues(evaluations.map((item) => item.severity || "INFO"));
  const rootCauseDistribution = countValues(evaluations.map((item) => item.root_cause_domain).filter(Boolean));
  const dimensionKeys = Object.keys(DEFAULT_EVALUATION_PROFILE.weights);
  const scoreDimensions = Object.fromEntries(dimensionKeys.map((key) => [
    key,
    average(evaluations.map((item) => Number(item.scores?.[key] || 0)))
  ]));
  const latencyValues = joined.map((item) => Number(item.latency_ms || 0)).filter((value) => Number.isFinite(value));
  const totalCost = joined.reduce((sum, item) => sum + Number(item.estimated_cost || 0) + Number(item.evaluation?.analysis?.semantic_judge?.usage?.totals?.cost || 0), 0);
  const usage = joined.reduce((totals, item) => {
    addUsage(totals, item.usage_metrics?.totals || {});
    addUsage(totals, item.evaluation?.analysis?.semantic_judge?.usage?.totals || {});
    return totals;
  }, emptyUsage());
  const stability = calculateStability(joined);
  const recommendations = [...new Set(evaluations.flatMap((item) => item.recommendations || []))].slice(0, 50);
  const criticalFailures = joined.filter((item) => item.evaluation?.severity === "CRITICAL" || item.evaluation?.hard_fail).map((item) => ({
    case_run_id: item.id,
    case_id: item.case_id,
    failure_codes: item.evaluation?.failure_codes || [],
    hard_fail_reason: item.evaluation?.hard_fail_reason || null
  }));
  const pass = evaluations.filter((item) => item.status === "pass").length;
  const partial = evaluations.filter((item) => item.status === "partial").length;
  const fail = evaluations.filter((item) => item.status === "fail" || item.status === "error").length;
  return {
    run_id: run.id,
    status: run.status,
    total_executions: joined.length,
    undispatched_executions: undispatched,
    evaluated_executions: evaluations.length,
    verdicts: { pass, partial, fail },
    pass_rate: evaluations.length ? Number((pass / evaluations.length).toFixed(4)) : 0,
    overall_score: {
      mean: average(scoreValues),
      min: scoreValues.length ? Math.min(...scoreValues) : null,
      max: scoreValues.length ? Math.max(...scoreValues) : null
    },
    score_dimensions: scoreDimensions,
    stability,
    latency: {
      average_ms: average(latencyValues),
      p95_ms: percentile(latencyValues, 0.95),
      max_ms: latencyValues.length ? Math.max(...latencyValues) : null
    },
    cost: {
      total: Number(totalCost.toFixed(8)),
      per_execution: joined.length ? Number((totalCost / joined.length).toFixed(8)) : 0,
      currency: run.options?.budget?.currency || "USD"
    },
    usage,
    failure_distribution: failureDistribution,
    severity_distribution: severityDistribution,
    root_causes: Object.entries(rootCauseDistribution).map(([domain, count]) => ({
      domain,
      count,
      confidence: confidenceForCount(count, evaluations.length),
      evidence_case_run_ids: joined.filter((item) => item.evaluation?.root_cause_domain === domain).map((item) => item.id).slice(0, 20)
    })),
    critical_failures: criticalFailures,
    recommendations
  };
}

function validatePhase1ConfigReference(reference) {
  const kind = typeof reference === "string" ? reference : reference?.type || reference?.kind || "production";
  if (String(kind).toLowerCase() !== "production") {
    throw new QaServiceError("UNSUPPORTED_CONFIG_REFERENCE", "Phase 1 supports the production effective configuration only", {
      status: 422,
      details: { requested: kind, available_in_phase: 2 }
    });
  }
}

function assertStoredProjectAccess(context, projectId) {
  if (projectId) assertProjectAccess(context, projectId, { optional: false });
}

function acceptedRun(run, workload, idempotentReplay) {
  return {
    run_id: run.id,
    status: run.status,
    estimated_cost: workload.estimatedCost,
    currency: run.options?.budget?.currency || "USD",
    case_count: run.options?.case_count || null,
    repetition_count: run.repeat_each,
    execution_count: workload.totalExecutions,
    idempotent_replay: idempotentReplay
  };
}

function suiteSummary(suite, { idempotentReplay = false } = {}) {
  return {
    id: suite.id,
    name: suite.name,
    description: suite.description,
    domain: suite.domain,
    status: suite.status,
    is_regression: Boolean(suite.is_regression),
    is_golden: Boolean(suite.is_golden),
    tags: suite.tags || [],
    organization_id: suite.organization_id,
    project_id: suite.project_id || null,
    created_by: suite.created_by,
    created_at: suite.created_at,
    updated_at: suite.updated_at,
    idempotent_replay: idempotentReplay
  };
}

function caseSummary(testCase) {
  return {
    id: testCase.id,
    case_key: testCase.case_key,
    question: testCase.question,
    expected_behavior: testCase.expected_behavior,
    tags: testCase.tags || [],
    priority: testCase.priority,
    origin: testCase.origin,
    is_golden: Boolean(testCase.is_golden),
    is_critical: Boolean(testCase.is_critical),
    enabled: Boolean(testCase.enabled),
    version: Number(testCase.version || 1)
  };
}

function runSummary(run) {
  return {
    id: run.id,
    suite_id: run.suite_id || null,
    run_type: run.run_type,
    status: run.status,
    organization_id: run.organization_id,
    project_id: run.project_id || null,
    repeat_each: run.repeat_each,
    data_snapshot_at: run.data_snapshot_at,
    corpus_version: run.corpus_version || null,
    summary: run.summary || {},
    usage_metrics: run.usage_metrics || {},
    estimated_cost: run.estimated_cost ?? null,
    started_at: run.started_at || null,
    completed_at: run.completed_at || null,
    created_at: run.created_at
  };
}

function withoutEvaluation(item) {
  const { evaluation, ...caseRun } = item;
  return caseRun;
}

function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    const offset = Number(parsed.offset);
    if (!Number.isInteger(offset) || offset < 0) throw new Error("invalid");
    return offset;
  } catch {
    throw new QaServiceError("INVALID_CURSOR", "cursor is invalid", { status: 400 });
  }
}

function calculateStability(joined) {
  const groups = new Map();
  for (const item of joined) {
    const key = item.case_id || item.question;
    if (!groups.has(key)) groups.set(key, []);
    if (item.evaluation) groups.get(key).push(item.evaluation);
  }
  const cases = [...groups.entries()].map(([caseId, evaluations]) => {
    const scores = evaluations.map((item) => Number(item.overall_score || 0));
    const verdictCounts = countValues(evaluations.map((item) => item.status));
    const agreement = scores.length ? Math.max(...Object.values(verdictCounts)) / scores.length : 0;
    const mean = average(scores);
    const variance = scores.length ? scores.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / scores.length : 0;
    const stabilityScore = Math.max(0, Math.min(100, (agreement * 70) + (Math.max(0, 1 - Math.sqrt(variance) / 50) * 30)));
    return {
      case_id: caseId,
      sample_size: scores.length,
      pass_agreement: Number(agreement.toFixed(4)),
      mean_score: mean,
      min_score: scores.length ? Math.min(...scores) : null,
      max_score: scores.length ? Math.max(...scores) : null,
      variance: Number(variance.toFixed(4)),
      stability_score: Number(stabilityScore.toFixed(2))
    };
  });
  return {
    sample_size: cases.reduce((sum, item) => sum + item.sample_size, 0),
    stability_score: average(cases.map((item) => item.stability_score)),
    cases
  };
}

function casePayloadMatches(existing, proposed) {
  return existing.question === proposed.question &&
    JSON.stringify(existing.expected_behavior || {}) === JSON.stringify(proposed.expected_behavior || {}) &&
    JSON.stringify(existing.tags || []) === JSON.stringify(proposed.tags || []) &&
    existing.priority === proposed.priority &&
    existing.origin === proposed.origin &&
    Boolean(existing.is_critical) === Boolean(proposed.is_critical) &&
    Boolean(existing.enabled) === Boolean(proposed.enabled);
}

function addUsage(total, usage) {
  for (const key of Object.keys(total)) total[key] += Number(usage[key] || 0);
  return total;
}

function emptyUsage() {
  return {
    calls: 0,
    successful_calls: 0,
    failed_calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cached_tokens: 0,
    reasoning_tokens: 0,
    duration_ms: 0
  };
}

function countValues(values) {
  return values.reduce((out, value) => {
    if (value) out[value] = (out[value] || 0) + 1;
    return out;
  }, {});
}

function average(values) {
  const numbers = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return numbers.length ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(4)) : 0;
}

function percentile(values, fraction) {
  const numbers = values.filter((value) => Number.isFinite(Number(value))).map(Number).sort((a, b) => a - b);
  if (!numbers.length) return null;
  return numbers[Math.min(numbers.length - 1, Math.ceil(numbers.length * fraction) - 1)];
}

function confidenceForCount(count, total) {
  if (!total) return 0;
  return Number(Math.min(0.95, 0.45 + (count / total) * 0.5).toFixed(4));
}
