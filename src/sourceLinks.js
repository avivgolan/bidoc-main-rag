export const INDEXED_SOURCE_LINK_CONTRACT = "indexed_source_links.v1";

// Some deployed search RPCs omit source_url even though the index row has it.
// Restore only the URL, using the exact index ID and source identity. Never
// infer a link from a similar title, a source category, or another project.
export async function hydrateRetrievedSourceLinks({ results, readIndexRows, projectId = null } = {}) {
  if (!Array.isArray(results) || typeof readIndexRows !== "function") return results;
  const missing = results.filter((row) => row && !retrievedSourceUrl(row) && safeIndexId(row.id));
  const ids = [...new Set(missing.map((row) => safeIndexId(row.id)))].slice(0, 200);
  if (!ids.length) return results;

  const batches = [];
  for (let index = 0; index < ids.length; index += 50) batches.push(ids.slice(index, index + 50));
  const fetched = await Promise.all(batches.map(async (batch) => {
    try {
      const rows = await readIndexRows(batch);
      return Array.isArray(rows) ? rows : [];
    } catch {
      // Missing link metadata must not turn successful retrieval into an error.
      return [];
    }
  }));
  const byId = new Map();
  for (const row of fetched.flat()) {
    const id = safeIndexId(row?.id);
    if (!id || !ids.includes(id)) continue;
    const matches = byId.get(id) || [];
    matches.push(row);
    byId.set(id, matches);
  }

  return results.map((row) => {
    if (!row || retrievedSourceUrl(row)) return row;
    const matches = byId.get(safeIndexId(row.id)) || [];
    if (matches.length !== 1) return row;
    const indexed = matches[0];
    if (!sameSourceIdentity(row, indexed)) return row;
    if (projectId != null && String(indexed.project_id ?? "") !== String(projectId)) return row;
    if (row.project_id != null && String(indexed.project_id ?? "") !== String(row.project_id)) return row;
    const url = safeSourceUrl(indexed.source_url);
    return url ? { ...row, source_url: url } : row;
  });
}

export function indexedSourceLinkReadPath({ table, ids, projectId = null } = {}) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(String(table || ""))) throw new Error("Invalid source-link index table");
  const safeIds = [...new Set((Array.isArray(ids) ? ids : []).map(safeIndexId).filter(Boolean))];
  if (!safeIds.length || safeIds.length > 50) throw new Error("Source-link reads require 1-50 exact index IDs");
  const select = "id,source_table,source_id,project_id,source_url";
  const scope = projectId == null ? "" : `&project_id=eq.${encodeURIComponent(String(projectId))}`;
  return `/rest/v1/${table}?select=${select}&id=in.(${safeIds.map(encodeURIComponent).join(",")})${scope}&limit=${safeIds.length}`;
}

function sameSourceIdentity(left, right) {
  const table = String(left?.source_table || left?.metadata?.source_table || "");
  const sourceId = left?.source_id ?? left?.metadata?.source_id;
  return Boolean(table) && sourceId != null &&
    table === String(right?.source_table || "") &&
    String(sourceId) === String(right?.source_id ?? "");
}

function retrievedSourceUrl(row) {
  return [row?.source_url, row?.url, row?.data_link, row?.metadata?.source_url, row?.metadata?.url, row?.metadata?.data_link]
    .map(safeSourceUrl).find(Boolean) || "";
}

function safeIndexId(value) {
  const id = String(value ?? "");
  return /^(?:[1-9]\d*|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/iu.test(id) ? id : "";
}

function safeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}
