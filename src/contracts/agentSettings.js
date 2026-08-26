const DEFAULTS = Object.freeze({
  enabled: true,
  extraction: Object.freeze({
    enabled: true,
    primaryModel: "",
    retryModel: "",
    temperature: 0,
    maxTokens: 4096,
    timeoutMs: 120_000,
    totalBudgetMs: 270_000,
    concurrency: 3,
    maxChunkCharacters: 10_000,
    maxChunkPages: 5,
    repairTimeoutMs: 60_000,
    systemPrompt: "",
    repairPrompt: ""
  }),
  enrichment: Object.freeze({
    enabled: true,
    model: "",
    temperature: 0,
    maxTokensPerCall: 1_600,
    maxTotalModelTokens: 48_000,
    timeoutMs: 75_000,
    totalBudgetMs: 180_000,
    concurrency: 2,
    maxRepairBatches: 5,
    maxProviderRetries: 1,
    systemPrompt: ""
  }),
  relationships: Object.freeze({
    enabled: true,
    model: "",
    verifierModel: "",
    temperature: 0,
    maxCandidates: 48,
    maxTokensPerCall: 600,
    verifierMaxTokensPerCall: 700,
    maxTotalModelTokens: 20_000,
    timeoutMs: 75_000,
    totalBudgetMs: 180_000,
    concurrency: 2,
    confidenceThreshold: 0.9,
    conflictConfidenceThreshold: 0.9,
    maxProviderRetries: 1,
    maxRepairBatches: 1,
    maxVerificationRepairBatches: 1,
    systemPrompt: "",
    verifierPrompt: ""
  }),
  decisions: Object.freeze({
    enabled: true,
    model: "",
    temperature: 0,
    maxTokensPerCall: 1_600,
    maxTotalModelTokens: 180_000,
    timeoutMs: 75_000,
    totalBudgetMs: 300_000,
    concurrency: 3,
    maxProviderRetries: 1,
    maxRepairBatches: 3,
    maxSplitFallbackCalls: 8,
    systemPrompt: ""
  }),
  autoReview: Object.freeze({
    enabled: true,
    model: "",
    temperature: 0,
    maxTokens: 3_200,
    timeoutMs: 75_000,
    totalBudgetMs: 300_000,
    batchSize: 4,
    concurrency: 2,
    maxRetries: 1,
    systemPrompt: ""
  })
});

export const DEFAULT_CONTRACTS_AGENT_SETTINGS = DEFAULTS;

export function normalizeContractsAgentSettings(value = {}) {
  const raw = objectValue(value);
  return {
    enabled: raw.enabled !== false,
    extraction: normalizeExtraction(raw.extraction),
    enrichment: normalizeEnrichment(raw.enrichment),
    relationships: normalizeRelationships(raw.relationships),
    decisions: normalizeDecisions(raw.decisions),
    autoReview: normalizeAutoReview(raw.autoReview)
  };
}

function normalizeExtraction(value) {
  const raw = objectValue(value);
  const d = DEFAULTS.extraction;
  return {
    enabled: raw.enabled !== false,
    primaryModel: text(raw.primaryModel),
    retryModel: text(raw.retryModel),
    temperature: number(raw.temperature, 0, 1, d.temperature),
    maxTokens: integer(raw.maxTokens, 512, 16_000, d.maxTokens),
    timeoutMs: integer(raw.timeoutMs, 5_000, 180_000, d.timeoutMs),
    totalBudgetMs: integer(raw.totalBudgetMs, 30_000, 600_000, d.totalBudgetMs),
    concurrency: integer(raw.concurrency, 1, 6, d.concurrency),
    maxChunkCharacters: integer(raw.maxChunkCharacters, 1_200, 10_000, d.maxChunkCharacters),
    maxChunkPages: integer(raw.maxChunkPages, 1, 10, d.maxChunkPages),
    repairTimeoutMs: integer(raw.repairTimeoutMs, 5_000, 180_000, d.repairTimeoutMs),
    systemPrompt: prompt(raw.systemPrompt),
    repairPrompt: prompt(raw.repairPrompt)
  };
}

function normalizeEnrichment(value) {
  const raw = objectValue(value);
  const d = DEFAULTS.enrichment;
  return {
    enabled: raw.enabled !== false,
    model: text(raw.model),
    temperature: number(raw.temperature, 0, 1, d.temperature),
    maxTokensPerCall: integer(raw.maxTokensPerCall, 256, 1_600, d.maxTokensPerCall),
    maxTotalModelTokens: integer(raw.maxTotalModelTokens, 1_600, 96_000, d.maxTotalModelTokens),
    timeoutMs: integer(raw.timeoutMs, 5_000, 180_000, d.timeoutMs),
    totalBudgetMs: integer(raw.totalBudgetMs, 30_000, 600_000, d.totalBudgetMs),
    concurrency: integer(raw.concurrency, 1, 4, d.concurrency),
    maxRepairBatches: integer(raw.maxRepairBatches, 0, 10, d.maxRepairBatches),
    maxProviderRetries: integer(raw.maxProviderRetries, 0, 3, d.maxProviderRetries),
    systemPrompt: prompt(raw.systemPrompt)
  };
}

function normalizeRelationships(value) {
  const raw = objectValue(value);
  const d = DEFAULTS.relationships;
  const confidenceThreshold = number(raw.confidenceThreshold, 0.5, 0.95, d.confidenceThreshold);
  return {
    enabled: raw.enabled !== false,
    model: text(raw.model),
    verifierModel: text(raw.verifierModel),
    temperature: number(raw.temperature, 0, 1, d.temperature),
    maxCandidates: integer(raw.maxCandidates, 1, 96, d.maxCandidates),
    maxTokensPerCall: integer(raw.maxTokensPerCall, 512, 600, d.maxTokensPerCall),
    verifierMaxTokensPerCall: integer(raw.verifierMaxTokensPerCall, 350, 700, d.verifierMaxTokensPerCall),
    maxTotalModelTokens: integer(raw.maxTotalModelTokens, 1_000, 60_000, d.maxTotalModelTokens),
    timeoutMs: integer(raw.timeoutMs, 5_000, 180_000, d.timeoutMs),
    totalBudgetMs: integer(raw.totalBudgetMs, 30_000, 600_000, d.totalBudgetMs),
    concurrency: integer(raw.concurrency, 1, 4, d.concurrency),
    confidenceThreshold,
    conflictConfidenceThreshold: number(raw.conflictConfidenceThreshold, confidenceThreshold, 0.98, Math.max(confidenceThreshold, d.conflictConfidenceThreshold)),
    maxProviderRetries: integer(raw.maxProviderRetries, 0, 3, d.maxProviderRetries),
    maxRepairBatches: integer(raw.maxRepairBatches, 0, 5, d.maxRepairBatches),
    maxVerificationRepairBatches: integer(raw.maxVerificationRepairBatches, 0, 5, d.maxVerificationRepairBatches),
    systemPrompt: prompt(raw.systemPrompt),
    verifierPrompt: prompt(raw.verifierPrompt)
  };
}

function normalizeDecisions(value) {
  const raw = objectValue(value);
  const d = DEFAULTS.decisions;
  return {
    enabled: raw.enabled !== false,
    model: text(raw.model),
    temperature: number(raw.temperature, 0, 1, d.temperature),
    maxTokensPerCall: integer(raw.maxTokensPerCall, 700, 2_200, d.maxTokensPerCall),
    maxTotalModelTokens: integer(raw.maxTotalModelTokens, 2_200, 200_000, d.maxTotalModelTokens),
    timeoutMs: integer(raw.timeoutMs, 5_000, 180_000, d.timeoutMs),
    totalBudgetMs: integer(raw.totalBudgetMs, 30_000, 600_000, d.totalBudgetMs),
    concurrency: integer(raw.concurrency, 1, 3, d.concurrency),
    maxProviderRetries: integer(raw.maxProviderRetries, 0, 1, d.maxProviderRetries),
    maxRepairBatches: integer(raw.maxRepairBatches, 0, 5, d.maxRepairBatches),
    maxSplitFallbackCalls: integer(raw.maxSplitFallbackCalls, 0, 20, d.maxSplitFallbackCalls),
    systemPrompt: prompt(raw.systemPrompt)
  };
}

function normalizeAutoReview(value) {
  const raw = objectValue(value);
  const d = DEFAULTS.autoReview;
  return {
    enabled: raw.enabled !== false,
    model: text(raw.model),
    temperature: number(raw.temperature, 0, 1, d.temperature),
    maxTokens: integer(raw.maxTokens, 512, 8_000, d.maxTokens),
    timeoutMs: integer(raw.timeoutMs, 5_000, 180_000, d.timeoutMs),
    totalBudgetMs: integer(raw.totalBudgetMs, 30_000, 600_000, d.totalBudgetMs),
    batchSize: integer(raw.batchSize, 1, 12, d.batchSize),
    concurrency: integer(raw.concurrency, 1, 4, d.concurrency),
    maxRetries: integer(raw.maxRetries, 0, 3, d.maxRetries),
    systemPrompt: prompt(raw.systemPrompt)
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

function prompt(value) {
  return typeof value === "string" ? value.trim().slice(0, 100_000) : "";
}

function number(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function integer(value, min, max, fallback) {
  return Math.trunc(number(value, min, max, fallback));
}
