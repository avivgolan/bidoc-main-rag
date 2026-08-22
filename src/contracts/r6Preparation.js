import { createEmbedding } from "../openrouter.js";
import { ContractsAgentError } from "./errors.js";
import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_R6_PHASE3_CATALOG_RPC = "bidoc_contracts_r6_active_catalog_v1";
export const CONTRACTS_R6_PHASE3_EMBEDDING_WORK_RPC = "bidoc_contracts_r6_embedding_work_v2";
export const CONTRACTS_R6_PHASE3_EMBEDDING_APPLY_RPC = "bidoc_contracts_r6_apply_embeddings_v1";
export const CONTRACTS_R6_PHASE3_CLAUSE_PERSISTENCE_RPC = "bidoc_contracts_persist_clause_generation_r6";
export const CONTRACTS_R6_PHASE3_DECISION_PERSISTENCE_RPC = "bidoc_contracts_persist_decisions_r6";
export const CONTRACTS_R6_PHASE3_DECISION_REVIEW_RPC = "bidoc_contracts_review_decision_r6";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const HEBREW_PATTERN = /[\u0590-\u05ff]/u;
const EMBEDDING_DIMENSIONS = 3072;
const EMBEDDING_CONCURRENCY = 2;
const EMBEDDING_APPLY_BATCH_SIZE = 8;

function r6Error(code, message, status = 502, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function uniqueHebrewStrings(values, field) {
  if (!Array.isArray(values) || values.length < 1) {
    throw r6Error("contracts_r6_catalog_invalid", `${field} must contain at least one active Hebrew value.`);
  }
  const normalized = values.map((value) => String(value || "").trim());
  if (normalized.some((value) => !value || !HEBREW_PATTERN.test(value) || /[A-Za-z#]/u.test(value))) {
    throw r6Error("contracts_r6_catalog_invalid", `${field} contains an invalid non-Hebrew value.`);
  }
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right, "he"));
}

function normalizeWorkspaceId(value) {
  const workspaceId = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(workspaceId)) {
    throw r6Error("contracts_r6_embedding_request_invalid", "workspaceId must be a UUID.", 400);
  }
  return workspaceId;
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export function contractsR6Phase3Approved(env = process.env) {
  return String(env.CONTRACTS_R6_PHASE3_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export async function loadContractsR6ActiveCatalog({ config, fetchImpl = fetch, timeoutMs } = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_R6_PHASE3_CATALOG_RPC,
    fetchImpl,
    timeoutMs
  });
  if (!result || result.schemaVersion !== "contracts-r6-catalog.v1") {
    throw r6Error("contracts_r6_catalog_invalid", "The Contracts R6 catalog response is invalid.");
  }
  return {
    tags: uniqueHebrewStrings(result.tags, "tags"),
    triggers: uniqueHebrewStrings(result.triggers, "triggers")
  };
}

function normalizeEmbeddingWorkItems(work) {
  if (!work || work.schemaVersion !== "contracts-r6-embedding-work.v2" || !Array.isArray(work.items)) {
    throw r6Error("contracts_r6_embedding_work_invalid", "The Contracts R6 embedding work response is invalid.");
  }
  return work.items.map((item) => {
    const id = String(item?.id || "").trim().toLowerCase();
    const kind = String(item?.kind || "").trim();
    const input = String(item?.input || "").trim();
    const inputSha256 = String(item?.inputSha256 || "").trim().toLowerCase();
    if (!UUID_PATTERN.test(id)
        || !["document", "decision"].includes(kind)
        || !input
        || input.length > 120_000
        || !SHA256_PATTERN.test(inputSha256)) {
      throw r6Error("contracts_r6_embedding_work_invalid", "A Contracts R6 embedding work item is invalid.");
    }
    return { id, kind, input, inputSha256 };
  });
}

export async function loadContractsR6EmbeddingWork({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const work = await workspaceRpc({
    config,
    rpc: CONTRACTS_R6_PHASE3_EMBEDDING_WORK_RPC,
    payload: { p_workspace_id: normalizedWorkspaceId },
    fetchImpl,
    timeoutMs
  });
  return normalizeEmbeddingWorkItems(work);
}

export async function persistContractsR6EmbeddingItems({
  config,
  workspaceId,
  items,
  fetchImpl = fetch,
  timeoutMs,
  createEmbeddingImpl = createEmbedding
} = {}) {
  if (!config?.openRouterApiKey) {
    throw r6Error("contracts_r6_embeddings_unavailable", "Contracts R6 embeddings require the configured server-side model key.", 503);
  }
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  if (!Array.isArray(items)) {
    throw r6Error("contracts_r6_embedding_work_invalid", "Contracts R6 embedding items must be an array.", 400);
  }
  if (!items.length) return { planned: 0, written: 0, reused: 0 };

  let written = 0;
  let reused = 0;
  for (const itemBatch of chunk(items, EMBEDDING_APPLY_BATCH_SIZE)) {
    const records = [];
    for (const group of chunk(itemBatch, EMBEDDING_CONCURRENCY)) {
      const generated = await Promise.all(group.map(async (item) => {
        const embedding = await createEmbeddingImpl({
          apiKey: config.openRouterApiKey,
          model: config.models?.embedding,
          input: item.input
        });
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS
            || embedding.some((value) => !Number.isFinite(Number(value)))) {
          throw r6Error("contracts_r6_embedding_dimensions_invalid", `Contracts R6 requires ${EMBEDDING_DIMENSIONS}-dimension embeddings.`);
        }
        return { kind: item.kind, id: item.id, inputSha256: item.inputSha256, embedding };
      }));
      records.push(...generated);
    }
    const result = await workspaceRpc({
      config,
      rpc: CONTRACTS_R6_PHASE3_EMBEDDING_APPLY_RPC,
      payload: { p_workspace_id: normalizedWorkspaceId, p_records: records },
      fetchImpl,
      timeoutMs
    });
    if (!result || result.schemaVersion !== "contracts-r6-embedding-apply.v1"
        || !Number.isSafeInteger(Number(result.written))
        || !Number.isSafeInteger(Number(result.reused))) {
      throw r6Error("contracts_r6_embedding_apply_invalid", "The Contracts R6 embedding write response is invalid.");
    }
    written += Number(result.written);
    reused += Number(result.reused);
  }
  return { planned: items.length, written, reused };
}

export async function persistContractsR6Embeddings(options = {}) {
  const items = await loadContractsR6EmbeddingWork(options);
  return persistContractsR6EmbeddingItems({ ...options, items });
}
