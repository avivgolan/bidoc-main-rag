import { timingSafeEqual } from "node:crypto";

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Machine secrets main-agent trusts for cross-tenant calls (requests that carry
 * x-content-supabase-* headers): the shared BIDOC_API_SECRET used by the BiDoc web
 * app, and INGEST_API_SECRET, a dedicated secret for the ingest engine, so the
 * engine never has to share the web app's secret.
 */
export function isTrustedMachineSecret(provided, env = process.env) {
  const accepted = [env.BIDOC_API_SECRET, env.INGEST_API_SECRET]
    .map((secret) => String(secret || "").trim())
    .filter(Boolean);
  const value = Array.isArray(provided) ? provided[0] : provided;
  return accepted.some((secret) => constantTimeEqual(value, secret));
}

/**
 * A BiDoc-context request names a Company DB (x-content-supabase-url): it
 * comes from the BiDoc web app or the ingest engine, never the standalone UI.
 */
export function isBidocContextRequest(req) {
  const value = req?.headers?.["x-content-supabase-url"];
  return Boolean(String((Array.isArray(value) ? value[0] : value) || "").trim());
}

// The x-bidoc-api-secret check for cross-tenant calls. Fails closed: with no
// BIDOC_API_SECRET / INGEST_API_SECRET configured nothing matches.
export function checkBidocSecretHeader(req, env = process.env) {
  return isTrustedMachineSecret(req?.headers?.["x-bidoc-api-secret"], env);
}

// Read access: a cross-tenant (BiDoc-context) request needs the machine
// secret; a same-origin request needs the standalone UI's superadmin session.
export function authorizeBidocRead(req, { env = process.env, hasSession = false } = {}) {
  return isBidocContextRequest(req) ? checkBidocSecretHeader(req, env) : Boolean(hasSession);
}

function authorizeSecretHeader(req, {
  secret,
  headerName,
  disabledError
}) {
  const configuredSecret = String(secret || "").trim();
  if (!configuredSecret) {
    return {
      ok: false,
      status: 503,
      error: disabledError
    };
  }

  const header = req?.headers?.[headerName];
  const providedSecret = Array.isArray(header) ? header[0] : header;
  if (!constantTimeEqual(providedSecret, configuredSecret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true, status: 200, error: null };
}

// Data Query endpoints expose schema metadata and can trigger database reads and
// paid model calls. Unlike ordinary same-origin reads, they always require the
// server-side BIDOC_API_SECRET. The Main Agent calls the Data Query module
// directly and is not affected by this HTTP boundary.
export function authorizeDataQueryRequest(req, { secret = process.env.BIDOC_API_SECRET } = {}) {
  return authorizeSecretHeader(req, {
    secret,
    headerName: "x-bidoc-api-secret",
    disabledError: "Data Query API is disabled until BIDOC_API_SECRET is configured"
  });
}

// Trusted BiDoc chat callers may attach a prebuilt dashboard context. Unlike the
// legacy cross-tenant check, this path fails closed when no secret is configured
// and compares the secret in constant time.
export function authorizeBidocChatRequest(req, { secret = process.env.BIDOC_API_SECRET } = {}) {
  return authorizeSecretHeader(req, {
    secret,
    headerName: "x-bidoc-api-secret",
    disabledError: "Trusted BiDoc dashboard chat is disabled until BIDOC_API_SECRET is configured"
  });
}

const CONTRACTS_REVIEWER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTRACTS_AUTOMATIC_STEP_PATH = /^\/api\/contracts\/automatic\/workspaces\/[0-9a-f-]+\/steps\/[a-z-]+$/iu;

// File-classify / n8n ingest attributes automatic reviews to this reviewer when
// no browser session is present. Override with CONTRACTS_MACHINE_REVIEWER_ID.
export const CONTRACTS_MACHINE_REVIEWER_FALLBACK_ID = "7eda8445-add6-4fe0-be33-8ad562a3b25d";

export const CONTRACTS_MACHINE_INGEST_PATHS = Object.freeze([
  "/api/contracts/extract",
  "/api/contracts/clauses/preview",
  "/api/contracts/clauses/workspaces/extract"
]);

// n8n File Classify may invoke dry-run parse, R3.2 clause persistence, and the
// automatic upload pipeline without a browser session. The dedicated ingestion
// secret does not open GET listing, activity mapping, or arbitrary database
// routes, and never accepts client database-header overrides.
export function authorizeContractsExtractionRequest(
  req,
  { secret = process.env.CONTRACTS_INGESTION_SECRET || process.env.BIDOC_API_SECRET } = {}
) {
  return authorizeSecretHeader(req, {
    secret,
    headerName: "x-contracts-ingestion-secret",
    disabledError: "Contracts ingestion API is disabled until CONTRACTS_INGESTION_SECRET is configured"
  });
}

export function isContractsMachineIngestPath(method, pathname) {
  if (String(method || "").toUpperCase() !== "POST") return false;
  const path = String(pathname || "");
  return CONTRACTS_MACHINE_INGEST_PATHS.includes(path) || CONTRACTS_AUTOMATIC_STEP_PATH.test(path);
}

export function contractsMachineReviewerId(env = process.env) {
  const configured = String(env.CONTRACTS_MACHINE_REVIEWER_ID || CONTRACTS_MACHINE_REVIEWER_FALLBACK_ID).trim();
  return CONTRACTS_REVIEWER_ID_PATTERN.test(configured) ? configured.toLowerCase() : "";
}

export function resolveContractsReviewerId(req, session, env = process.env) {
  if (session?.sub && CONTRACTS_REVIEWER_ID_PATTERN.test(session.sub)) return String(session.sub).toLowerCase();
  const auth = authorizeContractsExtractionRequest(req, {
    secret: env.CONTRACTS_INGESTION_SECRET || env.BIDOC_API_SECRET
  });
  if (!auth.ok) return "";
  return contractsMachineReviewerId(env);
}
