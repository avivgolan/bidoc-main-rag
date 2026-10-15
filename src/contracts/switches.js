// The Contracts approval switches and the Contracts storage bucket.
//
// They live in the agent settings (Meta DB row "main-agent", section
// `contracts`) so a Superadmin can flip one from the Lab without a redeploy.
// The env vars they used to be read from stay as the fallback: a switch the
// settings do not name (absent, null or not a boolean) still follows its env
// var, so nothing changes until a value is saved. A switch the settings DO name
// wins over env, true or false.
//
// Settings are process-wide (one row), loaded by config.js, which hands the
// normalized `contracts` section to setContractsRuntimeSettings() on every
// load and save. A caller that passes its own env object (scripts, tests)
// gets that env only: settings apply to process.env.

// settings key -> env var (the 13 CONTRACTS_*_APPROVED switches main-agent reads)
export const CONTRACTS_SWITCH_ENV = Object.freeze({
  relationshipsR4: "CONTRACTS_RELATIONSHIPS_R4_APPROVED",
  semanticRelationshipsR41: "CONTRACTS_RELATIONSHIPS_R4_1_APPROVED",
  relationshipReviewR42a: "CONTRACTS_RELATIONSHIPS_R4_2A_APPROVED",
  decisionReviewR42b: "CONTRACTS_DECISIONS_R4_2B_APPROVED",
  decisionLineageR42c: "CONTRACTS_DECISION_LINEAGE_R4_2C_APPROVED",
  clausePersistence: "CONTRACTS_CLAUSE_PERSISTENCE_APPROVED",
  workspacePersistence: "CONTRACTS_PHASE3F1_WORKSPACE_PERSISTENCE_APPROVED",
  activityMappingReview: "CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED",
  uploadReconciliation: "CONTRACTS_PHASE3G_UPLOAD_RECONCILIATION_APPROVED",
  phase2Apply: "CONTRACTS_PHASE2_APPLY_APPROVED",
  scheduleProjectionR5: "CONTRACTS_SCHEDULE_PROJECTION_R5_APPROVED",
  indicatorHandoffR5: "CONTRACTS_INDICATOR_HANDOFF_R5_APPROVED",
  r6Phase3: "CONTRACTS_R6_PHASE3_APPROVED"
});

export const CONTRACTS_SWITCH_KEYS = Object.freeze(Object.keys(CONTRACTS_SWITCH_ENV));
export const CONTRACTS_STORAGE_BUCKET_ENV = "CONTRACTS_STORAGE_BUCKET";
export const DEFAULT_CONTRACTS_STORAGE_BUCKET = "contracts-private";
export const CONTRACTS_STORAGE_BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]{0,99}$/u;

let runtime = { approvals: {}, storageBucket: "" };

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The `contracts` section of the settings: only the known switches that are
// booleans, and a bucket name only when it is a valid one.
export function normalizeContractsSettings(value = {}) {
  const raw = isPlainObject(value) ? value : {};
  const approvals = {};
  const rawApprovals = isPlainObject(raw.approvals) ? raw.approvals : {};
  for (const key of CONTRACTS_SWITCH_KEYS) {
    if (typeof rawApprovals[key] === "boolean") approvals[key] = rawApprovals[key];
  }
  const bucket = typeof raw.storageBucket === "string" ? raw.storageBucket.trim() : "";
  return { approvals, storageBucket: CONTRACTS_STORAGE_BUCKET_PATTERN.test(bucket) ? bucket : "" };
}

export function setContractsRuntimeSettings(value) {
  runtime = normalizeContractsSettings(value);
}

export function contractsRuntimeSettings() {
  return runtime;
}

const envTrue = (value) => String(value || "").trim().toLowerCase() === "true";

// Settings first (when the caller uses process.env), then the env var.
export function contractsSwitchEnabled(key, env = process.env) {
  const envName = CONTRACTS_SWITCH_ENV[key];
  if (!envName) throw new Error(`Unknown Contracts approval switch "${key}"`);
  if (env === process.env && typeof runtime.approvals[key] === "boolean") return runtime.approvals[key];
  return envTrue(env?.[envName]);
}

// Where a switch's effective value comes from: "settings", "env" or "default".
export function contractsSwitchSource(key, env = process.env) {
  if (env === process.env && typeof runtime.approvals[key] === "boolean") return "settings";
  return String(env?.[CONTRACTS_SWITCH_ENV[key]] ?? "").trim() ? "env" : "default";
}

// The Storage bucket name (not validated here: the caller refuses an invalid
// env value, as it always has).
export function contractsStorageBucketName(env = process.env) {
  if (env === process.env && runtime.storageBucket) return runtime.storageBucket;
  return String(env?.[CONTRACTS_STORAGE_BUCKET_ENV] || DEFAULT_CONTRACTS_STORAGE_BUCKET).trim();
}
