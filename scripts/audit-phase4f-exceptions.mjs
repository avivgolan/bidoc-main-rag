import { getConfig, loadEnv, supabaseHeaders } from "../src/config.js";
import { resolveDataQuerySupabaseHeaders } from "../src/subagents/dataQuery.js";

loadEnv();

const config = getConfig();
const managedHeaders = await resolveDataQuerySupabaseHeaders(config, {
  Accept: "application/json",
  Prefer: "count=exact"
});
const semanticHeaders = {
  ...supabaseHeaders(config.contentSource.supabaseServiceRoleKey),
  Accept: "application/json",
  Prefer: "count=exact"
};

async function readAll(table, select, headers, { orderField = "id", filters = {} } = {}) {
  const rows = [];
  let total = null;

  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select,
      limit: "1000",
      offset: String(offset)
    });
    if (orderField) params.set("order", `${orderField}.asc`);
    for (const [field, predicate] of Object.entries(filters)) params.set(field, predicate);
    const response = await fetch(
      `${config.contentSource.supabaseUrl}/rest/v1/${table}?${params}`,
      { headers }
    );
    if (!response.ok) throw new Error(`${table} read failed with status ${response.status}`);

    const page = await response.json();
    const parsedTotal = Number((response.headers.get("content-range") || "").split("/")[1]);
    if (!Number.isFinite(parsedTotal)) throw new Error(`${table} response omitted its exact total`);
    if (total !== null && total !== parsedTotal) throw new Error(`${table} total changed during audit`);
    total = parsedTotal;
    rows.push(...page);

    if (rows.length >= total) break;
    if (!page.length) throw new Error(`${table} audit ended before its exact total`);
  }

  if (rows.length !== total) throw new Error(`${table} audit did not reconcile to its exact total`);
  return rows;
}

const EXCEPTION_SELECT = [
  "id",
  "project_id",
  "created_at",
  "exception_date",
  "exception_number",
  "supervision_company",
  "inspector",
  "project_manager",
  "exception_subject",
  "execution_days",
  "requested_amount_ex_vat",
  "vat_amount",
  "total_amount_incl_vat",
  "main_contractor_profit",
  "mail_id",
  "attachment_id",
  "processed_for_insights",
  "urgency_level",
  "item_status",
  "hashtags",
  "summary",
  "content"
].join(",");
const DOCUMENT_SELECT = [
  "id",
  "project_id",
  "source_id",
  "attachment_id",
  "chunk_index",
  "chunk_total",
  "primary_date",
  "content"
].join(",");

const exceptions = await readAll("exceptions_report", EXCEPTION_SELECT, managedHeaders);
const managedDocuments = await readAll(
  "exceptions_report_documents",
  DOCUMENT_SELECT,
  managedHeaders
);
const semanticDocuments = await readAll(
  "exceptions_report_documents",
  DOCUMENT_SELECT,
  semanticHeaders
);
const indexedExceptions = await readAll(
  "data_index",
  "id,project_id,source_table,source_id",
  semanticHeaders,
  { filters: { source_table: "eq.exceptions_report" } }
);

const text = (value) => String(value ?? "").trim();
const populated = (rows, field) => rows.filter((row) => text(row[field])).length;
const uniqueCount = (rows, field) => new Set(rows.map((row) => text(row[field])).filter(Boolean)).size;
const groups = (rows, field) => Object.entries(rows.reduce((counts, row) => {
  const value = row[field] === null || row[field] === undefined || row[field] === ""
    ? "<null>"
    : String(row[field]);
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {})).sort(([left], [right]) => left.localeCompare(right));
const distributionShape = (rows, field) => {
  const counts = groups(rows, field).filter(([value]) => value !== "<null>").map(([, count]) => count);
  return {
    populated: populated(rows, field),
    distinct: uniqueCount(rows, field),
    singletonGroups: counts.filter((count) => count === 1).length,
    largestGroup: counts.length ? Math.max(...counts) : null
  };
};
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const finiteNumbers = (field) => exceptions
  .map((row) => row[field])
  .filter((value) => value !== null && value !== undefined && value !== "")
  .map(Number);
const numericShape = (field) => {
  const values = finiteNumbers(field);
  return {
    populated: values.length,
    missing: exceptions.length - values.length,
    finite: values.filter(Number.isFinite).length,
    negative: values.filter((value) => Number.isFinite(value) && value < 0).length,
    zero: values.filter((value) => Number.isFinite(value) && value === 0).length,
    positive: values.filter((value) => Number.isFinite(value) && value > 0).length,
    fractional: values.filter((value) => Number.isFinite(value) && !Number.isInteger(value)).length
  };
};

const ids = exceptions.map((row) => row.id);
const exceptionNumbers = exceptions.map((row) => row.exception_number)
  .filter((value) => value !== null && value !== undefined && value !== "");
const dateValues = exceptions.map((row) => text(row.exception_date)).filter(Boolean);
const parsedDates = dateValues.map((value) => Date.parse(value));
const validDates = parsedDates.filter(Number.isFinite);
const dateCounts = Object.values(dateValues.reduce((counts, value) => {
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {}));
const exceptionKeys = new Set(exceptions.map((row) => `${text(row.project_id)}|${String(row.id)}`));
const documentKeys = new Map();
for (const row of semanticDocuments) {
  const key = `${text(row.project_id)}|${String(row.source_id)}`;
  if (!documentKeys.has(key)) documentKeys.set(key, []);
  documentKeys.get(key).push(row);
}
const chunksForException = (row) => documentKeys.get(`${text(row.project_id)}|${String(row.id)}`) || [];
const sortedDated = exceptions.filter((row) => Number.isFinite(Date.parse(text(row.exception_date))))
  .sort((left, right) => Date.parse(right.exception_date) - Date.parse(left.exception_date) || Number(right.id) - Number(left.id));
const latestDated = sortedDated[0] || null;
const indexedKeys = new Set(indexedExceptions.map((row) => `${text(row.project_id)}|${String(row.source_id)}`));

const currencyPatterns = Object.freeze({
  ils: /(?:₪|ש["״']?ח|\b(?:ILS|NIS)\b)/iu,
  usd: /(?:\$|\bUSD\b|דולר(?:ים)?)/iu,
  eur: /(?:€|\bEUR\b|אירו)/iu
});
const currencySignalsForText = (value) => Object.entries(currencyPatterns)
  .filter(([, pattern]) => pattern.test(String(value || "")))
  .map(([currency]) => currency);
const rowCurrencySignals = exceptions.map((row) => new Set(currencySignalsForText(
  `${text(row.exception_subject)} ${text(row.summary)} ${text(row.content)}`
)));
const documentCurrencySignals = semanticDocuments.map((row) => new Set(currencySignalsForText(row.content)));

const populatedAmountRows = exceptions.filter((row) =>
  row.requested_amount_ex_vat !== null && row.requested_amount_ex_vat !== undefined && row.requested_amount_ex_vat !== ""
);
const amountEquationCounts = {
  requestedPlusVatEqualsTotal: exceptions.filter((row) => {
    const values = [row.requested_amount_ex_vat, row.vat_amount, row.total_amount_incl_vat];
    if (values.some((value) => value === null || value === undefined || value === "")) return false;
    return Math.abs(Number(values[0]) + Number(values[1]) - Number(values[2])) < 0.01;
  }).length,
  requestedPlusVatPlusProfitEqualsTotal: exceptions.filter((row) => {
    const values = [row.requested_amount_ex_vat, row.vat_amount, row.main_contractor_profit, row.total_amount_incl_vat];
    if (values.some((value) => value === null || value === undefined || value === "")) return false;
    return Math.abs(Number(values[0]) + Number(values[1]) + Number(values[2]) - Number(values[3])) < 0.01;
  }).length
};

const result = {
  transport: {
    methods: ["GET"],
    requestBodies: false,
    dataQueryManagedIdentity: true,
    existingSemanticConnectionReadOnly: true
  },
  exceptions: {
    exactRows: exceptions.length,
    stableId: {
      populated: ids.filter((value) => value !== null && value !== undefined && String(value)).length,
      unique: new Set(ids.map(String)).size,
      positiveInteger: ids.filter(isPositiveInteger).length
    },
    projectScope: {
      populated: populated(exceptions, "project_id"),
      distinctProjects: uniqueCount(exceptions, "project_id")
    },
    exceptionNumber: {
      populated: exceptionNumbers.length,
      missing: exceptions.length - exceptionNumbers.length,
      uniquePopulated: new Set(exceptionNumbers.map(String)).size,
      positiveInteger: exceptionNumbers.filter(isPositiveInteger).length,
      duplicateGroups: Object.values(exceptionNumbers.reduce((counts, value) => {
        counts[String(value)] = (counts[String(value)] || 0) + 1;
        return counts;
      }, {})).filter((count) => count > 1).length,
      decision: "display_metadata_only_not_stable_identity"
    },
    exceptionDate: {
      populated: dateValues.length,
      nulls: exceptions.length - dateValues.length,
      invalid: parsedDates.length - validDates.length,
      min: validDates.length ? new Date(Math.min(...validDates)).toISOString() : null,
      max: validDates.length ? new Date(Math.max(...validDates)).toISOString() : null,
      distinctTimestamps: new Set(dateValues).size,
      tiedTimestampGroups: dateCounts.filter((count) => count > 1).length,
      largestTie: dateCounts.length ? Math.max(...dateCounts) : null
    },
    approvedVocabularies: {
      urgency: groups(exceptions, "urgency_level"),
      itemStatus: groups(exceptions, "item_status"),
      processedForInsights: groups(exceptions, "processed_for_insights")
    },
    identityAndBusinessSensitivity: {
      inspector: { ...distributionShape(exceptions, "inspector"), decision: "excluded_personal_identity" },
      projectManager: { ...distributionShape(exceptions, "project_manager"), decision: "excluded_personal_identity" },
      supervisionCompany: { ...distributionShape(exceptions, "supervision_company"), decision: "excluded_small_group_business_identity" }
    },
    semanticOnlyFields: {
      exceptionSubjectPopulated: populated(exceptions, "exception_subject"),
      summaryPopulated: populated(exceptions, "summary"),
      contentPopulated: populated(exceptions, "content"),
      hashtagsPopulated: exceptions.filter((row) => Array.isArray(row.hashtags) && row.hashtags.length).length,
      decision: "excluded_free_text_and_uncontrolled_content_derived_categories"
    },
    amountFields: {
      schemaTypes: {
        requested_amount_ex_vat: "numeric",
        vat_amount: "numeric",
        total_amount_incl_vat: "numeric",
        main_contractor_profit: "numeric"
      },
      requestedAmountExVat: numericShape("requested_amount_ex_vat"),
      vatAmount: numericShape("vat_amount"),
      totalAmountInclVat: numericShape("total_amount_incl_vat"),
      mainContractorProfit: numericShape("main_contractor_profit"),
      rowsWithRequestedAmountAndNoCurrencySignal: populatedAmountRows.filter((row) => {
        const index = exceptions.indexOf(row);
        return rowCurrencySignals[index].size === 0;
      }).length,
      sourceRowsWithOneCurrencySignal: rowCurrencySignals.filter((signals) => signals.size === 1).length,
      sourceRowsWithMixedCurrencySignals: rowCurrencySignals.filter((signals) => signals.size > 1).length,
      evidenceChunksWithOneCurrencySignal: documentCurrencySignals.filter((signals) => signals.size === 1).length,
      evidenceChunksWithMixedCurrencySignals: documentCurrencySignals.filter((signals) => signals.size > 1).length,
      storedCurrencyColumn: false,
      amountEquationCounts,
      decision: "not_computable_without_row_level_stored_currency_and_business_inclusion_semantics"
    },
    executionDays: {
      ...numericShape("execution_days"),
      decision: "not_computable_due_to_single_row_coverage"
    },
    internalRelationshipFields: {
      mailIdPopulated: populated(exceptions, "mail_id"),
      attachmentIdPopulated: populated(exceptions, "attachment_id")
    }
  },
  evidenceRelationship: {
    managedIdentityVisibleRows: managedDocuments.length,
    existingSemanticConnectionRows: semanticDocuments.length,
    exceptionRowsWithAtLeastOneChunk: exceptions.filter((row) => chunksForException(row).length > 0).length,
    exceptionRowsWithoutChunks: exceptions.filter((row) => chunksForException(row).length === 0).length,
    chunksWithoutSameProjectException: semanticDocuments.filter((row) => !exceptionKeys.has(
      `${text(row.project_id)}|${String(row.source_id)}`
    )).length,
    attachmentMismatchChunks: exceptions.reduce((count, row) => count + chunksForException(row)
      .filter((chunk) => text(chunk.attachment_id) !== text(row.attachment_id)).length, 0),
    primaryDateMismatchChunks: exceptions.reduce((count, row) => count + chunksForException(row)
      .filter((chunk) => text(chunk.primary_date) && text(chunk.primary_date) !== text(row.exception_date)).length, 0),
    latestDatedExceptionHasEvidence: latestDated ? chunksForException(latestDated).length > 0 : false,
    latestDatedExceptionEvidenceChunks: latestDated ? chunksForException(latestDated).length : 0,
    relationship: "exceptions_report.id + project_id -> exceptions_report_documents.source_id + project_id",
    attachmentAttestation: "attachment_id must also match for same-record evidence"
  },
  semanticIndex: {
    indexedRows: indexedExceptions.length,
    sourceRowsWithIndexEntry: exceptions.filter((row) => indexedKeys.has(`${text(row.project_id)}|${String(row.id)}`)).length,
    indexRowsWithoutSameProjectException: indexedExceptions.filter((row) => !exceptionKeys.has(
      `${text(row.project_id)}|${String(row.source_id)}`
    )).length,
    decision: "generic_semantic_retrieval_only_not_an_exact_metric_source"
  }
};

console.log(JSON.stringify(result, null, 2));
