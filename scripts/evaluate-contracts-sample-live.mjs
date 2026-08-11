import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, getConfig, initSettings } from "../src/config.js";
import { evaluateContractExtraction } from "../src/contracts/goldEvaluator.js";
import { CONTRACTS_EXTRACTION_BUDGET_MS, runContractsDryRun } from "../src/subagents/contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
if (!args.pdf) {
  console.error("Usage: npm run contracts:sample-live -- --pdf <sample.pdf>");
  process.exit(2);
}

const processStartedAt = Date.now();
const processSafetyTimer = setTimeout(() => {
  console.error(JSON.stringify({
    event: "contracts_live_process_force_exit",
    stage: "settings_or_extraction",
    durationMs: Date.now() - processStartedAt,
    extractionBudgetMs: CONTRACTS_EXTRACTION_BUDGET_MS
  }));
  process.exit(124);
}, CONTRACTS_EXTRACTION_BUDGET_MS + 30_000);

loadEnv();
console.error(JSON.stringify({ event: "contracts_live_stage", stage: "settings_loading" }));
await initSettings();
console.error(JSON.stringify({ event: "contracts_live_stage", stage: "settings_ready" }));
const config = getConfig();
if (!config.openRouterApiKey) {
  console.error("The configured Settings/OpenRouter credential is unavailable.");
  process.exit(2);
}

const pdfPath = path.resolve(args.pdf);
const goldPath = path.join(root, "docs", "Indicator + Contracts", "gold-set", "sample-herzliya-contract.annotation.json");
const expected = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const startedAt = Date.now();
const telemetry = [];
const controller = new AbortController();
const deadlineAt = startedAt + CONTRACTS_EXTRACTION_BUDGET_MS;
const abortTimer = setTimeout(() => controller.abort(new Error("Phase 1 live evaluation reached its total extraction budget.")), CONTRACTS_EXTRACTION_BUDGET_MS);
const forceExitTimer = setTimeout(() => {
  console.error(JSON.stringify({
    event: "contracts_live_force_exit",
    durationMs: Date.now() - startedAt,
    extractionBudgetMs: CONTRACTS_EXTRACTION_BUDGET_MS
  }));
  process.exit(124);
}, CONTRACTS_EXTRACTION_BUDGET_MS + 10_000);
let actual;
try {
  actual = await runContractsDryRun({
    pdfBytes: fs.readFileSync(pdfPath),
    filename: path.basename(pdfPath),
    projectSelection: {
      projectId: expected.projectBinding.projectId,
      projectSite: expected.projectBinding.candidateProjectSite,
      selectedByUser: true
    },
    config,
    deadlineAt,
    signal: controller.signal,
    emit: (event) => {
      telemetry.push(event);
      if (["contract_pdf_read", "contract_chunk_validated", "contract_model_call", "contract_dry_run_completed"].includes(event.event)) {
        console.error(JSON.stringify(event));
      }
    }
  });
} finally {
  clearTimeout(abortTimer);
  clearTimeout(forceExitTimer);
}
const report = evaluateContractExtraction({ expected, actual });
const result = {
  evaluationVersion: "contracts-sample-live.phase1.v1",
  evaluatedAt: new Date().toISOString(),
  model: config.models?.main || null,
  durationMs: Date.now() - startedAt,
  documentSha256: actual.document.sha256,
  outputSummary: {
    candidateCount: actual.summary.candidateCount,
    conflictCount: actual.summary.conflictCount,
    missingInformationCount: actual.summary.missingInformationCount,
    packetGapCount: actual.packetGaps.length,
    approvedScheduleProjectionCount: actual.summary.approvedScheduleProjectionCount,
    computedCompletionDate: actual.summary.computedCompletionDate
  },
  candidateDiagnostics: actual.candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    role: candidate.role,
    type: candidate.type,
    responsibleParty: candidate.responsibleParty,
    beneficiary: candidate.beneficiary,
    action: candidate.action,
    triggerKind: candidate.trigger?.kind || null,
    offset: candidate.offset,
    recurrence: candidate.recurrence,
    projection: candidate.projection,
    gates: candidate.gates,
    storageDisposition: candidate.storageDisposition,
    evidenceLocations: candidate.sourceEvidence.map((evidence) => ({ pdfPage: evidence.pdfPage, clause: evidence.clause }))
  })),
  missingInformationDiagnostics: actual.missingInformation,
  packetGapDiagnostics: actual.packetGaps,
  telemetry,
  report
};
console.log(JSON.stringify(result, null, 2));
clearTimeout(processSafetyTimer);
if (!report.passed) process.exit(1);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === "--pdf") parsed.pdf = values[++index];
  }
  return parsed;
}
