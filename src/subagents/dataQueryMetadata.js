export const DATA_QUERY_EXACT_RPC = "bidoc_data_query_data_index_v1";

export const DATA_QUERY_EXACT_OPERATIONS = new Set([
  "count",
  "group_count",
  "aggregate",
  "timeseries",
  "top_n",
  "distinct"
]);

const TEXT_FILTERS = ["eq", "neq", "ilike", "in", "is"];
const ID_FILTERS = ["eq", "neq", "in", "is"];
const ORDERED_FILTERS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"];
const BOOLEAN_FILTERS = ["eq", "neq", "is"];

const DATA_INDEX_FIELDS = [
  field("id", "bigint", { selectable: true, filterOps: ORDERED_FILTERS, aggregations: ["min", "max"], sensitivity: "internal_identifier" }),
  field("created_at", "timestamptz", { selectable: true, filterOps: ORDERED_FILTERS, dateSemantics: "ingestion_time" }),
  field("project_id", "uuid", { selectable: true, filterOps: ID_FILTERS, sensitivity: "internal_identifier" }),
  field("source_table", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("source_id", "text", { filterOps: TEXT_FILTERS, sensitivity: "source_identifier" }),
  field("summary", "text", { sensitivity: "content", queryable: false }),
  field("hashtags", "text[]", { sensitivity: "content", queryable: false }),
  field("index_text", "text", { sensitivity: "content", queryable: false }),
  field("metadata", "jsonb", { sensitivity: "content", queryable: false }),
  field("embedding", "vector", { sensitivity: "derived_content", queryable: false }),
  field("primary_date", "timestamptz", { selectable: true, filterOps: ORDERED_FILTERS, dateSemantics: "canonical_source_time" }),
  field("title", "text", { sensitivity: "content", queryable: false }),
  field("item_status", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("severity_or_risk", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("mail_id", "text", { filterOps: ID_FILTERS, sensitivity: "source_identifier" }),
  field("attachment_id", "text", { filterOps: ID_FILTERS, sensitivity: "source_identifier" }),
  field("source_url", "text", { sensitivity: "source_locator", queryable: false }),
  field("mentioned_dates", "text[]", { sensitivity: "content", queryable: false }),
  field("processed_mentioned", "boolean", { selectable: true, groupable: true, filterOps: BOOLEAN_FILTERS }),
  field("event_date", "date", { selectable: true, filterOps: ORDERED_FILTERS, dateSemantics: "event_time" }),
  field("document_date", "date", { selectable: true, filterOps: ORDERED_FILTERS, dateSemantics: "document_time" })
];

const TABLE_POLICIES = {
  data_index: {
    exactRpc: DATA_QUERY_EXACT_RPC,
    defaultDateField: "primary_date",
    fields: DATA_INDEX_FIELDS
  }
};

export function dataQueryTablePolicy(tableName, selectedColumns = []) {
  const policy = TABLE_POLICIES[String(tableName || "").trim()];
  if (!policy) return null;
  const selected = new Set((selectedColumns || []).map(String));
  const fields = policy.fields.filter((item) => !selected.size || selected.has(item.name));
  return { ...policy, fields };
}

export function inferDataQueryField(name) {
  const value = String(name || "").trim();
  const isDate = /date|created_at|updated_at/.test(value);
  const isNumeric = /count|score|amount|duration|float|confidence|weight/.test(value);
  return field(value, isDate ? "timestamptz" : isNumeric ? "numeric" : "text", {
    selectable: true,
    groupable: !isNumeric,
    filterOps: isDate || isNumeric ? ORDERED_FILTERS : TEXT_FILTERS,
    aggregations: isNumeric ? ["avg", "min", "max", "sum"] : [],
    dateSemantics: isDate ? "unspecified_date" : null,
    sensitivity: "unclassified"
  });
}

export function validateDataQueryFilterValue(definition, op, value) {
  if (!definition) return "field metadata is missing";
  if (!definition.filterOps.includes(op)) return `filter op ${op} is not allowed for ${definition.type}`;
  if (op === "is") {
    const normalized = value === null ? "null" : String(value).toLowerCase();
    if (!["null", "true", "false"].includes(normalized)) return "is filter accepts only null, true, or false";
    if (["true", "false"].includes(normalized) && definition.type !== "boolean") return `is.${normalized} requires a boolean field`;
    return null;
  }
  if (op === "in") {
    if (!Array.isArray(value) || !value.length) return "in filter requires a non-empty array";
    for (const item of value) {
      const error = validateScalar(definition.type, item);
      if (error) return error;
    }
    return null;
  }
  return validateScalar(definition.type, value);
}

function field(name, type, options = {}) {
  const aggregations = options.aggregations || [];
  return {
    name,
    type,
    queryable: options.queryable !== false,
    selectable: options.selectable === true,
    filterOps: options.filterOps || [],
    groupable: options.groupable === true,
    aggregations,
    sensitivity: options.sensitivity || "non_sensitive",
    dateSemantics: options.dateSemantics || null
  };
}

function validateScalar(type, value) {
  if (value === null || value === undefined || value === "") return "filter value is required";
  if (["bigint", "numeric"].includes(type) && !Number.isFinite(Number(value))) return `value ${value} is not numeric`;
  if (type === "boolean" && ![true, false, "true", "false"].includes(value)) return `value ${value} is not boolean`;
  if (type === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))) return `value ${value} is not a UUID`;
  if (["date", "timestamptz"].includes(type) && Number.isNaN(Date.parse(String(value)))) return `value ${value} is not a valid date`;
  return null;
}
