export const CONTRACTS_PROMOTION_PLANNER_VERSION = "contracts-promotion-planner.phase2.v1";

const REQUIRED_GLOBAL_APPROVALS = Object.freeze({
  schemaAuditApproved: "schema_reuse_not_approved",
  projectNamespaceApproved: "project_namespace_not_approved",
  reviewAuditPersistenceApproved: "review_audit_persistence_not_approved",
  atomicPromotionApproved: "atomic_promotion_not_approved",
  permissionModelApproved: "permission_model_not_approved"
});

const TARGET_BY_DISPOSITION = Object.freeze({
  candidate_for_schedule_contract_milestones: "schedule_contract_milestones",
  candidate_for_schedule_contract_extensions: "schedule_contract_extensions",
  candidate_for_schedule_contract_conditions: "schedule_contract_conditions"
});

const REVIEW_RESOLVABLE_GATES = new Set([
  "authority_unverified",
  "beneficiary_unverified",
  "entitlement_review_required",
  "existing_milestone_identity_required",
  "extension_approval_review_required",
  "human_review_required",
  "project_binding_unreviewed",
  "responsible_party_unverified"
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

export function planContractPromotions({ extraction, reviewBatch, projectMapping, gate = {} } = {}) {
  const globalBlockers = globalPromotionBlockers({ extraction, reviewBatch, projectMapping, gate });
  const candidates = Array.isArray(extraction?.candidates) ? extraction.candidates : [];
  const decisions = normalizedDecisions(reviewBatch?.decisions);
  const conflicts = new Map((extraction?.conflicts || []).map((conflict) => [conflict.conflictGroupId, conflict]));
  const audit = [];
  const candidatePlans = [];

  for (const candidate of candidates) {
    const decision = decisions.byCandidate.get(candidate.candidateKey) || null;
    if (!decision) {
      candidatePlans.push(blockedCandidate(candidate, "review_decision_missing"));
      continue;
    }
    if (decision.action === "reject") {
      audit.push(reviewAuditRecord(candidate, decision, reviewBatch, "rejected", null));
      candidatePlans.push({ candidateKey: candidate.candidateKey, status: "rejected", targetTable: null, blockers: [], row: null });
      continue;
    }
    const targetTable = TARGET_BY_DISPOSITION[candidate.storageDisposition] || null;
    const blockers = candidatePromotionBlockers({ candidate, decision, targetTable, conflicts, decisions });
    const row = blockers.length || globalBlockers.length
      ? null
      : promotionRow({ candidate, decision, reviewBatch, projectMapping, targetTable });
    const status = row ? "transaction_ready" : "blocked";
    candidatePlans.push({ candidateKey: candidate.candidateKey, status, targetTable, blockers, row });
    audit.push(reviewAuditRecord(candidate, decision, reviewBatch, row ? "approved_for_transaction" : "approval_blocked", targetTable));
  }

  for (const candidateKey of decisions.unknownCandidateKeys(candidates)) {
    globalBlockers.push(`unknown_review_candidate:${candidateKey}`);
  }
  if (decisions.duplicateCandidateKeys.length) {
    globalBlockers.push(...decisions.duplicateCandidateKeys.map((candidateKey) => `duplicate_review_decision:${candidateKey}`));
  }

  const uniqueGlobalBlockers = [...new Set(globalBlockers)].sort();
  const readyPlans = candidatePlans.filter((plan) => plan.status === "transaction_ready");
  const blockedReviewedPlan = candidatePlans.some((plan) =>
    plan.status === "blocked" && !plan.blockers.includes("review_decision_missing")
  );
  const rowsByTable = {
    schedule_contract_milestones: [],
    schedule_contract_extensions: [],
    schedule_contract_conditions: []
  };
  if (!uniqueGlobalBlockers.length) {
    for (const plan of readyPlans) rowsByTable[plan.targetTable].push(plan.row);
  }
  const transactionReady = uniqueGlobalBlockers.length === 0 && readyPlans.length > 0 && !blockedReviewedPlan;
  return {
    plannerVersion: CONTRACTS_PROMOTION_PLANNER_VERSION,
    status: transactionReady ? "transaction_ready" : "blocked",
    transactionReady,
    operationalWritesPerformed: false,
    globalBlockers: uniqueGlobalBlockers,
    candidatePlans: transactionReady
      ? candidatePlans
      : candidatePlans.map((plan) => plan.status === "transaction_ready"
        ? { ...plan, status: "blocked", blockers: ["transaction_batch_blocked"], row: null }
        : plan),
    rowsByTable: transactionReady ? rowsByTable : emptyRowsByTable(),
    audit
  };
}

function globalPromotionBlockers({ extraction, reviewBatch, projectMapping, gate }) {
  const blockers = [];
  for (const [key, code] of Object.entries(REQUIRED_GLOBAL_APPROVALS)) {
    if (gate?.[key] !== true) blockers.push(code);
  }
  if (extraction?.mode !== "dry_run") blockers.push("source_extraction_mode_invalid");
  if (!String(extraction?.document?.documentVersionId || "").startsWith("sha256:")) blockers.push("document_version_missing");
  if (!reviewBatch || typeof reviewBatch !== "object") blockers.push("review_batch_missing");
  if (!String(reviewBatch?.batchId || "").trim()) blockers.push("review_batch_id_missing");
  if (!UUID_PATTERN.test(String(reviewBatch?.reviewerId || ""))) blockers.push("reviewer_identity_invalid");
  if (!ISO_TIMESTAMP_PATTERN.test(String(reviewBatch?.reviewedAt || ""))) blockers.push("review_timestamp_invalid");
  if (String(reviewBatch?.reason || "").trim().length < 10) blockers.push("review_reason_insufficient");
  if (reviewBatch?.documentAuthority !== "authoritative") blockers.push("document_authority_not_approved");
  if (!projectMapping || typeof projectMapping !== "object") blockers.push("project_mapping_missing");
  if (projectMapping?.approved !== true) blockers.push("project_mapping_not_approved");
  if (!UUID_PATTERN.test(String(projectMapping?.scheduleProjectId || ""))) blockers.push("schedule_project_id_invalid");
  if (!String(projectMapping?.sourceProjectId || "").trim()) blockers.push("source_project_id_missing");
  else if (!UUID_PATTERN.test(String(projectMapping.sourceProjectId))) blockers.push("source_project_id_invalid");
  if (String(projectMapping?.sourceProjectId || "") !== String(extraction?.projectBinding?.projectId || "")) blockers.push("source_project_binding_mismatch");
  if (!String(projectMapping?.approvedBy || "").trim()) blockers.push("project_mapping_approver_missing");
  if (!ISO_TIMESTAMP_PATTERN.test(String(projectMapping?.approvedAt || ""))) blockers.push("project_mapping_timestamp_invalid");
  if (projectMapping?.sameNamespace !== true && String(projectMapping?.reason || "").trim().length < 10) blockers.push("cross_database_mapping_reason_missing");
  return blockers;
}

function candidatePromotionBlockers({ candidate, decision, targetTable, conflicts, decisions }) {
  const blockers = [];
  if (decision.action !== "approve") blockers.push("unsupported_review_action");
  if (!targetTable) blockers.push("candidate_storage_target_not_operational");
  if (!Number.isFinite(Number(decision.confidence)) || Number(decision.confidence) < 0 || Number(decision.confidence) > 1) blockers.push("review_confidence_invalid");
  const resolvedGates = new Set(Array.isArray(decision.resolvedGates) ? decision.resolvedGates : []);
  for (const gate of candidate.gates || []) {
    if (REVIEW_RESOLVABLE_GATES.has(gate) && !resolvedGates.has(gate)) blockers.push(`review_gate_unresolved:${gate}`);
  }
  if (!Array.isArray(candidate.sourceEvidence) || candidate.sourceEvidence.length === 0 || candidate.sourceEvidence.some((item) => !String(item?.sourceText || "").trim())) {
    blockers.push("exact_evidence_missing");
  }
  if (candidate.factStatus === "conflicting" || candidate.conflictGroupId) {
    const conflict = conflicts.get(candidate.conflictGroupId);
    const groupKeys = Array.isArray(conflict?.candidateKeys) ? conflict.candidateKeys : [];
    const groupDecisions = groupKeys.map((candidateKey) => decisions.byCandidate.get(candidateKey) || null);
    const approvedKeys = groupKeys.filter((candidateKey) => decisions.byCandidate.get(candidateKey)?.action === "approve");
    if (!conflict
      || groupKeys.length < 2
      || groupDecisions.some((item) => !item)
      || decision.conflictResolution?.selectedCandidateKey !== candidate.candidateKey
      || !String(decision.conflictResolution?.reason || "").trim()) {
      blockers.push("conflict_review_missing");
    }
    if (approvedKeys.length !== 1 || approvedKeys[0] !== candidate.candidateKey) {
      blockers.push("conflict_selection_not_exclusive");
    }
  }
  if (targetTable === "schedule_contract_milestones" && !ISO_DATE_PATTERN.test(String(candidate.fixedDate || ""))) blockers.push("fixed_milestone_date_invalid");
  if (targetTable === "schedule_contract_conditions") {
    if (!candidate.trigger?.description) blockers.push("condition_anchor_missing");
    if (!Number.isFinite(Number(candidate.offset?.value)) || Number(candidate.offset?.value) < 0) blockers.push("condition_offset_invalid");
    if (candidate.offset?.direction !== "after") blockers.push("condition_direction_not_supported");
    if (!conditionOffsetUnit(candidate, decision)) blockers.push("condition_offset_unit_not_approved");
  }
  if (targetTable === "schedule_contract_extensions") {
    const metadata = candidate.metadata || {};
    if (!Number.isInteger(Number(metadata.extensionAmount)) || Number(metadata.extensionAmount) <= 0) blockers.push("extension_days_invalid");
    if (metadata.extensionUnit !== "calendar_day") blockers.push("extension_unit_not_supported");
    if (metadata.approvalStatus !== "approved" || !ISO_DATE_PATTERN.test(String(metadata.approvedDate || ""))) blockers.push("extension_approval_invalid");
    if (!String(decision.milestoneKey || metadata.milestoneKey || "").trim()) blockers.push("extension_milestone_identity_missing");
  }
  return [...new Set(blockers)].sort();
}

function promotionRow({ candidate, decision, reviewBatch, projectMapping, targetTable }) {
  const common = {
    project_id: projectMapping.scheduleProjectId,
    confidence: Number(decision.confidence),
    written_by: "contracts_agent_phase2_review",
    metadata: promotionMetadata(candidate, decision, reviewBatch, projectMapping)
  };
  const sourceExcerpt = candidate.sourceEvidence.map((item) => item.sourceText).join("\n\n").slice(0, 4000);
  if (targetTable === "schedule_contract_milestones") {
    return {
      ...common,
      milestone_key: String(decision.milestoneKey || candidate.candidateKey),
      name: candidate.action,
      contract_date: candidate.fixedDate,
      is_project_completion: ["fixed_completion", "contractual_completion"].includes(candidate.role),
      activity_key: null,
      status: "active",
      source_document_id: candidate.documentVersionId,
      source_excerpt: sourceExcerpt,
      extractor_version: reviewBatch.extractorVersion || null
    };
  }
  if (targetTable === "schedule_contract_extensions") {
    return {
      ...common,
      milestone_key: String(decision.milestoneKey || candidate.metadata.milestoneKey),
      extension_days: Number(candidate.metadata.extensionAmount),
      approved_date: candidate.metadata.approvedDate,
      approved_by: String(decision.approvedBy || reviewBatch.reviewerId),
      status: "approved",
      source_document_id: candidate.documentVersionId,
      source_excerpt: sourceExcerpt
    };
  }
  return {
    ...common,
    condition_key: candidate.candidateKey,
    name: candidate.action,
    category: candidate.role,
    anchor_kind: candidate.trigger?.kind || "event",
    anchor_description: candidate.trigger.description,
    offset_value: Number(candidate.offset.value),
    offset_unit: conditionOffsetUnit(candidate, decision),
    recurring: false,
    status: "pending",
    resolved_milestone_key: null,
    trigger_source_table: null,
    trigger_source_id: null,
    trigger_event_date: null,
    is_project_completion: candidate.role === "contractual_completion",
    penalty_ils_per_day: null,
    source_page: candidate.sourceEvidence[0]?.pdfPage || null,
    source_excerpt: sourceExcerpt
  };
}

function promotionMetadata(candidate, decision, reviewBatch, projectMapping) {
  return {
    contracts_candidate_key: candidate.candidateKey,
    document_version_id: candidate.documentVersionId,
    review_batch_id: reviewBatch.batchId,
    reviewer_id: reviewBatch.reviewerId,
    reviewed_at: reviewBatch.reviewedAt,
    review_reason: reviewBatch.reason,
    resolved_gates: [...new Set(decision.resolvedGates || [])].sort(),
    source_project_id: projectMapping.sourceProjectId,
    project_mapping_approved_by: projectMapping.approvedBy,
    project_mapping_approved_at: projectMapping.approvedAt,
    evidence_locations: candidate.sourceEvidence.map((item) => ({ pdf_page: item.pdfPage, clause: item.clause }))
  };
}

function conditionOffsetUnit(candidate, decision) {
  switch (candidate.offset?.unit) {
    case "working_day": return "working_days";
    case "calendar_day": return "calendar_days";
    case "week": return "weeks";
    case "month": return "months";
    case "hour": return "hours";
    case "day": return decision.calendarSemantics === "calendar_days" ? "calendar_days" : null;
    default: return null;
  }
}

function normalizedDecisions(values) {
  const byCandidate = new Map();
  const duplicateCandidateKeys = [];
  for (const value of Array.isArray(values) ? values : []) {
    const candidateKey = String(value?.candidateKey || "").trim();
    if (!candidateKey) continue;
    if (byCandidate.has(candidateKey)) duplicateCandidateKeys.push(candidateKey);
    else byCandidate.set(candidateKey, { ...value, candidateKey });
  }
  return {
    byCandidate,
    duplicateCandidateKeys,
    unknownCandidateKeys(candidates) {
      const known = new Set(candidates.map((candidate) => candidate.candidateKey));
      return [...byCandidate.keys()].filter((candidateKey) => !known.has(candidateKey));
    }
  };
}

function reviewAuditRecord(candidate, decision, reviewBatch, outcome, targetTable) {
  return {
    candidateKey: candidate.candidateKey,
    documentVersionId: candidate.documentVersionId,
    action: decision.action,
    outcome,
    targetTable,
    batchId: reviewBatch?.batchId || null,
    reviewerId: reviewBatch?.reviewerId || null,
    reviewedAt: reviewBatch?.reviewedAt || null,
    reason: String(decision.reason || reviewBatch?.reason || "").trim() || null
  };
}

function blockedCandidate(candidate, blocker) {
  return { candidateKey: candidate.candidateKey, status: "blocked", targetTable: TARGET_BY_DISPOSITION[candidate.storageDisposition] || null, blockers: [blocker], row: null };
}

function emptyRowsByTable() {
  return {
    schedule_contract_milestones: [],
    schedule_contract_extensions: [],
    schedule_contract_conditions: []
  };
}
