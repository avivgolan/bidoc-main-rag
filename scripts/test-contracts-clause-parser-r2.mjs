import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACTS_CLAUSE_PARSER_POLICY_VERSION,
  buildContractsClauseGeneration,
  buildContractsClausePayloads,
  buildContractsClauseWorkspacePayload
} from "../src/contracts/clauseParser.js";
import { readContractPdf } from "../src/contracts/pdfReader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const CLEANUP = path.join(ROOT, "supabase", "tests", "contracts-phase3-cleanup.sql");
const BASELINE = path.join(ROOT, "supabase", "tests", "contracts-phase2-existing-schedule-baseline.sql");
const WORKSPACES = path.join(ROOT, "supabase", "migrations", "20260812135210_contracts_phase3f1_saved_workspaces.sql");
const R1_MIGRATION = path.join(ROOT, "supabase", "migrations", "20260815103618_contracts_pipeline_r1_schema_lock.sql");
const GOLD = path.join(ROOT, "docs", "Indicator + Contracts", "gold-set", "sample-herzliya-contract.annotation.json");
const SOURCE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_BY = "44444444-4444-4444-8444-444444444444";
const STORAGE_BUCKET = "contracts-r2-local-fixture";

const args = parseArgs(process.argv.slice(2));
if (!args.pdf) {
  process.stderr.write("Usage: npm.cmd run test:contracts:r2-db -- --pdf <approved-herzliya.pdf>\n");
  process.exit(2);
}

function runDocker(arguments_, { input = null, quiet = false } = {}) {
  const result = spawnSync("docker", arguments_, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    input,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error([
      `docker ${arguments_.join(" ")} failed`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join("\n"));
  }
  if (!quiet && result.stdout.trim()) process.stdout.write(result.stdout);
  if (!quiet && result.stderr.trim()) process.stderr.write(result.stderr);
  return result.stdout;
}

function assertDedicatedHealthyContainer() {
  const state = runDocker([
    "inspect",
    "--format",
    "{{.Name}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}",
    CONTAINER
  ], { quiet: true }).trim();
  assert.equal(
    state,
    `/${CONTAINER}|true|healthy`,
    `Refusing R2 database fixture reset because the dedicated container is not healthy: ${state}`
  );
}

function copyAndRunSql(localPath, containerPath) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ], { quiet: true });
}

function resetAndApplyR1() {
  copyAndRunSql(CLEANUP, "/tmp/contracts-r2-cleanup.sql");
  copyAndRunSql(BASELINE, "/tmp/contracts-r2-baseline.sql");
  copyAndRunSql(WORKSPACES, "/tmp/contracts-r2-workspaces.sql");
  copyAndRunSql(R1_MIGRATION, "/tmp/contracts-r2-r1-migration.sql");
}

function runSql(sql) {
  return runDocker([
    "exec", "-i", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-U", "postgres", "-d", "postgres"
  ], { input: sql, quiet: true }).trim();
}

function rpcJson(functionCall) {
  const output = runSql(`set role service_role;\nselect ${functionCall};\n`);
  const line = output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean).at(-1);
  return JSON.parse(line);
}

function jsonLiteral(value) {
  const json = JSON.stringify(value);
  if (json.includes("$r2json$")) throw new Error("R2 fixture JSON contains the SQL delimiter.");
  return `$r2json$${json}$r2json$::jsonb`;
}

function insertClauses(payloads) {
  runSql(`
begin;
set local role service_role;
do $r2do$
declare
  v_payload jsonb;
begin
  for v_payload in select value from jsonb_array_elements(${jsonLiteral(payloads)})
  loop
    perform public.bidoc_contracts_insert_clause_r1(v_payload);
  end loop;
end
$r2do$;
commit;
`);
}

function persistGeneration({ generation, parsedPdf, pdfBytes, filename }) {
  const workspacePayload = buildContractsClauseWorkspacePayload({
    generation,
    sourceProjectId: SOURCE_PROJECT_ID,
    filename,
    byteCount: pdfBytes.length,
    storageBucket: STORAGE_BUCKET,
    storageObjectKey: `sha256/${generation.documentSha256}.pdf`,
    createdBy: CREATED_BY,
    extractorVersion: parsedPdf.readerVersion
  });
  const workspace = rpcJson(`public.bidoc_contracts_upsert_workspace_r1(${jsonLiteral(workspacePayload)})`);
  const clausePayloads = buildContractsClausePayloads({
    generation,
    workspaceId: workspace.workspaceId,
    sourceProjectId: SOURCE_PROJECT_ID,
    extractorVersion: parsedPdf.readerVersion
  });
  insertClauses(clausePayloads);
  return { workspace, clausePayloads };
}

function databaseSnapshot(firstGenerationId, secondGenerationId) {
  const output = runSql(`
select jsonb_build_object(
  'workspaceCount', (select count(*) from private.contract_workspaces where workspace_version='contracts-workspace.r1.v1'),
  'firstClauseCount', (select count(*) from private.contracts_documents where parser_generation_id='${firstGenerationId}'),
  'secondClauseCount', (select count(*) from private.contracts_documents where parser_generation_id='${secondGenerationId}'),
  'firstUnchangedCount', (select count(*) from private.contracts_documents where parser_generation_id='${firstGenerationId}' and created_at=updated_at),
  'matchingSourceHashes', (
    select count(*)
    from private.contracts_documents first
    join private.contracts_documents second
      on second.clause_key=first.clause_key
     and second.document_version_id=first.document_version_id
     and second.parser_generation_id='${secondGenerationId}'
    where first.parser_generation_id='${firstGenerationId}'
      and first.raw_text_sha256=second.raw_text_sha256
  ),
  'decisionCount', (select count(*) from private.contracts),
  'relationshipCount', (select count(*) from private.contract_relationships),
  'scheduleMilestones', (select count(*) from public.schedule_contract_milestones),
  'scheduleConditions', (select count(*) from public.schedule_contract_conditions),
  'scheduleExtensions', (select count(*) from public.schedule_contract_extensions),
  'sourceDecisionColumns', (
    select count(*) from information_schema.columns
    where table_schema='public'
      and table_name in ('schedule_contract_milestones','schedule_contract_conditions','schedule_contract_extensions')
      and column_name='source_contract_decision_id'
  )
);
`);
  return JSON.parse(output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean).at(-1));
}

async function main() {
  const pdfPath = path.resolve(args.pdf);
  const pdfBytes = fs.readFileSync(pdfPath);
  const documentSha256 = crypto.createHash("sha256").update(pdfBytes).digest("hex");
  const gold = JSON.parse(fs.readFileSync(GOLD, "utf8"));
  assert.equal(documentSha256, String(gold.document.sha256).toLowerCase(), "The PDF is not the approved Herzliya fixture.");

  const parsedPdf = await readContractPdf({ pdfBytes });
  const input = {
    pages: parsedPdf.pages,
    documentVersionId: `sha256:${documentSha256}`,
    documentSha256
  };
  const first = buildContractsClauseGeneration(input);
  const rerun = buildContractsClauseGeneration(input);
  const second = buildContractsClauseGeneration({
    ...input,
    parserPolicyVersion: `${CONTRACTS_CLAUSE_PARSER_POLICY_VERSION}.fixture-v2`
  });

  assert.equal(first.coverageLedger.accepted, true);
  assert.equal(first.coverageLedger.accountedSourceLineCount, first.coverageLedger.sourceLineCount);
  assert.equal(first.coverageLedger.numberedSourceCount, 173);
  assert.equal(first.coverageLedger.storedLogicalCount, 189);
  assert.equal(first.coverageLedger.appendixItemCount, 13);
  assert.equal(first.coverageLedger.crossPageCount, 8);
  assert.deepEqual(first.coverageLedger.errors, []);
  assert.deepEqual(first.semanticDecisions, []);
  assert.equal(first.parserGenerationId, rerun.parserGenerationId);
  assert.notEqual(first.parserGenerationId, second.parserGenerationId);
  assert.deepEqual(
    first.clauses.map((clause) => [clause.clauseKey, clause.rawTextSha256]),
    second.clauses.map((clause) => [clause.clauseKey, clause.rawTextSha256])
  );

  assertDedicatedHealthyContainer();
  resetAndApplyR1();
  try {
    const firstPersist = persistGeneration({
      generation: first,
      parsedPdf,
      pdfBytes,
      filename: path.basename(pdfPath)
    });
    assert.equal(firstPersist.workspace.inserted, true);

    const firstRerun = persistGeneration({
      generation: rerun,
      parsedPdf,
      pdfBytes,
      filename: path.basename(pdfPath)
    });
    assert.equal(firstRerun.workspace.workspaceId, firstPersist.workspace.workspaceId);
    assert.equal(firstRerun.workspace.reused, true);

    const secondPersist = persistGeneration({
      generation: second,
      parsedPdf,
      pdfBytes,
      filename: path.basename(pdfPath)
    });
    assert.equal(secondPersist.workspace.inserted, true);
    assert.notEqual(secondPersist.workspace.workspaceId, firstPersist.workspace.workspaceId);

    const snapshot = databaseSnapshot(first.parserGenerationId, second.parserGenerationId);
    assert.deepEqual(snapshot, {
      workspaceCount: 2,
      firstClauseCount: 189,
      secondClauseCount: 189,
      firstUnchangedCount: 189,
      matchingSourceHashes: 189,
      decisionCount: 0,
      relationshipCount: 0,
      scheduleMilestones: 0,
      scheduleConditions: 0,
      scheduleExtensions: 0,
      sourceDecisionColumns: 0
    });

    process.stdout.write(`${JSON.stringify({
      result: "Contracts clause parser R2 local fixture passed",
      documentSha256,
      pageCount: first.coverageLedger.pageCount,
      sourceLineCount: first.coverageLedger.sourceLineCount,
      numberedSourceCount: first.coverageLedger.numberedSourceCount,
      storedLogicalCount: first.coverageLedger.storedLogicalCount,
      appendixItemCount: first.coverageLedger.appendixItemCount,
      contextCount: first.coverageLedger.contextCount,
      crossPageCount: first.coverageLedger.crossPageCount,
      firstParserGenerationId: first.parserGenerationId,
      secondParserGenerationId: second.parserGenerationId,
      database: snapshot,
      remoteWrites: 0,
      modelCalls: 0
    }, null, 2)}\n`);
  } finally {
    resetAndApplyR1();
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--pdf") parsed.pdf = values[++index];
  }
  return parsed;
}

await main();
