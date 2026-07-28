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

async function readAll(table, select, headers, { orderField = null } = {}) {
  const rows = [];
  let total = null;

  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select,
      limit: "1000",
      offset: String(offset)
    });
    if (orderField) params.set("order", `${orderField}.asc`);
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

const EMAIL_SELECT = [
  "id",
  "project_id",
  "created_at",
  "received_date",
  "direction",
  "mail_category",
  "has_attachments",
  "relevance_status",
  "item_status",
  "mail_id",
  "conversationid",
  "sender_name",
  "sender_mail",
  "other_recipients",
  "subject",
  "summary",
  "mail_summarize",
  "mail_body"
].join(",");
const ATTACHMENT_SELECT = [
  "attachment_id",
  "project_id",
  "mail_id",
  "original_file_name",
  "current_filename",
  "attachment_link"
].join(",");

const emails = await readAll("emails", EMAIL_SELECT, managedHeaders, { orderField: "id" });
const managedAttachments = await readAll(
  "email_attachments",
  ATTACHMENT_SELECT,
  managedHeaders,
  { orderField: "attachment_id" }
);
const semanticAttachments = await readAll(
  "email_attachments",
  ATTACHMENT_SELECT,
  semanticHeaders,
  { orderField: "attachment_id" }
);

const text = (value) => String(value ?? "").trim();
const populated = (rows, field) => rows.filter((row) => text(row[field])).length;
const groups = (rows, field) => Object.entries(rows.reduce((counts, row) => {
  const value = row[field] === null || row[field] === undefined || row[field] === ""
    ? "<null>"
    : String(row[field]);
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {})).sort(([left], [right]) => left.localeCompare(right));
const uniqueCount = (rows, field) => new Set(rows.map((row) => text(row[field])).filter(Boolean)).size;
const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const ids = emails.map((row) => row.id);
const dateValues = emails.map((row) => text(row.received_date)).filter(Boolean);
const parsedDates = dateValues.map((value) => Date.parse(value));
const validDates = parsedDates.filter(Number.isFinite);
const dateCounts = Object.values(dateValues.reduce((counts, value) => {
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {}));
const projectRelated = emails.filter((row) => ["project_related", "multi_project"].includes(text(row.relevance_status)));
const allEmailKeys = new Set(emails.map((row) => `${text(row.project_id)}|${text(row.mail_id)}`));
const projectEmailKeys = new Set(projectRelated.map((row) => `${text(row.project_id)}|${text(row.mail_id)}`));
const attachmentKeys = new Set(semanticAttachments.map((row) => `${text(row.project_id)}|${text(row.mail_id)}`));

const result = {
  transport: {
    methods: ["GET"],
    requestBodies: false,
    dataQueryManagedIdentity: true,
    existingSemanticConnectionReadOnly: true
  },
  emails: {
    exactRows: emails.length,
    stableId: {
      populated: ids.filter((value) => value !== null && value !== undefined && String(value)).length,
      unique: new Set(ids.map(String)).size,
      positiveInteger: ids.filter(isPositiveInteger).length
    },
    projectScope: {
      populated: populated(emails, "project_id"),
      distinctProjects: uniqueCount(emails, "project_id"),
      projectRelatedPopulated: populated(projectRelated, "project_id"),
      projectRelatedDistinctProjects: uniqueCount(projectRelated, "project_id")
    },
    receivedDate: {
      populated: dateValues.length,
      nulls: emails.length - dateValues.length,
      invalid: parsedDates.length - validDates.length,
      min: validDates.length ? new Date(Math.min(...validDates)).toISOString() : null,
      max: validDates.length ? new Date(Math.max(...validDates)).toISOString() : null,
      distinctTimestamps: new Set(dateValues).size,
      tiedTimestampGroups: dateCounts.filter((count) => count > 1).length,
      largestTie: dateCounts.length ? Math.max(...dateCounts) : null
    },
    createdAt: { populated: populated(emails, "created_at") },
    relevanceVocabulary: groups(emails, "relevance_status"),
    authoritativeProjectRelatedPredicate: "relevance_status in (project_related,multi_project)",
    projectRelatedRows: projectRelated.length,
    directionVocabulary: groups(emails, "direction"),
    categoryVocabulary: groups(emails, "mail_category"),
    attachmentStateVocabulary: groups(emails, "has_attachments"),
    itemStatusVocabulary: groups(emails, "item_status"),
    piiAndContentCoverage: {
      senderNamePopulated: populated(emails, "sender_name"),
      senderAddressPopulated: populated(emails, "sender_mail"),
      recipientsPopulated: populated(emails, "other_recipients"),
      subjectPopulated: populated(emails, "subject"),
      summaryPopulated: populated(emails, "summary"),
      mailSummaryPopulated: populated(emails, "mail_summarize"),
      bodyPopulated: populated(emails, "mail_body"),
      decision: "excluded_from_quantitative_and_lookup_projection"
    },
    internalIdentityCoverage: {
      mailIdPopulated: populated(emails, "mail_id"),
      distinctMailIds: uniqueCount(emails, "mail_id"),
      conversationIdPopulated: populated(emails, "conversationid"),
      distinctConversationIds: uniqueCount(emails, "conversationid")
    }
  },
  attachmentRelationship: {
    managedIdentityVisibleRows: managedAttachments.length,
    existingSemanticConnectionRows: semanticAttachments.length,
    uniqueAttachmentIds: uniqueCount(semanticAttachments, "attachment_id"),
    rowsWithProjectId: populated(semanticAttachments, "project_id"),
    rowsWithMailId: populated(semanticAttachments, "mail_id"),
    uniqueProjectMailKeys: attachmentKeys.size,
    rowsWithoutSameProjectEmail: semanticAttachments.filter((row) => !allEmailKeys.has(
      `${text(row.project_id)}|${text(row.mail_id)}`
    )).length,
    rowsWithoutSameProjectRelatedEmail: semanticAttachments.filter((row) => !projectEmailKeys.has(
      `${text(row.project_id)}|${text(row.mail_id)}`
    )).length,
    projectRelatedEmailsWithAttachmentFlag: projectRelated.filter((row) => row.has_attachments === true).length,
    projectRelatedEmailsWithAttachmentRows: projectRelated.filter((row) => attachmentKeys.has(
      `${text(row.project_id)}|${text(row.mail_id)}`
    )).length,
    flaggedProjectRelatedEmailsWithoutAttachmentRows: projectRelated.filter((row) =>
      row.has_attachments === true && !attachmentKeys.has(`${text(row.project_id)}|${text(row.mail_id)}`)
    ).length,
    relationship: "emails.project_id + emails.mail_id -> email_attachments.project_id + email_attachments.mail_id",
    decision: "relationship_attested_for_audit_only_not_approved_for_exact_display_or_linking"
  }
};

console.log(JSON.stringify(result, null, 2));
