import { createHash } from "node:crypto";
import { chatCompletion, extractJsonObject, summarizeOpenRouterUsage } from "../openrouter.js";
import { getConfig, readLocalSettings, supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";
import { getDataQueryAccessToken } from "./dataQueryAuth.js";
import { DATA_QUERY_EXACT_OPERATIONS, dataQueryTablePolicy, inferDataQueryField, validateDataQueryFilterValue } from "./dataQueryMetadata.js";

export const DATA_QUERY_DEFAULTS = {
  enabled: true,
  maxPlans: 5,
  maxRowsPerPlan: 200,
  timeoutMsPerPlan: 8000,
  totalTimeoutMs: 20000,
  runCacheEnabled: true,
  runCacheTtlMs: 60000,
  allowedTables: [],
  allowedSchemas: ["content"],
  tables: [],
  plannerEnabled: true,
  plannerModel: "",
  plannerTimeoutMs: 30000
};

export const DATA_QUERY_CONTRACT_VERSION = "data-query.v2";

export const DATA_QUERY_CALLER_SOURCES = new Set([
  "main_agent",
  "project_insights",
  "delay_claim",
  "workflow_qa",
  "api"
]);

export const DATA_QUERY_QUANTITATIVE_PATTERN = /כמה|ספור|ספירה|פילוח|ממוצע|מגמה|לפי סטטוס|לפי תאריך|לפי חומרה|מה הכי הרבה|השוואה בין|תמונת מצב|מדד|count|how many|breakdown|average|trend|by status|by date|by severity|top\s*\d*|compare|distribution|total|kpi/i;

const DATA_QUERY_SEMANTIC_PATTERN = /ציטוט|צטט|מי אמר|מה נאמר|הצג.{0,20}(?:מקור|ראיה|מסמך)|ראיות|למה|מדוע|סכם|סיכום|גורם שורש|אחראי|cite|citation|quote|who said|what (?:did|was).{0,30}say|show.{0,20}(?:source|evidence|document)|evidence|why|explain|summari[sz]e|root cause|responsib/i;
const DATA_QUERY_RUN_CACHE = new Map();

const READ_OPERATIONS = new Set(["select", "count", "group_count", "aggregate", "timeseries", "top_n", "distinct"]);
const FILTER_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]);
const DANGEROUS_SQL = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call)\b|;|--|\/\*/i;

export function dataQuerySettings(config = getConfig()) {
  const saved = readLocalSettings().subagents?.dataQuery || {};
  const raw = { ...DATA_QUERY_DEFAULTS, ...saved };
  // When the user has scanned the real DB and picked tables, the manifest and
  // allowlists are derived from that selection; otherwise fall back to the
  // legacy hardcoded manifest so existing behavior is preserved.
  // This agent is restricted to the CONTENT connection only — it must never touch
  // the main/app Supabase. Any "app" selection is dropped and the manifest is
  // filtered to content tables.
  const selectionTables = normalizeSelectionTables(raw.tables).filter((item) => item.connection === "content");
  const hasSelection = selectionTables.length > 0;
  const manifest = (hasSelection ? buildDataQueryManifestFromSelection(selectionTables) : buildDataQueryManifest(config))
    .filter((table) => table.schemaAlias === "content");
  const allowedTables = hasSelection
    ? [...new Set(selectionTables.map((item) => item.table))]
    : [...new Set(manifest.map((table) => table.tableName))];
  const allowedSchemas = ["content"];
  return {
    enabled: raw.enabled !== false,
    maxPlans: clampNumber(raw.maxPlans, 1, 10, DATA_QUERY_DEFAULTS.maxPlans),
    maxRowsPerPlan: clampNumber(raw.maxRowsPerPlan, 1, 1000, DATA_QUERY_DEFAULTS.maxRowsPerPlan),
    timeoutMsPerPlan: clampNumber(raw.timeoutMsPerPlan, 1000, 60000, DATA_QUERY_DEFAULTS.timeoutMsPerPlan),
    totalTimeoutMs: clampNumber(raw.totalTimeoutMs, 1000, 120000, DATA_QUERY_DEFAULTS.totalTimeoutMs),
    runCacheEnabled: raw.runCacheEnabled !== false,
    runCacheTtlMs: clampNumber(raw.runCacheTtlMs, 1000, 300000, DATA_QUERY_DEFAULTS.runCacheTtlMs),
    allowedTables,
    allowedSchemas,
    tables: selectionTables,
    usingSelection: hasSelection,
    plannerEnabled: raw.plannerEnabled !== false,
    plannerModel: String(raw.plannerModel || "").trim(),
    plannerTimeoutMs: clampNumber(raw.plannerTimeoutMs, 5000, 90000, DATA_QUERY_DEFAULTS.plannerTimeoutMs),
    manifest
  };
}

// Normalizes the user's saved table picks: [{ connection, schema, table, columns[] }].
export function normalizeSelectionTables(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const table = String(item?.table || item?.name || "").trim();
    if (!table) continue;
    const connection = String(item?.connection || item?.schema || "content").trim() || "content";
    const key = `${connection}.${table}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      connection,
      schema: String(item?.schema || "public").trim() || "public",
      table,
      columns: Array.isArray(item?.columns) ? [...new Set(item.columns.map((col) => String(col).trim()).filter(Boolean))] : []
    });
  }
  return out;
}

// Builds manifest entries from the user's real-table selection, reusing tableDef
// so date/numeric/groupable heuristics are derived from the real column names.
export function buildDataQueryManifestFromSelection(tables = []) {
  return normalizeSelectionTables(tables).map((item) => {
    const policy = dataQueryTablePolicy(item.table, item.columns);
    return tableDef(
      item.connection,
      item.table,
      item.description || `Selected table ${item.schema}.${item.table}`,
      item.columns,
      policy || {}
    );
  });
}

// Introspects a Supabase connection through the PostgREST OpenAPI root (no SQL,
// no migration) and returns the real tables and their columns.
export async function introspectSupabaseTables(connection, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) {
    throw new Error("Supabase connection is not configured");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let data;
  try {
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/`, {
      signal: controller.signal,
      headers: { ...supabaseHeaders(connection.supabaseServiceRoleKey), Accept: "application/openapi+json" }
    });
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data?.message || `Introspection failed: ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
  return parseOpenApiTables(data);
}

// Parses a PostgREST OpenAPI/Swagger document into [{ name, columns[] }].
export function parseOpenApiTables(doc = {}) {
  const defs = doc.definitions || doc.components?.schemas || {};
  const tables = [];
  for (const [name, schema] of Object.entries(defs)) {
    const columns = Object.keys(schema?.properties || {});
    if (!columns.length) continue;
    tables.push({ name, columns });
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDataQueryManifest(config = getConfig()) {
  const content = contentSupabaseConfig(config);
  // Data Query's exact contract is fixed to the normalized Content metadata
  // table. Do not inherit the hybrid-search embedding table when the optional
  // UI selection is missing or has not yet been persisted.
  const indexTable = "data_index";
  const alertsTable = content.alertsTable || "alerts_embeddings_gf";
  const contentTable = (tableName, description, fields, options = {}) => tableDef("content", tableName, description, fields, options);

  return [
    contentTable(indexTable, "Content index records", ["id", "created_at", "primary_date", "title", "summary", "source_table", "source_id", "project_id", "item_status", "severity_or_risk", "mail_id", "attachment_id", "source_url"], dataQueryTablePolicy(indexTable) || {
      defaultDateField: "primary_date"
    }),
    contentTable(alertsTable, "Content alert records", ["id", "created_at", "data_date", "summary", "alert_type", "severity_level", "item_status", "status", "is_relevant", "input_data_type", "input_data_id", "data_link"], {
      defaultDateField: "data_date"
    }),
    contentTable("meetings_documents", "Meeting document chunks", ["id", "created_at", "primary_date", "meeting_id", "attachment_id", "document_name", "chunk_index", "project_id"], {
      defaultDateField: "primary_date",
      numericFields: ["chunk_index"]
    })
  ];
}

export async function runDataQueryAgent(input = {}) {
  const config = input.config || getConfig();
  const configuredSettings = { ...dataQuerySettings(config), ...(input.settings || {}) };
  const normalizedCaller = normalizeDataQueryCaller(input, configuredSettings);
  const settings = normalizedCaller.settings;
  const caller = normalizedCaller.caller;
  const requestedMetrics = normalizeStringList(input.requestedMetrics || input.requested_metrics || []);
  settings.requestedMetrics = requestedMetrics;
  const warnings = [...normalizedCaller.warnings];
  const now = typeof input.now === "function" ? input.now : Date.now;
  const deadlineAt = now() + settings.totalTimeoutMs;
  if (!settings.enabled) {
    return dataQueryResponse({ status: "skipped", answer: "Data Query Agent is disabled.", warnings: [...warnings, "disabled"], confidence: 0, caller });
  }

  const question = String(input.question || input.query || "").trim();
  if (!question) {
    return dataQueryResponse({ status: "needs_clarification", answer: "Question is required.", warnings: [...warnings, "missing_question"], confidence: 0, caller });
  }

  const routing = classifyDataQueryCapability(question, { hasExplicitPlan: Boolean(input.queryPlan) });
  if (normalizedCaller.errors.length) {
    return dataQueryResponse({
      status: "needs_clarification",
      answer: normalizedCaller.errors.join("; "),
      warnings: [...warnings, ...normalizedCaller.errors.map((error) => `invalid_caller_scope:${error}`)],
      confidence: 0,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  if (!routing.supported) {
    return dataQueryResponse({
      status: "needs_clarification",
      answer: `${routing.reason} Suggested route: ${routing.suggestedAgent}.`,
      warnings: [...warnings, routing.warning],
      confidence: 0,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }

  const scopedInput = {
    ...input,
    context: { ...(input.context || {}), ...caller, budget: caller.budget },
    requestedMetrics
  };
  const planned = await resolveQueryPlan({ input: scopedInput, config, settings, question, warnings, deadlineAt, now });
  if (now() >= deadlineAt) {
    return dataQueryResponse({ status: "error", answer: "Data Query Agent exceeded its total deadline during planning.", warnings: [...warnings, "total_timeout_exceeded"], confidence: 0, planner: planned.source, queryPlan: planned.plan, caller, routing });
  }
  const scopedPlan = applyDataQueryCallerScope(planned.plan, caller, settings);
  warnings.push(...scopedPlan.warnings);
  if (scopedPlan.errors.length) {
    return dataQueryResponse({
      status: "needs_clarification",
      answer: scopedPlan.errors.join("; "),
      warnings: [...warnings, ...scopedPlan.errors],
      confidence: 0,
      planner: planned.source,
      queryPlan: scopedPlan.plan,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }
  planned.plan = scopedPlan.plan;
  const plan = planned.plan;
  let validation = validateQueryPlan(plan, settings);
  if (!validation.ok && !validation.plans.length && planned.source === "llm") {
    warnings.push(...validation.warnings, ...validation.errors);
    warnings.push("llm_plan_rejected_fallback_used");
    const fallbackPlan = buildHeuristicQueryPlan({ question, context: scopedInput.context, requestedMetrics, settings });
    const scopedFallback = applyDataQueryCallerScope(fallbackPlan, caller, settings);
    warnings.push(...scopedFallback.warnings, ...scopedFallback.errors);
    const fallbackValidation = scopedFallback.errors.length
      ? { ok: false, plans: [], warnings: scopedFallback.warnings, errors: scopedFallback.errors }
      : validateQueryPlan(scopedFallback.plan, settings);
    if (fallbackValidation.plans.length) {
      validation = fallbackValidation;
      planned.plan = scopedFallback.plan;
      planned.source = "heuristic_fallback";
    }
  }
  warnings.push(...validation.warnings);
  if (!validation.ok && !validation.plans.length) {
    return dataQueryResponse({
      status: validation.status || "error",
      answer: validation.errors.join("; "),
      warnings: [...warnings, ...validation.errors],
      confidence: Math.min(Number(plan.confidence || 0.2), 0.4),
      queryPlan: planned.plan,
      planner: planned.source,
      caller,
      routing,
      machineResult: buildDataQueryMachineResult({ requestedMetrics, caller })
    });
  }

  const results = await executeQueryPlans({
    config,
    settings,
    plans: validation.plans,
    fetchRows: input.fetchRows,
    fetchExact: input.fetchExact,
    caller,
    deadlineAt,
    now
  });
  warnings.push(...results.warnings);
  const synthesis = synthesizeDataQueryAnswer({ question, plan: planned.plan, planResults: results.plans, warnings });
  const metrics = synthesis.metrics;
  const machineResult = buildDataQueryMachineResult({ requestedMetrics, planResults: results.plans, metrics, caller });
  const hasSuccessfulPlan = results.plans.some((item) => item.status === "ok");
  const hasPartialResult = results.plans.some((item) => item.status !== "ok" || item.truncated || item.sampled);
  return dataQueryResponse({
    status: hasSuccessfulPlan ? (hasPartialResult ? "partial" : "ok") : "error",
    answer: synthesis.answer,
    metrics,
    plans: results.plans.map((item) => ({
      id: item.id,
      requestId: item.requestId || null,
      operation: item.operation,
      table: item.table,
      status: item.status,
      rows: Array.isArray(item.rows) ? item.rows.length : 0,
      cardinality: item.cardinality,
      exactness: item.exactness,
      truncated: item.truncated,
      sampled: item.sampled,
      cacheHit: item.cacheHit === true,
      provenance: item.provenance,
      summary: item.summary,
      error: item.error || undefined
    })),
    tablesUsed: [...new Set(results.plans.filter((item) => item.status === "ok").map((item) => item.table))],
    confidence: Number(planned.plan.confidence || synthesis.confidence || 0.65),
    warnings,
    rawResultsPreview: {},
    queryPlan: planned.plan,
    planner: planned.source,
    caller,
    routing,
    machineResult
  });
}

async function resolveQueryPlan({ input, config, settings, question, warnings, deadlineAt, now }) {
  if (input.queryPlan && typeof input.queryPlan === "object") {
    return { plan: input.queryPlan, source: "provided" };
  }
  if (typeof input.planWithLlm === "function") {
    try {
      const remainingMs = Math.max(1, deadlineAt - now());
      return {
        plan: await runWithinDeadline(
          () => input.planWithLlm({ question, context: input.context || {}, requestedMetrics: input.requestedMetrics || [], config, settings }),
          remainingMs,
          "data query planning"
        ),
        source: "llm"
      };
    } catch (error) {
      warnings.push(`llm_planner_failed: ${error.message}`);
    }
  } else if (settings.plannerEnabled !== false && !input.disableLlmPlanner && config.openRouterApiKey) {
    try {
      const remainingMs = Math.max(1, deadlineAt - now());
      return {
        plan: await runWithinDeadline(
          () => planDataQueryWithLlm({
            config,
            settings,
            question,
            context: input.context || {},
            requestedMetrics: input.requestedMetrics || [],
            telemetry: input.telemetry || null,
            timeoutMs: Math.min(settings.plannerTimeoutMs, remainingMs)
          }),
          remainingMs,
          "data query planning"
        ),
        source: "llm"
      };
    } catch (error) {
      warnings.push(`llm_planner_failed: ${error.message}`);
    }
  } else if (settings.plannerEnabled === false) {
    warnings.push("llm_planner_disabled");
  } else if (!config.openRouterApiKey) {
    warnings.push("llm_planner_skipped_missing_openrouter_key");
  }
  return {
    plan: buildHeuristicQueryPlan({ question, context: input.context || {}, requestedMetrics: input.requestedMetrics || [], settings }),
    source: "heuristic"
  };
}

export async function planDataQueryWithLlm({
  config = getConfig(),
  settings = dataQuerySettings(config),
  question = "",
  context = {},
  requestedMetrics = [],
  telemetry = null,
  chatComplete = chatCompletion,
  timeoutMs = settings.plannerTimeoutMs || DATA_QUERY_DEFAULTS.plannerTimeoutMs
} = {}) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const manifest = settings.manifest
    .filter((table) => (settings.allowedSchemas || []).includes(table.schemaAlias))
    .filter((table) => !settings.allowedTables.length || settings.allowedTables.includes(table.tableName))
    .map((table) => ({
      schema: table.schemaAlias,
      table: table.tableName,
      description: table.description,
      fields: table.fields.filter((field) => field.queryable !== false).map((field) => ({
        name: field.name,
        type: field.type,
        selectable: field.selectable,
        filterOps: field.filterOps,
        groupable: field.groupable,
        aggregations: field.aggregations,
        dateSemantics: field.dateSemantics
      })),
      dateFields: table.dateFields,
      groupableFields: table.groupableFields,
      numericFields: table.numericFields,
      defaultDateField: table.defaultDateField,
      allowedOperations: table.allowedOperations,
      exactOperations: table.exactRpc ? [...DATA_QUERY_EXACT_OPERATIONS] : []
    }));
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey,
    model,
    temperature: 0,
    maxTokens: 2200,
    timeoutMs,
    responseFormat: { type: "json_object" },
    telemetry,
    messages: [
      { role: "system", content: DATA_QUERY_PLANNER_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          question,
          context,
          requestedMetrics,
          limits: {
            maxPlans: settings.maxPlans,
            maxRowsPerPlan: settings.maxRowsPerPlan,
            allowedOperations: [...READ_OPERATIONS]
          },
          schemaManifest: manifest
        }, null, 2)
      }
    ]
  });
  return normalizeLlmQueryPlan(extractJsonObject(content), question, settings);
}

const DATA_QUERY_PLANNER_PROMPT = `You are the Data Query Agent planner for BIDoc.

Return ONLY one valid JSON object. Do not include Markdown.

You do not write SQL. You do not call functions. You only choose a safe Query Plan from the supplied schemaManifest.

Allowed operations: select, count, group_count, aggregate, timeseries, top_n, distinct.

Hard rules:
- Use only tables in schemaManifest.
- Use only fields listed under each table and obey each field's selectable, filterOps, groupable, and aggregations metadata.
- Every plan must include a stable id, schema, table, operation, limit, and reason.
- When requestedMetrics is non-empty, copy the matching requested metric id into requestId on each plan. Never invent a different requestId.
- limit must be a positive number no larger than maxRowsPerPlan.
- Do not include rawSql, sql, join, joins, semicolons, comments, or SQL keywords.
- If a JOIN would be required, return no executable join; either split into separate plans or add warning "unsupported_join_required".
- If no table is suitable, return {"question": "...", "intent": "needs_clarification", "plans": [], "confidence": 0.2, "warnings": ["needs_clarification"]}.
- Prefer group_count for "by status/date/severity/type" questions.
- Prefer aggregate for count/avg/min/max/sum metrics, but request avg/min/max/sum only when the field explicitly lists that aggregation.
- Exact quantitative operations are available only when listed in exactOperations. Otherwise return no plan with warning "not_computable".
- Use date filters from context only on dateFields/defaultDateField.

Output shape:
{
  "question": "string",
  "intent": "string",
  "plans": [
    {
      "id": "stable_snake_case",
      "requestId": "requested_metric_id_or_null",
      "schema": "content",
      "table": "table_name",
      "operation": "select|count|group_count|aggregate|timeseries|top_n|distinct",
      "select": ["field"],
      "metrics": [{"type":"count|avg|min|max|sum","field":"numeric_field","as":"metric_name"}],
      "filters": [{"field":"field","op":"eq|neq|gt|gte|lt|lte|ilike|in|is","value":"value"}],
      "groupBy": ["field"],
      "orderBy": [{"field":"field_or_metric_alias","direction":"asc|desc"}],
      "limit": 100,
      "reason": "short reason"
    }
  ],
  "confidence": 0.0,
  "warnings": []
}`;

function normalizeLlmQueryPlan(value = {}, question, settings) {
  const plans = Array.isArray(value.plans) ? value.plans : [];
  return {
    question: String(value.question || question || ""),
    intent: String(value.intent || (plans.length ? "metric_lookup" : "needs_clarification")),
    plans: plans.slice(0, settings.maxPlans).map((plan, index) => ({
      id: String(plan.id || `plan_${index + 1}`).trim(),
      requestId: String(plan.requestId || plan.request_id || "").trim() || null,
      schema: String(plan.schema || plan.schemaAlias || "content").trim(),
      table: String(plan.table || plan.tableName || "").trim(),
      operation: String(plan.operation || "select").trim(),
      select: Array.isArray(plan.select) ? plan.select.map(String) : [],
      metrics: Array.isArray(plan.metrics) ? plan.metrics : [],
      filters: Array.isArray(plan.filters) ? plan.filters : [],
      groupBy: Array.isArray(plan.groupBy) ? plan.groupBy.map(String) : [],
      orderBy: Array.isArray(plan.orderBy) ? plan.orderBy : [],
      limit: plan.limit,
      reason: String(plan.reason || "")
    })),
    confidence: Math.max(0, Math.min(1, Number(value.confidence ?? 0.5))),
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String) : []
  };
}

export function buildHeuristicQueryPlan({ question, context = {}, requestedMetrics = [], settings = dataQuerySettings() } = {}) {
  const text = String(question || "").toLowerCase();
  const plans = [];
  const add = (plan) => plans.push(plan);
  const dateFrom = context.dateFrom || context.date_from || null;
  const dateTo = context.dateTo || context.date_to || null;
  const dateFilters = (field) => [
    ...(dateFrom ? [{ field, op: "gte", value: dateFrom }] : []),
    ...(dateTo ? [{ field, op: "lte", value: dateTo }] : [])
  ];
  const wantsAlert = /alert|alerts|התראה|התראות|חומרה|severity|risk|סיכון/.test(text);
  if (wantsAlert) {
    const alertDefinition = settings.manifest.find((item) =>
      item.schemaAlias === "content" && item.groupableFields.includes("severity_level")
    );
    const alertsTable = alertDefinition?.tableName || "alerts_embeddings_gf";
    const alertDateField = alertDefinition?.dateFields.includes("data_date") ? "data_date" : (alertDefinition?.defaultDateField || "data_date");
    add({
      id: "alerts_by_severity",
      schema: "content",
      table: alertsTable,
      operation: "group_count",
      filters: dateFilters(alertDateField),
      groupBy: ["severity_level", "item_status"],
      limit: Math.min(100, settings.maxRowsPerPlan || 200),
      reason: "Alert severity count requested."
    });
  }
  return {
    question,
    intent: plans.length > 1 ? "multi_metric_summary" : "metric_lookup",
    plans: plans.slice(0, settings.maxPlans || 5).map((plan, index) => ({
      ...plan,
      requestId: normalizeStringList(requestedMetrics)[index] || plan.id
    })),
    confidence: plans.length ? 0.72 : 0.25,
    warnings: plans.length ? [] : ["low_confidence_no_table_selected"]
  };
}

export function validateQueryPlan(queryPlan = {}, settings = dataQuerySettings()) {
  const warnings = Array.isArray(queryPlan.warnings) ? [...queryPlan.warnings] : [];
  const errors = [];
  if (containsDangerousSql(queryPlan)) errors.push("Query plan contains forbidden SQL text");
  const rawPlans = Array.isArray(queryPlan.plans) ? queryPlan.plans : [];
  if (!rawPlans.length) {
    return { ok: false, status: "needs_clarification", plans: [], warnings, errors: ["No query plans were selected"] };
  }
  if (rawPlans.length > settings.maxPlans) warnings.push(`maxPlans exceeded; using first ${settings.maxPlans}`);
  const tableMap = new Map(settings.manifest.map((item) => [`${item.schemaAlias}.${item.tableName}`, item]));
  const allowedTables = new Set(settings.allowedTables.length ? settings.allowedTables : settings.manifest.map((item) => item.tableName));
  const allowedSchemas = new Set(settings.allowedSchemas || DATA_QUERY_DEFAULTS.allowedSchemas);
  const accepted = [];

  const requestedMetricIds = normalizeStringList(settings.requestedMetrics || []);
  const requestedMetricSet = new Set(requestedMetricIds);
  for (const [planIndex, original] of rawPlans.slice(0, settings.maxPlans).entries()) {
    const plan = normalizePlan(original, settings);
    const planErrors = [];
    if (!plan.id) planErrors.push("plan id is required");
    if (!plan.requestId && requestedMetricIds[planIndex]) plan.requestId = requestedMetricIds[planIndex];
    if (plan.requestId && requestedMetricSet.size && !requestedMetricSet.has(plan.requestId)) planErrors.push(`requestId ${plan.requestId} was not requested by the caller`);
    if (!READ_OPERATIONS.has(plan.operation)) planErrors.push(`operation ${plan.operation || "missing"} is not allowed`);
    if (!allowedSchemas.has(plan.schema)) planErrors.push(`schema ${plan.schema} is not allowed`);
    if (!allowedTables.has(plan.table)) planErrors.push(`table ${plan.table} is not allowed`);
    const table = tableMap.get(`${plan.schema}.${plan.table}`);
    if (!table) planErrors.push(`table ${plan.schema}.${plan.table} is not in the manifest`);
    if (!Number.isFinite(Number(plan.limit)) || Number(plan.limit) <= 0) planErrors.push("limit is required");
    if (plan.join || plan.joins?.length) planErrors.push("joins are not supported");
    if (plan.rawSql || plan.sql) planErrors.push("raw SQL is not supported");
    if (table) {
      if (DATA_QUERY_EXACT_OPERATIONS.has(plan.operation) && !table.exactRpc) {
        planErrors.push(`operation ${plan.operation} is not computable because ${table.tableName} has no approved exact analytics RPC`);
      }
      const fieldErrors = validatePlanFields(plan, table);
      planErrors.push(...fieldErrors);
      plan.limit = Math.min(Number(plan.limit), table.maxLimit, settings.maxRowsPerPlan);
    }
    if (planErrors.length) {
      warnings.push(`${plan.id || "unnamed"} rejected: ${planErrors.join(", ")}`);
    } else {
      accepted.push(plan);
    }
  }

  return {
    ok: accepted.length > 0 && errors.length === 0,
    status: accepted.length ? "partial" : (warnings.some((warning) => /not computable|exact analytics RPC/i.test(warning)) ? "not_computable" : "error"),
    plans: errors.length ? [] : accepted,
    warnings,
    errors
  };
}

export async function executeQueryPlans({ config = getConfig(), settings = dataQuerySettings(config), plans = [], fetchRows = null, fetchExact = null, caller = null, deadlineAt = null, now = Date.now } = {}) {
  const warnings = [];
  const output = [];
  const startedAt = now();
  const hasExternalDeadline = deadlineAt !== null && deadlineAt !== undefined && Number.isFinite(Number(deadlineAt));
  const effectiveDeadline = hasExternalDeadline ? Number(deadlineAt) : startedAt + settings.totalTimeoutMs;
  for (const plan of plans) {
    const cacheKey = caller?.runId && settings.runCacheEnabled !== false
      ? `${caller.runId}:${dataQueryPlanSignature(plan)}`
      : null;
    const cached = cacheKey ? readDataQueryRunCache(cacheKey, now()) : null;
    if (cached) {
      if (!warnings.includes("served_from_run_cache")) warnings.push("served_from_run_cache");
      output.push(successfulPlanResult(plan, cached, true));
      continue;
    }
    const remainingMs = Math.max(0, effectiveDeadline - now());
    if (remainingMs <= 0) {
      warnings.push(`${plan.id}: total timeout exceeded`);
      output.push(failedPlanResult(plan, "total timeout exceeded", "Plan skipped after total timeout."));
      continue;
    }
    try {
      let execution;
      if (DATA_QUERY_EXACT_OPERATIONS.has(plan.operation)) {
        if (fetchExact) {
          execution = normalizeExactExecution(await fetchExact(plan), plan);
        } else if (fetchRows) {
          const rows = await fetchRows(plan);
          execution = exactExecutionFromTrustedRows(plan, rows);
        } else {
          execution = await fetchExactPlan({ config, settings, plan, timeoutMs: Math.min(settings.timeoutMsPerPlan, remainingMs) });
        }
      } else {
        const fetched = fetchRows
          ? { rows: await fetchRows(plan), hasMore: false }
          : await fetchPlanRows({ config, settings, plan, timeoutMs: Math.min(settings.timeoutMsPerPlan, remainingMs) });
        const rows = Array.isArray(fetched) ? fetched : fetched.rows;
        const hasMore = Array.isArray(fetched) ? false : fetched.hasMore;
        execution = {
          rows: rows.slice(0, plan.limit),
          cardinality: hasMore ? null : rows.length,
          exactness: hasMore ? "truncated" : "exact",
          truncated: hasMore,
          sampled: false
        };
      }
      if (execution.truncated) warnings.push(`${plan.id}: result truncated at ${plan.limit} row(s)`);
      if (execution.sampled) warnings.push(`${plan.id}: sampled result`);
      if (cacheKey) writeDataQueryRunCache(cacheKey, execution, now(), settings.runCacheTtlMs);
      output.push(successfulPlanResult(plan, execution, false));
    } catch (error) {
      warnings.push(`${plan.id}: ${error.message}`);
      output.push(failedPlanResult(plan, error.message));
    }
  }
  return { plans: output, warnings };
}

function successfulPlanResult(plan, execution, cacheHit) {
  return {
    id: plan.id,
    requestId: plan.requestId || null,
    operation: plan.operation,
    table: plan.table,
    status: "ok",
    ...cloneDataQueryValue(execution),
    cacheHit,
    provenance: planProvenance(plan, execution),
    summary: summarizePlanResult(plan, execution.rows, execution)
  };
}

export function dataQueryPlanSignature(plan = {}) {
  const normalized = normalizePlan(plan, { maxRowsPerPlan: Number.MAX_SAFE_INTEGER });
  return createHash("sha256").update(stableStringify({
    schema: normalized.schema,
    table: normalized.table,
    operation: normalized.operation,
    select: normalized.select,
    filters: [...normalized.filters].sort((left, right) => stableStringify(left).localeCompare(stableStringify(right))),
    groupBy: normalized.groupBy,
    metrics: normalized.metrics,
    orderBy: normalized.orderBy,
    dateField: normalized.dateField || null,
    granularity: normalized.granularity || null,
    limit: normalized.limit
  })).digest("hex");
}

export function clearDataQueryRunCache() {
  DATA_QUERY_RUN_CACHE.clear();
}

function readDataQueryRunCache(key, now) {
  const entry = DATA_QUERY_RUN_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    DATA_QUERY_RUN_CACHE.delete(key);
    return null;
  }
  return cloneDataQueryValue(entry.execution);
}

function writeDataQueryRunCache(key, execution, now, ttlMs) {
  const ttl = clampNumber(ttlMs, 1000, 300000, DATA_QUERY_DEFAULTS.runCacheTtlMs);
  DATA_QUERY_RUN_CACHE.set(key, { execution: cloneDataQueryValue(execution), expiresAt: now + ttl });
  if (DATA_QUERY_RUN_CACHE.size > 500) {
    for (const [entryKey, entry] of DATA_QUERY_RUN_CACHE) {
      if (entry.expiresAt <= now || DATA_QUERY_RUN_CACHE.size > 400) DATA_QUERY_RUN_CACHE.delete(entryKey);
      if (DATA_QUERY_RUN_CACHE.size <= 400) break;
    }
  }
}

function cloneDataQueryValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function applyDataQueryCallerScope(queryPlan = {}, caller = {}, settings = dataQuerySettings()) {
  const warnings = [];
  const errors = [];
  const plans = (Array.isArray(queryPlan.plans) ? queryPlan.plans : []).map((original) => {
    const plan = { ...original, filters: Array.isArray(original.filters) ? original.filters.map((filter) => ({ ...filter })) : [] };
    const tableName = String(plan.table || plan.tableName || "").trim();
    const schema = String(plan.schema || plan.schemaAlias || "content").trim();
    const table = settings.manifest?.find((item) => item.schemaAlias === schema && item.tableName === tableName);
    if (!table) return plan;

    if (caller.projectId) {
      if (!table.allowedFields.includes("project_id")) {
        errors.push(`${plan.id || tableName}: project_scope_not_supported`);
      } else {
        appendUniqueFilter(plan.filters, { field: "project_id", op: "eq", value: caller.projectId });
      }
    }

    if (caller.dateFrom || caller.dateTo) {
      const dateField = table.dateFields.includes(plan.dateField) ? plan.dateField : table.defaultDateField;
      const definition = table.fields?.find((field) => field.name === dateField);
      if (!dateField || !table.dateFields.includes(dateField) || !definition) {
        errors.push(`${plan.id || tableName}: date_scope_not_supported`);
      } else {
        if (caller.dateFrom) {
          removeMirroredScopeFilter(plan.filters, dateField, ["gte", "gt"], caller.dateFrom);
          appendUniqueFilter(plan.filters, { field: dateField, op: "gte", value: caller.dateFrom });
        }
        if (caller.dateTo) {
          removeMirroredScopeFilter(plan.filters, dateField, ["lte", "lt"], caller.dateTo);
          const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(caller.dateTo);
          if (definition.type === "timestamptz" && dateOnly) {
            appendUniqueFilter(plan.filters, { field: dateField, op: "lt", value: nextUtcDate(caller.dateTo) });
          } else {
            appendUniqueFilter(plan.filters, { field: dateField, op: "lte", value: caller.dateTo });
          }
        }
        warnings.push(`${plan.id || tableName}: caller_date_scope_applied`);
      }
    }
    return plan;
  });
  return { plan: { ...queryPlan, plans }, warnings: [...new Set(warnings)], errors: [...new Set(errors)] };
}

function appendUniqueFilter(filters, candidate) {
  if (!filters.some((filter) => stableStringify(filter) === stableStringify(candidate))) filters.push(candidate);
}

function removeMirroredScopeFilter(filters, field, operators, value) {
  for (let index = filters.length - 1; index >= 0; index -= 1) {
    const filter = filters[index];
    if (filter.field === field && operators.includes(filter.op) && String(filter.value) === String(value)) filters.splice(index, 1);
  }
}

function nextUtcDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function tableDef(schemaAlias, tableName, description, fields, options = {}) {
  const fieldDefinitions = (options.fields || fields.map(inferDataQueryField))
    .filter((definition) => definition?.name && fields.includes(definition.name));
  const queryableFields = fieldDefinitions.filter((definition) => definition.queryable !== false);
  const allowedFields = queryableFields.map((definition) => definition.name);
  const dateFields = options.dateFields || queryableFields.filter((definition) => ["date", "timestamptz"].includes(definition.type)).map((definition) => definition.name);
  const numericFields = options.numericFields || queryableFields.filter((definition) => definition.aggregations?.length).map((definition) => definition.name);
  return {
    schemaAlias,
    tableName,
    description,
    allowedFields: [...new Set(allowedFields)],
    fields: fieldDefinitions,
    dateFields,
    searchableFields: options.searchableFields || queryableFields.filter((definition) => definition.filterOps.includes("ilike")).map((definition) => definition.name),
    groupableFields: options.groupableFields || queryableFields.filter((definition) => definition.groupable).map((definition) => definition.name),
    numericFields,
    defaultDateField: options.defaultDateField || dateFields[0] || "created_at",
    defaultLimit: options.defaultLimit || 100,
    maxLimit: options.maxLimit || 1000,
    allowedOperations: options.allowedOperations || [...READ_OPERATIONS],
    exactRpc: options.exactRpc || null
  };
}

export function normalizeDataQueryCaller(input = {}, settings = DATA_QUERY_DEFAULTS) {
  const context = input.context && typeof input.context === "object" ? input.context : {};
  const warnings = [];
  const errors = [];
  const rawSource = String(input.source || context.source || "").trim();
  const source = DATA_QUERY_CALLER_SOURCES.has(rawSource) ? rawSource : "api";
  if (!DATA_QUERY_CALLER_SOURCES.has(rawSource)) warnings.push("unknown_caller_source");

  const runId = normalizeCallerId(input.runId || input.run_id || context.runId || context.run_id, "runId", warnings);
  const callerNodeId = normalizeCallerId(input.callerNodeId || input.caller_node_id || context.callerNodeId || context.caller_node_id, "callerNodeId", warnings);
  const dateFrom = normalizeScopeDate(input.dateFrom || input.date_from || context.dateFrom || context.date_from, "dateFrom", errors);
  const dateTo = normalizeScopeDate(input.dateTo || input.date_to || context.dateTo || context.date_to, "dateTo", errors);
  if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) errors.push("dateFrom must not be after dateTo");

  const projectId = normalizeOptionalString(input.projectId || input.project_id || context.projectId || context.project_id);
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    errors.push("projectId must be a UUID");
  }
  const caseId = normalizeOptionalString(input.caseId || input.case_id || context.caseId || context.case_id);
  if (caseId) errors.push("caseId scope is not supported by the Content data_index contract");

  const rawBudget = {
    ...(context.budget && typeof context.budget === "object" ? context.budget : {}),
    ...(input.budget && typeof input.budget === "object" ? input.budget : {})
  };
  if (input.maxPlans !== undefined && rawBudget.maxPlans === undefined) rawBudget.maxPlans = input.maxPlans;
  const budgetFields = [
    ["maxPlans", 1],
    ["maxRowsPerPlan", 1],
    ["timeoutMsPerPlan", 1],
    ["totalTimeoutMs", 1],
    ["plannerTimeoutMs", 1]
  ];
  const effectiveSettings = { ...settings };
  const budget = {};
  for (const [field, minimum] of budgetFields) {
    const configured = Number(settings[field] ?? DATA_QUERY_DEFAULTS[field]);
    const requested = rawBudget[field];
    if (requested === undefined || requested === null || requested === "") {
      effectiveSettings[field] = configured;
      budget[field] = configured;
      continue;
    }
    const parsed = Number(requested);
    if (!Number.isFinite(parsed) || parsed < minimum) {
      warnings.push(`invalid_budget_ignored:${field}`);
      effectiveSettings[field] = configured;
      budget[field] = configured;
      continue;
    }
    if (parsed > configured) warnings.push(`budget_expansion_ignored:${field}`);
    const narrowed = Math.min(configured, Math.floor(parsed));
    effectiveSettings[field] = narrowed;
    budget[field] = narrowed;
  }

  return {
    caller: {
      version: 1,
      source,
      runId,
      callerNodeId,
      dateFrom,
      dateTo,
      projectId,
      caseId,
      budget
    },
    settings: effectiveSettings,
    warnings,
    errors
  };
}

export function classifyDataQueryCapability(question, { hasExplicitPlan = false } = {}) {
  const text = String(question || "").trim();
  if (DATA_QUERY_SEMANTIC_PATTERN.test(text)) {
    const suggestedAgent = /עיכוב|תביעה|אחריות|delay|claim|responsib|root cause|גורם שורש/i.test(text)
      ? "delay_claim"
      : /פגישה|ישיבה|meeting|minutes|quote|ציטוט/i.test(text)
        ? "meeting_evidence"
        : "hybrid_search";
    return {
      supported: false,
      domain: "semantic_or_citation",
      reason: "Data Query supports structured metadata metrics, not semantic interpretation or citation retrieval.",
      warning: "semantic_question_route_elsewhere",
      suggestedAgent
    };
  }
  if (hasExplicitPlan || DATA_QUERY_QUANTITATIVE_PATTERN.test(text)) {
    return {
      supported: true,
      domain: "content_metadata_metrics",
      reason: "The request is a structured quantitative question over approved Content metadata.",
      warning: null,
      suggestedAgent: null
    };
  }
  return {
    supported: false,
    domain: "unsupported_question",
    reason: "The request does not identify a supported quantitative metric.",
    warning: "non_quantitative_question_route_elsewhere",
    suggestedAgent: "hybrid_search"
  };
}

function normalizeCallerId(value, field, warnings) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (normalized.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    warnings.push(`invalid_caller_id_ignored:${field}`);
    return null;
  }
  return normalized;
}

function normalizeScopeDate(value, field, errors) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  if (Number.isNaN(Date.parse(normalized))) {
    errors.push(`${field} must be a valid date`);
    return null;
  }
  return normalized;
}

function normalizeOptionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizePlan(plan = {}, settings = dataQuerySettings()) {
  return {
    ...plan,
    id: String(plan.id || "").trim(),
    requestId: String(plan.requestId || plan.request_id || "").trim() || null,
    schema: String(plan.schema || plan.schemaAlias || "content").trim(),
    table: String(plan.table || plan.tableName || "").trim(),
    operation: String(plan.operation || "select").trim(),
    filters: Array.isArray(plan.filters) ? plan.filters : [],
    select: Array.isArray(plan.select) ? plan.select : [],
    metrics: Array.isArray(plan.metrics) ? plan.metrics : [],
    groupBy: Array.isArray(plan.groupBy) ? plan.groupBy : [],
    orderBy: Array.isArray(plan.orderBy) ? plan.orderBy : [],
    limit: plan.limit === undefined || plan.limit === null || plan.limit === ""
      ? null
      : Number(plan.limit)
  };
}

function validatePlanFields(plan, table) {
  const errors = [];
  const allowed = new Set(table.allowedFields);
  const groupable = new Set(table.groupableFields);
  const allowedOps = new Set(table.allowedOperations);
  const fieldMap = new Map((table.fields || []).map((definition) => [definition.name, definition]));
  if (!allowedOps.has(plan.operation)) errors.push(`operation ${plan.operation} is not allowed for ${table.tableName}`);
  for (const field of plan.select || []) {
    if (!allowed.has(field)) errors.push(`field ${field} is not allowed`);
    else if (!fieldMap.get(field)?.selectable) errors.push(`field ${field} is not selectable`);
  }
  if ((plan.groupBy || []).length > 2) errors.push("at most two group fields are supported");
  for (const field of plan.groupBy || []) if (!groupable.has(field)) errors.push(`group field ${field} is not allowed`);
  for (const filter of plan.filters || []) {
    if (!allowed.has(filter.field)) errors.push(`filter field ${filter.field} is not allowed`);
    if (!FILTER_OPS.has(filter.op)) {
      errors.push(`filter op ${filter.op} is not allowed`);
    } else if (allowed.has(filter.field)) {
      const valueError = validateDataQueryFilterValue(fieldMap.get(filter.field), filter.op, filter.value);
      if (valueError) errors.push(`filter ${filter.field}: ${valueError}`);
    }
  }
  for (const order of plan.orderBy || []) {
    const field = order.field;
    if (!allowed.has(field) && field !== "count" && !plan.metrics?.some((metric) => metric.as === field)) errors.push(`order field ${field} is not allowed`);
  }
  for (const metric of plan.metrics || []) {
    if (!["count", "avg", "min", "max", "sum"].includes(metric.type)) errors.push(`metric ${metric.type} is not allowed`);
    if (metric.as && !/^[a-z][a-z0-9_]{0,62}$/i.test(metric.as)) errors.push(`metric alias ${metric.as} is invalid`);
    if (metric.type !== "count") {
      const definition = fieldMap.get(metric.field);
      if (!definition?.aggregations?.includes(metric.type)) errors.push(`metric ${metric.type} is not allowed for field ${metric.field}`);
    }
  }
  if (plan.operation === "distinct" && !(plan.select?.[0] || plan.groupBy?.[0])) errors.push("distinct requires one selected or group field");
  if (plan.operation === "top_n" && !plan.groupBy?.length) errors.push("top_n requires at least one group field");
  if (plan.operation === "timeseries") {
    const dateField = plan.dateField || plan.filters?.find((filter) => table.dateFields.includes(filter.field))?.field || table.defaultDateField;
    if (!table.dateFields.includes(dateField)) errors.push(`timeseries field ${dateField} is not a declared date field`);
    if (!["day", "month"].includes(plan.granularity || "day")) errors.push(`timeseries granularity ${plan.granularity} is not allowed`);
  }
  return errors;
}

export function dataQuerySupabaseHeaders(config, extra = {}) {
  const connection = contentSupabaseConfig(config);
  const accessToken = String(config?.dataQueryReadAccessToken || "").trim();
  if (!accessToken) {
    throw new Error("DATA_QUERY_SUPABASE_READ_ACCESS_TOKEN is missing");
  }
  return {
    ...supabaseHeaders(connection.supabaseServiceRoleKey),
    Authorization: `Bearer ${accessToken}`,
    ...extra
  };
}

export async function resolveDataQuerySupabaseHeaders(
  config,
  extra = {},
  { fetchImpl = fetch, now = Date.now } = {}
) {
  const connection = contentSupabaseConfig(config);
  const accessToken = await getDataQueryAccessToken(config, { fetchImpl, now });
  return {
    ...supabaseHeaders(connection.supabaseServiceRoleKey),
    Authorization: `Bearer ${accessToken}`,
    ...extra
  };
}

export async function fetchExactPlan({ config, settings, plan, timeoutMs = settings.timeoutMsPerPlan, fetchImpl = fetch, now = Date.now }) {
  const connection = contentSupabaseConfig(config);
  const table = settings.manifest.find((item) => item.schemaAlias === plan.schema && item.tableName === plan.table);
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) throw new Error(`${plan.schema} Supabase is not configured`);
  if (!table?.exactRpc) throw new Error(`${plan.table} has no approved exact analytics RPC`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    p_operation: plan.operation,
    p_filters: plan.filters || [],
    p_group_by: plan.groupBy || [],
    p_metrics: plan.metrics || [],
    p_select: plan.select || [],
    p_date_field: plan.dateField || table.defaultDateField || null,
    p_granularity: plan.granularity || "day",
    p_order_by: plan.orderBy || [],
    p_limit: plan.limit
  };
  const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(table.exactRpc)}`, {
    method: "POST",
    signal: controller.signal,
    headers: await resolveDataQuerySupabaseHeaders(
      config,
      { "Content-Type": "application/json" },
      { fetchImpl, now }
    ),
    body: JSON.stringify(body)
  }).finally(() => clearTimeout(timeout));
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.hint || `Exact analytics request failed: ${response.status}`);
  return normalizeExactExecution(Array.isArray(data) && data.length === 1 ? data[0] : data, plan);
}

async function fetchPlanRows({ config, settings, plan, timeoutMs = settings.timeoutMsPerPlan }) {
  const connection = contentSupabaseConfig(config);
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) throw new Error(`${plan.schema} Supabase is not configured`);
  const table = settings.manifest.find((item) => item.schemaAlias === plan.schema && item.tableName === plan.table);
  const select = fieldsForFetch(plan, table).join(",");
  const params = new URLSearchParams({ select, limit: String(plan.limit + 1) });
  applyFilters(params, plan.filters);
  applyOrder(params, plan.orderBy, table);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(`${connection.supabaseUrl}/rest/v1/${encodeURIComponent(plan.table)}?${params.toString()}`, {
    signal: controller.signal,
    headers: await resolveDataQuerySupabaseHeaders(config)
  }).finally(() => clearTimeout(timeout));
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  const rows = Array.isArray(data) ? data : [];
  return { rows: rows.slice(0, plan.limit), hasMore: rows.length > plan.limit };
}

function fieldsForFetch(plan, table) {
  const fields = new Set(["id"]);
  for (const field of plan.select || []) fields.add(field);
  for (const field of plan.groupBy || []) fields.add(field);
  for (const filter of plan.filters || []) fields.add(filter.field);
  for (const metric of plan.metrics || []) if (metric.field) fields.add(metric.field);
  if (fields.size === 1) {
    for (const field of table.allowedFields.slice(0, 12)) fields.add(field);
  }
  return [...fields].filter((field) => table.allowedFields.includes(field));
}

function applyFilters(params, filters = []) {
  for (const filter of filters) {
    if (filter.value === undefined) continue;
    if (filter.op === "in" && Array.isArray(filter.value)) {
      params.append(filter.field, `in.(${filter.value.map((item) => String(item).replace(/"/g, "")).join(",")})`);
    } else {
      params.append(filter.field, `${filter.op}.${String(filter.value)}`);
    }
  }
}

function applyOrder(params, orderBy = [], table) {
  const first = orderBy.find((item) => table.allowedFields.includes(item.field));
  if (!first) return;
  const direction = first.direction === "asc" ? "asc" : "desc";
  params.set("order", `${first.field}.${direction}`);
}

function derivePlanRows(plan, rows = []) {
  const data = Array.isArray(rows) ? rows : [];
  if (plan.operation === "select") return data;
  if (plan.operation === "count") return [{ count: data.length }];
  if (plan.operation === "distinct") {
    const field = plan.select?.[0] || plan.groupBy?.[0];
    return [...new Set(data.map((row) => row[field]).filter((value) => value !== null && value !== undefined))]
      .map((value) => ({ [field]: value }));
  }
  if (plan.operation === "top_n") {
    return data.slice(0, plan.limit);
  }
  if (plan.operation === "group_count") {
    return groupRows(data, plan.groupBy, (items) => ({ count: items.length }));
  }
  if (plan.operation === "aggregate") {
    const aggregate = (items) => Object.fromEntries((plan.metrics || [{ type: "count", as: "count" }]).map((metric) => [metric.as || metric.type, computeMetric(metric, items)]));
    return plan.groupBy?.length ? groupRows(data, plan.groupBy, aggregate) : [aggregate(data)];
  }
  if (plan.operation === "timeseries") {
    const dateField = plan.dateField || plan.filters?.[0]?.field || "created_at";
    return groupRows(data.map((row) => ({ ...row, period: String(row[dateField] || "").slice(0, plan.granularity === "month" ? 7 : 10) })), ["period"], (items) => ({ count: items.length }));
  }
  return data;
}

export function normalizeExactExecution(payload, plan = {}) {
  if (!payload || typeof payload !== "object") throw new Error("Exact analytics RPC returned an invalid payload");
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const exactness = ["exact", "truncated", "sampled", "not_computable"].includes(payload.exactness)
    ? payload.exactness
    : "not_computable";
  const cardinality = payload.cardinality === null || payload.cardinality === undefined
    ? null
    : Number(payload.cardinality);
  if (cardinality !== null && (!Number.isFinite(cardinality) || cardinality < 0)) throw new Error("Exact analytics RPC returned invalid cardinality");
  return {
    rows,
    cardinality,
    resultRows: Number.isFinite(Number(payload.result_rows)) ? Number(payload.result_rows) : rows.length,
    exactness,
    truncated: payload.truncated === true || exactness === "truncated",
    sampled: payload.sampled === true || exactness === "sampled",
    operation: payload.operation || plan.operation || null
  };
}

function exactExecutionFromTrustedRows(plan, rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const derived = derivePlanRows(plan, sourceRows);
  const truncated = derived.length > plan.limit;
  return {
    rows: derived.slice(0, plan.limit),
    cardinality: sourceRows.length,
    resultRows: derived.length,
    exactness: truncated ? "truncated" : "exact",
    truncated,
    sampled: false,
    operation: plan.operation
  };
}

function failedPlanResult(plan, error, summary = "Plan failed.") {
  return {
    id: plan.id,
    requestId: plan.requestId || null,
    operation: plan.operation,
    table: plan.table,
    status: "error",
    rows: [],
    cardinality: null,
    resultRows: 0,
    exactness: /not computable/i.test(error) ? "not_computable" : null,
    truncated: false,
    sampled: false,
    provenance: planProvenance(plan),
    summary,
    error
  };
}

function planProvenance(plan, execution = {}) {
  const filters = (plan.filters || []).map((filter) => ({ field: filter.field, op: filter.op }));
  const filterSignature = createHash("sha256").update(JSON.stringify(plan.filters || [])).digest("hex").slice(0, 16);
  return {
    connection: "content",
    schema: "public",
    table: plan.table,
    requestId: plan.requestId || null,
    operation: plan.operation,
    filters,
    filterSignature,
    select: plan.select || [],
    groupBy: plan.groupBy || [],
    metricDefinitions: (plan.metrics || []).map((metric) => ({ type: metric.type, field: metric.field || null, as: metric.as || metric.type })),
    cardinality: execution.cardinality ?? null,
    exactness: execution.exactness || null
  };
}

function groupRows(rows, fields = [], reducer) {
  const groupFields = fields.length ? fields : ["_all"];
  const groups = new Map();
  for (const row of rows) {
    const key = groupFields.map((field) => field === "_all" ? "all" : String(row[field] ?? "unknown")).join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, items]) => ({
    ...Object.fromEntries(groupFields.map((field, index) => [field, key.split("|")[index]]).filter(([field]) => field !== "_all")),
    ...reducer(items)
  }));
}

function computeMetric(metric, rows) {
  if (metric.type === "count") return rows.length;
  const values = rows.map((row) => Number(row[metric.field])).filter(Number.isFinite);
  if (!values.length) return null;
  if (metric.type === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (metric.type === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (metric.type === "min") return Math.min(...values);
  if (metric.type === "max") return Math.max(...values);
  return null;
}

function synthesizeDataQueryAnswer({ planResults = [], warnings = [] }) {
  const metrics = buildDataQueryMetrics(planResults);
  const ok = planResults.filter((item) => item.status === "ok");
  const failed = planResults.filter((item) => item.status !== "ok");
  const preview = metrics.slice(0, 6).map((metric) => `${metric.label}: ${formatMetricValue(metric.value)} (${metric.exactness})`).join("; ");
  const answer = metrics.length
    ? `${preview}${metrics.length > 6 ? `; and ${metrics.length - 6} more metric(s)` : ""}.`
    : ok.length
      ? `Data Query Agent returned ${ok.reduce((sum, item) => sum + item.rows.length, 0)} result row(s); no scalar metric was requested.`
      : "Data Query Agent could not execute an approved plan.";
  return {
    answer: failed.length || warnings.length ? `${answer} Warnings: ${[...warnings, ...failed.map((item) => item.error)].filter(Boolean).join("; ")}` : answer,
    metrics,
    confidence: ok.length ? 0.72 : 0.2
  };
}

export function buildDataQueryMetrics(planResults = []) {
  const metrics = [];
  for (const result of planResults) {
    if (result.status !== "ok") continue;
    const provenance = result.provenance || {};
    const groupFields = provenance.groupBy || [];
    if (result.operation === "count") {
      metrics.push(metricRecord(result, "count", result.rows[0]?.count ?? 0, {}));
      continue;
    }
    if (["group_count", "top_n", "timeseries"].includes(result.operation)) {
      for (const row of result.rows) {
        const group = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "count"));
        metrics.push(metricRecord(result, "count", row.count ?? 0, group));
      }
      continue;
    }
    if (result.operation === "distinct") {
      const field = groupFields[0] || provenance.select?.[0] || "value";
      metrics.push(metricRecord(result, `distinct_${field}`, result.resultRows ?? result.rows.length, {}));
      continue;
    }
    if (result.operation === "aggregate") {
      const definitions = provenance.metricDefinitions?.length ? provenance.metricDefinitions : [{ type: "count", field: null, as: "count" }];
      for (const row of result.rows) {
        const group = Object.fromEntries(groupFields.map((field) => [field, row[field]]));
        for (const definition of definitions) {
          metrics.push(metricRecord(result, definition.as, row[definition.as], group, definition));
        }
      }
    }
  }
  return metrics;
}

export function buildDataQueryMachineResult({ requestedMetrics = [], planResults = [], metrics = [], caller = null } = {}) {
  const requested = normalizeStringList(requestedMetrics);
  const keys = requested.length
    ? requested
    : [...new Set(planResults.map((plan) => plan.requestId || plan.id).filter(Boolean))];
  const metricsByRequestId = {};
  const planStatusByRequestId = {};

  keys.forEach((requestId, index) => {
    const explicit = planResults.filter((plan) => plan.requestId === requestId || plan.id === requestId);
    const fallback = explicit.length ? explicit : (requested.length && planResults[index] ? [planResults[index]] : []);
    const planIds = new Set(fallback.map((plan) => plan.id));
    metricsByRequestId[requestId] = metrics
      .filter((metric) => planIds.has(metric.planId))
      .map((metric) => ({ ...metric }));
    planStatusByRequestId[requestId] = fallback.map((plan) => ({
      planId: plan.id,
      status: plan.status,
      exactness: plan.exactness || null,
      cardinality: plan.cardinality ?? null,
      truncated: plan.truncated === true,
      sampled: plan.sampled === true,
      cacheHit: plan.cacheHit === true
    }));
  });

  return {
    contractVersion: DATA_QUERY_CONTRACT_VERSION,
    source: caller?.source || "api",
    requestedMetrics: requested,
    metricsByRequestId,
    planStatusByRequestId
  };
}

function metricRecord(result, alias, value, group, definition = null) {
  const groupHash = Object.keys(group).length
    ? createHash("sha256").update(JSON.stringify(group)).digest("hex").slice(0, 12)
    : "all";
  const exactness = value === null || value === undefined ? "not_computable" : result.exactness;
  const groupLabel = Object.entries(group).map(([key, item]) => `${key}=${item ?? "null"}`).join(", ");
  const metricNamespace = result.requestId || result.provenance?.requestId || result.id;
  return {
    id: `${metricNamespace}__${alias}__${groupHash}`,
    planId: result.id,
    requestId: result.requestId || result.provenance?.requestId || null,
    label: `${result.table}.${alias}${groupLabel ? ` [${groupLabel}]` : ""}`,
    value: value ?? null,
    operation: result.operation,
    exactness,
    group,
    definition: definition || { type: alias, field: null, as: alias },
    source: {
      connection: "content",
      schema: "public",
      table: result.table
    },
    filters: result.provenance?.filters || [],
    filterSignature: result.provenance?.filterSignature || null,
    cardinality: result.cardinality
  };
}

function formatMetricValue(value) {
  if (value === null || value === undefined) return "not computable";
  if (typeof value === "number") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
  return String(value);
}

function summarizePlanResult(plan, rows, execution = {}) {
  const exactness = execution.exactness ? ` (${execution.exactness})` : "";
  if (plan.operation === "group_count") return `Grouped ${plan.table} by ${(plan.groupBy || []).join(", ")}${exactness}.`;
  if (plan.operation === "aggregate") return `Aggregated ${plan.table}${exactness}.`;
  if (plan.operation === "count") return `Counted ${plan.table}${exactness}.`;
  return `Read ${rows.length} row(s) from ${plan.table}${exactness}.`;
}

function dataQueryResponse({ status, answer, metrics = [], plans = [], tablesUsed = [], confidence = 0, warnings = [], rawResultsPreview = {}, queryPlan = null, planner = null, caller = null, routing = null, machineResult = null }) {
  return {
    contractVersion: DATA_QUERY_CONTRACT_VERSION,
    status,
    answer,
    metrics,
    plans,
    tablesUsed,
    confidence,
    warnings,
    rawResultsPreview,
    queryPlan,
    planner,
    caller,
    routing,
    machineResult: machineResult || buildDataQueryMachineResult({ metrics, caller })
  };
}

// Builds a workflow-graph log from a Data Query Agent response so a direct
// subagent test renders the same way a chat-invoked run does in the Workflow tab.
export function buildDataQueryWorkflowLog(result = {}, { question = "", context = {}, openRouterCalls = [] } = {}) {
  const queryPlan = result.queryPlan && typeof result.queryPlan === "object" ? result.queryPlan : {};
  const plannedPlans = Array.isArray(queryPlan.plans) ? queryPlan.plans : [];
  const executedPlans = Array.isArray(result.plans) ? result.plans : [];
  const planner = result.planner || "unknown";
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const usedFallback = warnings.includes("llm_plan_rejected_fallback_used") || planner === "heuristic_fallback";
  const errored = result.status === "error";
  const routedElsewhere = result.routing?.supported === false;
  const caller = result.caller || context || {};

  const nodes = [
    { id: "dq_input", label: "Question Input", kind: "trigger", status: "done" },
    { id: "dq_routing", label: "Capability Router", kind: "router", status: "done" },
    {
      id: "dq_planner",
      label: planner === "llm" ? "LLM Query Planner" : "Heuristic Planner",
      kind: planner === "llm" ? "ai" : "router",
      status: routedElsewhere ? "skipped" : plannedPlans.length ? "done" : "error",
      ...(usedFallback ? { fallback: true } : {})
    },
    { id: "dq_validation", label: "Plan Validation", kind: "router", status: routedElsewhere ? "skipped" : executedPlans.length ? "done" : "error" }
  ];
  const edges = [
    { from: "dq_input", to: "dq_routing" },
    { from: "dq_routing", to: "dq_planner" },
    { from: "dq_planner", to: "dq_validation" }
  ];

  for (const plan of executedPlans) {
    const nodeId = `dq_exec_${plan.id}`;
    nodes.push({
      id: nodeId,
      label: `Execute · ${plan.table}`,
      kind: "database",
      status: plan.status === "ok" ? "done" : "error"
    });
    edges.push({ from: "dq_validation", to: nodeId });
    edges.push({ from: nodeId, to: "dq_synthesis" });
  }
  if (!executedPlans.length) edges.push({ from: "dq_validation", to: "dq_synthesis" });

  nodes.push({ id: "dq_synthesis", label: "Answer Synthesis", kind: "router", status: errored ? "error" : "done" });
  nodes.push({ id: "dq_output", label: "Data Query Output", kind: "output", status: errored ? "error" : "done" });
  edges.push({ from: "dq_synthesis", to: "dq_output" });

  const nodeDetails = {
    dq_input: {
      summary: question || "(no question)",
      input: { question, context: caller },
      output: { intent: queryPlan.intent || null, contractVersion: result.contractVersion || DATA_QUERY_CONTRACT_VERSION }
    },
    dq_routing: {
      summary: result.routing?.reason || "Structured quantitative route accepted.",
      input: { source: caller.source || "api", callerNodeId: caller.callerNodeId || null },
      output: result.routing || { supported: true, domain: "content_metadata_metrics" }
    },
    dq_planner: {
      summary: `Planner: ${planner}; ${plannedPlans.length} plan(s) proposed${usedFallback ? " (fallback used)" : ""}`,
      output: queryPlan,
      logs: warnings.filter((w) => /planner|llm|heuristic|fallback|plan_rejected/i.test(w)).map((message) => ({ step: "dq_planner", message }))
    },
    dq_validation: {
      summary: `${executedPlans.length} plan(s) accepted for execution`,
      output: { acceptedPlans: executedPlans.map((p) => ({ id: p.id, table: p.table, operation: p.operation, status: p.status, rows: p.rows, cardinality: p.cardinality, exactness: p.exactness })) },
      logs: warnings.filter((w) => /reject|exceeded|limit|not allowed|forbidden/i.test(w)).map((message) => ({ step: "dq_validation", message }))
    },
    dq_synthesis: {
      summary: result.answer || "",
      output: { metrics: result.metrics || [], machineResult: result.machineResult || null, tablesUsed: result.tablesUsed || [], confidence: result.confidence }
    },
    dq_output: {
      summary: `status: ${result.status}; ${(result.metrics || []).length} metric(s); ${(result.tablesUsed || []).length} table(s)`,
      output: { status: result.status, warnings, metrics: result.metrics || [] }
    }
  };
  for (const plan of executedPlans) {
    const planned = plannedPlans.find((p) => p.id === plan.id) || { id: plan.id, table: plan.table };
    nodeDetails[`dq_exec_${plan.id}`] = {
      summary: plan.summary || `Read from ${plan.table}`,
      input: planned,
      output: {
        rows: plan.rows,
        cardinality: plan.cardinality ?? null,
        exactness: plan.exactness || null,
        truncated: plan.truncated === true,
        status: plan.status,
        error: plan.error || null,
        // Workflow history stores structure, never source row values.
        fields: [...new Set([...(planned.select || []), ...(planned.groupBy || []), ...(planned.metrics || []).map((metric) => metric.as || metric.field).filter(Boolean)])]
      }
    };
  }

  const calls = Array.isArray(openRouterCalls) ? openRouterCalls : [];
  for (const node of nodes) {
    const nodeCalls = calls.filter((call) => call.step === node.id);
    if (nodeCalls.length) node.openrouter = nodeCalls;
  }

  return {
    nodes,
    edges,
    nodeDetails,
    openRouterUsage: summarizeOpenRouterUsage(calls),
    summary: {
      planner,
      status: result.status,
      contractVersion: result.contractVersion || DATA_QUERY_CONTRACT_VERSION,
      callerSource: caller.source || "api",
      callerNodeId: caller.callerNodeId || null,
      parentRunId: caller.runId || null,
      tablesUsed: result.tablesUsed || [],
      metrics: (result.metrics || []).length,
      cacheHits: executedPlans.filter((plan) => plan.cacheHit).length,
      warnings: warnings.length,
      fallback: usedFallback
    }
  };
}

function containsDangerousSql(value) {
  const text = JSON.stringify(value || {});
  return DANGEROUS_SQL.test(text);
}

function normalizeStringList(value) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]+/) : [];
  return [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function runWithinDeadline(factory, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      Promise.resolve().then(factory),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} exceeded the total timeout`)), Math.max(1, timeoutMs));
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// RETIRED IN PHASE 0: the legacy SQL-pipeline helpers remain temporarily for
// source-history compatibility, but they are deliberately private. No server
// route or UI control can call them, and the exec_read_sql RPC is removed by
// the Phase 0/1 hardening migration. The typed Query Plan path above is the
// only supported runtime.
// ============================================================================

const DATA_QUERY_PIPELINE_STEPS = [
  { id: "user_question", label: "User Question" },
  { id: "schema_inspection", label: "Schema Inspection" },
  { id: "field_selection", label: "Field & Table Selection" },
  { id: "sql_generation", label: "SQL Generation" },
  { id: "sql_execution", label: "SQL Execution" },
  { id: "calculation", label: "Server-side Calculation" },
  { id: "result", label: "Quantitative Result" }
];

const SQL_FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge|comment|vacuum|analyze|reindex|cluster|lock|listen|notify|set|reset|begin|commit|rollback|savepoint|prepare|execute|deallocate|refresh)\b/i;

// Defense-in-depth SQL guard (the DB read-only role is the primary guarantee).
function validateReadOnlySql(sql, { allowedTables = [] } = {}) {
  const errors = [];
  const text = String(sql || "").trim().replace(/;\s*$/, "");
  if (!text) return { ok: false, errors: ["empty sql"], sql: "", tables: [] };
  if (/;/.test(text)) errors.push("multiple statements are not allowed");
  if (!/^(select|with)\b/i.test(text)) errors.push("only SELECT/WITH queries are allowed");
  if (SQL_FORBIDDEN.test(text)) errors.push("write/DDL keywords are not allowed");
  if (/--|\/\*/.test(text)) errors.push("SQL comments are not allowed");
  const refs = [...text.matchAll(/\b(?:from|join)\s+("?[A-Za-z_][\w.]*"?)/gi)]
    .map((m) => m[1].replace(/"/g, "").split(".").pop());
  if (allowedTables.length) {
    const blocked = [...new Set(refs.filter((r) => !allowedTables.includes(r)))];
    if (blocked.length) errors.push(`tables not in your selection: ${blocked.join(", ")}`);
  }
  return { ok: errors.length === 0, errors, sql: text, tables: [...new Set(refs)] };
}

function pipelineConnection(_connKey, config) {
  // The Data Query Agent is restricted to the content connection only — never the main/app DB.
  const c = contentSupabaseConfig(config);
  return { schema: "content", supabaseUrl: c.supabaseUrl, supabaseServiceRoleKey: c.supabaseServiceRoleKey };
}

// Runs read-only SQL through the exec_read_sql Postgres RPC (created via migration).
async function execReadSql({ connection, sql, maxRows = 200, timeoutMs = 8000, fetchImpl = fetch }) {
  if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) {
    throw new Error("Supabase connection is not configured");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/rpc/exec_read_sql`, {
      method: "POST",
      signal: controller.signal,
      headers: { ...supabaseHeaders(connection.supabaseServiceRoleKey), "Content-Type": "application/json" },
      body: JSON.stringify({ q: sql, max_rows: maxRows })
    });
    const txt = await response.text();
    const data = txt ? JSON.parse(txt) : null;
    if (!response.ok) {
      const msg = data?.message || data?.hint || data?.error || `exec_read_sql failed: ${response.status}`;
      if (response.status === 404 || /could not find|exec_read_sql|schema cache/i.test(String(msg))) {
        throw new Error("exec_read_sql RPC is missing — run the Supabase migration first");
      }
      throw new Error(msg);
    }
    return Array.isArray(data) ? data : (data == null ? [] : [data]);
  } finally {
    clearTimeout(timer);
  }
}

function truncateSampleValue(value) {
  if (typeof value === "string") return value.length > 140 ? `${value.slice(0, 140)}…` : value;
  if (value && typeof value === "object") return JSON.stringify(value).slice(0, 140);
  return value;
}

// Fetches a few real rows so the LLM can ground SQL in actual column contents
// (e.g. discover that a `hashtags` column holds Hebrew tags). Read-only REST, no migration.
async function fetchTableSamples({ connection, table, limit = 3, timeoutMs = 6000, fetchImpl = fetch }) {
  if (!connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${connection.supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=${limit}`, {
      signal: controller.signal,
      headers: supabaseHeaders(connection.supabaseServiceRoleKey)
    });
    const txt = await response.text();
    const data = txt ? JSON.parse(txt) : [];
    if (!response.ok || !Array.isArray(data)) return [];
    return data.map((row) => Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, truncateSampleValue(v)])));
  } catch (_) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const FIELD_SELECTION_PROMPT = `You select the data sources for a read-only analytics agent.
Given a user question and the availableSchema (tables with their columns), choose the MINIMAL set of tables and columns needed to answer it.
Return ONLY one JSON object: {"connection":"app|content","tables":[{"table":"name","columns":["col"]}],"reason":"short"}.
Rules: use only tables and columns that appear in availableSchema; all chosen tables must belong to the SAME connection.
Choose the table whose columns and sample values ACTUALLY contain what the question needs — not the one whose name merely sounds related. Inspect each table's sample rows.
If the question is about hashtags, tags, topics, or labels, pick a table that has a hashtags/tags/keywords/category column (confirm it exists in the samples); do not pick a table that lacks such a column. Include that column among the chosen columns.`;

const SQL_GENERATION_PROMPT = `You write ONE read-only PostgreSQL query for an analytics agent.
Return ONLY one JSON object: {"sql":"...","reason":"short"}.
Hard rules: a single statement; it MUST start with SELECT or WITH; no semicolons; no comments; never use INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE or any write/DDL.
Use only the provided tables and columns. For quantitative questions prefer aggregates (count, sum, avg, min, max, group by). Always include an explicit LIMIT no larger than maxRows. PostgreSQL dialect only.

Ground your query in the provided sample rows — they show the REAL format and values of each column. Do not invent enum values or assume a column means what its name suggests; check the samples.
When the question is about a topic, subject, label, or tag (e.g. counting items "about delays"), find the column that actually holds tags/hashtags/keywords/categories from the samples and filter it with case-insensitive text matching (e.g. col ILIKE '%term%'); if that column is a Postgres array use term = ANY(col); if it is JSON/JSONB use the appropriate containment. Prefer this over guessing a status/type enum column.`;

function normalizeFieldSelection(parsed = {}, schema = {}) {
  const available = new Map();
  for (const conn of schema.connections || []) {
    for (const t of conn.tables || []) available.set(`${conn.key}.${t.name}`, { connection: conn.key, columns: t.columns || [] });
  }
  let connection = String(parsed.connection || "").trim();
  const tables = [];
  for (const t of Array.isArray(parsed.tables) ? parsed.tables : []) {
    const name = String(t.table || t.name || "").trim();
    if (!name) continue;
    const conn = connection || (schema.connections?.[0]?.key) || "app";
    const meta = available.get(`${conn}.${name}`) || [...available.entries()].find(([k]) => k.endsWith(`.${name}`))?.[1];
    if (!meta) continue;
    if (!connection) connection = meta.connection;
    const cols = (Array.isArray(t.columns) ? t.columns : []).map(String).filter((c) => meta.columns.includes(c));
    tables.push({ table: name, columns: cols.length ? cols : meta.columns.slice(0, 12) });
  }
  return { connection: connection || "app", tables, reason: String(parsed.reason || "") };
}

function computeQuantitativeMetrics(rows = []) {
  const metrics = [{ id: "row_count", label: "row count", value: rows.length }];
  if (!rows.length) return metrics;
  const keys = Object.keys(rows[0] || {});
  for (const key of keys) {
    const values = rows.map((r) => r[key]);
    const numeric = values.map(Number).filter(Number.isFinite);
    if (numeric.length === values.length && numeric.length) {
      const sum = numeric.reduce((s, v) => s + v, 0);
      metrics.push({ id: `${key}_sum`, label: `${key} sum`, value: Number(sum.toFixed(4)) });
      metrics.push({ id: `${key}_avg`, label: `${key} avg`, value: Number((sum / numeric.length).toFixed(4)) });
      metrics.push({ id: `${key}_min`, label: `${key} min`, value: Math.min(...numeric) });
      metrics.push({ id: `${key}_max`, label: `${key} max`, value: Math.max(...numeric) });
    } else {
      const distinct = new Set(values.map((v) => String(v ?? "null")));
      if (distinct.size > 1 && distinct.size <= Math.min(20, rows.length)) {
        const groups = {};
        for (const v of values) groups[String(v ?? "null")] = (groups[String(v ?? "null")] || 0) + 1;
        metrics.push({ id: `${key}_breakdown`, label: `${key} breakdown`, value: groups });
      }
    }
  }
  return metrics;
}

function buildQuantitativeAnswer({ rowCount = 0, metrics = [] }) {
  const parts = [`התקבלו ${rowCount} שורות.`];
  for (const m of metrics) {
    if (m.id === "row_count") continue;
    if (m.value && typeof m.value === "object") {
      parts.push(`${m.label}: ${Object.entries(m.value).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    } else {
      parts.push(`${m.label}: ${m.value}`);
    }
  }
  return parts.join(" ");
}

function stepUserQuestion(state) {
  const question = String(state.question || "").trim();
  const context = state.context && typeof state.context === "object" ? state.context : {};
  return { step: "user_question", output: { question, context }, state: { ...state, question, context } };
}

async function stepSchemaInspection({ state, config, settings, fetchImpl }) {
  let connections = [];
  if (settings.tables?.length) {
    const byConn = {};
    for (const t of settings.tables) (byConn[t.connection] ||= []).push({ name: t.table, columns: t.columns || [] });
    connections = Object.entries(byConn).map(([key, tables]) => ({ key, tables }));
    // The selection is bounded, so sample each table now — this makes Field & Table
    // Selection data-aware (e.g. it can tell which table actually has a hashtags column).
    for (const conn of connections) {
      const c = pipelineConnection(conn.key, config);
      for (const t of conn.tables.slice(0, 15)) {
        t.samples = await fetchTableSamples({ connection: c, table: t.name, limit: 2, fetchImpl });
      }
    }
  } else {
    const seen = new Set();
    for (const key of ["content"]) {
      const conn = pipelineConnection(key, config);
      if (!conn.supabaseUrl || !conn.supabaseServiceRoleKey || seen.has(conn.supabaseUrl)) continue;
      seen.add(conn.supabaseUrl);
      try { connections.push({ key, tables: await introspectSupabaseTables(conn, { fetchImpl }) }); } catch (_) { /* skip */ }
    }
  }
  const output = { connections, tableCount: connections.reduce((s, c) => s + c.tables.length, 0), source: settings.tables?.length ? "selection" : "live_scan" };
  return { step: "schema_inspection", output, state: { ...state, schema: output } };
}

async function stepFieldSelection({ state, config, settings, telemetry, chatComplete, fetchImpl }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const schema = state.schema || (await stepSchemaInspection({ state, config, settings, fetchImpl })).output;
  const manifest = (schema.connections || []).map((c) => ({ connection: c.key, tables: c.tables.map((t) => ({ table: t.name, columns: t.columns, samples: (t.samples || []).slice(0, 2) })) }));
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey, model, temperature: 0, maxTokens: 1200,
    timeoutMs: settings.plannerTimeoutMs, responseFormat: { type: "json_object" }, telemetry,
    messages: [
      { role: "system", content: FIELD_SELECTION_PROMPT },
      { role: "user", content: JSON.stringify({ question: state.question, context: state.context || {}, availableSchema: manifest }) }
    ]
  });
  const selection = normalizeFieldSelection(extractJsonObject(content), schema);
  if (!selection.tables.length) throw new Error("no relevant tables were selected for this question");
  // Ground the next step in real data: pull a few sample rows for the chosen tables
  // so SQL Generation can see actual values (e.g. how a hashtags column is formatted).
  const conn = pipelineConnection(selection.connection, config);
  for (const t of selection.tables) {
    t.samples = await fetchTableSamples({ connection: conn, table: t.table, limit: 3, fetchImpl });
  }
  return { step: "field_selection", output: selection, state: { ...state, schema, selection } };
}

async function stepSqlGeneration({ state, config, settings, telemetry, chatComplete }) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const selection = state.selection;
  if (!selection?.tables?.length) throw new Error("run Field & Table Selection first");
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey, model, temperature: 0, maxTokens: 900,
    timeoutMs: settings.plannerTimeoutMs, responseFormat: { type: "json_object" }, telemetry,
    messages: [
      { role: "system", content: SQL_GENERATION_PROMPT },
      { role: "user", content: JSON.stringify({ question: state.question, context: state.context || {}, connection: selection.connection, tables: selection.tables, maxRows: settings.maxRowsPerPlan }) }
    ]
  });
  const parsed = extractJsonObject(content);
  const validation = validateReadOnlySql(parsed.sql || "", { allowedTables: selection.tables.map((t) => t.table) });
  const output = { sql: validation.sql, reason: String(parsed.reason || ""), valid: validation.ok, errors: validation.errors, connection: selection.connection };
  return { step: "sql_generation", output, state: { ...state, sql: output } };
}

async function stepSqlExecution({ state, config, settings, fetchImpl }) {
  const sqlInfo = state.sql;
  if (!sqlInfo?.sql) throw new Error("run SQL Generation first");
  const allowedTables = (state.selection?.tables || []).map((t) => t.table);
  const validation = validateReadOnlySql(sqlInfo.sql, { allowedTables });
  if (!validation.ok) throw new Error(`unsafe SQL rejected: ${validation.errors.join("; ")}`);
  const connection = pipelineConnection(sqlInfo.connection || state.selection?.connection || "app", config);
  const rows = await execReadSql({ connection, sql: validation.sql, maxRows: settings.maxRowsPerPlan, timeoutMs: settings.timeoutMsPerPlan, fetchImpl });
  const output = { rowCount: rows.length, rows: rows.slice(0, settings.maxRowsPerPlan), preview: rows.slice(0, 5) };
  return { step: "sql_execution", output, state: { ...state, execution: output } };
}

function stepCalculation({ state }) {
  const rows = state.execution?.rows || [];
  const metrics = computeQuantitativeMetrics(rows);
  const output = { rowCount: rows.length, metrics };
  return { step: "calculation", output, state: { ...state, calculation: output } };
}

function stepResult({ state }) {
  const metrics = state.calculation?.metrics || computeQuantitativeMetrics(state.execution?.rows || []);
  const rowCount = state.execution?.rowCount ?? 0;
  const answer = buildQuantitativeAnswer({ rowCount, metrics });
  const output = { answer, metrics, rowCount };
  return { step: "result", output, state: { ...state, result: output } };
}

async function runDataQueryStep({ step, state = {}, config = getConfig(), settings = dataQuerySettings(config), telemetry = null, chatComplete = chatCompletion, fetchImpl = fetch } = {}) {
  switch (step) {
    case "user_question": return stepUserQuestion(state);
    case "schema_inspection": return stepSchemaInspection({ state, config, settings, fetchImpl });
    case "field_selection": return stepFieldSelection({ state, config, settings, telemetry, chatComplete, fetchImpl });
    case "sql_generation": return stepSqlGeneration({ state, config, settings, telemetry, chatComplete });
    case "sql_execution": return stepSqlExecution({ state, config, settings, fetchImpl });
    case "calculation": return stepCalculation({ state });
    case "result": return stepResult({ state });
    default: throw new Error(`unknown step: ${step}`);
  }
}

async function runDataQueryPipeline({ question, context = {}, config = getConfig(), settings = dataQuerySettings(config), telemetry = null, onStep = null, chatComplete = chatCompletion, fetchImpl = fetch } = {}) {
  let state = { question: String(question || "").trim(), context: context || {} };
  const steps = [];
  for (const def of DATA_QUERY_PIPELINE_STEPS) {
    try {
      const res = await runDataQueryStep({ step: def.id, state, config, settings, telemetry, chatComplete, fetchImpl });
      state = res.state;
      const entry = { id: def.id, label: def.label, status: "ok", output: res.output };
      steps.push(entry);
      if (typeof onStep === "function") onStep(entry);
    } catch (error) {
      const entry = { id: def.id, label: def.label, status: "error", error: error.message };
      steps.push(entry);
      if (typeof onStep === "function") onStep(entry);
      break;
    }
  }
  return { steps, state, status: steps.some((s) => s.status === "error") ? "error" : "ok" };
}
