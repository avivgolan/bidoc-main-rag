import { resolvePublicContractProjectId, isKapaimStudyCaseProjectId } from "./studyCase.js";
import { workspaceRequest } from "./workspacePersistence.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export async function listPublicContractWorkspaces({
  config,
  sourceProjectId,
  limit = 50,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const projectId = resolvePublicContractProjectId(sourceProjectId);
  if (!projectId) return { items: [] };
  const path = `/rest/v1/contract_workspaces?project_id=eq.${encodeURIComponent(projectId)}&select=id,document_name,document_type,document_sha256,created_at,execution_date,site,parties,page_count&order=created_at.desc&limit=${Math.max(1, Number(limit) || 50)}`;
  try {
    const { response, data } = await workspaceRequest({
      config,
      path,
      method: "GET",
      fetchImpl,
      timeoutMs,
      responseCode: "contracts_public_workspace_list_invalid"
    });
    if (!response.ok) return { items: [] };
    return {
      items: asArray(data).map((row) => ({
        workspaceId: row.id,
        filename: row.document_name,
        documentType: row.document_type,
        documentSha256: row.document_sha256,
        createdAt: row.created_at,
        executionDate: row.execution_date,
        site: row.site,
        projectSite: row.site,
        parties: row.parties,
        pageCount: row.page_count,
        source: "public.contract_workspaces"
      }))
    };
  } catch {
    return { items: [] };
  }
}

export async function getPublicContractWorkspace({
  config,
  workspaceId,
  fetchImpl = fetch,
  timeoutMs
} = {}) {
  const id = String(workspaceId || "").trim();
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return null;
  const { response, data } = await workspaceRequest({
    config,
    path: `/rest/v1/contract_workspaces?id=eq.${encodeURIComponent(id)}&select=*`,
    method: "GET",
    fetchImpl,
    timeoutMs,
    responseCode: "contracts_public_workspace_get_invalid"
  });
  const workspace = asArray(data)[0];
  if (!response.ok || !workspace || !isKapaimStudyCaseProjectId(workspace.project_id)) return null;

  const [{ data: clauses }, { data: decisions }] = await Promise.all([
    workspaceRequest({
      config,
      path: `/rest/v1/contracts_documents?workspace_id=eq.${encodeURIComponent(id)}&select=*&order=clause_order.asc`,
      method: "GET",
      fetchImpl,
      timeoutMs,
      responseCode: "contracts_public_clauses_invalid"
    }).then((result) => ({ data: asArray(result.data) })),
    workspaceRequest({
      config,
      path: `/rest/v1/contract_decisions?workspace_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`,
      method: "GET",
      fetchImpl,
      timeoutMs,
      responseCode: "contracts_public_decisions_invalid"
    }).then((result) => ({ data: asArray(result.data) }))
  ]);

  return {
    workspace: {
      workspaceId: workspace.id,
      filename: workspace.document_name,
      documentType: workspace.document_type,
      projectSite: workspace.site
    },
    preview: {
      document: {
        filename: workspace.document_name,
        documentType: workspace.document_type,
        pageCount: workspace.page_count
      },
      clauses: clauses.map((clause) => ({
        clauseKey: clause.clause_key,
        parentClauseKey: clause.parent_clause_key,
        clauseType: clause.clause_type,
        clauseTitle: clause.clause_title,
        clauseOrder: clause.clause_order,
        pageStart: clause.page_start,
        pageEnd: clause.page_end,
        rawText: clause.exact_text,
        summaryHe: clause.summary_he,
        hashtags: clause.hashtags || []
      })),
      semanticDecisions: decisions.map((decision) => ({
        title: decision.title,
        summary: decision.summary,
        evidenceClauseKeys: decision.evidence_clause_keys || []
      }))
    }
  };
}
