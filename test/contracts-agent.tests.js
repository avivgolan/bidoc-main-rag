import assert from "node:assert/strict";
import fs from "node:fs";
import { Readable } from "node:stream";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  ACTIVITY_MAPPING_BLOCKER,
  ACTIVITY_MAPPING_METHOD,
  ACTIVITY_MAPPING_STATUS,
  CONTRACTS_ACTIVITY_MAPPING_VERSION,
  buildContractActivityMappingCandidates,
  mappingAutomaticAlertEligible,
  reconcileConfirmedActivityAliases
} from "../src/contracts/activityMapping.js";
import {
  CONTRACTS_ACTIVITY_MAPPING_API_VERSION,
  CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC,
  assertNoClientDatabaseOverrides,
  buildContractActivityMappingCandidatesFromSources,
  loadContractActivityMappingState,
  parseActivityMappingCandidateRequest,
  parseActivityMappingListRequest
} from "../src/contracts/activityMappingService.js";
import {
  CONTRACTS_ACTIVITY_MAPPING_HISTORY_RPC,
  CONTRACTS_ACTIVITY_MAPPING_HISTORY_VERSION,
  CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION,
  CONTRACTS_ACTIVITY_MAPPING_REVIEW_RPC,
  contractsActivityMappingReviewApproved,
  listActivityMappingReviewHistory,
  parseActivityMappingHistoryRequest,
  parseActivityMappingReviewRequest,
  prepareActivityMappingReviewSubmission,
  submitActivityMappingReview
} from "../src/contracts/activityMappingReview.js";
import { compileContractDraft, findGroundedQuote } from "../src/contracts/compiler.js";
import { ContractsAgentError } from "../src/contracts/errors.js";
import { evaluateContractExtraction } from "../src/contracts/goldEvaluator.js";
import { planContractPromotions } from "../src/contracts/promotionPlanner.js";
import {
  buildContractPromotionSubmission,
  CONTRACTS_PROMOTION_RPC,
  CONTRACTS_PROMOTION_SUBMISSION_VERSION,
  submitContractPromotion
} from "../src/contracts/promotionWriter.js";
import { compileRepresentativeCases, evaluateRepresentativeCases } from "../src/contracts/representativeEvaluator.js";
import { readContractPdf, reconstructPdfPageText } from "../src/contracts/pdfReader.js";
import { parseContractExtractionRequest, readJsonBounded } from "../src/contracts/request.js";
import { contractsPhase2ApplyApproved, prepareContractReview } from "../src/contracts/reviewWorkflow.js";
import { CONTRACT_REVIEW_SUBMISSION_MODE, contractReviewSubmissionMode } from "../src/contracts/reviewMode.js";
import { sendContractsJson, serializeContractsResponse } from "../src/contracts/response.js";
import { contractExtractionSchemaErrors } from "../src/contracts/schema.js";
import {
  CONTRACTS_REVIEW_DRAFT_VERSION,
  CONTRACTS_WORKSPACE_MIGRATION_VERSION,
  CONTRACTS_WORKSPACE_VERSION,
  assertPrivateStorageBucket,
  contractPdfSha256,
  contractsExtractionFingerprint,
  findSavedContractWorkspace,
  loadContractsWorkspaceStatus,
  normalizeWorkspaceDraft,
  parseWorkspaceExtractionRequest,
  persistExtractedContractWorkspace,
  projectSavedContractExtractionResponse,
  saveContractWorkspaceDraft
} from "../src/contracts/workspacePersistence.js";
import {
  contractActionLabel,
  contractGateLabel,
  contractRoleLabel,
  contractsUiError,
  mappingBlockerLabel,
  mappingEvidenceKindLabel,
  promotionBlockerLabel,
  reviewPlanStatusLabel,
  storageDispositionLabel
} from "../src/react/contractsHebrew.js";
import { segmentContractPages } from "../src/contracts/segmenter.js";
import { chatCompletion } from "../src/openrouter.js";
import {
  CONTRACTS_EXTRACTION_BUDGET_MS,
  buildContractsModelMessages,
  chunkContractSegments,
  contractsModelChunkCharacterBudget,
  extractContractsModelDraft,
  mergeContractsModelDrafts,
  normalizeContractsModelDraftAliases,
  runContractsDryRun,
  safeContractTelemetry,
  selectContractExtractionSegments
} from "../src/subagents/contracts.js";

const FIXTURE_SHA = "a".repeat(64);
const MAPPING_SOURCE_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const MAPPING_SCHEDULE_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const MAPPING_PROJECT_LINK_ID = "33333333-3333-4333-8333-333333333333";
const MAPPING_FILE_V1 = "1776105870763_03.12.25.xml";
const MAPPING_FILE_V2 = "1781010000000_01.08.26.xml";
const MAPPING_CANONICAL_KEY = "schedule-activity:66666666-6666-4666-8666-666666666666";
const MAPPING_REVIEWER_ID = "44444444-4444-4444-8444-444444444444";
const MAPPING_REVIEW_REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const MAPPING_REVIEW_EVENT_ID = "77777777-7777-4777-8777-777777777777";

const activityMappingSchema = JSON.parse(fs.readFileSync(
  new URL(
    "../docs/Indicator%20+%20Contracts/schemas/contracts-activity-mapping.phase3.v1.schema.json",
    import.meta.url
  ),
  "utf8"
));
const activityMappingAjv = new Ajv2020({ strict: true, allErrors: true });
addFormats(activityMappingAjv);
const validateActivityMappingOutput = activityMappingAjv.compile(activityMappingSchema);

function mappingProjectContext(mappingStatus = "active") {
  return {
    sourceSystem: "main",
    sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
    scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
    projectMappingId: MAPPING_PROJECT_LINK_ID,
    mappingStatus
  };
}

function mappingScheduleVersion(fileId, overrides = {}) {
  return {
    fileId,
    relevancyDate: fileId === MAPPING_FILE_V1 ? "2026-07-01" : "2026-08-01",
    versionConflict: false,
    ...overrides
  };
}

function mappingTask(fileId, taskUid, name, overrides = {}) {
  return {
    activityKey: `gantt:${fileId}:${taskUid}`,
    taskUid,
    name,
    outlineLevel: 3,
    isSummary: false,
    isMilestone: false,
    plannedStart: "2026-08-10",
    plannedFinish: "2026-08-14",
    sourceVersionId: fileId,
    ...overrides
  };
}

function mappingObligation(overrides = {}) {
  return {
    documentVersionId: `sha256:${FIXTURE_SHA}`,
    candidateKey: "candidate:contract-completion",
    milestoneKey: null,
    label: "Complete structural framing",
    mappingRequirement: "required",
    conditionStatus: "not_applicable",
    triggerEvidenceReviewed: true,
    preferMilestone: false,
    preferredTaskUid: null,
    preferredActivityKey: null,
    preferredOutlineLevel: 3,
    activityTerms: ["structural", "framing"],
    sourceEvidence: [{
      evidenceId: "evidence:clause-7.2",
      sourceText: "The contractor shall complete the structural framing.",
      pdfPage: 12,
      clause: "7.2"
    }],
    ...overrides
  };
}

function confirmedActivityMapping(fileId = MAPPING_FILE_V1, overrides = {}) {
  return {
    canonicalKey: MAPPING_CANONICAL_KEY,
    alias: `gantt:${fileId}:17`,
    aliasSource: "gantt_activity_key",
    status: ACTIVITY_MAPPING_STATUS.MANUALLY_CONFIRMED,
    confidence: 0.98,
    matchMethod: ACTIVITY_MAPPING_METHOD.MANUAL_REVIEW,
    ...overrides
  };
}

function assertActivityMappingSchemaValid(output) {
  assert.equal(
    validateActivityMappingOutput(output),
    true,
    JSON.stringify(validateActivityMappingOutput.errors, null, 2)
  );
}

function activityMappingTestConfig() {
  return {
    contentSource: {
      supabaseUrl: "https://app-data.example.test",
      supabaseServiceRoleKey: "service-role-test-key"
    }
  };
}

function activityMappingSourceFetch(requests, { reviewResult = null, historyResult = null } = {}) {
  return async (url, options) => {
    requests.push({ url, options });
    let value;
    if (url.includes(`/rpc/${CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC}`)) {
      value = mappingProjectContext();
    } else if (url.includes(`/rpc/${CONTRACTS_ACTIVITY_MAPPING_REVIEW_RPC}`)) {
      const submission = JSON.parse(options.body).p_submission;
      value = reviewResult || {
        status: "recorded",
        eventKey: submission.eventKey,
        action: submission.decision.action,
        mappingRowsChanged: 2
      };
    } else if (url.includes(`/rpc/${CONTRACTS_ACTIVITY_MAPPING_HISTORY_RPC}`)) {
      value = historyResult || {
        historyVersion: CONTRACTS_ACTIVITY_MAPPING_HISTORY_VERSION,
        projectContext: mappingProjectContext(),
        total: 0,
        returned: 0,
        events: []
      };
    } else {
      value = [];
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(value) };
  };
}

function mappingScheduleSource(tasks = [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")]) {
  return {
    tasks,
    scheduleMeta: {
      sourceVersionId: MAPPING_FILE_V2,
      relevancyDate: "2026-08-01",
      versionConflict: false
    }
  };
}

function mappingReviewRequest(overrides = {}) {
  return {
    sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
    obligation: mappingObligation({ preferredTaskUid: 17 }),
    action: "confirm",
    selectedActivityKey: `gantt:${MAPPING_FILE_V2}:17`,
    reason: "Confirmed against the exact contract evidence and current schedule activity.",
    reviewRequestId: MAPPING_REVIEW_REQUEST_ID,
    conflictResolved: false,
    ...overrides
  };
}

export function registerContractsAgentTests(test) {
  test("contracts reviewer presents controlled decisions, statuses, and blockers in Hebrew", () => {
    assert.equal(contractRoleLabel("contractual_completion"), "השלמת ומסירת העבודות");
    assert.equal(contractActionLabel({ role: "performance_bond_renewal" }), "הארך את ערבות הביצוע לפני פקיעתה");
    assert.equal(contractGateLabel("working_calendar_missing"), "חסר לוח ימי עבודה מאושר");
    assert.equal(mappingBlockerLabel("ambiguous_candidates"), "נמצאו כמה חלופות בעלות התאמה זהה");
    assert.equal(mappingEvidenceKindLabel("normalized_name_exact"), "התאמה מלאה בשם הפעילות");
    assert.equal(promotionBlockerLabel("review_gate_unresolved:authority_unverified"), "חסם סקירה טרם נפתר: סמכות המסמך טרם אומתה");
    assert.equal(reviewPlanStatusLabel("transaction_ready"), "מוכן לטרנזקציה");
    assert.equal(storageDispositionLabel("candidate_for_schedule_contract_milestones"), "מועמד לאבן דרך חוזית");
    assert.equal(
      contractsUiError({ code: "contracts_activity_mapping_review_selection_stale" }),
      "הפעילות שנבחרה כבר אינה מופיעה בחלופות העדכניות. יש לרענן ולבחור מחדש."
    );
    assert.equal(
      contractsUiError({ code: "contracts_model_provider_timeout" }),
      "ספק הבינה המלאכותית לא השלים את החילוץ בזמן. לא נשמרה תוצאה חלקית; בניסיון הבא המערכת תשתמש מחדש רק בחלקים שכבר אומתו."
    );
    assert.equal(contractActionLabel({ role: "unknown_role", action: "Unsafe raw English" }), "בדוק את העובדה החוזית מול הראיה המקורית");
    assert.equal(contractGateLabel("unknown_gate"), "נדרש בירור נוסף לפני קידום");
  });

  test("contracts Phase 3F.1 parses an explicit saved-workspace extraction without widening Phase 1", () => {
    const parsed = parseWorkspaceExtractionRequest({
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      extractionRequest: {
        filename: "contract.pdf",
        mediaType: "application/pdf",
        pdfBase64: Buffer.from("%PDF-1.4\n", "utf8").toString("base64"),
        mode: "dry_run",
        projectSelection: {
          projectId: MAPPING_SOURCE_PROJECT_ID,
          projectSite: "אתר בדיקה",
          selectedByUser: true
        }
      }
    });

    assert.equal(parsed.scheduleProjectId, MAPPING_SCHEDULE_PROJECT_ID);
    assert.equal(parsed.parsedExtraction.projectSelection.projectId, MAPPING_SOURCE_PROJECT_ID);
    assert.equal(parsed.parsedExtraction.pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.throws(
      () => parseWorkspaceExtractionRequest({
        scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
        database: { supabaseUrl: "https://attacker.example" },
        extractionRequest: {}
      }),
      (error) => error instanceof ContractsAgentError && error.code === "contracts_workspace_request_field_unsupported"
    );
  });

  test("contracts Phase 3F.1 extraction reuse fingerprint is stable and model-sensitive", () => {
    const baseConfig = { models: { main: "google/gemini-2.5-pro", lite: "google/gemini-2.5-flash" } };
    const first = contractsExtractionFingerprint(baseConfig);
    assert.match(first, /^[0-9a-f]{64}$/u);
    assert.equal(first, contractsExtractionFingerprint(structuredClone(baseConfig)));
    assert.notEqual(first, contractsExtractionFingerprint({ models: { ...baseConfig.models, lite: "openai/gpt-4.1-mini" } }));
  });

  test("contracts Phase 3F.1 status requires the exact migration and a private Storage bucket", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      const value = url.includes("/rest/v1/rpc/")
        ? {
            workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
            draftVersion: CONTRACTS_REVIEW_DRAFT_VERSION,
            migrationVersion: CONTRACTS_WORKSPACE_MIGRATION_VERSION
          }
        : {
            name: "contracts-private",
            public: false,
            allowed_mime_types: ["application/pdf"],
            file_size_limit: 3_000_000
          };
      return { ok: true, status: 200, text: async () => JSON.stringify(value) };
    };
    const status = await loadContractsWorkspaceStatus({
      config: activityMappingTestConfig(),
      env: {
        CONTRACTS_PHASE3F1_WORKSPACE_PERSISTENCE_APPROVED: "TRUE",
        CONTRACTS_STORAGE_BUCKET: "contracts-private"
      },
      fetchImpl
    });
    assert.equal(status.ready, true);
    assert.equal(status.storageBucket, "contracts-private");
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /\/rest\/v1\/rpc\/bidoc_contracts_workspace_status_v1$/u);
    assert.match(requests[1].url, /\/storage\/v1\/bucket\/contracts-private$/u);
    assert.equal(requests[0].options.headers.apikey, "service-role-test-key");
  });

  test("contracts Phase 3F.1 rejects a public PDF bucket", async () => {
    await assert.rejects(
      () => assertPrivateStorageBucket({
        config: activityMappingTestConfig(),
        bucket: "contracts-private",
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ name: "contracts-private", public: true })
        })
      }),
      (error) => error instanceof ContractsAgentError && error.code === "contracts_workspace_storage_bucket_not_private"
    );
  });

  test("contracts Phase 3F.1 rejects missing or looser bucket safety metadata", async () => {
    for (const bucket of [
      { name: "contracts-private", public: false, file_size_limit: 3_000_000 },
      { name: "contracts-private", public: false, allowed_mime_types: ["application/pdf"], file_size_limit: null },
      { name: "contracts-private", public: false, allowed_mime_types: ["application/pdf", "text/plain"], file_size_limit: 3_000_000 },
      { name: "contracts-private", public: false, allowed_mime_types: ["application/pdf"], file_size_limit: 3_000_001 }
    ]) {
      await assert.rejects(
        () => assertPrivateStorageBucket({
          config: activityMappingTestConfig(),
          bucket: "contracts-private",
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(bucket)
          })
        }),
        (error) => error instanceof ContractsAgentError && error.code === "contracts_workspace_storage_bucket_unsafe"
      );
    }
  });

  test("contracts Phase 3F.1 reload validates the canonical stored extraction", async () => {
    const extraction = representativeOutput("signed_fixed_completion");
    extraction.projectBinding.projectId = MAPPING_SOURCE_PROJECT_ID;
    const response = {
      workspaceId: "88888888-8888-4888-8888-888888888888",
      workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
      documentVersionId: extraction.document.documentVersionId,
      filename: extraction.document.filename,
      projectSite: extraction.projectBinding.projectSite,
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      candidateCount: extraction.candidates.length,
      createdAt: "2026-08-12T12:00:00.000Z",
      lastOpenedAt: "2026-08-12T12:00:00.000Z",
      extraction,
      draft: null
    };
    const requests = [];
    const workspace = await findSavedContractWorkspace({
      config: activityMappingTestConfig(),
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      documentSha256: extraction.document.sha256,
      reviewerId: MAPPING_REVIEWER_ID,
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 200, text: async () => JSON.stringify(response) };
      }
    });
    assert.equal(workspace.documentVersionId, extraction.document.documentVersionId);
    assert.equal(workspace.extraction.summary.candidateCount, extraction.summary.candidateCount);
    assert.equal(requests.length, 1);
    const payload = JSON.parse(requests[0].options.body);
    assert.equal(payload.p_source_project_id, MAPPING_SOURCE_PROJECT_ID);
    assert.equal(payload.p_schedule_project_id, MAPPING_SCHEDULE_PROJECT_ID);
    assert.equal(payload.p_reviewer_id, MAPPING_REVIEWER_ID);
    assert.match(payload.p_extraction_fingerprint, /^[0-9a-f]{64}$/u);
  });

  test("contracts Phase 3F.1 refuses reuse from a different Schedule project", async () => {
    const extraction = representativeOutput("signed_fixed_completion");
    extraction.projectBinding.projectId = MAPPING_SOURCE_PROJECT_ID;
    await assert.rejects(
      () => findSavedContractWorkspace({
        config: activityMappingTestConfig(),
        sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
        scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
        documentSha256: extraction.document.sha256,
        reviewerId: MAPPING_REVIEWER_ID,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            workspaceId: "88888888-8888-4888-8888-888888888888",
            workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
            documentVersionId: extraction.document.documentVersionId,
            filename: extraction.document.filename,
            sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
            scheduleProjectId: "99999999-9999-4999-8999-999999999999",
            candidateCount: extraction.candidates.length,
            extraction,
            draft: null
          })
        })
      }),
      (error) => error instanceof ContractsAgentError && error.code === "contracts_workspace_response_invalid"
    );
  });

  test("contracts Phase 3F.1 verifies an existing content-addressed PDF before accepting Storage duplicate", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\nBiDoc saved contract fixture\n%%EOF", "utf8");
    const documentSha256 = contractPdfSha256(pdfBytes);
    const extraction = representativeOutput("signed_fixed_completion");
    extraction.projectBinding.projectId = MAPPING_SOURCE_PROJECT_ID;
    extraction.document.sha256 = documentSha256;
    extraction.document.documentVersionId = `sha256:${documentSha256}`;
    extraction.document.filename = "saved-fixture.pdf";
    const parsedExtraction = {
      pdfBytes,
      filename: "saved-fixture.pdf",
      mediaType: "application/pdf",
      projectSelection: {
        projectId: MAPPING_SOURCE_PROJECT_ID,
        projectSite: "Project Alpha",
        selectedByUser: true
      }
    };
    const requests = [];
    const responseEnvelope = {
      workspaceId: "88888888-8888-4888-8888-888888888888",
      workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
      documentVersionId: extraction.document.documentVersionId,
      filename: extraction.document.filename,
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      candidateCount: extraction.candidates.length,
      extraction,
      inserted: true,
      reused: false
    };
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/storage/v1/bucket/contracts-private")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            name: "contracts-private",
            public: false,
            allowed_mime_types: ["application/pdf"],
            file_size_limit: 3_000_000
          })
        };
      }
      if (url.includes("/storage/v1/object/authenticated/")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/pdf", "content-length": String(pdfBytes.length) }),
          arrayBuffer: async () => pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
        };
      }
      if (url.includes("/storage/v1/object/")) {
        return { ok: false, status: 409, text: async () => JSON.stringify({ code: "Duplicate", message: "Asset already exists" }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify(responseEnvelope) };
    };
    const workspace = await persistExtractedContractWorkspace({
      config: activityMappingTestConfig(),
      parsedExtraction,
      extraction,
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      reviewerId: MAPPING_REVIEWER_ID,
      env: { CONTRACTS_STORAGE_BUCKET: "contracts-private" },
      fetchImpl
    });
    assert.equal(workspace.inserted, true);
    assert.equal(requests.filter(({ url }) => url.includes("/object/authenticated/")).length, 1);
    const upsert = requests.find(({ url }) => url.includes("/rpc/bidoc_contracts_upsert_workspace_v1"));
    const payload = JSON.parse(upsert.options.body).p_payload;
    assert.equal(payload.storageObjectKey, `${MAPPING_SOURCE_PROJECT_ID}/${documentSha256}.pdf`);
    assert.equal(payload.scheduleProjectId, MAPPING_SCHEDULE_PROJECT_ID);
  });

  test("contracts Phase 3F.1 rejects a Storage duplicate whose bytes do not match the PDF hash", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\nExpected bytes\n%%EOF", "utf8");
    const existingBytes = Buffer.from("%PDF-1.4\nDifferent bytes\n%%EOF", "utf8");
    const documentSha256 = contractPdfSha256(pdfBytes);
    const extraction = representativeOutput("signed_fixed_completion");
    extraction.projectBinding.projectId = MAPPING_SOURCE_PROJECT_ID;
    extraction.document.sha256 = documentSha256;
    extraction.document.documentVersionId = `sha256:${documentSha256}`;
    const parsedExtraction = {
      pdfBytes,
      filename: extraction.document.filename,
      mediaType: "application/pdf",
      projectSelection: { projectId: MAPPING_SOURCE_PROJECT_ID, projectSite: "Project Alpha", selectedByUser: true }
    };
    await assert.rejects(
      () => persistExtractedContractWorkspace({
        config: activityMappingTestConfig(),
        parsedExtraction,
        extraction,
        scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
        reviewerId: MAPPING_REVIEWER_ID,
        env: { CONTRACTS_STORAGE_BUCKET: "contracts-private" },
        fetchImpl: async (url) => {
          if (url.endsWith("/storage/v1/bucket/contracts-private")) {
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify({
                name: "contracts-private",
                public: false,
                allowed_mime_types: ["application/pdf"],
                file_size_limit: 3_000_000
              })
            };
          }
          if (url.includes("/object/authenticated/")) {
            return {
              ok: true,
              status: 200,
              headers: new Headers({ "content-type": "application/pdf" }),
              arrayBuffer: async () => existingBytes.buffer.slice(existingBytes.byteOffset, existingBytes.byteOffset + existingBytes.byteLength)
            };
          }
          return { ok: false, status: 409, text: async () => JSON.stringify({ code: "Duplicate" }) };
        }
      }),
      (error) => error instanceof ContractsAgentError && error.code === "contracts_workspace_storage_object_mismatch" && error.status === 409
    );
  });

  test("contracts Phase 3F.1 post-model UPSERT race returns the canonical winner without claiming model avoidance", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\nConcurrent extraction fixture\n%%EOF", "utf8");
    const documentSha256 = contractPdfSha256(pdfBytes);
    const freshExtraction = representativeOutput("signed_fixed_completion");
    freshExtraction.projectBinding.projectId = MAPPING_SOURCE_PROJECT_ID;
    freshExtraction.document.sha256 = documentSha256;
    freshExtraction.document.documentVersionId = `sha256:${documentSha256}`;
    freshExtraction.document.filename = "fresh-loser.pdf";
    const canonicalExtraction = structuredClone(freshExtraction);
    canonicalExtraction.document.filename = "canonical-winner.pdf";
    const baseEnvelope = {
      workspaceId: "88888888-8888-4888-8888-888888888888",
      workspaceVersion: CONTRACTS_WORKSPACE_VERSION,
      documentVersionId: canonicalExtraction.document.documentVersionId,
      filename: canonicalExtraction.document.filename,
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      candidateCount: canonicalExtraction.candidates.length,
      extraction: canonicalExtraction
    };
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/storage/v1/bucket/contracts-private")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            name: "contracts-private",
            public: false,
            allowed_mime_types: ["application/pdf"],
            file_size_limit: 3_000_000
          })
        };
      }
      if (url.includes("/storage/v1/object/")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ Key: "saved.pdf" }) };
      }
      if (url.includes("/rpc/bidoc_contracts_upsert_workspace_v1")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ ...baseEnvelope, inserted: false, reused: true }) };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ...baseEnvelope,
          draft: { draftVersion: CONTRACTS_REVIEW_DRAFT_VERSION, revision: 3 }
        })
      };
    };
    const workspace = await persistExtractedContractWorkspace({
      config: activityMappingTestConfig(),
      parsedExtraction: {
        pdfBytes,
        filename: freshExtraction.document.filename,
        mediaType: "application/pdf",
        projectSelection: { projectId: MAPPING_SOURCE_PROJECT_ID, projectSite: "Project Alpha", selectedByUser: true }
      },
      extraction: freshExtraction,
      scheduleProjectId: MAPPING_SCHEDULE_PROJECT_ID,
      reviewerId: MAPPING_REVIEWER_ID,
      env: { CONTRACTS_STORAGE_BUCKET: "contracts-private" },
      fetchImpl
    });
    const response = projectSavedContractExtractionResponse(workspace, { modelAvoided: false });
    assert.equal(response.reused, false);
    assert.equal(response.workspaceReused, true);
    assert.equal(response.concurrentReuse, true);
    assert.equal(response.extraction.document.filename, "canonical-winner.pdf");
    assert.equal(response.draft.revision, 3);
    assert.equal(requests.filter(({ url }) => url.includes("/rpc/bidoc_contracts_get_workspace_v1")).length, 1);
  });

  test("contracts Phase 3F.1 draft save sends expected revision and maps stale writes to HTTP 409", async () => {
    const extraction = representativeOutput("signed_fixed_completion");
    const decisions = Object.fromEntries(extraction.candidates.map((candidate) => [candidate.candidateKey, {
      action: "reject",
      reason: "",
      gatesReviewed: false,
      milestoneKey: "",
      approvedBy: "",
      calendarSemantics: "",
      conflictReason: ""
    }]));
    const draft = {
      decisions,
      reviewReason: "",
      batchId: "contracts-review-test",
      reviewedAt: "2026-08-12T12:00:00.000Z",
      mappingDraft: null,
      expectedRevision: 2
    };
    let requestPayload = null;
    await assert.rejects(
      () => saveContractWorkspaceDraft({
        config: activityMappingTestConfig(),
        workspaceId: "88888888-8888-4888-8888-888888888888",
        reviewerId: MAPPING_REVIEWER_ID,
        draft,
        extraction,
        fetchImpl: async (_url, options) => {
          requestPayload = JSON.parse(options.body);
          return {
            ok: false,
            status: 400,
            text: async () => JSON.stringify({ code: "40001", message: "Saved contract review draft revision is stale" })
          };
        }
      }),
      (error) => error instanceof ContractsAgentError && error.code === "contracts_workspace_draft_stale" && error.status === 409
    );
    assert.equal(requestPayload.p_expected_revision, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(requestPayload.p_draft, "expectedRevision"), false);
  });

  test("contracts Phase 3F.1 draft progress counts only decisions with reviewer reasoning", () => {
    const extraction = representativeOutput("signed_fixed_completion");
    const decisions = Object.fromEntries(extraction.candidates.map((candidate, index) => [candidate.candidateKey, {
      action: index === 0 ? "approve" : "reject",
      reason: index === 0 ? "נבדק מול הציטוט והחסמים" : "",
      gatesReviewed: index === 0,
      milestoneKey: "",
      approvedBy: "",
      calendarSemantics: "",
      conflictReason: ""
    }]));
    const draft = normalizeWorkspaceDraft({
      decisions,
      reviewReason: "טיוטת סקירה",
      batchId: "contracts-review-test",
      reviewedAt: "2026-08-12T12:00:00.000Z",
      mappingDraft: null
    }, extraction);
    assert.equal(draft.candidateCount, extraction.candidates.length);
    assert.equal(draft.reviewedCount, 1);
    assert.equal(draft.approvedCount, 1);
    assert.equal(draft.rejectedCount, 0);
  });

  test("contracts Phase 3E loads its exact mapping context, MAIN activities, and KAPAIM state read-only", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      const value = url.includes(`/rpc/${CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC}`)
        ? mappingProjectContext()
        : [{
            id: "77777777-7777-4777-8777-777777777777",
            canonical_key: MAPPING_CANONICAL_KEY,
            alias: `gantt:${MAPPING_FILE_V2}:17`,
            alias_source: "gantt_activity_key",
            match_method: "manual_review",
            confidence: "0.98",
            status: "manually_confirmed",
            confirmed_by: "11111111-1111-4111-8111-111111111111",
            confirmed_at: "2026-08-11T12:00:00.000Z",
            created_at: "2026-08-11T12:00:00.000Z",
            updated_at: "2026-08-11T12:00:00.000Z"
          }];
      return { ok: true, status: 200, text: async () => JSON.stringify(value) };
    };
    const scheduleCalls = [];
    const loadScheduleSourceImpl = async (input) => {
      scheduleCalls.push(input);
      return {
        tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
        scheduleMeta: {
          sourceVersionId: MAPPING_FILE_V2,
          relevancyDate: "2026-08-01",
          versionConflict: false
        }
      };
    };
    const state = await loadContractActivityMappingState({
      config: { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } },
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      fetchImpl,
      loadScheduleSourceImpl
    });

    assert.equal(state.apiVersion, CONTRACTS_ACTIVITY_MAPPING_API_VERSION);
    assert.equal(state.mode, "read_only");
    assert.deepEqual(state.projectContext, mappingProjectContext());
    assert.deepEqual(state.counts, { activities: 1, existingMappings: 1 });
    assert.equal(state.activities[0].taskUid, 17);
    assert.equal(state.existingMappings[0].canonicalKey, MAPPING_CANONICAL_KEY);
    assert.equal(state.operationalWritesPerformed, false);
    assert.equal(scheduleCalls.length, 1);
    assert.equal(scheduleCalls[0].projectId, MAPPING_SOURCE_PROJECT_ID);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, `https://kapaim.example/rest/v1/rpc/${CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC}`);
    assert.equal(requests[0].options.method, "POST");
    assert.deepEqual(JSON.parse(requests[0].options.body), { p_source_project_id: MAPPING_SOURCE_PROJECT_ID });
    assert.match(requests[1].url, /\/rest\/v1\/schedule_activity_map\?select=/u);
    assert.match(requests[1].url, new RegExp(`project_id=eq\\.${MAPPING_SCHEDULE_PROJECT_ID}`, "u"));
    assert.equal(requests[1].options.method, "GET");
    assert.equal(requests[0].options.headers.apikey, "sb_secret_server");
    assert.equal(requests[1].options.headers.apikey, "sb_secret_server");
  });

  test("contracts Phase 3E builds candidates only from server-loaded state", async () => {
    const fetchImpl = async (url) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(
        url.includes(`/rpc/${CONTRACTS_ACTIVITY_MAPPING_CONTEXT_RPC}`) ? mappingProjectContext() : []
      )
    });
    const result = await buildContractActivityMappingCandidatesFromSources({
      config: { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } },
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      obligation: mappingObligation(),
      fetchImpl,
      loadScheduleSourceImpl: async ({ projectId }) => {
        assert.equal(projectId, MAPPING_SOURCE_PROJECT_ID);
        return {
          tasks: [
            mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
            mappingTask(MAPPING_FILE_V2, 24, "Structural steel framing")
          ],
          scheduleMeta: {
            sourceVersionId: MAPPING_FILE_V2,
            relevancyDate: "2026-08-01",
            versionConflict: false
          }
        };
      }
    });

    assert.equal(result.apiVersion, CONTRACTS_ACTIVITY_MAPPING_API_VERSION);
    assert.equal(result.mode, "read_only");
    assert.deepEqual(result.sourceCounts, { activities: 2, existingMappings: 0 });
    assert.equal(result.candidateBundle.candidates[0].taskUid, 17);
    assert.equal(result.candidateBundle.decisionState, "suggested");
    assert.equal(result.candidateBundle.automaticAlertEligible, false);
    assert.equal(result.operationalWritesPerformed, false);
    assertActivityMappingSchemaValid(result.candidateBundle);
  });

  test("contracts Phase 3E rejects every browser database-credential override before I/O", () => {
    const fixtures = [
      { headers: { "x-content-supabase-url": "https://attacker.example" } },
      { headers: { "x-content-supabase-key": "attacker-key" } },
      { query: new URLSearchParams({ contentSupabaseUrl: "https://attacker.example" }) },
      { body: { contentSupabaseKey: "attacker-key" } },
      { body: { obligation: { contentSource: { supabaseServiceRoleKey: "attacker-key" } } } },
      { body: { obligation: { databaseCredentials: { url: "https://attacker.example", key: "attacker-key" } } } }
    ];
    for (const fixture of fixtures) {
      assert.throws(
        () => assertNoClientDatabaseOverrides(fixture),
        (error) => error.code === "contracts_activity_mapping_database_override_rejected" && error.status === 400
      );
    }
    assert.doesNotThrow(() => assertNoClientDatabaseOverrides({
      query: new URLSearchParams({ sourceProjectId: MAPPING_SOURCE_PROJECT_ID }),
      body: { sourceProjectId: MAPPING_SOURCE_PROJECT_ID, obligation: mappingObligation() }
    }));
    assert.deepEqual(
      parseActivityMappingListRequest({ query: new URLSearchParams({ sourceProjectId: MAPPING_SOURCE_PROJECT_ID }) }),
      { sourceProjectId: MAPPING_SOURCE_PROJECT_ID }
    );
    assert.equal(
      parseActivityMappingCandidateRequest({ body: { sourceProjectId: MAPPING_SOURCE_PROJECT_ID, obligation: mappingObligation() } }).obligation.candidateKey,
      "candidate:contract-completion"
    );
    assert.throws(
      () => parseActivityMappingCandidateRequest({
        body: {
          sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
          obligation: mappingObligation(),
          tasks: [mappingTask(MAPPING_FILE_V2, 17, "Browser-selected activity")]
        }
      }),
      (error) => error.code === "contracts_activity_mapping_request_field_unsupported"
    );
  });

  test("contracts Phase 3E fails closed for missing approved project context or MAIN Gantt", async () => {
    const config = { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } };
    await assert.rejects(
      () => loadContractActivityMappingState({
        config,
        sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          text: async () => JSON.stringify({ code: "23503", message: "No active approved MAIN-to-KAPAIM project mapping exists" })
        }),
        loadScheduleSourceImpl: async () => assert.fail("MAIN must not be read without an approved context")
      }),
      (error) => error.code === "contracts_activity_mapping_context_not_found" && error.status === 404
    );
    await assert.rejects(
      () => loadContractActivityMappingState({
        config,
        sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(mappingProjectContext()) }),
        loadScheduleSourceImpl: async () => ({
          tasks: [],
          scheduleMeta: { sourceVersionId: null, relevancyDate: null, versionConflict: false }
        })
      }),
      (error) => error.code === "contracts_activity_mapping_schedule_not_found" && error.status === 404
    );
  });

  test("contracts Phase 3F accepts only bounded manual review and history contracts", () => {
    assert.equal(contractsActivityMappingReviewApproved({ CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED: "TRUE" }), true);
    assert.equal(contractsActivityMappingReviewApproved({ CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED: "true " }), true);
    assert.equal(contractsActivityMappingReviewApproved({ CONTRACTS_PHASE3_MAPPING_REVIEW_APPROVED: "1" }), false);
    assert.equal(parseActivityMappingReviewRequest({ body: mappingReviewRequest() }).action, "confirm");
    assert.deepEqual(
      parseActivityMappingHistoryRequest({
        query: new URLSearchParams({
          sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
          documentVersionId: `sha256:${FIXTURE_SHA}`,
          candidateKey: "candidate:contract-completion",
          limit: "25"
        })
      }),
      {
        sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
        documentVersionId: `sha256:${FIXTURE_SHA}`,
        candidateKey: "candidate:contract-completion",
        limit: 25
      }
    );
    for (const body of [
      { ...mappingReviewRequest(), action: "auto_continue" },
      { ...mappingReviewRequest(), reviewerId: MAPPING_REVIEWER_ID },
      { ...mappingReviewRequest(), reviewedAt: "2026-08-11T12:00:00.000Z" },
      { ...mappingReviewRequest(), selectedActivityKey: null },
      { ...mappingReviewRequest(), contentSupabaseKey: "browser-secret" }
    ]) {
      assert.throws(() => parseActivityMappingReviewRequest({ body }), ContractsAgentError);
    }
    assert.throws(
      () => parseActivityMappingHistoryRequest({
        query: new URLSearchParams({ sourceProjectId: MAPPING_SOURCE_PROJECT_ID, limit: "101" })
      }),
      (error) => error.code === "contracts_activity_mapping_history_filter_invalid"
    );
  });

  test("contracts Phase 3F rebuilds alternatives and owns reviewer, time, and evidence", async () => {
    const requests = [];
    const prepared = await prepareActivityMappingReviewSubmission({
      config: activityMappingTestConfig(),
      request: mappingReviewRequest(),
      reviewerId: MAPPING_REVIEWER_ID,
      fetchImpl: activityMappingSourceFetch(requests),
      loadScheduleSourceImpl: async ({ projectId }) => {
        assert.equal(projectId, MAPPING_SOURCE_PROJECT_ID);
        return mappingScheduleSource();
      },
      nowImpl: () => new Date("2026-08-11T19:45:00.000Z")
    });

    assert.equal(prepared.apiVersion, CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION);
    assert.equal(prepared.operationalWritesPerformed, false);
    assert.equal(prepared.submission.decision.reviewerId, MAPPING_REVIEWER_ID);
    assert.equal(prepared.submission.decision.reviewedAt, "2026-08-11T19:45:00.000Z");
    assert.equal(prepared.submission.decision.activityKey, `gantt:${MAPPING_FILE_V2}:17`);
    assert.equal(prepared.submission.decision.alternatives.length, 1);
    assert.equal(prepared.submission.decision.evidence[0].kind, "contract_source");
    assert.equal(prepared.submission.decision.evidence[0].sourceText, mappingObligation().sourceEvidence[0].sourceText);
    assert.equal(prepared.submission.eventKey, `activity-mapping-review:${MAPPING_REVIEW_REQUEST_ID}`);
    assert.equal(requests.length, 2);

    await assert.rejects(
      () => prepareActivityMappingReviewSubmission({
        config: activityMappingTestConfig(),
        request: mappingReviewRequest({ selectedActivityKey: `gantt:${MAPPING_FILE_V2}:999` }),
        reviewerId: MAPPING_REVIEWER_ID,
        fetchImpl: activityMappingSourceFetch([]),
        loadScheduleSourceImpl: async () => mappingScheduleSource()
      }),
      (error) => error.code === "contracts_activity_mapping_review_selection_stale" && error.status === 409
    );
  });

  test("contracts Phase 3F requires explicit conflict resolution and preserves correction history", async () => {
    const tiedTasks = [
      mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
      mappingTask(MAPPING_FILE_V2, 18, "Complete structural framing")
    ];
    await assert.rejects(
      () => prepareActivityMappingReviewSubmission({
        config: activityMappingTestConfig(),
        request: mappingReviewRequest({ obligation: mappingObligation({ preferredTaskUid: null }) }),
        reviewerId: MAPPING_REVIEWER_ID,
        fetchImpl: activityMappingSourceFetch([]),
        loadScheduleSourceImpl: async () => mappingScheduleSource(tiedTasks)
      }),
      (error) => error.code === "contracts_activity_mapping_review_conflict_unresolved"
    );

    const correction = await prepareActivityMappingReviewSubmission({
      config: activityMappingTestConfig(),
      request: mappingReviewRequest({
        obligation: mappingObligation({ preferredTaskUid: null }),
        action: "correct",
        conflictResolved: true,
        supersedesEventId: MAPPING_REVIEW_EVENT_ID
      }),
      reviewerId: MAPPING_REVIEWER_ID,
      fetchImpl: activityMappingSourceFetch([]),
      loadScheduleSourceImpl: async () => mappingScheduleSource(tiedTasks),
      historyLoader: async (filters) => {
        assert.equal(filters.candidateKey, "candidate:contract-completion");
        return {
          historyVersion: CONTRACTS_ACTIVITY_MAPPING_HISTORY_VERSION,
          events: [{ eventId: MAPPING_REVIEW_EVENT_ID, selectedCanonicalKey: MAPPING_CANONICAL_KEY }]
        };
      }
    });
    assert.equal(correction.submission.decision.canonicalKey, MAPPING_CANONICAL_KEY);
    assert.equal(correction.submission.decision.supersedesEventId, MAPPING_REVIEW_EVENT_ID);
    assert.equal(correction.submission.decision.conflictResolved, true);
  });

  test("contracts Phase 3F gates writes and calls only the atomic service-role review RPC", async () => {
    await assert.rejects(
      () => submitActivityMappingReview({
        config: activityMappingTestConfig(),
        request: mappingReviewRequest(),
        reviewerId: MAPPING_REVIEWER_ID,
        reviewApplyApproved: false
      }),
      (error) => error.code === "contracts_activity_mapping_review_apply_not_approved" && error.status === 503
    );

    const requests = [];
    const result = await submitActivityMappingReview({
      config: activityMappingTestConfig(),
      request: mappingReviewRequest(),
      reviewerId: MAPPING_REVIEWER_ID,
      reviewApplyApproved: true,
      fetchImpl: activityMappingSourceFetch(requests),
      loadScheduleSourceImpl: async () => mappingScheduleSource(),
      nowImpl: () => new Date("2026-08-11T20:00:00.000Z")
    });
    assert.equal(result.status, "recorded");
    assert.equal(result.auditWritePerformed, true);
    assert.equal(result.operationalWritesPerformed, true);
    const reviewCall = requests.find((request) => request.url.includes(`/rpc/${CONTRACTS_ACTIVITY_MAPPING_REVIEW_RPC}`));
    assert.ok(reviewCall);
    assert.equal(reviewCall.options.headers.apikey, "service-role-test-key");
    assert.equal(JSON.parse(reviewCall.options.body).p_submission.decision.reviewerId, MAPPING_REVIEWER_ID);
    assert.equal(requests.filter((request) => request.options.method !== "GET").length, 2);
  });

  test("contracts Phase 3F history is server-only, filtered, immutable, and read-only", async () => {
    const requests = [];
    const history = await listActivityMappingReviewHistory({
      config: activityMappingTestConfig(),
      sourceProjectId: MAPPING_SOURCE_PROJECT_ID,
      documentVersionId: `sha256:${FIXTURE_SHA}`,
      candidateKey: "candidate:contract-completion",
      limit: 25,
      fetchImpl: activityMappingSourceFetch(requests, {
        historyResult: {
          historyVersion: CONTRACTS_ACTIVITY_MAPPING_HISTORY_VERSION,
          projectContext: mappingProjectContext(),
          total: 1,
          returned: 1,
          events: [{
            eventId: MAPPING_REVIEW_EVENT_ID,
            action: "confirm",
            reason: "Reviewed against exact evidence.",
            evidence: [{ kind: "contract_source" }]
          }]
        }
      })
    });
    assert.equal(history.apiVersion, CONTRACTS_ACTIVITY_MAPPING_REVIEW_API_VERSION);
    assert.equal(history.operationalWritesPerformed, false);
    assert.equal(history.events[0].eventId, MAPPING_REVIEW_EVENT_ID);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `https://app-data.example.test/rest/v1/rpc/${CONTRACTS_ACTIVITY_MAPPING_HISTORY_RPC}`);
    assert.equal(requests[0].options.headers.apikey, "service-role-test-key");
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      p_source_project_id: MAPPING_SOURCE_PROJECT_ID,
      p_document_version_id: `sha256:${FIXTURE_SHA}`,
      p_candidate_key: "candidate:contract-completion",
      p_limit: 25
    });
  });

  test("contracts Phase 3 mapping ranks review alternatives without selecting an initial winner", () => {
    const output = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 24, "Structural steel framing")
      ],
      existingMappings: []
    });

    assert.equal(output.mappingContractVersion, CONTRACTS_ACTIVITY_MAPPING_VERSION);
    assert.equal(output.decisionState, ACTIVITY_MAPPING_STATUS.SUGGESTED);
    assert.equal(output.candidates.length, 2);
    assert.equal(output.candidates[0].taskUid, 17);
    assert.equal(output.candidates[0].canonicalKey, null);
    assert.ok(output.candidates[0].confidence > output.candidates[1].confidence);
    assert.equal(output.automaticAlertEligible, false);
    assert.equal(output.conflict, null);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 mapping leaves global milestones explicitly unlinked", () => {
    const output = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation({
        candidateKey: "candidate:global-completion-date",
        milestoneKey: "milestone:global-completion-date",
        label: "Contract-wide completion date",
        mappingRequirement: "not_required",
        sourceEvidence: []
      }),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: []
    });

    assert.equal(output.decisionState, "not_required");
    assert.deepEqual(output.candidates, []);
    assert.deepEqual(output.blockers, []);
    assert.equal(output.automaticAlertEligible, false);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 mapping keeps unreviewed trigger conditions pending without a date or link", () => {
    const output = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation({
        candidateKey: "candidate:notice-trigger",
        label: "Complete within 30 days after written notice",
        conditionStatus: "pending",
        triggerEvidenceReviewed: false
      }),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: []
    });

    assert.equal(output.decisionState, "pending_trigger");
    assert.deepEqual(output.candidates, []);
    assert.deepEqual(output.blockers, [ACTIVITY_MAPPING_BLOCKER.TRIGGER_EVIDENCE_UNREVIEWED]);
    assert.equal(output.automaticAlertEligible, false);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 mapping fails closed for inactive project routing and version conflicts", () => {
    const inactive = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext("inactive"),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: []
    });
    assert.equal(inactive.decisionState, "blocked");
    assert.deepEqual(inactive.blockers, [ACTIVITY_MAPPING_BLOCKER.PROJECT_MAPPING_INACTIVE]);
    assertActivityMappingSchemaValid(inactive);

    const versionConflict = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2, { versionConflict: true }),
      tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: []
    });
    assert.equal(versionConflict.decisionState, "blocked");
    assert.deepEqual(versionConflict.blockers, [ACTIVITY_MAPPING_BLOCKER.SCHEDULE_VERSION_CONFLICT]);
    assertActivityMappingSchemaValid(versionConflict);
  });

  test("contracts Phase 3 mapping preserves tied alternatives and conflicting canonical owners", () => {
    const tied = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 18, "Complete structural framing")
      ],
      existingMappings: []
    });
    assert.equal(tied.decisionState, "blocked");
    assert.equal(tied.conflict.type, ACTIVITY_MAPPING_BLOCKER.AMBIGUOUS_CANDIDATES);
    assert.equal(tied.conflict.candidateActivityKeys.length, 2);
    assertActivityMappingSchemaValid(tied);

    const conflict = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: [
        confirmedActivityMapping(MAPPING_FILE_V2),
        confirmedActivityMapping(MAPPING_FILE_V2, {
          canonicalKey: "schedule-activity:77777777-7777-4777-8777-777777777777"
        })
      ]
    });
    assert.equal(conflict.decisionState, "blocked");
    assert.equal(conflict.conflict.type, ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT);
    assert.equal(conflict.candidates[0].confidence, 0.79);
    assertActivityMappingSchemaValid(conflict);

    const duplicateUid = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 17, "Duplicate structural framing")
      ],
      existingMappings: []
    });
    assert.equal(duplicateUid.decisionState, "blocked");
    assert.deepEqual(duplicateUid.blockers, [ACTIVITY_MAPPING_BLOCKER.DUPLICATE_CURRENT_TASK_UID]);
    assertActivityMappingSchemaValid(duplicateUid);

    const invalidCanonical = buildContractActivityMappingCandidates({
      projectContext: mappingProjectContext(),
      obligation: mappingObligation(),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: [confirmedActivityMapping(MAPPING_FILE_V2, { canonicalKey: "legacy-key" })]
    });
    assert.equal(invalidCanonical.decisionState, "blocked");
    assert.deepEqual(invalidCanonical.blockers, [ACTIVITY_MAPPING_BLOCKER.INVALID_CANONICAL_KEY]);
    assert.equal(invalidCanonical.candidates[0].canonicalKey, null);
    assertActivityMappingSchemaValid(invalidCanonical);
  });

  test("contracts Phase 3 reconciliation carries forward an exact two-upload alias conservatively", () => {
    const output = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: [confirmedActivityMapping()]
    });

    assert.deepEqual(output.summary, {
      evaluated: 1,
      autoConfirmed: 1,
      suggested: 0,
      unmapped: 0,
      conflicts: 0
    });
    assert.equal(output.reconciliations[0].canonicalKey, MAPPING_CANONICAL_KEY);
    assert.equal(output.reconciliations[0].currentActivityKey, `gantt:${MAPPING_FILE_V2}:17`);
    assert.equal(output.reconciliations[0].status, ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED);
    assert.equal(output.reconciliations[0].confidence, 0.97);
    assert.equal(output.reconciliations[0].matchMethod, ACTIVITY_MAPPING_METHOD.EXACT_UID_CONTINUITY);
    assert.equal(output.reconciliations[0].automaticAlertEligible, true);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 reconciliation blocks a different UID with the same normalized current identity", () => {
    const output = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 18, "  COMPLETE\u2014STRUCTURAL   FRAMING  ")
      ],
      existingMappings: [confirmedActivityMapping()]
    });

    assert.deepEqual(output.summary, {
      evaluated: 1,
      autoConfirmed: 0,
      suggested: 0,
      unmapped: 0,
      conflicts: 1
    });
    assert.equal(output.conflictCount, 1);
    assert.equal(output.reconciliations[0].currentActivityKey, `gantt:${MAPPING_FILE_V2}:17`);
    assert.equal(output.reconciliations[0].status, "conflict");
    assert.equal(output.reconciliations[0].confidence, 0);
    assert.equal(output.reconciliations[0].matchMethod, null);
    assert.deepEqual(output.reconciliations[0].blockers, [
      ACTIVITY_MAPPING_BLOCKER.AMBIGUOUS_CANDIDATES
    ]);
    assert.deepEqual(output.reconciliations[0].evidence, [
      { kind: "task_uid_exact", detail: "17", scoreDelta: 0.5 },
      {
        kind: "identity_mismatch",
        detail: `normalized name and outline level also match gantt:${MAPPING_FILE_V2}:18`,
        scoreDelta: 0
      }
    ]);
    assert.equal(output.reconciliations[0].automaticAlertEligible, false);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 reconciliation allows distinct current identities to preserve exact continuity", () => {
    const output = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 18, "  COMPLETE\u2014STRUCTURAL   FRAMING  ", { outlineLevel: 4 }),
        mappingTask(MAPPING_FILE_V2, 19, "Complete exterior framing")
      ],
      existingMappings: [confirmedActivityMapping()]
    });

    assert.equal(output.reconciliations[0].status, ACTIVITY_MAPPING_STATUS.AUTO_CONFIRMED);
    assert.equal(output.reconciliations[0].confidence, 0.97);
    assert.equal(output.reconciliations[0].matchMethod, ACTIVITY_MAPPING_METHOD.EXACT_UID_CONTINUITY);
    assert.deepEqual(output.reconciliations[0].blockers, []);
    assert.equal(output.reconciliations[0].automaticAlertEligible, true);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 reconciliation blocks automatic continuity when identity evidence changes", () => {
    const output = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete revised framing", { outlineLevel: 4 })],
      existingMappings: [confirmedActivityMapping()]
    });

    assert.equal(output.reconciliations[0].status, ACTIVITY_MAPPING_STATUS.SUGGESTED);
    assert.equal(output.reconciliations[0].confidence, 0.79);
    assert.equal(output.reconciliations[0].matchMethod, null);
    assert.deepEqual(output.reconciliations[0].blockers, [
      ACTIVITY_MAPPING_BLOCKER.IDENTITY_CONTINUITY_REQUIRES_REVIEW
    ]);
    assert.equal(output.reconciliations[0].automaticAlertEligible, false);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 reconciliation preserves prior uncertainty below the continuity gate", () => {
    const output = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: [confirmedActivityMapping(MAPPING_FILE_V1, { confidence: 0.94 })]
    });

    assert.equal(output.reconciliations[0].status, ACTIVITY_MAPPING_STATUS.SUGGESTED);
    assert.equal(output.reconciliations[0].confidence, 0.94);
    assert.deepEqual(output.reconciliations[0].blockers, [
      ACTIVITY_MAPPING_BLOCKER.PRIOR_MAPPING_CONFIDENCE_BELOW_CONTINUITY_GATE
    ]);
    assert.equal(output.reconciliations[0].automaticAlertEligible, false);
    assertActivityMappingSchemaValid(output);
  });

  test("contracts Phase 3 reconciliation leaves changed and duplicate UIDs fail closed", () => {
    const changedUid = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [mappingTask(MAPPING_FILE_V2, 18, "Complete structural framing")],
      existingMappings: [confirmedActivityMapping()]
    });
    assert.equal(changedUid.reconciliations[0].status, ACTIVITY_MAPPING_STATUS.UNMAPPED);
    assert.deepEqual(changedUid.reconciliations[0].blockers, [
      ACTIVITY_MAPPING_BLOCKER.CURRENT_ACTIVITY_NOT_FOUND
    ]);
    assert.equal(changedUid.reconciliations[0].automaticAlertEligible, false);
    assertActivityMappingSchemaValid(changedUid);

    const duplicateUid = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 17, "Duplicate structural framing")
      ],
      existingMappings: [confirmedActivityMapping()]
    });
    assert.equal(duplicateUid.reconciliations[0].status, "conflict");
    assert.deepEqual(duplicateUid.reconciliations[0].blockers, [
      ACTIVITY_MAPPING_BLOCKER.DUPLICATE_CURRENT_TASK_UID
    ]);
    assert.equal(duplicateUid.conflictCount, 1);
    assertActivityMappingSchemaValid(duplicateUid);

    const duplicateCanonical = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [
        mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V1, 18, "Complete exterior framing")
      ],
      currentTasks: [
        mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing"),
        mappingTask(MAPPING_FILE_V2, 18, "Complete exterior framing")
      ],
      existingMappings: [
        confirmedActivityMapping(),
        confirmedActivityMapping(MAPPING_FILE_V1, { alias: `gantt:${MAPPING_FILE_V1}:18` })
      ]
    });
    assert.equal(duplicateCanonical.conflictCount, 2);
    assert.ok(duplicateCanonical.reconciliations.every((entry) => (
      entry.blockers.includes(ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT)
      && entry.automaticAlertEligible === false
    )));
    assertActivityMappingSchemaValid(duplicateCanonical);

    const occupiedCurrentAlias = reconcileConfirmedActivityAliases({
      projectContext: mappingProjectContext(),
      previousScheduleVersion: mappingScheduleVersion(MAPPING_FILE_V1),
      scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
      previousTasks: [mappingTask(MAPPING_FILE_V1, 17, "Complete structural framing")],
      currentTasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing")],
      existingMappings: [
        confirmedActivityMapping(),
        confirmedActivityMapping(MAPPING_FILE_V2, {
          canonicalKey: "schedule-activity:77777777-7777-4777-8777-777777777777"
        })
      ]
    });
    assert.equal(occupiedCurrentAlias.conflictCount, 1);
    assert.equal(occupiedCurrentAlias.reconciliations[0].status, "conflict");
    assert.equal(occupiedCurrentAlias.reconciliations[0].currentActivityKey, `gantt:${MAPPING_FILE_V2}:17`);
    assert.deepEqual(occupiedCurrentAlias.reconciliations[0].blockers, [
      ACTIVITY_MAPPING_BLOCKER.CANONICAL_ALIAS_CONFLICT
    ]);
    assertActivityMappingSchemaValid(occupiedCurrentAlias);
  });

  test("contracts Phase 3 automatic alert eligibility enforces every mapping gate", () => {
    const eligible = {
      status: ACTIVITY_MAPPING_STATUS.MANUALLY_CONFIRMED,
      confidence: 0.8,
      currentVersionAliasResolvedExactlyOnce: true,
      noOpenMappingConflict: true,
      projectMappingActive: true
    };
    assert.equal(mappingAutomaticAlertEligible(eligible), true);
    assert.equal(mappingAutomaticAlertEligible({ ...eligible, confidence: 0.79 }), false);
    assert.equal(mappingAutomaticAlertEligible({ ...eligible, status: ACTIVITY_MAPPING_STATUS.SUGGESTED }), false);
    assert.equal(mappingAutomaticAlertEligible({ ...eligible, currentVersionAliasResolvedExactlyOnce: false }), false);
    assert.equal(mappingAutomaticAlertEligible({ ...eligible, noOpenMappingConflict: false }), false);
    assert.equal(mappingAutomaticAlertEligible({ ...eligible, projectMappingActive: false }), false);
  });

  test("contracts Phase 3 mapping validates inputs and remains a pure no-I/O, no-arithmetic module", () => {
    assert.throws(
      () => buildContractActivityMappingCandidates({
        projectContext: mappingProjectContext(),
        obligation: mappingObligation({ sourceEvidence: [] }),
        scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
        tasks: [],
        existingMappings: []
      }),
      (error) => error.code === "contracts_activity_mapping_input_invalid" && error.status === 400
    );
    assert.throws(
      () => buildContractActivityMappingCandidates({
        projectContext: mappingProjectContext(),
        obligation: mappingObligation(),
        scheduleVersion: mappingScheduleVersion(MAPPING_FILE_V2),
        tasks: [mappingTask(MAPPING_FILE_V2, 17, "Complete structural framing", {
          plannedStart: "2026-02-30"
        })],
        existingMappings: []
      }),
      (error) => error.code === "contracts_activity_mapping_input_invalid"
    );

    const source = fs.readFileSync(new URL("../src/contracts/activityMapping.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /from\s+["']node:/);
    assert.doesNotMatch(source, /\b(?:fetch|readFile|writeFile|process\.env|setTimeout)\b/);
    assert.doesNotMatch(source, /(?:scheduleEngine|scheduleCalendar|diffCalendarDays|addCalendarDays|workingDays)/);
  });

  test("contracts request intake is bounded, strict, and dry-run only", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\nfixture", "utf8");
    const parsed = parseContractExtractionRequest({
      filename: "contract.pdf",
      mediaType: "application/pdf",
      pdfBase64: pdfBytes.toString("base64"),
      mode: "dry_run",
      projectSelection: {
        projectId: "project-1",
        projectSite: "15 HaHoshlim, Herzliya",
        selectedByUser: true
      }
    });
    assert.equal(parsed.pdfBytes.toString("utf8"), pdfBytes.toString("utf8"));
    assert.equal(parsed.projectSelection.projectId, "project-1");

    assert.throws(
      () => parseContractExtractionRequest({
        filename: "contract.pdf",
        mediaType: "application/pdf",
        pdfBase64: pdfBytes.toString("base64"),
        commit: true
      }),
      (error) => error.code === "contracts_write_options_forbidden" && error.status === 400
    );
    assert.throws(
      () => parseContractExtractionRequest({ filename: "contract.pdf", mediaType: "text/plain", pdfBase64: "AAAA" }),
      (error) => error.code === "contracts_media_type_unsupported" && error.status === 415
    );
    assert.throws(
      () => parseContractExtractionRequest({ filename: "contract.pdf", mediaType: "application/pdf", pdfBase64: "not-base64" }),
      (error) => error.code === "contracts_pdf_base64_invalid"
    );

    const body = JSON.stringify({ value: "1234567890" });
    const request = Readable.from([Buffer.from(body)]);
    request.headers = { "content-length": String(Buffer.byteLength(body)) };
    await assert.rejects(
      () => readJsonBounded(request, 5),
      (error) => error.code === "contracts_request_too_large" && error.status === 413
    );
  });

  test("contracts response cap measures the exact pretty UTF-8 bytes sent on the wire", () => {
    const payload = {
      mode: "dry_run",
      message: "לוח זמנים",
      nested: { candidates: ["א", "ב", "ג"] }
    };
    const compact = Buffer.from(JSON.stringify(payload), "utf8");
    const expectedWireBody = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
    assert.ok(expectedWireBody.byteLength > compact.byteLength);
    assert.ok(expectedWireBody.byteLength > expectedWireBody.toString("utf8").length);

    let status = null;
    let headers = null;
    let sentBody = null;
    const response = {
      writeHead(nextStatus, nextHeaders) {
        status = nextStatus;
        headers = nextHeaders;
      },
      end(body) {
        sentBody = body;
      }
    };
    sendContractsJson(response, 200, payload, { maxBytes: expectedWireBody.byteLength });
    assert.equal(status, 200);
    assert.deepEqual(headers, { "Content-Type": "application/json; charset=utf-8" });
    assert.ok(Buffer.isBuffer(sentBody));
    assert.deepEqual(sentBody, expectedWireBody);

    assert.throws(
      () => serializeContractsResponse(payload, { maxBytes: expectedWireBody.byteLength - 1 }),
      (error) => error.code === "contracts_response_too_large" &&
        error.status === 502 &&
        error.issueCodes.includes("canonical_output.response_too_large")
    );
  });

  test("contracts PDF reader reconstructs glyph-based Hebrew and extracts page text", async () => {
    const glyphs = positionedGlyphs(["מועד", "תחילה"]);
    assert.equal(reconstructPdfPageText(glyphs), "מועד תחילה");

    const parsed = await readContractPdf({ pdfBytes: buildMinimalPdf("Hello contract text with enough characters for safe extraction") });
    assert.equal(parsed.pageCount, 1);
    assert.equal(parsed.unreadablePages.length, 0);
    assert.match(parsed.pages[0].text, /Hello contract text/);
  });

  test("contracts PDF reader maps page and text-layer failures to a safe typed 422", async () => {
    const parserFailure = new Error("sensitive parser implementation detail");
    const cases = [
      {
        getPage: async () => { throw parserFailure; }
      },
      {
        getPage: async () => ({
          getTextContent: async () => { throw parserFailure; },
          cleanup() {}
        })
      }
    ];

    for (const scenario of cases) {
      await assert.rejects(
        () => readContractPdf({
          pdfBytes: Buffer.from("%PDF-1.4\nfixture"),
          loadDocument: fakePdfLoader({ getPage: scenario.getPage })
        }),
        (error) => error.code === "contracts_pdf_page_unreadable" &&
          error.status === 422 &&
          error.message === "PDF page 1 could not be read." &&
          !error.message.includes(parserFailure.message)
      );
    }

    const internal = new ContractsAgentError(
      "contracts_pdf_internal_canary",
      "Internal PDF canary.",
      500
    );
    await assert.rejects(
      () => readContractPdf({
        pdfBytes: Buffer.from("%PDF-1.4\nfixture"),
        loadDocument: fakePdfLoader({ getPage: async () => { throw internal; } })
      }),
      (error) => error === internal
    );
  });

  test("contracts PDF reader enforces the total deadline and external cancellation", async () => {
    const never = new Promise(() => {});
    const deadlineStartedAt = Date.now();
    await assert.rejects(
      () => readContractPdf({
        pdfBytes: Buffer.from("%PDF-1.4\nfixture"),
        deadlineAt: Date.now() + 25,
        loadDocument: fakePdfLoader({ getPage: async () => never })
      }),
      (error) => error.code === "contracts_extraction_time_budget_exceeded" &&
        error.status === 504 &&
        error.issueCodes.includes("extraction.time_budget_exceeded")
    );
    assert.ok(Date.now() - deadlineStartedAt < 1_000);

    const controller = new AbortController();
    let markTextReadStarted;
    const textReadStarted = new Promise((resolve) => { markTextReadStarted = resolve; });
    const pendingRead = readContractPdf({
      pdfBytes: Buffer.from("%PDF-1.4\nfixture"),
      signal: controller.signal,
      loadDocument: fakePdfLoader({
        getPage: async () => ({
          getTextContent: () => {
            markTextReadStarted();
            return never;
          },
          cleanup() {}
        })
      })
    });
    await textReadStarted;
    controller.abort();
    await assert.rejects(
      pendingRead,
      (error) => error.code === "contracts_extraction_cancelled" &&
        error.status === 499 &&
        error.issueCodes.includes("extraction.cancelled")
    );
  });

  test("contracts orchestrator threads its total deadline and AbortSignal into PDF parsing", async () => {
    const controller = new AbortController();
    const deadlineAt = Date.now() + 10_000;
    const canary = new ContractsAgentError("contracts_pdf_canary", "PDF canary.", 422);
    let receivedOptions = null;

    await assert.rejects(
      () => runContractsDryRun({
        pdfBytes: Buffer.from("%PDF-1.4\nfixture"),
        filename: "contract.pdf",
        config: { openRouterApiKey: "sk-test" },
        deadlineAt,
        signal: controller.signal,
        readPdf: async (options) => {
          receivedOptions = options;
          throw canary;
        }
      }),
      (error) => error === canary
    );
    assert.equal(receivedOptions.deadlineAt, deadlineAt);
    assert.equal(receivedOptions.signal, controller.signal);
  });

  test("contracts clause segmentation preserves PDF page and appendix identity", () => {
    const segments = segmentContractPages([
      {
        pdfPage: 14,
        text: "נספח ב' – לוח זמנים לביצוע העבודות\n1. מועד תחילת העבודות: ______\n2. העבודות יושלמו בתוך 100 ימי עבודה."
      }
    ]);
    const completion = segments.find((segment) => segment.clauseKey === "appendix_b.2");
    assert.ok(completion);
    assert.equal(completion.pdfPage, 14);
    assert.equal(completion.clauseLabel, "Appendix B, item 2");
    assert.match(completion.segmentId, /^p014:appendix_b\.2:/);

    const selected = selectContractExtractionSegments([
      segment("heading", 14, "Appendix B heading", "appendix_b.heading", "Appendix B: completion within 100 days"),
      segment("valued", 14, "Appendix B, item 2", "appendix_b.2", "The works finish within 100 working days.")
    ]);
    assert.deepEqual(selected.map((item) => item.segmentId), ["valued"]);
  });

  test("contracts model aliases normalize only bounded attachment-status vocabulary", () => {
    const normalized = normalizeContractsModelDraftAliases({
      documentObservations: { attachmentsStatus: "partial" },
      candidates: []
    });
    assert.equal(normalized.documentObservations.attachmentsStatus, "incomplete");
    assert.equal(normalizeContractsModelDraftAliases({ documentObservations: { attachmentsStatus: "present" } }).documentObservations.attachmentsStatus, "complete");
    assert.equal(normalizeContractsModelDraftAliases({ documentObservations: { attachmentsStatus: "unexpected" } }).documentObservations.attachmentsStatus, "unexpected");
    const missing = normalizeContractsModelDraftAliases({
      documentObservations: { attachmentsStatus: "unknown" },
      missingObservations: [
        { blocks: [{ key: "computed_completion_date" }, { operational_projection: true }] },
        { key: "unusable", field: "unknown", description: "No known blocked result", blocks: [{ unexpected: false }] },
        { blocks: [{ unexpected: "value" }] }
      ]
    });
    assert.deepEqual(missing.missingObservations[0].blocks, ["computed_completion_date", "operational_projection"]);
    assert.equal(missing.missingObservations.length, 1);

    const hydrated = normalizeContractsModelDraftAliases({
      documentObservations: { attachmentsStatus: "unknown" },
      candidates: [{ evidence: [{ segmentId: "known" }, { segmentId: "unknown", exactQuote: "unchanged" }] }]
    }, [{ segmentId: "known", text: "Exact parser segment." }]);
    assert.deepEqual(hydrated.candidates[0].evidence, [
      { segmentId: "known", exactQuote: "Exact parser segment." },
      { segmentId: "unknown", exactQuote: "unchanged" }
    ]);

    const aliasedEvidence = normalizeContractsModelDraftAliases({
      documentObservations: { attachmentsStatus: "unknown" },
      candidates: [{ evidence: [
        { segment_id: "known", quote: "Model-provided text must not be trusted." },
        { sourceSegmentId: "known", extra: "discarded" },
        { arbitraryModelKey: "known", anotherKey: "discarded" },
        { nested: { issuedIds: ["known"] } }
      ] }]
    }, [{ segmentId: "known", text: "Exact parser segment." }]);
    assert.deepEqual(aliasedEvidence.candidates[0].evidence, [
      { segmentId: "known", exactQuote: "Exact parser segment." }
    ]);

    const unknownAliasedEvidence = normalizeContractsModelDraftAliases({
      documentObservations: { attachmentsStatus: "unknown" },
      candidates: [{ evidence: [{ segment_id: "not-in-source", quote: "Unsupported." }] }]
    }, [{ segmentId: "known", text: "Exact parser segment." }]);
    assert.deepEqual(unknownAliasedEvidence.candidates[0].evidence, [
      { segment_id: "not-in-source", quote: "Unsupported." }
    ]);
  });

  test("contracts model extraction keeps three calls concurrent under a low token budget", async () => {
    const segments = Array.from({ length: 11 }, (_, index) => ({
      segmentId: `p${String(index + 1).padStart(3, "0")}:clause_${index + 1}:0001`,
      pdfPage: index + 1,
      clauseLabel: String(index + 1),
      clauseKey: String(index + 1),
      text: `Clause ${index + 1}: complete the work within 30 days after commencement.`
    }));
    let calls = 0;
    let active = 0;
    let maxActive = 0;
    const providerLimits = [];
    const draft = await extractContractsModelDraft({
      segments,
      pageCount: 11,
      unreadablePages: [],
      config: {
        openRouterApiKey: "sk-test",
        models: { main: "test/contracts-model" },
        ai: { main: { maxTokens: 8000, timeoutMs: 60000 } }
      },
      chatComplete: async (options) => {
        calls += 1;
        providerLimits.push({ maxTokens: options.maxTokens, timeoutMs: options.timeoutMs });
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        options.telemetry?.record?.({
          status: "done",
          requested_model: options.model,
          actual_model: options.model,
          duration_ms: 5,
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
          cost: 0,
          finish_reason: "stop",
          native_finish_reason: "stop"
        });
        return JSON.stringify({
          draftVersion: "contracts-model-draft.v1",
          documentObservations: {
            documentType: "unknown",
            executionDate: null,
            attachmentsStatus: "unknown",
            contractSiteRaw: null
          },
          candidates: [],
          missingObservations: [],
          packetReferences: []
        });
      }
    });
    assert.equal(CONTRACTS_EXTRACTION_BUDGET_MS, 270_000);
    assert.equal(contractsModelChunkCharacterBudget(4096), 1433);
    assert.equal(contractsModelChunkCharacterBudget(8000), 2800);
    assert.equal(contractsModelChunkCharacterBudget(16000), 5600);
    assert.equal(chunkContractSegments(segments, { maxSegments: 3 }).length, 4);
    assert.equal(calls, 4);
    assert.equal(maxActive, 3);
    assert.deepEqual(providerLimits, Array(4).fill({ maxTokens: 8000, timeoutMs: 60000 }));
    assert.deepEqual(draft.candidates, []);
  });

  test("contracts model extraction splits an invalid multi-segment batch within the same bounded worker", async () => {
    const segments = Array.from({ length: 3 }, (_, index) => segment(
      `fallback-${index + 1}`,
      index + 1,
      String(index + 1),
      String(index + 1),
      `Clause ${index + 1}: complete the work within 30 days after commencement.`
    ));
    const calls = [];
    const events = [];
    const draft = await extractContractsModelDraft({
      segments,
      pageCount: 3,
      unreadablePages: [],
      config: {
        openRouterApiKey: "sk-test",
        models: { main: "test/contracts-model" },
        ai: { main: { maxTokens: 8000, timeoutMs: 60000 } }
      },
      emit: (event) => events.push(event),
      chatComplete: async (options) => {
        calls.push(options.telemetry.callId);
        options.telemetry.record({ status: "done", finish_reason: "stop", native_finish_reason: "stop" });
        if (options.telemetry.callId === "contracts_extract_1") return "{\"invalid\":true}";
        const match = options.telemetry.callId.match(/fallback_(\d+)$/u);
        const source = segments[Number(match[1]) - 1];
        return JSON.stringify({
          draftVersion: "contracts-model-draft.v1",
          documentObservations: { documentType: "unknown", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
          candidates: [],
          missingObservations: [],
          packetReferences: [{ reference: `Reference ${source.segmentId}`, status: "missing", impact: "Fallback coverage" }]
        });
      }
    });
    assert.deepEqual(calls, [
      "contracts_extract_1",
      "contracts_extract_1_fallback_1",
      "contracts_extract_1_fallback_2",
      "contracts_extract_1_fallback_3"
    ]);
    assert.equal(draft.packetReferences.length, 3);
    assert.deepEqual(events.find((event) => event.event === "contract_chunk_fallback"), {
      event: "contract_chunk_fallback",
      chunkNumber: 1,
      chunkCount: 1,
      segmentCount: 3,
      reasonCode: "contracts_model_draft_invalid"
    });
  });

  test("contracts model extraction stops queued chunks and aborts in-flight calls after failure", async () => {
    const segments = Array.from({ length: 21 }, (_, index) => ({
      segmentId: `p${String(index + 1).padStart(3, "0")}:clause_${index + 1}:0001`,
      pdfPage: index + 1,
      clauseLabel: String(index + 1),
      clauseKey: String(index + 1),
      text: `Clause ${index + 1}: complete the work within 30 days after commencement.`
    }));
    const startedCalls = [];
    const receivedSignals = [];

    await assert.rejects(
      () => extractContractsModelDraft({
        segments,
        pageCount: segments.length,
        unreadablePages: [],
        config: {
          openRouterApiKey: "sk-test",
          models: { main: "test/contracts-model" },
          ai: { main: { maxTokens: 8000, timeoutMs: 60000 } }
        },
        chatComplete: async (options) => {
          startedCalls.push(options.telemetry.callId);
          receivedSignals.push(options.signal);
          if (startedCalls.length === 1) throw new Error("first chunk failed");
          return new Promise((resolve, reject) => {
            const rejectForAbort = () => reject(options.signal.reason || new Error("aborted"));
            if (options.signal.aborted) rejectForAbort();
            else options.signal.addEventListener("abort", rejectForAbort, { once: true });
          });
        }
      }),
      (error) => error.code === "contracts_model_provider_failed" && error.issueCodes.includes("provider.call_failed")
    );

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(startedCalls, ["contracts_extract_1", "contracts_extract_2", "contracts_extract_3"]);
    assert.equal(receivedSignals.length, 3);
    assert.ok(receivedSignals.every((signal) => signal === receivedSignals[0]));
    assert.equal(receivedSignals[0].aborted, true);
  });

  test("contracts model extraction actively aborts in-flight calls at the total deadline", async () => {
    const startedAt = Date.now();
    await assert.rejects(
      () => extractContractsModelDraft({
        segments: [segment("deadline", 1, "1", "1", "Completion is due within 30 days.")],
        pageCount: 1,
        unreadablePages: [],
        config: {
          openRouterApiKey: "configured",
          models: { main: "test/model" },
          ai: { main: { maxTokens: 8000, timeoutMs: 60_000 } }
        },
        deadlineAt: Date.now() + 25,
        chatComplete: async ({ signal }) => new Promise((resolve, reject) => {
          const rejectForAbort = () => reject(signal.reason || new Error("aborted"));
          if (signal.aborted) rejectForAbort();
          else signal.addEventListener("abort", rejectForAbort, { once: true });
        })
      }),
      (error) => error?.code === "contracts_model_time_budget_exceeded"
    );
    assert.ok(Date.now() - startedAt < 1_000);
  });

  test("contracts model extraction retries one transient provider transport failure", async () => {
    const source = segment("retry", 1, "1.1", "1.1", "Complete the work within 30 days after commencement.");
    const calls = [];
    const draft = await extractContractsModelDraft({
      segments: [source],
      pageCount: 1,
      unreadablePages: [],
      config: {
        openRouterApiKey: "sk-test",
        models: { main: "test/contracts-model" },
        ai: { main: { maxTokens: 8000, timeoutMs: 60000 } }
      },
      chatComplete: async (options) => {
        calls.push(options.telemetry.callId);
        if (calls.length === 1) throw new SyntaxError("Unexpected end of JSON input");
        options.telemetry.record({
          status: "done", requested_model: options.model, actual_model: options.model,
          duration_ms: 5, prompt_tokens: 10, completion_tokens: 10, total_tokens: 20,
          cost: 0, finish_reason: "stop", native_finish_reason: "STOP", call_id: options.telemetry.callId
        });
        return JSON.stringify({
          draftVersion: "contracts-model-draft.v1",
          documentObservations: { documentType: "unknown", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
          candidates: [], missingObservations: [], packetReferences: []
        });
      }
    });
    assert.deepEqual(calls, ["contracts_extract_1", "contracts_extract_1_retry"]);
    assert.deepEqual(draft.candidates, []);
  });

  test("contracts model extraction retries one provider response timeout with the configured alternate model", async () => {
    let calls = 0;
    const models = [];
    const draft = await extractContractsModelDraft({
      segments: [segment("timeout", 1, "1", "1", "Complete the work within 30 days after commencement.")],
      pageCount: 1,
      unreadablePages: [],
      config: {
        openRouterApiKey: "configured",
        models: { main: "test/model", lite: "test/fallback-model" },
        ai: { main: { maxTokens: 8000, timeoutMs: 60_000 } }
      },
      chatComplete: async (options) => {
        calls += 1;
        models.push(options.model);
        if (calls === 1) throw new Error("OpenRouter response timed out after 60000ms");
        options.telemetry?.record?.({ status: "done", finish_reason: "stop", native_finish_reason: "stop" });
        return JSON.stringify({
          draftVersion: "contracts-model-draft.v1",
          documentObservations: { documentType: "unknown", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
          candidates: [],
          missingObservations: [],
          packetReferences: []
        });
      }
    });
    assert.equal(calls, 2);
    assert.deepEqual(models, ["test/model", "test/fallback-model"]);
    assert.deepEqual(draft.candidates, []);
  });

  test("contracts model extraction reports a typed provider timeout after both bounded attempts fail", async () => {
    const models = [];
    await assert.rejects(
      () => extractContractsModelDraft({
        segments: [segment("timeout-twice", 1, "1", "1", "Complete the work within 30 days after commencement.")],
        pageCount: 1,
        unreadablePages: [],
        config: {
          openRouterApiKey: "configured",
          models: { main: "test/model", lite: "test/fallback-model" },
          ai: { main: { maxTokens: 8000, timeoutMs: 60_000 } }
        },
        chatComplete: async (options) => {
          models.push(options.model);
          throw new Error("OpenRouter response timed out after 60000ms");
        }
      }),
      (error) => error?.code === "contracts_model_provider_timeout" && error.issueCodes.includes("provider.response_timeout")
    );
    assert.deepEqual(models, ["test/model", "test/fallback-model"]);
  });

  test("contracts model extraction resumes only schema-validated chunks after a later chunk fails", async () => {
    const segments = Array.from({ length: 12 }, (_, index) => segment(
      `resume-${index + 1}`,
      index + 1,
      String(index + 1),
      String(index + 1),
      `Clause ${index + 1}: complete the work within 30 days after commencement.`
    ));
    const chunkResumeCache = new Map();
    const config = {
      openRouterApiKey: "configured",
      models: { main: "test/model", lite: "test/fallback-model" },
      ai: { main: { maxTokens: 8000, timeoutMs: 60_000 } }
    };
    const firstCalls = [];
    await assert.rejects(
      () => extractContractsModelDraft({
        segments,
        pageCount: segments.length,
        unreadablePages: [],
        config,
        chunkResumeCache,
        chatComplete: async (options) => {
          firstCalls.push(options.telemetry.callId);
          if (options.telemetry.callId.startsWith("contracts_extract_4")) {
            throw new Error("OpenRouter response timed out after 60000ms");
          }
          options.telemetry.record({ status: "done", finish_reason: "stop", native_finish_reason: "stop" });
          return emptyContractsModelDraft();
        }
      }),
      (error) => error?.code === "contracts_model_provider_timeout"
    );
    assert.deepEqual(firstCalls.sort(), [
      "contracts_extract_1",
      "contracts_extract_2",
      "contracts_extract_3",
      "contracts_extract_4",
      "contracts_extract_4_retry"
    ]);

    const secondCalls = [];
    const events = [];
    const draft = await extractContractsModelDraft({
      segments,
      pageCount: segments.length,
      unreadablePages: [],
      config,
      chunkResumeCache,
      emit: (event) => events.push(event),
      chatComplete: async (options) => {
        secondCalls.push(options.telemetry.callId);
        options.telemetry.record({ status: "done", finish_reason: "stop", native_finish_reason: "stop" });
        return emptyContractsModelDraft();
      }
    });
    assert.deepEqual(secondCalls, ["contracts_extract_4"]);
    assert.deepEqual(
      events.filter((event) => event.event === "contract_chunk_resumed").map((event) => event.chunkNumber).sort(),
      [1, 2, 3]
    );
    assert.deepEqual(draft.candidates, []);
  });

  test("contracts model chunk resume invalidates when the configured model changes", async () => {
    const source = [segment("resume-model", 1, "1", "1", "Complete the work within 30 days after commencement.")];
    const chunkResumeCache = new Map();
    const calls = [];
    const run = (model) => extractContractsModelDraft({
      segments: source,
      pageCount: 1,
      unreadablePages: [],
      config: {
        openRouterApiKey: "configured",
        models: { main: model, lite: "test/fallback-model" },
        ai: { main: { maxTokens: 8000, timeoutMs: 60_000 } }
      },
      chunkResumeCache,
      chatComplete: async (options) => {
        calls.push(options.model);
        options.telemetry.record({ status: "done", finish_reason: "stop", native_finish_reason: "stop" });
        return emptyContractsModelDraft();
      }
    });
    await run("test/model-a");
    await run("test/model-b");
    assert.deepEqual(calls, ["test/model-a", "test/model-b"]);
  });

  test("contracts cancellation reaches the in-flight OpenRouter request", async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    const cancellation = new Error("contracts cancellation canary");
    let receivedSignal = null;
    let markFetchStarted;
    const fetchStarted = new Promise((resolve) => { markFetchStarted = resolve; });
    globalThis.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
      receivedSignal = options.signal;
      markFetchStarted();
      const rejectForAbort = () => reject(options.signal.reason || new Error("aborted"));
      if (options.signal.aborted) rejectForAbort();
      else options.signal.addEventListener("abort", rejectForAbort, { once: true });
    });
    try {
      const request = chatCompletion({
        apiKey: "sk-test",
        model: "test/contracts-model",
        messages: [{ role: "user", content: "extract" }],
        timeoutMs: 60_000,
        signal: controller.signal
      });
      await fetchStarted;
      controller.abort(cancellation);
      await assert.rejects(request, (error) => error === cancellation);
      assert.ok(receivedSignal instanceof AbortSignal);
      assert.equal(receivedSignal.aborted, true);
      assert.equal(receivedSignal.reason, cancellation);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("contracts draft merger folds cross-reference placeholders and removes absence-only candidates", () => {
    const documentObservations = {
      documentType: "signing_version",
      executionDate: null,
      attachmentsStatus: "unknown",
      contractSiteRaw: null
    };
    const merged = mergeContractsModelDrafts([{
      draftVersion: "contracts-model-draft.v1",
      documentObservations,
      candidates: [
        draftCandidate({
          type: "missing_information",
          roleCode: "contractual_completion",
          action: "Completion duration is defined by the referenced appendix",
          factStatus: "missing",
          evidence: [{ segmentId: "cross-reference", exactQuote: "See Appendix B." }]
        }),
        draftCandidate({
          type: "relative_condition",
          roleCode: "contractual_completion",
          action: "Complete the works",
          trigger: { kind: "commencement", description: "Commencement", eventDate: null },
          offset: { value: 100, unit: "working_day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
          projectionHint: "project_schedule",
          evidence: [{ segmentId: "valued-clause", exactQuote: "Complete within 100 working days." }]
        }),
        draftCandidate({
          type: "missing_information",
          roleCode: "contractual_commencement",
          action: "Commencement date is blank",
          factStatus: "missing",
          evidence: [{ segmentId: "blank-anchor", exactQuote: "Commencement: ____" }]
        })
      ],
      missingObservations: [],
      packetReferences: []
    }]);
    assert.equal(merged.candidates.length, 1);
    assert.equal(merged.candidates[0].roleCode, "contractual_completion");
    assert.deepEqual(merged.candidates[0].evidence.map((item) => item.segmentId).sort(), ["cross-reference", "valued-clause"]);
    assert.deepEqual(merged.missingObservations.map((item) => item.key), ["contractual_commencement_date"]);
  });

  test("contracts compiler creates stable identities and preserves unresolved conflicts", () => {
    const { draft, segments, identity, projectSelection } = contractFixture();
    const first = compileContractDraft({ draft, segments, identity, projectSelection });
    const shuffled = compileContractDraft({
      draft: { ...draft, candidates: [...draft.candidates].reverse() },
      segments,
      identity,
      projectSelection
    });

    assert.equal(first.mode, "dry_run");
    assert.equal(first.document.executionDate, null);
    assert.equal(first.document.executionStatus, "unverified");
    assert.equal(first.document.visibleSignatureStatus, "unknown");
    assert.equal(first.projectBinding.status, "needs_review");
    assert.deepEqual(first.projectBinding.mismatchReasons, ["site_address_number_mismatch", "site_address_text_mismatch"]);
    assert.equal(first.summary.candidateCount, 3);
    assert.equal(first.summary.conflictCount, 1);
    assert.equal(first.summary.computedCompletionDate, null);
    assert.equal(first.summary.approvedScheduleProjectionCount, 0);
    assert.equal(first.summary.calendarStatus, "missing");
    assert.deepEqual(first.candidates.map((candidate) => candidate.candidateKey), shuffled.candidates.map((candidate) => candidate.candidateKey));
    assert.deepEqual(first.conflicts, shuffled.conflicts);

    const charges = first.candidates.filter((candidate) => candidate.role === "daily_delay_charge");
    assert.deepEqual(charges.map((candidate) => candidate.metadata.amount).sort((a, b) => a - b), [2000, 3250]);
    assert.ok(charges.every((candidate) => candidate.type === "consequence"));
    assert.ok(charges.every((candidate) => candidate.projection === "project_schedule"));
    assert.ok(charges.every((candidate) => candidate.factStatus === "conflicting"));
    assert.ok(charges.every((candidate) => !candidate.candidateKey.endsWith("_2000") && !candidate.candidateKey.endsWith("_3250")));
    assert.deepEqual(first.conflicts[0].candidateKeys, charges.map((candidate) => candidate.candidateKey).sort());
    assert.equal(first.conflicts[0].status, "unresolved");
    assert.equal(first.conflicts[0].selectedCandidateKey, null);

    for (const candidate of first.candidates) {
      assert.equal(candidate.computedDate, null);
      assert.equal(candidate.operationalEligibility, "blocked");
      assert.equal(candidate.automaticPromotionAllowed, false);
      assert.equal(candidate.documentVersionId, identity.documentVersionId);
      assert.ok(candidate.sourceEvidence.every((evidence) => evidence.documentSha256 === identity.sha256));
    }
    assert.deepEqual(contractExtractionSchemaErrors(first), []);
  });

  test("contracts compiler rejects ungrounded values and does not conflict complementary notice clocks", () => {
    const fixture = contractFixture();
    const invented = structuredClone(fixture.draft);
    invented.candidates[0].offset.value = 999;
    const corrected = compileContractDraft({ draft: invented, segments: fixture.segments, identity: fixture.identity });
    assert.equal(corrected.candidates.find((candidate) => candidate.role === "contractual_completion").offset.value, 100);

    const segments = [
      segment("mail", 11, "19.12(a)", "19.12a", "Registered mail is deemed received 5 days after sending."),
      segment("email", 12, "19.12(b)", "19.12b", "Email is deemed received 1 business day after sending.")
    ];
    const draft = {
      draftVersion: "contracts-model-draft.v1",
      documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
      candidates: [
        draftCandidate({
          type: "notice_rule",
          roleCode: "notice_service",
          action: "Registered-mail deemed receipt",
          offset: { value: 5, unit: "day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
          evidence: [{ segmentId: "mail", exactQuote: segments[0].text }]
        }),
        draftCandidate({
          type: "notice_rule",
          roleCode: "notice_service",
          action: "Email deemed receipt",
          offset: { value: 1, unit: "working_day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
          evidence: [{ segmentId: "email", exactQuote: segments[1].text }]
        })
      ],
      missingObservations: [],
      packetReferences: []
    };
    const output = compileContractDraft({
      draft,
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    assert.equal(output.candidates.length, 2);
    assert.deepEqual(output.conflicts, []);
  });

  test("contracts compiler preserves only source-grounded party spans", () => {
    const sourceText = "The Contractor shall complete the works for the Owner within 30 days.";
    const segments = [segment("party", 2, "2.1", "2.1", sourceText)];
    const base = draftCandidate({
      responsibleParty: "Contractor",
      beneficiary: "Owner",
      action: "Complete the works",
      offset: { value: 30, unit: "day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
      evidence: [{ segmentId: "party", exactQuote: sourceText }]
    });
    const compile = (candidate) => compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [candidate],
        missingObservations: [],
        packetReferences: []
      },
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    assert.equal(compile(base).candidates[0].responsibleParty, "Contractor");
    const swapped = compile({ ...base, roleCode: "contractual_completion", responsibleParty: "Owner", beneficiary: "Contractor" }).candidates[0];
    assert.equal(swapped.responsibleParty, "Contractor");
    assert.equal(swapped.beneficiary, "Owner");
    assert.ok(!swapped.gates.includes("responsible_party_unverified"));
    assert.ok(!swapped.gates.includes("beneficiary_unverified"));
    const ungrounded = compile({ ...base, responsibleParty: "Project Manager" }).candidates[0];
    assert.equal(ungrounded.responsibleParty, null);
    assert.ok(ungrounded.gates.includes("responsible_party_unverified"));

    const genericNotice = compile({
      ...base,
      roleCode: "notice_service",
      responsibleParty: "Contractor",
      beneficiary: "Owner"
    }).candidates[0];
    assert.equal(genericNotice.responsibleParty, null);
    assert.equal(genericNotice.beneficiary, null);
  });

  test("contracts compiler owns Phase 1 missing-information and packet-gap normalization", () => {
    const segments = [
      segment("references", 1, "1", "1", "The agreement refers to Appendix A bill of quantities, plans and specifications, Appendix C, and Appendix B."),
      segment("appendix-a", 2, "Appendix A heading", "appendix_a.heading", "Appendix A - Scope of works\nThe bill of quantities will be attached."),
      segment("appendix-b", 2, "Appendix B, item 1", "appendix_b.1", "Appendix B is included here.")
    ];
    const output = compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [],
        missingObservations: [
          { key: "final_account_submission_date", field: "candidates", description: "Out of Phase 1 scope", blocks: ["candidates"] },
          { key: "execution_authority", field: "model.field", description: "Model wording", blocks: ["model_block"] }
        ],
        packetReferences: [
          { reference: "Appendix B", status: "missing", impact: "Incorrect model gap" },
          { reference: "Unbounded model reference", status: "missing", impact: "Not compiler-owned" }
        ]
      },
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    assert.deepEqual(output.missingInformation, [{
      key: "execution_authority",
      field: "document.executionStatus",
      description: "Text-layer extraction cannot establish contract execution or visible signatures.",
      blocks: ["operational_projection", "signing_relative_rules"]
    }]);
    assert.deepEqual(output.packetGaps, [
      { reference: "Appendix A bill of quantities", status: "missing", impact: "The referenced scope and quantities cannot be reconciled against this PDF alone." },
      { reference: "Appendix C", status: "missing", impact: "The agreement references an appendix that is not present in the supplied PDF." },
      { reference: "Plans and specifications", status: "missing", impact: "Referenced technical documents are not present in the supplied packet." }
    ]);
  });

  test("contracts compiler prunes unsupported deep optional metadata", () => {
    const sourceText = "Complete the works within 30 days after commencement.";
    const segments = [segment("deep-metadata", 2, "2.1", "2.1", sourceText)];
    const candidate = draftCandidate({
      action: "Complete the works",
      offset: { value: 30, unit: "day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
      evidence: [{ segmentId: "deep-metadata", exactQuote: sourceText }],
      metadata: { explanation: { level2: { level3: { level4: { unsupported: "discard me" } } } } }
    });
    const output = compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [candidate],
        missingObservations: [],
        packetReferences: []
      },
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    assert.equal(output.candidates[0].metadata.explanation.level2.level3.level4.unsupported, null);
  });

  test("contracts compiler owns locked role types, projections, and conservative storage hints", () => {
    const segments = [
      segment("bond", 8, "14.1.3", "14.1.3", "Renew the performance bond at least 45 days before expiry."),
      segment("notice", 12, "19.12", "19.12", "Registered mail is deemed received 5 days after sending."),
      segment("correction", 8, "13.2", "13.2", "Complete corrections within the period the manager will set."),
      segment("relief", 4, "6.6", "6.6", "An owner-requested delay allows an equivalent postponement of completion."),
      segment("inspection", 8, "13.1", "13.1", "Complete the inspection of the works within 14 days after inspection starts.")
    ];
    const draft = {
      draftVersion: "contracts-model-draft.v1",
      documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
      candidates: [
        draftCandidate({
          type: "extension_rule",
          roleCode: "performance_bond_renewal",
          projectionHint: "project_schedule",
          action: "Renew the performance bond",
          offset: { value: 45, unit: "day", direction: "before", inclusivity: "unspecified", rollConvention: "unspecified" },
          evidence: [{ segmentId: "bond", exactQuote: segments[0].text }]
        }),
        draftCandidate({
          type: "consequence",
          roleCode: "notice_service",
          projectionHint: "project_schedule",
          action: "Determine deemed receipt",
          metadata: { temporalSteps: [{ step: 1 }, { step: 2 }] },
          evidence: [{ segmentId: "notice", exactQuote: segments[1].text }]
        }),
        draftCandidate({
          type: "relative_condition",
          roleCode: "manager_set_corrections",
          projectionHint: "contract_compliance",
          action: "Complete corrections in a manager-set period",
          trigger: { kind: "manager_decision", description: "Manager sets the period", eventDate: null },
          offset: { value: null, unit: "unknown", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
          evidence: [{ segmentId: "correction", exactQuote: segments[2].text }]
        }),
        draftCandidate({
          type: "notice_rule",
          roleCode: "owner_requested_delay_relief",
          projectionHint: "contract_compliance",
        action: "Allow equivalent delay relief",
        evidence: [{ segmentId: "relief", exactQuote: segments[3].text }]
      }),
      draftCandidate({
        type: "relative_condition",
        roleCode: "completion_inspection",
        projectionHint: "project_schedule",
        action: "Complete the inspection of the works",
        trigger: { kind: "inspection_start", description: "Inspection starts", eventDate: null },
        offset: { value: 14, unit: "day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
        metadata: { temporalSteps: [{ step: 1 }, { step: 2 }] },
        evidence: [{ segmentId: "inspection", exactQuote: segments[4].text }]
      })
      ],
      missingObservations: [],
      packetReferences: []
    };
    const output = compileContractDraft({
      draft,
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    const byRole = new Map(output.candidates.map((candidate) => [candidate.role, candidate]));
    assert.deepEqual(
      ["performance_bond_renewal", "notice_service", "manager_set_corrections", "owner_requested_delay_relief"].map((role) => ({
        role,
        type: byRole.get(role).type,
        projection: byRole.get(role).projection,
        storage: byRole.get(role).storageDisposition
      })),
      [
        { role: "performance_bond_renewal", type: "relative_condition", projection: "contract_compliance", storage: "dry_run_only" },
        { role: "notice_service", type: "notice_rule", projection: "contract_compliance", storage: "dry_run_only" },
        { role: "manager_set_corrections", type: "missing_information", projection: "project_schedule", storage: "dry_run_only" },
        { role: "owner_requested_delay_relief", type: "extension_rule", projection: "project_schedule", storage: "dry_run_only" }
      ]
    );
    assert.equal(byRole.get("notice_service").metadata.temporalSteps, undefined);
    assert.ok(!byRole.get("notice_service").gates.includes("compound_rule_not_supported"));
    assert.equal(byRole.get("completion_inspection").metadata.temporalSteps, undefined);
    assert.ok(!byRole.get("completion_inspection").gates.includes("compound_rule_not_supported"));
  });

  test("contracts extension storage hint requires an approved grounded calendar-day event", () => {
    const sourceText = "Approval dated 10/02/2027 grants 21 calendar days to the contract completion milestone.";
    const segments = [segment("extension", 3, "4.2", "4.2", sourceText)];
    const baseCandidate = draftCandidate({
      type: "extension_event",
      roleCode: "approved_extension",
      projectionHint: "project_schedule",
      action: "Extend the contract completion milestone",
      evidence: [{ segmentId: "extension", exactQuote: sourceText }],
      metadata: {
        extensionAmount: 21,
        extensionUnit: "calendar_day",
        approvalStatus: "approved",
        approvedDate: "2027-02-10",
        milestoneKey: "contract-completion"
      }
    });
    const compile = (candidate) => compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "amendment", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [candidate],
        missingObservations: [],
        packetReferences: []
      },
      segments,
      identity: { filename: "approval.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    }).candidates[0];

    assert.equal(compile(baseCandidate).storageDisposition, "candidate_for_schedule_contract_extensions");
    assert.equal(compile({
      ...baseCandidate,
      metadata: { ...baseCandidate.metadata, approvalStatus: "pending" }
    }).storageDisposition, "dry_run_only");
    const workingSource = "Approval dated 10/02/2027 grants 21 working days to the contract completion milestone.";
    const workingCandidate = {
      ...baseCandidate,
      evidence: [{ segmentId: "extension", exactQuote: workingSource }],
      metadata: { ...baseCandidate.metadata, extensionUnit: "working_day" }
    };
    const workingOutput = compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "amendment", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [workingCandidate],
        missingObservations: [],
        packetReferences: []
      },
      segments: [segment("extension", 3, "4.2", "4.2", workingSource)],
      identity: { filename: "approval.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    }).candidates[0];
    assert.equal(workingOutput.storageDisposition, "dry_run_only");

    const negativeSource = "Pending approval dated 10/02/2027 grants 21 calendar days to contract completion; it is not approved.";
    const negativeSegments = [segment("extension", 3, "4.2", "4.2", negativeSource)];
    const negativeCandidate = {
      ...baseCandidate,
      evidence: [{ segmentId: "extension", exactQuote: negativeSource }]
    };
    const negativeOutput = compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "amendment", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [negativeCandidate],
        missingObservations: [],
        packetReferences: []
      },
      segments: negativeSegments,
      identity: { filename: "approval.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    }).candidates[0];
    assert.equal(negativeOutput.storageDisposition, "dry_run_only");
  });

  test("contracts material grounding binds each value to its adjacent unit", () => {
    const sourceText = "Complete within 30 days after commencement; a charge of 999 ILS applies.";
    const segments = [segment("mixed", 2, "2.1", "2.1", sourceText)];
    const draft = {
      draftVersion: "contracts-model-draft.v1",
      documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
      candidates: [draftCandidate({
        roleCode: "contractual_completion",
        projectionHint: "project_schedule",
        action: "Complete the works",
        trigger: { kind: "commencement", description: "Commencement", eventDate: null },
        offset: { value: 999, unit: "day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
        evidence: [{ segmentId: "mixed", exactQuote: sourceText }]
      })],
      missingObservations: [],
      packetReferences: []
    };
    const output = compileContractDraft({
      draft,
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    assert.equal(output.candidates[0].offset.value, 30);
  });

  test("contracts material grounding accepts an explicit singular business-day deadline", () => {
    const sourceText = "אם נשלחה בדוא\"ל – אזי בתוך יום עסקים אחר ממועד שליחתה.";
    const segments = [segment("singular-day", 12, "19.12", "19.12", sourceText)];
    const output = compileContractDraft({
      draft: {
        draftVersion: "contracts-model-draft.v1",
        documentObservations: { documentType: "signing_version", executionDate: null, attachmentsStatus: "unknown", contractSiteRaw: null },
        candidates: [draftCandidate({
          type: "notice_rule",
          roleCode: "notice_service",
          action: "Email is deemed received within one business day",
          trigger: { kind: "channel_delivery", description: "Email sending", eventDate: null },
          offset: { value: 1, unit: "working_day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
          evidence: [{ segmentId: "singular-day", exactQuote: sourceText }]
        })],
        missingObservations: [],
        packetReferences: []
      },
      segments,
      identity: { filename: "contract.pdf", sourceId: null, sha256: FIXTURE_SHA, documentVersionId: `sha256:${FIXTURE_SHA}` }
    });
    assert.equal(output.candidates[0].offset, null);
    assert.equal(output.candidates[0].metadata.branches[0].offset.value, 1);
    assert.equal(output.candidates[0].metadata.branches[0].offset.unit, "working_day");
  });

  test("contracts evidence verifier rejects paraphrases and wrong segments", () => {
    const prompt = buildContractsModelMessages({
      segments: [segment("s1", 1, "1", "1", "Exact source sentence.")],
      pageCount: 1,
      unreadablePages: []
    });
    assert.match(prompt[0].content, /return only the exact supplied segmentId/i);
    assert.match(prompt[0].content, /runtime deterministically restores exactQuote/i);
    assert.equal(findGroundedQuote("Exact source sentence.", "Exact source sentence."), "Exact source sentence.");
    assert.equal(
      findGroundedQuote(
        "Notice by \u05f4email\u05f4 is effective only after sending and receipt.",
        'Notice by "email" is effective only after sending and receipt.'
      ),
      "Notice by \u05f4email\u05f4 is effective only after sending and receipt"
    );
    assert.equal(
      findGroundedQuote(
        "The contractor shall notify within eight hours after the event and shall attach supporting records.",
        "The contractor shall notify within eight hours ... shall attach supporting records."
      ),
      "The contractor shall notify within eight hours after the event and shall attach supporting records."
    );
    assert.equal(findGroundedQuote("Exact source sentence.", "Paraphrased sentence."), null);
    assert.equal(
      findGroundedQuote(
        "The contractor shall notify within eight hours after the event.",
        "The contractor must report the incident during the same working day."
      ),
      null
    );

    const { draft, segments, identity } = contractFixture();
    const invalid = structuredClone(draft);
    invalid.candidates[0].evidence[0].exactQuote = "A claim that is not in the source.";
    assert.throws(
      () => compileContractDraft({ draft: invalid, segments, identity }),
      (error) => error.code === "contracts_evidence_not_grounded" && error.status === 502
    );
  });

  test("contracts orchestrator repairs structure once and emits redacted telemetry", async () => {
    const pages = [{ pdfPage: 1, text: "6.7. A delay charge of 2,000 ILS applies per day." }];
    const segments = segmentContractPages(pages);
    const validDraft = {
      draftVersion: "contracts-model-draft.v1",
      documentObservations: {
        documentType: "signing_version",
        executionDate: null,
        attachmentsStatus: "unknown",
        contractSiteRaw: "HaHoshlim 5, Herzliya"
      },
      candidates: [draftCandidate({
        type: "consequence",
        roleCode: "daily_delay_charge",
        action: "Pay a daily charge for delayed completion",
        trigger: { kind: "event", description: "Each delayed day", eventDate: null },
        projectionHint: "project_schedule",
        conflictHint: null,
        evidence: [{ segmentId: segments[0].segmentId, exactQuote: "A delay charge of 2,000 ILS applies per day." }],
        metadata: { value: 2000 }
      })],
      missingObservations: [],
      packetReferences: []
    };
    let calls = 0;
    const events = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("unexpected network call"); };
    try {
      const output = await runContractsDryRun({
        pdfBytes: Buffer.from("%PDF-1.4\nprivate fixture"),
        filename: "Secret contract.pdf",
        config: {
          openRouterApiKey: "sk-test-never-log",
          models: { main: "test/contracts-model" },
          ai: { main: { maxTokens: 8000, timeoutMs: 60000 } }
        },
        readPdf: async () => ({
          readerVersion: "test-reader",
          pageCount: 1,
          extractedCharacters: pages[0].text.length,
          unreadablePages: [],
          pages
        }),
        chatComplete: async (options) => {
          calls += 1;
          options.telemetry?.record?.({
            status: "done",
            requested_model: options.model,
            actual_model: options.model,
            duration_ms: 5,
            prompt_tokens: 10,
            completion_tokens: 10,
            total_tokens: 20,
            cost: 0,
            finish_reason: "stop",
            native_finish_reason: "stop"
          });
          return calls === 1 ? "{}" : JSON.stringify(validDraft);
        },
        emit: (event) => events.push(event)
      });
      assert.equal(calls, 2);
      assert.equal(output.candidates.length, 1);
      assert.equal(output.candidates[0].computedDate, null);
      const serialized = JSON.stringify(events);
      assert.doesNotMatch(serialized, /Secret contract|private fixture|HaHoshlim|2,000|sk-test/);
      assert.match(serialized, /contract_input_validated/);
      assert.match(serialized, /contract_dry_run_completed/);
      assert.equal(safeContractTelemetry("unknown_event", { text: "secret" }), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("contracts orchestrator does not repair a provider-level error response", async () => {
    const pages = [{ pdfPage: 1, text: "The works shall be completed within 30 days after commencement." }];
    let calls = 0;
    await assert.rejects(
      () => runContractsDryRun({
        pdfBytes: Buffer.from("%PDF-1.4\nprivate fixture"),
        filename: "contract.pdf",
        config: {
          openRouterApiKey: "sk-test",
          models: { main: "test/contracts-model" },
          ai: { main: { maxTokens: 8000, timeoutMs: 60000 } }
        },
        readPdf: async () => ({
          readerVersion: "test-reader",
          pageCount: 1,
          extractedCharacters: pages[0].text.length,
          unreadablePages: [],
          pages
        }),
        chatComplete: async (options) => {
          calls += 1;
          options.telemetry?.record?.({
            status: "done",
            requested_model: options.model,
            actual_model: options.model,
            duration_ms: 5,
            prompt_tokens: 10,
            completion_tokens: 1,
            total_tokens: 11,
            cost: 0,
            finish_reason: "error",
            native_finish_reason: null
          });
          return "{}";
        }
      }),
      (error) => error.code === "contracts_model_provider_failed" &&
        error.status === 502 &&
        error.issueCodes.includes("provider.call_failed")
    );
    assert.equal(calls, 1);
  });

  test("contracts gold evaluator enforces schema, evidence, dry-run, and quality gates", () => {
    const gold = JSON.parse(fs.readFileSync(
      new URL("../docs/Indicator + Contracts/gold-set/sample-herzliya-contract.annotation.json", import.meta.url),
      "utf8"
    ));
    assert.equal(gold.extractionVersion, "human-gold.phase1.v4");
    for (const candidate of gold.candidates) {
      assert.ok(candidate.gates.includes("authority_unverified"), `${candidate.role} must remain authority-gated`);
      assert.ok(candidate.gates.includes("human_review_required"), `${candidate.role} must remain human-review-gated`);
      assert.ok(candidate.gates.includes("project_binding_unreviewed"), `${candidate.role} must remain project-binding-gated`);
      assert.equal(new Set(candidate.gates).size, candidate.gates.length, `${candidate.role} gates must be unique`);
    }
    assert.deepEqual(contractExtractionSchemaErrors(gold), []);
    const passing = evaluateContractExtraction({ expected: gold, actual: structuredClone(gold) });
    assert.equal(passing.passed, true);
    assert.equal(passing.metrics.candidateTypeMicroF1, 1);
    assert.equal(passing.metrics.projectionMacroF1, 1);
    assert.equal(passing.metrics.evidenceCoverage, 1);

    const alteredEvidence = structuredClone(gold);
    alteredEvidence.candidates[0].sourceEvidence[0].sourceText += " invented suffix";
    assert.equal(evaluateContractExtraction({ expected: gold, actual: alteredEvidence }).passed, false);

    const unsafe = structuredClone(gold);
    unsafe.candidates[0].computedDate = "2027-01-01";
    const failing = evaluateContractExtraction({ expected: gold, actual: unsafe });
    assert.equal(failing.passed, false);
    assert.equal(failing.hardGates.actualDomainValid, false);
    assert.equal(failing.hardGates.noFalseOperationalEligibility, false);

    const wrongDuration = structuredClone(gold);
    wrongDuration.candidates[0].offset.value = 101;
    const wrongDurationReport = evaluateContractExtraction({ expected: gold, actual: wrongDuration });
    assert.equal(wrongDurationReport.passed, false);
    assert.equal(wrongDurationReport.hardGates.materialFactsExact, false);
    assert.ok(wrongDurationReport.issues.materialFacts.some((issue) => issue.endsWith(":offset")));

    const wrongAmount = structuredClone(gold);
    wrongAmount.candidates.find((candidate) => candidate.role === "daily_delay_charge").metadata.amount = 9999;
    assert.equal(evaluateContractExtraction({ expected: gold, actual: wrongAmount }).hardGates.materialFactsExact, false);

    const resolvedConflict = structuredClone(gold);
    resolvedConflict.conflicts[0].status = "resolved";
    resolvedConflict.conflicts[0].selectedCandidateKey = resolvedConflict.conflicts[0].candidateKeys[0];
    resolvedConflict.conflicts[0].reviewDecision = { reason: "model chose" };
    const resolvedReport = evaluateContractExtraction({ expected: gold, actual: resolvedConflict });
    assert.equal(resolvedReport.passed, false);
    assert.equal(resolvedReport.hardGates.actualDomainValid, false);
    assert.equal(resolvedReport.hardGates.conflictsExact, false);

    const inventedBinding = structuredClone(gold);
    inventedBinding.projectBinding = {
      ...inventedBinding.projectBinding,
      projectId: "invented-project",
      status: "confirmed",
      mismatchReasons: []
    };
    assert.equal(evaluateContractExtraction({ expected: gold, actual: inventedBinding }).hardGates.projectBindingExact, false);

    const wrongPacketStatus = structuredClone(gold);
    wrongPacketStatus.packetGaps[0].status = "present";
    assert.equal(evaluateContractExtraction({ expected: gold, actual: wrongPacketStatus }).hardGates.packetGapsExact, false);

    const unsafeStorage = structuredClone(gold);
    unsafeStorage.candidates.find((candidate) => candidate.role === "owner_requested_delay_relief").storageDisposition = "candidate_for_schedule_contract_extensions";
    assert.equal(evaluateContractExtraction({ expected: gold, actual: unsafeStorage }).hardGates.storageDispositionExact, false);

    const wrongParty = structuredClone(gold);
    wrongParty.candidates[0].responsibleParty = "Wrong party";
    assert.equal(evaluateContractExtraction({ expected: gold, actual: wrongParty }).hardGates.candidateSemanticsExact, false);

    const missingGates = structuredClone(gold);
    missingGates.candidates[0].gates = [];
    assert.equal(evaluateContractExtraction({ expected: gold, actual: missingGates }).hardGates.candidateGatesExact, false);

    const wrongMissingBlock = structuredClone(gold);
    wrongMissingBlock.missingInformation[0].blocks = ["wrong_block"];
    assert.equal(evaluateContractExtraction({ expected: gold, actual: wrongMissingBlock }).hardGates.missingInformationExact, false);
  });

  test("contracts representative set freezes six complete canonical dry-run outputs", () => {
    const input = JSON.parse(fs.readFileSync(
      new URL("../docs/Indicator + Contracts/gold-set/representative-contract-cases.input.json", import.meta.url),
      "utf8"
    ));
    const expected = JSON.parse(fs.readFileSync(
      new URL("../docs/Indicator + Contracts/gold-set/representative-contract-cases.expected.json", import.meta.url),
      "utf8"
    ));
    const report = evaluateRepresentativeCases({ input, expected });
    assert.equal(report.passed, true);
    assert.equal(report.caseCount, 6);
    assert.equal(report.passedCount, 6);

    const changed = structuredClone(input);
    changed.cases[0].draft.candidates[0].action = "A changed review label";
    const changedReport = evaluateRepresentativeCases({ input: changed, expected });
    assert.equal(changedReport.passed, false);
    assert.equal(changedReport.results[0].assertionIssues.length, 0);
  });

  test("contracts Phase 2 promotion planner fails closed on every unapproved global gate", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const plan = planContractPromotions({
      extraction: fixed,
      reviewBatch: approvedReviewBatch(fixed.candidates[0]),
      projectMapping: approvedProjectMapping(fixed),
      gate: {}
    });
    assert.equal(plan.status, "blocked");
    assert.equal(plan.transactionReady, false);
    assert.equal(plan.operationalWritesPerformed, false);
    assert.deepEqual(plan.globalBlockers, [
      "atomic_promotion_not_approved",
      "permission_model_not_approved",
      "project_namespace_not_approved",
      "review_audit_persistence_not_approved",
      "schema_reuse_not_approved"
    ]);
    assert.deepEqual(plan.rowsByTable.schedule_contract_milestones, []);
  });

  test("contracts Phase 2 promotion planner rejects non-UUID project identities before transport", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    fixed.projectBinding.projectId = "project-alpha";
    const mapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({
      extraction: fixed,
      reviewBatch: approvedReviewBatch(fixed.candidates[0]),
      projectMapping: mapping,
      gate: approvedPromotionGate()
    });
    assert.equal(plan.transactionReady, false);
    assert.deepEqual(plan.globalBlockers, ["source_project_id_invalid"]);
    assert.deepEqual(plan.rowsByTable.schedule_contract_milestones, []);
  });

  test("contracts Phase 2 promotion planner maps a reviewed fixed milestone without using a URL as document identity", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    const plan = planContractPromotions({
      extraction: fixed,
      reviewBatch,
      projectMapping: approvedProjectMapping(fixed),
      gate: approvedPromotionGate()
    });
    assert.equal(plan.status, "transaction_ready");
    assert.equal(plan.operationalWritesPerformed, false);
    assert.equal(plan.rowsByTable.schedule_contract_milestones.length, 1);
    const row = plan.rowsByTable.schedule_contract_milestones[0];
    assert.equal(row.project_id, "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5");
    assert.equal(row.milestone_key, "contract-completion");
    assert.equal(row.contract_date, "2027-03-31");
    assert.equal(row.status, "active");
    assert.equal(row.source_document_id, fixed.document.documentVersionId);
    assert.doesNotMatch(row.source_document_id, /^https?:/iu);
    assert.match(row.source_excerpt, /complete the works/iu);
    assert.equal(row.metadata.review_batch_id, "review-batch-1");
  });

  test("contracts Phase 2 promotion planner maps a reviewed unresolved condition to the existing resolver contract", () => {
    const relative = representativeOutput("relative_working_days_missing_calendar");
    const plan = planContractPromotions({
      extraction: relative,
      reviewBatch: approvedReviewBatch(relative.candidates[0]),
      projectMapping: approvedProjectMapping(relative),
      gate: approvedPromotionGate()
    });
    assert.equal(plan.status, "transaction_ready");
    const row = plan.rowsByTable.schedule_contract_conditions[0];
    assert.equal(row.condition_key, relative.candidates[0].candidateKey);
    assert.equal(row.offset_value, 45);
    assert.equal(row.offset_unit, "working_days");
    assert.equal(row.status, "pending");
    assert.equal(row.trigger_event_date, null);
    assert.equal(row.is_project_completion, true);
    assert.match(row.source_excerpt, /working days/iu);
  });

  test("contracts Phase 2 promotion planner maps only a reviewed approved calendar-day extension", () => {
    const extension = representativeOutput("approved_extension_event");
    const candidate = extension.candidates[0];
    const plan = planContractPromotions({
      extraction: extension,
      reviewBatch: approvedReviewBatch(candidate, { milestoneKey: "contract-completion", approvedBy: "Owner representative" }),
      projectMapping: approvedProjectMapping(extension),
      gate: approvedPromotionGate()
    });
    assert.equal(plan.status, "transaction_ready");
    const row = plan.rowsByTable.schedule_contract_extensions[0];
    assert.equal(row.milestone_key, "contract-completion");
    assert.equal(row.extension_days, 21);
    assert.equal(row.approved_date, "2027-02-10");
    assert.equal(row.status, "approved");
    assert.equal(row.source_document_id, extension.document.documentVersionId);
  });

  test("contracts Phase 2 promotion planner keeps rejected and unsupported candidates non-operational", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const rejected = approvedReviewBatch(fixed.candidates[0], { action: "reject" });
    const rejectedPlan = planContractPromotions({
      extraction: fixed,
      reviewBatch: rejected,
      projectMapping: approvedProjectMapping(fixed),
      gate: approvedPromotionGate()
    });
    assert.equal(rejectedPlan.transactionReady, false);
    assert.equal(rejectedPlan.candidatePlans[0].status, "rejected");
    assert.equal(rejectedPlan.audit[0].outcome, "rejected");
    assert.deepEqual(rejectedPlan.rowsByTable.schedule_contract_milestones, []);

    const compliance = representativeOutput("compound_monthly_payment_rule");
    const unsupportedPlan = planContractPromotions({
      extraction: compliance,
      reviewBatch: approvedReviewBatch(compliance.candidates[0]),
      projectMapping: approvedProjectMapping(compliance),
      gate: approvedPromotionGate()
    });
    assert.equal(unsupportedPlan.transactionReady, false);
    assert.ok(unsupportedPlan.candidatePlans[0].blockers.includes("candidate_storage_target_not_operational"));
  });

  test("contracts Phase 2 promotion planner blocks the entire transaction when one reviewed candidate is unsafe", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const compliance = representativeOutput("compound_monthly_payment_rule");
    const unsupportedCandidate = {
      ...structuredClone(compliance.candidates[0]),
      documentVersionId: fixed.document.documentVersionId
    };
    const extraction = {
      ...fixed,
      candidates: [fixed.candidates[0], unsupportedCandidate]
    };
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    reviewBatch.decisions.push({
      candidateKey: unsupportedCandidate.candidateKey,
      action: "approve",
      confidence: 0.98,
      resolvedGates: [...unsupportedCandidate.gates],
      reason: "Candidate reviewed but its target is not operational in Phase 2."
    });
    const plan = planContractPromotions({
      extraction,
      reviewBatch,
      projectMapping: approvedProjectMapping(extraction),
      gate: approvedPromotionGate()
    });
    assert.equal(plan.transactionReady, false);
    assert.deepEqual(plan.rowsByTable.schedule_contract_milestones, []);
    assert.equal(plan.candidatePlans[0].status, "blocked");
    assert.deepEqual(plan.candidatePlans[0].blockers, ["transaction_batch_blocked"]);
    assert.ok(plan.candidatePlans[1].blockers.includes("candidate_storage_target_not_operational"));
  });

  test("contracts Phase 2 promotion planner requires one exclusive conflict winner", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const first = fixed.candidates[0];
    first.factStatus = "conflicting";
    first.conflictGroupId = "completion-date-conflict";
    const second = structuredClone(first);
    second.candidateKey = `${first.candidateKey}-alternative`;
    second.fixedDate = "2027-04-30";
    fixed.candidates = [first, second];
    fixed.conflicts = [{
      conflictGroupId: "completion-date-conflict",
      type: "date_conflict",
      materiality: "high",
      status: "unresolved",
      candidateKeys: [first.candidateKey, second.candidateKey],
      selectedCandidateKey: null,
      reviewDecision: null
    }];
    const reviewBatch = approvedReviewBatch(first, {
      milestoneKey: "contract-completion",
      conflictResolution: { selectedCandidateKey: first.candidateKey, reason: "Selected first date." }
    });
    reviewBatch.decisions.push({
      ...structuredClone(reviewBatch.decisions[0]),
      candidateKey: second.candidateKey,
      conflictResolution: { selectedCandidateKey: second.candidateKey, reason: "Selected second date too." }
    });
    const plan = planContractPromotions({
      extraction: fixed,
      reviewBatch,
      projectMapping: approvedProjectMapping(fixed),
      gate: approvedPromotionGate()
    });
    assert.equal(plan.transactionReady, false);
    assert.ok(plan.candidatePlans.every((item) => item.blockers.includes("conflict_selection_not_exclusive")));
    assert.deepEqual(plan.rowsByTable.schedule_contract_milestones, []);
  });

  test("contracts Phase 2 writer builds a bounded atomic submission from a transaction-ready plan", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    const submission = buildContractPromotionSubmission({ extraction: fixed, reviewBatch, projectMapping, plan });
    assert.equal(submission.submissionVersion, CONTRACTS_PROMOTION_SUBMISSION_VERSION);
    assert.equal(submission.submissionMode, "promotion");
    assert.equal(submission.extraction.document.documentVersionId, fixed.document.documentVersionId);
    assert.equal(submission.plan.operationalWritesPerformed, false);
    assert.equal(submission.plan.rowsByTable.schedule_contract_milestones.length, 1);
    assert.equal(Object.hasOwn(submission.extraction, "missingInformation"), false);
  });

  test("contracts Phase 2 writer persists complete rejection review without pretending to promote", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { action: "reject" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    const submission = buildContractPromotionSubmission({ extraction: fixed, reviewBatch, projectMapping, plan });
    assert.equal(submission.submissionMode, "review_only");
    assert.equal(submission.plan.transactionReady, false);
    assert.equal(submission.plan.audit[0].outcome, "rejected");
  });

  test("contracts Phase 2 classifies only complete rejection batches as review-only", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { action: "reject" });
    const projectMapping = approvedProjectMapping(fixed);
    const rejectedPlan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    assert.equal(contractReviewSubmissionMode(rejectedPlan), CONTRACT_REVIEW_SUBMISSION_MODE.reviewOnly);

    const missingDecisionPlan = planContractPromotions({
      extraction: fixed,
      reviewBatch: { ...reviewBatch, decisions: [] },
      projectMapping,
      gate: approvedPromotionGate()
    });
    assert.equal(contractReviewSubmissionMode(missingDecisionPlan), CONTRACT_REVIEW_SUBMISSION_MODE.blocked);
    assert.throws(
      () => buildContractPromotionSubmission({ extraction: fixed, reviewBatch: { ...reviewBatch, decisions: [] }, projectMapping, plan: missingDecisionPlan }),
      (error) => error.code === "contracts_review_submission_blocked"
    );
  });

  test("contracts Phase 2 review-only transport persists audit with zero Schedule rows", async () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { action: "reject" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    let requestBody = null;
    const result = await submitContractPromotion({
      extraction: fixed,
      reviewBatch,
      projectMapping,
      plan,
      commit: true,
      migrationApplyApproved: true,
      config: { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } },
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: "reviewed_no_promotion",
            batchId: reviewBatch.batchId,
            promotedCount: 0,
            promotions: []
          })
        };
      }
    });
    assert.equal(requestBody.p_submission.submissionMode, "review_only");
    assert.deepEqual(requestBody.p_submission.plan.rowsByTable, {
      schedule_contract_milestones: [],
      schedule_contract_extensions: [],
      schedule_contract_conditions: []
    });
    assert.equal(result.status, "reviewed_no_promotion");
    assert.equal(result.promotedCount, 0);
    assert.equal(result.operationalWritesPerformed, false);
  });

  test("contracts Phase 2 reports a missing promotion RPC as a migration readiness error", async () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { action: "reject" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    await assert.rejects(
      () => submitContractPromotion({
        extraction: fixed,
        reviewBatch,
        projectMapping,
        plan,
        commit: true,
        migrationApplyApproved: true,
        config: { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } },
        fetchImpl: async () => ({
          ok: false,
          status: 404,
          text: async () => JSON.stringify({ code: "PGRST202", message: "Function not found" })
        })
      }),
      (error) => error.code === "contracts_promotion_migration_missing" && error.status === 503
    );
  });

  test("contracts Phase 2 writer refuses unsafe or incompletely reviewed plans", () => {
    const compliance = representativeOutput("compound_monthly_payment_rule");
    const reviewBatch = approvedReviewBatch(compliance.candidates[0]);
    const projectMapping = approvedProjectMapping(compliance);
    const plan = planContractPromotions({ extraction: compliance, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    assert.throws(
      () => buildContractPromotionSubmission({ extraction: compliance, reviewBatch, projectMapping, plan }),
      (error) => error.code === "contracts_promotion_candidate_blocked"
        && error.issueCodes.includes("candidate_storage_target_not_operational")
    );
  });

  test("contracts Phase 2 writer requires both explicit commit and migration-apply approval", async () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    await assert.rejects(
      () => submitContractPromotion({ extraction: fixed, reviewBatch, projectMapping, plan }),
      (error) => error.code === "contracts_promotion_commit_required"
    );
    await assert.rejects(
      () => submitContractPromotion({ extraction: fixed, reviewBatch, projectMapping, plan, commit: true }),
      (error) => error.code === "contracts_promotion_apply_not_approved"
    );
  });

  test("contracts Phase 2 writer calls only the approved APP DATA atomic RPC", async () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    let request = null;
    const result = await submitContractPromotion({
      extraction: fixed,
      reviewBatch,
      projectMapping,
      plan,
      commit: true,
      migrationApplyApproved: true,
      config: { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            status: "committed",
            batchId: reviewBatch.batchId,
            promotedCount: 1,
            promotions: [{ candidateKey: fixed.candidates[0].candidateKey }]
          })
        };
      }
    });
    assert.equal(request.url, `https://kapaim.example/rest/v1/rpc/${CONTRACTS_PROMOTION_RPC}`);
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.apikey, "sb_secret_server");
    assert.equal(request.options.headers.Authorization, undefined);
    const body = JSON.parse(request.options.body);
    assert.equal(body.p_submission.submissionMode, "promotion");
    assert.equal(body.p_submission.plan.operationalWritesPerformed, false);
    assert.equal(result.operationalWritesPerformed, true);
  });

  test("contracts Phase 2 writer surfaces an atomically recorded database rejection", async () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    const projectMapping = approvedProjectMapping(fixed);
    const plan = planContractPromotions({ extraction: fixed, reviewBatch, projectMapping, gate: approvedPromotionGate() });
    await assert.rejects(
      () => submitContractPromotion({
        extraction: fixed,
        reviewBatch,
        projectMapping,
        plan,
        commit: true,
        migrationApplyApproved: true,
        config: { contentSource: { supabaseUrl: "https://kapaim.example", supabaseServiceRoleKey: "sb_secret_server" } },
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: "failed", batchId: reviewBatch.batchId, errorCode: "23505" })
        })
      }),
      (error) => error.code === "contracts_promotion_transaction_failed" && error.issueCodes.includes("23505")
    );
  });

  test("contracts Phase 2 review preparation binds the authenticated reviewer and stays no-I/O", () => {
    const fixed = representativeOutput("signed_fixed_completion");
    const reviewBatch = approvedReviewBatch(fixed.candidates[0], { milestoneKey: "contract-completion" });
    reviewBatch.reviewerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const prepared = prepareContractReview({
      reviewerId: "11111111-1111-4111-8111-111111111111",
      body: {
        extraction: fixed,
        reviewBatch,
        projectMapping: approvedProjectMapping(fixed)
      }
    });
    assert.equal(prepared.reviewBatch.reviewerId, "11111111-1111-4111-8111-111111111111");
    assert.equal(prepared.plan.transactionReady, true);
    assert.equal(prepared.operationalWritesPerformed, false);
    assert.equal(prepared.plan.operationalWritesPerformed, false);
  });

  test("contracts Phase 2 apply approval is exact and fail closed", () => {
    assert.equal(contractsPhase2ApplyApproved({}), false);
    assert.equal(contractsPhase2ApplyApproved({ CONTRACTS_PHASE2_APPLY_APPROVED: "false" }), false);
    assert.equal(contractsPhase2ApplyApproved({ CONTRACTS_PHASE2_APPLY_APPROVED: "1" }), false);
    assert.equal(contractsPhase2ApplyApproved({ CONTRACTS_PHASE2_APPLY_APPROVED: " TRUE " }), true);
  });

  test("contracts Phase 2 SQL package is private, invoker-safe, append-only, and least privilege", () => {
    const proposal = fs.readFileSync(
      new URL("../supabase/contracts-phase2-review-promotion.proposal.sql", import.meta.url),
      "utf8"
    );
    const sql = fs.readFileSync(
      new URL("../supabase/migrations/20260810175150_contracts_phase2_review_promotion.sql", import.meta.url),
      "utf8"
    );
    const privilegeFollowUp = fs.readFileSync(
      new URL("../supabase/migrations/20260810181135_contracts_phase2_restrict_browser_privileges.sql", import.meta.url),
      "utf8"
    );
    const indexFollowUp = fs.readFileSync(
      new URL("../supabase/migrations/20260810183407_contracts_phase2_index_mapping_fk.sql", import.meta.url),
      "utf8"
    );
    assert.match(proposal, /UNAPPLIED PHASE 2 PROPOSAL/i);
    assert.match(sql, /create schema if not exists private/i);
    assert.match(sql, /private\.schedule_contract_project_mappings/i);
    assert.match(sql, /private\.schedule_contract_review_batches/i);
    assert.match(sql, /private\.schedule_contract_review_decisions/i);
    assert.match(sql, /private\.schedule_contract_promotion_attempts/i);
    assert.match(sql, /public\.bidoc_contracts_promote_review_v1\(p_submission jsonb\)/i);
    assert.match(sql, /security invoker\s+set search_path = ''/i);
    assert.doesNotMatch(sql, /security definer/i);
    assert.match(sql, /revoke execute[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant execute[\s\S]*to service_role/i);
    assert.doesNotMatch(sql, /all tables in schema private/i);
    assert.match(sql, /before update or delete[\s\S]*audit_is_immutable/i);
    assert.match(sql, /exception when others[\s\S]*schedule_contract_promotion_attempts/i);
    assert.match(sql, /schedule_contract_milestones/i);
    assert.match(sql, /schedule_contract_extensions/i);
    assert.match(sql, /schedule_contract_conditions/i);
    assert.doesNotMatch(sql, /652bf3e0-9a1e-47ca-b06f-cd8dc33907f7|81b1cbac-8fcf-43c1-acdc-6b5c809de0e5/i);
    assert.match(privilegeFollowUp, /revoke insert, update, delete, truncate, references, trigger/i);
    assert.match(privilegeFollowUp, /from anon, authenticated/i);
    assert.match(indexFollowUp, /schedule_contract_review_batches_mapping_idx/i);
    assert.match(indexFollowUp, /private\.schedule_contract_review_batches \(mapping_id\)/i);
  });

  test("contracts Phase 1 source path has no Schedule or persistence dependency", () => {
    const sources = [
      "../src/subagents/contracts.js",
      "../src/contracts/compiler.js",
      "../src/contracts/pdfReader.js",
      "../src/contracts/request.js",
      "../src/contracts/schema.js",
      "../src/contracts/segmenter.js"
    ].map((file) => fs.readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
    assert.doesNotMatch(sources, /scheduleEngine|scheduleIngestion|scheduleDataRequest|from\s+["'][^"']*supabase/);
    assert.doesNotMatch(sources, /\b(?:insert|upsert|delete|rpc)\s*\(/i);

    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const route = server.slice(server.indexOf('url.pathname === "/api/contracts/extract"'), server.indexOf("Schedule Intelligence Service"));
    assert.match(route, /readJsonBounded/);
    assert.doesNotMatch(route, /buildRequestConfig|runSchedule|supabase|persist|commit/);
  });

  test("contracts server cold start defers the heavy runtime to the extraction route", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const staticImports = server.split(/\r?\n/u).filter((line) => line.startsWith("import ")).join("\n");
    assert.match(staticImports, /from\s+["']\.\/contracts\/constants\.js["']/);
    assert.doesNotMatch(staticImports, /["']\.\/subagents\/contracts\.js["']/);
    assert.doesNotMatch(staticImports, /["']\.\/contracts\/(?:pdfReader|schema)\.js["']/);

    const route = server.slice(
      server.indexOf('url.pathname === "/api/contracts/extract"'),
      server.indexOf("Schedule Intelligence Service")
    );
    assert.match(route, /await import\(["']\.\/subagents\/contracts\.js["']\)/);
    assert.match(route, /await import\(["']\.\/contracts\/response\.js["']\)/);
    assert.match(route, /readJsonBounded\(req, CONTRACTS_MAX_JSON_BYTES\)/);
    assert.match(route, /sendContractsJson\(res, 200, result\)/);
    assert.doesNotMatch(route, /buildRequestConfig|runSchedule|supabase|persist|commit/);

    const constants = fs.readFileSync(new URL("../src/contracts/constants.js", import.meta.url), "utf8");
    assert.doesNotMatch(constants, /^import\s/m);
  });

  test("contracts Phase 2 routes require the reviewer session and server-owned APP DATA config", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const route = server.slice(
      server.indexOf("Contracts Agent Phase 2"),
      server.indexOf('url.pathname === "/api/schedule/indicator"')
    );
    assert.match(route, /getSuperadminSession\(req\)/);
    assert.match(route, /readJsonBounded\(req, CONTRACTS_MAX_JSON_BYTES\)/);
    assert.match(route, /contractsPhase2ApplyApproved\(\)/);
    assert.match(route, /submitContractPromotion/);
    assert.match(route, /config:\s*config\(\)/);
    assert.match(route, /url\.pathname === ["']\/api\/contracts\/review\/save["']/);
    assert.match(route, /body\.persistReview !== true/);
    assert.match(route, /contracts_review_only_not_ready/);
    assert.match(route, /url\.pathname === ["']\/api\/contracts\/review\/commit["']/);
    assert.match(route, /contracts_promotion_not_ready/);
    assert.doesNotMatch(route, /buildRequestConfig/);
    assert.doesNotMatch(route, /x-content-supabase-key|contentSupabaseKey/);
  });

  test("contracts Phase 3E routes are same-origin, bounded, server-owned, and read-only", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const route = server.slice(
      server.indexOf("Contracts Agent Phase 3E"),
      server.indexOf("Contracts Agent Phase 3F")
    );
    assert.match(route, /\/api\/contracts\/activity-mapping\/status/u);
    assert.match(route, /\/api\/contracts\/activity-mapping\/activities/u);
    assert.match(route, /\/api\/contracts\/activity-mapping\/candidates/u);
    assert.match(route, /getSuperadminSession\(req\)/u);
    assert.match(route, /readJsonBounded\(req, CONTRACTS_MAX_JSON_BYTES\)/u);
    assert.match(route, /parseActivityMappingListRequest/u);
    assert.match(route, /parseActivityMappingCandidateRequest/u);
    assert.match(route, /loadContractActivityMappingState/u);
    assert.match(route, /buildContractActivityMappingCandidatesFromSources/u);
    assert.match(route, /config:\s*config\(\)/u);
    assert.doesNotMatch(route, /buildRequestConfig|submitContractPromotion|bidoc_contracts_review_activity_mapping_v1|commit|persist|runSchedule/u);

    const loginWall = server.slice(
      server.indexOf("if (!url.pathname.startsWith"),
      server.indexOf('url.pathname === "/api/chat"')
    );
    assert.match(loginWall, /contracts_activity_mapping_database_override_rejected/u);
    assert.match(loginWall, /x-content-supabase-url/u);
    assert.match(loginWall, /x-content-supabase-key/u);
  });

  test("contracts Phase 3F routes are same-origin, bounded, server-owned, and explicitly gated", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const route = server.slice(
      server.indexOf("Contracts Agent Phase 3F"),
      server.indexOf('url.pathname === "/api/schedule/indicator"')
    );
    assert.match(route, /\/api\/contracts\/activity-mapping\/history/u);
    assert.match(route, /\/api\/contracts\/activity-mapping\/review/u);
    assert.match(route, /getSuperadminSession\(req\)/u);
    assert.match(route, /readJsonBounded\(req, CONTRACTS_MAX_JSON_BYTES\)/u);
    assert.match(route, /parseActivityMappingHistoryRequest/u);
    assert.match(route, /parseActivityMappingReviewRequest/u);
    assert.match(route, /contractsActivityMappingReviewApproved\(\)/u);
    assert.match(route, /reviewerId:\s*reviewer\.sub/u);
    assert.match(route, /config:\s*config\(\)/u);
    assert.doesNotMatch(route, /buildRequestConfig|x-content-supabase-key|contentSupabaseKey|auto_continue/u);
  });

  test("contracts Phase 3F.1 routes are same-origin, bounded, server-owned, and do not write Schedule state", () => {
    const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
    const route = server.slice(
      server.indexOf("Contracts saved-workspace Phase 3F.1"),
      server.indexOf("Contracts Agent Phase 2")
    );
    assert.match(route, /\/api\/contracts\/workspaces\/status/u);
    assert.match(route, /\/api\/contracts\/workspaces\/extract/u);
    assert.match(route, /contractWorkspaceDraftMatch/u);
    assert.match(route, /getSuperadminSession\(req\)/u);
    assert.match(route, /readJsonBounded\(req, CONTRACTS_MAX_JSON_BYTES\)/u);
    assert.match(route, /contractsWorkspacePersistenceApproved\(\)/u);
    assert.match(route, /findSavedContractWorkspace/u);
    assert.match(route, /persistExtractedContractWorkspace/u);
    assert.match(route, /saveContractWorkspaceDraft/u);
    assert.doesNotMatch(route, /runSchedule|scheduleEngine|submitContractPromotion|submitActivityMappingReview/u);

    const loginWall = server.slice(
      server.indexOf("if (!url.pathname.startsWith"),
      server.indexOf('url.pathname === "/api/chat"')
    );
    assert.match(loginWall, /isContractsWorkspaceRoute/u);
    assert.match(loginWall, /contracts_workspace_database_override_rejected/u);
  });

  test("contracts Phase 3F.1 migration keeps workspace data private and extraction immutable", () => {
    const sql = fs.readFileSync(
      new URL("../supabase/migrations/20260812135210_contracts_phase3f1_saved_workspaces.sql", import.meta.url),
      "utf8"
    );
    assert.match(sql, /create table if not exists private\.contract_workspaces/u);
    assert.match(sql, /create table if not exists private\.contract_review_drafts/u);
    assert.match(sql, /alter table private\.contract_workspaces enable row level security/u);
    assert.match(sql, /alter table private\.contract_review_drafts enable row level security/u);
    assert.match(sql, /bidoc_contract_workspace_extraction_is_immutable/u);
    assert.match(sql, /security invoker/iu);
    assert.match(sql, /revoke execute[\s\S]*from public, anon, authenticated, service_role/iu);
    assert.match(sql, /grant execute[\s\S]*to service_role/iu);
    assert.doesNotMatch(sql, /insert\s+into\s+storage\.|update\s+storage\.|delete\s+from\s+storage\./iu);
  });

  test("contracts Phase 3F.1 UI explains blocked zero alternatives and saved-contract reuse in Hebrew", () => {
    const page = fs.readFileSync(new URL("../src/react/ContractsPage.jsx", import.meta.url), "utf8");
    assert.match(page, /החיפוש טרם בוצע/u);
    assert.match(page, /טרם בוצע חיפוש/u);
    assert.match(page, /ראיות האירוע המפעיל נבדקו/u);
    assert.match(page, /החוזה כבר היה שמור/u);
    assert.match(page, /ללא קריאת מודל וללא עלות טוקנים נוספת/u);
    assert.match(page, /פתח והמשך/u);
    assert.match(page, /שומר טיוטה/u);
  });
}

function representativeOutput(id) {
  const input = JSON.parse(fs.readFileSync(
    new URL("../docs/Indicator + Contracts/gold-set/representative-contract-cases.input.json", import.meta.url),
    "utf8"
  ));
  const item = compileRepresentativeCases(input).find((candidate) => candidate.id === id);
  assert.ok(item, `representative case ${id} must exist`);
  const output = structuredClone(item.output);
  output.projectBinding.projectId = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
  return output;
}

function approvedReviewBatch(candidate, decisionOverrides = {}) {
  return {
    batchId: "review-batch-1",
    reviewerId: "11111111-1111-4111-8111-111111111111",
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
      ...decisionOverrides
    }]
  };
}

function approvedProjectMapping(extraction) {
  return {
    sourceProjectId: extraction.projectBinding.projectId,
    scheduleProjectId: "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5",
    sameNamespace: false,
    approved: true,
    approvedBy: "backend-security-owner",
    approvedAt: "2026-08-10T11:55:00.000Z",
    reason: "Explicit reviewed mapping between the MAIN and KAPAIM project namespaces."
  };
}

function approvedPromotionGate() {
  return {
    schemaAuditApproved: true,
    projectNamespaceApproved: true,
    reviewAuditPersistenceApproved: true,
    atomicPromotionApproved: true,
    permissionModelApproved: true
  };
}

function contractFixture() {
  const segments = [
    segment("s-completion-main", 4, "6.1", "6.1", "The contractor shall complete the works under Appendix B."),
    segment("s-completion-appendix", 14, "Appendix B, item 2", "appendix_b.2", "The works shall be completed within 100 working days from commencement."),
    segment("s-charge-main", 5, "6.7", "6.7", "The contractor shall pay 2,000 ILS for every day of delayed completion."),
    segment("s-charge-appendix", 14, "Appendix B, item 3", "appendix_b.3", "The delay charge is 3,250 ILS per day.")
  ];
  const draft = {
    draftVersion: "contracts-model-draft.v1",
    documentObservations: {
      documentType: "signing_version",
      executionDate: "2024-11-19",
      attachmentsStatus: "incomplete",
      contractSiteRaw: "HaHoshlim 5, Herzliya"
    },
    candidates: [
      draftCandidate({
        type: "relative_condition",
        roleCode: "contractual_completion",
        action: "Complete and deliver the works",
        trigger: { kind: "commencement", description: "Reviewed contractual commencement event", eventDate: null },
        offset: { value: 100, unit: "working_day", direction: "after", inclusivity: "unspecified", rollConvention: "unspecified" },
        projectionHint: "project_schedule",
        conflictHint: null,
        evidence: [
          { segmentId: "s-completion-main", exactQuote: "The contractor shall complete the works under Appendix B." },
          { segmentId: "s-completion-appendix", exactQuote: "The works shall be completed within 100 working days from commencement." }
        ],
        metadata: { isProjectCompletion: true, literalDayLabel: "working days" }
      }),
      draftCandidate({
        type: "notice_rule",
        roleCode: "daily_delay_charge",
        action: "Pay a daily charge for delayed completion",
        trigger: { kind: "event", description: "Each delayed day", eventDate: null },
        projectionHint: "both",
        conflictHint: "daily-delay-charge",
        evidence: [{ segmentId: "s-charge-main", exactQuote: "The contractor shall pay 2,000 ILS for every day of delayed completion." }],
        metadata: { amount: 2000, currency: "ILS", rateUnit: "per_day", dayType: "unspecified" }
      }),
      draftCandidate({
        type: "consequence",
        roleCode: "daily_delay_charge",
        action: "Pay a daily charge for delayed completion",
        trigger: { kind: "event", description: "Each delayed day", eventDate: null },
        projectionHint: "project_schedule",
        conflictHint: "daily-delay-charge",
        evidence: [{ segmentId: "s-charge-appendix", exactQuote: "The delay charge is 3,250 ILS per day." }],
        metadata: { amount: 3250, currency: "ILS", rateUnit: "per_day", dayType: "unspecified" }
      })
    ],
    missingObservations: [{
      key: "manager_set_correction_period",
      field: "manager_set_corrections.offset.value",
      description: "The correction period requires a future manager decision.",
      blocks: ["correction_due_date"]
    }],
    packetReferences: [{ reference: "Appendix A bill of quantities", status: "missing", impact: "Scope cannot be reconciled." }]
  };
  return {
    segments,
    draft,
    identity: {
      filename: "contract.pdf",
      sourceId: null,
      sha256: FIXTURE_SHA,
      documentVersionId: `sha256:${FIXTURE_SHA}`
    },
    projectSelection: { projectId: "project-1", projectSite: "HaHoshlim 15, Herzliya", selectedByUser: true }
  };
}

function draftCandidate(overrides) {
  return {
    type: "relative_condition",
    roleCode: "contractual_obligation",
    responsibleParty: null,
    beneficiary: null,
    action: "Perform the obligation",
    trigger: null,
    fixedDate: null,
    offset: null,
    recurrence: null,
    projectionHint: "contract_compliance",
    factStatus: "explicit",
    confidence: 0.9,
    conflictHint: null,
    evidence: [],
    metadata: {},
    ...overrides
  };
}

function segment(segmentId, pdfPage, clauseLabel, clauseKey, text) {
  return { segmentId, pdfPage, clauseLabel, clauseKey, text };
}

function emptyContractsModelDraft() {
  return JSON.stringify({
    draftVersion: "contracts-model-draft.v1",
    documentObservations: {
      documentType: "unknown",
      executionDate: null,
      attachmentsStatus: "unknown",
      contractSiteRaw: null
    },
    candidates: [],
    missingObservations: [],
    packetReferences: []
  });
}

function positionedGlyphs(words) {
  const items = [];
  let x = 100;
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    for (const character of words[wordIndex]) {
      items.push({ str: character, hasEOL: false, width: 5, height: 12, transform: [1, 0, 0, 1, x, 700] });
      x -= 5;
    }
    x -= 3;
  }
  items.at(-1).hasEOL = true;
  return items;
}

function fakePdfLoader({ getPage }) {
  return () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage,
      async destroy() {}
    }),
    async destroy() {}
  });
}

function buildMinimalPdf(text) {
  const escaped = String(text).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}
