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
const R4 = path.join(ROOT, "supabase", "migrations", "20260815182148_contracts_relationships_explicit_reference_r4_0.sql");
const R4_ROLLBACK = path.join(ROOT, "supabase", "rollbacks", "contracts_relationships_explicit_reference_r4_0.rollback.sql");
const SOURCE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const REVIEWER_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_SHA256 = "d".repeat(64);
const POLICY = "contracts-relationships-explicit-reference.r4.0.v1";

function runDocker(args, { input = null, allowFailure = false, quiet = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    input,
    maxBuffer: 32 * 1024 * 1024
  });
  if (!allowFailure && result.status !== 0) {
    throw new Error([`docker ${args.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  if (!quiet && result.stdout.trim()) process.stdout.write(result.stdout);
  return result;
}

function assertDedicatedHealthyContainer() {
  const result = runDocker([
    "inspect", "--format", "{{.Name}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}", CONTAINER
  ], { quiet: true });
  assert.equal(result.stdout.trim(), `/${CONTAINER}|true|healthy`);
}

function copyAndRunSql(localPath, containerPath) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ], { quiet: true });
}

function resetAndApply() {
  copyAndRunSql(CLEANUP, "/tmp/contracts-r4-cleanup.sql");
  copyAndRunSql(BASELINE, "/tmp/contracts-r4-baseline.sql");
  copyAndRunSql(WORKSPACES, "/tmp/contracts-r4-workspaces.sql");
  copyAndRunSql(R1, "/tmp/contracts-r4-r1.sql");
  copyAndRunSql(R3, "/tmp/contracts-r4-r3.sql");
  copyAndRunSql(R3_2, "/tmp/contracts-r4-r3-2.sql");
  copyAndRunSql(R4, "/tmp/contracts-r4.sql");
}

function runSql(sql, { allowFailure = false } = {}) {
  return runDocker([
    "exec", "-i", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-U", "postgres", "-d", "postgres"
  ], { input: sql, allowFailure, quiet: true });
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  if (json.includes("$r4json$")) throw new Error("Fixture JSON contains the SQL delimiter.");
  return `$r4json$${json}$r4json$::jsonb`;
}

function parseJson(output) {
  const line = output.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean).at(-1);
  return JSON.parse(line);
}

function rpc(functionCall) {
  return parseJson(runSql(`set role service_role;\nselect ${functionCall};\n`).stdout);
}

async function buildFixture() {
  const generation = buildContractsClauseGeneration({
    pages: [{
      pdfPage: 1,
      text: "1. הוראות כלליות\n1.1. הקבלן יבצע את העבודה בהתאם להסכם.\n2. הודעות\n2.1. הודעה תימסר בכתב לפי סעיף 1.1 ולפי נספח ג׳."
    }],
    documentVersionId: `sha256:${DOCUMENT_SHA256}`,
    documentSha256: DOCUMENT_SHA256
  });
  const enrichment = await runContractsClauseEnrichment({
    generation,
    config: {
      openRouterApiKey: "fixture-only",
      models: { main: "fixture/contracts-r4" },
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
    projectSite: "R4.0 local fixture",
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

function assertSourceContract() {
  const migration = fs.readFileSync(R4, "utf8");
  assert.doesNotMatch(migration, /security\s+definer/iu);
  assert.doesNotMatch(migration, /(?:insert\s+into|update|delete\s+from)\s+public\.schedule_/iu);
  assert.match(migration, /bidoc_contracts_append_relationship_r1\(\s*0/iu);
  assert.match(migration, /pg_advisory_xact_lock/iu);
  assert.match(migration, /grant execute[\s\S]*to service_role/iu);
}

async function main() {
  assertSourceContract();
  assertDedicatedHealthyContainer();
  resetAndApply();
  try {
    runSql(fs.readFileSync(R4_ROLLBACK, "utf8"));
    const removed = runSql("select public.bidoc_contracts_relationships_status_r4_0();", { allowFailure: true });
    assert.notEqual(removed.status, 0);
    copyAndRunSql(R4, "/tmp/contracts-r4-reapply.sql");
    const status = rpc("public.bidoc_contracts_relationships_status_r4_0()");
    assert.equal(status.migrationVersion, "20260815182148");

    const data = await buildFixture();
    const clauseResult = rpc(
      `public.bidoc_contracts_persist_clause_generation_r3_2(${sqlJson(data.workspace)},${sqlJson(data.clauses)},${sqlJson(data.enrichments)},'${REVIEWER_ID}'::uuid)`
    );
    const workspaceId = clauseResult.workspace.workspaceId;
    const before = rpc(`public.bidoc_contracts_get_relationships_r4_0('${workspaceId}'::uuid,'${POLICY}')`);
    assert.equal(before.items.length, 0);
    assert.equal(before.metrics.explicitReferenceCount, 2);
    assert.equal(before.metrics.unresolvedReferenceCount, 1);

    const first = rpc(`public.bidoc_contracts_persist_explicit_relationships_r4_0('${workspaceId}'::uuid,'${POLICY}')`);
    assert.equal(first.persistence.atomic, true);
    assert.equal(first.persistence.inserted, 1);
    assert.equal(first.persistence.reused, 0);
    assert.equal(first.items.length, 1);
    assert.equal(first.metrics.explicitReferenceCount, 2);
    assert.equal(first.metrics.explicitRelationshipCount, 1);
    assert.equal(first.metrics.unresolvedReferenceCount, 1);
    assert.equal(first.metrics.modelRelationshipCount, 0);
    assert.equal(first.metrics.decisionCount, 0);
    assert.equal(first.metrics.scheduleWriteCount, 0);
    assert.equal(first.items[0].relationshipType, "cross_reference");
    assert.equal(first.items[0].origin, "explicit_reference");
    assert.equal(first.items[0].confidence, null);
    assert.equal(first.items[0].reviewStatus, "proposed");
    assert.equal(first.items[0].evidence.excerpts.length, 2);
    assert.equal(first.items[0].evidence.signals.semanticConclusion, false);

    const second = rpc(`public.bidoc_contracts_persist_explicit_relationships_r4_0('${workspaceId}'::uuid,'${POLICY}')`);
    assert.equal(second.persistence.inserted, 0);
    assert.equal(second.persistence.reused, 1);
    assert.equal(second.items.length, 1);

    const database = parseJson(runSql(`select jsonb_build_object(
      'decisions', (select count(*) from private.contracts),
      'relationships', (select count(*) from private.contract_relationships),
      'scheduleMilestones', (select count(*) from public.schedule_contract_milestones),
      'scheduleConditions', (select count(*) from public.schedule_contract_conditions),
      'scheduleExtensions', (select count(*) from public.schedule_contract_extensions)
    );`).stdout);
    assert.deepEqual(database, {
      decisions: 0,
      relationships: 1,
      scheduleMilestones: 0,
      scheduleConditions: 0,
      scheduleExtensions: 0
    });

    const denied = runSql("set role authenticated; select public.bidoc_contracts_relationships_status_r4_0();", { allowFailure: true });
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /permission denied/iu);

    const refused = runSql(fs.readFileSync(R4_ROLLBACK, "utf8"), { allowFailure: true });
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /rollback refused while explicit-reference relationship proposals exist/iu);

    process.stdout.write(`${JSON.stringify({
      result: "Contracts R4.0 explicit-reference database fixture passed",
      workspaceId,
      sourceReferences: first.metrics.explicitReferenceCount,
      canonicalRelationships: first.metrics.explicitRelationshipCount,
      unresolvedReferences: first.metrics.unresolvedReferenceCount,
      firstRun: first.persistence,
      secondRun: second.persistence,
      database,
      remoteWrites: 0,
      externalModelCalls: 0,
      scheduleWrites: 0
    }, null, 2)}\n`);
  } finally {
    resetAndApply();
  }
}

await main();
