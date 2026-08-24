import { timingSafeEqual } from "node:crypto";

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
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

// n8n may invoke the Contracts extraction-only route without a browser session.
// A dedicated secret keeps this paid model boundary independent from the broad
// BIDOC_API_SECRET used by the app BFF and does not grant access to persistence,
// review, Schedule, or database routes.
export function authorizeContractsExtractionRequest(
  req,
  { secret = process.env.CONTRACTS_INGESTION_SECRET } = {}
) {
  return authorizeSecretHeader(req, {
    secret,
    headerName: "x-contracts-ingestion-secret",
    disabledError: "Contracts ingestion API is disabled until CONTRACTS_INGESTION_SECRET is configured"
  });
}
