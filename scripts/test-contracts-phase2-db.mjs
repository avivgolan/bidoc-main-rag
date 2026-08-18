import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileRepresentativeCases } from "../src/contracts/representativeEvaluator.js";
import { planContractPromotions } from "../src/contracts/promotionPlanner.js";
import { buildContractPromotionSubmission } from "../src/contracts/promotionWriter.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const SOURCE_PROJECT_ID = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
const TARGET_PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const FIXED_REVIEWER_ID = "11111111-1111-4111-8111-111111111111";
const baselinePath = path.join(ROOT, "supabase", "tests", "contracts-phase2-existing-schedule-baseline.sql");
const migrationPaths = [
  "20260810175150_contracts_phase2_review_promotion.sql",
  "20260810181135_contracts_phase2_restrict_browser_privileges.sql",
  "20260810183407_contracts_phase2_index_mapping_fk.sql"
].map((name) => path.join(ROOT, "supabase", "migrations", name));

const representativeInput = JSON.parse(fs.readFileSync(
  path.join(ROOT, "docs", "Indicator + Contracts", "gold-set", "representative-contract-cases.input.json"),
  "utf8"
));
const representativeCases = compileRepresentativeCases(representativeInput);

function runDocker(args, { expectFailure = false, quiet = false } = {}) {
  const result = spawnSync("docker", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  const succeeded = result.status === 0;
  if ((!expectFailure && !succeeded) || (expectFailure && succeeded)) {
    throw new Error([
      `docker ${args.join(" ")} ${expectFailure ? "unexpectedly succeeded" : "failed"}`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join("\n"));
  }
  if (!quiet && result.stdout.trim()) process.stdout.write(result.stdout);
  if (!quiet && !expectFailure && result.stderr.trim()) process.stderr.write(result.stderr);
  return result;
}

function assertDedicatedHealthyContainer() {
  const result = runDocker([
    "inspect",
    "--format",
    "{{.Name}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}",
    CONTAINER
  ], { quiet: true });
  const state = result.stdout.trim();
  if (state !== `/${CONTAINER}|true|healthy`) {
    throw new Error(`Refusing database test reset because the dedicated container is not healthy: ${state}`);
  }
}

function copyAndRunSql(localPath, containerPath) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ]);
}

function runSqlCommand(sql, options = {}) {
  return runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql
  ], options);
}

function representativeOutput(id) {
  const item = representativeCases.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing representative Contracts case: ${id}`);
  return structuredClone(item.output);
}

function reviewedBatch(candidate, batchId, overrides = {}) {
  return {
    batchId,
    reviewerId: FIXED_REVIEWER_ID,
    reviewedAt: "2026-08-10T12:00:00.000Z",
    reason: "Reviewed against the authoritative contract and exact evidence.",
    documentAuthority: "authoritative",
    extractorVersion: "contracts-agent.phase1.v1",
    decisions: [{
      candidateKey: candidate.candidateKey,
      action: "approve",
      confidence: 0.98,
      resolvedGates: [...candidate.gates],
      reason: "Candidate accepted after document, project, and evidence review.",
      ...overrides
    }]
  };
}

function projectMapping(extraction) {
  return {
    sourceProjectId: extraction.projectBinding.projectId,
    scheduleProjectId: TARGET_PROJECT_ID,
    sameNamespace: false,
    approved: true,
    approvedBy: "backend-security-owner",
    approvedAt: "2026-08-10T11:55:00.000Z",
    reason: "Explicit reviewed mapping between the MAIN and KAPAIM project namespaces."
  };
}

function approvedGate() {
  return {
    schemaAuditApproved: true,
    projectNamespaceApproved: true,
    reviewAuditPersistenceApproved: true,
    atomicPromotionApproved: true,
    permissionModelApproved: true
  };
}

function submissionFor(caseId, batchId, decisionOverrides = {}) {
  const extraction = representativeOutput(caseId);
  extraction.projectBinding.projectId = SOURCE_PROJECT_ID;
  const reviewBatch = reviewedBatch(extraction.candidates[0], batchId, decisionOverrides);
  const mapping = projectMapping(extraction);
  const plan = planContractPromotions({ extraction, reviewBatch, projectMapping: mapping, gate: approvedGate() });
  return buildContractPromotionSubmission({ extraction, reviewBatch, projectMapping: mapping, plan });
}

function sqlJson(value) {
  const serialized = JSON.stringify(value);
  if (serialized.includes("$contract_json$")) throw new Error("Unexpected SQL dollar-quote marker in fixture JSON.");
  return `$contract_json$${serialized}$contract_json$::jsonb`;
}

function invocationSql(submission, expectedStatus, expectedPromotedCount) {
  return `
set role service_role;
do $test$
declare
  result jsonb;
begin
  result := public.bidoc_contracts_promote_review_v1(${sqlJson(submission)});
  if result ->> 'status' <> '${expectedStatus}' then
    raise exception 'Unexpected promotion status: %', result;
  end if;
  if (result ->> 'promotedCount')::integer <> ${expectedPromotedCount} then
    raise exception 'Unexpected promoted count: %', result;
  end if;
end;
$test$;
reset role;
`;
}

const fixed = submissionFor("signed_fixed_completion", "db-fixed-1", { milestoneKey: "contract-completion" });
const rejected = submissionFor("signed_fixed_completion", "db-rejected-1", { action: "reject" });
const extension = submissionFor("approved_extension_event", "db-extension-1", {
  milestoneKey: "contract-completion",
  approvedBy: "Owner representative"
});
const condition = submissionFor("relative_working_days_missing_calendar", "db-condition-1");

const changedBatch = structuredClone(fixed);
changedBatch.reviewBatch.reason = "Changed review reason must not reuse an existing batch identifier.";

const conflict = structuredClone(fixed);
conflict.reviewBatch.batchId = "db-fixed-conflict";
conflict.plan.rowsByTable.schedule_contract_milestones[0].contract_date = "2027-04-30";

const rollback = structuredClone(fixed);
rollback.reviewBatch.batchId = "db-rollback-1";
rollback.extraction.candidates[0].candidateKey = "rollback-first";
rollback.reviewBatch.decisions[0].candidateKey = "rollback-first";
rollback.plan.candidatePlans[0].candidateKey = "rollback-first";
rollback.plan.audit[0].candidateKey = "rollback-first";
rollback.plan.rowsByTable.schedule_contract_milestones[0].milestone_key = "rollback-first";
rollback.plan.rowsByTable.schedule_contract_milestones[0].metadata.contracts_candidate_key = "rollback-first";
const secondCandidate = structuredClone(rollback.extraction.candidates[0]);
secondCandidate.candidateKey = "rollback-second";
rollback.extraction.candidates.push(secondCandidate);
const secondDecision = structuredClone(rollback.reviewBatch.decisions[0]);
secondDecision.candidateKey = "rollback-second";
rollback.reviewBatch.decisions.push(secondDecision);
const secondPlan = structuredClone(rollback.plan.candidatePlans[0]);
secondPlan.candidateKey = "rollback-second";
rollback.plan.candidatePlans.push(secondPlan);
const secondAudit = structuredClone(rollback.plan.audit[0]);
secondAudit.candidateKey = "rollback-second";
rollback.plan.audit.push(secondAudit);
const secondRow = structuredClone(rollback.plan.rowsByTable.schedule_contract_milestones[0]);
secondRow.milestone_key = "rollback-second";
secondRow.contract_date = "not-a-date";
secondRow.metadata.contracts_candidate_key = "rollback-second";
rollback.plan.rowsByTable.schedule_contract_milestones.push(secondRow);

const sourceProjectId = fixed.projectMapping.sourceProjectId;
const testSql = `
insert into public.projects (id, name)
values ('${TARGET_PROJECT_ID}'::uuid, 'Contracts Phase 2 local fixture');

insert into private.schedule_contract_project_mappings (
  source_project_id, schedule_project_id, approved_by, approved_at, reason
) values (
  '${sourceProjectId}'::uuid,
  '${TARGET_PROJECT_ID}'::uuid,
  'backend-security-owner',
  '2026-08-10T11:55:00.000Z'::timestamptz,
  'Explicit local test mapping between MAIN and KAPAIM namespaces.'
);

do $test$
begin
  if has_schema_privilege('anon', 'private', 'usage') then
    raise exception 'anon unexpectedly has private schema usage';
  end if;
  if has_schema_privilege('authenticated', 'private', 'usage') then
    raise exception 'authenticated unexpectedly has private schema usage';
  end if;
  if has_function_privilege('anon', 'public.bidoc_contracts_promote_review_v1(jsonb)', 'execute') then
    raise exception 'anon unexpectedly has RPC execute';
  end if;
  if has_function_privilege('authenticated', 'public.bidoc_contracts_promote_review_v1(jsonb)', 'execute') then
    raise exception 'authenticated unexpectedly has RPC execute';
  end if;
  if has_table_privilege('anon', 'public.schedule_contract_milestones', 'insert')
     or has_table_privilege('authenticated', 'public.schedule_contract_milestones', 'insert') then
    raise exception 'browser role unexpectedly retains target insert privilege';
  end if;
end;
$test$;

${invocationSql(rejected, "reviewed_no_promotion", 0)}

do $test$
begin
  if (select count(*) from private.schedule_contract_review_batches where batch_key = 'db-rejected-1') <> 1 then
    raise exception 'Rejection review batch was not persisted exactly once';
  end if;
  if (select count(*) from private.schedule_contract_review_decisions decisions join private.schedule_contract_review_batches batches on batches.id = decisions.review_batch_id where batches.batch_key = 'db-rejected-1' and decisions.outcome = 'rejected') <> 1 then
    raise exception 'Rejection decision was not persisted';
  end if;
end;
$test$;

${invocationSql(fixed, "committed", 1)}
${invocationSql(fixed, "committed", 1)}

do $test$
begin
  if (select count(*) from public.schedule_contract_milestones where milestone_key = 'contract-completion') <> 1 then
    raise exception 'Identical batch was not idempotent for milestone target';
  end if;
  if (select count(*) from private.schedule_contract_review_batches where batch_key = 'db-fixed-1') <> 1 then
    raise exception 'Identical batch was not idempotent for review batch';
  end if;
  if (select count(*) from private.schedule_contract_promotion_attempts where batch_key = 'db-fixed-1') <> 1 then
    raise exception 'Identical batch unexpectedly created another attempt';
  end if;
end;
$test$;

${invocationSql(changedBatch, "failed", 0)}
${invocationSql(conflict, "failed", 0)}

do $test$
begin
  if (select count(*) from private.schedule_contract_review_batches where batch_key in ('db-fixed-conflict')) <> 0 then
    raise exception 'Failed conflict persisted a review batch';
  end if;
  if (select count(*) from public.schedule_contract_milestones where milestone_key = 'contract-completion' and contract_date = '2027-03-31') <> 1 then
    raise exception 'Conflict changed the committed milestone';
  end if;
  if (select count(*) from private.schedule_contract_promotion_attempts where batch_key = 'db-fixed-conflict' and status = 'failed' and promoted_count = 0) <> 1 then
    raise exception 'Conflict failure attempt was not recorded immutably';
  end if;
end;
$test$;

${invocationSql(extension, "committed", 1)}
${invocationSql(condition, "committed", 1)}
${invocationSql(rollback, "failed", 0)}

do $test$
begin
  if (select count(*) from public.schedule_contract_extensions where milestone_key = 'contract-completion' and extension_days = 21) <> 1 then
    raise exception 'Reviewed extension was not promoted';
  end if;
  if (select count(*) from public.schedule_contract_conditions where offset_value = 45 and offset_unit = 'working_days') <> 1 then
    raise exception 'Reviewed condition was not promoted';
  end if;
  if (select count(*) from public.schedule_contract_milestones where milestone_key in ('rollback-first', 'rollback-second')) <> 0 then
    raise exception 'Forced middle failure left a partial milestone row';
  end if;
  if (select count(*) from private.schedule_contract_promotion_attempts where batch_key = 'db-rollback-1' and status = 'failed' and promoted_count = 0) <> 1 then
    raise exception 'Forced middle failure was not recorded';
  end if;
end;
$test$;

do $test$
declare
  audit_id uuid;
  immutable_blocked boolean := false;
begin
  select id into audit_id from private.schedule_contract_review_batches limit 1;
  begin
    update private.schedule_contract_review_batches set review_reason = 'Mutation must fail' where id = audit_id;
  exception when sqlstate '55000' then
    immutable_blocked := true;
  end;
  if not immutable_blocked then
    raise exception 'Immutable review audit accepted an update';
  end if;
end;
$test$;

select jsonb_build_object(
  'status', 'passed',
  'reviewBatches', (select count(*) from private.schedule_contract_review_batches),
  'reviewDecisions', (select count(*) from private.schedule_contract_review_decisions),
  'promotionAttempts', (select count(*) from private.schedule_contract_promotion_attempts),
  'milestones', (select count(*) from public.schedule_contract_milestones),
  'extensions', (select count(*) from public.schedule_contract_extensions),
  'conditions', (select count(*) from public.schedule_contract_conditions)
) as contracts_phase2_database_test;
`;

const cleanupSql = `
drop function if exists public.bidoc_contracts_promote_review_v1(jsonb);
drop schema if exists private cascade;
drop table if exists public.schedule_contract_conditions cascade;
drop table if exists public.schedule_contract_extensions cascade;
drop table if exists public.schedule_contract_milestones cascade;
drop table if exists public.projects cascade;
`;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bidoc-contracts-phase2-db-"));
const cleanupPath = path.join(tempDir, "cleanup.sql");
const testPath = path.join(tempDir, "test.sql");
fs.writeFileSync(cleanupPath, cleanupSql, "utf8");
fs.writeFileSync(testPath, testSql, "utf8");

try {
  assertDedicatedHealthyContainer();
  copyAndRunSql(cleanupPath, "/tmp/contracts-phase2-cleanup.sql");
  copyAndRunSql(baselinePath, "/tmp/contracts-phase2-baseline.sql");
  for (const [index, migrationPath] of migrationPaths.entries()) {
    copyAndRunSql(migrationPath, `/tmp/contracts-phase2-migration-${index + 1}.sql`);
  }
  copyAndRunSql(testPath, "/tmp/contracts-phase2-test.sql");

  runSqlCommand(
    "set role anon; select public.bidoc_contracts_promote_review_v1('{}'::jsonb);",
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    `set role anon; insert into private.schedule_contract_project_mappings (source_project_id, schedule_project_id, approved_by, approved_at, reason) values ('${sourceProjectId}', '${TARGET_PROJECT_ID}', 'anon', now(), 'Unauthorized mapping must fail.');`,
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    `set role authenticated; insert into public.schedule_contract_milestones (project_id, milestone_key, name, contract_date) values ('${TARGET_PROJECT_ID}', 'browser-write', 'Browser write', '2027-01-01');`,
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    "set role anon; truncate table public.schedule_contract_milestones;",
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(`
do $$
begin
  if has_table_privilege('anon', 'public.schedule_contract_milestones', 'truncate')
    or has_table_privilege('authenticated', 'public.schedule_contract_extensions', 'references')
    or has_table_privilege('authenticated', 'public.schedule_contract_conditions', 'trigger') then
    raise exception 'browser role retained a forbidden non-read target privilege';
  end if;
  if to_regclass('private.schedule_contract_review_batches_mapping_idx') is null then
    raise exception 'mapping foreign-key index is missing';
  end if;
end;
$$;
  `, { quiet: true });

  process.stdout.write("Contracts Phase 2 database tests passed.\n");
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
