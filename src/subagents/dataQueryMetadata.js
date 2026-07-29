import {
  DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT,
  DATA_QUERY_FINANCIAL_TRANSACTION_TYPE_VALUES
} from "./dataQueryFinancialLexicon.js";

export const DATA_QUERY_EXACT_RPC = "bidoc_data_query_data_index_v1";
export const DATA_QUERY_FINANCIAL_INVOICE_TYPE = "חשבונית";
export const DATA_QUERY_MANAGED_READ_TRANSPORT = "managed_postgrest_read_v1";
export const DATA_QUERY_SAFETY_RISK_VALUES = ["low", "medium", "high", "unknown"];
export const DATA_QUERY_MEETING_STATUS_VALUES = [
  "בביצוע",
  "בוצע",
  "בטיפול",
  "לביצוע",
  "לידיעה",
  "מתעכב"
];
export const DATA_QUERY_ALERT_TYPE_VALUES = ["עדכון", "התראה", "עיכוב", "חריג", "איכות", "אירוע בטיחות"];
export const DATA_QUERY_ALERT_INPUT_TYPE_VALUES = [
  "email",
  "attachment/meeting_summary",
  "attachment/safety_report",
  "attachment/exception_report"
];
export const DATA_QUERY_ALERT_ITEM_STATUS = "בטיפול";
export const DATA_QUERY_ALERT_SEVERITY_LEVEL = 3;
export const DATA_QUERY_EMAIL_CATEGORY_VALUES = [
  "אישורים והיתרים",
  "חוזים והתקשרויות",
  "כספים וחשבונאות",
  "לוחות זמנים",
  "מיילים לניתוח או חיזוי",
  "תיאום וביצוע",
  "תיעוד והחלטות",
  "תפעול וביצוע",
  "תקשורת כללית"
];
export const DATA_QUERY_EMAIL_DIRECTION_VALUES = ["inbound", "outbound"];
export const DATA_QUERY_EMAIL_RELEVANCE_VALUES = ["project_related", "multi_project"];
export const DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE = "no_clear_project";
export const DATA_QUERY_EMAIL_ALLOWED_RELEVANCE_VALUES = [
  ...DATA_QUERY_EMAIL_RELEVANCE_VALUES,
  DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE
];
export const DATA_QUERY_EMAIL_ITEM_STATUS = "בטיפול";
export const DATA_QUERY_EXCEPTION_URGENCY_VALUES = ["לא צוין"];
export const DATA_QUERY_EXCEPTION_ITEM_STATUS_VALUES = ["בטיפול"];
export const DATA_QUERY_EXCEPTION_CURRENCY = "ILS";
export const DATA_QUERY_EXCEPTION_VAT_RATE = 0.18;

const DATA_QUERY_ALERT_TYPE_ALIASES = {
  עדכון: ["עדכון", "update", "updates"],
  התראה: ["התראה", "התראות", "alert", "alerts", "warning", "warnings"],
  עיכוב: ["עיכוב", "עיכובים", "delay", "delays"],
  חריג: ["חריג", "חריגה", "חריגים", "חריגות", "exception", "exceptions", "anomaly", "anomalies"],
  איכות: ["איכות", "quality"],
  "אירוע בטיחות": ["אירוע בטיחות", "אירועי בטיחות", "safety event", "safety events"]
};

const DATA_QUERY_ALERT_INPUT_TYPE_ALIASES = {
  email: ["email", "emails", "mail", "mails", "מייל", "מיילים", "דוא״ל", "דואל"],
  "attachment/meeting_summary": [
    "attachment/meeting_summary",
    "meeting-summary attachment",
    "meeting summary attachment",
    "meeting-summary attachments",
    "meeting summary attachments",
    "קובץ סיכום ישיבה",
    "קבצי סיכום ישיבה"
  ],
  "attachment/safety_report": [
    "attachment/safety_report",
    "safety-report attachment",
    "safety report attachment",
    "safety-report attachments",
    "safety report attachments",
    "קובץ דוח בטיחות",
    "קבצי דוחות בטיחות"
  ],
  "attachment/exception_report": [
    "attachment/exception_report",
    "exception-report attachment",
    "exception report attachment",
    "exception-report attachments",
    "exception report attachments",
    "קובץ דוח חריגים",
    "קבצי דוחות חריגים"
  ]
};

const DATA_QUERY_SAFETY_RISK_RAW_VALUES = {
  low: ["low", "נמוך", "נמוכה"],
  medium: ["medium", "בינוני", "בינונית"],
  high: ["high", "גבוה", "גבוהה"],
  unknown: ["unknown", "לא ידוע", "לא ידועה"]
};

export const DATA_QUERY_EXACT_OPERATIONS = new Set([
  "count",
  "group_count",
  "aggregate",
  "timeseries",
  "top_n",
  "distinct"
]);

export const DATA_QUERY_LOOKUP_OPERATIONS = new Set([
  "lookup_latest",
  "lookup_earliest",
  "lookup_last_n"
]);

const TEXT_FILTERS = ["eq", "neq", "ilike", "in", "is"];
const ID_FILTERS = ["eq", "neq", "in", "is"];
const ORDERED_FILTERS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is"];
const BOOLEAN_FILTERS = ["eq", "neq", "is"];

const DATA_INDEX_FIELDS = [
  field("id", "bigint", { selectable: true, orderable: true, filterOps: ORDERED_FILTERS, aggregations: ["min", "max"], sensitivity: "internal_identifier" }),
  field("created_at", "timestamptz", { selectable: true, orderable: true, filterOps: ORDERED_FILTERS, dateSemantics: "ingestion_time" }),
  field("project_id", "uuid", { selectable: true, filterOps: ID_FILTERS, sensitivity: "internal_identifier" }),
  field("source_table", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("source_id", "text", { filterOps: TEXT_FILTERS, sensitivity: "source_identifier" }),
  field("summary", "text", { sensitivity: "content", queryable: false }),
  field("hashtags", "text[]", { sensitivity: "content", queryable: false }),
  field("index_text", "text", { sensitivity: "content", queryable: false }),
  field("metadata", "jsonb", { sensitivity: "content", queryable: false }),
  field("embedding", "vector", { sensitivity: "derived_content", queryable: false }),
  field("primary_date", "timestamptz", { selectable: true, orderable: true, filterOps: ORDERED_FILTERS, dateSemantics: "canonical_source_time" }),
  field("title", "text", { sensitivity: "content", queryable: false }),
  field("item_status", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("severity_or_risk", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("mail_id", "text", { filterOps: ID_FILTERS, sensitivity: "source_identifier" }),
  field("attachment_id", "text", { filterOps: ID_FILTERS, sensitivity: "source_identifier" }),
  field("source_url", "text", { sensitivity: "source_locator", queryable: false }),
  field("mentioned_dates", "text[]", { sensitivity: "content", queryable: false }),
  field("processed_mentioned", "boolean", { selectable: true, groupable: true, filterOps: BOOLEAN_FILTERS }),
  field("event_date", "date", { selectable: true, orderable: true, filterOps: ORDERED_FILTERS, dateSemantics: "event_time" }),
  field("document_date", "date", { selectable: true, orderable: true, filterOps: ORDERED_FILTERS, dateSemantics: "document_time" })
];

const FINANCIAL_TRANSACTION_FIELDS = [
  field("id", "bigint", { selectable: true, orderable: true, filterOps: ORDERED_FILTERS, sensitivity: "internal_identifier" }),
  field("project_id", "uuid", { filterOps: ID_FILTERS, sensitivity: "internal_identifier" }),
  field("transaction_date", "timestamptz", {
    selectable: true,
    orderable: true,
    filterOps: ORDERED_FILTERS,
    dateSemantics: "canonical_transaction_time"
  }),
  field("category", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("status", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("vendor_name", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS, sensitivity: "business_counterparty" }),
  field("transaction_type", "text", {
    selectable: true,
    groupable: true,
    filterOps: TEXT_FILTERS,
    allowedValues: DATA_QUERY_FINANCIAL_TRANSACTION_TYPE_VALUES
  }),
  field("item_status", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("currency", "text", { selectable: true, groupable: true, filterOps: TEXT_FILTERS }),
  field("created_at", "timestamptz", { queryable: false, dateSemantics: "ingestion_time" }),
  field("amount_numeric", "numeric", {
    queryable: false,
    notComputableReason: "the catalog snapshot found no populated values"
  }),
  field("amount_including_vat", "numeric", {
    queryable: false,
    notComputableReason: "the catalog snapshot found no populated values"
  }),
  field("report_total_numeric", "numeric", {
    queryable: false,
    notComputableReason: "the catalog snapshot found no populated values"
  }),
  field("amount_original", "text", { queryable: false, sensitivity: "untrusted_amount_text" }),
  field("report_total_original", "text", { queryable: false, sensitivity: "untrusted_amount_text" }),
  field("total", "text", { queryable: false, sensitivity: "untrusted_amount_text" }),
  field("topic", "text", { queryable: false, sensitivity: "content" }),
  field("short_description", "text", { queryable: false, sensitivity: "content" }),
  field("summary", "text", { queryable: false, sensitivity: "content" }),
  field("content", "text", { queryable: false, sensitivity: "content" }),
  field("metadata", "jsonb", { queryable: false, sensitivity: "content" }),
  field("embedding", "vector", { queryable: false, sensitivity: "derived_content" }),
  field("people", "text", { queryable: false, sensitivity: "personal_data" }),
  field("transaction_submitter", "text", { queryable: false, sensitivity: "personal_data" }),
  field("mail_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("email_attachment_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("source_document_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("document_filename", "text", { queryable: false, sensitivity: "source_locator" }),
  field("data_link", "text", { queryable: false, sensitivity: "source_locator" }),
  field("hashtags", "text[]", { queryable: false, sensitivity: "content" })
];

const SAFETY_REPORT_FIELDS = [
  field("id", "bigint", {
    selectable: true,
    orderable: true,
    filterOps: ORDERED_FILTERS,
    sensitivity: "internal_identifier"
  }),
  field("project_id", "uuid", {
    filterOps: ID_FILTERS,
    sensitivity: "internal_identifier"
  }),
  field("report_date", "timestamptz", {
    selectable: true,
    orderable: true,
    groupable: true,
    filterOps: ORDERED_FILTERS,
    dateSemantics: "canonical_report_time"
  }),
  field("site_location", "text", {
    selectable: true,
    groupable: true,
    filterOps: TEXT_FILTERS
  }),
  field("risk_level", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in", "is"],
    allowedValues: [
      ...DATA_QUERY_SAFETY_RISK_VALUES,
      ...Object.values(DATA_QUERY_SAFETY_RISK_RAW_VALUES).flat()
    ]
  }),
  field("site_grade", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "neq", "in", "is"],
    allowedValues: ["0", "5", "75", "80", "85", "86", "95", "99", "100"]
  }),
  field("item_status", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "neq", "in", "is"],
    allowedValues: ["בטיפול"]
  }),
  field("total_workers", "integer", {
    selectable: true,
    aggregations: [],
    notComputableReason: "worker headcounts are per-report snapshots and are not semantically additive across reports"
  }),
  field("life_threatening_defects", "integer", {
    selectable: true,
    aggregations: ["sum"]
  }),
  field("severe_defects", "integer", {
    selectable: true,
    aggregations: ["sum"]
  }),
  field("medium_defects", "integer", {
    selectable: true,
    aggregations: ["sum"]
  }),
  field("minor_defects", "integer", {
    selectable: true,
    aggregations: ["sum"]
  }),
  field("resolved", "integer", {
    queryable: false,
    notComputableReason: "the resolved counter has no verified scope and exceeds typed defect totals in audited rows"
  }),
  field("created_at", "timestamptz", {
    queryable: false,
    dateSemantics: "ingestion_time"
  }),
  field("processed_for_insights", "boolean", { queryable: false }),
  field("project_manager", "text", {
    queryable: false,
    sensitivity: "personal_data"
  }),
  field("site_manager", "text", {
    queryable: false,
    sensitivity: "personal_data"
  }),
  field("mail_id", "text", {
    queryable: false,
    sensitivity: "source_identifier"
  }),
  field("attachment_id", "text", {
    queryable: false,
    sensitivity: "source_identifier"
  }),
  field("document_filename", "text", {
    queryable: false,
    sensitivity: "source_locator"
  }),
  field("defect_details", "text", {
    queryable: false,
    sensitivity: "content"
  }),
  field("summary", "text", {
    queryable: false,
    sensitivity: "content"
  }),
  field("content", "text", {
    queryable: false,
    sensitivity: "content"
  }),
  field("hashtags", "text[]", {
    queryable: false,
    sensitivity: "content"
  }),
  field("metadata", "jsonb", {
    queryable: false,
    sensitivity: "content"
  }),
  field("embedding", "vector", {
    queryable: false,
    sensitivity: "derived_content"
  })
];

const MEETING_FIELDS = [
  field("id", "bigint", {
    selectable: true,
    orderable: true,
    filterOps: [],
    sensitivity: "internal_identifier"
  }),
  field("project_id", "uuid", {
    filterOps: ["eq"],
    runtimeScopeOnly: true,
    sensitivity: "internal_identifier"
  }),
  field("meeting_date", "timestamptz", {
    selectable: true,
    orderable: true,
    groupable: true,
    filterOps: ["eq", "gt", "gte", "lt", "lte", "is"],
    dateSemantics: "canonical_meeting_time"
  }),
  field("status", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_MEETING_STATUS_VALUES
  }),
  field("created_at", "timestamptz", {
    queryable: false,
    dateSemantics: "ingestion_time"
  }),
  field("meeting_hour", "text", { queryable: false }),
  field("subject", "text", { queryable: false, sensitivity: "possible_personal_data" }),
  field("item_status", "text", { queryable: false }),
  field("processed_for_insights", "boolean", { queryable: false }),
  field("description", "text", { queryable: false, sensitivity: "content" }),
  field("meeting_goal", "text", { queryable: false, sensitivity: "content" }),
  field("summary", "text", { queryable: false, sensitivity: "content" }),
  field("content", "text", { queryable: false, sensitivity: "content" }),
  field("decisions_made", "text", { queryable: false, sensitivity: "content" }),
  field("attendances", "text", { queryable: false, sensitivity: "personal_data" }),
  field("mentioned_responsibles", "jsonb", { queryable: false, sensitivity: "personal_data" }),
  field("mentioned_dates", "jsonb", { queryable: false, sensitivity: "content" }),
  field("hashtags", "text[]", { queryable: false, sensitivity: "content" }),
  field("metadata", "jsonb", { queryable: false, sensitivity: "content" }),
  field("embedding", "vector", { queryable: false, sensitivity: "derived_content" }),
  field("mail_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("attachment_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("external_meeting_ref", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("document_filename", "text", { queryable: false, sensitivity: "source_locator" })
];

const ALERT_FIELDS = [
  field("id", "bigint", {
    selectable: true,
    orderable: true,
    filterOps: [],
    sensitivity: "internal_identifier"
  }),
  field("project_id", "uuid", {
    filterOps: ["eq"],
    runtimeScopeOnly: true,
    sensitivity: "internal_identifier"
  }),
  field("data_date", "timestamptz", {
    selectable: true,
    orderable: true,
    filterOps: ["eq", "gt", "gte", "lt", "lte", "is"],
    dateSemantics: "canonical_alert_time"
  }),
  field("alert_type", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_ALERT_TYPE_VALUES
  }),
  field("severity_level", "smallint", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: [DATA_QUERY_ALERT_SEVERITY_LEVEL]
  }),
  field("input_data_type", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_ALERT_INPUT_TYPE_VALUES
  }),
  field("item_status", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: [DATA_QUERY_ALERT_ITEM_STATUS]
  }),
  field("is_relevant", "boolean", {
    selectable: true,
    groupable: true,
    filterOps: ["eq"]
  }),
  field("status", "text", {
    queryable: false,
    notComputableReason: "the audited table has no populated lifecycle status values"
  }),
  field("created_at", "timestamptz", {
    queryable: false,
    dateSemantics: "ingestion_time"
  }),
  field("question", "text", { queryable: false, sensitivity: "content" }),
  field("answer", "text", { queryable: false, sensitivity: "content" }),
  field("alert_description", "text", { queryable: false, sensitivity: "content" }),
  field("analyzed_data", "jsonb", { queryable: false, sensitivity: "content" }),
  field("summary", "text", { queryable: false, sensitivity: "content" }),
  field("content", "text", { queryable: false, sensitivity: "content" }),
  field("hashtags", "text[]", { queryable: false, sensitivity: "content" }),
  field("metadata", "jsonb", { queryable: false, sensitivity: "content" }),
  field("embedding", "vector", { queryable: false, sensitivity: "derived_content" }),
  field("input_data_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("data_link", "text", { queryable: false, sensitivity: "source_locator" })
];

const EMAIL_FIELDS = [
  field("id", "bigint", {
    selectable: true,
    orderable: true,
    filterOps: [],
    sensitivity: "internal_identifier"
  }),
  field("project_id", "uuid", {
    filterOps: ["eq"],
    runtimeScopeOnly: true,
    sensitivity: "internal_identifier"
  }),
  field("received_date", "timestamptz", {
    selectable: true,
    orderable: true,
    groupable: true,
    filterOps: ["eq", "gt", "gte", "lt", "lte"],
    dateSemantics: "canonical_email_receipt_time"
  }),
  field("mail_category", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_EMAIL_CATEGORY_VALUES
  }),
  field("direction", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_EMAIL_DIRECTION_VALUES
  }),
  field("has_attachments", "boolean", {
    selectable: true,
    groupable: true,
    filterOps: ["eq"]
  }),
  field("relevance_status", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_EMAIL_ALLOWED_RELEVANCE_VALUES
  }),
  field("item_status", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: [DATA_QUERY_EMAIL_ITEM_STATUS]
  }),
  field("created_at", "timestamptz", {
    queryable: false,
    dateSemantics: "ingestion_time"
  }),
  field("mail_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("conversationid", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("sender_name", "text", { queryable: false, sensitivity: "personal_data" }),
  field("sender_mail", "text", { queryable: false, sensitivity: "personal_data" }),
  field("other_recipients", "text[]", { queryable: false, sensitivity: "personal_data" }),
  field("subject", "text", { queryable: false, sensitivity: "content" }),
  field("summary", "text", { queryable: false, sensitivity: "content" }),
  field("mail_summarize", "text", { queryable: false, sensitivity: "content" }),
  field("mail_body", "text", { queryable: false, sensitivity: "content" }),
  field("content", "text", { queryable: false, sensitivity: "content" }),
  field("hashtags", "text[]", { queryable: false, sensitivity: "content" }),
  field("metadata", "jsonb", { queryable: false, sensitivity: "content" }),
  field("embedding", "vector", { queryable: false, sensitivity: "derived_content" })
];

const EXCEPTION_REPORT_FIELDS = [
  field("id", "bigint", {
    selectable: true,
    orderable: true,
    filterOps: [],
    sensitivity: "internal_identifier"
  }),
  field("project_id", "uuid", {
    filterOps: ["eq"],
    runtimeScopeOnly: true,
    sensitivity: "internal_identifier"
  }),
  field("exception_date", "timestamptz", {
    selectable: true,
    orderable: true,
    groupable: true,
    filterOps: ["eq", "gt", "gte", "lt", "lte", "is"],
    dateSemantics: "canonical_exception_time"
  }),
  field("urgency_level", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_EXCEPTION_URGENCY_VALUES
  }),
  field("item_status", "text", {
    selectable: true,
    groupable: true,
    filterOps: ["eq", "in"],
    allowedValues: DATA_QUERY_EXCEPTION_ITEM_STATUS_VALUES
  }),
  field("created_at", "timestamptz", { queryable: false, dateSemantics: "ingestion_time" }),
  field("exception_number", "integer", {
    queryable: false,
    sensitivity: "business_identifier",
    notComputableReason: "exception numbers are incomplete and duplicated and are not the stable record identity"
  }),
  field("supervision_company", "text", { queryable: false, sensitivity: "business_counterparty" }),
  field("inspector", "text", { queryable: false, sensitivity: "personal_data" }),
  field("project_manager", "text", { queryable: false, sensitivity: "personal_data" }),
  field("exception_subject", "text", { queryable: false, sensitivity: "content" }),
  field("execution_days", "integer", {
    queryable: false,
    notComputableReason: "execution_days is populated in only one audited row"
  }),
  field("requested_amount_ex_vat", "numeric", {
    aggregations: ["sum"],
    sensitivity: "sensitive_business_data"
  }),
  field("vat_amount", "numeric", { queryable: false, sensitivity: "sensitive_business_data" }),
  field("total_amount_incl_vat", "numeric", { queryable: false, sensitivity: "sensitive_business_data" }),
  field("main_contractor_profit", "numeric", { queryable: false, sensitivity: "sensitive_business_data" }),
  field("mail_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("attachment_id", "text", { queryable: false, sensitivity: "source_identifier" }),
  field("processed_for_insights", "boolean", { queryable: false }),
  field("hashtags", "text[]", { queryable: false, sensitivity: "content" }),
  field("summary", "text", { queryable: false, sensitivity: "content" }),
  field("content", "text", { queryable: false, sensitivity: "content" }),
  field("metadata", "jsonb", { queryable: false, sensitivity: "content" }),
  field("embedding", "vector", { queryable: false, sensitivity: "derived_content" })
];

const TABLE_POLICIES = {
  data_index: {
    exactRpc: DATA_QUERY_EXACT_RPC,
    defaultDateField: "primary_date",
    lookupPolicy: {
      enabled: false,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "primary_date",
      orderableFields: ["primary_date", "event_date", "document_date", "created_at"],
      stableIdField: "id",
      maxRows: 50,
      cacheable: false
    },
    fields: DATA_INDEX_FIELDS
  },
  financial_transactions: {
    exactRpc: null,
    managedReadTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
    executionContract: {
      status: "dormant",
      requiredTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
      deploymentRequired: false,
      readOnly: true,
      methods: ["GET", "HEAD"],
      table: "financial_transactions"
    },
    declaredExactOperations: ["count", "group_count", "timeseries", "distinct"],
    allowedOperations: ["count", "group_count", "timeseries", "distinct", ...DATA_QUERY_LOOKUP_OPERATIONS],
    defaultDateField: "transaction_date",
    maxLimit: 200,
    lookupPolicy: {
      enabled: true,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "transaction_date",
      orderableFields: ["transaction_date"],
      stableIdField: "id",
      maxRows: 25,
      allRowsMax: DATA_QUERY_FINANCIAL_ALL_ROWS_LIMIT,
      cacheable: false
    },
    fields: FINANCIAL_TRANSACTION_FIELDS
  },
  safety_reports: {
    exactRpc: null,
    managedReadTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
    executionContract: {
      status: "dormant",
      requiredTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
      deploymentRequired: false,
      readOnly: true,
      methods: ["GET", "HEAD"],
      table: "safety_reports"
    },
    declaredExactOperations: ["count", "group_count", "aggregate", "timeseries", "distinct"],
    allowedOperations: [
      "count",
      "group_count",
      "aggregate",
      "timeseries",
      "distinct",
      ...DATA_QUERY_LOOKUP_OPERATIONS
    ],
    defaultDateField: "report_date",
    maxLimit: 200,
    lookupPolicy: {
      enabled: true,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "report_date",
      orderableFields: ["report_date"],
      stableIdField: "id",
      maxRows: 25,
      cacheable: false
    },
    valueNormalization: {
      riskField: "risk_level",
      riskValues: DATA_QUERY_SAFETY_RISK_RAW_VALUES
    },
    notComputableCapabilities: {
      workerAggregates: "worker headcounts are per-report snapshots and are not semantically additive across reports",
      resolutionStatus: "the table has no verified report-level resolved/unresolved status"
    },
    fields: SAFETY_REPORT_FIELDS
  },
  meetings: {
    exactRpc: null,
    managedReadTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
    executionContract: {
      status: "dormant",
      requiredTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
      deploymentRequired: false,
      readOnly: true,
      methods: ["GET", "HEAD"],
      table: "meetings"
    },
    declaredExactOperations: ["count", "group_count", "timeseries", "distinct"],
    allowedOperations: ["count", "group_count", "timeseries", "distinct", ...DATA_QUERY_LOOKUP_OPERATIONS],
    defaultDateField: "meeting_date",
    maxLimit: 200,
    lookupPolicy: {
      enabled: true,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "meeting_date",
      orderableFields: ["meeting_date"],
      stableIdField: "id",
      maxRows: 25,
      cacheable: false
    },
    notComputableCapabilities: {
      decisionPresence: "meeting decision presence requires semantic interpretation of excluded decision content",
      semanticContent: "decisions, commitments, quotes, participants, rationale, responsibility, and deadlines require Meeting Evidence"
    },
    fields: MEETING_FIELDS
  },
  alerts: {
    exactRpc: null,
    managedReadTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
    executionContract: {
      status: "dormant",
      requiredTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
      deploymentRequired: false,
      readOnly: true,
      methods: ["GET", "HEAD"],
      table: "alerts"
    },
    declaredExactOperations: ["count", "group_count", "timeseries"],
    allowedOperations: ["count", "group_count", "timeseries", ...DATA_QUERY_LOOKUP_OPERATIONS],
    defaultDateField: "data_date",
    maxLimit: 200,
    lookupPolicy: {
      enabled: true,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "data_date",
      orderableFields: ["data_date"],
      stableIdField: "id",
      maxRows: 25,
      cacheable: false
    },
    valueNormalization: {
      alertTypeAliases: DATA_QUERY_ALERT_TYPE_ALIASES,
      inputTypeAliases: DATA_QUERY_ALERT_INPUT_TYPE_ALIASES,
      storedItemStatus: DATA_QUERY_ALERT_ITEM_STATUS,
      storedSeverityLevel: DATA_QUERY_ALERT_SEVERITY_LEVEL
    },
    notComputableCapabilities: {
      semanticSeverity: "severity level 3 has no audited critical, high, medium, low, or urgency meaning",
      lifecycleStatus: "the table has no trustworthy alert-level lifecycle status",
      uniqueSources: "stored source identifiers have no approved unique-source or relationship contract",
      sourceLinks: "the exact alert contract has no authorization-bound source-link resolver"
    },
    fields: ALERT_FIELDS
  },
  emails: {
    exactRpc: null,
    managedReadTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
    executionContract: {
      status: "dormant",
      requiredTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
      deploymentRequired: false,
      readOnly: true,
      methods: ["GET", "HEAD"],
      table: "emails"
    },
    declaredExactOperations: ["count", "group_count", "timeseries", "distinct"],
    allowedOperations: ["count", "group_count", "timeseries", "distinct", ...DATA_QUERY_LOOKUP_OPERATIONS],
    defaultDateField: "received_date",
    maxLimit: 200,
    lookupPolicy: {
      enabled: true,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "received_date",
      orderableFields: ["received_date"],
      stableIdField: "id",
      maxRows: 25,
      cacheable: false
    },
    valueNormalization: {
      projectRelatedValues: DATA_QUERY_EMAIL_RELEVANCE_VALUES,
      noClearProjectValue: DATA_QUERY_EMAIL_NO_CLEAR_RELEVANCE,
      directionValues: DATA_QUERY_EMAIL_DIRECTION_VALUES,
      categoryValues: DATA_QUERY_EMAIL_CATEGORY_VALUES,
      storedItemStatus: DATA_QUERY_EMAIL_ITEM_STATUS
    },
    notComputableCapabilities: {
      personalData: "sender and recipient names and addresses are excluded from Data Query",
      semanticContent: "subject meaning, body, requests, approvals, rejections, intent, and quotations require retrieval",
      attachmentDocuments: "attachment existence is typed metadata, but attachment rows, filenames, counts, and links are not an approved exact projection"
    },
    fields: EMAIL_FIELDS
  },
  exceptions_report: {
    exactRpc: null,
    managedReadTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
    executionContract: {
      status: "dormant",
      requiredTransport: DATA_QUERY_MANAGED_READ_TRANSPORT,
      deploymentRequired: false,
      readOnly: true,
      methods: ["GET", "HEAD"],
      table: "exceptions_report"
    },
    declaredExactOperations: ["count", "group_count", "aggregate", "timeseries"],
    allowedOperations: ["count", "group_count", "aggregate", "timeseries", ...DATA_QUERY_LOOKUP_OPERATIONS],
    defaultDateField: "exception_date",
    maxLimit: 200,
    lookupPolicy: {
      enabled: true,
      operations: [...DATA_QUERY_LOOKUP_OPERATIONS],
      defaultOrderField: "exception_date",
      orderableFields: ["exception_date"],
      stableIdField: "id",
      maxRows: 25,
      cacheable: false
    },
    valueNormalization: {
      urgencyValues: DATA_QUERY_EXCEPTION_URGENCY_VALUES,
      itemStatusValues: DATA_QUERY_EXCEPTION_ITEM_STATUS_VALUES,
      currency: DATA_QUERY_EXCEPTION_CURRENCY,
      vatRate: DATA_QUERY_EXCEPTION_VAT_RATE
    },
    notComputableCapabilities: {
      requestedAmount: "only a coverage-qualified subtotal of populated requested_amount_ex_vat values is computable in ILS; an including-VAT display value may be calculated at the fixed 18% rate, but neither figure is an authoritative all-exception total while rows are missing amounts",
      executionDays: "execution_days is populated in only one audited row",
      identityGrouping: "inspector and manager are personal data; company groups are identifying in the small dataset",
      category: "the source has no approved stored category field"
    },
    fields: EXCEPTION_REPORT_FIELDS
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
      const allowedError = validateAllowedValue(definition, item);
      if (allowedError) return allowedError;
    }
    return null;
  }
  return validateScalar(definition.type, value) || validateAllowedValue(definition, value);
}

export function canonicalizeDataQuerySafetyRisk(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("en");
  if (!normalized) return null;
  for (const [canonical, rawValues] of Object.entries(DATA_QUERY_SAFETY_RISK_RAW_VALUES)) {
    if (rawValues.some((raw) => raw.toLocaleLowerCase("en") === normalized)) {
      return canonical;
    }
  }
  return null;
}

export function dataQuerySafetyRiskRawValues(value) {
  const canonical = canonicalizeDataQuerySafetyRisk(value);
  return canonical ? [...DATA_QUERY_SAFETY_RISK_RAW_VALUES[canonical]] : [];
}

export function canonicalizeDataQueryAlertType(value) {
  return canonicalizeAliasValue(value, DATA_QUERY_ALERT_TYPE_ALIASES);
}

export function canonicalizeDataQueryAlertInputType(value) {
  return canonicalizeAliasValue(value, DATA_QUERY_ALERT_INPUT_TYPE_ALIASES);
}

export function dataQueryAlertTypeAliases(value) {
  const canonical = canonicalizeDataQueryAlertType(value);
  return canonical ? [...DATA_QUERY_ALERT_TYPE_ALIASES[canonical]] : [];
}

export function dataQueryAlertInputTypeAliases(value) {
  const canonical = canonicalizeDataQueryAlertInputType(value);
  return canonical ? [...DATA_QUERY_ALERT_INPUT_TYPE_ALIASES[canonical]] : [];
}

function canonicalizeAliasValue(value, vocabulary) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("en");
  if (!normalized) return null;
  for (const [canonical, aliases] of Object.entries(vocabulary)) {
    if (aliases.some((alias) => String(alias).toLocaleLowerCase("en") === normalized)) return canonical;
  }
  return null;
}

function field(name, type, options = {}) {
  const aggregations = options.aggregations || [];
  return {
    name,
    type,
    queryable: options.queryable !== false,
    selectable: options.selectable === true,
    orderable: options.orderable === true,
    filterOps: options.filterOps || [],
    groupable: options.groupable === true,
    aggregations,
    sensitivity: options.sensitivity || "non_sensitive",
    dateSemantics: options.dateSemantics || null,
    notComputableReason: options.notComputableReason || null,
    runtimeScopeOnly: options.runtimeScopeOnly === true,
    allowedValues: Array.isArray(options.allowedValues) ? [...new Set(options.allowedValues)] : null
  };
}

function validateAllowedValue(definition, value) {
  if (!Array.isArray(definition?.allowedValues) || !definition.allowedValues.length) return null;
  return definition.allowedValues.some((allowed) => String(allowed) === String(value))
    ? null
    : `value ${value} is outside the approved vocabulary`;
}

function validateScalar(type, value) {
  if (value === null || value === undefined || value === "") return "filter value is required";
  if (["bigint", "integer", "numeric"].includes(type) && !Number.isFinite(Number(value))) return `value ${value} is not numeric`;
  if (type === "boolean" && ![true, false, "true", "false"].includes(value)) return `value ${value} is not boolean`;
  if (type === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value))) return `value ${value} is not a UUID`;
  if (["date", "timestamptz"].includes(type) && Number.isNaN(Date.parse(String(value)))) return `value ${value} is not a valid date`;
  return null;
}
