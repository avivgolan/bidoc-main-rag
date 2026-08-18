import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const CLEANUP = path.join(ROOT, "supabase", "tests", "contracts-phase3-cleanup.sql");
const BASELINE = path.join(ROOT, "supabase", "tests", "contracts-phase2-existing-schedule-baseline.sql");
const WORKSPACES = path.join(ROOT, "supabase", "migrations", "20260812135210_contracts_phase3f1_saved_workspaces.sql");
const MIGRATION = path.join(ROOT, "supabase", "migrations", "20260815103618_contracts_pipeline_r1_schema_lock.sql");
const TEST = path.join(ROOT, "supabase", "tests", "contracts-pipeline-r1-schema-lock.sql");
const ROLLBACK = path.join(ROOT, "supabase", "rollbacks", "contracts_pipeline_r1_schema_lock.rollback.sql");
const ROLLBACK_PRECONDITION = path.join(ROOT, "supabase", "tests", "contracts-pipeline-r1-rollback-precondition.sql");
const POST_ROLLBACK = path.join(ROOT, "supabase", "tests", "contracts-pipeline-r1-post-rollback.sql");
const POST_REAPPLY = path.join(ROOT, "supabase", "tests", "contracts-pipeline-r1-post-reapply.sql");

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

function runDockerAsync(args) {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { cwd: ROOT, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
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

function copyAndRunSql(localPath, containerPath, options = {}) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  return runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ], options);
}

function runSqlCommand(sql, options = {}) {
  return runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql
  ], options);
}

function psqlArgs(sql) {
  return [
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql
  ];
}

function assertSourceContract() {
  const migration = fs.readFileSync(MIGRATION, "utf8");
  const rollback = fs.readFileSync(ROLLBACK, "utf8");
  const forbiddenProductionIds = [
    "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7",
    "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5",
    "smxibuaowzuxkznuouwj"
  ];
  for (const value of forbiddenProductionIds) {
    if (migration.includes(value)) throw new Error(`R1 migration hardcodes a production identity: ${value}`);
  }
  if (/security\s+definer/i.test(migration)) throw new Error("R1 migration contains SECURITY DEFINER.");
  if (/(?:insert\s+into|update|delete\s+from)\s+public\.schedule_contract_/i.test(migration)) {
    throw new Error("R1 migration writes to a Schedule target table.");
  }
  if (!/alter table private\.contracts_documents force row level security/i.test(migration)
      || !/grant select, insert on table private\.contracts to service_role/i.test(migration)
      || !/security\s+invoker[\s\S]*set search_path = ''/i.test(migration)
      || !/pg_advisory_xact_lock/i.test(migration)) {
    throw new Error("R1 migration is missing a locked RLS, privilege, invoker, or revision-serialization contract.");
  }
  if (!/R1 rollback refused because R1-owned data exists/i.test(rollback)) {
    throw new Error("R1 rollback does not fail closed when R1-owned data exists.");
  }
}

function resetAndApplyR1() {
  copyAndRunSql(CLEANUP, "/tmp/contracts-r1-cleanup.sql");
  copyAndRunSql(BASELINE, "/tmp/contracts-r1-baseline.sql");
  copyAndRunSql(WORKSPACES, "/tmp/contracts-r1-workspaces.sql");
  copyAndRunSql(MIGRATION, "/tmp/contracts-r1-migration.sql");
}

function decisionPayloadSql(overrides) {
  return `
    with fixture as (
      select
        workspace.id as workspace_id,
        workspace.source_project_id,
        workspace.document_version_id,
        workspace.parser_generation_id,
        clause.id as clause_id,
        clause.page_start,
        clause.page_end,
        clause.raw_text_sha256,
        clause.raw_text
      from private.contract_workspaces workspace
      join private.contracts_documents clause on clause.workspace_id = workspace.id
      where workspace.workspace_version = 'contracts-workspace.r1.v1'
        and workspace.source_project_id = '11111111-1111-4111-8111-111111111111'
        and workspace.document_version_id = 'sha256:${"a".repeat(64)}'
        and workspace.parser_generation_id = 'parser-generation:sha256:${"b".repeat(64)}'
        and clause.clause_key = 'clause:1'
      limit 1
    )
    select public.bidoc_contracts_append_decision_r1(
      ${overrides.expectedRevision},
      jsonb_build_object(
        'workspaceId', workspace_id,
        'sourceProjectId', source_project_id,
        'documentVersionId', document_version_id,
        'parserGenerationId', parser_generation_id,
        'decisionKey', 'decision:concurrency',
        'primaryClauseId', clause_id,
        'sourceEvidence', jsonb_build_array(jsonb_build_object(
          'clauseId', clause_id,
          'pageStart', page_start,
          'pageEnd', page_end,
          'rawTextSha256', raw_text_sha256,
          'excerpt', raw_text
        )),
        'titleHe', 'Concurrency decision',
        'summaryHe', 'Concurrency decision summary',
        'decisionTextHe', 'Concurrency decision meaning',
        'tags', jsonb_build_array(),
        'people', jsonb_build_array(),
        'decisionCategory', 'other',
        'scheduleImpact', '${overrides.scheduleImpact}',
        'temporalKind', 'none',
        'calendarSemantics', '${overrides.calendarSemantics}',
        'reviewStatus', '${overrides.reviewStatus}',
        ${overrides.reviewFields}
        'projectionStatus', '${overrides.projectionStatus}',
        'modelVersion', 'model.r1',
        'decisionPolicyVersion', 'decision-policy.concurrent'
      )
    ) from fixture;
  `;
}

function relationshipPayloadSql(expectedRevision, reviewReason) {
  return `
    with fixture as (
      select
        workspace.id as workspace_id,
        workspace.document_version_id,
        workspace.parser_generation_id,
        clause_one.id as clause_one,
        clause_one.page_start,
        clause_one.page_end,
        clause_one.raw_text_sha256,
        clause_one.raw_text,
        clause_two.id as clause_two
      from private.contract_workspaces workspace
      join private.contracts_documents clause_one
        on clause_one.workspace_id = workspace.id
       and clause_one.clause_key = 'clause:1'
      join private.contracts_documents clause_two
        on clause_two.workspace_id = workspace.id
       and clause_two.clause_key = 'clause:2'
      where workspace.workspace_version = 'contracts-workspace.r1.v1'
        and workspace.source_project_id = '11111111-1111-4111-8111-111111111111'
        and workspace.document_version_id = 'sha256:${"a".repeat(64)}'
        and workspace.parser_generation_id = 'parser-generation:sha256:${"b".repeat(64)}'
    )
    select public.bidoc_contracts_append_relationship_r1(
      ${expectedRevision},
      jsonb_build_object(
        'workspaceId', workspace_id,
        'documentVersionId', document_version_id,
        'parserGenerationId', parser_generation_id,
        'sourceClauseId', clause_one,
        'targetClauseId', clause_two,
        'relationshipType', 'exception_to',
        'origin', 'human',
        'evidence', jsonb_build_object(
          'excerpts', jsonb_build_array(jsonb_build_object(
            'clauseId', clause_one,
            'pageStart', page_start,
            'pageEnd', page_end,
            'rawTextSha256', raw_text_sha256,
            'excerpt', raw_text
          )),
          'rationaleHe', '${reviewReason}'
        ),
        'modelVersion', 'not_applicable',
        'relationshipPolicyVersion', 'relationship-policy.concurrent',
        'reviewStatus', ${expectedRevision === 0 ? "'proposed'" : "'approved'"},
        'reviewerId', ${expectedRevision === 0 ? "null" : "'44444444-4444-4444-8444-444444444444'"},
        'reviewedAt', ${expectedRevision === 0 ? "null" : "'2026-08-15T11:00:00Z'"},
        'reviewReason', ${expectedRevision === 0 ? "null" : `'${reviewReason}'`}
      )
    ) from fixture;
  `;
}

async function assertConcurrentRevisionGuards() {
  runSqlCommand(`set role service_role; ${decisionPayloadSql({
    expectedRevision: 0,
    scheduleImpact: "unknown",
    calendarSemantics: "unknown",
    reviewStatus: "proposed",
    reviewFields: "",
    projectionStatus: "blocked"
  })}`, { quiet: true });

  const decisionRevision = decisionPayloadSql({
    expectedRevision: 1,
    scheduleImpact: "no",
    calendarSemantics: "not_applicable",
    reviewStatus: "approved",
    reviewFields: "'reviewerId', '44444444-4444-4444-8444-444444444444', 'reviewedAt', '2026-08-15T11:00:00Z', 'reviewReason', 'Concurrent approval.',",
    projectionStatus: "not_applicable"
  });
  const decisionResults = await Promise.all([
    runDockerAsync(psqlArgs(`set role service_role; ${decisionRevision}`)),
    runDockerAsync(psqlArgs(`set role service_role; ${decisionRevision}`))
  ]);
  if (decisionResults.filter((result) => result.status === 0).length !== 1
      || decisionResults.filter((result) => result.status !== 0 && /stale/i.test(result.stderr)).length !== 1) {
    throw new Error(`Decision concurrency guard failed: ${JSON.stringify(decisionResults)}`);
  }

  runSqlCommand(`set role service_role; ${relationshipPayloadSql(0, "Concurrent base relationship.")}`, { quiet: true });
  const relationshipRevision = relationshipPayloadSql(1, "Concurrent relationship approval.");
  const relationshipResults = await Promise.all([
    runDockerAsync(psqlArgs(`set role service_role; ${relationshipRevision}`)),
    runDockerAsync(psqlArgs(`set role service_role; ${relationshipRevision}`))
  ]);
  if (relationshipResults.filter((result) => result.status === 0).length !== 1
      || relationshipResults.filter((result) => result.status !== 0 && /stale/i.test(result.stderr)).length !== 1) {
    throw new Error(`Relationship concurrency guard failed: ${JSON.stringify(relationshipResults)}`);
  }
}

async function main() {
  assertSourceContract();
  assertDedicatedHealthyContainer();
  resetAndApplyR1();
  copyAndRunSql(TEST, "/tmp/contracts-r1-test.sql");

  runSqlCommand("set role anon; select public.bidoc_contracts_schema_status_r1();", {
    expectFailure: true,
    quiet: true
  });
  runSqlCommand("set role authenticated; select public.bidoc_contracts_upsert_workspace_r1('{}'::jsonb);", {
    expectFailure: true,
    quiet: true
  });

  await assertConcurrentRevisionGuards();

  const refused = copyAndRunSql(ROLLBACK, "/tmp/contracts-r1-rollback.sql", {
    expectFailure: true,
    quiet: true
  });
  if (!/R1 rollback refused because R1-owned data exists/i.test(refused.stderr)) {
    throw new Error("Populated R1 rollback failed for an unexpected reason.");
  }
  runSqlCommand("select count(*) from private.contracts_documents;", { quiet: true });

  resetAndApplyR1();
  copyAndRunSql(ROLLBACK_PRECONDITION, "/tmp/contracts-r1-rollback-precondition.sql");
  copyAndRunSql(ROLLBACK, "/tmp/contracts-r1-rollback.sql");
  copyAndRunSql(POST_ROLLBACK, "/tmp/contracts-r1-post-rollback.sql");
  copyAndRunSql(MIGRATION, "/tmp/contracts-r1-migration.sql");
  copyAndRunSql(POST_REAPPLY, "/tmp/contracts-r1-post-reapply.sql");

  process.stdout.write("Contracts Pipeline R1 database, concurrency, rollback, and reapply tests passed.\n");
}

await main();
