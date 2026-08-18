import { ContractsAgentError } from "./errors.js";
import { getSavedContractsClauseWorkspace, parseContractsClauseWorkspaceId } from "./clausePersistence.js";
import {
  CONTRACTS_RELATIONSHIPS_R4_1_AGENT_VERSION,
  CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION,
  CONTRACTS_RELATIONSHIPS_R4_1_PROMPT_VERSION,
  runContractsSemanticRelationshipPreview
} from "./semanticRelationships.js";

function semanticServiceError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

export function contractsSemanticRelationshipsApproved(env = process.env) {
  return String(env.CONTRACTS_RELATIONSHIPS_R4_1_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export function parseContractsSemanticRelationshipRequest(value) {
  const body = value === null || value === undefined ? {} : value;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) {
    throw semanticServiceError(
      "contracts_semantic_relationships_request_invalid",
      "R4.1 accepts no browser-supplied clauses, model settings, database settings, or relationship decisions."
    );
  }
  return {};
}

export function loadContractsSemanticRelationshipsStatus({ config, env = process.env } = {}) {
  const approved = contractsSemanticRelationshipsApproved(env);
  const modelConfigured = Boolean(config?.openRouterApiKey);
  return {
    active: true,
    ready: approved && modelConfigured,
    applyApproved: approved,
    modelConfigured,
    agentVersion: CONTRACTS_RELATIONSHIPS_R4_1_AGENT_VERSION,
    relationshipPolicyVersion: CONTRACTS_RELATIONSHIPS_R4_1_POLICY_VERSION,
    promptVersion: CONTRACTS_RELATIONSHIPS_R4_1_PROMPT_VERSION,
    modelVersion: String(config?.models?.main || "openai/gpt-4o"),
    scope: "same_generation_semantic_clause_pairs",
    persistenceEnabled: false,
    decisionCreationEnabled: false,
    conflictResolutionEnabled: false,
    scheduleWritesEnabled: false,
    reason: approved ? (modelConfigured ? null : "model_key_missing") : "activation_not_approved"
  };
}

export async function previewContractsSemanticRelationships({
  config,
  workspaceId,
  body = {},
  env = process.env,
  fetchImpl = fetch,
  chatComplete,
  deadlineAt,
  signal,
  logger = console
} = {}) {
  parseContractsSemanticRelationshipRequest(body);
  if (!contractsSemanticRelationshipsApproved(env)) {
    throw semanticServiceError(
      "contracts_semantic_relationships_not_enabled",
      "R4.1 semantic relationship preview is not enabled on this server.",
      503
    );
  }
  if (!config?.openRouterApiKey) {
    throw semanticServiceError(
      "contracts_semantic_relationships_unavailable",
      "R4.1 semantic relationship preview requires the configured server-side model key.",
      503
    );
  }
  const normalizedWorkspaceId = parseContractsClauseWorkspaceId(workspaceId);
  const saved = await getSavedContractsClauseWorkspace({
    config,
    workspaceId: normalizedWorkspaceId,
    fetchImpl,
    timeoutMs: remainingMs(deadlineAt)
  });
  const result = await runContractsSemanticRelationshipPreview({
    preview: saved.preview,
    config,
    ...(chatComplete ? { chatComplete } : {}),
    deadlineAt,
    signal,
    logger
  });
  if (result?.metrics?.decisionCount !== 0
      || result?.metrics?.persistenceWriteCount !== 0
      || result?.metrics?.scheduleWriteCount !== 0
      || result?.gates?.relationshipPersistenceEnabled !== false
      || result?.gates?.decisionCreationEnabled !== false
      || result?.gates?.conflictResolutionEnabled !== false
      || result?.gates?.scheduleWritesEnabled !== false) {
    throw semanticServiceError(
      "contracts_semantic_relationships_response_invalid",
      "R4.1 crossed its no-decision, no-persistence, or no-Schedule boundary.",
      502
    );
  }
  return {
    ...result,
    workspace: {
      workspaceId: saved.workspace.workspaceId,
      sourceProjectId: saved.workspace.sourceProjectId,
      documentVersionId: saved.workspace.documentVersionId,
      parserGenerationId: saved.preview?.generations?.parserGenerationId || "",
      filename: saved.workspace.filename,
      projectSite: saved.workspace.projectSite
    }
  };
}

function remainingMs(deadlineAt) {
  if (!Number.isFinite(Number(deadlineAt))) return undefined;
  return Math.max(1_000, Number(deadlineAt) - Date.now());
}
