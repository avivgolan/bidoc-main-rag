import { supabaseHeaders } from "../config.js";
import { contentSupabaseConfig } from "../supabase.js";

const DATA_QUERY_SERVICE_ROLE = "bidoc_data_query";
const TOKEN_REFRESH_SKEW_MS = 60_000;
const tokenCache = new Map();
const tokenRequests = new Map();

export function clearDataQueryAccessTokenCache() {
  tokenCache.clear();
  tokenRequests.clear();
}

export function decodeDataQueryJwtPayload(token = "") {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Data Query access token is not a JWT");
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Data Query access token payload is invalid");
  }
}

export function validateDataQueryAccessToken(token = "") {
  const claims = decodeDataQueryJwtPayload(token);
  const databaseRole = String(claims.role || "");
  const serviceRole = String(claims.app_metadata?.data_query_role || "");
  if (databaseRole === DATA_QUERY_SERVICE_ROLE) {
    return { claims, mode: "legacy_database_role" };
  }
  if (databaseRole === "authenticated" && serviceRole === DATA_QUERY_SERVICE_ROLE) {
    return { claims, mode: "managed_service_account" };
  }
  throw new Error("Data Query access token is missing the bidoc_data_query authorization claim");
}

export async function getDataQueryAccessToken(
  config,
  { fetchImpl = fetch, now = Date.now } = {}
) {
  if (config?.contentSource?.usesAppSupabase === true) {
    throw new Error(
      "Data Query requires explicit CONTENT_SUPABASE_URL and CONTENT_SUPABASE_SERVICE_ROLE_KEY; App/MAIN Supabase fallback is forbidden"
    );
  }
  const email = String(config?.dataQueryServiceEmail || "").trim().toLowerCase();
  const password = String(config?.dataQueryServicePassword || "");
  const legacyToken = String(config?.dataQueryReadAccessToken || "").trim();
  const hasManagedCredential = Boolean(email || password);

  if (!hasManagedCredential) {
    if (!legacyToken) {
      throw new Error(
        "Data Query database credentials are missing; configure DATA_QUERY_SUPABASE_SERVICE_EMAIL and DATA_QUERY_SUPABASE_SERVICE_PASSWORD"
      );
    }
    validateDataQueryAccessToken(legacyToken);
    return legacyToken;
  }
  if (!email || !password) {
    throw new Error(
      "Both DATA_QUERY_SUPABASE_SERVICE_EMAIL and DATA_QUERY_SUPABASE_SERVICE_PASSWORD are required"
    );
  }

  const connection = contentSupabaseConfig(config);
  if (!connection.supabaseUrl || !connection.supabaseServiceRoleKey) {
    throw new Error("Content Supabase is not configured for Data Query authentication");
  }

  const cacheKey = `${connection.supabaseUrl}|${email}`;
  const cached = tokenCache.get(cacheKey);
  if (cached?.accessToken && cached.expiresAtMs - TOKEN_REFRESH_SKEW_MS > now()) {
    return cached.accessToken;
  }
  if (tokenRequests.has(cacheKey)) return tokenRequests.get(cacheKey);

  const request = refreshManagedToken({
    connection,
    email,
    password,
    cached,
    fetchImpl,
    now
  }).finally(() => tokenRequests.delete(cacheKey));
  tokenRequests.set(cacheKey, request);
  const next = await request;
  tokenCache.set(cacheKey, next);
  return next.accessToken;
}

async function refreshManagedToken({ connection, email, password, cached, fetchImpl, now }) {
  if (cached?.refreshToken) {
    try {
      return await requestAuthToken({
        connection,
        grantType: "refresh_token",
        body: { refresh_token: cached.refreshToken },
        fetchImpl,
        now
      });
    } catch {
      // A revoked or expired refresh token is recoverable with the dedicated
      // service account credential. Do not expose either token in the error.
    }
  }
  return requestAuthToken({
    connection,
    grantType: "password",
    body: { email, password },
    fetchImpl,
    now
  });
}

async function requestAuthToken({ connection, grantType, body, fetchImpl, now }) {
  const response = await fetchImpl(
    `${connection.supabaseUrl}/auth/v1/token?grant_type=${encodeURIComponent(grantType)}`,
    {
      method: "POST",
      headers: supabaseHeaders(connection.supabaseServiceRoleKey),
      body: JSON.stringify(body)
    }
  );
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data?.error_description || data?.msg || `Data Query authentication failed: ${response.status}`);
  }

  const accessToken = String(data.access_token || "");
  const refreshToken = String(data.refresh_token || "");
  const { claims } = validateDataQueryAccessToken(accessToken);
  const expiresAtSeconds = Number(data.expires_at || claims.exp || 0);
  const expiresInSeconds = Number(data.expires_in || 0);
  const expiresAtMs = Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0
    ? expiresAtSeconds * 1000
    : now() + Math.max(1, expiresInSeconds) * 1000;
  return { accessToken, refreshToken, expiresAtMs };
}
