import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  getConfig,
  loadEnv,
  readLocalSettings,
  reloadSettingsFromDb,
  supabaseHeaders
} from "../src/config.js";
import {
  DEFAULT_SCHEDULE_ASSIGNMENT_AGENT_SETTINGS,
  normalizeScheduleAssignmentAgentSettings,
  scheduleAssignmentConfigurationSnapshot,
  validateScheduleAssignmentAgentSettings
} from "../src/scheduleActivityAssignmentEngine.js";
import {
  SCHEDULE_ASSIGNMENT_OPENAI_MODEL_PROFILE,
  SCHEDULE_ASSIGNMENT_PROMPT_PACK_VERSION,
  scheduleAssignmentRoleContract
} from "../src/scheduleActivityAssignmentPromptPack.js";

const commit = process.argv.includes("--commit");
const outputRoot = path.resolve("data", "schedule-assignment-evaluations");
const publishedAt = new Date().toISOString();

function withoutScheduleAssignmentAgent(settings = {}) {
  const { scheduleAssignmentAgent: _ignored, ...rest } = settings;
  return rest;
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function roleSummary(settings) {
  const snapshot = scheduleAssignmentConfigurationSnapshot(settings);
  return Object.fromEntries(Object.entries(settings.roles).map(([role, value]) => [role, {
    model: value.model,
    promptHash: snapshot.roles[role]?.promptHash || null,
    schemaName: role === "embedding" ? null : value.schemaName,
    schemaVersion: role === "embedding" ? null : value.schemaVersion,
    schemaHash: snapshot.roles[role]?.schemaHash || null
  }]));
}

function assertApprovedV2(settings) {
  assert.equal(settings.version, SCHEDULE_ASSIGNMENT_PROMPT_PACK_VERSION);
  assert.equal(settings.autoAssignmentThreshold, 90);
  assert.equal(settings.minimumRunnerUpMargin, 12);
  assert.equal(settings.suggestionThreshold, 45);
  assert.equal(settings.timeFilterConfidenceThreshold, 80);
  assert.equal(settings.judgeNearThresholdRange, 8);
  assert.equal(settings.maxCandidates, 20);
  assert.equal(settings.maxModelCalls, 4);

  for (const [role, profile] of Object.entries(SCHEDULE_ASSIGNMENT_OPENAI_MODEL_PROFILE)) {
    assert.equal(settings.roles[role]?.model, profile.model, `Unexpected model for ${role}`);
    if (role === "embedding") continue;
    const contract = scheduleAssignmentRoleContract(role);
    assert.equal(settings.roles[role]?.schemaName, contract.name, `Unexpected schema for ${role}`);
    assert.deepEqual(settings.roles[role]?.responseSchema, contract.schema, `Unexpected response schema for ${role}`);
  }
}

async function persistScheduleAssignmentSection({ url, serviceRoleKey, currentSettings, scheduleAssignmentAgent }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${String(url).replace(/\/+$/u, "")}/rest/v1/agent_settings`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        ...supabaseHeaders(serviceRoleKey),
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        id: "default",
        data: { ...currentSettings, scheduleAssignmentAgent },
        updated_at: publishedAt
      })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Schedule Assignment settings publication failed (${response.status}): ${body.slice(0, 500)}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

loadEnv();
await reloadSettingsFromDb();

const beforeRaw = structuredClone(readLocalSettings() || {});
const desired = normalizeScheduleAssignmentAgentSettings({
  ...DEFAULT_SCHEDULE_ASSIGNMENT_AGENT_SETTINGS,
  version: SCHEDULE_ASSIGNMENT_PROMPT_PACK_VERSION,
  publishedAt
});
const validation = validateScheduleAssignmentAgentSettings(desired);

assert.equal(validation.ok, true, validation.errors.join(" "));
assertApprovedV2(desired);

const beforeOtherSettings = withoutScheduleAssignmentAgent(beforeRaw);
const desiredSnapshot = scheduleAssignmentConfigurationSnapshot(desired);
let afterRaw = beforeRaw;
let afterResolved = desired;

if (commit) {
  const config = getConfig();
  assert.ok(config.supabaseUrl, "SUPABASE_URL is required to publish settings");
  assert.ok(config.supabaseServiceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required to publish settings");

  fs.mkdirSync(outputRoot, { recursive: true });
  const backupStamp = publishedAt.replace(/[:.]/gu, "-");
  const backupPath = path.join(outputRoot, `schedule-assignment-pre-v2-backup-${backupStamp}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({
    schemaVersion: "schedule-assignment-config-backup.v1",
    backedUpAt: publishedAt,
    scheduleAssignmentAgent: beforeRaw.scheduleAssignmentAgent || null
  }, null, 2)}\n`, "utf8");

  await persistScheduleAssignmentSection({
    url: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
    currentSettings: beforeRaw,
    scheduleAssignmentAgent: desired
  });

  await reloadSettingsFromDb();
  afterRaw = structuredClone(readLocalSettings() || {});
  afterResolved = getConfig().scheduleAssignmentAgent;
  const afterValidation = validateScheduleAssignmentAgentSettings(afterResolved);

  assert.equal(afterValidation.ok, true, afterValidation.errors.join(" "));
  assert.deepEqual(withoutScheduleAssignmentAgent(afterRaw), beforeOtherSettings, "An unrelated settings section changed");
  assert.deepEqual(afterRaw.scheduleAssignmentAgent, desired, "Persisted Schedule Assignment settings differ from the approved payload");
  assert.equal(scheduleAssignmentConfigurationSnapshot(afterResolved).snapshotId, desiredSnapshot.snapshotId);
  assertApprovedV2(afterResolved);
}

const report = {
  schemaVersion: "schedule-assignment-config-publication.v1",
  mode: commit ? "commit" : "dry-run",
  generatedAt: new Date().toISOString(),
  publishedAt: commit ? publishedAt : null,
  previousPersistedSectionPresent: Boolean(beforeRaw.scheduleAssignmentAgent),
  unrelatedSettingsHashBefore: hash(beforeOtherSettings),
  unrelatedSettingsHashAfter: hash(withoutScheduleAssignmentAgent(afterRaw)),
  unrelatedSettingsUnchanged: hash(beforeOtherSettings) === hash(withoutScheduleAssignmentAgent(afterRaw)),
  validation: {
    ok: validation.ok,
    errors: validation.errors,
    warnings: validation.warnings,
    weightTotal: validation.weightTotal
  },
  configuration: {
    version: afterResolved.version,
    snapshotId: scheduleAssignmentConfigurationSnapshot(afterResolved).snapshotId,
    roles: roleSummary(afterResolved),
    thresholds: {
      autoAssignmentThreshold: afterResolved.autoAssignmentThreshold,
      minimumRunnerUpMargin: afterResolved.minimumRunnerUpMargin,
      suggestionThreshold: afterResolved.suggestionThreshold,
      timeFilterConfidenceThreshold: afterResolved.timeFilterConfidenceThreshold,
      judgeNearThresholdRange: afterResolved.judgeNearThresholdRange,
      maxCandidates: afterResolved.maxCandidates,
      maxModelCalls: afterResolved.maxModelCalls
    }
  }
};

fs.mkdirSync(outputRoot, { recursive: true });
const stamp = publishedAt.replace(/[:.]/gu, "-");
const reportPath = path.join(outputRoot, `schedule-assignment-v2-publication-${commit ? "commit" : "dry-run"}-${stamp}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: true,
  mode: report.mode,
  version: report.configuration.version,
  snapshotId: report.configuration.snapshotId,
  models: Object.fromEntries(Object.entries(report.configuration.roles).map(([role, value]) => [role, value.model])),
  thresholds: report.configuration.thresholds,
  validation: report.validation,
  unrelatedSettingsUnchanged: report.unrelatedSettingsUnchanged,
  reportPath
}, null, 2));
