// Content-table retrieval helpers for the specialist content agents (spec B2,
// docs/n8n-agents-migration-spec.md). Pure logic (column-role detection, row
// merging) is separated from I/O so it is unit-testable; the only network call
// here is the PostgREST OpenAPI introspection, cached per Supabase URL.
//
// Unlike dataQuery's parseOpenApiTables (names only), the parser here keeps
// each column's type/format/description — needed to detect date/embedding
// columns on a user-chosen table.

import { supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const SCHEMA_CACHE_TTL_MS = 10 * 60 * 1000;
const _schemaCache = new Map(); // supabaseUrl -> { at, tables: Map<name, columns[]> }

export function clearContentSchemaCache() {
  _schemaCache.clear();
}

// Parses a PostgREST OpenAPI document into Map<tableName, [{name, type, format, description}]>.
export function parseOpenApiTableColumns(doc = {}) {
  const defs = doc.definitions || doc.components?.schemas || {};
  const tables = new Map();
  for (const [name, schema] of Object.entries(defs)) {
    const properties = schema?.properties || {};
    const columns = Object.entries(properties).map(([column, meta]) => ({
      name: column,
      type: meta?.type || "",
      format: String(meta?.format || ""),
      description: String(meta?.description || "")
    }));
    if (columns.length) tables.set(name, columns);
  }
  return tables;
}

const DATE_NAME_PRIORITY = [
  /^(meeting|received|transaction|report|event|document|data)_date$/,
  /_date$/,
  /^date$/,
  /_at$/
];
const TEXT_NAME_PRIORITY = ["content", "summary", "subject", "title", "body", "description", "name", "topic"];
const AUDIT_COLUMNS = new Set(["created_at", "updated_at"]);

// Pure role detection over a column list. Conservative: prefers domain date
// columns over ingestion timestamps, and ranks text columns by how likely they
// are to carry searchable prose.
export function detectColumnRoles(columns = []) {
  const byName = new Map(columns.map((column) => [column.name, column]));
  const idColumn = byName.has("id")
    ? "id"
    : columns.find((column) => /<pk\s*\/>/.test(column.description))?.name || null;

  const isDateColumn = (column) =>
    ["date", "date-time", "timestamp with time zone", "timestamp without time zone"].some((marker) => column.format.includes(marker) || column.type === "string" && column.format.startsWith("date"));
  const dateCandidates = columns.filter((column) => isDateColumn(column) && !AUDIT_COLUMNS.has(column.name));
  let dateColumn = null;
  for (const pattern of DATE_NAME_PRIORITY) {
    dateColumn = dateCandidates.find((column) => pattern.test(column.name))?.name || null;
    if (dateColumn) break;
  }
  if (!dateColumn) dateColumn = dateCandidates[0]?.name
    || columns.find((column) => column.name === "created_at" && isDateColumn(column))?.name
    || null;

  const embeddingColumn = columns.find((column) =>
    column.name === "embedding" || column.format.includes("vector")
  )?.name || null;

  const textColumns = columns
    .filter((column) => column.type === "string" && !column.format.startsWith("date") && column.name !== embeddingColumn)
    .map((column) => {
      const rank = TEXT_NAME_PRIORITY.findIndex((name) => column.name === name || column.name.includes(name));
      return { name: column.name, rank: rank === -1 ? TEXT_NAME_PRIORITY.length : rank };
    })
    .filter((column) => column.rank < TEXT_NAME_PRIORITY.length)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 4)
    .map((column) => column.name);

  const selectColumns = columns
    .map((column) => column.name)
    .filter((name) => name !== embeddingColumn && name !== "metadata")
    .slice(0, 15);

  return { idColumn, dateColumn, textColumns, embeddingColumn, selectColumns };
}

// Resolves column roles for a table on the Content DB, introspecting (and
// caching) the PostgREST OpenAPI doc. Throws when the table does not exist —
// a wrong user-typed table name should fail loudly, not silently return zero.
export async function resolveTableRoles({ config, table, fetchImpl = fetch }) {
  const contentConfig = contentSupabaseConfig(config);
  if (!contentConfig.supabaseUrl || !contentConfig.supabaseServiceRoleKey) {
    throw new Error("Content Supabase is not configured");
  }
  const cached = _schemaCache.get(contentConfig.supabaseUrl);
  let tables = cached && Date.now() - cached.at < SCHEMA_CACHE_TTL_MS ? cached.tables : null;
  if (!tables) {
    const response = await fetchImpl(`${contentConfig.supabaseUrl}/rest/v1/`, {
      headers: { ...supabaseHeaders(contentConfig.supabaseServiceRoleKey), Accept: "application/openapi+json" }
    });
    const text = await response.text();
    const doc = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(doc?.message || `Content schema introspection failed: ${response.status}`);
    tables = parseOpenApiTableColumns(doc);
    _schemaCache.set(contentConfig.supabaseUrl, { at: Date.now(), tables });
  }
  const columns = tables.get(table);
  if (!columns) throw new Error(`Table "${table}" was not found in the Content DB`);
  return detectColumnRoles(columns);
}

// Extracts 2-3 search tokens from a Hebrew/Latin query for the ilike text leg.
export function extractSearchTerms(query = "", { maxTerms = 3, minLength = 3 } = {}) {
  const tokens = String(query || "").match(/[\p{L}\p{N}]{2,}/gu) || [];
  return [...new Set(tokens.filter((token) => token.length >= minLength))]
    .sort((a, b) => b.length - a.length)
    .slice(0, maxTerms);
}

// Pure merge of the vector and text retrieval legs. Vector rows win dedup
// (they carry similarity); text-only rows cover unembedded records. Order:
// similarity desc, then date desc for text-only rows.
export function mergeRetrievalRows({ vectorRows = [], textRows = [], topK = 12, idColumn = "id" }) {
  const merged = new Map();
  for (const row of vectorRows) {
    const key = String(row?.[idColumn]);
    if (key === "undefined" || merged.has(key)) continue;
    merged.set(key, { ...row, matchedBy: "vector" });
  }
  for (const row of textRows) {
    const key = String(row?.[idColumn]);
    if (key === "undefined") continue;
    if (merged.has(key)) {
      merged.get(key).matchedBy = "both";
    } else {
      merged.set(key, { ...row, matchedBy: "text", similarity: null });
    }
  }
  return [...merged.values()]
    .sort((a, b) => {
      const simA = typeof a.similarity === "number" ? a.similarity : -1;
      const simB = typeof b.similarity === "number" ? b.similarity : -1;
      if (simA !== simB) return simB - simA;
      return String(b.date || "").localeCompare(String(a.date || ""));
    })
    .slice(0, Math.max(1, topK));
}
