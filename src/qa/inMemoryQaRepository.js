import crypto from "node:crypto";

export class InMemoryQaRepository {
  constructor(seed = {}) {
    this.tables = {
      suites: clone(seed.suites || []),
      cases: clone(seed.cases || []),
      runs: clone(seed.runs || []),
      caseRuns: clone(seed.caseRuns || []),
      evaluations: clone(seed.evaluations || [])
    };
  }

  async findSuiteByIdempotency({ organizationId, actorId, idempotencyKey }) {
    return clone(this.tables.suites.find((row) => row.organization_id === organizationId && row.created_by === actorId && row.idempotency_key === idempotencyKey) || null);
  }

  async createSuite(row) {
    return this.#insert("suites", row);
  }

  async getSuite({ organizationId, suiteId }) {
    return clone(this.tables.suites.find((row) => row.organization_id === organizationId && row.id === suiteId) || null);
  }

  async listCases({ organizationId, suiteId, enabledOnly = false }) {
    return clone(this.tables.cases.filter((row) => row.organization_id === organizationId && row.suite_id === suiteId && (!enabledOnly || row.enabled)));
  }

  async findCaseByKey({ organizationId, suiteId, caseKey }) {
    return clone(this.tables.cases.find((row) => row.organization_id === organizationId && row.suite_id === suiteId && row.case_key === caseKey) || null);
  }

  async createCase(row) {
    return this.#insert("cases", row);
  }

  async updateCase({ organizationId, caseId, patch }) {
    return this.#update("cases", (row) => row.organization_id === organizationId && row.id === caseId, patch);
  }

  async findRunByIdempotency({ organizationId, actorId, idempotencyKey }) {
    return clone(this.tables.runs.find((row) => row.organization_id === organizationId && row.created_by === actorId && row.idempotency_key === idempotencyKey) || null);
  }

  async createRun(row) {
    return this.#insert("runs", row);
  }

  async getRun({ organizationId, runId }) {
    return clone(this.tables.runs.find((row) => row.organization_id === organizationId && row.id === runId) || null);
  }

  async updateRun({ organizationId, runId, patch }) {
    return this.#update("runs", (row) => row.organization_id === organizationId && row.id === runId, patch);
  }

  async createCaseRun(row) {
    return this.#insert("caseRuns", row);
  }

  async updateCaseRun({ organizationId, caseRunId, patch }) {
    return this.#update("caseRuns", (row) => row.organization_id === organizationId && row.id === caseRunId, patch);
  }

  async listCaseRuns({ organizationId, runId }) {
    return clone(this.tables.caseRuns.filter((row) => row.organization_id === organizationId && row.run_id === runId));
  }

  async getCaseRun({ organizationId, caseRunId }) {
    return clone(this.tables.caseRuns.find((row) => row.organization_id === organizationId && row.id === caseRunId) || null);
  }

  async createEvaluation(row) {
    const existing = this.tables.evaluations.find((item) =>
      item.organization_id === row.organization_id &&
      item.case_run_id === row.case_run_id &&
      item.evaluator_version === row.evaluator_version &&
      item.evaluation_profile === row.evaluation_profile
    );
    return existing ? clone(existing) : this.#insert("evaluations", row);
  }

  async listEvaluations({ organizationId, caseRunIds = [] }) {
    const ids = new Set(caseRunIds);
    return clone(this.tables.evaluations.filter((row) => row.organization_id === organizationId && ids.has(row.case_run_id)));
  }

  #insert(table, row) {
    const now = new Date().toISOString();
    const stored = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...clone(row) };
    this.tables[table].push(stored);
    return clone(stored);
  }

  #update(table, predicate, patch) {
    const index = this.tables[table].findIndex(predicate);
    if (index < 0) return null;
    this.tables[table][index] = { ...this.tables[table][index], ...clone(patch), updated_at: new Date().toISOString() };
    return clone(this.tables[table][index]);
  }
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}
