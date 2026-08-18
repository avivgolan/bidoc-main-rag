import { ContractsAgentError } from "./errors.js";
import {
  CONTRACTS_RELATIONSHIPS_AGENT_VERSION,
  CONTRACTS_RELATIONSHIP_POLICY_VERSION
} from "./relationshipProposals.js";
import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_RELATIONSHIPS_MIGRATION_VERSION = "20260815182148";
export const CONTRACTS_RELATIONSHIPS_STATUS_RPC = "bidoc_contracts_relationships_status_r4_0";
export const CONTRACTS_RELATIONSHIPS_GET_RPC = "bidoc_contracts_get_relationships_r4_0";
export const CONTRACTS_RELATIONSHIPS_PERSIST_RPC = "bidoc_contracts_persist_explicit_relationships_r4_0";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function relationshipError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function workspaceId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw relationshipError("contracts_relationships_request_invalid", "workspaceId must be a UUID.");
  }
  return normalized;
}

export function contractsRelationshipsApproved(env = process.env) {
  return String(env.CONTRACTS_RELATIONSHIPS_R4_APPROVED || "").trim().toUpperCase() === "TRUE";
}

export async function loadContractsRelationshipsStatus({
  config,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsRelationshipsApproved(env)) {
    return {
      active: true,
      ready: false,
      applyApproved: false,
      agentVersion: CONTRACTS_RELATIONSHIPS_AGENT_VERSION,
      relationshipPolicyVersion: CONTRACTS_RELATIONSHIP_POLICY_VERSION,
      migrationVersion: CONTRACTS_RELATIONSHIPS_MIGRATION_VERSION,
      scope: "explicit_references_only",
      reason: "activation_not_approved",
      modelGroupingEnabled: false,
      decisionCreationEnabled: false,
      conflictResolutionEnabled: false,
      scheduleWritesEnabled: false
    };
  }
  const status = await workspaceRpc({
    config,
    rpc: CONTRACTS_RELATIONSHIPS_STATUS_RPC,
    fetchImpl,
    timeoutMs
  });
  assertStatus(status);
  return { active: true, ready: true, applyApproved: true, ...status };
}

export async function loadContractsRelationships({
  config,
  workspaceId: value,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_RELATIONSHIPS_GET_RPC,
    payload: {
      p_workspace_id: workspaceId(value),
      p_relationship_policy_version: CONTRACTS_RELATIONSHIP_POLICY_VERSION
    },
    fetchImpl,
    timeoutMs
  });
  if (!result) {
    throw relationshipError("contracts_relationships_workspace_not_found", "The saved R3.2 clause workspace was not found.", 404);
  }
  return assertProjection(result);
}

export async function persistContractsExplicitRelationships({
  config,
  workspaceId: value,
  env = process.env,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  if (!contractsRelationshipsApproved(env)) {
    throw relationshipError("contracts_relationships_not_enabled", "R4.0 relationship persistence is not enabled on this server.", 503);
  }
  const result = await workspaceRpc({
    config,
    rpc: CONTRACTS_RELATIONSHIPS_PERSIST_RPC,
    payload: {
      p_workspace_id: workspaceId(value),
      p_relationship_policy_version: CONTRACTS_RELATIONSHIP_POLICY_VERSION
    },
    fetchImpl,
    timeoutMs
  });
  return assertProjection(result, { persistenceRequired: true });
}

function assertStatus(value) {
  if (!value
      || value.agentVersion !== CONTRACTS_RELATIONSHIPS_AGENT_VERSION
      || value.relationshipPolicyVersion !== CONTRACTS_RELATIONSHIP_POLICY_VERSION
      || value.migrationVersion !== CONTRACTS_RELATIONSHIPS_MIGRATION_VERSION
      || value.scope !== "explicit_references_only"
      || value.modelGroupingEnabled !== false
      || value.decisionCreationEnabled !== false
      || value.conflictResolutionEnabled !== false
      || value.scheduleWritesEnabled !== false) {
    throw relationshipError("contracts_relationships_response_invalid", "The R4.0 relationship migration version is unsupported.", 502);
  }
  return value;
}

function assertProjection(value, { persistenceRequired = false } = {}) {
  assertStatus({
    ...value,
    modelGroupingEnabled: value?.gates?.modelGroupingEnabled,
    decisionCreationEnabled: value?.gates?.decisionCreationEnabled,
    conflictResolutionEnabled: value?.gates?.conflictResolutionEnabled,
    scheduleWritesEnabled: value?.gates?.scheduleWritesEnabled
  });
  if (!value.workspace
      || !UUID_PATTERN.test(String(value.workspace.workspaceId || ""))
      || !Array.isArray(value.items)
      || !Array.isArray(value.unresolvedReferences)
      || !value.metrics
      || value.metrics.modelRelationshipCount !== 0
      || value.metrics.decisionCount !== 0
      || value.metrics.scheduleWriteCount !== 0
      || value.items.some((item) => item.relationshipType !== "cross_reference"
        || item.origin !== "explicit_reference"
        || item.confidence !== null)
      || (persistenceRequired && (!value.persistence || value.persistence.atomic !== true))) {
    throw relationshipError("contracts_relationships_response_invalid", "The R4.0 relationship response is invalid.", 502);
  }
  return value;
}
