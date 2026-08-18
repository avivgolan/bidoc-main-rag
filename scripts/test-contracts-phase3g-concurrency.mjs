import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = randomUUID();
const CANONICAL_KEY = `schedule-activity:${RUN_ID}`;
const PREVIOUS_VERSION_ID = `phase3g-concurrency-v1-${RUN_ID}`;
const CURRENT_VERSION_ID = `phase3g-concurrency-v2-${RUN_ID}`;
const PREVIOUS_ALIAS = `gantt:${PREVIOUS_VERSION_ID}:17`;
const CURRENT_ALIAS = `gantt:${CURRENT_VERSION_ID}:17`;
const CANDIDATE_KEY = `candidate:phase3g-concurrency:${RUN_ID}`;
const PRIOR_EVENT_KEY = `phase3g-concurrency-prior:${RUN_ID}`;
const MANUAL_EVENT_KEY = `phase3g-concurrency-manual:${RUN_ID}`;
const AUTO_EVENT_KEY = `phase3g-concurrency-auto:${RUN_ID}`;
const REVIEWER_ID = "44444444-4444-4444-8444-444444444444";
const TEMP_DIR = path.join(ROOT, "tmp");
const MANUAL_SQL = path.join(TEMP_DIR, "contracts-phase3g-concurrency-manual.sql");
const AUTO_SQL = path.join(TEMP_DIR, "contracts-phase3g-concurrency-auto.sql");

function docker(args, options = {}) {
  const result = spawnSync("docker", args, { cwd: ROOT, encoding: "utf8", windowsHide: true, ...options });
  if (result.status !== 0) {
    throw new Error([`docker ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result;
}

function psqlFile(localPath, containerPath) {
  docker(["cp", localPath, `${CONTAINER}:${containerPath}`]);
  return spawn("docker", [
    "exec", CONTAINER,
    "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ], { cwd: ROOT, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
}

function waitProcess(child) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function submission({ eventKey, action, reviewerId, reviewedAt }) {
  return JSON.stringify({
    submissionVersion: "contracts-activity-mapping-review.phase3.v1",
    eventKey,
    projectContext: {
      sourceSystem: "main",
      sourceProjectId: "11111111-1111-4111-8111-111111111111",
      scheduleProjectId: PROJECT_ID,
      projectMappingId: "33333333-3333-4333-8333-333333333333",
      mappingStatus: "active"
    },
    obligation: {
      documentVersionId: `sha256:${"a".repeat(64)}`,
      candidateKey: CANDIDATE_KEY,
      milestoneKey: "milestone:phase3g-concurrency"
    },
    scheduleVersion: { fileId: CURRENT_VERSION_ID, versionConflict: false },
    decision: {
      action,
      canonicalKey: CANONICAL_KEY,
      activityKey: CURRENT_ALIAS,
      previousActivityKey: action === "auto_continue" ? PREVIOUS_ALIAS : null,
      taskUid: 17,
      matchMethod: null,
      confidence: action === "auto_continue" ? 0.97 : 0.96,
      alternatives: [{ activityKey: CURRENT_ALIAS }],
      evidence: [{ kind: "isolated_concurrency_fixture", source: "test-contracts-phase3g-concurrency.mjs" }],
      conflict: null,
      conflictResolved: false,
      reviewerId,
      reviewedAt,
      reason: action === "auto_continue"
        ? "Controlled automatic continuation after exact authoritative identity verification."
        : "Concurrent human decision must remain authoritative over automatic continuation.",
      supersedesEventId: null
    }
  });
}

fs.mkdirSync(TEMP_DIR, { recursive: true });

docker(["inspect", "--format", "{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}", CONTAINER]);
docker([
  "exec", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c",
  `set role service_role;
   insert into public.schedule_activity_map
     (project_id, canonical_key, alias, alias_source, match_method, confidence, status, confirmed_by, confirmed_at)
   values
     ('${PROJECT_ID}', '${CANONICAL_KEY}', '${PREVIOUS_ALIAS}', 'gantt_activity_key', 'manual_review', 0.97, 'manually_confirmed', '${REVIEWER_ID}', '2026-08-12T10:00:00Z'),
     ('${PROJECT_ID}', '${CANONICAL_KEY}', '17', 'gantt_task_uid', 'manual_review', 0.97, 'manually_confirmed', '${REVIEWER_ID}', '2026-08-12T10:00:00Z'),
     ('${PROJECT_ID}', '${CANONICAL_KEY}', '${CANDIDATE_KEY}', 'contracts_candidate', 'manual_review', 0.97, 'manually_confirmed', '${REVIEWER_ID}', '2026-08-12T10:00:00Z');
   insert into private.schedule_activity_mapping_review_events
     (event_key, submission_fingerprint, project_id, project_mapping_id, document_version_id, candidate_key,
      milestone_key, schedule_version_id, action, selected_mapping_id, selected_canonical_key,
      selected_activity_alias, selected_alias_source, selected_match_method, mapping_status, confidence,
      alternatives_snapshot, evidence_snapshot, reviewer_id, reviewed_at, reason, submission_snapshot, result_snapshot)
   select '${PRIOR_EVENT_KEY}', md5('{}'), '${PROJECT_ID}', '33333333-3333-4333-8333-333333333333',
     'sha256:${"a".repeat(64)}', '${CANDIDATE_KEY}', 'milestone:phase3g-concurrency', '${PREVIOUS_VERSION_ID}',
     'confirm', id, '${CANONICAL_KEY}', '${PREVIOUS_ALIAS}', 'gantt_activity_key', 'manual_review',
     'manually_confirmed', 0.97, '[{"activityKey":"${PREVIOUS_ALIAS}"}]'::jsonb,
     '[{"kind":"isolated_fixture"}]'::jsonb, '${REVIEWER_ID}', '2026-08-12T10:00:00Z',
     'Prior reviewed mapping for isolated concurrency verification.', '{}'::jsonb,
     jsonb_build_object('status','recorded','eventKey','${PRIOR_EVENT_KEY}','action','confirm','canonicalKey','${CANONICAL_KEY}','mappingRowsChanged',3)
   from public.schedule_activity_map
   where project_id = '${PROJECT_ID}' and canonical_key = '${CANONICAL_KEY}' and alias = '${PREVIOUS_ALIAS}' and alias_source = 'gantt_activity_key';`
]);

const manualPayload = submission({
  eventKey: MANUAL_EVENT_KEY,
  action: "confirm",
  reviewerId: REVIEWER_ID,
  reviewedAt: "2026-08-12T11:00:00.000Z"
});
const autoPayload = submission({
  eventKey: AUTO_EVENT_KEY,
  action: "auto_continue",
  reviewerId: null,
  reviewedAt: "2026-08-12T11:00:01.000Z"
});

fs.writeFileSync(MANUAL_SQL, [
  "begin;",
  "set local role service_role;",
  `select public.bidoc_contracts_review_activity_mapping_v1(${sqlQuote(manualPayload)}::jsonb);`,
  "select pg_sleep(2);",
  "commit;"
].join("\n"));
fs.writeFileSync(AUTO_SQL, [
  "set role service_role;",
  `select public.bidoc_contracts_review_activity_mapping_v1(${sqlQuote(autoPayload)}::jsonb);`
].join("\n"));

const manual = psqlFile(MANUAL_SQL, "/tmp/contracts-phase3g-concurrency-manual.sql");
await new Promise((resolve) => setTimeout(resolve, 250));
const automatic = psqlFile(AUTO_SQL, "/tmp/contracts-phase3g-concurrency-auto.sql");
const [manualResult, autoResult] = await Promise.all([waitProcess(manual), waitProcess(automatic)]);

assert.equal(manualResult.code, 0, manualResult.stderr || manualResult.stdout);
assert.notEqual(autoResult.code, 0, "Concurrent auto_continue unexpectedly succeeded after a human decision.");
assert.match(autoResult.stderr, /Automatic continuation cannot replace or follow a human current-version decision/u);

const proof = docker([
  "exec", CONTAINER, "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c",
  `select jsonb_build_object(
    'manualMappings', (select count(*) from public.schedule_activity_map where project_id = '${PROJECT_ID}' and canonical_key = '${CANONICAL_KEY}' and alias = '${CURRENT_ALIAS}' and status = 'manually_confirmed'),
    'autoMappings', (select count(*) from public.schedule_activity_map where project_id = '${PROJECT_ID}' and canonical_key = '${CANONICAL_KEY}' and alias = '${CURRENT_ALIAS}' and status = 'auto_confirmed'),
    'manualEvents', (select count(*) from private.schedule_activity_mapping_review_events where event_key = '${MANUAL_EVENT_KEY}'),
    'autoEvents', (select count(*) from private.schedule_activity_mapping_review_events where event_key = '${AUTO_EVENT_KEY}')
  );`
]).stdout.trim();
const evidence = JSON.parse(proof);
assert.deepEqual(evidence, { manualMappings: 1, autoMappings: 0, manualEvents: 1, autoEvents: 0 });

process.stdout.write("Contracts Phase 3G PostgreSQL concurrency guard passed.\n");
