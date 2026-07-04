import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentList, defaultPrompts } from "./prompts.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILES = [".env", ".env.local"];
const DEFAULT_HYBRID_RPC_NAME = "hybrid_match_data_index_embeddings_gf_dor_agent";
const DEFAULT_INDEX_TABLE = "data_index_embeddings_gf_dor_agent";
const DEFAULT_ALERTS_TABLE = "alerts_embeddings_gf";
const DEFAULT_AI_SETTINGS = {
  classifier: { temperature: 0, maxTokens: 900, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null },
  knowledgePlanner: { temperature: 0.1, maxTokens: 2200, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null },
  main: { temperature: 0.2, maxTokens: 4096, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null },
  lite: { temperature: 0.3, maxTokens: 1800, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null },
  reranker: { temperature: 0, maxTokens: 4096, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null },
  alert: { temperature: 0.1, maxTokens: 2200, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null },
  qa: { temperature: 0.1, maxTokens: 6000, timeoutMs: 90_000, topP: 1, frequencyPenalty: 0, presencePenalty: 0, seed: null }
};
const DEFAULT_RAG_SETTINGS = {
  contextRecordsLimit: 12,
  chunkTextLimit: 1800,
  plannerExtraQueriesLimit: 2
};
const DEFAULT_GRAPH_SETTINGS = {
  enabled: true,
  searchLimit: 30,
  contextLimit: 12,
  expandedForListQuestions: true
};
const DEFAULT_TOOL_RUNTIME_SETTINGS = {
  enabled: true,
  parallelLimit: 6,
  alertAgentEnabled: true,
  safetyPrecheckEnabled: true
};
const DEFAULT_CACHE_SETTINGS = {
  enabled: true,
  provider: "memory",
  namespace: "bidoc:cache:",
  memoryMaxEntries: 10_000,
  timeoutMs: 5_000
};
const BUILT_IN_SETTINGS_PRESETS = [
  {
    id: "profile-a-conservative",
    name: "Profile A - Conservative",
    description: "High-quality configuration with broader retrieval and larger answer budgets.",
    settings: {
      models: {
        main: "openai/gpt-4o",
        knowledgePlanner: "openai/gpt-4o",
        qa: "openai/gpt-4o"
      },
      retrieval: {
        candidates: 30,
        rerankTopK: 8
      },
      ai: {
        knowledgePlanner: { maxTokens: 2200 },
        main: { maxTokens: 4096 },
        reranker: { maxTokens: 1200 },
        alert: { maxTokens: 1200 },
        qa: { maxTokens: 6000 }
      },
      rag: {
        contextRecordsLimit: 10,
        chunkTextLimit: 1800
      },
      graph: {
        contextLimit: 10
      },
      knowledge: {
        agentLimit: 2,
        topK: 4
      },
      subagents: {
        alert: {
          model: "openai/gpt-4o-mini"
        }
      }
    }
  },
  {
    id: "profile-b-balanced",
    name: "Profile B - Balanced",
    description: "Balanced cost and quality profile for regular day-to-day work.",
    settings: {
      models: {
        main: "openai/gpt-4o-mini",
        knowledgePlanner: "openai/gpt-4o-mini",
        qa: "openai/gpt-4o-mini"
      },
      retrieval: {
        candidates: 25,
        rerankTopK: 8
      },
      ai: {
        knowledgePlanner: { maxTokens: 1500 },
        main: { maxTokens: 3000 },
        reranker: { maxTokens: 1200 },
        alert: { maxTokens: 1000 },
        qa: { maxTokens: 6000 }
      },
      rag: {
        contextRecordsLimit: 10,
        chunkTextLimit: 1500
      },
      graph: {
        contextLimit: 8
      },
      knowledge: {
        agentLimit: 2,
        topK: 3
      },
      subagents: {
        alert: {
          model: "openai/gpt-4o-mini"
        }
      }
    }
  },
  {
    id: "profile-c-cheap-test",
    name: "Profile C - Cheap Test",
    description: "Lean and cheaper preset for quick experiments and lower-cost checks.",
    settings: {
      models: {
        main: "openai/gpt-4o-mini",
        knowledgePlanner: "openai/gpt-4o-mini",
        qa: "openai/gpt-4o-mini"
      },
      retrieval: {
        candidates: 15,
        rerankTopK: 5
      },
      ai: {
        knowledgePlanner: { maxTokens: 1000 },
        main: { maxTokens: 2000 },
        reranker: { maxTokens: 800 },
        alert: { maxTokens: 800 },
        qa: { maxTokens: 6000 }
      },
      rag: {
        contextRecordsLimit: 6,
        chunkTextLimit: 1000
      },
      graph: {
        contextLimit: 5
      },
      knowledge: {
        agentLimit: 1,
        topK: 2
      },
      subagents: {
        alert: {
          model: "openai/gpt-4o-mini"
        }
      }
    }
  }
];

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

async function sbFetch(path, options = {}, operation = "read", connection = {}) {
  const cachedSecrets = _settingsCache.secrets || {};
  const preferExplicit = connection.preferExplicit === true;
  const url = trimSlash(preferExplicit
    ? connection.supabaseUrl || process.env.SUPABASE_URL || cachedSecrets.supabaseUrl || ""
    : process.env.SUPABASE_URL || connection.supabaseUrl || cachedSecrets.supabaseUrl || "");
  const key = resolveSecret(
    preferExplicit
      ? connection.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || cachedSecrets.supabaseServiceRoleKey || ""
      : process.env.SUPABASE_SERVICE_ROLE_KEY || connection.supabaseServiceRoleKey || cachedSecrets.supabaseServiceRoleKey || ""
  );
  if (!url || !key) {
    const message = "App Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server so settings are shared across browsers and server instances.";
    markSettingsDbStatus(operation, false, message);
    if (connection.required) throw new Error(message);
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
      const message = data?.message || `Supabase settings request failed: ${response.status}`;
      markSettingsDbStatus(operation, false, message);
      if (connection.required) throw new Error(message);
      return null;
    }
    markSettingsDbStatus(operation, true, "");
    return data;
  } catch (error) {
    markSettingsDbStatus(operation, false, error.message);
    if (connection.required) throw error;
    return null;
  }
}

async function loadSettingsFromDb() {
  const rows = await readSettingsSnapshot();
  if (Array.isArray(rows)) {
    _settingsCache = rows?.[0]?.data || {};
    _settingsLoadedFromDb = Boolean(rows?.[0]?.data);
  } else {
    _settingsLoadedFromDb = false;
  }
  _settingsCachedAt = Date.now();
}

async function readSettingsSnapshot(connection = {}) {
  return sbFetch("/rest/v1/agent_settings?id=eq.default&select=data", {}, "read", connection);
}

// ---------------------------------------------------------------------------
// One-time migration: clear stale default-prompts stored in Supabase.
// Old code used to persist ALL default prompts to Supabase, which meant that
// when prompts.js was updated, the old cached prompts kept overriding the new
// defaults — causing bugs like the classifier always returning "CHAT".
// After this migration, only user-customised (non-default) prompts are stored.
// ---------------------------------------------------------------------------
const PROMPTS_MIGRATION_FLAG = "__prompts_clean_v2";

async function migratePromptsIfNeeded() {
  if (_settingsCache[PROMPTS_MIGRATION_FLAG]) return; // already migrated
  console.log("[config] Running one-time prompts migration: clearing stale stored defaults…");
  const prompts = { ...(_settingsCache.prompts || {}) };
  for (const key of stalePromptKeys(prompts)) {
    delete prompts[key];
  }
  _settingsCache = {
    ..._settingsCache,
    prompts,
    [PROMPTS_MIGRATION_FLAG]: true
  };
  _settingsCachedAt = Date.now();
  console.log("[config] Prompts migration applied in memory only. Persist through Settings Save if needed.");
}

function stalePromptKeys(prompts = {}) {
  const stale = [];
  const classifier = String(prompts.classifier || "");
  const main = String(prompts.main || "");
  const reranker = String(prompts.reranker || "");
  if (classifier && classifier.includes("You are a Senior Project Manager Assistant") && !classifier.includes("Do NOT invent broad tags")) {
    stale.push("classifier");
  }
  if (main && main.includes("You are RAG-PM")) {
    stale.push("main");
  }
  if (reranker && (reranker.includes("construction-project RAG reranker") || (reranker.includes("You are a strict RAG reranker") && !reranker.includes("reranking agent")))) {
    stale.push("reranker");
  }
  return stale;
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
  "submittals",
  "meeting_evidence_search"
];

export const DEFAULT_MEETINGS_EVIDENCE_SETTINGS = {
  enabled: true,
  model: null,
  rpcName: "hybrid_match_meetings_documents",
  table: "meetings_documents",
  matchCount: 20,
  matchThreshold: 0.3,
  vectorWeight: 0.55,
  textWeight: 0.25,
  keywordWeight: 0.15,
  metadataWeight: 0.05,
  adjacentChunks: 1,
  requireQuote: true,
  timeoutMs: 10000
};

const DEFAULT_DATA_QUERY_SETTINGS = {
  enabled: true,
  maxPlans: 5,
  maxRowsPerPlan: 200,
  timeoutMsPerPlan: 8000,
  totalTimeoutMs: 20000,
  allowedTables: [],
  allowedSchemas: ["content"],
  tables: [],
  allowRawSql: false,
  allowJoins: false,
  allowAggregations: true,
  requireHumanApprovalForRawSql: true,
  plannerEnabled: true,
  plannerModel: "",
  plannerTimeoutMs: 30000
};

export function getConfig(settingsOverride = null) {
  const settings = settingsOverride && typeof settingsOverride === "object"
    ? settingsOverride
    : readLocalSettings();
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
    openRouterApiKey: resolveOpenRouterKey(secrets.openRouterApiKey, process.env.OPENROUTER_API_KEY),
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
    insights: normalizeInsightsSettings(settings.insights),
    retrieval: {
      rpcName: contentSource.hybridRpcName,
      candidates: clampNumber(settings.retrieval?.candidates ?? process.env.HYBRID_CANDIDATES, 1, 200, 40),
      plannerCandidates: clampNumber(settings.retrieval?.plannerCandidates ?? process.env.PLANNER_RAG_CANDIDATES, 1, 100, 20),
      alertCandidates: clampNumber(settings.retrieval?.alertCandidates ?? process.env.ALERT_CANDIDATES, 1, 100, 20),
      rerankTopK: clampNumber(settings.retrieval?.rerankTopK ?? process.env.RERANK_TOP_K, 1, 100, 10),
      vectorWeight: clampNumber(settings.retrieval?.vectorWeight ?? process.env.HYBRID_VECTOR_WEIGHT, 0, 1, 0.65),
      keywordWeight: clampNumber(settings.retrieval?.keywordWeight ?? process.env.HYBRID_KEYWORD_WEIGHT, 0, 1, 0.35),
      timelineLimit: clampNumber(settings.retrieval?.timelineLimit, 1, 5000, 1000),
      timelineDaysBack: clampNumber(settings.retrieval?.timelineDaysBack, 1, 3650, 1825)
    },
    ai: normalizeAiSettings(settings.ai),
    rag: normalizeRagSettings(settings.rag),
    graph: normalizeGraphSettings(settings.graph),
    cache: normalizeCacheSettings(settings.cache, {
      redisUrl: resolveSecret(settings.cache?.redisUrl, process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL)
    }),
    knowledge: {
      triggerKeywords: normalizeStringList(settings.knowledge?.triggerKeywords, DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS),
      agentLimit: clampNumber(settings.knowledge?.agentLimit, 1, 5, 2),
      topK: clampNumber(settings.knowledge?.topK, 1, 20, 4),
      chunkSize: clampNumber(settings.knowledge?.chunkSize, 300, 6000, 1800)
    },
    timelineLinks: normalizeTimelineLinkAgentSettings(settings.timelineLinks),
    meetingsEvidence: normalizeMeetingsEvidenceSettings(settings.subagents?.meetingsEvidence),
    dataQuery: normalizeDataQuerySettings(settings.subagents?.dataQuery),
    n8n: {
      baseUrl: trimSlash(settings.n8nBaseUrl || process.env.N8N_BASE_URL || ""),
      runtime: normalizeToolRuntimeSettings(settings.toolsRuntime || settings.toolRuntime),
      tools: Object.fromEntries(
        TOOL_NAMES.map((tool) => [tool, normalizeToolUrlValue(toolSettings[tool]) || process.env[`N8N_TOOL_${tool.toUpperCase()}_URL`] || ""])
      )
    },
    timezone: settings.timezone || process.env.TIMEZONE || "Asia/Jerusalem"
  };
}

export function publicSettings(config = getConfig(), settingsOverride = null) {
  const settings = settingsOverride && typeof settingsOverride === "object"
    ? settingsOverride
    : readLocalSettings();
  return {
    models: config.models,
    prompts: config.prompts,
    retrieval: config.retrieval,
    ai: config.ai,
    rag: config.rag,
    graph: config.graph,
    insights: config.insights,
    cache: {
      ...config.cache,
      redisUrl: maskSecret(config.cache.redisUrl)
    },
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
    toolsRuntime: config.n8n.runtime,
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
    subagents: { ...(settings.subagents || {}), meetingsEvidence: config.meetingsEvidence, dataQuery: config.dataQuery },
    presets: mergeSettingsPresets(settings.presets || [])
  };
}

export function resolveToolUrl(toolName, config = getConfig()) {
  const direct = normalizeToolUrlValue(config.n8n.tools[toolName]);
  if (direct) return direct;
  if (!config.n8n.baseUrl) return "";
  return `${config.n8n.baseUrl}/webhook/${toolName}`;
}

// A tool URL must be a plain string. Historic saves round-tripped the
// publicSettings `{configured, url}` shape back into agent_settings, nesting
// `{url:{url:...}}` one level deeper per save (with a stringified
// "[object Object]" innermost) — unwrap objects and drop that garbage.
export function normalizeToolUrlValue(value, depth = 0) {
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") {
    const text = value.trim();
    return text === "[object Object]" ? "" : text;
  }
  if (isPlainObject(value)) return normalizeToolUrlValue(value.url, depth + 1);
  return "";
}

function trimSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function mergePlainObject(existing = {}, incoming = {}) {
  const base = isPlainObject(existing) ? existing : {};
  if (!isPlainObject(incoming)) return incoming ?? base;
  const output = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      output[key] = mergePlainObject(base[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringList(value, fallback = []) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]+/)
      : fallback;
  return [...new Set(raw.map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeAiSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_AI_SETTINGS).map(([key, defaults]) => {
      const item = raw[key] && typeof raw[key] === "object" ? raw[key] : {};
      return [key, {
        temperature: clampNumber(item.temperature, 0, 2, defaults.temperature),
        maxTokens: clampNumber(item.maxTokens, 16, 32_000, defaults.maxTokens),
        timeoutMs: clampNumber(item.timeoutMs, 5_000, 180_000, defaults.timeoutMs),
        topP: clampNumber(item.topP, 0, 1, defaults.topP),
        frequencyPenalty: clampNumber(item.frequencyPenalty, -2, 2, defaults.frequencyPenalty),
        presencePenalty: clampNumber(item.presencePenalty, -2, 2, defaults.presencePenalty),
        seed: optionalInteger(item.seed)
      }];
    })
  );
}

function normalizeRagSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    contextRecordsLimit: clampNumber(raw.contextRecordsLimit, 1, 50, DEFAULT_RAG_SETTINGS.contextRecordsLimit),
    chunkTextLimit: clampNumber(raw.chunkTextLimit, 300, 6000, DEFAULT_RAG_SETTINGS.chunkTextLimit),
    plannerExtraQueriesLimit: clampNumber(raw.plannerExtraQueriesLimit, 0, 6, DEFAULT_RAG_SETTINGS.plannerExtraQueriesLimit)
  };
}

// Project Insights feature flags (phase-2 spec). Pipeline + closure follow-up are
// on by default; the calibration-stage engines are opt-in until tuned on real data.
export function normalizeInsightsSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    evidencePipeline: raw.evidencePipeline !== false,
    closureFollowup: raw.closureFollowup !== false,
    primeFromAlerts: raw.primeFromAlerts !== false,
    crossWindowTrend: raw.crossWindowTrend === true,
    rootCauseHypotheses: raw.rootCauseHypotheses === true,
    healthScore: raw.healthScore === true,
    // Runs entity enrichment automatically as part of graph rebuilds; the explicit
    // POST /api/graph/enrich endpoint works regardless (manual invocation = consent).
    graphEnrichment: raw.graphEnrichment === true,
    // Entity-aware clustering + dependency_risk patterns in the insights pipeline
    // (requires enriched entities in the graph).
    graphClustering: raw.graphClustering === true
  };
}

function normalizeGraphSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    enabled: raw.enabled !== false,
    searchLimit: clampNumber(raw.searchLimit, 1, 100, DEFAULT_GRAPH_SETTINGS.searchLimit),
    contextLimit: clampNumber(raw.contextLimit, 1, 50, DEFAULT_GRAPH_SETTINGS.contextLimit),
    expandedForListQuestions: raw.expandedForListQuestions !== false
  };
}

function normalizeCacheSettings(value = {}, overrides = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const provider = String(raw.provider || process.env.CACHE_PROVIDER || DEFAULT_CACHE_SETTINGS.provider).toLowerCase();
  return {
    enabled: raw.enabled !== false && process.env.CACHE_ENABLED !== "false",
    provider: ["memory", "redis", "none"].includes(provider) ? provider : "memory",
    redisUrl: resolveSecret(overrides.redisUrl || raw.redisUrl, process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL),
    namespace: String(raw.namespace || process.env.CACHE_NAMESPACE || DEFAULT_CACHE_SETTINGS.namespace),
    memoryMaxEntries: clampNumber(raw.memoryMaxEntries || process.env.CACHE_MEMORY_MAX_ENTRIES, 100, 1_000_000, DEFAULT_CACHE_SETTINGS.memoryMaxEntries),
    timeoutMs: clampNumber(raw.timeoutMs || process.env.CACHE_TIMEOUT_MS, 500, 30_000, DEFAULT_CACHE_SETTINGS.timeoutMs)
  };
}

function normalizeToolRuntimeSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    enabled: raw.enabled !== false,
    parallelLimit: clampNumber(raw.parallelLimit, 1, 20, DEFAULT_TOOL_RUNTIME_SETTINGS.parallelLimit),
    alertAgentEnabled: raw.alertAgentEnabled !== false,
    safetyPrecheckEnabled: raw.safetyPrecheckEnabled !== false,
    // Task B1: route tools with an internal implementation (contentTools.js)
    // through code instead of n8n webhooks. Default OFF until calibrated.
    internalTools: raw.internalTools === true
  };
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
      ai: config.ai,
      rag: config.rag,
      graph: config.graph,
      cache: config.cache,
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
      toolsRuntime: config.n8n.runtime,
      subagents: settings.subagents || {},
      presets: normalizeSettingsPresets(settings.presets || [])
    }
  };
}

export function normalizeImportedSettingsFile(value = {}) {
  const raw = value && typeof value === "object" && value.settings && typeof value.settings === "object"
    ? value.settings
    : value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Settings file must contain a JSON object");
  const normalized = {};
  if (Object.prototype.hasOwnProperty.call(raw, "models")) normalized.models = raw.models || {};
  if (Object.prototype.hasOwnProperty.call(raw, "prompts")) normalized.prompts = raw.prompts || {};
  if (Object.prototype.hasOwnProperty.call(raw, "retrieval")) normalized.retrieval = raw.retrieval || {};
  if (Object.prototype.hasOwnProperty.call(raw, "ai")) normalized.ai = raw.ai || {};
  if (Object.prototype.hasOwnProperty.call(raw, "rag")) normalized.rag = raw.rag || {};
  if (Object.prototype.hasOwnProperty.call(raw, "graph")) normalized.graph = raw.graph || {};
  if (Object.prototype.hasOwnProperty.call(raw, "cache")) normalized.cache = raw.cache || {};
  if (Object.prototype.hasOwnProperty.call(raw, "knowledge")) normalized.knowledge = raw.knowledge || {};
  if (Object.prototype.hasOwnProperty.call(raw, "timelineLinks")) normalized.timelineLinks = raw.timelineLinks || {};
  if (Object.prototype.hasOwnProperty.call(raw, "contentSource")) normalized.contentSource = raw.contentSource || {};
  if (Object.prototype.hasOwnProperty.call(raw, "secrets")) normalized.secrets = raw.secrets || {};
  if (Object.prototype.hasOwnProperty.call(raw, "n8nBaseUrl")) normalized.n8nBaseUrl = raw.n8nBaseUrl || "";
  if (Object.prototype.hasOwnProperty.call(raw, "timezone")) normalized.timezone = raw.timezone || "UTC+0";
  if (Object.prototype.hasOwnProperty.call(raw, "tools")) normalized.tools = raw.tools || {};
  if (Object.prototype.hasOwnProperty.call(raw, "toolsRuntime") || Object.prototype.hasOwnProperty.call(raw, "toolRuntime")) {
    normalized.toolsRuntime = raw.toolsRuntime || raw.toolRuntime || {};
  }
  if (Object.prototype.hasOwnProperty.call(raw, "subagents")) normalized.subagents = raw.subagents || {};
  if (Object.prototype.hasOwnProperty.call(raw, "presets")) normalized.presets = normalizeSettingsPresets(raw.presets || []);
  return normalized;
}

export function previewImportedSettingsFile(value = {}) {
  const draft = normalizeImportedSettingsFile(value);
  return {
    draft,
    settings: publicSettings(getConfig(draft), draft)
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

function normalizeMeetingsEvidenceSettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const d = DEFAULT_MEETINGS_EVIDENCE_SETTINGS;
  return {
    enabled: raw.enabled !== false,
    model: raw.model || d.model,
    rpcName: String(raw.rpcName || d.rpcName).trim(),
    table: String(raw.table || d.table).trim(),
    matchCount: clampNumber(raw.matchCount, 1, 100, d.matchCount),
    matchThreshold: clampNumber(raw.matchThreshold, 0, 1, d.matchThreshold),
    vectorWeight: clampNumber(raw.vectorWeight, 0, 1, d.vectorWeight),
    textWeight: clampNumber(raw.textWeight, 0, 1, d.textWeight),
    keywordWeight: clampNumber(raw.keywordWeight, 0, 1, d.keywordWeight),
    metadataWeight: clampNumber(raw.metadataWeight, 0, 1, d.metadataWeight),
    adjacentChunks: clampNumber(raw.adjacentChunks, 0, 3, d.adjacentChunks),
    requireQuote: raw.requireQuote !== false,
    timeoutMs: clampNumber(raw.timeoutMs, 1000, 60000, d.timeoutMs)
  };
}

function normalizeDataQueryTables(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const table = String(item?.table || item?.name || "").trim();
    if (!table) continue;
    const connection = String(item?.connection || item?.schema || "content").trim() || "content";
    const key = `${connection}.${table}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      connection,
      schema: String(item?.schema || "public").trim() || "public",
      table,
      columns: Array.isArray(item?.columns) ? [...new Set(item.columns.map((col) => String(col).trim()).filter(Boolean))] : []
    });
  }
  return out;
}

export function normalizeDataQuerySettings(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  const d = DEFAULT_DATA_QUERY_SETTINGS;
  // The user's real-DB table picks are the source of truth. They MUST be
  // preserved through normalization (this is what getConfig/publicSettings
  // expose), otherwise the selection silently disappears on every reload.
  const tables = normalizeDataQueryTables(raw.tables);
  return {
    enabled: raw.enabled !== false,
    maxPlans: clampNumber(raw.maxPlans, 1, 10, d.maxPlans),
    maxRowsPerPlan: clampNumber(raw.maxRowsPerPlan, 1, 1000, d.maxRowsPerPlan),
    timeoutMsPerPlan: clampNumber(raw.timeoutMsPerPlan, 1000, 60000, d.timeoutMsPerPlan),
    totalTimeoutMs: clampNumber(raw.totalTimeoutMs, 1000, 120000, d.totalTimeoutMs),
    allowedTables: tables.length ? tables.map((item) => item.table) : normalizeStringList(raw.allowedTables, d.allowedTables),
    allowedSchemas: tables.length ? [...new Set(tables.map((item) => item.connection))] : normalizeStringList(raw.allowedSchemas, d.allowedSchemas),
    tables,
    allowRawSql: raw.allowRawSql === true,
    allowJoins: raw.allowJoins === true,
    allowAggregations: raw.allowAggregations !== false,
    requireHumanApprovalForRawSql: raw.requireHumanApprovalForRawSql !== false,
    plannerEnabled: raw.plannerEnabled !== false,
    plannerModel: String(raw.plannerModel || "").trim(),
    plannerTimeoutMs: clampNumber(raw.plannerTimeoutMs, 5000, 90000, d.plannerTimeoutMs)
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function optionalInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function readLocalSettings() {
  return _settingsCache;
}

export async function writeLocalSettings(settings, options = {}) {
  const source = String(options.source || "").trim();
  if (!source) {
    throw new Error("Settings persistence requires an explicit approved source.");
  }
  if (source !== "settings_save") {
    throw new Error(`Settings persistence source "${source}" is not allowed.`);
  }
  const existing = _settingsCache;
  const incomingSecrets = settings.secrets || {};
  const incomingContentSource = settings.contentSource || {};
  const existingContentSource = existing.contentSource || {};
  const has = (key) => Object.prototype.hasOwnProperty.call(settings || {}, key);
  const mergeSection = (key, incoming, current = {}) => has(key) ? mergePlainObject(current, incoming) : (current || {});
  const mergedModels = mergeSection("models", settings.models || {}, existing.models || {});
  const mergedPrompts = mergeSection("prompts", settings.prompts || {}, existing.prompts || {});
  const mergedRetrieval = mergeSection("retrieval", settings.retrieval || {}, existing.retrieval || {});
  const mergedAi = mergeSection("ai", settings.ai || {}, existing.ai || {});
  const mergedRag = mergeSection("rag", settings.rag || {}, existing.rag || {});
  const mergedGraph = mergeSection("graph", settings.graph || {}, existing.graph || {});
  const mergedInsights = mergeSection("insights", settings.insights || {}, existing.insights || {});
  const mergedCache = mergeSection("cache", settings.cache || {}, existing.cache || {});
  const mergedKnowledge = mergeSection("knowledge", settings.knowledge || {}, existing.knowledge || {});
  const mergedTimelineLinks = mergeSection("timelineLinks", settings.timelineLinks || {}, existing.timelineLinks || {});
  const mergedContentSource = mergeSection("contentSource", incomingContentSource, existingContentSource);
  const mergedToolsRuntime = has("toolsRuntime") || has("toolRuntime")
    ? mergePlainObject(existing.toolsRuntime || existing.toolRuntime || {}, settings.toolsRuntime || settings.toolRuntime || {})
    : (existing.toolsRuntime || existing.toolRuntime || {});
  const mergedSubagents = mergeSection("subagents", settings.subagents || {}, existing.subagents || {});
  const mergedTools = has("tools")
    ? { ...(existing.tools || {}), ...(settings.tools || {}) }
    : (existing.tools || {});

  // Only persist prompts that DIFFER from the current defaults.
  // This ensures that whenever prompts.js is updated, new defaults always take
  // effect for any prompt the user hasn't intentionally customised.
  const currentDefaults = defaultPrompts();
  let resolvedPrompts;
  if (has("prompts")) {
    resolvedPrompts = {};
    for (const [key, value] of Object.entries(mergedPrompts)) {
      if (value !== currentDefaults[key]) {
        resolvedPrompts[key] = value; // keep only genuine user customisations
      }
    }
  } else {
    resolvedPrompts = existing.prompts || {}; // settings-only save — preserve existing
  }

  const safe = {
    models: mergedModels,
    prompts: resolvedPrompts,
    [PROMPTS_MIGRATION_FLAG]: true, // mark this record as migrated
    retrieval: {
      rpcName: mergedRetrieval.rpcName || mergedContentSource.hybridRpcName || DEFAULT_HYBRID_RPC_NAME,
      candidates: clampNumber(mergedRetrieval.candidates, 1, 200, 40),
      plannerCandidates: clampNumber(mergedRetrieval.plannerCandidates, 1, 100, 20),
      alertCandidates: clampNumber(mergedRetrieval.alertCandidates, 1, 100, 20),
      rerankTopK: clampNumber(mergedRetrieval.rerankTopK, 1, 100, 10),
      vectorWeight: clampNumber(mergedRetrieval.vectorWeight, 0, 1, 0.65),
      keywordWeight: clampNumber(mergedRetrieval.keywordWeight, 0, 1, 0.35),
      timelineLimit: clampNumber(mergedRetrieval.timelineLimit, 1, 5000, 1000),
      timelineDaysBack: clampNumber(mergedRetrieval.timelineDaysBack, 1, 3650, 1825)
    },
    ai: normalizeAiSettings(mergedAi),
    rag: normalizeRagSettings(mergedRag),
    graph: normalizeGraphSettings(mergedGraph),
    insights: normalizeInsightsSettings(mergedInsights),
    cache: normalizeCacheSettings(mergedCache, {
      redisUrl: mergeSecret(existing.cache?.redisUrl, has("cache") ? settings.cache?.redisUrl : undefined)
    }),
    contentSource: {
      supabaseUrl: mergedContentSource.supabaseUrl || "",
      supabaseServiceRoleKey: mergeSecret(existingContentSource.supabaseServiceRoleKey, has("contentSource") ? incomingContentSource.supabaseServiceRoleKey : undefined),
      hybridRpcName: mergedContentSource.hybridRpcName || mergedRetrieval.rpcName || DEFAULT_HYBRID_RPC_NAME,
      indexTable: mergedContentSource.indexTable || DEFAULT_INDEX_TABLE,
      alertsTable: mergedContentSource.alertsTable || DEFAULT_ALERTS_TABLE,
      alertsRpcName: mergedContentSource.alertsRpcName || `match_${mergedContentSource.alertsTable || DEFAULT_ALERTS_TABLE}`
    },
    knowledge: {
      triggerKeywords: normalizeStringList(mergedKnowledge.triggerKeywords, existing.knowledge?.triggerKeywords || DEFAULT_KNOWLEDGE_TRIGGER_KEYWORDS),
      agentLimit: clampNumber(mergedKnowledge.agentLimit, 1, 5, 2),
      topK: clampNumber(mergedKnowledge.topK, 1, 20, 4),
      chunkSize: clampNumber(mergedKnowledge.chunkSize, 300, 6000, 1800)
    },
    timelineLinks: normalizeTimelineLinkAgentSettings(mergedTimelineLinks),
    n8nBaseUrl: has("n8nBaseUrl") ? settings.n8nBaseUrl || "" : existing.n8nBaseUrl || "",
    secrets: {
      openRouterApiKey: mergeSecret(existing.secrets?.openRouterApiKey, has("secrets") ? incomingSecrets.openRouterApiKey : undefined),
      supabaseUrl: has("secrets") && Object.prototype.hasOwnProperty.call(incomingSecrets, "supabaseUrl")
        ? incomingSecrets.supabaseUrl || ""
        : existing.secrets?.supabaseUrl || "",
      supabaseServiceRoleKey: mergeSecret(existing.secrets?.supabaseServiceRoleKey, has("secrets") ? incomingSecrets.supabaseServiceRoleKey : undefined)
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => [tool, normalizeToolUrlValue(mergedTools[tool])])
    ),
    toolsRuntime: normalizeToolRuntimeSettings(mergedToolsRuntime),
    timezone: has("timezone") ? settings.timezone || "Asia/Jerusalem" : existing.timezone || "Asia/Jerusalem",
    subagents: mergedSubagents,
    presets: has("presets") ? normalizeSettingsPresets(settings.presets || []) : normalizeSettingsPresets(existing.presets || [])
  };
  const writeConnection = {
    required: true,
    preferExplicit: true,
    ...(options.connection || {}),
    supabaseUrl: options.connection?.supabaseUrl || safe.secrets.supabaseUrl,
    supabaseServiceRoleKey: options.connection?.supabaseServiceRoleKey || safe.secrets.supabaseServiceRoleKey
  };
  await sbFetch("/rest/v1/agent_settings", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: "default", data: safe, updated_at: new Date().toISOString() })
  }, "write", writeConnection);
  _settingsCache = safe;
  _settingsCachedAt = Date.now();
  _settingsLoadedFromDb = true;
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

// OpenRouter keys look like "sk-or-...". Ignore a settings value that is clearly
// something else (e.g. a Supabase "sb_..." or JWT "eyJ..." key pasted into the wrong
// field) so a mis-entered key never silently overrides a valid env OPENROUTER_API_KEY.
export function resolveOpenRouterKey(settingsValue = "", envValue = "") {
  const fromSettings = resolveSecret(settingsValue, "");
  if (fromSettings && /^sk-/i.test(fromSettings.trim())) return fromSettings.trim();
  return String(envValue || "").trim();
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

function mergeSettingsPresets(customPresets = []) {
  const builtIns = BUILT_IN_SETTINGS_PRESETS.map((preset) => ({
    ...cloneJson(preset),
    builtin: true
  }));
  const customs = normalizeSettingsPresets(customPresets).map((preset) => ({
    ...preset,
    builtin: false
  }));
  return [...builtIns, ...customs];
}

function normalizeSettingsPresets(value = []) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name || "").trim();
    if (!name) continue;
    const baseId = String(item.id || "").trim() || slugifyPresetName(name);
    let id = baseId;
    let index = 2;
    while (seen.has(id)) {
      id = `${baseId}-${index++}`;
    }
    seen.add(id);
    output.push({
      id,
      name,
      description: String(item.description || "").trim(),
      settings: normalizePresetSettingsPatch(item.settings || {})
    });
  }
  return output;
}

function normalizePresetSettingsPatch(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    models: raw.models && typeof raw.models === "object" ? cloneJson(raw.models) : {},
    prompts: raw.prompts && typeof raw.prompts === "object" ? cloneJson(raw.prompts) : {},
    retrieval: raw.retrieval && typeof raw.retrieval === "object" ? cloneJson(raw.retrieval) : {},
    ai: raw.ai && typeof raw.ai === "object" ? cloneJson(raw.ai) : {},
    rag: raw.rag && typeof raw.rag === "object" ? cloneJson(raw.rag) : {},
    graph: raw.graph && typeof raw.graph === "object" ? cloneJson(raw.graph) : {},
    cache: raw.cache && typeof raw.cache === "object" ? cloneJson(raw.cache) : {},
    knowledge: raw.knowledge && typeof raw.knowledge === "object" ? cloneJson(raw.knowledge) : {},
    timelineLinks: raw.timelineLinks && typeof raw.timelineLinks === "object" ? cloneJson(raw.timelineLinks) : {},
    timezone: typeof raw.timezone === "string" ? raw.timezone : "",
    toolsRuntime: raw.toolsRuntime && typeof raw.toolsRuntime === "object" ? cloneJson(raw.toolsRuntime) : {},
    subagents: raw.subagents && typeof raw.subagents === "object" ? cloneJson(raw.subagents) : {}
  };
}

function slugifyPresetName(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `preset-${Date.now()}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
