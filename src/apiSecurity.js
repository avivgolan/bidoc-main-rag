import { timingSafeEqual } from "node:crypto";

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Data Query endpoints expose schema metadata and can trigger database reads and
// paid model calls. Unlike ordinary same-origin reads, they always require the
// server-side BIDOC_API_SECRET. The Main Agent calls the Data Query module
// directly and is not affected by this HTTP boundary.
export function authorizeDataQueryRequest(req, { secret = process.env.BIDOC_API_SECRET } = {}) {
  const configuredSecret = String(secret || "").trim();
  if (!configuredSecret) {
    return {
      ok: false,
      status: 503,
      error: "Data Query API is disabled until BIDOC_API_SECRET is configured"
    };
  }

  const header = req?.headers?.["x-bidoc-api-secret"];
  const providedSecret = Array.isArray(header) ? header[0] : header;
  if (!constantTimeEqual(providedSecret, configuredSecret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true, status: 200, error: null };
}
