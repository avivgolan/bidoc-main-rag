import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const CLEANUP = path.join(ROOT, "supabase", "tests", "contracts-phase3-cleanup.sql");
const BASELINE = path.join(ROOT, "supabase", "tests", "contracts-phase2-existing-schedule-baseline.sql");
const WORKSPACES = path.join(ROOT, "supabase", "migrations", "20260812135210_contracts_phase3f1_saved_workspaces.sql");
const R1 = path.join(ROOT, "supabase", "migrations", "20260815103618_contracts_pipeline_r1_schema_lock.sql");
const R6 = path.join(ROOT, "supabase", "migrations", "20260819195943_contracts_r6_phase2_foundation.sql");
const TEST = path.join(ROOT, "supabase", "tests", "contracts-r6-phase2-foundation.sql");

function runDocker(args, { quiet = false } = {}) {
  const result = spawnSync("docker", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    throw new Error([`docker ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  if (!quiet && result.stdout.trim()) process.stdout.write(result.stdout);
  if (!quiet && result.stderr.trim()) process.stderr.write(result.stderr);
}

function assertDedicatedHealthyContainer() {
  const result = spawnSync("docker", [
    "inspect",
    "--format",
    "{{.Name}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}",
    CONTAINER
  ], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || result.stdout.trim() !== `/${CONTAINER}|true|healthy`) {
    throw new Error(`Refusing local database reset because the dedicated container is not healthy: ${result.stdout.trim()}`);
  }
}

function copyAndRunSql(localPath, containerPath) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  runDocker(["exec", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath]);
}

function runSql(sql) {
  runDocker(["exec", CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql]);
}

function assertMigrationContract() {
  const migration = fs.readFileSync(R6, "utf8");
  if (/security\s+definer/i.test(migration)
      || /schedule_contract_|insert\s+into\s+public\.projects/i.test(migration)
      || !/private\.contract_tag_catalog/i.test(migration)
      || !/private\.contract_trigger_catalog/i.test(migration)
      || !/contracts_documents_embedding_hnsw_r6_idx/i.test(migration)
      || !/contracts_embedding_hnsw_r6_idx/i.test(migration)) {
    throw new Error("R6 migration violates its additive, private, or no-Schedule contract.");
  }
}

assertMigrationContract();
assertDedicatedHealthyContainer();
copyAndRunSql(CLEANUP, "/tmp/contracts-r6-cleanup.sql");
copyAndRunSql(BASELINE, "/tmp/contracts-r6-baseline.sql");
copyAndRunSql(WORKSPACES, "/tmp/contracts-r6-workspaces.sql");
copyAndRunSql(R1, "/tmp/contracts-r6-r1.sql");
runSql(`
  do $$
  begin
    if exists (select 1 from pg_extension where extname = 'vector') then
      if to_regtype('public.vector') is null then
        alter extension vector set schema public;
      end if;
    else
      create extension vector with schema public;
    end if;
  end
  $$;
  create table if not exists public.data_index (id bigint generated always as identity primary key, hashtags text[]);
  truncate public.data_index;
  insert into public.data_index (hashtags) values
    (array['חוזה', 'אישור']),
    (array['חוזה', 'תחילת_עבודה']),
    (array['אישור']);
`);
copyAndRunSql(R6, "/tmp/contracts-r6-migration.sql");
copyAndRunSql(TEST, "/tmp/contracts-r6-test.sql");
console.log("Contracts R6 Phase 2 database foundation test passed.");
