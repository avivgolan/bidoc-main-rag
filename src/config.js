import fs from "node:fs";
import path from "node:path";
import { buildAgentList, defaultPrompts } from "./prompts.js";

const ROOT = process.cwd();
const ENV_FILES = [".env", ".env.local"];

// ---------------------------------------------------------------------------
// Supabase persistence for settings
// Uses env vars directly — never reads from settings to avoid circular deps.
// ---------------------------------------------------------------------------

let _settingsCache = {};
let _settingsCachedAt = 0;
let _settingsLoadedFromDb = false;
let _settingsDbStatus = {
  read: { ok: false, at: null, error: "not loaded yet" },
  write: { ok: false, at: null, error: "not written yet" }
};
const SETTINGS_TTL_MS = 30_000;
const DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS = [
  "חסם",
  "חסמים",
  "מעכב",
  "מעכבים",
  "עיכוב",
  "עיכובים",
  "עיכובי",
  "מתעכב",
  "מתעכבים",
  "סיכון",
  "סיכונים",
  "תלות",
  "תלויות",
  "קריטריון",
  "קריטריונים",
  "נוהל",
  "תקן",
  "blocker",
  "blockers",
  "barrier",
  "barriers",
  "constraint",
  "constraints",
  "risk",
  "risks",
  "dependency",
  "dependencies"
];

async function sbFetch(path, options = {}, operation = "read") {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    markSettingsDbStatus(operation, false, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in env");
    return null;
  }
  try {
    const response = await fetch(`${url}${path}`, {
      ...options,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      markSettingsDbStatus(operation, false, data?.message || `Supabase settings request failed: ${response.status}`);
      return null;
    }
    markSettingsDbStatus(operation, true, "");
    return data;
  } catch (error) {
    markSettingsDbStatus(operation, false, error.message);
    return null;
  }
}

async function loadSettingsFromDb() {
  const rows = await sbFetch("/rest/v1/agent_settings?id=eq.default&select=data", {}, "read");
  if (Array.isArray(rows)) {
    _settingsCache = rows?.[0]?.data || {};
    _settingsLoadedFromDb = Boolean(rows?.[0]?.data);
  } else {
    _settingsLoadedFromDb = false;
  }
  _settingsCachedAt = Date.now();
}

// ---------------------------------------------------------------------------
// One-time migration: clear stale default-prompts stored in Supabase.
// Old code used to persist ALL default prompts to Supabase, which meant that
// when prompts.js was updated, the old cached prompts kept overriding the new
// defaults — causing bugs like the classifier always returning "CHAT".
// After this migration, only user-customised (non-default) prompts are stored.
// ---------------------------------------------------------------------------
const PROMPTS_MIGRATION_FLAG = "__prompts_clean_v1";

async function migratePromptsIfNeeded() {
  if (_settingsCache[PROMPTS_MIGRATION_FLAG]) return; // already migrated
  console.log("[config] Running one-time prompts migration: clearing stale stored defaults…");
  _settingsCache = {
    ..._settingsCache,
    prompts: {}, // wipe all stored prompts → getConfig() will use fresh defaults
    [PROMPTS_MIGRATION_FLAG]: true
  };
  _settingsCachedAt = Date.now();
  await sbFetch("/rest/v1/agent_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: "default", data: _settingsCache, updated_at: new Date().toISOString() })
  }, "write");
  console.log("[config] Prompts migration complete.");
}

export async function initSettings() {
  await loadSettingsFromDb();
  await migratePromptsIfNeeded().catch(() => {});
}

export async function refreshSettingsIfStale() {
  if (Date.now() - _settingsCachedAt > SETTINGS_TTL_MS) {
    await loadSettingsFromDb().catch(() => {});
  }
}

export async function reloadSettingsFromDb() {
  await loadSettingsFromDb();
  return _settingsCache;
}

export function loadEnv() {
  for (const file of ENV_FILES) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

export const TOOL_NAMES = [
  "alert",
  "meetings",
  "emails",
  "whatsapp_messages",
  "financial_transactions",
  "consultants_reports",
  "exceptions_report",
  "quality_control",
  "safety_report",
  "submittals"
];

export function getConfig() {
  const settings = readLocalSettings();
  const toolSettings = settings.tools || {};
  const secrets = settings.secrets || {};
  return {
    port: Number(process.env.PORT || 4000),
    openRouterApiKey: secrets.openRouterApiKey || process.env.OPENROUTER_API_KEY || "",
    openAiApiKey: "",
    supabaseUrl: trimSlash(secrets.supabaseUrl || process.env.SUPABASE_URL || ""),
    supabaseServiceRoleKey: secrets.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    postgresUrl: process.env.POSTGRES_URL || "",
    models: {
      classifier: settings.models?.classifier || process.env.CLASSIFIER_MODEL || "openai/gpt-4o-mini",
      knowledgePlanner: settings.models?.knowledgePlanner || process.env.KNOWLEDGE_PLANNER_MODEL || settings.models?.main || process.env.MAIN_MODEL || "openai/gpt-4o",
      main: settings.models?.main || process.env.MAIN_MODEL || "openai/gpt-4o",
      lite: settings.models?.lite || process.env.LITE_MODEL || "openai/gpt-4o-mini",
      embedding: settings.models?.embedding || process.env.EMBEDDING_MODEL || "openai/text-embedding-3-large",
      reranker: settings.models?.reranker || process.env.RERANKER_MODEL || "openai/gpt-4o-mini"
    },
    prompts: {
      ...defaultPrompts(),
      ...(settings.prompts || {})
    },
    retrieval: {
      rpcName: settings.retrieval?.rpcName || process.env.HYBRID_RPC_NAME || "hybrid_match_data_index_embeddings_gf_dor_agent",
      candidates: Number(settings.retrieval?.candidates || process.env.HYBRID_CANDIDATES || 40),
      rerankTopK: Number(settings.retrieval?.rerankTopK || process.env.RERANK_TOP_K || 10),
      vectorWeight: Number(settings.retrieval?.vectorWeight || process.env.HYBRID_VECTOR_WEIGHT || 0.65),
      keywordWeight: Number(settings.retrieval?.keywordWeight || process.env.HYBRID_KEYWORD_WEIGHT || 0.35)
    },
    knowledge: {
      triggerKeywords: normalizeStringList(settings.knowledge?.triggerKeywords, DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS)
    },
    n8n: {
      baseUrl: trimSlash(settings.n8nBaseUrl || process.env.N8N_BASE_URL || ""),
      tools: Object.fromEntries(
        TOOL_NAMES.map((tool) => [tool, toolSettings[tool] || process.env[`N8N_TOOL_${tool.toUpperCase()}_URL`] || ""])
      )
    },
    timezone: settings.timezone || process.env.TIMEZONE || "UTC+0"
  };
}

export function publicSettings(config = getConfig()) {
  const settings = readLocalSettings();
  return {
    models: config.models,
    retrieval: config.retrieval,
    knowledge: config.knowledge,
    timezone: config.timezone,
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
    openRouterConfigured: Boolean(config.openRouterApiKey),
    n8nBaseUrl: config.n8n.baseUrl,
    secrets: {
      openRouterApiKey: maskSecret(config.openRouterApiKey),
      supabaseUrl: config.supabaseUrl,
      supabaseServiceRoleKey: maskSecret(config.supabaseServiceRoleKey)
    },
    settingsStore: {
      loadedFromSupabase: _settingsLoadedFromDb,
      cacheAgeMs: _settingsCachedAt ? Date.now() - _settingsCachedAt : null,
      read: _settingsDbStatus.read,
      write: _settingsDbStatus.write,
      secretSources: {
        openRouterApiKey: secretSource(settings.secrets?.openRouterApiKey, process.env.OPENROUTER_API_KEY),
        supabaseUrl: secretSource(settings.secrets?.supabaseUrl, process.env.SUPABASE_URL),
        supabaseServiceRoleKey: secretSource(settings.secrets?.supabaseServiceRoleKey, process.env.SUPABASE_SERVICE_ROLE_KEY)
      }
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => {
        const url = resolveToolUrl(tool, config);
        return [tool, { configured: Boolean(url), url }];
      })
    ),
    agents: buildAgentList(config)
  };
}

export function resolveToolUrl(toolName, config = getConfig()) {
  const direct = config.n8n.tools[toolName] || "";
  if (direct) return direct;
  if (!config.n8n.baseUrl) return "";
  return `${config.n8n.baseUrl}/webhook/${toolName}`;
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

function normalizeStringList(value, fallback = []) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]+/)
      : fallback;
  return [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
}

export function readLocalSettings() {
  return _settingsCache;
}

export async function writeLocalSettings(settings) {
  const existing = _settingsCache;
  const incomingSecrets = settings.secrets || {};

  // Only persist prompts that DIFFER from the current defaults.
  // This ensures that whenever prompts.js is updated, new defaults always take
  // effect for any prompt the user hasn't intentionally customised.
  const currentDefaults = defaultPrompts();
  let resolvedPrompts;
  if (settings.prompts != null) {
    resolvedPrompts = {};
    for (const [key, value] of Object.entries(settings.prompts)) {
      if (value !== currentDefaults[key]) {
        resolvedPrompts[key] = value; // keep only genuine user customisations
      }
    }
  } else {
    resolvedPrompts = existing.prompts || {}; // settings-only save — preserve existing
  }

  const safe = {
    models: settings.models || {},
    prompts: resolvedPrompts,
    [PROMPTS_MIGRATION_FLAG]: true, // mark this record as migrated
    retrieval: {
      rpcName: settings.retrieval?.rpcName || existing.retrieval?.rpcName || "hybrid_match_data_index_embeddings_gf_dor_agent",
      candidates: Number(settings.retrieval?.candidates || existing.retrieval?.candidates || 40),
      rerankTopK: Number(settings.retrieval?.rerankTopK || existing.retrieval?.rerankTopK || 10),
      vectorWeight: Number(settings.retrieval?.vectorWeight || existing.retrieval?.vectorWeight || 0.65),
      keywordWeight: Number(settings.retrieval?.keywordWeight || existing.retrieval?.keywordWeight || 0.35)
    },
    knowledge: {
      triggerKeywords: normalizeStringList(settings.knowledge?.triggerKeywords, existing.knowledge?.triggerKeywords || DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS)
    },
    n8nBaseUrl: settings.n8nBaseUrl || "",
    secrets: {
      openRouterApiKey: mergeSecret(existing.secrets?.openRouterApiKey, incomingSecrets.openRouterApiKey),
      supabaseUrl: incomingSecrets.supabaseUrl || existing.secrets?.supabaseUrl || "",
      supabaseServiceRoleKey: mergeSecret(existing.secrets?.supabaseServiceRoleKey, incomingSecrets.supabaseServiceRoleKey)
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => [tool, settings.tools?.[tool] || ""])
    ),
    timezone: settings.timezone || existing.timezone || "UTC+0"
  };
  _settingsCache = safe;
  _settingsCachedAt = Date.now();
  await sbFetch("/rest/v1/agent_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: "default", data: safe, updated_at: new Date().toISOString() })
  }, "write");
  _settingsLoadedFromDb = _settingsDbStatus.write.ok || _settingsLoadedFromDb;
  return safe;
}

function markSettingsDbStatus(operation, ok, error = "") {
  if (!["read", "write"].includes(operation)) return;
  _settingsDbStatus = {
    ..._settingsDbStatus,
    [operation]: { ok, at: new Date().toISOString(), error }
  };
}

function secretSource(settingsValue, envValue) {
  if (settingsValue) return _settingsLoadedFromDb ? "supabase_settings" : "runtime_settings";
  if (envValue) return "env";
  return "missing";
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function mergeSecret(existing = "", incoming = "") {
  if (!incoming) return existing || "";
  if (incoming.includes("...") || /^\*+$/.test(incoming)) return existing || "";
  return incoming;
}
