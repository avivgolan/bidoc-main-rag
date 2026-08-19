import { getConfig, supabaseHeaders } from "../config.js";
import {
  scheduleRpcRequest,
  scheduleSettings,
  scheduleSupabaseConfig
} from "../scheduleIngestion.js";
import { ContractsAgentError } from "../contracts/errors.js";

export const INDICATOR_CONTRACT_CONDITIONS_VERSION = "indicator-contract-conditions.v1";
export const INDICATOR_CONTRACT_SYNC_RPC = "bidoc_indicator_sync_contract_conditions_v1";
export const INDICATOR_PROJECT_SYNC_RPC = "bidoc_indicator_sync_schedule_project_contract_conditions_v1";
export const INDICATOR_PROJECT_CONTEXT_RPC = "bidoc_indicator_schedule_project_context_v1";
export const CONTRACT_SOURCE_OBJECT_RPC = "bidoc_contracts_source_object_v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function indicatorError(code, message, status = 400, cause = null) {
  return new ContractsAgentError(code, message, status, cause ? { cause } : {});
}

function uuid(value, field) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw indicatorError("indicator_contract_conditions_request_invalid", `${field} must be a UUID.`);
  }
  return normalized;
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/u, "");
}

export function indicatorContractConditionsApproved(env = process.env) {
  return String(env.INDICATOR_CONTRACT_CONDITIONS_V1_APPROVED || "").trim().toUpperCase() === "TRUE";
}

function assertSyncResult(value) {
  if (!value || value.ok !== true || typeof value.committed !== "boolean") {
    throw indicatorError(
      "indicator_contract_conditions_response_invalid",
      "The Indicator contract-condition synchronization response is invalid.",
      502
    );
  }
  return { version: INDICATOR_CONTRACT_CONDITIONS_VERSION, ...value };
}

export async function reconcileContractConditions({
  workspaceId,
  commit = false,
  config = null,
  settings = null,
  env = process.env,
  fetchImpl = fetch
} = {}) {
  if (commit && !indicatorContractConditionsApproved(env)) {
    throw indicatorError(
      "indicator_contract_conditions_not_enabled",
      "Indicator contract-condition writes are not enabled on this server.",
      503
    );
  }
  const result = await scheduleRpcRequest({
    config: config || getConfig(),
    settings: settings || scheduleSettings(),
    rpc: INDICATOR_CONTRACT_SYNC_RPC,
    payload: { p_workspace_id: uuid(workspaceId, "workspaceId"), p_commit: commit === true },
    fetchImpl
  });
  return assertSyncResult(result);
}

export async function reconcileProjectContractConditions({
  projectId,
  commit = false,
  config = null,
  settings = null,
  env = process.env,
  fetchImpl = fetch
} = {}) {
  if (commit && !indicatorContractConditionsApproved(env)) {
    return {
      version: INDICATOR_CONTRACT_CONDITIONS_VERSION,
      ok: true,
      committed: false,
      skipped: true,
      reason: "activation_not_approved"
    };
  }
  const result = await scheduleRpcRequest({
    config: config || getConfig(),
    settings: settings || scheduleSettings(),
    rpc: INDICATOR_PROJECT_SYNC_RPC,
    payload: { p_project_id: uuid(projectId, "projectId"), p_commit: commit === true },
    fetchImpl
  });
  return assertSyncResult(result);
}

export async function resolveIndicatorProjectContext({
  projectId,
  config = null,
  settings = null,
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const normalized = uuid(projectId, "projectId");
  if (!indicatorContractConditionsApproved(env)) {
    return { mappingFound: false, sourceProjectId: normalized, scheduleProjectId: normalized };
  }
  const result = await scheduleRpcRequest({
    config: config || getConfig(),
    settings: settings || scheduleSettings(),
    rpc: INDICATOR_PROJECT_CONTEXT_RPC,
    payload: { p_project_id: normalized },
    fetchImpl
  });
  if (!result?.sourceProjectId || !result?.scheduleProjectId) {
    throw indicatorError("indicator_project_context_invalid", "The Indicator project mapping response is invalid.", 502);
  }
  return result;
}

export async function bestEffortReconcileContractConditions(options = {}) {
  try {
    return await reconcileContractConditions({ ...options, commit: true });
  } catch (error) {
    console.error("[indicator-contract-conditions] reconciliation failed", {
      workspaceId: String(options.workspaceId || ""),
      code: String(error?.code || "indicator_sync_failed"),
      message: String(error?.message || error).replace(/[\r\n]+/gu, " ").slice(0, 1000)
    });
    return {
      version: INDICATOR_CONTRACT_CONDITIONS_VERSION,
      ok: false,
      committed: false,
      retryable: true,
      code: String(error?.code || "indicator_sync_failed"),
      reason: String(error?.message || error).slice(0, 1000)
    };
  }
}

export async function createContractSourceSignedUrl({
  workspaceId,
  decisionId,
  expiresIn = 60,
  config = null,
  settings = null,
  fetchImpl = fetch
} = {}) {
  const cfg = config || getConfig();
  const source = await scheduleRpcRequest({
    config: cfg,
    settings: settings || scheduleSettings(),
    rpc: CONTRACT_SOURCE_OBJECT_RPC,
    payload: {
      p_workspace_id: uuid(workspaceId, "workspaceId"),
      p_decision_id: uuid(decisionId, "decisionId")
    },
    fetchImpl
  });
  if (!source?.storageBucket || !source?.storageObjectKey || !source?.filename) {
    throw indicatorError("contracts_source_object_invalid", "The contract source object is invalid.", 502);
  }

  const target = scheduleSupabaseConfig(cfg, "app_data");
  const objectPath = String(source.storageObjectKey).split("/").map(encodeURIComponent).join("/");
  const response = await fetchImpl(
    `${trimSlash(target.supabaseUrl)}/storage/v1/object/sign/${encodeURIComponent(source.storageBucket)}/${objectPath}`,
    {
      method: "POST",
      headers: supabaseHeaders(target.supabaseServiceRoleKey, { "Cache-Control": "no-store" }),
      body: JSON.stringify({ expiresIn: Math.min(Math.max(Number(expiresIn) || 60, 10), 60) })
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.signedURL && !payload?.signedUrl) {
    throw indicatorError(
      "contracts_source_sign_failed",
      payload?.message || `Could not create a signed contract source URL (${response.status}).`,
      502
    );
  }
  const signedPath = payload.signedURL || payload.signedUrl;
  const signedUrl = /^https?:\/\//iu.test(signedPath)
    ? signedPath
    : `${trimSlash(target.supabaseUrl)}/storage/v1${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
  return {
    signedUrl,
    expiresIn: Math.min(Math.max(Number(expiresIn) || 60, 10), 60),
    filename: source.filename,
    documentVersionId: source.documentVersionId
  };
}
