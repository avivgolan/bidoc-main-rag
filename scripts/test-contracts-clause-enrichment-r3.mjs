import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
  CONTRACTS_CLAUSE_ENRICHMENT_POLICY_VERSION,
  CONTRACTS_CLAUSE_ENRICHMENT_PROMPT_VERSION,
  buildContractsClauseEnrichmentRpcPayload,
  buildContractsClauseIndexRecord,
  buildContractsClauseIndexRef,
  runContractsClauseEnrichment
} from "../src/contracts/clauseEnrichment.js";
import {
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
const R3_MIGRATION = path.join(ROOT, "supabase", "migrations", "20260815153955_contracts_pipeline_r3_clause_enrichment.sql");
const GOLD = path.join(ROOT, "docs", "Indicator + Contracts", "gold-set", "sample-herzliya-contract.annotation.json");
const SOURCE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_BY = "44444444-4444-4444-8444-444444444444";
const STORAGE_BUCKET = "contracts-r3-local-fixture";
const FIXTURE_MODEL = "fixture/contracts-hebrew-enrichment-v1";

const args = parseArgs(process.argv.slice(2));
if (!args.pdf) {
  process.stderr.write("Usage: npm.cmd run test:contracts:r3-db -- --pdf <approved-herzliya.pdf>\n");
  process.exit(2);
}

function runDocker(arguments_, { input = null, quiet = false } = {}) {
  const result = spawnSync("docker", arguments_, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    input,
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error([`docker ${arguments_.join(" ")} failed`, result.stdout, result.stderr].filter(Boolean).join("\n"));
  }
  if (!quiet && result.stdout.trim()) process.stdout.write(result.stdout);
  if (!quiet && result.stderr.trim()) process.stderr.write(result.stderr);
  return result.stdout;
}

function assertDedicatedHealthyContainer() {
  const state = runDocker([
    "inspect", "--format", "{{.Name}}|{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}", CONTAINER
  ], { quiet: true }).trim();
  assert.equal(state, `/${CONTAINER}|true|healthy`, `Refusing R3 database fixture reset outside the healthy dedicated container: ${state}`);
}

function copyAndRunSql(localPath, containerPath) {
  runDocker(["cp", localPath, `${CONTAINER}:${containerPath}`], { quiet: true });
  runDocker([
    "exec", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", containerPath
  ], { quiet: true });
}

function resetAndApplyR3() {
  copyAndRunSql(CLEANUP, "/tmp/contracts-r3-cleanup.sql");
  copyAndRunSql(BASELINE, "/tmp/contracts-r3-baseline.sql");
  copyAndRunSql(WORKSPACES, "/tmp/contracts-r3-workspaces.sql");
  copyAndRunSql(R1_MIGRATION, "/tmp/contracts-r3-r1-migration.sql");
  copyAndRunSql(R3_MIGRATION, "/tmp/contracts-r3-migration.sql");
}

function runSql(sql) {
  return runDocker([
    "exec", "-i", CONTAINER,
    "psql", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-U", "postgres", "-d", "postgres"
  ], { input: sql, quiet: true }).trim();
}

function sqlJson(value) {
  const json = JSON.stringify(value);
  if (json.includes("$r3json$")) throw new Error("R3 fixture JSON contains the SQL delimiter.");
  return `$r3json$${json}$r3json$::jsonb`;
}

function parseLastJson(output) {
  const line = output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean).at(-1);
  return JSON.parse(line);
}

function rpcJson(functionCall) {
  return parseLastJson(runSql(`set role service_role;\nselect ${functionCall};\n`));
}

function applyRpcArray(functionName, payloads) {
  return parseLastJson(runSql(`
set role service_role;
select coalesce(jsonb_agg(result order by ordinal), '[]'::jsonb)
from (
  select ordinal, ${functionName}(payload) as result
  from jsonb_array_elements(${sqlJson(payloads)}) with ordinality values_(payload, ordinal)
) applied;
`));
}

function persistSourceGeneration({ generation, enrichment, pdfBytes, filename }) {
  const workspacePayload = buildContractsClauseWorkspacePayload({
    generation,
    sourceProjectId: SOURCE_PROJECT_ID,
    filename,
    byteCount: pdfBytes.length,
    storageBucket: STORAGE_BUCKET,
    storageObjectKey: `sha256/${generation.documentSha256}.pdf`,
    createdBy: CREATED_BY,
    extractorVersion: enrichment.enrichmentGenerationId,
    promptVersion: enrichment.promptVersion,
    extractionVersion: enrichment.agentVersion,
    enrichmentIdentity: enrichment.generationFingerprintInput
  });
  const workspace = rpcJson(`public.bidoc_contracts_upsert_workspace_r1(${sqlJson(workspacePayload)})`);
  const clausePayloads = buildContractsClausePayloads({
    generation,
    workspaceId: workspace.workspaceId,
    sourceProjectId: SOURCE_PROJECT_ID,
    extractorVersion: enrichment.enrichmentGenerationId
  });
  const clauses = applyRpcArray("public.bidoc_contracts_insert_clause_r1", clausePayloads);
  return { workspace, clauses };
}

function buildEnrichmentPayloads({ enrichment, persisted }) {
  const clauseIdByKey = new Map(persisted.clauses.map((item) => [item.clauseKey, item.clauseId]));
  return enrichment.clauses.map((clause) => {
    const clauseId = clauseIdByKey.get(clause.clauseKey);
    assert.ok(clauseId, `Missing persisted clause ID for ${clause.clauseKey}`);
    const indexRecord = buildContractsClauseIndexRecord({ clause, clauseId, sourceProjectId: SOURCE_PROJECT_ID });
    const indexRef = buildContractsClauseIndexRef({
      provider: "local_fixture_shared_index",
      recordId: clauseId,
      content: indexRecord.index_text,
      metadata: {
        schemaVersion: indexRecord.schema_version,
        sourceTable: indexRecord.source_table,
        fixtureOnly: true
      }
    });
    return buildContractsClauseEnrichmentRpcPayload({
      clause,
      workspaceId: persisted.workspace.workspaceId,
      indexRef
    });
  });
}

function fixtureSummary(rawText) {
  const normalized = String(rawText || "").replace(/\s+/gu, " ").trim();
  return `תקציר מקור לבדיקת העשרה: ${normalized}`.slice(0, 680).trim();
}

function fixtureTags(clause) {
  const text = String(clause.rawText || "");
  if (clause.clauseType === "document_context") return ["document_context"];
  if (clause.clauseType === "appendix_item") return ["appendix"];
  if (/תשל|חשבון|כספ|payment/iu.test(text)) return ["payment"];
  if (/מועד|לוח\s+זמנים|איחור|delay|schedule/iu.test(text)) return ["schedule"];
  if (/הודע|מסיר|notice/iu.test(text)) return ["notice"];
  if (/ערבות|bond/iu.test(text)) return ["bond"];
  if (/ביטוח|insurance/iu.test(text)) return ["insurance"];
  return ["scope"];
}

function fixtureModel(counter) {
  return async ({ messages }) => {
    counter.calls += 1;
    const input = JSON.parse(messages[1].content);
    return JSON.stringify({
      schemaVersion: CONTRACTS_CLAUSE_ENRICHMENT_MODEL_SCHEMA_VERSION,
      items: input.clauses.map((clause) => ({
        clauseKey: clause.clauseKey,
        summaryHe: fixtureSummary(clause.rawText),
        tags: fixtureTags(clause)
      }))
    });
  };
}

function workspaceTimestamps(workspaceId) {
  return parseLastJson(runSql(`
select coalesce(jsonb_object_agg(clause_key, updated_at::text order by clause_key), '{}'::jsonb)
from private.contracts_documents
where workspace_id='${workspaceId}'::uuid;
`));
}

function databaseSnapshot(firstWorkspaceId, secondWorkspaceId) {
  return parseLastJson(runSql(`
select jsonb_build_object(
  'workspaceCount', (select count(*) from private.contract_workspaces where workspace_version='contracts-workspace.r1.v1'),
  'firstProcessed', (select count(*) from private.contracts_documents where workspace_id='${firstWorkspaceId}'::uuid and processing_status='processed'),
  'secondProcessed', (select count(*) from private.contracts_documents where workspace_id='${secondWorkspaceId}'::uuid and processing_status='processed'),
  'summaries', (select count(*) from private.contracts_documents where summary_he is not null),
  'tagged', (select count(*) from private.contracts_documents where cardinality(hashtags) > 0),
  'contentRows', (select count(*) from private.contracts_documents where content is not null),
  'indexRefs', (select count(*) from private.contracts_documents where index_ref is not null),
  'matchingSourceHashes', (
    select count(*) from private.contracts_documents first
    join private.contracts_documents second on second.clause_key=first.clause_key
    where first.workspace_id='${firstWorkspaceId}'::uuid
      and second.workspace_id='${secondWorkspaceId}'::uuid
      and first.raw_text_sha256=second.raw_text_sha256
  ),
  'decisionCount', (select count(*) from private.contracts),
  'relationshipCount', (select count(*) from private.contract_relationships),
  'scheduleMilestones', (select count(*) from public.schedule_contract_milestones),
  'scheduleConditions', (select count(*) from public.schedule_contract_conditions),
  'scheduleExtensions', (select count(*) from public.schedule_contract_extensions)
);
`));
}

async function main() {
  const pdfPath = path.resolve(args.pdf);
  const pdfBytes = fs.readFileSync(pdfPath);
  const documentSha256 = crypto.createHash("sha256").update(pdfBytes).digest("hex");
  const gold = JSON.parse(fs.readFileSync(GOLD, "utf8"));
  assert.equal(documentSha256, String(gold.document.sha256).toLowerCase(), "The PDF is not the approved Herzliya fixture.");

  const parsedPdf = await readContractPdf({ pdfBytes });
  const generation = buildContractsClauseGeneration({
    pages: parsedPdf.pages,
    documentVersionId: `sha256:${documentSha256}`,
    documentSha256
  });
  assert.equal(generation.coverageLedger.accepted, true);
  assert.equal(generation.clauses.length, 189);

  const firstCounter = { calls: 0 };
  const first = await runContractsClauseEnrichment({
    generation,
    config: {
      openRouterApiKey: "fixture-only",
      models: { main: FIXTURE_MODEL },
      ai: { main: { maxTokens: 1600, timeoutMs: 30_000 } }
    },
    chatComplete: fixtureModel(firstCounter)
  });
  assert.equal(first.qualityLedger.clauseCount, 189);
  assert.equal(first.qualityLedger.sourceHashMatchCount, 189);
  assert.equal(first.qualityLedger.modelBatchCount, firstCounter.calls);
  assert.deepEqual(first.semanticDecisions, []);
  assert.deepEqual(first.canonicalRelationships, []);

  const reuseCounter = { calls: 0 };
  const reused = await runContractsClauseEnrichment({
    generation,
    existingEnrichments: first.clauses,
    modelVersion: FIXTURE_MODEL,
    config: {},
    chatComplete: fixtureModel(reuseCounter)
  });
  assert.equal(reuseCounter.calls, 0);
  assert.equal(reused.qualityLedger.reusedClauseCount, 189);
  assert.equal(reused.qualityLedger.modelEnrichedClauseCount, 0);

  const secondCounter = { calls: 0 };
  const second = await runContractsClauseEnrichment({
    generation,
    enrichmentPolicyVersion: `${CONTRACTS_CLAUSE_ENRICHMENT_POLICY_VERSION}.fixture-v2`,
    config: {
      openRouterApiKey: "fixture-only",
      models: { main: FIXTURE_MODEL },
      ai: { main: { maxTokens: 1600, timeoutMs: 30_000 } }
    },
    chatComplete: fixtureModel(secondCounter)
  });
  assert.notEqual(first.enrichmentGenerationId, second.enrichmentGenerationId);
  assert.deepEqual(
    first.clauses.map((clause) => [clause.clauseKey, clause.rawTextSha256]),
    second.clauses.map((clause) => [clause.clauseKey, clause.rawTextSha256])
  );

  assertDedicatedHealthyContainer();
  resetAndApplyR3();
  try {
    const firstPersisted = persistSourceGeneration({ generation, enrichment: first, pdfBytes, filename: path.basename(pdfPath) });
    const firstPayloads = buildEnrichmentPayloads({ enrichment: first, persisted: firstPersisted });
    const firstApplied = applyRpcArray("public.bidoc_contracts_apply_clause_enrichment_r3", firstPayloads);
    assert.equal(firstApplied.filter((item) => item.inserted).length, 189);
    const beforeRerun = workspaceTimestamps(firstPersisted.workspace.workspaceId);
    const firstReapplied = applyRpcArray("public.bidoc_contracts_apply_clause_enrichment_r3", firstPayloads);
    assert.equal(firstReapplied.filter((item) => item.reused).length, 189);
    assert.deepEqual(workspaceTimestamps(firstPersisted.workspace.workspaceId), beforeRerun);

    const secondPersisted = persistSourceGeneration({ generation, enrichment: second, pdfBytes, filename: path.basename(pdfPath) });
    assert.notEqual(secondPersisted.workspace.workspaceId, firstPersisted.workspace.workspaceId);
    const secondPayloads = buildEnrichmentPayloads({ enrichment: second, persisted: secondPersisted });
    const secondApplied = applyRpcArray("public.bidoc_contracts_apply_clause_enrichment_r3", secondPayloads);
    assert.equal(secondApplied.filter((item) => item.inserted).length, 189);

    const snapshot = databaseSnapshot(firstPersisted.workspace.workspaceId, secondPersisted.workspace.workspaceId);
    assert.deepEqual(snapshot, {
      workspaceCount: 2,
      firstProcessed: 189,
      secondProcessed: 189,
      summaries: 378,
      tagged: 378,
      contentRows: 378,
      indexRefs: 378,
      matchingSourceHashes: 189,
      decisionCount: 0,
      relationshipCount: 0,
      scheduleMilestones: 0,
      scheduleConditions: 0,
      scheduleExtensions: 0
    });

    process.stdout.write(`${JSON.stringify({
      result: "Contracts clause enrichment R3 local fixture passed",
      documentSha256,
      pageCount: generation.coverageLedger.pageCount,
      clauseCount: first.qualityLedger.clauseCount,
      referenceCount: first.qualityLedger.referenceCount,
      resolvedReferenceCount: first.qualityLedger.resolvedReferenceCount,
      unresolvedReferenceCount: first.qualityLedger.unresolvedReferenceCount,
      firstModelCalls: firstCounter.calls,
      sameGenerationRerunModelCalls: reuseCounter.calls,
      secondModelCalls: secondCounter.calls,
      firstEnrichmentGenerationId: first.enrichmentGenerationId,
      secondEnrichmentGenerationId: second.enrichmentGenerationId,
      database: snapshot,
      remoteWrites: 0,
      externalModelCalls: 0,
      fixtureModelCalls: firstCounter.calls + secondCounter.calls
    }, null, 2)}\n`);
  } finally {
    resetAndApplyR3();
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
