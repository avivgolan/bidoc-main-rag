import { workspaceRequest } from "./workspacePersistence.js";

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

export function conflictFingerprint({ scope, workspaceId, clauseKeys }) {
  const keys = [...new Set((clauseKeys || []).map((key) => String(key || "").trim()).filter(Boolean))].sort();
  return `v1|${scope}|${workspaceId}|${keys.join("|") || "empty"}`;
}

export function rowsFromUnresolvedProposals({ workspaceId, proposals }) {
  const byFingerprint = new Map();
  for (const proposal of proposals || []) {
    if (String(proposal?.conflictStatus || "") !== "unresolved") continue;
    const clauseKeys = Array.isArray(proposal.sourceClauseKeys) ? proposal.sourceClauseKeys : [];
    if (clauseKeys.length < 2) continue;
    const fingerprint = conflictFingerprint({
      scope: "same_contract",
      workspaceId,
      clauseKeys
    });
    byFingerprint.set(fingerprint, {
      fingerprint,
      title: String(proposal.titleHe || "").trim() || "סתירה חוזית",
      summary: String(proposal.summaryHe || "").trim() || null,
      statement: String(proposal.decisionTextHe || "").trim() || null,
      scope: "same_contract",
      conflict_kind: "rule_conflict",
      status: "unresolved",
      source: "contracts_agent",
      sides: [...new Set(clauseKeys.map((key) => String(key).trim()).filter(Boolean))]
        .sort()
        .map((clause_key, sort_order) => ({ clause_key, label: null, sort_order }))
    });
  }
  return [...byFingerprint.values()];
}

export async function publishUnresolvedContractConflicts({
  config,
  workspaceId,
  proposals,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const rows = rowsFromUnresolvedProposals({ workspaceId, proposals });
  if (!rows.length) return { published: 0, skipped: "none" };

  const lookup = await workspaceRequest({
    config,
    method: "GET",
    path: `/rest/v1/contract_workspaces?id=eq.${encodeURIComponent(workspaceId)}&select=id,project_id`,
    fetchImpl,
    timeoutMs,
    responseCode: "contracts_conflict_registry_workspace_invalid"
  });
  if (!lookup.response.ok) {
    const code = String(lookup.data?.code || "");
    if (lookup.response.status === 404 || MISSING_TABLE.has(code)) {
      return { published: 0, skipped: "no_public_table" };
    }
    throw lookupError(lookup, "Could not load the public Contract for the conflict registry.");
  }
  const workspace = Array.isArray(lookup.data) ? lookup.data[0] : lookup.data;
  if (!workspace?.project_id) return { published: 0, skipped: "no_public_workspace" };

  let published = 0;
  for (const row of rows) {
    const upsert = await workspaceRequest({
      config,
      method: "POST",
      path: "/rest/v1/contract_conflicts?on_conflict=project_id,fingerprint",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({
        project_id: workspace.project_id,
        workspace_id: workspaceId,
        title: row.title,
        summary: row.summary,
        statement: row.statement,
        scope: row.scope,
        conflict_kind: row.conflict_kind,
        status: row.status,
        fingerprint: row.fingerprint,
        source: row.source,
        updated_at: new Date().toISOString()
      }),
      fetchImpl,
      timeoutMs,
      responseCode: "contracts_conflict_registry_upsert_invalid"
    });
    if (!upsert.response.ok) {
      const code = String(upsert.data?.code || "");
      if (upsert.response.status === 404 || MISSING_TABLE.has(code)) {
        return { published, skipped: "no_public_table" };
      }
      throw lookupError(upsert, "Could not write the סתירה חוזית registry row.");
    }
    const saved = Array.isArray(upsert.data) ? upsert.data[0] : upsert.data;
    if (!saved?.id) continue;
    await workspaceRequest({
      config,
      method: "DELETE",
      path: `/rest/v1/contract_conflict_sides?conflict_id=eq.${encodeURIComponent(saved.id)}`,
      fetchImpl,
      timeoutMs,
      responseCode: "contracts_conflict_registry_sides_invalid"
    });
    const sides = await workspaceRequest({
      config,
      method: "POST",
      path: "/rest/v1/contract_conflict_sides",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row.sides.map((side) => ({
        conflict_id: saved.id,
        project_id: workspace.project_id,
        workspace_id: workspaceId,
        clause_key: side.clause_key,
        label: side.label,
        sort_order: side.sort_order
      }))),
      fetchImpl,
      timeoutMs,
      responseCode: "contracts_conflict_registry_sides_invalid"
    });
    if (!sides.response.ok) {
      throw lookupError(sides, "Could not write the סתירה חוזית sides.");
    }
    published += 1;
  }
  return { published, skipped: null };
}

function lookupError(result, message) {
  const error = new Error(message);
  error.status = result.response?.status || 502;
  error.detail = result.data;
  return error;
}
