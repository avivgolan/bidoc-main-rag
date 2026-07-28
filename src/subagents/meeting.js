import { createEmbedding } from "../openrouter.js";
import { getConfig, readLocalSettings, supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const DEFAULT_MEETINGS_RPC = "hybrid_match_meetings_documents";
const DEFAULT_MEETINGS_TABLE = "meetings_documents";
const DEFAULT_MEETINGS_METADATA_TABLE = "meetings";
const PROJECT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d{0,18}$/;
const UNSAFE_REFERENCE_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_ATTACHMENT_REFERENCE_LENGTH = 2048;
const MAX_MEETING_STATUS_LENGTH = 256;
const MAX_SEMANTIC_FALLBACK_ROWS = 500;
const MAX_EMBEDDING_DIMENSIONS = 8192;
const MAX_FALLBACK_CONTENT_LENGTH = 200000;
const MAX_DATE_SCOPED_DECISION_ROWS = 25;
const MEETING_DECISION_DETAIL_PATTERN = /(?:פרט|פרטי|פרטו|הצג|סכם)?[^\n]{0,40}(?:החלט|הוחלט)|(?:all\s+)?decisions?|what\s+was\s+decided/iu;
const MEETING_DECISION_PLACEHOLDER_PATTERN = /^(?:לא\s+צוי(?:ן|נה)|לא\s+נמסר|אין|none|not\s+(?:specified|provided|stated)|n\/?a)$/iu;
const STRUCTURAL_RPC_ERROR_CODES = new Set([
  "42702", // ambiguous_column
  "42703", // undefined_column
  "42883", // undefined_function
  "42P01", // undefined_table
  "PGRST200", // stale/missing relationship in the schema cache
  "PGRST202", // stale/missing function in the schema cache
  "PGRST204" // stale/missing column in the schema cache
]);

function createTransportError(message, { name, status, code, structural = false } = {}) {
  const error = new Error(message);
  if (name) error.name = name;
  if (Number.isInteger(status)) error.status = status;
  if (code) error.code = code;
  error.structural = structural;
  return error;
}

function isStructuralRpcFailure(error) {
  return error?.structural === true;
}

function normalizeEmbeddingVector(value) {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(candidate) || !candidate.length || candidate.length > MAX_EMBEDDING_DIMENSIONS) {
    return null;
  }
  const vector = candidate.map(Number);
  if (vector.some((item) => !Number.isFinite(item))) return null;
  const normSquared = vector.reduce((sum, item) => sum + item * item, 0);
  return Number.isFinite(normSquared) && normSquared > 0 ? vector : null;
}

function resolveSemanticProjectScope(config, requestedProjectId) {
  const candidates = [
    requestedProjectId,
    config?.projectId,
    config?.contentSource?.projectId,
    process.env.PROJECT_ID
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (!candidates.length) return { ok: true, projectId: null };

  const normalized = candidates.map(normalizeProjectId);
  if (normalized.some((value) => !value)) return { ok: false, projectId: null };
  const distinct = new Set(normalized);
  return distinct.size === 1
    ? { ok: true, projectId: normalized[0] }
    : { ok: false, projectId: null };
}

async function callMeetingsRpc(
  config,
  subagentCfg,
  embedding,
  query,
  keywords,
  dateFrom,
  dateTo,
  projectId,
  fetchImpl = globalThis.fetch
) {
  const contentConfig = contentSupabaseConfig(config);
  const rpcName = subagentCfg.rpcName || DEFAULT_MEETINGS_RPC;

  const body = {
    query_embedding: embedding,
    query_text: query,
    keywords: keywords || [],
    p_project_id: projectId,
    match_count: subagentCfg.matchCount || 20,
    match_threshold: subagentCfg.matchThreshold ?? 0.3,
    vector_weight: subagentCfg.vectorWeight ?? 0.55,
    text_weight: subagentCfg.textWeight ?? 0.25,
    keyword_weight: subagentCfg.keywordWeight ?? 0.15,
    metadata_weight: subagentCfg.metadataWeight ?? 0.05
  };
  if (dateFrom) body.date_from = dateFrom;
  if (dateTo) body.date_to = dateTo;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Number(subagentCfg.timeoutMs) || 10000)
  );
  let response;
  try {
    response = await fetchImpl(`${contentConfig.supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: "POST",
      headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey),
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (response.ok) {
      throw createTransportError("Meetings RPC returned invalid JSON", {
        name: "MeetingRpcPayloadError",
        status: response.status,
        code: "meeting_rpc_invalid_json"
      });
    }
  }
  if (!response.ok) {
    const code = String(data?.code || "").trim().toUpperCase();
    const message = String(data?.message || "");
    const structural = (response.status === 400 || response.status === 404) && (
      STRUCTURAL_RPC_ERROR_CODES.has(code) ||
      /(?:column|function|relation|table)\s+.+\s+does not exist|schema cache/iu.test(message)
    );
    throw createTransportError("Meetings RPC request failed", {
      name: "MeetingRpcError",
      status: response.status,
      code: code || "meeting_rpc_failed",
      structural
    });
  }
  if (!Array.isArray(data)) {
    throw createTransportError("Meetings RPC returned an invalid payload", {
      name: "MeetingRpcPayloadError",
      status: response.status,
      code: "meeting_rpc_invalid_payload"
    });
  }
  return data;
}

async function fetchAdjacentChunks(config, chunks, adjacentCount = 1, fetchImpl = globalThis.fetch) {
  if (!chunks.length || adjacentCount <= 0) return [];
  const contentConfig = contentSupabaseConfig(config);
  const projectId = config.contentSource?.projectId || process.env.PROJECT_ID || null;
  const table = DEFAULT_MEETINGS_TABLE;

  const adjacentIds = new Set();
  const topChunks = chunks.slice(0, 5);

  const results = await Promise.all(topChunks.map(async (chunk) => {
    const targetIndexes = [];
    for (let i = 1; i <= adjacentCount; i++) {
      if (chunk.chunk_index - i >= 0) targetIndexes.push(chunk.chunk_index - i);
      targetIndexes.push(chunk.chunk_index + i);
    }
    if (!targetIndexes.length) return [];

    const indexFilter = targetIndexes.map((i) => `chunk_index.eq.${i}`).join(",");
    let url = `${contentConfig.supabaseUrl}/rest/v1/${table}?select=id,content,chunk_index,attachment_id&attachment_id=eq.${encodeURIComponent(chunk.attachment_id)}&or=(${indexFilter})`;
    if (projectId) url += `&project_id=eq.${projectId}`;

    try {
      const resp = await fetchImpl(url, { headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey) });
      const txt = await resp.text();
      const data = txt ? JSON.parse(txt) : [];
      return Array.isArray(data) ? data.filter((r) => !adjacentIds.has(r.id) && (adjacentIds.add(r.id), true)) : [];
    } catch {
      return [];
    }
  }));

  return results.flat();
}

function emptyEvidenceResult(status, warning = null, error = null) {
  return {
    status,
    summary: null,
    evidence: [],
    conflicts: [],
    insufficient_evidence: true,
    same_meeting_match: false,
    exact_identity_verified: false,
    ...(warning ? { warning } : {}),
    ...(error ? { error } : {})
  };
}

function normalizeProjectId(value) {
  const normalized = String(value ?? "").trim();
  return PROJECT_UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizeMeetingId(value) {
  const normalized = String(value ?? "").trim();
  const parsed = Number(normalized);
  return POSITIVE_INTEGER_PATTERN.test(normalized) && Number.isSafeInteger(parsed) && parsed > 0
    ? String(parsed)
    : null;
}

function normalizeAttachmentId(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  if (
    !normalized ||
    normalized.length > MAX_ATTACHMENT_REFERENCE_LENGTH ||
    UNSAFE_REFERENCE_CHARACTERS.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function normalizeMeetingDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  const milliseconds = Date.parse(normalized);
  if (!normalized || !Number.isFinite(milliseconds)) return undefined;
  return {
    milliseconds,
    date: new Date(milliseconds).toISOString().slice(0, 10)
  };
}

function normalizeMeetingStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (
    !normalized ||
    normalized.length > MAX_MEETING_STATUS_LENGTH ||
    UNSAFE_REFERENCE_CHARACTERS.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function logScrubbedProviderFailure(stage, error) {
  const details = {};
  const name = String(error?.name || "").trim();
  if (/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name)) details.name = name;
  const status = Number(error?.status ?? error?.statusCode);
  if (Number.isInteger(status) && status >= 100 && status <= 599) details.status = status;
  const code = String(error?.code || "").trim();
  if (/^[A-Za-z0-9_.-]{1,64}$/.test(code)) details.code = code;
  console.error(`[meeting_evidence] ${stage} failed`, details);
}

function normalizeOpaqueChunkId(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  return normalized && normalized.length <= 256 && !UNSAFE_REFERENCE_CHARACTERS.test(normalized)
    ? normalized
    : null;
}

function normalizeDateBound(value, { inclusiveEndOfDay = false } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  const milliseconds = inclusiveEndOfDay && /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? Date.parse(`${normalized}T23:59:59.999Z`)
    : Date.parse(normalized);
  return normalized && Number.isFinite(milliseconds)
    ? { value: normalized, milliseconds }
    : undefined;
}

export function extractExplicitMeetingDate(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/(?:^|\D)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?=\D|$)/u);
  const local = text.match(/(?:^|\D)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|20\d{2})(?=\D|$)/u);
  const match = iso || local;
  if (!match) return null;
  const year = iso ? Number(match[1]) : Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  const month = Number(match[iso ? 2 : 2]);
  const day = Number(match[iso ? 3 : 1]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return undefined;
  return candidate.toISOString().slice(0, 10);
}

export function isMeetingDecisionDetailRequest(value) {
  return MEETING_DECISION_DETAIL_PATTERN.test(String(value ?? ""));
}

function resolveExactDecisionDate(query, dateFrom, dateTo) {
  const explicit = extractExplicitMeetingDate(query);
  if (explicit === undefined) return undefined;
  const scopeDate = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const calendarDate = extractExplicitMeetingDate(value);
    if (calendarDate !== null) return calendarDate;
    const normalized = normalizeMeetingDate(value);
    return normalized === undefined ? undefined : normalized?.date || null;
  };
  const fromDate = scopeDate(dateFrom);
  const toDate = scopeDate(dateTo);
  if (fromDate === undefined || toDate === undefined) return undefined;
  if (explicit) {
    if ((fromDate && fromDate !== explicit) || (toDate && toDate !== explicit)) return undefined;
    return explicit;
  }
  if (fromDate && toDate && fromDate === toDate) return fromDate;
  if (fromDate && !toDate) return fromDate;
  if (!fromDate && toDate) return toDate;
  return null;
}

function nextIsoDate(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

async function fetchDateScopedMeetingDecisionEvidence({
  config,
  subagentCfg,
  projectId,
  meetingDate,
  fetchImpl
}) {
  const contentConfig = contentSupabaseConfig(config);
  const params = new URLSearchParams();
  params.set("select", "id,project_id,meeting_date,attachment_id,subject,decisions_made");
  if (projectId) params.set("project_id", `eq.${projectId}`);
  params.set("meeting_date", `gte.${meetingDate}T00:00:00.000Z`);
  params.append("meeting_date", `lt.${nextIsoDate(meetingDate)}T00:00:00.000Z`);
  params.set("order", "id.asc");
  params.set("limit", String(MAX_DATE_SCOPED_DECISION_ROWS + 1));

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Number(subagentCfg.timeoutMs) || 10000)
  );
  let response;
  try {
    response = await fetchImpl(
      `${contentConfig.supabaseUrl}/rest/v1/${DEFAULT_MEETINGS_METADATA_TABLE}?${params.toString()}`,
      {
        method: "GET",
        headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey, {
          Accept: "application/json",
          "Accept-Profile": "public",
          Prefer: "count=exact"
        }),
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let rows;
  try {
    rows = text ? JSON.parse(text) : [];
  } catch {
    throw createTransportError("Meeting decision read returned invalid JSON", {
      name: "MeetingDecisionPayloadError",
      status: response.status,
      code: "meeting_decision_invalid_json"
    });
  }
  if (!response.ok || !Array.isArray(rows)) {
    throw createTransportError("Meeting decision read failed", {
      name: "MeetingDecisionReadError",
      status: response.status,
      code: "meeting_decision_read_failed"
    });
  }
  const exactTotal = parseExactContentRange(response);
  if (
    exactTotal === null ||
    exactTotal > MAX_DATE_SCOPED_DECISION_ROWS ||
    rows.length > MAX_DATE_SCOPED_DECISION_ROWS ||
    rows.length !== exactTotal
  ) {
    return emptyEvidenceResult(
      "error",
      "meeting_decision_evidence_exceeds_bound",
      "The exact-date decision result exceeded or did not reconcile to its hard bound"
    );
  }
  if (!rows.length) {
    return {
      ...emptyEvidenceResult("not_found", "meeting_decision_evidence_not_found"),
      evidence_scope: "meeting_date_decisions",
      meeting_date: meetingDate,
      record_count: 0
    };
  }

  const seenIds = new Set();
  const returnedProjectIds = new Set();
  const evidence = rows.map((row, index) => {
    const meetingId = normalizeMeetingId(row?.id);
    const rowProjectId = normalizeProjectId(row?.project_id);
    const rowDate = normalizeMeetingDate(row?.meeting_date);
    const attachmentId = normalizeAttachmentId(row?.attachment_id);
    const subject = String(row?.subject ?? "").trim();
    const decision = String(row?.decisions_made ?? "").trim();
    if (
      !meetingId || seenIds.has(meetingId) || !rowProjectId ||
      (projectId && rowProjectId !== projectId) ||
      rowDate?.date !== meetingDate || !attachmentId || !decision ||
      subject.length > MAX_FALLBACK_CONTENT_LENGTH ||
      decision.length > MAX_FALLBACK_CONTENT_LENGTH
    ) {
      throw createTransportError("Meeting decision row validation failed", {
        name: "MeetingDecisionValidationError",
        code: "meeting_decision_row_invalid"
      });
    }
    seenIds.add(meetingId);
    returnedProjectIds.add(rowProjectId);
    return {
      quote: subject ? `${subject}: ${decision}` : decision,
      subject,
      decision,
      decision_explicit: !MEETING_DECISION_PLACEHOLDER_PATTERN.test(decision),
      chunk_id: `meeting-decision-${meetingId}`,
      meeting_id: Number(meetingId),
      attachment_id: attachmentId,
      meeting_date: meetingDate,
      chunk_index: index,
      line_from: null,
      line_to: null,
      final_score: null,
      vector_score: null,
      text_score: null,
      keyword_score: null,
      adjacent_chunks: []
    };
  });
  if (!projectId && returnedProjectIds.size !== 1) {
    return emptyEvidenceResult(
      "error",
      "meeting_decision_multiple_projects",
      "The unscoped exact-date decision result did not attest one project"
    );
  }

  return {
    status: "found",
    summary: `Found ${evidence.length} project-scoped meeting decision records (${meetingDate}).`,
    evidence,
    conflicts: [],
    insufficient_evidence: false,
    same_meeting_match: false,
    exact_identity_verified: true,
    date_scope_verified: true,
    evidence_scope: "meeting_date_decisions",
    meeting_date: meetingDate,
    record_count: evidence.length,
    explicit_decision_count: evidence.filter((item) => item.decision_explicit).length
  };
}

function parseExactContentRange(response) {
  const raw = String(response?.headers?.get?.("content-range") || "").trim();
  const match = raw.match(/^(?:\*|\d+-\d+)\/(\d+)$/);
  if (!match) return null;
  const total = Number(match[1]);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

function normalizeSearchTokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function lexicalCoverage(needle, haystack) {
  const tokens = [...new Set(normalizeSearchTokens(needle))];
  if (!tokens.length) return 0;
  const haystackTokens = normalizeSearchTokens(haystack);
  if (!haystackTokens.length) return 0;
  const haystackSet = new Set(haystackTokens);
  const matched = tokens.filter((token) => haystackSet.has(token)).length;
  const coverage = matched / tokens.length;
  const phrase = haystackTokens.join(" ").includes(tokens.join(" ")) ? 1 : 0;
  return Math.min(1, coverage * 0.85 + phrase * 0.15);
}

function keywordCoverage(keywords, content) {
  const normalizedKeywords = (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => String(keyword ?? "").trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!normalizedKeywords.length) return 0;
  const total = normalizedKeywords.reduce(
    (sum, keyword) => sum + lexicalCoverage(keyword, content),
    0
  );
  return Math.min(1, total / normalizedKeywords.length);
}

function cosineSimilarity(left, right) {
  if (left.length !== right.length) return null;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (!leftNorm || !rightNorm) return null;
  const score = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : null;
}

function boundedWeight(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : fallback;
}

function roundedScore(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(12));
}

function compareText(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
}

function safeLineMetadata(metadata) {
  const lines = metadata?.loc?.lines;
  const from = Number(lines?.from);
  const to = Number(lines?.to);
  if (!Number.isInteger(from) && !Number.isInteger(to)) return {};
  return {
    loc: {
      lines: {
        ...(Number.isInteger(from) ? { from } : {}),
        ...(Number.isInteger(to) ? { to } : {})
      }
    }
  };
}

function validateAndScoreFallbackRows({
  rows,
  queryEmbedding,
  query,
  keywords,
  projectId,
  dateFrom,
  dateTo,
  subagentCfg
}) {
  const projectIds = new Set();
  const seenIds = new Set();
  const seenPositions = new Set();
  const meetingAttachments = new Map();
  const attachmentMeetings = new Map();
  const candidates = [];

  for (const row of rows) {
    const id = normalizeOpaqueChunkId(row?.id);
    const meetingId = normalizeMeetingId(row?.source_id);
    const rowProjectId = normalizeProjectId(row?.project_id);
    const attachmentId = normalizeAttachmentId(row?.attachment_id);
    const content = String(row?.content ?? "").trim();
    const chunkIndex = Number(row?.chunk_index);
    const primaryDate = normalizeMeetingDate(row?.primary_date);
    const rowEmbedding = normalizeEmbeddingVector(row?.embedding);
    if (
      !id || !meetingId || !rowProjectId || !attachmentId ||
      !content || content.length > MAX_FALLBACK_CONTENT_LENGTH ||
      !Number.isInteger(chunkIndex) || chunkIndex < 0 ||
      primaryDate === undefined || !rowEmbedding ||
      rowEmbedding.length !== queryEmbedding.length ||
      (projectId && rowProjectId !== projectId)
    ) {
      throw createTransportError("Meeting fallback row validation failed", {
        name: "MeetingFallbackValidationError",
        code: "meeting_fallback_row_invalid"
      });
    }

    const meetingKey = `${rowProjectId}\u0000${meetingId}`;
    const attachmentKey = `${rowProjectId}\u0000${attachmentId}`;
    const positionKey = `${meetingKey}\u0000${attachmentId}\u0000${chunkIndex}`;
    if (seenIds.has(id) || seenPositions.has(positionKey)) {
      throw createTransportError("Meeting fallback identity was not unique", {
        name: "MeetingFallbackValidationError",
        code: "meeting_fallback_identity_not_unique"
      });
    }
    seenIds.add(id);
    seenPositions.add(positionKey);

    if (
      (meetingAttachments.has(meetingKey) && meetingAttachments.get(meetingKey) !== attachmentId) ||
      (attachmentMeetings.has(attachmentKey) && attachmentMeetings.get(attachmentKey) !== meetingId)
    ) {
      throw createTransportError("Meeting fallback relationship validation failed", {
        name: "MeetingFallbackValidationError",
        code: "meeting_fallback_identity_mismatch"
      });
    }
    meetingAttachments.set(meetingKey, attachmentId);
    attachmentMeetings.set(attachmentKey, meetingId);
    projectIds.add(rowProjectId);

    if (
      (dateFrom && (!primaryDate || primaryDate.milliseconds < dateFrom.milliseconds)) ||
      (dateTo && (!primaryDate || primaryDate.milliseconds > dateTo.milliseconds))
    ) {
      continue;
    }

    const vectorScore = cosineSimilarity(queryEmbedding, rowEmbedding);
    if (vectorScore === null) {
      throw createTransportError("Meeting fallback vector validation failed", {
        name: "MeetingFallbackValidationError",
        code: "meeting_fallback_vector_invalid"
      });
    }
    const textScore = lexicalCoverage(query, content);
    const keywordScore = keywordCoverage(keywords, content);
    const metadataScore = dateFrom || dateTo ? 1 : 0;
    const finalScore = roundedScore(
      vectorScore * boundedWeight(subagentCfg.vectorWeight, 0.55) +
      textScore * boundedWeight(subagentCfg.textWeight, 0.25) +
      keywordScore * boundedWeight(subagentCfg.keywordWeight, 0.15) +
      metadataScore * boundedWeight(subagentCfg.metadataWeight, 0.05)
    );

    candidates.push({
      id: row.id,
      content,
      metadata: safeLineMetadata(row?.metadata),
      source_id: Number(meetingId),
      meeting_id: Number(meetingId),
      project_id: rowProjectId,
      attachment_id: attachmentId,
      document_name: null,
      primary_date: primaryDate ? new Date(primaryDate.milliseconds).toISOString() : null,
      chunk_index: chunkIndex,
      vector_score: roundedScore(vectorScore),
      text_score: roundedScore(textScore),
      keyword_score: roundedScore(keywordScore),
      metadata_score: roundedScore(metadataScore),
      final_score: finalScore
    });
  }

  if (!projectId && projectIds.size > 1) {
    throw createTransportError("Unscoped meeting fallback crossed project boundaries", {
      name: "MeetingFallbackScopeError",
      code: "meeting_fallback_multiple_projects"
    });
  }

  const threshold = boundedWeight(subagentCfg.matchThreshold, 0.3);
  const matchCount = Math.max(1, Math.min(Number(subagentCfg.matchCount) || 20, 100));
  return candidates
    // `matchThreshold` is the vector-similarity admission threshold used by
    // the RPC contract. The weighted final score ranks admitted candidates;
    // applying the threshold to that weighted value would reject valid
    // cross-language matches merely because lexical legs are zero.
    .filter((row) => row.vector_score >= threshold)
    .sort((left, right) =>
      right.final_score - left.final_score ||
      right.vector_score - left.vector_score ||
      right.text_score - left.text_score ||
      right.keyword_score - left.keyword_score ||
      (Date.parse(right.primary_date || "") || 0) - (Date.parse(left.primary_date || "") || 0) ||
      Number(left.meeting_id) - Number(right.meeting_id) ||
      compareText(left.attachment_id, right.attachment_id) ||
      left.chunk_index - right.chunk_index ||
      compareText(left.id, right.id)
    )
    .slice(0, matchCount);
}

async function fetchSemanticCompatibilityFallback({
  config,
  subagentCfg,
  queryEmbedding,
  query,
  keywords,
  projectId,
  dateFrom,
  dateTo,
  fetchImpl
}) {
  const contentConfig = contentSupabaseConfig(config);
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,source_id,project_id,attachment_id,content,metadata,primary_date,chunk_index,embedding"
  );
  params.set("embedding", "not.is.null");
  params.set("order", "project_id.asc,source_id.asc,attachment_id.asc,chunk_index.asc,id.asc");
  params.set("limit", String(MAX_SEMANTIC_FALLBACK_ROWS + 1));
  if (projectId) params.set("project_id", `eq.${projectId}`);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Number(subagentCfg.timeoutMs) || 10000)
  );
  let response;
  try {
    // Temporary compatibility path for the structurally broken meetings RPC.
    // It is deliberately one bodyless, exact-count GET through the existing
    // semantic credential; no database object or permission is modified.
    response = await fetchImpl(
      `${contentConfig.supabaseUrl}/rest/v1/${DEFAULT_MEETINGS_TABLE}?${params.toString()}`,
      {
        method: "GET",
        headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey, {
          Accept: "application/json",
          "Accept-Profile": "public",
          Prefer: "count=exact"
        }),
        signal: controller.signal
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let rows;
  try {
    rows = text ? JSON.parse(text) : [];
  } catch {
    throw createTransportError("Meeting fallback returned invalid JSON", {
      name: "MeetingFallbackPayloadError",
      status: response.status,
      code: "meeting_fallback_invalid_json"
    });
  }
  if (!response.ok || !Array.isArray(rows)) {
    throw createTransportError("Meeting fallback read failed", {
      name: "MeetingFallbackReadError",
      status: response.status,
      code: "meeting_fallback_read_failed"
    });
  }

  const exactTotal = parseExactContentRange(response);
  if (
    exactTotal === null ||
    exactTotal > MAX_SEMANTIC_FALLBACK_ROWS ||
    rows.length > MAX_SEMANTIC_FALLBACK_ROWS ||
    rows.length !== exactTotal
  ) {
    throw createTransportError("Meeting fallback result exceeded or did not reconcile to its hard bound", {
      name: "MeetingFallbackBoundError",
      status: response.status,
      code: "meeting_fallback_bound_unverified"
    });
  }

  return validateAndScoreFallbackRows({
    rows,
    queryEmbedding,
    query,
    keywords,
    projectId,
    dateFrom,
    dateTo,
    subagentCfg
  });
}

async function fetchContentRows(config, path, fetchImpl, timeoutMs = 10000) {
  const contentConfig = contentSupabaseConfig(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 10000));
  let response;
  try {
    response = await fetchImpl(`${contentConfig.supabaseUrl}${path}`, {
      method: "GET",
      headers: supabaseHeaders(contentConfig.supabaseServiceRoleKey),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    throw new Error("Content read returned an invalid JSON payload");
  }
  if (!response.ok || !Array.isArray(data)) {
    throw new Error(`Content read failed: ${response.status}`);
  }
  return data;
}

async function fetchExactMeetingEvidence({
  config,
  subagentCfg,
  projectId,
  meetingId,
  attachmentId,
  expectedMeetingDate,
  expectedStatus,
  fetchImpl
}) {
  const normalizedMeetingId = normalizeMeetingId(meetingId);
  const suppliedProjectId = normalizeProjectId(projectId);
  const normalizedAttachmentId = normalizeAttachmentId(attachmentId);
  const normalizedExpectedMeetingDate = normalizeMeetingDate(expectedMeetingDate);
  const normalizedExpectedStatus = normalizeMeetingStatus(expectedStatus);

  if (!normalizedMeetingId) {
    return emptyEvidenceResult("error", "exact_meeting_identity_invalid", "A positive meeting ID is required");
  }
  if (!suppliedProjectId) {
    return emptyEvidenceResult("error", "exact_meeting_scope_invalid", "A valid project scope is required");
  }
  if (!normalizedAttachmentId) {
    return emptyEvidenceResult("error", "exact_meeting_attachment_invalid", "The attachment reference is invalid");
  }
  if (normalizedExpectedMeetingDate === undefined) {
    return emptyEvidenceResult("error", "exact_meeting_date_invalid", "The expected meeting date is invalid");
  }
  if (normalizedExpectedStatus === undefined) {
    return emptyEvidenceResult("error", "exact_meeting_status_invalid", "The expected meeting status is invalid");
  }

  const meetingQuery = new URLSearchParams();
  meetingQuery.set("select", "id,project_id,meeting_date,attachment_id,status");
  meetingQuery.set("id", `eq.${normalizedMeetingId}`);
  meetingQuery.set("project_id", `eq.${suppliedProjectId}`);
  meetingQuery.set("attachment_id", `eq.${normalizedAttachmentId}`);
  meetingQuery.set("limit", "2");

  let meetingRows;
  try {
    meetingRows = await fetchContentRows(
      config,
      `/rest/v1/${DEFAULT_MEETINGS_METADATA_TABLE}?${meetingQuery.toString()}`,
      fetchImpl,
      subagentCfg.timeoutMs
    );
  } catch {
    return emptyEvidenceResult("error", "exact_meeting_metadata_read_failed", "Exact meeting metadata could not be verified");
  }
  if (meetingRows.length !== 1) {
    return emptyEvidenceResult("not_found", "exact_meeting_identity_not_unique");
  }

  const meetingRow = meetingRows[0];
  const echoedMeetingId = normalizeMeetingId(meetingRow?.id);
  const storedProjectId = normalizeProjectId(meetingRow?.project_id);
  const storedAttachmentId = normalizeAttachmentId(meetingRow?.attachment_id);
  const storedMeetingDate = normalizeMeetingDate(meetingRow?.meeting_date);
  const storedStatus = normalizeMeetingStatus(meetingRow?.status);
  if (
    echoedMeetingId !== normalizedMeetingId ||
    storedProjectId !== suppliedProjectId ||
    storedAttachmentId !== normalizedAttachmentId ||
    !storedMeetingDate ||
    !storedStatus ||
    (normalizedExpectedMeetingDate && storedMeetingDate.milliseconds !== normalizedExpectedMeetingDate.milliseconds) ||
    (normalizedExpectedStatus && storedStatus !== normalizedExpectedStatus)
  ) {
    return emptyEvidenceResult("not_found", "exact_meeting_identity_mismatch");
  }

  const maxChunks = Math.max(1, Math.min(Number(subagentCfg.sameMeetingMaxChunks) || 25, 25));
  const chunkQuery = new URLSearchParams();
  chunkQuery.set("select", "id,source_id,project_id,attachment_id,content,chunk_index,primary_date,metadata");
  chunkQuery.set("source_id", `eq.${normalizedMeetingId}`);
  chunkQuery.set("project_id", `eq.${suppliedProjectId}`);
  chunkQuery.set("attachment_id", `eq.${normalizedAttachmentId}`);
  chunkQuery.set("order", "attachment_id.asc,chunk_index.asc,id.asc");
  chunkQuery.set("limit", String(maxChunks + 1));

  let chunks;
  try {
    chunks = await fetchContentRows(
      config,
      `/rest/v1/${DEFAULT_MEETINGS_TABLE}?${chunkQuery.toString()}`,
      fetchImpl,
      subagentCfg.timeoutMs
    );
  } catch {
    return emptyEvidenceResult("error", "exact_meeting_evidence_read_failed", "Exact meeting evidence could not be read");
  }
  if (!chunks.length) return emptyEvidenceResult("not_found", "exact_meeting_evidence_not_found");
  if (chunks.length > maxChunks) {
    return emptyEvidenceResult("not_found", "exact_meeting_evidence_exceeds_bound");
  }

  const seenChunkPositions = new Set();
  const identitiesValid = chunks.every((chunk) => {
    const sourceId = normalizeMeetingId(chunk?.source_id);
    const chunkProjectId = normalizeProjectId(chunk?.project_id);
    const chunkAttachmentId = normalizeAttachmentId(chunk?.attachment_id);
    const chunkIndex = Number(chunk?.chunk_index);
    const content = String(chunk?.content ?? "").trim();
    if (
      chunk?.id === null || chunk?.id === undefined || chunk?.id === "" ||
      sourceId !== normalizedMeetingId ||
      chunkProjectId !== suppliedProjectId ||
      !chunkAttachmentId ||
      chunkAttachmentId !== normalizedAttachmentId ||
      !Number.isInteger(chunkIndex) || chunkIndex < 0 ||
      !content
    ) {
      return false;
    }
    const positionKey = `${chunkAttachmentId}\u0000${chunkIndex}`;
    if (seenChunkPositions.has(positionKey)) return false;
    seenChunkPositions.add(positionKey);
    return true;
  });
  if (!identitiesValid) {
    return emptyEvidenceResult("not_found", "exact_meeting_evidence_identity_mismatch");
  }

  const meetingDate = storedMeetingDate.date;
  const evidence = chunks.map((chunk) => {
    const lines = chunk.metadata?.loc?.lines || {};
    return {
      quote: String(chunk.content),
      chunk_id: chunk.id,
      meeting_id: Number(normalizedMeetingId),
      attachment_id: chunk.attachment_id,
      meeting_date: meetingDate,
      chunk_index: Number(chunk.chunk_index),
      line_from: Number.isInteger(lines.from) ? lines.from : null,
      line_to: Number.isInteger(lines.to) ? lines.to : null,
      final_score: null,
      vector_score: null,
      text_score: null,
      keyword_score: null,
      adjacent_chunks: []
    };
  });

  return {
    status: "found",
    summary: `Found ${evidence.length} exact meeting evidence chunks${meetingDate ? ` (${meetingDate})` : ""}.`,
    evidence,
    conflicts: [],
    insufficient_evidence: false,
    same_meeting_match: true,
    exact_identity_verified: true
  };
}

function detectConflicts(chunks) {
  if (chunks.length < 2) return [];
  const conflicts = [];
  for (let i = 0; i < chunks.length - 1; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const a = chunks[i];
      const b = chunks[j];
      if (a.attachment_id === b.attachment_id) continue;
      if (a.final_score >= 0.7 && b.final_score >= 0.7) {
        conflicts.push({ chunk_a: a.id, chunk_b: b.id });
      }
    }
  }
  return conflicts;
}

export async function runMeetingEvidenceAgent({
  query,
  keywords = [],
  projectId = null,
  meetingId = null,
  attachmentId = null,
  expectedMeetingDate = null,
  expectedStatus = null,
  dateFrom = null,
  dateTo = null,
  requireQuote = true,
  cacheContext = null,
  telemetry = null,
  configOverride = null,
  embeddingOverride = null,
  fetchImpl = globalThis.fetch
}) {
  const config = configOverride || getConfig();
  const saved = config.meetingsEvidence || readLocalSettings().subagents?.meetingsEvidence || {};
  const contentConfig = contentSupabaseConfig(config);

  if (!contentConfig.supabaseUrl || !contentConfig.supabaseServiceRoleKey) {
    return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: "Content Supabase not configured" };
  }

  const subagentCfg = {
    rpcName: saved.rpcName || DEFAULT_MEETINGS_RPC,
    matchCount: saved.matchCount || 20,
    matchThreshold: saved.matchThreshold ?? 0.3,
    vectorWeight: saved.vectorWeight ?? 0.55,
    textWeight: saved.textWeight ?? 0.25,
    keywordWeight: saved.keywordWeight ?? 0.15,
    metadataWeight: saved.metadataWeight ?? 0.05,
    adjacentChunks: saved.adjacentChunks ?? 1,
    sameMeetingMaxChunks: Math.max(1, Math.min(Number(saved.sameMeetingMaxChunks) || 25, 25)),
    requireQuote: saved.requireQuote ?? requireQuote,
    timeoutMs: saved.timeoutMs || 10000
  };

  const exactModeRequested = meetingId !== null && meetingId !== undefined ||
    attachmentId !== null && attachmentId !== undefined;
  if (exactModeRequested) {
    if (attachmentId !== null && attachmentId !== undefined && (meetingId === null || meetingId === undefined)) {
      return emptyEvidenceResult("error", "exact_meeting_identity_required", "Attachment-scoped evidence requires a meeting ID");
    }
    return fetchExactMeetingEvidence({
      config,
      subagentCfg,
      projectId,
      meetingId,
      attachmentId,
      expectedMeetingDate,
      expectedStatus,
      fetchImpl
    });
  }

  const semanticProjectScope = resolveSemanticProjectScope(config, projectId);
  if (!semanticProjectScope.ok) {
    return emptyEvidenceResult(
      "error",
      "meeting_semantic_project_scope_invalid",
      "Meeting semantic project scope is invalid"
    );
  }
  const normalizedDateFrom = normalizeDateBound(dateFrom);
  const normalizedDateTo = normalizeDateBound(dateTo, { inclusiveEndOfDay: true });
  if (
    normalizedDateFrom === undefined ||
    normalizedDateTo === undefined ||
    (normalizedDateFrom && normalizedDateTo && normalizedDateFrom.milliseconds > normalizedDateTo.milliseconds)
  ) {
    return emptyEvidenceResult(
      "error",
      "meeting_semantic_date_scope_invalid",
      "Meeting semantic date scope is invalid"
    );
  }

  const exactDecisionDate = resolveExactDecisionDate(query, dateFrom, dateTo);
  if (isMeetingDecisionDetailRequest(query) && exactDecisionDate !== null) {
    if (exactDecisionDate === undefined) {
      return emptyEvidenceResult(
        "error",
        "meeting_decision_date_scope_invalid",
        "The explicit meeting decision date is invalid or conflicts with the normalized date scope"
      );
    }
    try {
      return await fetchDateScopedMeetingDecisionEvidence({
        config,
        subagentCfg,
        projectId: semanticProjectScope.projectId,
        meetingDate: exactDecisionDate,
        fetchImpl
      });
    } catch (error) {
      logScrubbedProviderFailure("date-scoped decision read", error);
      return emptyEvidenceResult(
        "error",
        "meeting_decision_evidence_read_failed",
        "Date-scoped meeting decisions could not be verified"
      );
    }
  }

  const hasEmbeddingOverride = embeddingOverride !== null && embeddingOverride !== undefined;
  if (!hasEmbeddingOverride && !config.openRouterApiKey) {
    return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: "OPENROUTER_API_KEY not configured" };
  }

  let embedding;
  if (hasEmbeddingOverride) {
    // Testability-only seam: production callers do not supply this value.
    embedding = normalizeEmbeddingVector(embeddingOverride);
    if (!embedding) {
      return emptyEvidenceResult("error", "meeting_embedding_override_invalid", "Meeting embedding override is invalid");
    }
  } else {
    try {
      embedding = normalizeEmbeddingVector(await createEmbedding({
        apiKey: config.openRouterApiKey,
        model: config.models.embedding,
        input: query,
        cacheContext,
        telemetry
      }));
      if (!embedding) throw createTransportError("Embedding payload was invalid", {
        name: "MeetingEmbeddingPayloadError",
        code: "meeting_embedding_invalid"
      });
    } catch (error) {
      logScrubbedProviderFailure("embedding", error);
      return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: "meeting_embedding_failed" };
    }
  }

  let chunks;
  let usedCompatibilityFallback = false;
  try {
    chunks = await callMeetingsRpc(
      config,
      subagentCfg,
      embedding,
      query,
      keywords,
      normalizedDateFrom?.value || null,
      normalizedDateTo?.value || null,
      semanticProjectScope.projectId,
      fetchImpl
    );
  } catch (error) {
    logScrubbedProviderFailure("RPC", error);
    if (!isStructuralRpcFailure(error)) {
      return { status: "error", summary: null, evidence: [], conflicts: [], insufficient_evidence: true, error: "meeting_evidence_rpc_failed" };
    }
    try {
      chunks = await fetchSemanticCompatibilityFallback({
        config,
        subagentCfg,
        queryEmbedding: embedding,
        query,
        keywords,
        projectId: semanticProjectScope.projectId,
        dateFrom: normalizedDateFrom,
        dateTo: normalizedDateTo,
        fetchImpl
      });
      usedCompatibilityFallback = true;
    } catch (fallbackError) {
      logScrubbedProviderFailure("compatibility fallback", fallbackError);
      return {
        status: "error",
        summary: null,
        evidence: [],
        conflicts: [],
        insufficient_evidence: true,
        error: "meeting_evidence_compatibility_fallback_failed"
      };
    }
  }

  if (!chunks.length) {
    return { status: "not_found", summary: null, evidence: [], conflicts: [], insufficient_evidence: true };
  }

  // The compatibility scan already consumed its one bounded read. Adjacent
  // expansion is skipped there so it cannot escape the attested result set.
  const adjacentChunks = usedCompatibilityFallback
    ? []
    : await fetchAdjacentChunks(config, chunks, subagentCfg.adjacentChunks, fetchImpl);

  const conflictsDetected = detectConflicts(chunks);

  const evidence = chunks.map((chunk) => {
    const lines = chunk.metadata?.loc?.lines || {};
    return {
      quote: chunk.content,
      chunk_id: chunk.id,
      meeting_id: chunk.meeting_id ?? chunk.source_id,
      attachment_id: chunk.attachment_id,
      document_name: null,
      meeting_date: chunk.primary_date ? chunk.primary_date.slice(0, 10) : null,
      chunk_index: chunk.chunk_index,
      line_from: lines.from ?? null,
      line_to: lines.to ?? null,
      final_score: chunk.final_score,
      vector_score: chunk.vector_score,
      text_score: chunk.text_score,
      keyword_score: chunk.keyword_score,
      adjacent_chunks: adjacentChunks
        .filter((adj) => adj.attachment_id === chunk.attachment_id)
        .map((adj) => ({ id: adj.id, chunk_index: adj.chunk_index, content: adj.content }))
    };
  });

  const topDate = evidence[0]?.meeting_date || "";
  const topDoc = evidence[0]?.document_name || "";
  const summary = evidence.length
    ? `נמצאו ${evidence.length} ממצאים רלוונטיים${topDoc ? ` — מקור עיקרי: ${topDoc}` : ""}${topDate ? ` (${topDate})` : ""}.`
    : null;

  return {
    status: "found",
    summary,
    evidence,
    conflicts: conflictsDetected,
    insufficient_evidence: false
  };
}

export function formatMeetingCitation(evidenceItem) {
  const rawDate = String(evidenceItem?.meeting_date || "");
  const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateMatch ? `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}` : "";
  const chunkIndex = Number.isInteger(Number(evidenceItem?.chunk_index))
    ? Number(evidenceItem.chunk_index)
    : null;
  const details = [date, chunkIndex === null ? null : `צ'אנק ${chunkIndex}`].filter(Boolean).join(", ");
  return `[ישיבה${details ? `: ${details}` : ""}]`;
}
