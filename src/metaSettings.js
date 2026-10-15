// main-agent's settings live in BiDoc's Meta DB, not in main-agent's own MAIN
// database (ADR 0012). One row of the Meta `agent_settings` table (key
// "main-agent") holds the settings blob: prompts, models, presets, tool
// settings, search tuning, time zone, the Contracts approval switches and the
// Contracts storage bucket. Secrets (OpenRouter key, database keys) and
// connections (the old global content DB, the n8n base URL) are env only and
// never part of the row; the Meta migration refuses them.
//
// Reads use the Meta service key (META_SUPABASE_URL +
// META_SUPABASE_SERVICE_ROLE_KEY, the same pair the Company DB cross-check
// uses). The only write is the save_agent_settings RPC, which upserts that row
// and appends the change log (who, when, diff) in one transaction. Nothing
// else in the Meta DB is ever read or written from here, and MAIN is never a
// fallback.

import { normalizeCompanyDbUrl } from "./companyDb.js";

export const META_SETTINGS_KEY = "main-agent";
const META_TIMEOUT_MS = 6000;

export function metaSettingsError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function metaConnection(env) {
  const url = normalizeCompanyDbUrl(env.META_SUPABASE_URL);
  const key = String(env.META_SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw metaSettingsError("meta_not_configured", "META_SUPABASE_URL and META_SUPABASE_SERVICE_ROLE_KEY are not both set");
  }
  return { url, key };
}

export function metaSettingsConfigured(env = process.env) {
  try {
    metaConnection(env);
    return true;
  } catch {
    return false;
  }
}

function headers(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", ...extra };
}

async function metaFetch(fetchImpl, url, options, failureCode) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(META_TIMEOUT_MS) });
  } catch (cause) {
    throw metaSettingsError(failureCode, `The Meta DB could not be reached (${cause?.name || "error"})`, cause);
  }
  const text = await response.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw metaSettingsError(failureCode, `The Meta DB answered ${response.status}${data?.message ? `: ${String(data.message).slice(0, 300)}` : ""}`);
  }
  return data;
}

/**
 * The saved settings blob (an object), or null when the Meta DB has no row yet.
 * Throws meta_not_configured / meta_read_failed when it cannot be read.
 */
export async function readMetaSettings({ env = process.env, fetchImpl = fetch } = {}) {
  const { url, key } = metaConnection(env);
  const rows = await metaFetch(
    fetchImpl,
    `${url}/rest/v1/agent_settings?select=value&key=eq.${encodeURIComponent(META_SETTINGS_KEY)}&limit=1`,
    { method: "GET", headers: headers(key) },
    "meta_read_failed"
  );
  if (!Array.isArray(rows)) throw metaSettingsError("meta_read_failed", "The Meta DB answered an unexpected settings payload");
  if (!rows.length) return null;
  const value = rows[0]?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw metaSettingsError("meta_read_failed", "The Meta settings row is not a JSON object");
  }
  return value;
}

/**
 * Saves the settings blob through save_agent_settings and returns the saved
 * value. `user` is the signed-in Superadmin ({ id, email }); the log records it.
 */
export async function saveMetaSettings({ value, user, env = process.env, fetchImpl = fetch }) {
  const { url, key } = metaConnection(env);
  const saved = await metaFetch(
    fetchImpl,
    `${url}/rest/v1/rpc/save_agent_settings`,
    {
      method: "POST",
      headers: headers(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        p_key: META_SETTINGS_KEY,
        p_value: value,
        p_changed_by: user?.id || null,
        p_changed_by_email: user?.email || null
      })
    },
    "meta_write_failed"
  );
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw metaSettingsError("meta_write_failed", "The Meta DB did not confirm the saved settings");
  }
  return saved;
}
