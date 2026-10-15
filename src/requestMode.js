import { isTrustedMachineSecret } from "./apiSecurity.js";
import { COMPANY_DB_KEY_HEADER, COMPANY_DB_URL_HEADER } from "./companyDb.js";

// Every main-agent request is exactly one mode, decided once, before any route
// runs (ADR 0012). The mode decides which database connections exist in the
// request config, so the other mode's paths fail closed:
//
//   Project mode  machine secret (BIDOC_API_SECRET / INGEST_API_SECRET) plus a
//                 Project and its Company DB headers. Connections: that Company
//                 DB, plus the Meta settings read (global, not per request).
//                 There is no MAIN connection: main-agent writes no chat copy,
//                 no memory and no annotate vote anywhere.
//   Lab mode      a Superadmin Lab session cookie. Connections: MAIN, plus the
//                 Meta settings save route. Company DB headers are refused.
//
// A request that carries the machine secret is a Project request even when it
// also carries a session cookie: the cookie is ignored, so it never opens the
// Lab's MAIN connection. The Contracts lab keeps its own fixed connection
// (contractsServerConfig) and stays on the Lab side.

export const REQUEST_MODE_PROJECT = "project";
export const REQUEST_MODE_LAB = "lab";

export const MACHINE_SECRET_HEADER = "x-bidoc-api-secret";

// Headers that name or tune a Company DB connection. A Lab request carries none.
export const COMPANY_DB_HEADERS = Object.freeze([
  COMPANY_DB_URL_HEADER,
  COMPANY_DB_KEY_HEADER,
  "x-hybrid-rpc-name",
  "x-index-table",
  "x-alerts-table"
]);

function headerText(req, name) {
  const value = req?.headers?.[name];
  return String((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

export function hasMachineSecretHeader(req) {
  return headerText(req, MACHINE_SECRET_HEADER) !== "";
}

export function hasCompanyDbHeaders(req) {
  return COMPANY_DB_HEADERS.some((name) => headerText(req, name) !== "");
}

function refusal(status, error, message) {
  return { refusal: { status, error, message } };
}

// Decides the mode of an authenticated request, or the refusal to send.
// `session` is the verified Superadmin session of the cookie (or null).
export function decideRequestMode(req, { session = null, env = process.env } = {}) {
  if (hasMachineSecretHeader(req)) {
    if (!isTrustedMachineSecret(req.headers[MACHINE_SECRET_HEADER], env)) return refusal(401, "Unauthorized", "Unauthorized");
    return { mode: REQUEST_MODE_PROJECT, via: "machine_secret" };
  }
  if (session) {
    if (hasCompanyDbHeaders(req)) {
      return refusal(400, "lab_mode_has_no_company_db", "A Lab request works only on MAIN: Company DB headers are refused");
    }
    return { mode: REQUEST_MODE_LAB, via: "session" };
  }
  // Not authenticated: the caller names a Company DB (BiDoc or the engine) or is the standalone UI.
  return hasCompanyDbHeaders(req)
    ? refusal(401, "Unauthorized", "Unauthorized")
    : refusal(401, "התחברות כסופראדמין נדרשת", "התחברות כסופראדמין נדרשת");
}

// The Contracts lab's two entry points keep their existing authentication; both
// are Lab-side (their fixed contractsServerConfig connection, never a Company DB).
export const CONTRACTS_LAB_DECISION = Object.freeze({ mode: REQUEST_MODE_LAB, via: "contracts_fixed_connection" });

const decisions = new WeakMap();

export function recordRequestMode(req, decision) {
  decisions.set(req, decision);
  return decision;
}

export function requestModeDecision(req) {
  return decisions.get(req) || null;
}

export function requestModeOf(req) {
  return decisions.get(req)?.mode || null;
}

export function isProjectModeRequest(req) {
  return requestModeOf(req) === REQUEST_MODE_PROJECT;
}

export function isLabModeRequest(req) {
  return requestModeOf(req) === REQUEST_MODE_LAB;
}

// ─── Route access ────────────────────────────────────────────────────────────
// Which modes may use a route. New routes default to Project-only (they need a
// Company DB), the safer side: a Lab-only route has to be listed here on purpose.
//   shared   any mode, no data connection of its own (settings, agents, models,
//            knowledge files, the in-memory run stream)
//   lab      Lab only (MAIN, or the Contracts lab's fixed connection)
//   both     either mode; in Project mode it still names its Company DB
//   project  Project only (default)

const LAB_ROUTES = [
  /^\/api\/sessions(?:\/[^/]+\/messages)?$/,
  /^\/api\/run-history$/,
  /^\/api\/ai-report\//,
  /^\/api\/qa\//,
  /^\/api\/delay-claims(?:\/|$)/,
  /^\/api\/delay-events\//,
  /^\/api\/system\/restart$/,
  /^\/api\/contracts\//,
  /^\/api\/indicator\/contracts\//,
  /^\/api\/dashboard\/v1\//,
  /^\/api\/settings\/schedule-assignment-agent\/dry-run$/,
  /^\/api\/schedule\/activity-updates\/assignment-agent\/(?:reviews|shadow-report|confirm|reject|review-label)$/
];

const SHARED_ROUTES = [
  /^\/api\/auth\//,
  /^\/api\/runs\/[^/]+\/events$/,
  /^\/api\/settings(?:\/(?:reload|export|import|reset|defaults|restore-defaults|schedule-assignment-agent(?:\/(?:validate|dry-run))?))?$/,
  /^\/api\/agents$/,
  /^\/api\/knowledge\//,
  /^\/api\/openrouter\/models$/,
  /^\/api\/subagents\/[^/]+\/config$/,
  /^\/api\/diagnostics\/connections$/
];

// main-agent's annotate route: Lab votes land in MAIN; a Project's vote is kept
// by BiDoc in its own Company DB, so in Project mode the route writes nothing.
const BOTH_ROUTES = [/^\/api\/messages\/[^/]+\/annotate$/];

export function routeAccess(pathname) {
  const path = String(pathname || "");
  if (!path.startsWith("/api/")) return "shared";
  if (LAB_ROUTES.some((pattern) => pattern.test(path))) return "lab";
  if (SHARED_ROUTES.some((pattern) => pattern.test(path))) return "shared";
  if (BOTH_ROUTES.some((pattern) => pattern.test(path))) return "both";
  return "project";
}

export function routeNeedsCompanyDb(pathname, mode = REQUEST_MODE_PROJECT) {
  if (mode !== REQUEST_MODE_PROJECT) return false;
  const access = routeAccess(pathname);
  return access === "project" || access === "both";
}

// The refusal for a route the request's mode may not use, or null.
export function modeRouteRefusal(mode, pathname) {
  const access = routeAccess(pathname);
  if (mode === REQUEST_MODE_PROJECT && access === "lab") {
    return { status: 403, error: "route_requires_lab_mode", message: "This route works only on MAIN, in a Lab request (a signed-in Superadmin); a Project request has no MAIN connection" };
  }
  if (mode === REQUEST_MODE_LAB && access === "project") {
    return { status: 403, error: "route_requires_project_mode", message: "This route reads a Project's Company DB; a Lab request has no Company DB connection" };
  }
  return null;
}

// ─── Connections of a request config ─────────────────────────────────────────

export function mainUnavailableError(message = "MAIN is not available to a Project request: main-agent keeps no Project state in MAIN") {
  const error = new Error(message);
  error.code = "main_unavailable_in_project_mode";
  error.status = 403;
  return error;
}

export function isProjectModeConfig(config) {
  return config?.requestMode === REQUEST_MODE_PROJECT;
}

// Throws for a Project-mode config. MAIN readers and writers call this (via
// supabase.js) so the other mode's path fails closed instead of reading nothing.
export function assertMainAvailable(config) {
  if (isProjectModeConfig(config)) throw mainUnavailableError();
  return config;
}

// The global settings with the connections of one mode: Project mode drops the
// MAIN connection, Lab mode keeps it and has no Company DB (contentSource carries
// table and RPC names only).
export function configForMode(base, mode) {
  if (mode === REQUEST_MODE_PROJECT) {
    return { ...base, requestMode: REQUEST_MODE_PROJECT, supabaseUrl: "", supabaseServiceRoleKey: "" };
  }
  return {
    ...base,
    requestMode: REQUEST_MODE_LAB,
    contentSource: { ...base.contentSource, supabaseUrl: "", supabaseServiceRoleKey: "" }
  };
}
