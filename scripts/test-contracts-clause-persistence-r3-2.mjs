import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
  buildContractsClauseEnrichmentRpcPayload,
  runContractsClauseEnrichment
} from "../src/contracts/clauseEnrichment.js";
import {
  buildContractsClauseGeneration,
  buildContractsClauseWorkspacePayload
} from "../src/contracts/clauseParser.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "supabase_db_bidoc-main-rag";
const CLEANUP = path.join(ROOT, "supabase", "tests", "contracts-phase3-cleanup.sql");
const BASELINE = path.join(ROOT, "supabase", "tests", "contracts-phase2-existing-schedule-baseline.sql");
const WORKSPACES = path.join(ROOT, "supabase", "migrations", "20260812135210_contracts_phase3f1_saved_workspaces.sql");
const R1 = path.join(ROOT, "supabase", "migrations", "20260815103618_contracts_pipeline_r1_schema_lock.sql");
const R3 = path.join(ROOT, "supabase", "migrations", "20260815153955_contracts_pipeline_r3_clause_enrichment.sql");
const R3_2 = path.join(ROOT, "supabase", "migrations", "20260815180207_contracts_pipeline_r3_2_clause_persistence.sql");
const R3_2_ROLLBACK = path.join(ROOT, "supabase", "rollbacks", "contracts_pipeline_r3_2_clause_persistence.rollback.sql");
const SOURCE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const REVIEWER_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_SHA256 = "a".repeat(64);

function runDocker(args, { input = null, quiet = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    input,
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error([`docker ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  if (!quiet && result.stdout.trim()) process.stdout.write(result.stdout);
  return result.stdout;
}

function assertDedicatedHealthyContainer() {
  const state = runDocker([
    "inspect", "--format", "{{.Name}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}", CONTAINER
  ], { quiet: true }).trim();
  assert.equal(state, `/${CONTAINER}|true|healthy`);
}

function copyAndRunSql(localPath, containerPath) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ], { quiet: true });
}

function resetAndApply() {
  copyAndRunSql(CLEANUP, "/tmp/contracts-r3-2-cleanup.sql");
  copyAndRunSql(BASELINE, "/tmp/contracts-r3-2-baseline.sql");
  copyAndRunSql(WORKSPACES, "/tmp/contracts-r3-2-workspaces.sql");
  copyAndRunSql(R1, "/tmp/contracts-r3-2-r1.sql");
  copyAndRunSql(R3, "/tmp/contracts-r3-2-r3.sql");
  copyAndRunSql(R3_2, "/tmp/contracts-r3-2.sql");
}

function runSql(sql, { allowFailure = false } = {}) {
  const result = spawnSync("docker", [
    "exec", "-i", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-U", "postgres", "-d", "postgres"
  ], { cwd: ROOT, encoding: "utf8", windowsHide: true, input: sql, maxBuffer: 32 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) {
    throw new Error(["R3.2 SQL failed", result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  return result;
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  if (json.includes("$r32json$")) throw new Error("Fixture JSON contains the SQL delimiter.");
  return `$r32json$${json}$r32json$::jsonb`;
}

function parseJson(output) {
  const line = output.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).at(-1);
  return JSON.parse(line);
}

function rpc(functionCall) {
  return parseJson(runSql(`set role service_role;\nselect ${functionCall};\n`).stdout);
}

async function fixture() {
  const generation = buildContractsClauseGeneration({
    pages: [
      { pdfPage: 1, text: "1. הוראות כלליות\n1.1. הקבלן יבצע את העבודה בהתאם להסכם.\n2. הודעות\n2.1. הודעה תימסר בכתב לפי סעיף 1.1." }
    ],
    documentVersionId: `sha256:${DOCUMENT_SHA256}`,
    documentSha256: DOCUMENT_SHA256
  });
  const enrichment = await runContractsClauseEnrichment({
    generation,
    config: {
      openRouterApiKey: "fixture-only",
      models: { main: "fixture/contracts-r3-2" },
      ai: { main: { maxTokens: 1600, timeoutMs: 30_000 } }
    },
    chatComplete: async ({ messages }) => {
      const input = JSON.parse(messages[1].content);
      return JSON.stringify({
        schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
        items: input.clauses.map((clause) => ({
          clauseKey: clause.clauseKey,
          summaryHe: `הסעיף מתאר הוראה חוזית המבוססת על המקור ${clause.clauseKey}.`,
          tags: clause.clauseKey === "2.1" ? ["notice"] : ["scope"]
        }))
      });
    }
  });
  const workspace = buildContractsClauseWorkspacePayload({
    generation,
    sourceProjectId: SOURCE_PROJECT_ID,
    projectSite: "R3.2 local fixture",
    filename: "fixture.pdf",
    byteCount: 100,
    storageBucket: "contracts-private",
    storageObjectKey: `${SOURCE_PROJECT_ID}/${DOCUMENT_SHA256}.pdf`,
    createdBy: REVIEWER_ID,
    extractorVersion: enrichment.enrichmentGenerationId,
    promptVersion: enrichment.promptVersion,
    extractionVersion: enrichment.agentVersion,
    enrichmentIdentity: enrichment.generationFingerprintInput
  });
  workspace.extraction.enrichmentQualityLedger = enrichment.qualityLedger;
  workspace.extraction.previewVersion = "contracts-clause-preview.r3.1.v1";
  workspace.extraction.persistenceVersion = "contracts-clause-persistence.r3.2.v1";
  const clauses = generation.clauses.map((clause) => ({
    sourceProjectId: SOURCE_PROJECT_ID,
    documentVersionId: generation.documentVersionId,
    documentSha256: generation.documentSha256,
    parserGenerationId: generation.parserGenerationId,
    clauseKey: clause.clauseKey,
    parentClauseKey: clause.parentClauseKey,
    clauseType: clause.clauseType,
    clauseTitle: clause.clauseTitle,
    clauseOrder: clause.clauseOrder,
    pageStart: clause.pageStart,
    pageEnd: clause.pageEnd,
    rawText: clause.rawText,
    rawTextSha256: clause.rawTextSha256,
    rawData: clause.rawData,
    parserVersion: generation.parserVersion,
    extractorVersion: enrichment.enrichmentGenerationId
  }));
  const enrichments = enrichment.clauses.map((clause) => {
    const payload = buildContractsClauseEnrichmentRpcPayload({
      clause,
      workspaceId: "00000000-0000-4000-8000-000000000000",
      indexRef: null
    });
    delete payload.workspaceId;
    return payload;
  });
  return { generation, enrichment, workspace, clauses, enrichments };
}

async function main() {
  assertDedicatedHealthyContainer();
  resetAndApply();
  try {
    const data = await fixture();
    const call = `public.bidoc_contracts_persist_clause_generation_r3_2(${sqlJson(data.workspace)},${sqlJson(data.clauses)},${sqlJson(data.enrichments)},'${REVIEWER_ID}'::uuid)`;
    const first = rpc(call);
    assert.equal(first.preview.persisted, true);
    assert.equal(first.preview.clauses.length, data.generation.clauses.length);
    assert.equal(first.persistence.clausesInserted, data.generation.clauses.length);
    assert.equal(first.persistence.enrichmentsInserted, data.generation.clauses.length);
    assert.deepEqual(first.preview.semanticDecisions, []);
    assert.deepEqual(first.preview.canonicalRelationships, []);

    const second = rpc(call);
    assert.equal(second.persistence.workspaceReused, true);
    assert.equal(second.persistence.clausesReused, data.generation.clauses.length);
    assert.equal(second.persistence.enrichmentsReused, data.generation.clauses.length);

    const workspaceId = second.workspace.workspaceId;
    const found = rpc(`public.bidoc_contracts_find_clause_workspace_r3_2('${SOURCE_PROJECT_ID}'::uuid,'${DOCUMENT_SHA256}','${data.generation.parserGenerationId}','${data.enrichment.enrichmentGenerationId}')`);
    const opened = rpc(`public.bidoc_contracts_get_clause_workspace_r3_2('${workspaceId}'::uuid)`);
    const listed = rpc(`public.bidoc_contracts_list_clause_workspaces_r3_2('${SOURCE_PROJECT_ID}'::uuid,50)`);
    assert.equal(found.workspace.workspaceId, workspaceId);
    assert.equal(opened.preview.clauses.length, data.generation.clauses.length);
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0].clauseCount, data.generation.clauses.length);

    const snapshot = parseJson(runSql(`select jsonb_build_object(
      'workspaces', (select count(*) from private.contract_workspaces where workspace_version='contracts-workspace.r1.v1'),
      'clauses', (select count(*) from private.contracts_documents),
      'processed', (select count(*) from private.contracts_documents where processing_status='processed'),
      'decisions', (select count(*) from private.contracts),
      'relationships', (select count(*) from private.contract_relationships),
      'scheduleMilestones', (select count(*) from public.schedule_contract_milestones),
      'scheduleConditions', (select count(*) from public.schedule_contract_conditions),
      'scheduleExtensions', (select count(*) from public.schedule_contract_extensions)
    );`).stdout);
    assert.deepEqual(snapshot, {
      workspaces: 1,
      clauses: data.generation.clauses.length,
      processed: data.generation.clauses.length,
      decisions: 0,
      relationships: 0,
      scheduleMilestones: 0,
      scheduleConditions: 0,
      scheduleExtensions: 0
    });

    const denied = runSql("set role authenticated; select public.bidoc_contracts_clause_persistence_status_r3_2();", { allowFailure: true });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /permission denied/iu);
    const refusedRollback = runSql(fs.readFileSync(R3_2_ROLLBACK, "utf8"), { allowFailure: true });
    assert.notEqual(refusedRollback.status, 0);
    assert.match(refusedRollback.stderr, /rollback refused while saved clause workspaces exist/iu);

    process.stdout.write(`${JSON.stringify({
      result: "Contracts R3.2 local database fixture passed",
      workspaceId,
      clauseCount: data.generation.clauses.length,
      firstInsert: first.persistence,
      secondRun: second.persistence,
      database: snapshot,
      remoteWrites: 0,
      externalModelCalls: 0
    }, null, 2)}\n`);
  } finally {
    resetAndApply();
  }
}

await main();
