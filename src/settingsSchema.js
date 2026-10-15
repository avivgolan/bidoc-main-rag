// Schema check for a Lab settings save (PUT /api/settings). The save is a
// partial update: any subset of the sections below. Sections are normalized and
// clamped by config.js when stored; this check rejects what normalization
// would silently turn into something else (a wrong type, an unknown Contracts
// switch, an invalid bucket or time zone) and sets aside what must never be
// stored in the Meta row (secrets, connections, the locked embedding model).

import { CONTRACTS_STORAGE_BUCKET_PATTERN, CONTRACTS_SWITCH_KEYS } from "./contracts/switches.js";

// Top-level parts of the old MAIN settings row that stay out of the Meta row.
export const NEVER_STORED_KEYS = ["secrets", "contentSource", "n8nBaseUrl"];

const OBJECT_SECTIONS = [
  "models", "prompts", "retrieval", "ai", "rag", "graph", "insights", "cache", "memory", "knowledge",
  "timelineLinks", "scheduleAssignmentAgent", "contractsAgent", "contracts", "toolsRuntime", "toolRuntime",
  "subagents", "tools"
];
const NUMERIC_RETRIEVAL_FIELDS = [
  "candidates", "plannerCandidates", "alertCandidates", "rerankTopK", "vectorWeight", "keywordWeight", "timelineLimit", "timelineDaysBack"
];

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function isValidTimezone(value) {
  const zone = String(value || "").trim();
  if (!zone) return false;
  if (/^(?:UTC|GMT)(?:[+-]\d{1,2}(?::\d{2})?)?$/i.test(zone)) return true;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * { ok, errors, patch, ignored }: `patch` is the body without what must never be
 * stored, `ignored` names what was set aside (for the response), `errors` lists
 * every violation (the caller answers 400 and writes nothing).
 */
export function validateSettingsPatch(body) {
  if (!isPlainObject(body)) return { ok: false, errors: ["settings must be a JSON object"], patch: {}, ignored: [] };
  const errors = [];
  const ignored = [];
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    if (NEVER_STORED_KEYS.includes(key)) {
      ignored.push(key);
      continue;
    }
    patch[key] = value;
  }
  for (const section of OBJECT_SECTIONS) {
    if (!(section in patch)) continue;
    const value = patch[section];
    if (value === null || value === undefined) {
      delete patch[section];
    } else if (!isPlainObject(value)) {
      errors.push(`${section} must be an object`);
    }
  }
  if ("presets" in patch && !Array.isArray(patch.presets)) errors.push("presets must be an array");
  if ("timezone" in patch && !isValidTimezone(patch.timezone)) errors.push(`timezone "${String(patch.timezone)}" is not a valid IANA time zone or UTC offset`);

  if (isPlainObject(patch.models)) {
    patch.models = { ...patch.models };
    if ("embedding" in patch.models) {
      delete patch.models.embedding;
      ignored.push("models.embedding");
    }
    for (const [name, model] of Object.entries(patch.models)) {
      if (typeof model !== "string") errors.push(`models.${name} must be a string`);
    }
  }
  if (isPlainObject(patch.prompts)) {
    for (const [name, prompt] of Object.entries(patch.prompts)) {
      if (typeof prompt !== "string") errors.push(`prompts.${name} must be a string`);
    }
  }
  if (isPlainObject(patch.retrieval)) {
    for (const field of NUMERIC_RETRIEVAL_FIELDS) {
      const value = patch.retrieval[field];
      if (value !== undefined && value !== null && value !== "" && !Number.isFinite(Number(value))) errors.push(`retrieval.${field} must be a number`);
    }
  }
  if (isPlainObject(patch.cache) && "redisUrl" in patch.cache) {
    patch.cache = { ...patch.cache };
    delete patch.cache.redisUrl;
    ignored.push("cache.redisUrl");
  }
  if (isPlainObject(patch.contracts)) {
    const { approvals, storageBucket, ...rest } = patch.contracts;
    for (const extra of Object.keys(rest)) errors.push(`contracts.${extra} is not a Contracts setting`);
    if (approvals !== undefined) {
      if (!isPlainObject(approvals)) {
        errors.push("contracts.approvals must be an object");
      } else {
        for (const [name, value] of Object.entries(approvals)) {
          if (!CONTRACTS_SWITCH_KEYS.includes(name)) errors.push(`contracts.approvals.${name} is not a Contracts approval switch`);
          else if (value !== null && typeof value !== "boolean") errors.push(`contracts.approvals.${name} must be true, false or null (follow env)`);
        }
      }
    }
    if (storageBucket !== undefined && storageBucket !== null && storageBucket !== "" && !CONTRACTS_STORAGE_BUCKET_PATTERN.test(String(storageBucket).trim())) {
      errors.push("contracts.storageBucket must be a valid Storage bucket name (lowercase letters, digits, . _ -)");
    }
  }
  return { ok: errors.length === 0, errors, patch, ignored: [...new Set(ignored)] };
}
