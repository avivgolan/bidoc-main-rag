import { chatCompletion, extractJsonObject, summarizeOpenRouterUsage } from "../openrouter.js";
import { getConfig, readLocalSettings, supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

export const DATA_QUERY_DEFAULTS = {
  enabled: true,
  maxPlans: 5,
  maxRowsPerPlan: 200,
  timeoutMsPerPlan: 8000,
  totalTimeoutMs: 20000,
  allowedTables: [],
  allowedSchemas: ["app", "content"],
  tables: [],
  allowRawSql: false,
  allowJoins: false,
  allowAggregations: true,
  requireHumanApprovalForRawSql: true,
  plannerEnabled: true,
  plannerModel: "",
  plannerTimeoutMs: 30000
};

const READ_OPERATIONS = new Set(["select", "count", "group_count", "aggregate", "timeseries", "top_n", "distinct"]);
const FILTER_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "ilike", "in", "is"]);
const DANGEROUS_SQL = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call)\b|;|--|\/\*/i;

export function dataQuerySettings(config = getConfig()) {
  const saved = readLocalSettings().subagents?.dataQuery || {};
  const raw = { ...DATA_QUERY_DEFAULTS, ...saved };
  // When the user has scanned the real DB and picked tables, the manifest and
  // allowlists are derived from that selection; otherwise fall back to the
  // legacy hardcoded manifest so existing behavior is preserved.
  const selectionTables = normalizeSelectionTables(raw.tables);
  const hasSelection = selectionTables.length > 0;
  const manifest = hasSelection ? buildDataQueryManifestFromSelection(selectionTables) : buildDataQueryManifest(config);
  const allowedTables = hasSelection
    ? [...new Set(selectionTables.map((item) => item.table))]
    : normalizeStringList(raw.allowedTables);
  const allowedSchemas = hasSelection
    ? [...new Set(selectionTables.map((item) => item.connection))]
    : (normalizeStringList(raw.allowedSchemas).length ? normalizeStringList(raw.allowedSchemas) : DATA_QUERY_DEFAULTS.allowedSchemas);
  return {
    enabled: raw.enabled !== false,
    maxPlans: clampNumber(raw.maxPlans, 1, 10, DATA_QUERY_DEFAULTS.maxPlans),
    maxRowsPerPlan: clampNumber(raw.maxRowsPerPlan, 1, 1000, DATA_QUERY_DEFAULTS.maxRowsPerPlan),
    timeoutMsPerPlan: clampNumber(raw.timeoutMsPerPlan, 1000, 60000, DATA_QUERY_DEFAULTS.timeoutMsPerPlan),
    totalTimeoutMs: clampNumber(raw.totalTimeoutMs, 1000, 120000, DATA_QUERY_DEFAULTS.totalTimeoutMs),
    allowedTables,
    allowedSchemas,
    tables: selectionTables,
    usingSelection: hasSelection,
    allowRawSql: raw.allowRawSql === true,
    allowJoins: raw.allowJoins === true,
    allowAggregations: raw.allowAggregations !== false,
    requireHumanApprovalForRawSql: raw.requireHumanApprovalForRawSql !== false,
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
    const connection = String(item?.connection || item?.schema || "app").trim() || "app";
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
  return normalizeSelectionTables(tables).map((item) =>
    tableDef(item.connection, item.table, item.description || `Selected table ${item.schema}.${item.table}`, item.columns)
  );
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
  const indexTable = content.indexTable || "data_index_embeddings_gf_dor_agent";
  const alertsTable = content.alertsTable || "alerts_embeddings_gf";
  const app = (tableName, description, fields, options = {}) => tableDef("app", tableName, description, fields, options);
  const contentTable = (tableName, description, fields, options = {}) => tableDef("content", tableName, description, fields, options);

  return [
    app("chat_messages_gf", "Chat message runs and workflow logs", ["id", "created_at", "updated_at", "session_id", "status", "annotation"]),
    app("qa_reports", "QA report records", ["id", "created_at", "message_id", "status"]),
    app("graph_nodes", "Project graph nodes", ["id", "created_at", "node_type", "label", "source_table", "source_id", "event_date"]),
    app("graph_edges", "Project graph edges", ["id", "created_at", "edge_type", "weight", "confidence", "from_node_id", "to_node_id"]),
    app("timeline_event_links", "Saved timeline links", ["id", "created_at", "source_event_source", "source_event_id", "target_event_source", "target_event_id", "relation_type", "source_date", "target_date"]),
    app("delay_claim_cases", "Delay claim cases", ["id", "created_at", "updated_at", "case_key", "title", "project_id", "human_status", "confidence"]),
    app("delay_events", "Delay event candidates", ["id", "created_at", "updated_at", "case_id", "event_key", "title", "event_type", "start_date", "end_date", "human_status", "confidence", "readiness_score"], {
      defaultDateField: "created_at",
      numericFields: ["confidence", "readiness_score"]
    }),
    app("delay_event_evidence", "Delay event evidence", ["id", "created_at", "event_id", "case_id", "source_type", "supports_or_weakens", "confidence", "human_status"], {
      numericFields: ["confidence"]
    }),
    app("delay_event_gaps", "Delay event gaps", ["id", "created_at", "event_id", "case_id", "urgency", "human_status", "confidence"], {
      numericFields: ["confidence"]
    }),
    app("delay_event_findings", "Delay event findings", ["id", "created_at", "event_id", "case_id", "finding_type", "confidence", "human_status"], {
      numericFields: ["confidence"]
    }),
    app("delay_event_change_log", "Delay event change log", ["id", "created_at", "event_id", "case_id", "changed_by", "change_type", "from_status", "to_status"]),
    app("delay_schedule_versions", "Delay schedule versions", ["id", "created_at", "case_id", "version_key", "title", "schedule_date", "contractual_completion_date", "actual_completion_date", "confidence", "human_status"], {
      numericFields: ["confidence"]
    }),
    app("delay_schedule_activities", "Delay schedule activities", ["id", "created_at", "case_id", "schedule_version_id", "activity_key", "name", "start_date", "finish_date", "duration_days", "float_days", "is_critical", "confidence", "human_status"], {
      numericFields: ["duration_days", "float_days", "confidence"]
    }),
    app("delay_event_schedule_links", "Delay event schedule links", ["id", "created_at", "case_id", "event_id", "schedule_activity_id", "link_type", "confidence", "human_status"], {
      numericFields: ["confidence"]
    }),
    app("delay_cost_items", "Delay cost items", ["id", "created_at", "case_id", "event_id", "cost_key", "title", "cost_type", "amount", "currency", "duplicate_risk", "confidence", "human_status"], {
      numericFields: ["amount", "confidence"]
    }),
    app("delay_claim_exports", "Delay claim exports", ["id", "created_at", "case_id", "export_key", "export_type", "title", "human_status"]),
    app("project_insight_runs", "Persisted project insight runs", ["id", "created_at", "run_id", "parent_run_id", "project_id", "focus_query", "date_from", "date_to", "status", "limit", "expansion"]),
    contentTable(indexTable, "Content index records", ["id", "created_at", "primary_date", "title", "summary", "source_table", "source_id", "project_id", "item_status", "severity_or_risk", "mail_id", "attachment_id", "source_url"], {
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
  const settings = { ...dataQuerySettings(config), ...(input.settings || {}) };
  const warnings = [];
  if (!settings.enabled) {
    return dataQueryResponse({ status: "skipped", answer: "Data Query Agent is disabled.", warnings: ["disabled"], confidence: 0 });
  }

  const question = String(input.question || input.query || "").trim();
  if (!question) {
    return dataQueryResponse({ status: "needs_clarification", answer: "Question is required.", warnings: ["missing_question"], confidence: 0 });
  }

  const planned = await resolveQueryPlan({ input, config, settings, question, warnings });
  const plan = planned.plan;
  let validation = validateQueryPlan(plan, settings);
  if (!validation.ok && !validation.plans.length && planned.source === "llm") {
    warnings.push(...validation.warnings, ...validation.errors);
    warnings.push("llm_plan_rejected_fallback_used");
    const fallbackPlan = buildHeuristicQueryPlan({ question, context: input.context || {}, requestedMetrics: input.requestedMetrics || [], settings });
    const fallbackValidation = validateQueryPlan(fallbackPlan, settings);
    if (fallbackValidation.plans.length) {
      validation = fallbackValidation;
      planned.plan = fallbackPlan;
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
      planner: planned.source
    });
  }

  const results = await executeQueryPlans({
    config,
    settings,
    plans: validation.plans,
    fetchRows: input.fetchRows
  });
  warnings.push(...results.warnings);
  const synthesis = synthesizeDataQueryAnswer({ question, plan: planned.plan, planResults: results.plans, warnings });
  return dataQueryResponse({
    status: results.plans.some((item) => item.status === "ok") ? (results.warnings.length ? "partial" : "ok") : "error",
    answer: synthesis.answer,
    metrics: synthesis.metrics,
    plans: results.plans.map((item) => ({
      id: item.id,
      table: item.table,
      status: item.status,
      rows: Array.isArray(item.rows) ? item.rows.length : 0,
      summary: item.summary,
      error: item.error || undefined
    })),
    tablesUsed: [...new Set(results.plans.filter((item) => item.status === "ok").map((item) => item.table))],
    confidence: Number(planned.plan.confidence || synthesis.confidence || 0.65),
    warnings,
    rawResultsPreview: Object.fromEntries(results.plans.map((item) => [item.id, (item.rows || []).slice(0, 5)])),
    queryPlan: planned.plan,
    planner: planned.source
  });
}

async function resolveQueryPlan({ input, config, settings, question, warnings }) {
  if (input.queryPlan && typeof input.queryPlan === "object") {
    return { plan: input.queryPlan, source: "provided" };
  }
  if (typeof input.planWithLlm === "function") {
    try {
      return {
        plan: await input.planWithLlm({ question, context: input.context || {}, requestedMetrics: input.requestedMetrics || [], config, settings }),
        source: "llm"
      };
    } catch (error) {
      warnings.push(`llm_planner_failed: ${error.message}`);
    }
  } else if (settings.plannerEnabled !== false && !input.disableLlmPlanner && config.openRouterApiKey) {
    try {
      return {
        plan: await planDataQueryWithLlm({
          config,
          settings,
          question,
          context: input.context || {},
          requestedMetrics: input.requestedMetrics || [],
          telemetry: input.telemetry || null
        }),
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
  chatComplete = chatCompletion
} = {}) {
  if (!config.openRouterApiKey) throw new Error("OPENROUTER_API_KEY is missing");
  const manifest = settings.manifest
    .filter((table) => (settings.allowedSchemas || []).includes(table.schemaAlias))
    .filter((table) => !settings.allowedTables.length || settings.allowedTables.includes(table.tableName))
    .map((table) => ({
      schema: table.schemaAlias,
      table: table.tableName,
      description: table.description,
      allowedFields: table.allowedFields,
      dateFields: table.dateFields,
      groupableFields: table.groupableFields,
      numericFields: table.numericFields,
      defaultDateField: table.defaultDateField,
      allowedOperations: table.allowedOperations
    }));
  const model = settings.plannerModel || config.models.knowledgePlanner || config.models.main;
  const content = await chatComplete({
    apiKey: config.openRouterApiKey,
    model,
    temperature: 0,
    maxTokens: 2200,
    timeoutMs: settings.plannerTimeoutMs || DATA_QUERY_DEFAULTS.plannerTimeoutMs,
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
            allowRawSql: false,
            allowJoins: false,
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
- Use only fields listed under each table.
- Every plan must include a stable id, schema, table, operation, limit, and reason.
- limit must be a positive number no larger than maxRowsPerPlan.
- Do not include rawSql, sql, join, joins, semicolons, comments, or SQL keywords.
- If a JOIN would be required, return no executable join; either split into separate plans or add warning "unsupported_join_required".
- If no table is suitable, return {"question": "...", "intent": "needs_clarification", "plans": [], "confidence": 0.2, "warnings": ["needs_clarification"]}.
- Prefer group_count for "by status/date/severity/type" questions.
- Prefer aggregate for count/avg/min/max/sum metrics.
- Use date filters from context only on dateFields/defaultDateField.

Output shape:
{
  "question": "string",
  "intent": "string",
  "plans": [
    {
      "id": "stable_snake_case",
      "schema": "app|content",
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
      schema: String(plan.schema || plan.schemaAlias || "app").trim(),
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

export function buildHeuristicQueryPlan({ question, context = {}, settings = dataQuerySettings() } = {}) {
  const text = String(question || "").toLowerCase();
  const plans = [];
  const add = (plan) => plans.push(plan);
  const dateFrom = context.dateFrom || context.date_from || null;
  const dateTo = context.dateTo || context.date_to || null;
  const dateFilters = (field) => [
    ...(dateFrom ? [{ field, op: "gte", value: dateFrom }] : []),
    ...(dateTo ? [{ field, op: "lte", value: dateTo }] : [])
  ];
  const wantsDelay = /delay|עיכוב|עיכובים|חסם|חסמים/.test(text);
  const wantsGap = /gap|gaps|חוסר|חוסרים|פער|פערים/.test(text);
  const wantsAlert = /alert|alerts|התראה|התראות|חומרה|severity|risk|סיכון/.test(text);
  const wantsInsight = /insight|תובנ|ממצא|findings|מדד|kpi|כמה|count|ספור|פילוח|לפי|status|סטטוס|תמונת מצב/.test(text);

  if (wantsDelay) {
    add({
      id: "delay_events_by_status",
      schema: "app",
      table: "delay_events",
      operation: "group_count",
      filters: dateFilters("created_at"),
      groupBy: ["human_status"],
      limit: Math.min(100, settings.maxRowsPerPlan || 200),
      reason: "Delay status count requested."
    });
  }
  if (wantsGap) {
    add({
      id: "delay_gaps_by_urgency",
      schema: "app",
      table: "delay_event_gaps",
      operation: "group_count",
      filters: dateFilters("created_at"),
      groupBy: ["urgency"],
      limit: Math.min(100, settings.maxRowsPerPlan || 200),
      reason: "Gap urgency count requested."
    });
  }
  if (wantsAlert) {
    const alertsTable = settings.manifest.find((item) => item.schemaAlias === "content" && item.defaultDateField === "data_date")?.tableName || "alerts_embeddings_gf";
    add({
      id: "alerts_by_severity",
      schema: "content",
      table: alertsTable,
      operation: "group_count",
      filters: dateFilters("data_date"),
      groupBy: ["severity_level", "item_status"],
      limit: Math.min(100, settings.maxRowsPerPlan || 200),
      reason: "Alert severity count requested."
    });
  }
  if (!plans.length && wantsInsight) {
    add({
      id: "project_insight_runs_by_status",
      schema: "app",
      table: "project_insight_runs",
      operation: "group_count",
      filters: dateFilters("created_at"),
      groupBy: ["status"],
      limit: Math.min(100, settings.maxRowsPerPlan || 200),
      reason: "Project insight run status count requested."
    });
  }

  return {
    question,
    intent: plans.length > 1 ? "multi_metric_summary" : "metric_lookup",
    plans: plans.slice(0, settings.maxPlans || 5),
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

  for (const original of rawPlans.slice(0, settings.maxPlans)) {
    const plan = normalizePlan(original, settings);
    const planErrors = [];
    if (!plan.id) planErrors.push("plan id is required");
    if (!READ_OPERATIONS.has(plan.operation)) planErrors.push(`operation ${plan.operation || "missing"} is not allowed`);
    if (!allowedSchemas.has(plan.schema)) planErrors.push(`schema ${plan.schema} is not allowed`);
    if (!allowedTables.has(plan.table)) planErrors.push(`table ${plan.table} is not allowed`);
    const table = tableMap.get(`${plan.schema}.${plan.table}`);
    if (!table) planErrors.push(`table ${plan.schema}.${plan.table} is not in the manifest`);
    if (!Number.isFinite(Number(plan.limit)) || Number(plan.limit) <= 0) planErrors.push("limit is required");
    if (plan.join || plan.joins?.length) planErrors.push("joins are not supported");
    if (plan.rawSql || plan.sql) planErrors.push("raw SQL is not supported");
    if (table) {
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
    status: accepted.length ? "partial" : "error",
    plans: errors.length ? [] : accepted,
    warnings,
    errors
  };
}

export async function executeQueryPlans({ config = getConfig(), settings = dataQuerySettings(config), plans = [], fetchRows = null } = {}) {
  const warnings = [];
  const output = [];
  for (const plan of plans) {
    try {
      const rows = fetchRows
        ? await fetchRows(plan)
        : await fetchPlanRows({ config, settings, plan });
      const derived = derivePlanRows(plan, rows);
      output.push({
        id: plan.id,
        table: plan.table,
        status: "ok",
        rows: derived,
        summary: summarizePlanResult(plan, derived)
      });
    } catch (error) {
      warnings.push(`${plan.id}: ${error.message}`);
      output.push({
        id: plan.id,
        table: plan.table,
        status: "error",
        rows: [],
        summary: "Plan failed.",
        error: error.message
      });
    }
  }
  return { plans: output, warnings };
}

function tableDef(schemaAlias, tableName, description, fields, options = {}) {
  const dateFields = options.dateFields || fields.filter((field) => /date|created_at|updated_at/.test(field));
  const numericFields = options.numericFields || fields.filter((field) => /count|score|amount|duration|float|confidence|weight/.test(field));
  return {
    schemaAlias,
    tableName,
    description,
    allowedFields: [...new Set(fields)],
    dateFields,
    searchableFields: options.searchableFields || fields.filter((field) => /title|summary|description|name|label|status|type/.test(field)),
    groupableFields: options.groupableFields || fields.filter((field) => !numericFields.includes(field)),
    numericFields,
    defaultDateField: options.defaultDateField || dateFields[0] || "created_at",
    defaultLimit: options.defaultLimit || 100,
    maxLimit: options.maxLimit || 1000,
    allowedOperations: options.allowedOperations || [...READ_OPERATIONS]
  };
}

function normalizePlan(plan = {}, settings = dataQuerySettings()) {
  return {
    ...plan,
    id: String(plan.id || "").trim(),
    schema: String(plan.schema || plan.schemaAlias || "app").trim(),
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
  const numeric = new Set(table.numericFields);
  const allowedOps = new Set(table.allowedOperations);
  if (!allowedOps.has(plan.operation)) errors.push(`operation ${plan.operation} is not allowed for ${table.tableName}`);
  for (const field of plan.select || []) if (!allowed.has(field)) errors.push(`field ${field} is not allowed`);
  for (const field of plan.groupBy || []) if (!groupable.has(field)) errors.push(`group field ${field} is not allowed`);
  for (const filter of plan.filters || []) {
    if (!allowed.has(filter.field)) errors.push(`filter field ${filter.field} is not allowed`);
    if (!FILTER_OPS.has(filter.op)) errors.push(`filter op ${filter.op} is not allowed`);
  }
  for (const order of plan.orderBy || []) {
    const field = order.field;
    if (!allowed.has(field) && field !== "count" && !plan.metrics?.some((metric) => metric.as === field)) errors.push(`order field ${field} is not allowed`);
  }
  for (const metric of plan.metrics || []) {
    if (!["count", "avg", "min", "max", "sum"].includes(metric.type)) errors.push(`metric ${metric.type} is not allowed`);
    if (metric.type !== "count" && !numeric.has(metric.field)) errors.push(`metric field ${metric.field} is not numeric`);
  }
  return errors;
}

async function fetchPlanRows({ config, settings, plan }) {
  const connection = plan.schema === "content" ? contentSupabaseConfig(config) : config;
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) throw new Error(`${plan.schema} Supabase is not configured`);
  const table = settings.manifest.find((item) => item.schemaAlias === plan.schema && item.tableName === plan.table);
  const select = fieldsForFetch(plan, table).join(",");
  const params = new URLSearchParams({ select, limit: String(plan.limit) });
  applyFilters(params, plan.filters);
  applyOrder(params, plan.orderBy, table);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMsPerPlan);
  const response = await fetch(`${connection.supabaseUrl}/rest/v1/${encodeURIComponent(plan.table)}?${params.toString()}`, {
    signal: controller.signal,
    headers: supabaseHeaders(connection.supabaseServiceRoleKey)
  }).finally(() => clearTimeout(timeout));
  const text = await response.text();
  const data = text ? JSON.parse(text) : [];
  if (!response.ok) throw new Error(data?.message || `Supabase request failed: ${response.status}`);
  return Array.isArray(data) ? data : [];
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
  const metrics = [];
  for (const result of planResults) {
    if (result.status !== "ok") continue;
    const total = result.rows.reduce((sum, row) => sum + Number(row.count || row.events_count || 0), 0);
    if (Number.isFinite(total) && total > 0) {
      metrics.push({ id: `${result.id}_count`, label: result.table, value: total });
    }
  }
  const ok = planResults.filter((item) => item.status === "ok");
  const failed = planResults.filter((item) => item.status !== "ok");
  const answer = ok.length
    ? `Data Query Agent executed ${ok.length} plan(s), returned ${ok.reduce((sum, item) => sum + item.rows.length, 0)} result row(s), and produced ${metrics.length} metric(s).`
    : "Data Query Agent could not execute an approved plan.";
  return {
    answer: failed.length || warnings.length ? `${answer} Warnings: ${[...warnings, ...failed.map((item) => item.error)].filter(Boolean).join("; ")}` : answer,
    metrics,
    confidence: ok.length ? 0.72 : 0.2
  };
}

function summarizePlanResult(plan, rows) {
  if (plan.operation === "group_count") return `Grouped ${plan.table} by ${(plan.groupBy || []).join(", ")}.`;
  if (plan.operation === "aggregate") return `Aggregated ${plan.table}.`;
  if (plan.operation === "count") return `Counted ${plan.table}.`;
  return `Read ${rows.length} row(s) from ${plan.table}.`;
}

function dataQueryResponse({ status, answer, metrics = [], plans = [], tablesUsed = [], confidence = 0, warnings = [], rawResultsPreview = {}, queryPlan = null, planner = null }) {
  return { status, answer, metrics, plans, tablesUsed, confidence, warnings, rawResultsPreview, queryPlan, planner };
}

// Builds a workflow-graph log from a Data Query Agent response so a direct
// subagent test renders the same way a chat-invoked run does in the Workflow tab.
export function buildDataQueryWorkflowLog(result = {}, { question = "", context = {}, openRouterCalls = [] } = {}) {
  const queryPlan = result.queryPlan && typeof result.queryPlan === "object" ? result.queryPlan : {};
  const plannedPlans = Array.isArray(queryPlan.plans) ? queryPlan.plans : [];
  const executedPlans = Array.isArray(result.plans) ? result.plans : [];
  const planner = result.planner || "unknown";
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const previews = result.rawResultsPreview && typeof result.rawResultsPreview === "object" ? result.rawResultsPreview : {};
  const usedFallback = warnings.includes("llm_plan_rejected_fallback_used") || planner === "heuristic_fallback";
  const errored = result.status === "error";

  const nodes = [
    { id: "dq_input", label: "Question Input", kind: "trigger", status: "done" },
    {
      id: "dq_planner",
      label: planner === "llm" ? "LLM Query Planner" : "Heuristic Planner",
      kind: planner === "llm" ? "ai" : "router",
      status: plannedPlans.length ? "done" : "error",
      ...(usedFallback ? { fallback: true } : {})
    },
    { id: "dq_validation", label: "Plan Validation", kind: "router", status: executedPlans.length ? "done" : "error" }
  ];
  const edges = [
    { from: "dq_input", to: "dq_planner" },
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
      input: { question, context },
      output: { intent: queryPlan.intent || null }
    },
    dq_planner: {
      summary: `Planner: ${planner}; ${plannedPlans.length} plan(s) proposed${usedFallback ? " (fallback used)" : ""}`,
      output: queryPlan,
      logs: warnings.filter((w) => /planner|llm|heuristic|fallback|plan_rejected/i.test(w)).map((message) => ({ step: "dq_planner", message }))
    },
    dq_validation: {
      summary: `${executedPlans.length} plan(s) accepted for execution`,
      output: { acceptedPlans: executedPlans.map((p) => ({ id: p.id, table: p.table, status: p.status, rows: p.rows })) },
      logs: warnings.filter((w) => /reject|exceeded|limit|not allowed|forbidden/i.test(w)).map((message) => ({ step: "dq_validation", message }))
    },
    dq_synthesis: {
      summary: result.answer || "",
      output: { metrics: result.metrics || [], tablesUsed: result.tablesUsed || [], confidence: result.confidence }
    },
    dq_output: {
      summary: `status: ${result.status}; ${(result.metrics || []).length} metric(s); ${(result.tablesUsed || []).length} table(s)`,
      output: { status: result.status, warnings, metrics: result.metrics || [] }
    }
  };
  for (const plan of executedPlans) {
    nodeDetails[`dq_exec_${plan.id}`] = {
      summary: plan.summary || `Read from ${plan.table}`,
      input: plannedPlans.find((p) => p.id === plan.id) || { id: plan.id, table: plan.table },
      output: { rows: plan.rows, status: plan.status, error: plan.error || null, preview: previews[plan.id] || [] }
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
      tablesUsed: result.tablesUsed || [],
      metrics: (result.metrics || []).length,
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
