import { workspaceRpc } from "./workspacePersistence.js";

export const CONTRACTS_PROMOTE_LAB_DECISIONS_RPC = "bidoc_promote_lab_decisions_to_app_v1";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function promoteLabDecisionsToApp({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs = 60_000
} = {}) {
  try {
    const result = await workspaceRpc({
      config,
      rpc: CONTRACTS_PROMOTE_LAB_DECISIONS_RPC,
      payload: { p_private_workspace_id: workspaceId, p_document_sha256: null },
      fetchImpl,
      timeoutMs
    });
    return { ok: true, ...asObject(result) };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || "contracts_promote_lab_decisions_failed").slice(0, 1000),
      code: error?.code || "contracts_promote_lab_decisions_failed"
    };
  }
}
