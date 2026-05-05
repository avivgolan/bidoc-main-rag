import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_FILES = [".env", ".env.local"];

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
      main: settings.models?.main || process.env.MAIN_MODEL || "openai/gpt-4o",
      lite: settings.models?.lite || process.env.LITE_MODEL || "openai/gpt-4o-mini",
      embedding: settings.models?.embedding || process.env.EMBEDDING_MODEL || "openai/text-embedding-3-large",
      reranker: settings.models?.reranker || process.env.RERANKER_MODEL || "openai/gpt-4o-mini"
    },
    retrieval: {
      rpcName: settings.retrieval?.rpcName || process.env.HYBRID_RPC_NAME || "hybrid_match_data_index_embeddings_gf_dor_agent",
      candidates: Number(settings.retrieval?.candidates || process.env.HYBRID_CANDIDATES || 40),
      rerankTopK: Number(settings.retrieval?.rerankTopK || process.env.RERANK_TOP_K || 10),
      vectorWeight: Number(settings.retrieval?.vectorWeight || process.env.HYBRID_VECTOR_WEIGHT || 0.65),
      keywordWeight: Number(settings.retrieval?.keywordWeight || process.env.HYBRID_KEYWORD_WEIGHT || 0.35)
    },
    n8n: {
      baseUrl: trimSlash(settings.n8nBaseUrl || process.env.N8N_BASE_URL || ""),
      tools: Object.fromEntries(
        TOOL_NAMES.map((tool) => [tool, toolSettings[tool] || process.env[`N8N_TOOL_${tool.toUpperCase()}_URL`] || ""])
      )
    }
  };
}

export function publicSettings(config = getConfig()) {
  return {
    models: config.models,
    retrieval: config.retrieval,
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey),
    openRouterConfigured: Boolean(config.openRouterApiKey),
    n8nBaseUrl: config.n8n.baseUrl,
    secrets: {
      openRouterApiKey: maskSecret(config.openRouterApiKey),
      supabaseUrl: config.supabaseUrl,
      supabaseServiceRoleKey: maskSecret(config.supabaseServiceRoleKey)
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => {
        const url = resolveToolUrl(tool, config);
        return [tool, { configured: Boolean(url), url }];
      })
    )
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

const SETTINGS_PATH = path.join(ROOT, "data", "settings.json");

export function readLocalSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function writeLocalSettings(settings) {
  const existing = readLocalSettings();
  const incomingSecrets = settings.secrets || {};
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  const safe = {
    models: settings.models || {},
    retrieval: {
      rpcName: settings.retrieval?.rpcName || existing.retrieval?.rpcName || "hybrid_match_data_index_embeddings_gf_dor_agent",
      candidates: Number(settings.retrieval?.candidates || existing.retrieval?.candidates || 40),
      rerankTopK: Number(settings.retrieval?.rerankTopK || existing.retrieval?.rerankTopK || 10),
      vectorWeight: Number(settings.retrieval?.vectorWeight || existing.retrieval?.vectorWeight || 0.65),
      keywordWeight: Number(settings.retrieval?.keywordWeight || existing.retrieval?.keywordWeight || 0.35)
    },
    n8nBaseUrl: settings.n8nBaseUrl || "",
    secrets: {
      openRouterApiKey: mergeSecret(existing.secrets?.openRouterApiKey, incomingSecrets.openRouterApiKey),
      supabaseUrl: incomingSecrets.supabaseUrl || existing.secrets?.supabaseUrl || "",
      supabaseServiceRoleKey: mergeSecret(existing.secrets?.supabaseServiceRoleKey, incomingSecrets.supabaseServiceRoleKey)
    },
    tools: Object.fromEntries(
      TOOL_NAMES.map((tool) => [tool, settings.tools?.[tool] || ""])
    )
  };
  fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(safe, null, 2)}\n`);
  return safe;
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
