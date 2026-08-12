import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadContractActivityMappingState } from "../src/contracts/activityMappingService.js";
import { submitActivityMappingAutoContinuation } from "../src/contracts/activityMappingReview.js";
import {
  applyActivityMappingUploadReconciliation,
  contractsActivityMappingUploadReconciliationApproved,
  parseActivityMappingReconciliationRequest,
  previewActivityMappingUploadReconciliation
} from "../src/contracts/activityMappingReconciliation.js";

const SOURCE_PROJECT_ID = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
const SCHEDULE_PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const PROJECT_MAPPING_ID = "11111111-1111-4111-8111-111111111111";
const CANONICAL_KEY = "schedule-activity:22222222-2222-4222-8222-222222222222";
const PREVIOUS_MAPPING_ID = "33333333-3333-4333-8333-333333333333";
const CURRENT_MAPPING_ID = "44444444-4444-4444-8444-444444444444";
const CONTRACT_MAPPING_ID = "55555555-5555-4555-8555-555555555555";
const REVIEWER_ID = "66666666-6666-4666-8666-666666666666";
const PREVIOUS_EVENT_ID = "77777777-7777-4777-8777-777777777777";
const CURRENT_EVENT_ID = "88888888-8888-4888-8888-888888888888";
const DOCUMENT_VERSION_ID = `sha256:${"a".repeat(64)}`;
const CANDIDATE_KEY = "contract-candidate:completion";
const PREVIOUS_VERSION_ID = "schedule-v1";
const CURRENT_VERSION_ID = "schedule-v2";
const PREVIOUS_ACTIVITY_KEY = `gantt:${PREVIOUS_VERSION_ID}:9`;
const CURRENT_ACTIVITY_KEY = `gantt:${CURRENT_VERSION_ID}:9`;
const PREVIOUS_REVIEWED_AT = "2026-08-11T09:00:00.000Z";
const CURRENT_REVIEWED_AT = "2026-08-12T09:00:00.000Z";

let passed = 0;
let capturedSubmission = null;

async function check(name, run) {
  await run();
  passed += 1;
  process.stdout.write(`ok ${passed} - ${name}\n`);
}

async function rejectsCode(run, code) {
  await assert.rejects(run, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
}

function task(versionId, overrides = {}) {
  return {
    activityKey: `gantt:${versionId}:9`,
    taskUid: 9,
    name: "השלמת ומסירת העבודות",
    outlineLevel: 2,
    isSummary: false,
    isMilestone: true,
    plannedStart: "2026-01-01",
    plannedFinish: "2026-04-10",
    sourceVersionId: versionId,
    ...overrides
  };
}

function mapping(overrides = {}) {
  return {
    mappingId: PREVIOUS_MAPPING_ID,
    canonicalKey: CANONICAL_KEY,
    alias: PREVIOUS_ACTIVITY_KEY,
    aliasSource: "gantt_activity_key",
    matchMethod: "manual_review",
    confidence: 0.97,
    status: "manually_confirmed",
    confirmedBy: REVIEWER_ID,
    confirmedAt: PREVIOUS_REVIEWED_AT,
    createdAt: PREVIOUS_REVIEWED_AT,
    updatedAt: PREVIOUS_REVIEWED_AT,
    ...overrides
  };
}

function baseState(overrides = {}) {
  const currentActivities = [task(CURRENT_VERSION_ID)];
  const previousActivities = [task(PREVIOUS_VERSION_ID)];
  return {
    apiVersion: "contracts-activity-mapping-api.phase3e.v1",
    mode: "read_only",
    projectContext: {
      sourceSystem: "main",
      sourceProjectId: SOURCE_PROJECT_ID,
      scheduleProjectId: SCHEDULE_PROJECT_ID,
      projectMappingId: PROJECT_MAPPING_ID,
      mappingStatus: "active"
    },
    scheduleVersion: {
      fileId: CURRENT_VERSION_ID,
      relevancyDate: "2026-08-12",
      versionConflict: false
    },
    previousScheduleVersion: {
      fileId: PREVIOUS_VERSION_ID,
      relevancyDate: "2026-08-11",
      versionConflict: false
    },
    sourceVersions: [
      {
        fileId: CURRENT_VERSION_ID,
        projectId: SOURCE_PROJECT_ID,
        relevancyDate: "2026-08-12"
      },
      {
        fileId: PREVIOUS_VERSION_ID,
        projectId: SOURCE_PROJECT_ID,
        relevancyDate: "2026-08-11"
      }
    ],
    sourceCompleteness: {
      versionDeclaredCount: 2,
      versionRowsLoaded: 2,
      currentVersionSelectionMatches: true,
      mappingDeclaredCount: 3,
      mappingLoadedCount: 3,
      currentDeclaredTaskCount: currentActivities.length,
      currentLoadedTaskCount: currentActivities.length,
      currentExactTaskCount: currentActivities.length,
      previousDeclaredTaskCount: previousActivities.length,
      previousLoadedTaskCount: previousActivities.length,
      previousExactTaskCount: previousActivities.length
    },
    counts: {
      activities: currentActivities.length,
      previousActivities: previousActivities.length,
      existingMappings: 3
    },
    activities: currentActivities,
    previousActivities,
    existingMappings: [
      mapping(),
      mapping({
        mappingId: "99999999-9999-4999-8999-999999999999",
        alias: "9",
        aliasSource: "gantt_task_uid"
      }),
      mapping({
        mappingId: CONTRACT_MAPPING_ID,
        alias: CANDIDATE_KEY,
        aliasSource: "contracts_candidate"
      })
    ],
    operationalWritesPerformed: false,
    ...overrides
  };
}

function historyEvent(overrides = {}) {
  const event = {
    eventId: PREVIOUS_EVENT_ID,
    eventKey: "activity-mapping-review:previous",
    supersedesEventId: null,
    documentVersionId: DOCUMENT_VERSION_ID,
    candidateKey: CANDIDATE_KEY,
    milestoneKey: "contractual-completion",
    scheduleVersionId: PREVIOUS_VERSION_ID,
    action: "confirm",
    selectedMappingId: PREVIOUS_MAPPING_ID,
    selectedCanonicalKey: CANONICAL_KEY,
    selectedActivityKey: PREVIOUS_ACTIVITY_KEY,
    mappingStatus: "manually_confirmed",
    confidence: 0.97,
    alternatives: [{ activityKey: PREVIOUS_ACTIVITY_KEY }],
    evidence: [{ kind: "contract_source", detail: "clause 6.1", scoreDelta: 0 }],
    conflict: null,
    reviewerId: REVIEWER_ID,
    reviewedAt: PREVIOUS_REVIEWED_AT,
    reason: "אישור ידני מבוסס ראיות חוזיות.",
    createdAt: PREVIOUS_REVIEWED_AT,
    ...overrides
  };
  return {
    ...event,
    result: overrides.result ?? {
      status: "recorded",
      eventKey: event.eventKey,
      action: event.action,
      canonicalKey: event.selectedCanonicalKey,
      mappingRowsChanged: event.action === "auto_continue" ? 1 : 3
    }
  };
}

function baseHistory(events = [historyEvent()], overrides = {}) {
  return {
    historyVersion: "contracts-activity-mapping-history.phase3f.v1",
    projectContext: {
      sourceSystem: "main",
      sourceProjectId: SOURCE_PROJECT_ID,
      scheduleProjectId: SCHEDULE_PROJECT_ID,
      projectMappingId: PROJECT_MAPPING_ID,
      mappingStatus: "active"
    },
    filters: { documentVersionId: null, candidateKey: null, limit: 100 },
    total: events.length,
    returned: events.length,
    events,
    operationalWritesPerformed: false,
    ...overrides
  };
}

function dependencies({ state = baseState(), history = baseHistory() } = {}) {
  return {
    loadStateImpl: async () => structuredClone(state),
    historyLoader: async () => structuredClone(history)
  };
}

await check("request accepts only sourceProjectId", async () => {
  assert.deepEqual(
    parseActivityMappingReconciliationRequest({ body: { sourceProjectId: SOURCE_PROJECT_ID } }),
    { sourceProjectId: SOURCE_PROJECT_ID }
  );
  assert.throws(
    () => parseActivityMappingReconciliationRequest({
      body: { sourceProjectId: SOURCE_PROJECT_ID, action: "auto_continue" }
    }),
    (error) => error?.code === "contracts_activity_mapping_reconciliation_field_unsupported"
  );
  assert.throws(
    () => parseActivityMappingReconciliationRequest({
      body: { sourceProjectId: SOURCE_PROJECT_ID, mappingDraft: {} }
    }),
    (error) => error?.code === "contracts_activity_mapping_reconciliation_field_unsupported"
  );
});

await check("activation flag requires exact TRUE semantics", async () => {
  assert.equal(contractsActivityMappingUploadReconciliationApproved({}), false);
  assert.equal(contractsActivityMappingUploadReconciliationApproved({
    CONTRACTS_PHASE3G_UPLOAD_RECONCILIATION_APPROVED: "true"
  }), true);
  assert.equal(contractsActivityMappingUploadReconciliationApproved({
    CONTRACTS_PHASE3G_UPLOAD_RECONCILIATION_APPROVED: "1"
  }), false);
});

await check("service retains authoritative previous tasks and version", async () => {
  const rows = [
    {
      file_id: CURRENT_VERSION_ID,
      project_id: SOURCE_PROJECT_ID,
      task_count: 1,
      uploaded_at: "2026-08-12T08:00:00.000Z",
      relevancy_date: "2026-08-12"
    },
    {
      file_id: PREVIOUS_VERSION_ID,
      project_id: SOURCE_PROJECT_ID,
      task_count: 1,
      uploaded_at: "2026-08-11T08:00:00.000Z",
      relevancy_date: "2026-08-11"
    }
  ];
  const fetchImpl = async (url) => {
    if (String(url).includes("/rpc/")) {
      return new Response(JSON.stringify(baseState().projectContext), { status: 200 });
    }
    return new Response("[]", { status: 200, headers: { "Content-Range": "*/0" } });
  };
  const state = await loadContractActivityMappingState({
    config: { contentSource: { supabaseUrl: "https://kapaim.invalid", supabaseServiceRoleKey: "server-only" } },
    sourceProjectId: SOURCE_PROJECT_ID,
    fetchImpl,
    includePreviousVersion: true,
    loadScheduleSourceImpl: async () => ({
      tasks: [task(CURRENT_VERSION_ID)],
      previousTasks: [task(PREVIOUS_VERSION_ID)],
      files: rows,
      exactCounts: { files: 2, currentTasks: 1, previousTasks: 1 },
      scheduleMeta: {
        sourceVersionId: CURRENT_VERSION_ID,
        relevancyDate: "2026-08-12",
        versionConflict: false
      }
    })
  });
  assert.equal(state.previousScheduleVersion.fileId, PREVIOUS_VERSION_ID);
  assert.equal(state.previousActivities[0].activityKey, PREVIOUS_ACTIVITY_KEY);
  assert.deepEqual(state.sourceVersions, [
    {
      fileId: CURRENT_VERSION_ID,
      projectId: SOURCE_PROJECT_ID,
      relevancyDate: "2026-08-12"
    },
    {
      fileId: PREVIOUS_VERSION_ID,
      projectId: SOURCE_PROJECT_ID,
      relevancyDate: "2026-08-11"
    }
  ]);
  assert.deepEqual(state.sourceCompleteness, {
    versionDeclaredCount: 2,
    versionRowsLoaded: 2,
    currentVersionSelectionMatches: true,
    mappingDeclaredCount: 0,
    mappingLoadedCount: 0,
    currentDeclaredTaskCount: 1,
    currentLoadedTaskCount: 1,
    currentExactTaskCount: 1,
    previousDeclaredTaskCount: 1,
    previousLoadedTaskCount: 1,
    previousExactTaskCount: 1
  });
});

await check("preview plans one exact server-owned continuation and performs no write", async () => {
  const preview = await previewActivityMappingUploadReconciliation({
    sourceProjectId: SOURCE_PROJECT_ID,
    ...dependencies()
  });
  assert.equal(preview.mode, "preview");
  assert.equal(preview.canApply, true);
  assert.equal(preview.summary.autoConfirmed, 1);
  assert.equal(preview.summary.pendingAutomaticContinuations, 1);
  assert.equal(preview.operations.length, 1);
  assert.equal(preview.operations[0].candidateKey, CANDIDATE_KEY);
  assert.equal(preview.operationalWritesPerformed, false);
  assert.match(preview.operations[0].eventKey, /^activity-mapping-auto-continue:[0-9a-f]{64}$/u);
});

await check("closed Phase 3G gate fails before any source read or write", async () => {
  let reads = 0;
  let writes = 0;
  await rejectsCode(
    () => applyActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      reconciliationApplyApproved: false,
      loadStateImpl: async () => { reads += 1; },
      submitter: async () => { writes += 1; }
    }),
    "contracts_activity_mapping_reconciliation_apply_not_approved"
  );
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

await check("apply owns reviewer null, clock, evidence and atomic RPC submission", async () => {
  const submissions = [];
  const result = await applyActivityMappingUploadReconciliation({
    sourceProjectId: SOURCE_PROJECT_ID,
    reconciliationApplyApproved: true,
    nowImpl: () => new Date("2026-08-12T12:34:56.000Z"),
    ...dependencies(),
    submitter: async ({ submission, reconciliationApplyApproved }) => {
      assert.equal(reconciliationApplyApproved, true);
      submissions.push(structuredClone(submission));
      return {
        result: {
          status: "recorded",
          eventKey: submission.eventKey,
          action: "auto_continue",
          canonicalKey: submission.decision.canonicalKey,
          mappingRowsChanged: 1
        },
        auditWritePerformed: true,
        operationalWritesPerformed: true
      };
    }
  });
  assert.equal(result.status, "recorded");
  assert.equal(submissions.length, 1);
  const submission = submissions[0];
  capturedSubmission = submission;
  assert.equal(submission.decision.action, "auto_continue");
  assert.equal(submission.decision.reviewerId, null);
  assert.equal(submission.decision.reviewedAt, "2026-08-12T12:34:56.000Z");
  assert.equal(submission.decision.previousActivityKey, PREVIOUS_ACTIVITY_KEY);
  assert.equal(submission.decision.activityKey, CURRENT_ACTIVITY_KEY);
  assert.equal(submission.decision.alternatives.length, 1);
  assert.equal(submission.decision.alternatives[0].activityKey, CURRENT_ACTIVITY_KEY);
  assert.equal(submission.decision.evidence[0].detail, PREVIOUS_EVENT_ID);
});

await check("automatic continuation calls only the existing atomic review RPC", async () => {
  assert.ok(capturedSubmission);
  let calledUrl = null;
  let calledBody = null;
  const result = await submitActivityMappingAutoContinuation({
    config: { contentSource: { supabaseUrl: "https://kapaim.invalid", supabaseServiceRoleKey: "server-only" } },
    submission: capturedSubmission,
    reconciliationApplyApproved: true,
    fetchImpl: async (url, options) => {
      calledUrl = String(url);
      calledBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        status: "recorded",
        eventKey: capturedSubmission.eventKey,
        action: "auto_continue",
        canonicalKey: CANONICAL_KEY,
        mappingRowsChanged: 1
      }), { status: 200 });
    }
  });
  assert.match(calledUrl, /\/rest\/v1\/rpc\/bidoc_contracts_review_activity_mapping_v1$/u);
  assert.deepEqual(calledBody, { p_submission: capturedSubmission });
  assert.equal(result.operationalWritesPerformed, true);
});

await check("concurrent atomic write is recovered through deterministic history", async () => {
  let liveState = baseState();
  let liveHistory = baseHistory();
  const result = await applyActivityMappingUploadReconciliation({
    sourceProjectId: SOURCE_PROJECT_ID,
    reconciliationApplyApproved: true,
    nowImpl: () => new Date(CURRENT_REVIEWED_AT),
    loadStateImpl: async () => structuredClone(liveState),
    historyLoader: async () => structuredClone(liveHistory),
    submitter: async ({ submission }) => {
      liveState = baseState({
        existingMappings: [
          ...baseState().existingMappings,
          mapping({
            mappingId: CURRENT_MAPPING_ID,
            alias: CURRENT_ACTIVITY_KEY,
            matchMethod: "exact_uid_continuity",
            status: "auto_confirmed",
            confirmedBy: null,
            confirmedAt: CURRENT_REVIEWED_AT,
            updatedAt: CURRENT_REVIEWED_AT
          })
        ],
        sourceCompleteness: {
          ...baseState().sourceCompleteness,
          mappingDeclaredCount: 4,
          mappingLoadedCount: 4
        }
      });
      liveHistory = baseHistory([
        historyEvent({
          eventId: CURRENT_EVENT_ID,
          eventKey: submission.eventKey,
          scheduleVersionId: CURRENT_VERSION_ID,
          action: "auto_continue",
          selectedMappingId: CURRENT_MAPPING_ID,
          selectedActivityKey: CURRENT_ACTIVITY_KEY,
          mappingStatus: "auto_confirmed",
          reviewerId: null,
          reviewedAt: CURRENT_REVIEWED_AT,
          createdAt: CURRENT_REVIEWED_AT,
          result: {
            status: "recorded",
            eventKey: submission.eventKey,
            action: "auto_continue",
            canonicalKey: CANONICAL_KEY,
            mappingRowsChanged: 1
          }
        }),
        historyEvent()
      ]);
      const error = new Error("concurrent event won");
      error.code = "contracts_activity_mapping_reconciliation_conflict";
      throw error;
    }
  });
  assert.equal(result.status, "recorded");
  assert.equal(result.results[0].status, "recorded_after_race");
  assert.equal(result.results[0].operationalWritesPerformed, true);
});

await check("rerun is idempotent when current alias already has immutable history", async () => {
  const initial = await previewActivityMappingUploadReconciliation({
    sourceProjectId: SOURCE_PROJECT_ID,
    ...dependencies()
  });
  const eventKey = initial.operations[0].eventKey;
  const currentMapping = mapping({
    mappingId: CURRENT_MAPPING_ID,
    alias: CURRENT_ACTIVITY_KEY,
    matchMethod: "exact_uid_continuity",
    status: "auto_confirmed",
    confirmedBy: null,
    confirmedAt: CURRENT_REVIEWED_AT,
    updatedAt: CURRENT_REVIEWED_AT
  });
  const state = baseState({
    existingMappings: [...baseState().existingMappings, currentMapping],
    sourceCompleteness: {
      ...baseState().sourceCompleteness,
      mappingDeclaredCount: 4,
      mappingLoadedCount: 4
    }
  });
  const currentEvent = historyEvent({
    eventId: CURRENT_EVENT_ID,
    eventKey,
    scheduleVersionId: CURRENT_VERSION_ID,
    action: "auto_continue",
    selectedMappingId: CURRENT_MAPPING_ID,
    selectedActivityKey: CURRENT_ACTIVITY_KEY,
    mappingStatus: "auto_confirmed",
    reviewerId: null,
    reviewedAt: CURRENT_REVIEWED_AT,
    createdAt: CURRENT_REVIEWED_AT
  });
  let writes = 0;
  const result = await applyActivityMappingUploadReconciliation({
    sourceProjectId: SOURCE_PROJECT_ID,
    reconciliationApplyApproved: true,
    ...dependencies({ state, history: baseHistory([currentEvent, historyEvent()]) }),
    submitter: async () => { writes += 1; }
  });
  assert.equal(result.status, "no_changes");
  assert.equal(result.summary.alreadyRecorded, 1);
  assert.equal(result.results[0].status, "already_recorded");
  assert.equal(writes, 0);
});

await check("existing human-confirmed current alias is preserved without automation overwrite", async () => {
  const currentMapping = mapping({
    mappingId: CURRENT_MAPPING_ID,
    alias: CURRENT_ACTIVITY_KEY,
    confirmedAt: CURRENT_REVIEWED_AT,
    updatedAt: CURRENT_REVIEWED_AT
  });
  const state = baseState({
    existingMappings: [...baseState().existingMappings, currentMapping],
    sourceCompleteness: {
      ...baseState().sourceCompleteness,
      mappingDeclaredCount: 4,
      mappingLoadedCount: 4
    }
  });
  const currentEvent = historyEvent({
    eventId: CURRENT_EVENT_ID,
    eventKey: "activity-mapping-review:current-human",
    scheduleVersionId: CURRENT_VERSION_ID,
    selectedMappingId: CURRENT_MAPPING_ID,
    selectedActivityKey: CURRENT_ACTIVITY_KEY,
    reviewedAt: CURRENT_REVIEWED_AT,
    createdAt: CURRENT_REVIEWED_AT
  });
  let writes = 0;
  const result = await applyActivityMappingUploadReconciliation({
    sourceProjectId: SOURCE_PROJECT_ID,
    reconciliationApplyApproved: true,
    ...dependencies({ state, history: baseHistory([currentEvent, historyEvent()]) }),
    submitter: async () => { writes += 1; }
  });
  assert.equal(result.status, "no_changes");
  assert.equal(result.results[0].recordedEventKey, "activity-mapping-review:current-human");
  assert.equal(writes, 0);
});

await check("current human reject or unmapped decision blocks preview", async () => {
  for (const action of ["reject", "unmapped"]) {
    const decision = historyEvent({
      eventId: action === "reject"
        ? "abababab-abab-4bab-8bab-abababababab"
        : "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      eventKey: `phase3g-current-${action}`,
      scheduleVersionId: CURRENT_VERSION_ID,
      action,
      selectedMappingId: null,
      selectedCanonicalKey: null,
      selectedActivityKey: null,
      mappingStatus: null,
      confidence: 0,
      reviewerId: REVIEWER_ID,
      reviewedAt: CURRENT_REVIEWED_AT,
      createdAt: CURRENT_REVIEWED_AT,
      result: {
        status: "recorded",
        eventKey: `phase3g-current-${action}`,
        action,
        canonicalKey: null,
        mappingRowsChanged: 0
      }
    });
    await rejectsCode(
      () => previewActivityMappingUploadReconciliation({
        sourceProjectId: SOURCE_PROJECT_ID,
        ...dependencies({ history: baseHistory([decision, historyEvent()]) })
      }),
      "contracts_activity_mapping_reconciliation_human_decision_exists"
    );
  }
});

await check("truncated immutable history fails closed", async () => {
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ history: baseHistory([historyEvent()], { total: 2, returned: 1 }) })
    }),
    "contracts_activity_mapping_reconciliation_history_truncated"
  );
});

await check("missing immutable provenance fails closed", async () => {
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ history: baseHistory([]) })
    }),
    "contracts_activity_mapping_reconciliation_history_ambiguous"
  );
});

await check("incomplete authoritative task reads fail closed", async () => {
  const state = baseState();
  state.sourceCompleteness.currentDeclaredTaskCount = 2;
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_source_incomplete"
  );
});

await check("partial MAIN version or task reads fail closed against exact counts", async () => {
  for (const mutate of [
    (state) => { state.sourceCompleteness.versionDeclaredCount = 3; },
    (state) => { state.sourceCompleteness.currentExactTaskCount = 2; },
    (state) => { state.sourceCompleteness.previousExactTaskCount = 2; }
  ]) {
    const state = baseState();
    mutate(state);
    await rejectsCode(
      () => previewActivityMappingUploadReconciliation({
        sourceProjectId: SOURCE_PROJECT_ID,
        ...dependencies({ state })
      }),
      "contracts_activity_mapping_reconciliation_source_incomplete"
    );
  }
});

await check("malformed MAIN file row fails closed even when exact counts match", async () => {
  const state = baseState();
  state.sourceVersions.push({
    fileId: null,
    projectId: SOURCE_PROJECT_ID,
    relevancyDate: "2026-08-10"
  });
  state.sourceCompleteness.versionDeclaredCount = 3;
  state.sourceCompleteness.versionRowsLoaded = 3;
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_source_file_invalid"
  );
});

await check("MAIN file row from another project fails closed", async () => {
  const state = baseState();
  state.sourceVersions[1].projectId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_source_file_invalid"
  );
});

await check("non-adjacent duplicate MAIN file identity fails closed", async () => {
  const state = baseState();
  state.sourceVersions.push({
    fileId: CURRENT_VERSION_ID,
    projectId: SOURCE_PROJECT_ID,
    relevancyDate: "2026-08-10"
  });
  state.sourceCompleteness.versionDeclaredCount = 3;
  state.sourceCompleteness.versionRowsLoaded = 3;
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_source_file_invalid"
  );
});

await check("partial KAPAIM mapping read below any assumed row cap fails closed", async () => {
  const state = baseState();
  state.sourceCompleteness.mappingDeclaredCount = 4;
  state.sourceCompleteness.mappingLoadedCount = 3;
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_source_incomplete"
  );
});

await check("ambiguous Schedule version fails closed", async () => {
  const state = baseState();
  state.previousScheduleVersion.versionConflict = true;
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_version_ambiguous"
  );
});

await check("undated previous version selection fails closed", async () => {
  const state = baseState();
  state.previousScheduleVersion.versionConflict = true;
  state.previousScheduleVersion.relevancyDate = null;
  await rejectsCode(
    () => previewActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      ...dependencies({ state })
    }),
    "contracts_activity_mapping_reconciliation_version_ambiguous"
  );
});

await check("undated or non-forward current version fails closed", async () => {
  for (const relevancyDate of [null, "2026-08-11", "invalid-date"]) {
    const state = baseState();
    state.scheduleVersion.relevancyDate = relevancyDate;
    await rejectsCode(
      () => previewActivityMappingUploadReconciliation({
        sourceProjectId: SOURCE_PROJECT_ID,
        ...dependencies({ state })
      }),
      "contracts_activity_mapping_reconciliation_version_dates_invalid"
    );
  }
});

await check("unrelated duplicate UID in either version blocks every continuation", async () => {
  for (const side of ["activities", "previousActivities"]) {
    const state = baseState();
    const versionId = side === "activities" ? CURRENT_VERSION_ID : PREVIOUS_VERSION_ID;
    state[side].push(task(versionId, {
      activityKey: `gantt:${versionId}:17`,
      taskUid: 17,
      name: "פעילות אחרת"
    }));
    state[side].push(task(versionId, {
      activityKey: `gantt:${versionId}:17`,
      taskUid: 17,
      name: "כפילות לא קשורה"
    }));
    const prefix = side === "activities" ? "current" : "previous";
    state.sourceCompleteness[`${prefix}DeclaredTaskCount`] = 3;
    state.sourceCompleteness[`${prefix}LoadedTaskCount`] = 3;
    state.sourceCompleteness[`${prefix}ExactTaskCount`] = 3;
    await rejectsCode(
      () => previewActivityMappingUploadReconciliation({
        sourceProjectId: SOURCE_PROJECT_ID,
        ...dependencies({ state })
      }),
      "contracts_activity_mapping_reconciliation_source_identity_ambiguous"
    );
  }
});

await check("duplicate current UID blocks apply before the atomic RPC", async () => {
  const state = baseState();
  state.activities.push(task(CURRENT_VERSION_ID));
  state.sourceCompleteness.currentDeclaredTaskCount = 2;
  state.sourceCompleteness.currentLoadedTaskCount = 2;
  state.sourceCompleteness.currentExactTaskCount = 2;
  let writes = 0;
  await rejectsCode(
    () => applyActivityMappingUploadReconciliation({
      sourceProjectId: SOURCE_PROJECT_ID,
      reconciliationApplyApproved: true,
      ...dependencies({ state }),
      submitter: async () => { writes += 1; }
    }),
    "contracts_activity_mapping_reconciliation_source_identity_ambiguous"
  );
  assert.equal(writes, 0);
});

await check("orchestrator contains no Schedule arithmetic or alert writer", async () => {
  const sourcePath = fileURLToPath(new URL("../src/contracts/activityMappingReconciliation.js", import.meta.url));
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(source, /scheduleEngine|scheduleCalendar|schedule_alerts|emitScheduleAlert|createScheduleAlert/u);
});

process.stdout.write(`Phase 3G verifier passed: ${passed}/${passed}\n`);
