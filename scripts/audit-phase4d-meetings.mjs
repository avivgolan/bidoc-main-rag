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

async function readRpcContract(rpcName) {
  const response = await fetch(`${config.contentSource.supabaseUrl}/rest/v1/`, {
    headers: {
      ...semanticHeaders,
      Accept: "application/openapi+json"
    }
  });
  if (!response.ok) throw new Error(`PostgREST OpenAPI read failed with status ${response.status}`);
  const openapi = await response.json();
  const operation = openapi?.paths?.[`/rpc/${rpcName}`]?.post || null;
  const bodyParameter = (operation?.parameters || []).find((parameter) => parameter?.in === "body") || null;
  const referenceName = String(bodyParameter?.schema?.$ref || "").split("/").pop();
  const bodySchema = referenceName
    ? openapi?.definitions?.[referenceName]
    : bodyParameter?.schema;
  return {
    name: rpcName,
    published: Boolean(operation),
    inputFields: Object.keys(bodySchema?.properties || {}).sort(),
    requiredFields: [...(bodySchema?.required || [])].sort()
  };
}

async function probeSemanticRpc(rpcName) {
  const vectorResponse = await fetch(
    `${config.contentSource.supabaseUrl}/rest/v1/meetings_documents?select=embedding&embedding=not.is.null&limit=1`,
    { headers: semanticHeaders }
  );
  if (!vectorResponse.ok) throw new Error(`Meeting embedding read failed with status ${vectorResponse.status}`);
  const vectorRows = await vectorResponse.json();
  const rawEmbedding = vectorRows?.[0]?.embedding;
  const embedding = Array.isArray(rawEmbedding)
    ? rawEmbedding
    : JSON.parse(String(rawEmbedding || "[]"));
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error("Meeting RPC probe could not obtain a stored embedding");
  }
  const response = await fetch(`${config.contentSource.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: semanticHeaders,
    body: JSON.stringify({
      query_embedding: embedding,
      query_text: "meeting evidence health probe",
      keywords: [],
      p_project_id: config.contentSource?.projectId || null,
      match_count: 1,
      match_threshold: 0.3,
      vector_weight: 0.55,
      text_weight: 0.25,
      keyword_weight: 0.15,
      metadata_weight: 0.05
    })
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    embeddingDimensions: Array.isArray(embedding) ? embedding.length : null,
    returnedRows: Array.isArray(payload) ? payload.length : null,
    error: response.ok ? null : {
      code: payload?.code || null,
      message: payload?.message || null,
      details: payload?.details || null,
      hint: payload?.hint || null
    }
  };
}

async function readAll(table, select, headers) {
  const rows = [];
  let total = null;

  for (let offset = 0; ; offset += 1000) {
    const params = new URLSearchParams({
      select,
      order: "id.asc",
      limit: "1000",
      offset: String(offset)
    });
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

const meetings = await readAll(
  "meetings",
  [
    "id",
    "project_id",
    "created_at",
    "meeting_date",
    "subject",
    "status",
    "item_status",
    "decisions_made",
    "attendances",
    "attachment_id",
    "mail_id",
    "external_meeting_ref",
    "document_filename",
    "processed_for_insights"
  ].join(","),
  managedHeaders
);
const managedDocuments = await readAll(
  "meetings_documents",
  "id,project_id,source_id,attachment_id,chunk_index,chunk_total,primary_date,document_name",
  managedHeaders
);
const documents = await readAll(
  "meetings_documents",
  "id,project_id,source_id,attachment_id,chunk_index,chunk_total,primary_date,document_name",
  semanticHeaders
);
const semanticRpc = await readRpcContract("hybrid_match_meetings_documents");
if (process.argv.includes("--probe-semantic-rpc")) {
  semanticRpc.health = await probeSemanticRpc(semanticRpc.name);
}

const text = (value) => String(value ?? "").trim();
const populated = (rows, field) => rows.filter((row) => text(row[field])).length;
const groups = (rows, field) => Object.entries(rows.reduce((counts, row) => {
  const value = text(row[field]) || "<null>";
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {})).sort(([left], [right]) => left.localeCompare(right));

const dates = meetings.map((row) => text(row.meeting_date)).filter(Boolean);
const parsedDates = dates.map((value) => Date.parse(value));
const dateCounts = Object.values(dates.reduce((counts, value) => {
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {}));
const meetingKeys = new Set(
  meetings.map((row) => `${String(row.project_id)}|${String(row.id)}`)
);
const documentKeys = new Map();
for (const row of documents) {
  const key = `${String(row.project_id)}|${String(row.source_id)}`;
  if (!documentKeys.has(key)) documentKeys.set(key, []);
  documentKeys.get(key).push(row);
}

const chunksForMeeting = (meeting) => documentKeys.get(
  `${String(meeting.project_id)}|${String(meeting.id)}`
) || [];
const meetingDocumentCounts = meetings.map((meeting) => chunksForMeeting(meeting).length);
const matchedDocumentCounts = meetingDocumentCounts.filter((count) => count > 0);
const decisions = meetings.filter((row) => text(row.decisions_made));
const noDecisionPattern = /(?:no\s+decisions?|none|not\s+decided|לא\s+(?:התקבלו|נקבעו)\s+החלטות|אין\s+החלטות)/iu;
const ids = meetings.map((row) => row.id);
const latestMeeting = [...meetings].sort((left, right) => {
  const byDate = Date.parse(right.meeting_date) - Date.parse(left.meeting_date);
  return byDate || Number(right.id) - Number(left.id);
})[0];

const result = {
  transport: {
    methods: ["GET"],
    requestBodies: false,
    dataQueryManagedIdentity: true,
    existingSemanticConnectionReadOnly: true,
    semanticRpc
  },
  meetings: {
    exactRows: meetings.length,
    stableId: {
      populated: ids.filter((value) => value !== null && value !== undefined && String(value)).length,
      unique: new Set(ids.map(String)).size,
      positiveInteger: ids.filter((value) => Number.isInteger(Number(value)) && Number(value) > 0).length
    },
    projectScope: {
      populated: populated(meetings, "project_id"),
      distinctProjects: new Set(meetings.map((row) => text(row.project_id)).filter(Boolean)).size
    },
    meetingDate: {
      populated: dates.length,
      nulls: meetings.length - dates.length,
      invalid: parsedDates.filter((value) => !Number.isFinite(value)).length,
      min: new Date(Math.min(...parsedDates)).toISOString(),
      max: new Date(Math.max(...parsedDates)).toISOString(),
      distinctTimestamps: new Set(dates).size,
      tiedTimestampGroups: dateCounts.filter((count) => count > 1).length,
      largestTie: Math.max(...dateCounts)
    },
    createdAt: { populated: populated(meetings, "created_at") },
    statusVocabulary: groups(meetings, "status"),
    itemStatusVocabulary: groups(meetings, "item_status"),
    subject: {
      populated: populated(meetings, "subject"),
      distinct: new Set(meetings.map((row) => text(row.subject)).filter(Boolean)).size,
      maxLength: Math.max(...meetings.map((row) => text(row.subject).length)),
      decision: "excluded_free_text_possible_personal_or_semantic_content"
    },
    decisionsMade: {
      populatedTextRows: decisions.length,
      noDecisionMarkerRows: decisions.filter((row) => noDecisionPattern.test(text(row.decisions_made))).length,
      decision: "not_computable_text_requires_semantic_interpretation"
    },
    attendance: {
      populatedTextRows: populated(meetings, "attendances"),
      decision: "excluded_personal_data"
    },
    internalRelationshipFields: {
      attachmentIdPopulated: populated(meetings, "attachment_id"),
      mailIdPopulated: populated(meetings, "mail_id"),
      externalMeetingRefPopulated: populated(meetings, "external_meeting_ref"),
      documentFilenamePopulated: populated(meetings, "document_filename")
    },
    processedForInsightsVocabulary: groups(meetings, "processed_for_insights")
  },
  evidenceRelationship: {
    managedIdentityVisibleRows: managedDocuments.length,
    existingSemanticConnectionRows: documents.length,
    distinctMeetingProjectKeysInDocuments: documentKeys.size,
    meetingsWithAtLeastOneChunk: meetingDocumentCounts.filter((count) => count > 0).length,
    meetingsWithoutChunks: meetingDocumentCounts.filter((count) => count === 0).length,
    minimumChunksPerMatchedMeeting: matchedDocumentCounts.length ? Math.min(...matchedDocumentCounts) : null,
    maximumChunksPerMeeting: Math.max(...meetingDocumentCounts),
    documentChunksWithoutSameProjectMeeting: documents.filter((row) => !meetingKeys.has(
      `${String(row.project_id)}|${String(row.source_id)}`
    )).length,
    sameSourceIdOtherProjectChunks: documents.filter((document) => meetings.some((meeting) =>
      String(meeting.id) === String(document.source_id) &&
      String(meeting.project_id) !== String(document.project_id)
    )).length,
    attachmentMismatchChunks: meetings.reduce((count, meeting) => count + chunksForMeeting(meeting)
      .filter((chunk) => text(chunk.attachment_id) !== text(meeting.attachment_id)).length, 0),
    primaryDateMismatchChunks: meetings.reduce((count, meeting) => count + chunksForMeeting(meeting)
      .filter((chunk) => text(chunk.primary_date) && text(chunk.primary_date) !== text(meeting.meeting_date)).length, 0),
    latestMeetingHasEvidence: chunksForMeeting(latestMeeting).length > 0,
    latestMeetingEvidenceChunks: chunksForMeeting(latestMeeting).length,
    relationship: "meetings.id + meetings.project_id -> meetings_documents.source_id + meetings_documents.project_id",
    attachmentAttestation: "meetings.attachment_id equals every matched meetings_documents.attachment_id"
  }
};

console.log(JSON.stringify(result, null, 2));
