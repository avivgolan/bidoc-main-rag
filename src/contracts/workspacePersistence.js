import crypto from "node:crypto";
import { supabaseHeaders } from "../config.js";
import { scheduleSupabaseConfig } from "../scheduleIngestion.js";
import { CONTRACTS_AGENT_VERSION, CONTRACTS_MAX_PDF_BYTES } from "./constants.js";
import { CONTRACTS_COMPILER_VERSION } from "./compiler.js";
import { ContractsAgentError } from "./errors.js";
import { parseContractExtractionRequest } from "./request.js";
import { assertContractExtractionSchema } from "./schema.js";

export const CONTRACTS_WORKSPACE_VERSION = "contracts-workspace.phase3f1.v1";
export const CONTRACTS_REVIEW_DRAFT_VERSION = "contracts-review-draft.phase3f1.v1";
export const CONTRACTS_WORKSPACE_MIGRATION_VERSION = "20260812135210";
export const CONTRACTS_WORKSPACE_STATUS_RPC = "bidoc_contracts_workspace_status_v1";
export const CONTRACTS_WORKSPACE_UPSERT_RPC = "bidoc_contracts_upsert_workspace_v1";
export const CONTRACTS_WORKSPACE_FIND_RPC = "bidoc_contracts_find_workspace_v1";
export const CONTRACTS_WORKSPACE_GET_RPC = "bidoc_contracts_get_workspace_v1";
export const CONTRACTS_WORKSPACE_LIST_RPC = "bidoc_contracts_list_workspaces_v1";
export const CONTRACTS_WORKSPACE_SAVE_DRAFT_RPC = "bidoc_contracts_save_review_draft_v1";
export const CONTRACTS_WORKSPACE_TIMEOUT_MS = 30_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const WORKSPACE_ID_PATTERN = UUID_PATTERN;
const OUTER_EXTRACTION_FIELDS = new Set(["extractionRequest", "scheduleProjectId"]);
const DRAFT_FIELDS = new Set(["decisions", "reviewReason", "batchId", "reviewedAt", "mappingDraft", "expectedRevision"]);
const DECISION_FIELDS = new Set([
  "action",
  "reason",
  "gatesReviewed",
  "milestoneKey",
  "approvedBy",
  "calendarSemantics",
  "conflictReason"
]);

function workspaceError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function plainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw workspaceError("contracts_workspace_request_invalid", `${label} must be a JSON object.`);
  }
  return value;
}

function unexpectedKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.has(key)).sort();
}

function boundedString(value, label, { min = 0, max = 5000, nullable = false } = {}) {
  if (nullable && (value === null || value === undefined || value === "")) return null;
  const normalized = String(value ?? "").normalize("NFC").trim();
  if (normalized.length < min || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw workspaceError("contracts_workspace_request_invalid", `${label} is invalid.`);
  }
  return normalized;
}

function normalizedUuid(value, label) {
  const normalized = String(value || "").trim().toLocaleLowerCase("en");
  if (!UUID_PATTERN.test(normalized)) {
    throw workspaceError("contracts_workspace_request_invalid", `${label} must be a UUID.`);
  }
  return normalized;
}

function normalizeSha256(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("en");
  if (!SHA256_PATTERN.test(normalized)) {
    throw workspaceError("contracts_workspace_document_hash_invalid", "The contract document hash is invalid.");
  }
  return normalized;
}

function unwrapSingleResult(value) {
  if (Array.isArray(value) && value.length === 1) return value[0];
  return value;
}

function connectionFor(config) {
  const connection = scheduleSupabaseConfig(config, "app_data");
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
    throw workspaceError(
      "contracts_workspace_database_missing",
      "APP DATA/KAPAIM is not configured for saved contract workspaces.",
      503
    );
  }
  return {
    supabaseUrl: String(connection.supabaseUrl).replace(/\/+$/u, ""),
    supabaseServiceRoleKey: connection.supabaseServiceRoleKey
  };
}

async function readJsonResponse(response, code) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw workspaceError(code, "The saved-contract service returned invalid JSON.", 502, error);
  }
}

export async function workspaceRequest({
  config,
  path,
  method = "POST",
  body,
  headers = {},
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_WORKSPACE_TIMEOUT_MS,
  responseCode = "contracts_workspace_response_invalid"
}) {
  const connection = connectionFor(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || CONTRACTS_WORKSPACE_TIMEOUT_MS));
  let response;
  try {
    response = await fetchImpl(`${connection.supabaseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: supabaseHeaders(connection.supabaseServiceRoleKey, headers),
      body
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw workspaceError(
      timedOut ? "contracts_workspace_timeout" : "contracts_workspace_transport_failed",
      timedOut ? "The saved-contract service timed out." : "The saved-contract service request failed.",
      timedOut ? 504 : 502,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
  return { response, data: await readJsonResponse(response, responseCode) };
}

export async function workspaceRpc({ config, rpc, payload = {}, fetchImpl = fetch, timeoutMs }) {
  const { response, data: raw } = await workspaceRequest({
    config,
    path: `/rest/v1/rpc/${encodeURIComponent(rpc)}`,
    body: JSON.stringify(payload),
    fetchImpl,
    timeoutMs
  });
  const data = unwrapSingleResult(raw);
  if (!response.ok) {
    const databaseCode = String(data?.code || "");
    const missingRpc = response.status === 404 || ["PGRST202", "42883"].includes(databaseCode);
    const staleDraft = databaseCode === "40001";
    const conflict = ["23503", "23505", "23514", "55000"].includes(databaseCode);
    throw workspaceError(
      missingRpc
        ? "contracts_workspace_migration_missing"
        : staleDraft
          ? "contracts_workspace_draft_stale"
        : conflict
          ? "contracts_workspace_conflict"
          : "contracts_workspace_rpc_failed",
      missingRpc
        ? "The saved-contract workspace migration is not available in APP DATA/KAPAIM."
        : staleDraft
          ? "The saved contract draft changed in another session. Reload it before saving again."
        : String(data?.message || data?.hint || `Saved-contract request failed with status ${response.status}.`).slice(0, 1000),
      missingRpc ? 503 : staleDraft || conflict ? 409 : response.status >= 500 ? 502 : 400
    );
  }
  return data;
}

function assertWorkspaceEnvelope(value, {
  includeExtraction = false,
  sourceProjectId = null,
  scheduleProjectId = null,
  documentSha256 = null
} = {}) {
  if (!value || value.workspaceVersion !== CONTRACTS_WORKSPACE_VERSION) {
    throw workspaceError(
      "contracts_workspace_response_invalid",
      "The saved-contract service returned an unsupported workspace version.",
      502
    );
  }
  const envelopeSourceProjectId = normalizedUuid(value.sourceProjectId, "workspace.sourceProjectId");
  const envelopeScheduleProjectId = normalizedUuid(value.scheduleProjectId, "workspace.scheduleProjectId");
  if (sourceProjectId && envelopeSourceProjectId !== normalizedUuid(sourceProjectId, "sourceProjectId")) {
    throw workspaceError("contracts_workspace_response_invalid", "The saved workspace belongs to a different MAIN project.", 502);
  }
  if (scheduleProjectId && envelopeScheduleProjectId !== normalizedUuid(scheduleProjectId, "scheduleProjectId")) {
    throw workspaceError("contracts_workspace_response_invalid", "The saved workspace belongs to a different Schedule project.", 502);
  }
  if (includeExtraction) {
    assertContractExtractionSchema(value.extraction);
    const extractionSha256 = normalizeSha256(value.extraction.document?.sha256);
    if (
      value.extraction.document?.documentVersionId !== value.documentVersionId
      || value.documentVersionId !== `sha256:${extractionSha256}`
      || value.extraction.projectBinding?.projectId !== envelopeSourceProjectId
      || (documentSha256 && extractionSha256 !== normalizeSha256(documentSha256))
    ) {
      throw workspaceError(
        "contracts_workspace_response_invalid",
        "The saved extraction does not match its workspace document or project identity.",
        502
      );
    }
  }
  return value;
}

export function contractsWorkspacePersistenceApproved(env = process.env) {
  return String(env.CONTRACTS_PHASE3F1_WORKSPACE_PERSISTENCE_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function contractsWorkspaceStorageBucket(env = process.env) {
  const bucket = String(env.CONTRACTS_STORAGE_BUCKET || "contracts-private").trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/u.test(bucket)) {
    throw workspaceError("contracts_workspace_storage_bucket_invalid", "The configured Contracts Storage bucket name is invalid.", 503);
  }
  return bucket;
}

export function contractsExtractionFingerprint(config = {}) {
  const source = JSON.stringify({
    workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
    schemaVersion: "contract-extraction.v1",
    agentVersion: CONTRACTS_AGENT_VERSION,
    compilerVersion: CONTRACTS_COMPILER_VERSION,
    primaryModel: String(config.models?.main || "openai/gpt-4o"),
    retryModel: String(config.models?.lite || "")
  });
  return crypto.createHash("sha256").update(source).digest("hex");
}

export function contractPdfSha256(pdfBytes) {
  return crypto.createHash("sha256").update(pdfBytes).digest("hex");
}

function normalizeExpectedRevision(value) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw workspaceError("contracts_workspace_request_invalid", "expectedRevision must be a non-negative safe integer.");
  }
  return revision;
}

function headerValue(headers, name) {
  if (typeof headers?.get === "function") return headers.get(name);
  const entry = Object.entries(headers || {}).find(([key]) => key.toLocaleLowerCase("en") === name.toLocaleLowerCase("en"));
  return entry?.[1] ?? null;
}

async function readStorageObjectBounded(response, maxBytes = CONTRACTS_MAX_PDF_BYTES) {
  const contentLength = Number(headerValue(response.headers, "content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object exceeds the PDF size limit.", 409);
  }
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object exceeds the PDF size limit.", 409);
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks, total);
  }
  if (typeof response.arrayBuffer === "function") {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) {
      throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object exceeds the PDF size limit.", 409);
    }
    return bytes;
  }
  throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object could not be verified.", 409);
}

export async function verifyExistingStorageObject({
  config,
  storageBucket,
  storageObjectKey,
  expectedSha256,
  expectedByteCount,
  fetchImpl = fetch,
  timeoutMs = CONTRACTS_WORKSPACE_TIMEOUT_MS
}) {
  const connection = connectionFor(config);
  const objectPath = storageObjectKey.split("/").map(encodeURIComponent).join("/");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || CONTRACTS_WORKSPACE_TIMEOUT_MS));
  let response;
  try {
    response = await fetchImpl(
      `${connection.supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(storageBucket)}/${objectPath}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: supabaseHeaders(connection.supabaseServiceRoleKey, {
          Accept: "application/pdf",
          "Cache-Control": "no-store"
        })
      }
    );
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw workspaceError(
      timedOut ? "contracts_workspace_timeout" : "contracts_workspace_storage_object_mismatch",
      timedOut ? "The existing Contracts Storage object verification timed out." : "The existing Contracts Storage object could not be verified.",
      timedOut ? 504 : 409,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object could not be read for verification.", 409);
  }
  const contentType = String(headerValue(response.headers, "content-type") || "").split(";", 1)[0].trim().toLocaleLowerCase("en");
  if (contentType !== "application/pdf") {
    throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object is not a PDF.", 409);
  }
  const bytes = await readStorageObjectBounded(response);
  if (bytes.length !== expectedByteCount || contractPdfSha256(bytes) !== expectedSha256) {
    throw workspaceError("contracts_workspace_storage_object_mismatch", "The existing Contracts Storage object does not match the uploaded PDF.", 409);
  }
}

export function parseWorkspaceExtractionRequest(body) {
  const request = plainObject(body, "The saved-contract extraction request");
  const extra = unexpectedKeys(request, OUTER_EXTRACTION_FIELDS);
  if (extra.length) {
    throw workspaceError("contracts_workspace_request_field_unsupported", `Unsupported saved-contract field: ${extra[0]}.`);
  }
  const extractionRequest = plainObject(request.extractionRequest, "extractionRequest");
  const parsedExtraction = parseContractExtractionRequest(extractionRequest);
  if (!parsedExtraction.projectSelection?.projectId) {
    throw workspaceError("contracts_workspace_project_required", "A saved contract must be bound to a MAIN project UUID.");
  }
  return {
    extractionRequest,
    parsedExtraction: {
      ...parsedExtraction,
      projectSelection: {
        ...parsedExtraction.projectSelection,
        projectId: normalizedUuid(parsedExtraction.projectSelection.projectId, "projectSelection.projectId")
      }
    },
    scheduleProjectId: normalizedUuid(request.scheduleProjectId, "scheduleProjectId")
  };
}

export function parseWorkspaceListRequest(query = new URLSearchParams()) {
  const keys = query instanceof URLSearchParams ? [...new Set(query.keys())] : Object.keys(query || {});
  const extra = keys.filter((key) => !["sourceProjectId", "limit"].includes(key));
  if (extra.length) {
    throw workspaceError("contracts_workspace_request_field_unsupported", `Unsupported saved-contract query field: ${extra.sort()[0]}.`);
  }
  const get = (key) => query instanceof URLSearchParams ? query.get(key) : query?.[key];
  const limitInput = get("limit");
  const limit = limitInput === null || limitInput === undefined || limitInput === "" ? 50 : Number(limitInput);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw workspaceError("contracts_workspace_request_invalid", "limit must be an integer between 1 and 100.");
  }
  return {
    sourceProjectId: normalizedUuid(get("sourceProjectId"), "sourceProjectId"),
    limit
  };
}

export function parseWorkspaceId(value) {
  const workspaceId = String(value || "").trim().toLocaleLowerCase("en");
  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    throw workspaceError("contracts_workspace_request_invalid", "workspaceId must be a UUID.");
  }
  return workspaceId;
}

export function normalizeWorkspaceDraft(body, extraction) {
  const request = plainObject(body, "The contract review draft");
  const extra = unexpectedKeys(request, DRAFT_FIELDS);
  if (extra.length) {
    throw workspaceError("contracts_workspace_request_field_unsupported", `Unsupported draft field: ${extra[0]}.`);
  }
  assertContractExtractionSchema(extraction);
  const supplied = plainObject(request.decisions, "decisions");
  const candidates = extraction.candidates || [];
  const candidateKeys = new Set(candidates.map((candidate) => candidate.candidateKey));
  const unknownKey = Object.keys(supplied).find((key) => !candidateKeys.has(key));
  if (unknownKey) {
    throw workspaceError("contracts_workspace_draft_candidate_unknown", "The draft contains a decision for an unknown contract candidate.");
  }

  const decisions = {};
  for (const candidate of candidates) {
    const decision = plainObject(supplied[candidate.candidateKey], `decision ${candidate.candidateKey}`);
    const decisionExtra = unexpectedKeys(decision, DECISION_FIELDS);
    if (decisionExtra.length) {
      throw workspaceError("contracts_workspace_request_field_unsupported", `Unsupported decision field: ${decisionExtra[0]}.`);
    }
    const action = String(decision.action || "");
    if (!["approve", "reject"].includes(action)) {
      throw workspaceError("contracts_workspace_request_invalid", "Each draft decision must be approve or reject.");
    }
    if (typeof decision.gatesReviewed !== "boolean") {
      throw workspaceError("contracts_workspace_request_invalid", "Each draft decision must include gatesReviewed as a boolean.");
    }
    decisions[candidate.candidateKey] = {
      action,
      reason: boundedString(decision.reason, "decision.reason", { max: 3000 }),
      gatesReviewed: decision.gatesReviewed,
      milestoneKey: boundedString(decision.milestoneKey, "decision.milestoneKey", { max: 500 }),
      approvedBy: boundedString(decision.approvedBy, "decision.approvedBy", { max: 500 }),
      calendarSemantics: boundedString(decision.calendarSemantics, "decision.calendarSemantics", { max: 100 }),
      conflictReason: boundedString(decision.conflictReason, "decision.conflictReason", { max: 3000 })
    };
  }

  const reviewedDecisions = Object.values(decisions).filter((decision) => Boolean(decision.reason));
  const approvedCount = reviewedDecisions.filter((decision) => decision.action === "approve").length;
  const rejectedCount = reviewedDecisions.filter((decision) => decision.action === "reject").length;
  const reviewedAt = boundedString(request.reviewedAt, "reviewedAt", { min: 1, max: 100 });
  if (Number.isNaN(Date.parse(reviewedAt))) {
    throw workspaceError("contracts_workspace_request_invalid", "reviewedAt must be an ISO date-time.");
  }
  const mappingDraft = request.mappingDraft === null || request.mappingDraft === undefined
    ? null
    : structuredClone(plainObject(request.mappingDraft, "mappingDraft"));
  if (mappingDraft && Buffer.byteLength(JSON.stringify(mappingDraft), "utf8") > 50_000) {
    throw workspaceError("contracts_workspace_request_invalid", "mappingDraft is too large.");
  }

  return {
    decisions,
    reviewReason: boundedString(request.reviewReason, "reviewReason", { max: 5000 }),
    batchId: boundedString(request.batchId, "batchId", { min: 1, max: 300 }),
    reviewedAt: new Date(reviewedAt).toISOString(),
    mappingDraft,
    candidateCount: candidates.length,
    reviewedCount: reviewedDecisions.length,
    approvedCount,
    rejectedCount
  };
}

export async function loadContractsWorkspaceStatus({ config, env = process.env, fetchImpl = fetch, timeoutMs } = {}) {
  const applyApproved = contractsWorkspacePersistenceApproved(env);
  const storageBucket = contractsWorkspaceStorageBucket(env);
  if (!applyApproved) {
    return {
      active: true,
      applyApproved: false,
      ready: false,
      workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
      draftVersion: CONTRACTS_REVIEW_DRAFT_VERSION,
      migrationVersion: CONTRACTS_WORKSPACE_MIGRATION_VERSION,
      storageBucket,
      reason: "activation_not_approved"
    };
  }
  const status = await workspaceRpc({
    config,
    rpc: CONTRACTS_WORKSPACE_STATUS_RPC,
    fetchImpl,
    timeoutMs
  });
  if (
    status?.workspaceVersion !== CONTRACTS_WORKSPACE_VERSION
    || status?.draftVersion !== CONTRACTS_REVIEW_DRAFT_VERSION
    || status?.migrationVersion !== CONTRACTS_WORKSPACE_MIGRATION_VERSION
  ) {
    throw workspaceError("contracts_workspace_response_invalid", "The saved-contract migration version is unsupported.", 502);
  }
  await assertPrivateStorageBucket({ config, bucket: storageBucket, fetchImpl, timeoutMs });
  return { active: true, applyApproved: true, ready: true, ...status, storageBucket };
}

export async function assertPrivateStorageBucket({ config, bucket, fetchImpl = fetch, timeoutMs } = {}) {
  const normalizedBucket = bucket || contractsWorkspaceStorageBucket();
  const { response, data } = await workspaceRequest({
    config,
    path: `/storage/v1/bucket/${encodeURIComponent(normalizedBucket)}`,
    method: "GET",
    fetchImpl,
    timeoutMs,
    responseCode: "contracts_workspace_storage_response_invalid"
  });
  if (!response.ok) {
    throw workspaceError(
      response.status === 404 ? "contracts_workspace_storage_bucket_missing" : "contracts_workspace_storage_failed",
      response.status === 404
        ? "The private Contracts Storage bucket has not been provisioned."
        : String(data?.message || `Contracts Storage validation failed with status ${response.status}.`).slice(0, 1000),
      response.status === 404 ? 503 : response.status >= 500 ? 502 : 400
    );
  }
  if (!data || data.name !== normalizedBucket || data.public !== false) {
    throw workspaceError(
      "contracts_workspace_storage_bucket_not_private",
      "The Contracts Storage bucket must exist and be private.",
      503
    );
  }
  const allowedMimeTypes = data.allowed_mime_types ?? data.allowedMimeTypes;
  const normalizedMimeTypes = Array.isArray(allowedMimeTypes)
    ? [...new Set(allowedMimeTypes.map((value) => String(value || "").trim().toLocaleLowerCase("en")))]
    : [];
  const fileSizeLimit = Number(data.file_size_limit ?? data.fileSizeLimit);
  if (
    normalizedMimeTypes.length !== 1
    || normalizedMimeTypes[0] !== "application/pdf"
    || !Number.isSafeInteger(fileSizeLimit)
    || fileSizeLimit < 1
    || fileSizeLimit > CONTRACTS_MAX_PDF_BYTES
  ) {
    throw workspaceError(
      "contracts_workspace_storage_bucket_unsafe",
      `The Contracts Storage bucket must allow only application/pdf and cap files at ${CONTRACTS_MAX_PDF_BYTES} bytes or less.`,
      503
    );
  }
  return data;
}

export async function findSavedContractWorkspace({
  config,
  sourceProjectId,
  scheduleProjectId,
  documentSha256,
  reviewerId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_WORKSPACE_FIND_RPC,
    payload: {
      p_source_project_id: normalizedUuid(sourceProjectId, "sourceProjectId"),
      p_schedule_project_id: normalizedUuid(scheduleProjectId, "scheduleProjectId"),
      p_document_sha256: normalizeSha256(documentSha256),
      p_extraction_fingerprint: contractsExtractionFingerprint(config),
      p_reviewer_id: normalizedUuid(reviewerId, "reviewerId")
    },
    fetchImpl,
    timeoutMs
  });
  return result === null ? null : assertWorkspaceEnvelope(result, {
    includeExtraction: true,
    sourceProjectId,
    scheduleProjectId,
    documentSha256
  });
}

export async function persistExtractedContractWorkspace({
  config,
  parsedExtraction,
  extraction,
  scheduleProjectId,
  reviewerId,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  assertContractExtractionSchema(extraction);
  const documentSha256 = contractPdfSha256(parsedExtraction.pdfBytes);
  if (
    extraction.document?.sha256 !== documentSha256
    || extraction.document?.documentVersionId !== `sha256:${documentSha256}`
    || extraction.projectBinding?.projectId !== parsedExtraction.projectSelection.projectId
  ) {
    throw workspaceError(
      "contracts_workspace_extraction_identity_mismatch",
      "The validated extraction does not match the uploaded PDF or selected project.",
      502
    );
  }
  const storageBucket = contractsWorkspaceStorageBucket(env);
  await assertPrivateStorageBucket({ config, bucket: storageBucket, fetchImpl, timeoutMs });
  const storageObjectKey = `${parsedExtraction.projectSelection.projectId}/${documentSha256}.pdf`;
  const objectPath = storageObjectKey.split("/").map(encodeURIComponent).join("/");
  const upload = await workspaceRequest({
    config,
    path: `/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath}`,
    method: "POST",
    body: parsedExtraction.pdfBytes,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=0, no-store",
      "x-upsert": "false"
    },
    fetchImpl,
    timeoutMs,
    responseCode: "contracts_workspace_storage_response_invalid"
  });
  if (!upload.response.ok) {
    const duplicate = upload.response.status === 409
      || /already exists|duplicate|asset already exists/iu.test(String(
        upload.data?.message || upload.data?.error || upload.data?.code || ""
      ));
    if (!duplicate) {
      throw workspaceError(
        "contracts_workspace_storage_upload_failed",
        String(upload.data?.message || upload.data?.error || `Contracts PDF upload failed with status ${upload.response.status}.`).slice(0, 1000),
        upload.response.status >= 500 ? 502 : 400
      );
    }
    await verifyExistingStorageObject({
      config,
      storageBucket,
      storageObjectKey,
      expectedSha256: documentSha256,
      expectedByteCount: parsedExtraction.pdfBytes.length,
      fetchImpl,
      timeoutMs
    });
  }

  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_WORKSPACE_UPSERT_RPC,
    payload: {
      p_payload: {
        sourceProjectId: parsedExtraction.projectSelection.projectId,
        scheduleProjectId: normalizedUuid(scheduleProjectId, "scheduleProjectId"),
        projectSite: parsedExtraction.projectSelection.projectSite,
        documentVersionId: extraction.document.documentVersionId,
        documentSha256,
        filename: parsedExtraction.filename,
        mediaType: parsedExtraction.mediaType,
        byteCount: parsedExtraction.pdfBytes.length,
        storageBucket,
        storageObjectKey,
        extractionFingerprint: contractsExtractionFingerprint(config),
        extractionSchemaVersion: extraction.schemaVersion,
        extractionVersion: extraction.extractionVersion,
        extraction,
        candidateCount: extraction.candidates.length,
        createdBy: normalizedUuid(reviewerId, "reviewerId")
      }
    },
    fetchImpl,
    timeoutMs
  });
  const persisted = assertWorkspaceEnvelope(result, {
    includeExtraction: true,
    sourceProjectId: parsedExtraction.projectSelection.projectId,
    scheduleProjectId,
    documentSha256
  });
  if (
    typeof persisted.inserted !== "boolean"
    || typeof persisted.reused !== "boolean"
    || persisted.inserted === persisted.reused
  ) {
    throw workspaceError("contracts_workspace_response_invalid", "The saved-contract UPSERT result is missing canonical insert/reuse state.", 502);
  }
  if (persisted.reused) {
    const canonical = await getSavedContractWorkspace({
      config,
      workspaceId: persisted.workspaceId,
      reviewerId,
      fetchImpl,
      timeoutMs
    });
    return { ...canonical, inserted: false, reused: true };
  }
  return { ...persisted, draft: persisted.draft || null };
}

export function projectSavedContractExtractionResponse(workspace, { modelAvoided = false } = {}) {
  const canonical = assertWorkspaceEnvelope(workspace, { includeExtraction: true });
  const workspaceReused = modelAvoided || canonical.reused === true;
  return {
    ok: true,
    reused: modelAvoided,
    workspaceReused,
    concurrentReuse: !modelAvoided && canonical.reused === true,
    inserted: canonical.inserted === true,
    workspace: canonical,
    extraction: canonical.extraction,
    draft: canonical.draft || null
  };
}

export async function getSavedContractWorkspace({ config, workspaceId, reviewerId, fetchImpl = fetch, timeoutMs } = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_WORKSPACE_GET_RPC,
    payload: {
      p_workspace_id: parseWorkspaceId(workspaceId),
      p_reviewer_id: normalizedUuid(reviewerId, "reviewerId")
    },
    fetchImpl,
    timeoutMs
  });
  if (!result) throw workspaceError("contracts_workspace_not_found", "The saved contract workspace was not found.", 404);
  return assertWorkspaceEnvelope(result, { includeExtraction: true });
}

export async function listSavedContractWorkspaces({
  config,
  sourceProjectId,
  reviewerId,
  limit = 50,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_WORKSPACE_LIST_RPC,
    payload: {
      p_source_project_id: normalizedUuid(sourceProjectId, "sourceProjectId"),
      p_reviewer_id: normalizedUuid(reviewerId, "reviewerId"),
      p_limit: limit
    },
    fetchImpl,
    timeoutMs
  });
  if (!result || result.workspaceVersion !== CONTRACTS_WORKSPACE_VERSION || !Array.isArray(result.items)) {
    throw workspaceError("contracts_workspace_response_invalid", "The saved-contract list response is invalid.", 502);
  }
  return result;
}

export async function saveContractWorkspaceDraft({
  config,
  workspaceId,
  reviewerId,
  draft,
  extraction,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const normalizedWorkspaceId = parseWorkspaceId(workspaceId);
  const expectedRevision = normalizeExpectedRevision(draft?.expectedRevision);
  const normalizedDraft = normalizeWorkspaceDraft(draft, extraction);
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_WORKSPACE_SAVE_DRAFT_RPC,
    payload: {
      p_workspace_id: normalizedWorkspaceId,
      p_reviewer_id: normalizedUuid(reviewerId, "reviewerId"),
      p_expected_revision: expectedRevision,
      p_draft: normalizedDraft
    },
    fetchImpl,
    timeoutMs
  });
  if (
    !result
    || result.draftVersion !== CONTRACTS_REVIEW_DRAFT_VERSION
    || result.workspaceId !== normalizedWorkspaceId
    || !Number.isSafeInteger(result.revision)
    || result.revision !== expectedRevision + 1
  ) {
    throw workspaceError("contracts_workspace_response_invalid", "The saved review draft response is invalid.", 502);
  }
  return result;
}
