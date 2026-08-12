import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const PHASE3_PRIMARY = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260811170622_contracts_phase3_activity_mapping_review.sql"
);
const PHASE3_FOLLOWUP = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260811171813_contracts_phase3_cover_project_mapping_fk.sql"
);
const PHASE3F_HISTORY = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260811214619_contracts_phase3f_mapping_review_history.sql"
);
const PHASE3F1_WORKSPACES = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260812135210_contracts_phase3f1_saved_workspaces.sql"
);
const PHASE3G_GUARD = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260812194500_contracts_phase3g_auto_continuation_manual_guard.sql"
);
const PHASE3G_ROLLBACK = path.join(
  ROOT,
  "supabase",
  "rollbacks",
  "contracts_phase3g_auto_continuation_manual_guard.rollback.sql"
);
const MIGRATIONS = [
  "20260810175150_contracts_phase2_review_promotion.sql",
  "20260810181135_contracts_phase2_restrict_browser_privileges.sql",
  "20260810183407_contracts_phase2_index_mapping_fk.sql"
].map((name) => path.join(ROOT, "supabase", "migrations", name)).concat(
  PHASE3_PRIMARY,
  PHASE3_FOLLOWUP,
  PHASE3F_HISTORY,
  PHASE3F1_WORKSPACES,
  PHASE3G_GUARD
);
const PHASE2_BASELINE = path.join(ROOT, "supabase", "tests", "contracts-phase2-existing-schedule-baseline.sql");
const PHASE3_BASELINE = path.join(ROOT, "supabase", "tests", "contracts-phase3-existing-activity-map-baseline.sql");
const CLEANUP = path.join(ROOT, "supabase", "tests", "contracts-phase3-cleanup.sql");
const TEST_SQL = path.join(ROOT, "supabase", "tests", "contracts-phase3-activity-mapping.sql");
const WORKSPACE_TEST_SQL = path.join(ROOT, "supabase", "tests", "contracts-phase3f1-saved-workspaces.sql");
const ROLLBACK = path.join(ROOT, "supabase", "rollbacks", "contracts_phase3_activity_mapping_review.rollback.sql");
const POST_ROLLBACK = path.join(ROOT, "supabase", "tests", "contracts-phase3-post-rollback.sql");

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

function runSqlCommand(sql, { tuplesOnly = false, ...options } = {}) {
  return runDocker([
    "exec", CONTAINER,
    "psql", ...(tuplesOnly ? ["-At"] : []), "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql
  ], options);
}

function assertMigrationSourceContract() {
  const migration = fs.readFileSync(PHASE3_PRIMARY, "utf8");
  const followup = fs.readFileSync(PHASE3_FOLLOWUP, "utf8");
  const history = fs.readFileSync(PHASE3F_HISTORY, "utf8");
  const workspaces = fs.readFileSync(PHASE3F1_WORKSPACES, "utf8");
  const phase3gGuard = fs.readFileSync(PHASE3G_GUARD, "utf8");
  const forbiddenProductionIds = [
    "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7",
    "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5",
    "smxibuaowzuxkznuouwj"
  ];
  for (const value of forbiddenProductionIds) {
    if (migration.includes(value)) throw new Error(`Phase 3 migration hardcodes a production identity: ${value}`);
    if (history.includes(value)) throw new Error(`Phase 3F migration hardcodes a production identity: ${value}`);
    if (workspaces.includes(value)) throw new Error(`Phase 3F.1 migration hardcodes a production identity: ${value}`);
    if (phase3gGuard.includes(value)) throw new Error(`Phase 3G migration hardcodes a production identity: ${value}`);
  }
  if (/security\s+definer/i.test(migration)) throw new Error("Phase 3 migration contains SECURITY DEFINER.");
  if (!/security\s+invoker[\s\S]*set search_path = ''/i.test(migration)) {
    throw new Error("Phase 3 migration is missing the invoker/empty-search-path function contract.");
  }
  if (!/revoke all privileges on table public\.schedule_activity_map from public, anon, authenticated, service_role/i.test(migration)) {
    throw new Error("Phase 3 migration is missing the exact schedule_activity_map privilege reset.");
  }
  if (/security\s+definer/i.test(followup) || forbiddenProductionIds.some((value) => followup.includes(value))) {
    throw new Error("Phase 3 advisor follow-up violates the migration source guard.");
  }
  if (/security\s+definer/i.test(history)
      || !/security\s+invoker[\s\S]*set search_path = ''/i.test(history)
      || !/revoke execute on function public\.bidoc_contracts_list_activity_mapping_reviews_v1[\s\S]*grant execute on function public\.bidoc_contracts_list_activity_mapping_reviews_v1[\s\S]*to service_role/i.test(history)) {
    throw new Error("Phase 3F history RPC violates the invoker or least-privilege source contract.");
  }
  if (!/drop index private\.samre_project_mapping_fk_idx;[\s\S]*create index samre_project_mapping_fk_idx[\s\S]*\(project_mapping_id, project_id\)/i.test(followup)) {
    throw new Error("Phase 3 advisor follow-up does not replace the leading-column FK index with the composite covering index.");
  }
  if (/security\s+definer/i.test(workspaces)
      || !/security\s+invoker[\s\S]*set search_path = ''/i.test(workspaces)
      || /(?:insert\s+into|update|delete\s+from)\s+storage\./i.test(workspaces)) {
    throw new Error("Phase 3F.1 workspace migration violates invoker, search-path, or managed-Storage boundaries.");
  }
  if (/security\s+definer/i.test(phase3gGuard)
      || !/create or replace function public\.bidoc_contracts_review_activity_mapping_v1\(p_submission jsonb\)[\s\S]*security\s+invoker[\s\S]*set search_path = ''/i.test(phase3gGuard)
      || !/pg_advisory_xact_lock/i.test(phase3gGuard)
      || !/Automatic continuation cannot replace or follow a human current-version decision/i.test(phase3gGuard)) {
    throw new Error("Phase 3G guard migration violates the single-RPC, serialization, or invoker contract.");
  }
}

function runFullDatabaseTest() {
  assertMigrationSourceContract();
  assertDedicatedHealthyContainer();
  copyAndRunSql(CLEANUP, "/tmp/contracts-phase3-cleanup.sql");
  copyAndRunSql(PHASE2_BASELINE, "/tmp/contracts-phase3-phase2-baseline.sql");
  copyAndRunSql(PHASE3_BASELINE, "/tmp/contracts-phase3-activity-baseline.sql");
  for (const [index, migrationPath] of MIGRATIONS.entries()) {
    copyAndRunSql(migrationPath, `/tmp/contracts-phase3-migration-${index + 1}.sql`);
  }
  copyAndRunSql(TEST_SQL, "/tmp/contracts-phase3-test.sql");
  copyAndRunSql(WORKSPACE_TEST_SQL, "/tmp/contracts-phase3f1-workspaces-test.sql");

  runSqlCommand(
    "set role anon; select public.bidoc_contracts_resolve_mapping_context_v1('11111111-1111-4111-8111-111111111111'::uuid);",
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    "set role anon; select public.bidoc_contracts_review_activity_mapping_v1('{}'::jsonb);",
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    "set role authenticated; select public.bidoc_contracts_list_activity_mapping_reviews_v1('11111111-1111-4111-8111-111111111111'::uuid);",
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    "set role authenticated; insert into public.schedule_activity_map (project_id, canonical_key, alias, alias_source, match_method, confidence, status) values ('22222222-2222-4222-8222-222222222222', 'schedule-activity:77777777-7777-4777-8777-777777777777', '17', 'gantt_task_uid', 'manual_review', 0.9, 'suggested');",
    { expectFailure: true, quiet: true }
  );
  runSqlCommand(
    "set role service_role; delete from private.schedule_activity_mapping_review_events where event_key = 'phase3-reject-1';",
    { expectFailure: true, quiet: true }
  );

  process.stdout.write("Contracts Phase 3 database tests passed.\n");
}

function runRollbackTest() {
  assertDedicatedHealthyContainer();
  copyAndRunSql(ROLLBACK, "/tmp/contracts-phase3-rollback.sql");
  copyAndRunSql(POST_ROLLBACK, "/tmp/contracts-phase3-post-rollback.sql");
  process.stdout.write("Contracts Phase 3 non-destructive rollback test passed.\n");
}

function runPhase3GRollbackTest() {
  assertDedicatedHealthyContainer();
  const before = JSON.parse(runSqlCommand(
    "select json_build_object('mappings', (select count(*) from public.schedule_activity_map), 'events', (select count(*) from private.schedule_activity_mapping_review_events));",
    { quiet: true, tuplesOnly: true }
  ).stdout.trim());
  copyAndRunSql(PHASE3G_ROLLBACK, "/tmp/contracts-phase3g-rollback.sql");
  const after = JSON.parse(runSqlCommand(
    `select json_build_object(
      'mappings', (select count(*) from public.schedule_activity_map),
      'events', (select count(*) from private.schedule_activity_mapping_review_events),
      'publicRpc', to_regprocedure('public.bidoc_contracts_review_activity_mapping_v1(jsonb)') is not null,
      'privateRetainedRpc', to_regprocedure('private.bidoc_contracts_review_activity_mapping_phase3c_v1(jsonb)') is not null,
      'guard', to_regprocedure('private.bidoc_contracts_lock_activity_mapping_review_v1(text,uuid,text,text,text,text,text)') is not null,
      'serviceExecute', has_function_privilege('service_role', 'public.bidoc_contracts_review_activity_mapping_v1(jsonb)', 'EXECUTE'),
      'anonExecute', has_function_privilege('anon', 'public.bidoc_contracts_review_activity_mapping_v1(jsonb)', 'EXECUTE')
    );`,
    { quiet: true, tuplesOnly: true }
  ).stdout.trim());
  if (
    after.mappings !== before.mappings
    || after.events !== before.events
    || after.publicRpc !== true
    || after.privateRetainedRpc !== false
    || after.guard !== false
    || after.serviceExecute !== true
    || after.anonExecute !== false
  ) {
    throw new Error(`Phase 3G rollback verification failed: ${JSON.stringify({ before, after })}`);
  }
  process.stdout.write("Contracts Phase 3G non-destructive rollback test passed.\n");
}

if (process.argv.includes("--phase3g-rollback-only")) {
  runPhase3GRollbackTest();
} else if (process.argv.includes("--rollback-only")) {
  runRollbackTest();
} else {
  runFullDatabaseTest();
}
