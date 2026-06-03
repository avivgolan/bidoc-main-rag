import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentList, defaultPrompts } from "./prompts.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILES = [".env", ".env.local"];
const DEFAULT_HYBRID_RPC_NAME = "hybrid_match_data_index_embeddings_gf_dor_agent";
const DEFAULT_INDEX_TABLE = "data_index_embeddings_gf_dor_agent";
const DEFAULT_ALERTS_TABLE = "alerts_embeddings_gf";

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

export const DEFAULT_TIMELINE_LINK_AGENT_PROMPT = [
  "You verify timeline event links for a construction project.",
  "Use semantic search, timeline distance, saved links, and Knowledge Graph shared entities as evidence.",
  "Accept only links where the target event plausibly confirms, approves, pays, changes, or continues the source event.",
  "Prefer concrete shared entities such as people, suppliers, locations, quote numbers, document names, work packages, and specific tags.",
  "Do not accept a link only because both events share generic words like project, document, construction, or status.",
  "Return ONLY valid JSON: {\"links\":[{\"index\":number,\"accepted\":boolean,\"confidence\":number,\"relation_type\":\"quote_approved|invoice_sent|payment_received|change_order|related\",\"reason\":string,\"approver\":string}]}."
].join(" ");

const DEFAULT_TIMELINE_LINK_AGENT = {
  model: "",
  prompt: DEFAULT_TIMELINE_LINK_AGENT_PROMPT,
  suggestionLimit: 12,
  semanticTopK: 8,
  timeWindowDays: 120,
  minConfidence: 0.42,
  useSemanticSearch: true,
  useGraphFallback: true,
  ignoredTerms: [
    "פרויקט",
    "project",
    "כללי",
    "general",
    "בנייה",
    "construction",
    "תכניות",
    "תכנית",
    "מסמך",
    "מסמכים",
    "document",
    "documents",
    "לידיעה",
    "סטטוס"
  ]
};

async function sbFetch(path, options = {}, operation = "read") {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    markSettingsDbStatus(operation, false, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in env");
    return null;
  }
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${url}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...supabaseHeaders(key),
        ...(options.headers || {})
      }
    }).finally(() => clearTimeout(id));
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
  const appSupabaseUrl = trimSlash(secrets.supabaseUrl || process.env.SUPABASE_URL || "");
  const appSupabaseServiceRoleKey = resolveSecret(secrets.supabaseServiceRoleKey, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const contentSource = normalizeContentSourceSettings(settings.contentSource, {
    fallbackSupabaseUrl: appSupabaseUrl,
    fallbackSupabaseServiceRoleKey: appSupabaseServiceRoleKey,
    fallbackHybridRpcName: settings.retrieval?.rpcName || process.env.HYBRID_RPC_NAME || DEFAULT_HYBRID_RPC_NAME
  });
  return {
    port: Number(process.env.PORT || 4000),
    openRouterApiKey: resolveSecret(secrets.openRouterApiKey, process.env.OPENROUTER_API_KEY),
    openAiApiKey: "",
    supabaseUrl: appSupabaseUrl,
    supabaseServiceRoleKey: appSupabaseServiceRoleKey,
    contentSource,
    postgresUrl: process.env.POSTGRES_URL || "",
    models: {
      classifier: settings.models?.classifier || process.env.CLASSIFIER_MODEL || "openai/gpt-4o-mini",
      knowledgePlanner: settings.models?.knowledgePlanner || process.env.KNOWLEDGE_PLANNER_MODEL || settings.models?.main || process.env.MAIN_MODEL || "openai/gpt-4o",
      main: settings.models?.main || process.env.MAIN_MODEL || "openai/gpt-4o",
      lite: settings.models?.lite || process.env.LITE_MODEL || "openai/gpt-4o-mini",
      embedding: settings.models?.embedding || process.env.EMBEDDING_MODEL || "openai/text-embedding-3-large",
      reranker: settings.models?.reranker || process.env.RERANKER_MODEL || "openai/gpt-4o-mini",
      qa: settings.models?.qa || process.env.QA_MODEL || settings.models?.main || process.env.MAIN_MODEL || "openai/gpt-4o"
    },
    prompts: {
      ...defaultPrompts(),
      ...(settings.prompts || {})
    },
    retrieval: {
      rpcName: contentSource.hybridRpcName,
      candidates: Number(settings.retrieval?.candidates || process.env.HYBRID_CANDIDATES || 40),
      rerankTopK: Number(settings.retrieval?.rerankTopK || process.env.RERANK_TOP_K || 10),
      vectorWeight: Number(settings.retrieval?.vectorWeight || process.env.HYBRID_VECTOR_WEIGHT || 0.65),
      keywordWeight: Number(settings.retrieval?.keywordWeight || process.env.HYBRID_KEYWORD_WEIGHT || 0.35)
    },
    knowledge: {
      triggerKeywords: normalizeStringList(settings.knowledge?.triggerKeywords, DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS)
    },
    timelineLinks: normalizeTimelineLinkAgentSettings(settings.timelineLinks),
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
    timelineLinks: config.timelineLinks,
    contentSource: {
      ...config.contentSource,
      supabaseServiceRoleKey: maskSecret(config.contentSource.supabaseServiceRoleKey),
      keyRole: supabaseKeyRole(config.contentSource.supabaseServiceRoleKey)
    },
    timezone: config.timezone,
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
    contentSupabaseConfigured: Boolean(config.contentSource.supabaseUrl && config.contentSource.supabaseServiceRoleKey),
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
        supabaseServiceRoleKey: secretSource(settings.secrets?.supabaseServiceRoleKey, process.env.SUPABASE_SERVICE_ROLE_KEY),
        contentSupabaseUrl: contentSecretSource(settings.contentSource?.supabaseUrl, process.env.CONTENT_SUPABASE_URL, config.contentSource.usesAppSupabase),
        contentSupabaseServiceRoleKey: contentSecretSource(settings.contentSource?.supabaseServiceRoleKey, process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY, config.contentSource.usesAppSupabase)
      }
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => {
        const url = resolveToolUrl(tool, config);
        return [tool, { configured: Boolean(url), url }];
      })
    ),
    agents: buildAgentList(config),
    subagents: settings.subagents || {}
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

function normalizeTimelineLinkAgentSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    model: String(raw.model || DEFAULT_TIMELINE_LINK_AGENT.model || "").trim(),
    prompt: String(raw.prompt || DEFAULT_TIMELINE_LINK_AGENT.prompt).trim(),
    suggestionLimit: clampNumber(raw.suggestionLimit, 1, 50, DEFAULT_TIMELINE_LINK_AGENT.suggestionLimit),
    semanticTopK: clampNumber(raw.semanticTopK, 1, 30, DEFAULT_TIMELINE_LINK_AGENT.semanticTopK),
    timeWindowDays: clampNumber(raw.timeWindowDays, 1, 730, DEFAULT_TIMELINE_LINK_AGENT.timeWindowDays),
    minConfidence: clampNumber(raw.minConfidence, 0, 1, DEFAULT_TIMELINE_LINK_AGENT.minConfidence),
    useSemanticSearch: raw.useSemanticSearch !== false,
    useGraphFallback: raw.useGraphFallback !== false,
    ignoredTerms: normalizeStringList(raw.ignoredTerms, DEFAULT_TIMELINE_LINK_AGENT.ignoredTerms)
  };
}

export function exportFullSettings(config = getConfig()) {
  const settings = readLocalSettings();
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "bidoc-agent",
    settings: {
      models: config.models,
      prompts: settings.prompts || {},
      retrieval: config.retrieval,
      knowledge: config.knowledge,
      timelineLinks: config.timelineLinks,
      contentSource: {
        supabaseUrl: config.contentSource.supabaseUrl,
        supabaseServiceRoleKey: config.contentSource.supabaseServiceRoleKey,
        hybridRpcName: config.contentSource.hybridRpcName,
        indexTable: config.contentSource.indexTable,
        alertsTable: config.contentSource.alertsTable,
        alertsRpcName: config.contentSource.alertsRpcName
      },
      secrets: {
        openRouterApiKey: config.openRouterApiKey,
        supabaseUrl: config.supabaseUrl,
        supabaseServiceRoleKey: config.supabaseServiceRoleKey
      },
      n8nBaseUrl: config.n8n.baseUrl,
      timezone: config.timezone,
      tools: Object.fromEntries(TOOL_NAMES.map((tool) => [tool, resolveToolUrl(tool, config)])),
      subagents: settings.subagents || {}
    }
  };
}

export function normalizeImportedSettingsFile(value = {}) {
  const raw = value && typeof value === "object" && value.settings && typeof value.settings === "object"
    ? value.settings
    : value;
  if (!raw || typeof raw !== "object") throw new Error("Settings file must contain a JSON object");
  return {
    models: raw.models || {},
    prompts: raw.prompts || {},
    retrieval: raw.retrieval || {},
    knowledge: raw.knowledge || {},
    timelineLinks: raw.timelineLinks || {},
    contentSource: raw.contentSource || {},
    secrets: raw.secrets || {},
    n8nBaseUrl: raw.n8nBaseUrl || "",
    timezone: raw.timezone || "UTC+0",
    tools: raw.tools || {},
    subagents: raw.subagents || {}
  };
}

export function normalizeContentSourceSettings(value = {}, fallback = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const fallbackUrl = fallback.fallbackSupabaseUrl || "";
  const fallbackKey = fallback.fallbackSupabaseServiceRoleKey || "";
  const configuredUrl = raw.supabaseUrl || process.env.CONTENT_SUPABASE_URL || "";
  const configuredKey = resolveSecret(raw.supabaseServiceRoleKey, process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY);
  const supabaseUrl = trimSlash(configuredUrl || fallbackUrl);
  const supabaseServiceRoleKey = configuredKey || fallbackKey;
  const indexTable = String(raw.indexTable || process.env.CONTENT_INDEX_TABLE || DEFAULT_INDEX_TABLE).trim();
  const alertsTable = String(raw.alertsTable || process.env.CONTENT_ALERTS_TABLE || DEFAULT_ALERTS_TABLE).trim();
  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    hybridRpcName: String(raw.hybridRpcName || process.env.CONTENT_HYBRID_RPC_NAME || fallback.fallbackHybridRpcName || DEFAULT_HYBRID_RPC_NAME).trim(),
    indexTable,
    alertsTable,
    alertsRpcName: String(raw.alertsRpcName || process.env.CONTENT_ALERTS_RPC_NAME || `match_${alertsTable}`).trim(),
    usesAppSupabase: !configuredUrl && !configuredKey
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function readLocalSettings() {
  return _settingsCache;
}

export async function writeLocalSettings(settings) {
  const existing = _settingsCache;
  const incomingSecrets = settings.secrets || {};
  const incomingContentSource = settings.contentSource || {};
  const existingContentSource = existing.contentSource || {};

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
      rpcName: settings.retrieval?.rpcName || settings.contentSource?.hybridRpcName || existing.retrieval?.rpcName || existing.contentSource?.hybridRpcName || DEFAULT_HYBRID_RPC_NAME,
      candidates: Number(settings.retrieval?.candidates || existing.retrieval?.candidates || 40),
      rerankTopK: Number(settings.retrieval?.rerankTopK || existing.retrieval?.rerankTopK || 10),
      vectorWeight: Number(settings.retrieval?.vectorWeight || existing.retrieval?.vectorWeight || 0.65),
      keywordWeight: Number(settings.retrieval?.keywordWeight || existing.retrieval?.keywordWeight || 0.35)
    },
    contentSource: {
      supabaseUrl: incomingContentSource.supabaseUrl || existingContentSource.supabaseUrl || "",
      supabaseServiceRoleKey: mergeSecret(existingContentSource.supabaseServiceRoleKey, incomingContentSource.supabaseServiceRoleKey),
      hybridRpcName: incomingContentSource.hybridRpcName || existingContentSource.hybridRpcName || settings.retrieval?.rpcName || existing.retrieval?.rpcName || DEFAULT_HYBRID_RPC_NAME,
      indexTable: incomingContentSource.indexTable || existingContentSource.indexTable || DEFAULT_INDEX_TABLE,
      alertsTable: incomingContentSource.alertsTable || existingContentSource.alertsTable || DEFAULT_ALERTS_TABLE,
      alertsRpcName: incomingContentSource.alertsRpcName || existingContentSource.alertsRpcName || `match_${incomingContentSource.alertsTable || existingContentSource.alertsTable || DEFAULT_ALERTS_TABLE}`
    },
    knowledge: {
      triggerKeywords: normalizeStringList(settings.knowledge?.triggerKeywords, existing.knowledge?.triggerKeywords || DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS)
    },
    timelineLinks: normalizeTimelineLinkAgentSettings(settings.timelineLinks || existing.timelineLinks),
    n8nBaseUrl: settings.n8nBaseUrl || "",
    secrets: {
      openRouterApiKey: mergeSecret(existing.secrets?.openRouterApiKey, incomingSecrets.openRouterApiKey),
      supabaseUrl: incomingSecrets.supabaseUrl || existing.secrets?.supabaseUrl || "",
      supabaseServiceRoleKey: mergeSecret(existing.secrets?.supabaseServiceRoleKey, incomingSecrets.supabaseServiceRoleKey)
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => [tool, settings.tools?.[tool] || ""])
    ),
    timezone: settings.timezone || existing.timezone || "UTC+0",
    subagents: settings.subagents || existing.subagents || {}
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

function contentSecretSource(settingsValue, envValue, usesAppSupabase) {
  if (settingsValue) return _settingsLoadedFromDb ? "supabase_settings" : "runtime_settings";
  if (envValue) return "env";
  if (usesAppSupabase) return "app_supabase_fallback";
  return "missing";
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function isMaskedSecret(value = "") {
  return Boolean(value && (String(value).includes("...") || /^\*+$/.test(String(value))));
}

export function resolveSecret(settingsValue = "", envValue = "") {
  if (settingsValue && !isMaskedSecret(settingsValue)) return settingsValue;
  return envValue || "";
}

export function mergeSecret(existing = "", incoming = "") {
  const current = isMaskedSecret(existing) ? "" : existing || "";
  if (!incoming) return current;
  if (isMaskedSecret(incoming)) return current;
  return incoming;
}

export function supabaseHeaders(key, extra = {}) {
  const headers = {
    apikey: key,
    "Content-Type": "application/json",
    ...extra
  };
  if (isLegacyJwtKey(key)) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export function supabaseKeyRole(key = "") {
  const value = String(key || "");
  if (!value) return "missing";
  if (value.startsWith("sb_secret_")) return "service_role";
  if (!value.startsWith("eyJ")) return "unknown";
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1] || "", "base64url").toString("utf8"));
    return String(payload.role || "unknown");
  } catch {
    return "unknown";
  }
}

function isLegacyJwtKey(key = "") {
  return String(key || "").startsWith("eyJ");
}
