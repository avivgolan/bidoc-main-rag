import { getConfig, supabaseHeaders } from "../config.js";
import { QaServiceError, safeErrorMessage } from "./contracts.js";

export class SupabaseQaRepository {
  constructor({ configProvider = getConfig, fetchImpl = globalThis.fetch } = {}) {
    this.configProvider = configProvider;
    this.fetchImpl = fetchImpl;
  }

  async findSuiteByIdempotency({ organizationId, actorId, idempotencyKey }) {
    return this.#single("qa_test_suites", {
      organization_id: organizationId,
      created_by: actorId,
      idempotency_key: idempotencyKey
    });
  }

  async createSuite(row) {
    return this.#insert("qa_test_suites", row);
  }

  async getSuite({ organizationId, suiteId }) {
    return this.#single("qa_test_suites", { organization_id: organizationId, id: suiteId });
  }

  async listCases({ organizationId, suiteId, enabledOnly = false }) {
    return this.#list("qa_test_cases", {
      organization_id: organizationId,
      suite_id: suiteId,
      ...(enabledOnly ? { enabled: true } : {})
    }, { order: "created_at.asc", limit: 1000 });
  }

  async findCaseByKey({ organizationId, suiteId, caseKey }) {
    return this.#single("qa_test_cases", {
      organization_id: organizationId,
      suite_id: suiteId,
      case_key: caseKey
    });
  }

  async createCase(row) {
    return this.#insert("qa_test_cases", row);
  }

  async updateCase({ organizationId, caseId, patch }) {
    return this.#update("qa_test_cases", { organization_id: organizationId, id: caseId }, patch);
  }

  async findRunByIdempotency({ organizationId, actorId, idempotencyKey }) {
    return this.#single("qa_runs", {
      organization_id: organizationId,
      created_by: actorId,
      idempotency_key: idempotencyKey
    });
  }

  async createRun(row) {
    return this.#insert("qa_runs", row);
  }

  async getRun({ organizationId, runId }) {
    return this.#single("qa_runs", { organization_id: organizationId, id: runId });
  }

  async updateRun({ organizationId, runId, patch }) {
    return this.#update("qa_runs", { organization_id: organizationId, id: runId }, patch);
  }

  async createCaseRun(row) {
    return this.#insert("qa_case_runs", row);
  }

  async updateCaseRun({ organizationId, caseRunId, patch }) {
    return this.#update("qa_case_runs", { organization_id: organizationId, id: caseRunId }, patch);
  }

  async listCaseRuns({ organizationId, runId }) {
    return this.#list("qa_case_runs", { organization_id: organizationId, run_id: runId }, {
      order: "created_at.asc",
      limit: 5000
    });
  }

  async getCaseRun({ organizationId, caseRunId }) {
    return this.#single("qa_case_runs", { organization_id: organizationId, id: caseRunId });
  }

  async createEvaluation(row) {
    const existing = await this.#single("qa_evaluations", {
      organization_id: row.organization_id,
      case_run_id: row.case_run_id,
      evaluator_version: row.evaluator_version,
      evaluation_profile: row.evaluation_profile
    });
    return existing || this.#insert("qa_evaluations", row);
  }

  async listEvaluations({ organizationId, caseRunIds = [] }) {
    if (!caseRunIds.length) return [];
    const ids = caseRunIds.map((id) => String(id).replace(/[^a-zA-Z0-9_-]/g, "")).filter(Boolean);
    if (!ids.length) return [];
    return this.#request(`/rest/v1/qa_evaluations?organization_id=eq.${encodeURIComponent(organizationId)}&case_run_id=in.(${ids.join(",")})&select=*&order=created_at.desc&limit=5000`);
  }

  async #single(table, filters) {
    const rows = await this.#list(table, filters, { limit: 1 });
    return rows[0] || null;
  }

  async #list(table, filters, { order = null, limit = 1000 } = {}) {
    const query = filterQuery(filters);
    const suffix = [query, "select=*", order ? `order=${encodeURIComponent(order)}` : null, `limit=${Math.max(1, Math.min(5000, limit))}`]
      .filter(Boolean)
      .join("&");
    const result = await this.#request(`/rest/v1/${table}?${suffix}`);
    return Array.isArray(result) ? result : [];
  }

  async #insert(table, row) {
    const rows = await this.#request(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row)
    });
    return rows?.[0] || null;
  }

  async #update(table, filters, patch) {
    const rows = await this.#request(`/rest/v1/${table}?${filterQuery(filters)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    return rows?.[0] || null;
  }

  async #request(path, options = {}) {
    const config = this.configProvider();
    if (!config?.supabaseUrl || !config?.supabaseServiceRoleKey) {
      throw new QaServiceError("QA_DATABASE_NOT_CONFIGURED", "App Supabase is not configured", {
        status: 503,
        retryable: true
      });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response;
    try {
      response = await this.fetchImpl(`${String(config.supabaseUrl).replace(/\/$/, "")}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...supabaseHeaders(config.supabaseServiceRoleKey),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new QaServiceError("QA_DATABASE_ERROR", data?.message || `QA database request failed (${response.status})`, {
          status: response.status >= 500 ? 503 : 400,
          retryable: response.status >= 500
        });
      }
      return data;
    } catch (error) {
      if (error instanceof QaServiceError) throw error;
      const timeoutError = error?.name === "AbortError";
      throw new QaServiceError(timeoutError ? "TIMEOUT" : "QA_DATABASE_ERROR", safeErrorMessage(error), {
        status: 503,
        retryable: true
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function filterQuery(filters = {}) {
  return Object.entries(filters)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(String(value))}`)
    .join("&");
}
