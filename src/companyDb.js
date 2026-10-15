import { createHash, timingSafeEqual } from "node:crypto";

// The Company DB connection of one request. Everything main-agent does for a
// Project (chat, insights, search, data query, alerts, indexing, schedule,
// graph, timeline) reads and writes only that Project's own Company DB, named
// by the authenticated caller (BiDoc web app or ingest engine) in request
// headers. There is no global content database and no App DB fallback: a
// request whose Company DB cannot be determined is refused before any read.

export const COMPANY_DB_URL_HEADER = "x-content-supabase-url";
export const COMPANY_DB_KEY_HEADER = "x-content-supabase-key";
export const PROJECT_ID_HEADER = "x-project-id";

const DEFAULT_HYBRID_RPC_NAME = "hybrid_match_data_index_embeddings_gf_dor_agent";
const DEFAULT_INDEX_TABLE = "data_index_embeddings_gf_dor_agent";
const DEFAULT_ALERTS_TABLE = "alerts_embeddings_gf";

export function companyDbRequiredError(message = "This request must name its Project and that Project's Company DB (x-project-id, x-content-supabase-url, x-content-supabase-key)") {
  const error = new Error(message);
  error.code = "company_db_required";
  error.status = 400;
  return error;
}

export function companyDbMismatchError(message = "The Company DB in this request is not the Project's own Company DB") {
  const error = new Error(message);
  error.code = "company_db_mismatch";
  error.status = 403;
  return error;
}

// A project-filtered RPC (hybrid/match/graph search) that does not accept its
// Project parameter is refused, never retried without the filter.
export function searchFunctionOutdatedError(rpcName = "search", cause = null) {
  const error = new Error(`Search function out of date for this Company DB: ${rpcName} does not accept the Project filter, so the search was refused rather than run unfiltered`);
  error.code = "search_function_outdated";
  error.status = 503;
  if (cause) error.cause = cause;
  return error;
}

export function isCompanyDbError(error) {
  return ["company_db_required", "company_db_mismatch", "company_db_unverified", "search_function_outdated"].includes(error?.code);
}

function headerValue(req, name) {
  const value = req?.headers?.[name];
  return String((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

// A Company DB URL is an http(s) origin; anything else is not a connection.
export function normalizeCompanyDbUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

// The Company DB named by the request headers ({ supabaseUrl, supabaseServiceRoleKey }),
// or null when either header is missing or unusable.
export function readCompanyDbHeaders(req) {
  const supabaseUrl = normalizeCompanyDbUrl(headerValue(req, COMPANY_DB_URL_HEADER));
  const supabaseServiceRoleKey = headerValue(req, COMPANY_DB_KEY_HEADER);
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return { supabaseUrl, supabaseServiceRoleKey };
}

// The request config's Company DB connection. Throws company_db_required when
// the config carries none; it never falls back to the App DB or to a
// globally configured database.
export function companyDbConnection(config) {
  const source = config?.contentSource || {};
  const supabaseUrl = normalizeCompanyDbUrl(source.supabaseUrl);
  const supabaseServiceRoleKey = String(source.supabaseServiceRoleKey || "").trim();
  if (!supabaseUrl || !supabaseServiceRoleKey) throw companyDbRequiredError();
  const alertsTable = source.alertsTable || DEFAULT_ALERTS_TABLE;
  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    hybridRpcName: source.hybridRpcName || config?.retrieval?.rpcName || DEFAULT_HYBRID_RPC_NAME,
    indexTable: source.indexTable || DEFAULT_INDEX_TABLE,
    alertsTable,
    alertsRpcName: source.alertsRpcName || `match_${alertsTable}`,
    // A Lab request's content source is MAIN itself (the Lab dataset, see
    // labDataset.js): a missing table there means "no Lab data yet".
    ...(source.labDataset === true ? { labDataset: true } : {})
  };
}

export function hasCompanyDbConnection(config) {
  try {
    companyDbConnection(config);
    return true;
  } catch {
    return false;
  }
}

// ─── Optional Meta DB cross-check ────────────────────────────────────────────
// With META_SUPABASE_URL + META_SUPABASE_SERVICE_ROLE_KEY set, the Company DB a
// request names must be the one BiDoc's Meta DB records for its Project:
// projects.company_id → companies.supabase_url, and the service key in
// company_credentials. Read-only. Without those env vars the authenticated
// headers are trusted.

const META_CACHE_TTL_MS = 5 * 60 * 1000;
const metaCache = new Map();

export function clearCompanyDbMetaCache() {
  metaCache.clear();
}

export function metaCrossCheckConfigured(env = process.env) {
  return Boolean(normalizeCompanyDbUrl(env.META_SUPABASE_URL) && String(env.META_SUPABASE_SERVICE_ROLE_KEY || "").trim());
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function metaUnverifiedError(message) {
  const error = new Error(message);
  error.code = "company_db_unverified";
  error.status = 503;
  return error;
}

async function metaRead(env, path, fetchImpl) {
  const url = normalizeCompanyDbUrl(env.META_SUPABASE_URL);
  const key = String(env.META_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  let response;
  try {
    response = await fetchImpl(`${url}${path}`, {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    throw metaUnverifiedError("The Project's Company DB could not be verified against the Meta DB");
  }
  if (!response.ok) throw metaUnverifiedError("The Project's Company DB could not be verified against the Meta DB");
  const rows = await response.json().catch(() => null);
  if (!Array.isArray(rows)) throw metaUnverifiedError("The Project's Company DB could not be verified against the Meta DB");
  return rows;
}

// Resolves { companyId, supabaseUrl, serviceKey } for a Project from the Meta DB.
export async function resolveProjectCompanyDbFromMeta({ projectId, env = process.env, fetchImpl = fetch }) {
  const id = encodeURIComponent(String(projectId || ""));
  const [project] = await metaRead(env, `/rest/v1/projects?select=company_id&id=eq.${id}&limit=1`, fetchImpl);
  const companyId = String(project?.company_id || "").trim();
  if (!companyId) throw companyDbMismatchError("The request's Project is not registered to a Company in the Meta DB");
  const company = encodeURIComponent(companyId);
  const [[companyRow], [credential]] = await Promise.all([
    metaRead(env, `/rest/v1/companies?select=supabase_url&id=eq.${company}&limit=1`, fetchImpl),
    metaRead(env, `/rest/v1/company_credentials?select=supabase_service_role_key&company_id=eq.${company}&limit=1`, fetchImpl)
  ]);
  return {
    companyId,
    supabaseUrl: normalizeCompanyDbUrl(companyRow?.supabase_url),
    serviceKey: String(credential?.supabase_service_role_key || "").trim()
  };
}

// Refuses (throws) when the request's Company DB is not the Project's own.
// No-op when the Meta DB env vars are not configured.
export async function verifyCompanyDbAgainstMeta({ projectId, connection, env = process.env, fetchImpl = fetch, now = Date.now }) {
  if (!metaCrossCheckConfigured(env)) return { checked: false };
  if (!projectId || !connection?.supabaseUrl || !connection?.supabaseServiceRoleKey) throw companyDbRequiredError();
  const keyHash = createHash("sha256").update(String(connection.supabaseServiceRoleKey)).digest("hex");
  const cacheKey = `${String(projectId).toLowerCase()}|${connection.supabaseUrl}|${keyHash}`;
  const cached = metaCache.get(cacheKey);
  if (cached && cached > now()) return { checked: true, cached: true };
  const expected = await resolveProjectCompanyDbFromMeta({ projectId, env, fetchImpl });
  if (!expected.supabaseUrl || expected.supabaseUrl !== normalizeCompanyDbUrl(connection.supabaseUrl)) {
    throw companyDbMismatchError("The Company DB URL in this request is not the Project's own Company DB");
  }
  if (!expected.serviceKey || !constantTimeEqual(expected.serviceKey, connection.supabaseServiceRoleKey)) {
    throw companyDbMismatchError("The Company DB key in this request is not the Project's own Company DB key");
  }
  metaCache.set(cacheKey, now() + META_CACHE_TTL_MS);
  return { checked: true, cached: false };
}
