import crypto from "node:crypto";
import {
  CONTRACTS_CLAUSE_PARSER_AGENT_VERSION,
  CONTRACTS_CLAUSE_PARSER_PROMPT_VERSION,
  buildContractsClauseWorkspacePayload,
  createContractsClauseParserGeneration,
  runContractsClauseParser
} from "./clauseParser.js";
import {
  CONTRACTS_AGENT_R3_VERSION,
  CONTRACTS_CLAUSE_ENRICHMENT_PROMPT_VERSION,
  buildContractsClauseEnrichmentRpcPayload,
  createContractsClauseEnrichmentGeneration,
  runContractsClauseEnrichment
} from "./clauseEnrichment.js";
import { projectContractsClausePreview } from "./clausePreview.js";
import { decorateContractsClausePreview } from "./clausePresentation.js";
import { ContractsAgentError } from "./errors.js";
import { parseContractExtractionRequest } from "./request.js";
import {
  assertPrivateStorageBucket,
  contractsWorkspaceStorageBucket,
  verifyExistingStorageObject,
  workspaceRequest,
  workspaceRpc
} from "./workspacePersistence.js";
import {
  CONTRACTS_R6_PHASE3_CLAUSE_PERSISTENCE_RPC,
  contractsR6Phase3Approved,
  loadContractsR6ActiveCatalog,
  persistContractsR6Embeddings
} from "./r6Preparation.js";

export const CONTRACTS_CLAUSE_PERSISTENCE_VERSION = "contracts-clause-persistence.r3.2.v1";
export const CONTRACTS_CLAUSE_PERSISTENCE_MIGRATION_VERSION = "20260815180207";
export const CONTRACTS_CLAUSE_PERSISTENCE_STATUS_RPC = "bidoc_contracts_clause_persistence_status_r3_2";
export const CONTRACTS_CLAUSE_PERSISTENCE_FIND_RPC = "bidoc_contracts_find_clause_workspace_r3_2";
export const CONTRACTS_CLAUSE_PERSISTENCE_GET_RPC = "bidoc_contracts_get_clause_workspace_r3_2";
export const CONTRACTS_CLAUSE_PERSISTENCE_LIST_RPC = "bidoc_contracts_list_clause_workspaces_r3_2";
export const CONTRACTS_CLAUSE_PERSISTENCE_APPLY_RPC = "bidoc_contracts_persist_clause_generation_r3_2";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_CLAUSES = 500;
const DEFAULT_DEADLINE_MS = 240_000;

function persistenceError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function normalizeUuid(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw persistenceError("contracts_clause_persistence_request_invalid", `${field} must be a UUID.`);
  }
  return normalized;
}

function normalizeSha256(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) {
    throw persistenceError("contracts_clause_persistence_request_invalid", "The document SHA-256 is invalid.");
  }
  return normalized;
}

export function contractsClausePersistenceApproved(env = process.env) {
  return String(env.CONTRACTS_CLAUSE_PERSISTENCE_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function contractsClausePersistenceIdentity(config = {}, { useLiteModel = false } = {}) {
  const parser = createContractsClauseParserGeneration();
  const enrichment = createContractsClauseEnrichmentGeneration({
    modelVersion: String(
      useLiteModel
        ? config.models?.lite || config.models?.main || "openai/gpt-4o-mini"
        : config.models?.main || config.models?.lite || "openai/gpt-4o"
    )
  });
  return { parser, enrichment };
}

export function parseContractsClauseWorkspaceListRequest(query) {
  const get = (key) => query instanceof URLSearchParams ? query.get(key) : query?.[key];
  const rawLimit = get("limit");
  const limit = rawLimit === null || rawLimit === undefined || rawLimit === "" ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw persistenceError("contracts_clause_persistence_request_invalid", "limit must be an integer between 1 and 100.");
  }
  return { sourceProjectId: normalizeUuid(get("sourceProjectId"), "sourceProjectId"), limit };
}

export function parseContractsClauseWorkspaceId(value) {
  return normalizeUuid(value, "workspaceId");
}

export async function loadContractsClausePersistenceStatus({
  config,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const storageBucket = contractsWorkspaceStorageBucket(env);
  if (!contractsClausePersistenceApproved(env)) {
    return {
      active: true,
      ready: false,
      applyApproved: false,
      persistenceVersion: CONTRACTS_CLAUSE_PERSISTENCE_VERSION,
      migrationVersion: CONTRACTS_CLAUSE_PERSISTENCE_MIGRATION_VERSION,
      storageBucket,
      reason: "activation_not_approved"
    };
  }
  const status = await workspaceRpc({
    config,
    rpc: CONTRACTS_CLAUSE_PERSISTENCE_STATUS_RPC,
    fetchImpl,
    timeoutMs
  });
  if (status?.persistenceVersion !== CONTRACTS_CLAUSE_PERSISTENCE_VERSION
      || status?.migrationVersion !== CONTRACTS_CLAUSE_PERSISTENCE_MIGRATION_VERSION) {
    throw persistenceError("contracts_clause_persistence_response_invalid", "The R3.2 persistence migration version is unsupported.", 502);
  }
  await assertPrivateStorageBucket({ config, bucket: storageBucket, fetchImpl, timeoutMs });
  return { active: true, ready: true, applyApproved: true, storageBucket, ...status };
}

export async function listSavedContractsClauseWorkspaces({
  config,
  sourceProjectId,
  limit = 50,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_CLAUSE_PERSISTENCE_LIST_RPC,
    payload: {
      p_source_project_id: normalizeUuid(sourceProjectId, "sourceProjectId"),
      p_limit: limit
    },
    fetchImpl,
    timeoutMs
  });
  if (result?.persistenceVersion !== CONTRACTS_CLAUSE_PERSISTENCE_VERSION || !Array.isArray(result.items)) {
    throw persistenceError("contracts_clause_persistence_response_invalid", "The saved clause-generation list is invalid.", 502);
  }
  return result;
}

export async function getSavedContractsClauseWorkspace({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_CLAUSE_PERSISTENCE_GET_RPC,
    payload: { p_workspace_id: parseContractsClauseWorkspaceId(workspaceId) },
    fetchImpl,
    timeoutMs
  });
  if (!result) throw persistenceError("contracts_clause_persistence_not_found", "The saved Contracts Agent extraction was not found.", 404);
  return assertPersistedProjection(result);
}

export async function findSavedContractsClauseWorkspace({
  config,
  sourceProjectId,
  documentSha256,
  identity = contractsClausePersistenceIdentity(config),
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_CLAUSE_PERSISTENCE_FIND_RPC,
    payload: {
      p_source_project_id: normalizeUuid(sourceProjectId, "sourceProjectId"),
      p_document_sha256: normalizeSha256(documentSha256),
      p_parser_generation_id: identity.parser.parserGenerationId,
      p_enrichment_generation_id: identity.enrichment.enrichmentGenerationId
    },
    fetchImpl,
    timeoutMs
  });
  return result === null ? null : assertPersistedProjection(result);
}

export async function runContractsClausePersistence({
  body,
  config,
  reviewerId,
  env = process.env,
  fetchImpl = fetch,
  deadlineAt = Date.now() + DEFAULT_DEADLINE_MS,
  signal = null,
  emit = null,
  parseClauses = runContractsClauseParser,
  enrichClauses = runContractsClauseEnrichment
} = {}) {
  const progress = (stage, details = {}) => {
    if (typeof emit !== "function") return;
    emit({ stage, ...details });
  };
  if (!contractsClausePersistenceApproved(env)) {
    throw persistenceError("contracts_clause_persistence_not_enabled", "R3.2 clause persistence is not enabled on this server.", 503);
  }
  const request = parsePersistenceRequest(body);
  const sourceProjectId = normalizeUuid(request.projectSelection?.projectId, "projectSelection.projectId");
  const normalizedReviewerId = normalizeUuid(reviewerId, "reviewerId");
  const documentSha256 = crypto.createHash("sha256").update(request.pdfBytes).digest("hex");
  const r6Enabled = contractsR6Phase3Approved(env);
  const r6Catalog = r6Enabled
    ? await loadContractsR6ActiveCatalog({ config, fetchImpl, timeoutMs: remainingMs(deadlineAt) })
    : null;
  const identity = contractsClausePersistenceIdentity(config, { useLiteModel: r6Enabled });
  progress("lookup_started");
  const existing = await findSavedContractsClauseWorkspace({
    config,
    sourceProjectId,
    documentSha256,
    identity,
    fetchImpl,
    timeoutMs: remainingMs(deadlineAt)
  });
  if (existing) {
    if (r6Enabled) {
      await persistContractsR6Embeddings({
        config,
        workspaceId: existing.workspace.workspaceId,
        fetchImpl,
        timeoutMs: remainingMs(deadlineAt)
      });
    }
    progress("completed", { reused: true, modelAvoided: true });
    return projectPersistenceResponse(existing, { reused: true, modelAvoided: true });
  }

  progress("parser_started");
  const generation = await parseClauses({
    pdfBytes: request.pdfBytes,
    expectedDocumentVersionId: `sha256:${documentSha256}`,
    expectedParserGenerationId: identity.parser.parserGenerationId,
    deadlineAt,
    signal
  });
  progress("parser_completed", { clauseCount: generation.clauses.length });
  progress("enrichment_started", { clauseCount: generation.clauses.length });
  const enrichment = await enrichClauses({
    generation,
    config,
    ...(r6Catalog ? { controlledTags: r6Catalog.tags } : {}),
    modelVersion: r6Enabled
      ? config.models?.lite || config.models?.main || "openai/gpt-4o-mini"
      : config.models?.main || config.models?.lite || "openai/gpt-4o",
    deadlineAt,
    signal
  });
  progress("enrichment_completed", {
    clauseCount: enrichment.clauses.length,
    modelCallCount: enrichment.qualityLedger?.modelCallCount ?? null
  });
  if (enrichment.enrichmentGenerationId !== identity.enrichment.enrichmentGenerationId) {
    throw persistenceError("contracts_clause_persistence_generation_mismatch", "The enrichment generation changed during the persistence request.", 409);
  }
  const preview = projectContractsClausePreview({ request, generation, enrichment });

  progress("concurrent_lookup_started");
  const afterModel = await findSavedContractsClauseWorkspace({
    config,
    sourceProjectId,
    documentSha256,
    identity,
    fetchImpl,
    timeoutMs: remainingMs(deadlineAt)
  });
  if (afterModel) {
    if (r6Enabled) {
      await persistContractsR6Embeddings({
        config,
        workspaceId: afterModel.workspace.workspaceId,
        fetchImpl,
        timeoutMs: remainingMs(deadlineAt)
      });
    }
    progress("completed", { reused: true, modelAvoided: false, concurrentReuse: true });
    return projectPersistenceResponse(afterModel, { reused: true, modelAvoided: false, concurrentReuse: true });
  }

  const storageBucket = contractsWorkspaceStorageBucket(env);
  progress("storage_check_started");
  await assertPrivateStorageBucket({ config, bucket: storageBucket, fetchImpl, timeoutMs: remainingMs(deadlineAt) });
  const storageObjectKey = `${sourceProjectId}/${documentSha256}.pdf`;
  await uploadImmutablePdf({
    config,
    storageBucket,
    storageObjectKey,
    pdfBytes: request.pdfBytes,
    documentSha256,
    fetchImpl,
    timeoutMs: remainingMs(deadlineAt)
  });
  progress("storage_completed");

  const workspacePayload = buildContractsClauseWorkspacePayload({
    generation,
    sourceProjectId,
    projectSite: request.projectSelection?.projectSite || null,
    filename: request.filename,
    byteCount: request.pdfBytes.length,
    storageBucket,
    storageObjectKey,
    createdBy: normalizedReviewerId,
    extractorVersion: enrichment.enrichmentGenerationId,
    promptVersion: enrichment.promptVersion,
    extractionVersion: enrichment.agentVersion,
    enrichmentIdentity: enrichment.generationFingerprintInput
  });
  workspacePayload.extraction.enrichmentQualityLedger = enrichment.qualityLedger;
  workspacePayload.extraction.previewVersion = preview.previewVersion;
  workspacePayload.extraction.persistenceVersion = CONTRACTS_CLAUSE_PERSISTENCE_VERSION;

  const clauses = generation.clauses.map((clause) => ({
    sourceProjectId,
    documentVersionId: generation.documentVersionId,
    documentSha256: generation.documentSha256,
    parserGenerationId: generation.parserGenerationId,
    clauseKey: clause.clauseKey,
    parentClauseKey: clause.parentClauseKey,
    clauseType: clause.clauseType,
    clauseTitle: clause.clauseTitle,
    clauseOrder: clause.clauseOrder,
    pageStart: clause.pageStart,
    pageEnd: clause.pageEnd,
    rawText: clause.rawText,
    rawTextSha256: clause.rawTextSha256,
    rawData: clause.rawData,
    parserVersion: generation.parserVersion,
    extractorVersion: enrichment.enrichmentGenerationId
  }));
  const enrichments = enrichment.clauses.map((clause) => {
    const payload = buildContractsClauseEnrichmentRpcPayload({
      clause,
      workspaceId: "00000000-0000-4000-8000-000000000000",
      indexRef: null,
      ...(r6Catalog ? { controlledTags: r6Catalog.tags } : {})
    });
    delete payload.workspaceId;
    return payload;
  });
  if (clauses.length < 1 || clauses.length > MAX_CLAUSES || enrichments.length !== clauses.length) {
    throw persistenceError("contracts_clause_persistence_generation_invalid", "The accepted generation is outside the R3.2 clause bound.", 422);
  }

  let persisted;
  try {
    progress("database_persist_started", { clauseCount: clauses.length });
    persisted = await workspaceRpc({
      config,
      rpc: r6Enabled ? CONTRACTS_R6_PHASE3_CLAUSE_PERSISTENCE_RPC : CONTRACTS_CLAUSE_PERSISTENCE_APPLY_RPC,
      payload: {
        p_workspace: workspacePayload,
        p_clauses: clauses,
        p_enrichments: enrichments,
        p_reviewer_id: normalizedReviewerId
      },
      fetchImpl,
      timeoutMs: remainingMs(deadlineAt)
    });
    progress("database_persist_completed", { clauseCount: clauses.length });
  } catch (error) {
    const raced = await findSavedContractsClauseWorkspace({
      config,
      sourceProjectId,
      documentSha256,
      identity,
      fetchImpl,
      timeoutMs: remainingMs(deadlineAt)
    }).catch(() => null);
    if (raced) {
      if (r6Enabled) {
        await persistContractsR6Embeddings({
          config,
          workspaceId: raced.workspace.workspaceId,
          fetchImpl,
          timeoutMs: remainingMs(deadlineAt)
        });
      }
      return projectPersistenceResponse(raced, { reused: true, modelAvoided: false, concurrentReuse: true });
    }
    throw error;
  }
  const canonical = assertPersistedProjection(persisted);
  if (canonical.preview.document.documentVersionId !== preview.document.documentVersionId
      || canonical.preview.generations.enrichmentGenerationId !== enrichment.enrichmentGenerationId
      || canonical.preview.clauses.length !== preview.clauses.length) {
    throw persistenceError("contracts_clause_persistence_response_invalid", "The saved clause generation does not match the accepted in-memory result.", 502);
  }
  if (r6Enabled) {
    await persistContractsR6Embeddings({
      config,
      workspaceId: canonical.workspace.workspaceId,
      fetchImpl,
      timeoutMs: remainingMs(deadlineAt)
    });
  }
  progress("completed", { reused: persisted.persistence?.workspaceReused === true, modelAvoided: false });
  return projectPersistenceResponse(canonical, {
    reused: persisted.persistence?.workspaceReused === true,
    modelAvoided: false,
    concurrentReuse: false
  });
}

function parsePersistenceRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw persistenceError("contracts_clause_persistence_request_invalid", "The persistence request must be an object.");
  }
  if (body.mode !== "persist") {
    throw persistenceError("contracts_clause_persistence_mode_invalid", "R3.2 requires mode=\"persist\".");
  }
  return parseContractExtractionRequest({ ...body, mode: "dry_run" });
}

function assertPersistedProjection(value) {
  if (!value
      || value.persistenceVersion !== CONTRACTS_CLAUSE_PERSISTENCE_VERSION
      || !value.workspace
      || !UUID_PATTERN.test(String(value.workspace.workspaceId || ""))
      || value.preview?.persisted !== true
      || value.preview?.mode !== "persisted"
      || value.preview?.coverage?.accepted !== true
      || value.preview?.quality?.accepted !== true
      || !Array.isArray(value.preview?.clauses)
      || value.preview.clauses.length < 1
      || value.preview.semanticDecisions?.length !== 0
      || value.preview.canonicalRelationships?.length !== 0) {
    throw persistenceError("contracts_clause_persistence_response_invalid", "The saved clause-generation response is invalid.", 502);
  }
  return {
    ...value,
    preview: decorateContractsClausePreview(value.preview)
  };
}

function projectPersistenceResponse(canonical, {
  reused,
  modelAvoided,
  concurrentReuse = false
} = {}) {
  return {
    ...canonical.preview,
    persistenceVersion: CONTRACTS_CLAUSE_PERSISTENCE_VERSION,
    workspace: canonical.workspace,
    reused: Boolean(reused),
    modelAvoided: Boolean(modelAvoided),
    concurrentReuse: Boolean(concurrentReuse)
  };
}

async function uploadImmutablePdf({
  config,
  storageBucket,
  storageObjectKey,
  pdfBytes,
  documentSha256,
  fetchImpl,
  timeoutMs
}) {
  const objectPath = storageObjectKey.split("/").map(encodeURIComponent).join("/");
  const upload = await workspaceRequest({
    config,
    path: `/storage/v1/object/${encodeURIComponent(storageBucket)}/${objectPath}`,
    method: "POST",
    body: pdfBytes,
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, max-age=0, no-store",
      "x-upsert": "false"
    },
    fetchImpl,
    timeoutMs,
    responseCode: "contracts_clause_persistence_storage_response_invalid"
  });
  if (upload.response.ok) return;
  const duplicate = upload.response.status === 409
    || /already exists|duplicate|asset already exists/iu.test(String(upload.data?.message || upload.data?.error || ""));
  if (!duplicate) {
    throw persistenceError(
      "contracts_clause_persistence_storage_upload_failed",
      String(upload.data?.message || upload.data?.error || `Contracts PDF upload failed with status ${upload.response.status}.`).slice(0, 1000),
      upload.response.status >= 500 ? 502 : 400
    );
  }
  await verifyExistingStorageObject({
    config,
    storageBucket,
    storageObjectKey,
    expectedSha256: documentSha256,
    expectedByteCount: pdfBytes.length,
    fetchImpl,
    timeoutMs
  });
}

function remainingMs(deadlineAt) {
  const remaining = Math.floor(Number(deadlineAt) - Date.now());
  if (!Number.isFinite(remaining) || remaining < 1_000) {
    throw persistenceError("contracts_clause_persistence_timeout", "R3.2 clause persistence exceeded its total deadline.", 504);
  }
  return Math.min(60_000, remaining);
}
