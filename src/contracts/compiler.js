import { ContractsAgentError } from "./errors.js";
import { assertContractExtractionSchema } from "./schema.js";
import { normalizeClauseKey } from "./segmenter.js";

export const CONTRACTS_COMPILER_VERSION = "contracts-compiler.phase1.v1";

const BIDI_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const FORBIDDEN_METADATA_KEY = /(?:computed|lateness|variance|severity|alert|entitlement|effective.*date)/iu;
const LOCKED_ROLE_TYPES = new Map([
  ["contractual_completion", "relative_condition"],
  ["fixed_completion", "fixed_milestone"],
  ["daily_delay_charge", "consequence"],
  ["exceptional_event_notice", "notice_rule"],
  ["weekly_waste_removal", "recurring_rule"],
  ["monthly_payment_chain", "recurring_rule"],
  ["owner_requested_delay_relief", "extension_rule"],
  ["approved_extension", "extension_event"],
  ["completion_inspection", "relative_condition"],
  ["manager_set_corrections", "missing_information"],
  ["performance_bond_delivery", "relative_condition"],
  ["performance_bond_renewal", "relative_condition"],
  ["notice_service", "notice_rule"]
]);
const LOCKED_ROLE_PROJECTIONS = new Map([
  ["contractual_completion", "project_schedule"],
  ["fixed_completion", "project_schedule"],
  ["daily_delay_charge", "project_schedule"],
  ["owner_requested_delay_relief", "project_schedule"],
  ["approved_extension", "project_schedule"],
  ["completion_inspection", "project_schedule"],
  ["manager_set_corrections", "project_schedule"],
  ["exceptional_event_notice", "contract_compliance"],
  ["weekly_waste_removal", "contract_compliance"],
  ["monthly_payment_chain", "contract_compliance"],
  ["performance_bond_delivery", "contract_compliance"],
  ["performance_bond_renewal", "contract_compliance"],
  ["notice_service", "contract_compliance"]
]);
const LOCKED_ROLE_ACTIONS = new Map([
  ["contractual_completion", "Complete and deliver the works"],
  ["daily_delay_charge", "Pay a daily charge for delayed completion"],
  ["exceptional_event_notice", "Provide written notice of an exceptional event"],
  ["weekly_waste_removal", "Remove accumulated waste and construction debris"],
  ["monthly_payment_chain", "Review monthly account and pay the approved amount"],
  ["owner_requested_delay_relief", "Allow a corresponding postponement for a qualifying owner-requested delay"],
  ["completion_inspection", "Complete the inspection of the works"],
  ["manager_set_corrections", "Complete correction work within a period later set by the inspector"],
  ["performance_bond_delivery", "Deliver the performance bond"],
  ["performance_bond_renewal", "Extend the performance bond before expiry"],
  ["notice_service", "Determine deemed receipt according to delivery channel"]
]);
const LOCKED_ROLE_TRIGGER_KINDS = new Map([
  ["contractual_completion", "commencement"],
  ["daily_delay_charge", "event"],
  ["exceptional_event_notice", "event"],
  ["weekly_waste_removal", "event"],
  ["monthly_payment_chain", "month_end"],
  ["owner_requested_delay_relief", "event"],
  ["completion_inspection", "inspection_start"],
  ["manager_set_corrections", "manager_decision"],
  ["performance_bond_delivery", "signing"],
  ["performance_bond_renewal", "event"],
  ["notice_service", "channel_delivery"]
]);
const LOCKED_ROLE_PARTIES = new Map([
  ["contractual_completion", ["contractor", "owner"]],
  ["fixed_completion", ["contractor", "owner"]],
  ["daily_delay_charge", ["contractor", "owner"]],
  ["exceptional_event_notice", ["contractor", "owner"]],
  ["weekly_waste_removal", ["contractor", "owner"]],
  ["monthly_payment_chain", ["owner", "contractor"]],
  ["owner_requested_delay_relief", ["owner", "contractor"]],
  ["completion_inspection", ["inspector", "contractor"]],
  ["manager_set_corrections", ["contractor", "owner"]],
  ["performance_bond_delivery", ["contractor", "owner"]],
  ["performance_bond_renewal", ["contractor", "owner"]]
]);
const GATE_REGISTRY = new Set([
  "authority_unverified",
  "human_review_required",
  "project_binding_unreviewed",
  "commencement_event_missing",
  "trigger_event_missing",
  "execution_date_unverified",
  "inspection_start_event_missing",
  "inspection_start_due_missing",
  "bond_expiry_event_missing",
  "working_calendar_missing",
  "calendar_semantics_unresolved",
  "subday_deadline_not_storable_as_date",
  "compliance_engine_not_approved",
  "recurring_occurrence_history_not_supported",
  "compound_rule_not_supported",
  "approval_guard_not_supported",
  "extension_event_missing",
  "quantified_days_missing",
  "entitlement_review_required",
  "extension_approval_review_required",
  "existing_milestone_identity_required",
  "offset_missing",
  "future_manager_decision_required",
  "negative_offset_not_supported",
  "branching_rule_not_supported",
  "channel_specific_clock_not_supported",
  "material_value_conflict",
  "contract_conflict_unresolved",
  "responsible_party_unverified",
  "beneficiary_unverified",
  "unreadable_pdf_page"
]);
const PHASE1_MISSING_INFORMATION_KEYS = new Set([
  "authoritative_working_calendar",
  "contractual_commencement_date",
  "execution_authority",
  "inspection_start_due",
  "manager_set_correction_period"
]);
const DETERMINISTIC_PACKET_REFERENCES = [
  {
    reference: "Appendix A bill of quantities",
    appendix: "a",
    pattern: /(?:appendix\s+a|נספח\s+א|bill\s+of\s+quantities|כתב\s+ה?כמויות)/iu,
    impact: "The referenced scope and quantities cannot be reconciled against this PDF alone."
  },
  {
    reference: "Plans and specifications",
    appendix: null,
    pattern: /(?:plans?\s+and\s+specifications?|plans?|specifications?|תכניות|תוכניות|מפרט)/iu,
    impact: "Referenced technical documents are not present in the supplied packet."
  },
  {
    reference: "Appendix C",
    appendix: "c",
    pattern: /(?:appendix\s+c|נספח\s+ג)/iu,
    impact: "The agreement references an appendix that is not present in the supplied PDF."
  }
];

export function compileContractDraft({
  draft,
  identity,
  segments,
  projectSelection = null,
  unreadablePages = []
} = {}) {
  const segmentIndex = new Map(segments.map((segment) => [segment.segmentId, segment]));
  const binding = buildProjectBinding(draft.documentObservations.contractSiteRaw, projectSelection);
  const candidates = draft.candidates.map((candidate) => compileCandidate({
    candidate,
    identity,
    segmentIndex,
    binding
  }));

  const candidateKeys = new Set();
  for (const candidate of candidates) {
    if (candidateKeys.has(candidate.candidateKey)) {
      throw new ContractsAgentError(
        "contracts_candidate_key_collision",
        "Two extracted facts resolved to the same stable candidate identity.",
        502,
        { issueCodes: ["identity.candidate_key_collision"] }
      );
    }
    candidateKeys.add(candidate.candidateKey);
  }

  const conflicts = applyDeterministicConflicts(candidates, draft.candidates);
  const packetGaps = normalizePacketGaps(draft.packetReferences, unreadablePages, segments);
  const missingInformation = normalizeMissingInformation(draft.missingObservations, candidates);
  const hasMissingWorkingCalendar = candidates.some((candidate) =>
    candidate.offset?.unit === "working_day" && !candidate.offset.calendarId
  );
  const attachmentsStatus = packetGaps.some((gap) => gap.status === "missing" || gap.status === "partial")
    ? "incomplete"
    : draft.documentObservations.attachmentsStatus;

  const output = {
    schemaVersion: "contract-extraction.v1",
    extractionVersion: CONTRACTS_COMPILER_VERSION,
    mode: "dry_run",
    document: {
      documentVersionId: identity.documentVersionId,
      filename: identity.filename,
      sha256: identity.sha256,
      documentType: draft.documentObservations.documentType,
      executionStatus: "unverified",
      authorityStatus: "needs_review",
      executionDate: null,
      visibleSignatureStatus: "unknown",
      attachmentsStatus,
      sourceId: identity.sourceId,
      supersedesDocumentVersionId: null
    },
    projectBinding: binding,
    candidates: candidates.sort((a, b) => a.candidateKey.localeCompare(b.candidateKey)),
    conflicts: conflicts.sort((a, b) => a.conflictGroupId.localeCompare(b.conflictGroupId)),
    missingInformation,
    packetGaps,
    warnings: uniqueStrings([
      "Dry-run extraction only: no Schedule table write or automatic promotion is authorized.",
      "Execution authority and visible signatures are not established by text-layer extraction.",
      "Dates, lateness, severity, entitlement, and legal conclusions are not computed.",
      ...(unreadablePages.length ? ["One or more PDF pages have no usable text layer; OCR was not attempted."] : [])
    ]),
    summary: {
      candidateCount: candidates.length,
      conflictCount: conflicts.length,
      missingInformationCount: missingInformation.length,
      approvedScheduleProjectionCount: 0,
      computedCompletionDate: null,
      calendarStatus: hasMissingWorkingCalendar ? "missing" : "not_required"
    }
  };

  return assertContractDomainInvariants(output);
}

function compileCandidate({ candidate, identity, segmentIndex, binding }) {
  const role = normalizeRole(candidate.roleCode);
  const type = LOCKED_ROLE_TYPES.get(role) || candidate.type;
  const projection = LOCKED_ROLE_PROJECTIONS.get(role) || candidate.projectionHint;
  const sourceEvidence = candidate.evidence.map((item) => compileEvidence(item, segmentIndex, identity.sha256));
  const clauseKeys = [...new Set(candidate.evidence.map((item) => {
    const segment = segmentIndex.get(item.segmentId);
    return segment ? normalizeClauseKey(segment.clauseKey) : "unknown";
  }))].sort();
  const clauseIdentity = normalizeClauseKey(clauseKeys.join("_") || "unknown");
  const metadata = normalizeTypedMetadataAliases(
    type,
    role,
    sanitizeMetadata(candidate.metadata),
    sourceEvidence
  );
  const normalizedCandidate = normalizeLockedCandidate({ ...candidate, type, projectionHint: projection }, role, sourceEvidence);
  validateTypedMetadata(type, role, metadata);
  validateMaterialFactsGrounded(normalizedCandidate, metadata, sourceEvidence);
  const partyGrounding = groundOptionalParties({
    role,
    responsibleParty: normalizeNullableText(candidate.responsibleParty, 500),
    beneficiary: normalizeNullableText(candidate.beneficiary, 500),
    sourceEvidence
  });

  const compiled = {
    candidateKey: `contract:${identity.sha256.slice(0, 12)}:clause:${clauseIdentity}:role:${role}`,
    documentVersionId: identity.documentVersionId,
    type,
    role,
    responsibleParty: partyGrounding.responsibleParty,
    beneficiary: partyGrounding.beneficiary,
    action: normalizeRequiredText(normalizedCandidate.action, 1000, "candidate action"),
    trigger: normalizedCandidate.trigger ? {
      kind: normalizedCandidate.trigger.kind,
      description: normalizeRequiredText(normalizedCandidate.trigger.description, 1000, "trigger description"),
      eventDate: normalizedCandidate.trigger.eventDate
    } : null,
    fixedDate: normalizedCandidate.fixedDate,
    offset: normalizedCandidate.offset ? {
      value: normalizedCandidate.offset.value,
      unit: normalizedCandidate.offset.unit,
      direction: normalizedCandidate.offset.direction,
      calendarId: null,
      inclusivity: normalizedCandidate.offset.inclusivity,
      rollConvention: normalizedCandidate.offset.rollConvention
    } : null,
    recurrence: normalizedCandidate.recurrence ? {
      frequency: normalizedCandidate.recurrence.frequency,
      window: normalizeNullableText(normalizedCandidate.recurrence.window, 1000),
      occurrencePolicy: normalizedCandidate.recurrence.occurrencePolicy
    } : null,
    projection,
    computedDate: null,
    factStatus: type === "missing_information" ? "missing" : normalizedCandidate.factStatus,
    reviewStatus: "needs_review",
    confidence: normalizedCandidate.confidence,
    conflictGroupId: null,
    operationalEligibility: "blocked",
    automaticPromotionAllowed: false,
    storageDisposition: storageDispositionFor(type, projection, role, metadata, sourceEvidence),
    gates: [...new Set([...deriveGates(normalizedCandidate, binding, metadata), ...partyGrounding.gates])].sort(),
    sourceEvidence: sourceEvidence.sort(compareEvidence),
    metadata
  };
  return compiled;
}

function compileEvidence(item, segmentIndex, documentSha256) {
  const segment = segmentIndex.get(item.segmentId);
  if (!segment) {
    throw new ContractsAgentError(
      "contracts_evidence_segment_unknown",
      "Model evidence references an unknown parser segment.",
      502,
      { issueCodes: ["evidence.segment_unknown"] }
    );
  }
  const sourceText = findGroundedQuote(segment.text, item.exactQuote);
  if (!sourceText) {
    throw new ContractsAgentError(
      "contracts_evidence_not_grounded",
      "Model evidence is not an exact quote from its claimed PDF page and clause.",
      502,
      { issueCodes: ["evidence.quote_not_grounded"] }
    );
  }
  return {
    pdfPage: segment.pdfPage,
    clause: segment.clauseLabel,
    sourceText,
    documentSha256
  };
}

function normalizeLockedCandidate(candidate, role, sourceEvidence) {
  const groundedText = sourceEvidence.map((evidence) => evidence.sourceText).join(" ");
  const action = LOCKED_ROLE_ACTIONS.get(role) || candidate.action;
  const triggerKind = role === "contractual_completion" && !/(?:מועד\s+תחילת|commencement)/iu.test(groundedText)
    ? candidate.trigger?.kind
    : LOCKED_ROLE_TRIGGER_KINDS.get(role);
  const trigger = triggerKind
    ? {
        kind: triggerKind,
        description: candidate.trigger?.description || action,
        eventDate: candidate.trigger?.eventDate || null
      }
    : candidate.trigger;
  let offset = candidate.offset;
  let recurrence = candidate.recurrence;

  if (["daily_delay_charge", "weekly_waste_removal", "owner_requested_delay_relief", "notice_service"].includes(role)) {
    offset = null;
  } else if (role === "manager_set_corrections") {
    offset = canonicalOffset(null, "unknown", "after", "unspecified");
  } else if (role === "contractual_completion") {
    offset = canonicalOffset(matchGroundedNumber(groundedText, /(?:בתוך|within)\s*(\d{1,4})\s*(?:(?:ימי|ימים?)\s+(?:עבודה|עסקים|קלנדר(?:י|יים)?)|(?:working|business|calendar)\s+days?|ימים?|days?)/iu, candidate.offset?.value), groundedDayUnit(groundedText, candidate.offset?.unit), "after", "unspecified");
  } else if (role === "exceptional_event_notice") {
    offset = canonicalOffset(matchGroundedNumber(groundedText, /(?:לא\s+יאוחר[^\d]{0,20}|no\s+later\s+than[^\d]{0,20})(\d{1,4})\s*(?:שעות?|hours?)/iu, candidate.offset?.value), "hour", "after", "none");
  } else if (role === "monthly_payment_chain") {
    offset = canonicalOffset(matchGroundedNumber(groundedText, /(?:בתוך|within)\s*(\d{1,4})\s*(?:ימים?|days?)[^.!?\n]{0,100}(?:מתום\s+החודש|month\s+end)/iu, candidate.offset?.value), "day", "after", "next_working_day");
  } else if (role === "completion_inspection") {
    offset = canonicalOffset(matchGroundedNumber(groundedText, /(?:תוך|within)\s*(\d{1,4})\s*(?:ימים?|days?)/iu, candidate.offset?.value), "day", "after", "unspecified");
  } else if (role === "performance_bond_delivery") {
    offset = canonicalOffset(matchGroundedNumber(groundedText, /(?:לא\s+יאוחר[^\d]{0,20}|no\s+later\s+than[^\d]{0,20})(\d{1,4})\s*(?:ימים?|days?)/iu, candidate.offset?.value), "day", "after", "unspecified");
  } else if (role === "performance_bond_renewal") {
    offset = canonicalOffset(matchGroundedNumber(groundedText, /(\d{1,4})\s*(?:(?:ימים?|ימי)\s+(?:עבודה|עסקים|קלנדר(?:י|יים)?)|(?:working|business|calendar)\s+days?|ימים?|days?)[^.!?\n]{0,40}(?:טרם|לפני|before)/iu, candidate.offset?.value), groundedDayUnit(groundedText, candidate.offset?.unit), "before", "unspecified");
  }

  if (role === "weekly_waste_removal") {
    recurrence = { frequency: "weekly", window: "at_least_once_per_week", occurrencePolicy: "each_occurrence" };
  } else if (role === "monthly_payment_chain") {
    recurrence = { frequency: "monthly", window: "submission_days_1_to_5_then_review_within_10_days", occurrencePolicy: "each_occurrence" };
  } else if (["daily_delay_charge", "exceptional_event_notice", "owner_requested_delay_relief", "completion_inspection", "manager_set_corrections", "performance_bond_delivery", "performance_bond_renewal", "notice_service", "contractual_completion"].includes(role)) {
    recurrence = null;
  }

  return { ...candidate, action, trigger, offset, recurrence };
}

function canonicalOffset(value, unit, direction, rollConvention) {
  return {
    value: value === null || value === undefined ? null : Number(value),
    unit,
    direction,
    inclusivity: "unspecified",
    rollConvention
  };
}

function matchGroundedNumber(text, pattern, fallback) {
  const match = String(text || "").match(pattern)?.[1];
  if (match !== undefined) return Number(match);
  return fallback === null || fallback === undefined ? null : Number(fallback);
}

function groundedDayUnit(text, fallback = "day") {
  if (/(?:(?:יום|ימי|ימים)\s+(?:עבודה|עסקים)|working\s+days?|business\s+days?)/iu.test(text)) return "working_day";
  if (/(?:(?:יום|ימי|ימים)\s+קלנדר|calendar\s+days?)/iu.test(text)) return "calendar_day";
  return fallback || "day";
}

export function findGroundedQuote(source, quote) {
  const sourceRaw = String(source || "").normalize("NFC").replace(BIDI_MARKS, "");
  const sourceText = normalizeEvidenceText(sourceRaw);
  const quoteText = normalizeEvidenceText(quote);
  if (!quoteText) return null;
  const first = sourceText.indexOf(quoteText);
  if (first >= 0 && sourceText.lastIndexOf(quoteText) === first) {
    return sourceText.slice(first, first + quoteText.length);
  }

  const ellipsisParts = quoteText.split(/\s*(?:\.\.\.|…)+\s*/u).filter(Boolean);
  if (ellipsisParts.length > 1 && ellipsisParts.every((part) => part.length >= 8)) {
    let cursor = 0;
    let start = -1;
    let end = -1;
    for (const part of ellipsisParts) {
      const index = sourceText.indexOf(part, cursor);
      if (index < 0) return null;
      if (start < 0) start = index;
      end = index + part.length;
      cursor = end;
    }
    return sourceText.slice(start, end);
  }

  return findUniqueTokenSequence(sourceText, quoteText);
}

export function normalizeEvidenceText(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(BIDI_MARKS, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function findUniqueTokenSequence(sourceText, quoteText) {
  const sourceTokens = [...sourceText.matchAll(/[\p{L}\p{N}]+/gu)];
  const quoteTokens = [...quoteText.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => match[0]);
  if (quoteTokens.length < 4 || quoteTokens.join("").length < 12) return null;
  const matches = [];
  for (let index = 0; index <= sourceTokens.length - quoteTokens.length; index += 1) {
    let equal = true;
    for (let offset = 0; offset < quoteTokens.length; offset += 1) {
      if (sourceTokens[index + offset][0] !== quoteTokens[offset]) {
        equal = false;
        break;
      }
    }
    if (equal) matches.push(index);
  }
  if (matches.length !== 1) return null;
  const startToken = sourceTokens[matches[0]];
  const endToken = sourceTokens[matches[0] + quoteTokens.length - 1];
  return sourceText.slice(startToken.index, endToken.index + endToken[0].length);
}

function applyDeterministicConflicts(candidates, drafts) {
  const draftByKey = new Map();
  candidates.forEach((candidate, index) => draftByKey.set(candidate.candidateKey, drafts[index]));
  const groups = new Map();
  for (const candidate of candidates) {
    const draft = draftByKey.get(candidate.candidateKey);
    const rawHint = String(draft?.conflictHint || "").trim() ||
      (candidate.role === "daily_delay_charge" ? "daily-delay-charge" : "");
    if (!rawHint) continue;
    const hint = normalizeConflictHint(rawHint);
    if (!groups.has(hint)) groups.set(hint, []);
    groups.get(hint).push(candidate);
  }

  const conflicts = [];
  for (const [hint, group] of groups) {
    const eligible = group.filter((candidate) =>
      candidate.type !== "missing_information" && candidate.factStatus !== "missing"
    );
    if (eligible.length < 2) continue;
    const signatures = new Set(eligible.map(materialFactSignature));
    if (signatures.size < 2) continue;
    const conflictGroupId = hint;
    const numericValues = new Set(eligible.map((candidate) => candidate.metadata?.amount).filter(Number.isFinite));
    for (const candidate of eligible) {
      candidate.factStatus = "conflicting";
      candidate.conflictGroupId = conflictGroupId;
      candidate.gates = uniqueStrings([
        ...candidate.gates,
        numericValues.size > 1 ? "material_value_conflict" : "contract_conflict_unresolved"
      ]).sort();
    }
    conflicts.push({
      conflictGroupId,
      type: numericValues.size > 1 ? "value_conflict" : "rule_conflict",
      materiality: numericValues.size > 1 ? "high" : "medium",
      status: "unresolved",
      candidateKeys: eligible.map((candidate) => candidate.candidateKey).sort(),
      selectedCandidateKey: null,
      reviewDecision: null
    });
  }
  return conflicts;
}

function materialFactSignature(candidate) {
  return JSON.stringify({
    type: candidate.type,
    fixedDate: candidate.fixedDate,
    triggerKind: candidate.trigger?.kind || null,
    offset: candidate.offset,
    recurrence: candidate.recurrence,
    metadata: candidate.metadata
  });
}

function normalizeMissingInformation(values, candidates) {
  const byKey = new Map();
  for (const value of values || []) {
    const key = normalizeSnakeKey(value.key);
    if (!PHASE1_MISSING_INFORMATION_KEYS.has(key) || byKey.has(key)) continue;
    byKey.set(key, {
      key,
      field: normalizeRequiredText(value.field, 300, "missing-information field"),
      description: normalizeRequiredText(value.description, 1000, "missing-information description"),
      blocks: uniqueStrings(value.blocks.map((item) => normalizeRequiredText(item, 120, "missing-information block"))).sort()
    });
  }

  byKey.set("execution_authority", {
    key: "execution_authority",
    field: "document.executionStatus",
    description: "Text-layer extraction cannot establish contract execution or visible signatures.",
    blocks: ["operational_projection", "signing_relative_rules"]
  });

  if (candidates.some((candidate) => candidate.trigger?.kind === "commencement" && !candidate.trigger.eventDate)) {
    byKey.set("contractual_commencement_date", {
      key: "contractual_commencement_date",
      field: "completion_rule.trigger.eventDate",
      description: "The contractual commencement event is not established by a reviewed date.",
      blocks: ["computed_completion_date", "schedule_contract_milestone_promotion"]
    });
  }

  if (candidates.some((candidate) => candidate.offset?.unit === "working_day" && !candidate.offset.calendarId)) {
    byKey.set("authoritative_working_calendar", {
      key: "authoritative_working_calendar",
      field: "completion_rule.offset.calendarId",
      description: "No authoritative working-day calendar is attached to the extracted rule.",
      blocks: ["computed_completion_date"]
    });
  }
  if (candidates.some((candidate) => candidate.role === "completion_inspection" && candidate.trigger?.kind === "inspection_start" && !candidate.trigger.eventDate)) {
    byKey.set("inspection_start_due", {
      key: "inspection_start_due",
      field: "completion_inspection.trigger",
      description: "The rule defines when inspection finishes after it starts, but not when inspection must start after completion notice.",
      blocks: ["inspection_start_deadline"]
    });
  }
  if (candidates.some((candidate) => candidate.role === "manager_set_corrections" && candidate.offset?.value === null)) {
    byKey.set("manager_set_correction_period", {
      key: "manager_set_correction_period",
      field: "manager_set_corrections.offset.value",
      description: "The correction period depends on a future inspector decision.",
      blocks: ["correction_due_date"]
    });
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function normalizePacketGaps(_values, unreadablePages, segments = []) {
  const byReference = new Map();
  const presentAppendices = new Set(segments.map((segment) => segment.clauseKey.match(/^appendix_([a-z])\./u)?.[1]).filter(Boolean));
  const sourceText = segments.map((segment) => segment.text).join("\n");
  for (const rule of DETERMINISTIC_PACKET_REFERENCES) {
    if (!rule.pattern.test(sourceText)) continue;
    if (rule.appendix && presentAppendices.has(rule.appendix) && appendixHasSuppliedContent(rule.appendix, segments)) continue;
    byReference.set(rule.reference.toLocaleLowerCase("en-US"), {
      reference: rule.reference,
      status: "missing",
      impact: rule.impact
    });
  }
  for (const pdfPage of unreadablePages) {
    const reference = `PDF page ${pdfPage} text layer`;
    byReference.set(reference.toLowerCase(), {
      reference,
      status: "unknown",
      impact: "The page has no usable text layer; OCR and visual-content inference were not attempted."
    });
  }
  return [...byReference.values()].sort((a, b) => a.reference.localeCompare(b.reference));
}

function appendixHasSuppliedContent(appendix, segments) {
  const appendixText = segments
    .filter((segment) => segment.clauseKey.startsWith(`appendix_${appendix}.`))
    .map((segment) => segment.text)
    .join("\n");
  if (!appendixText) return false;
  return !/(?:\u05d9\u05e6\u05d5\u05e8\u05e3|\u05d8\u05e8\u05dd\s+\u05e6\u05d5\u05e8\u05e3|\u05dc\u05d0\s+\u05e6\u05d5\u05e8\u05e3|to\s+be\s+attached|will\s+be\s+attached|not\s+attached|pending\s+attachment)/iu.test(appendixText);
}

function buildProjectBinding(contractSiteRaw, selection) {
  const raw = normalizeNullableText(contractSiteRaw, 500);
  const normalizedContractSite = normalizeSite(raw);
  if (!selection) {
    return {
      projectId: null,
      selectedByUser: false,
      status: "unbound",
      contractSiteRaw: raw,
      contractSiteNormalized: normalizedContractSite,
      candidateProjectSite: null,
      automaticBindingAllowed: false,
      mismatchReasons: []
    };
  }

  const candidateSite = normalizeNullableText(selection.projectSite, 500);
  const normalizedCandidateSite = normalizeSite(candidateSite);
  const mismatchReasons = [];
  if (!normalizedContractSite) mismatchReasons.push("contract_site_missing");
  if (!normalizedCandidateSite) mismatchReasons.push("candidate_project_site_missing");
  if (normalizedContractSite && normalizedCandidateSite && normalizedContractSite !== normalizedCandidateSite) {
    const contractNumbers = addressNumbers(normalizedContractSite);
    const candidateNumbers = addressNumbers(normalizedCandidateSite);
    if (contractNumbers.length && candidateNumbers.length && contractNumbers.join(",") !== candidateNumbers.join(",")) {
      mismatchReasons.push("site_address_number_mismatch");
    }
    mismatchReasons.push("site_address_text_mismatch");
  }
  return {
    projectId: selection.projectId,
    selectedByUser: true,
    status: mismatchReasons.length ? "needs_review" : "confirmed",
    contractSiteRaw: raw,
    contractSiteNormalized: normalizedContractSite,
    candidateProjectSite: candidateSite,
    automaticBindingAllowed: false,
    mismatchReasons: uniqueStrings(mismatchReasons)
  };
}

function normalizeSite(value) {
  if (!value) return null;
  return value
    .normalize("NFC")
    .toLocaleLowerCase("he-IL")
    .replace(BIDI_MARKS, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim() || null;
}

function addressNumbers(value) {
  return String(value || "").match(/\d+/gu) || [];
}

function deriveGates(candidate, binding, metadata) {
  const gates = new Set(["authority_unverified", "human_review_required"]);
  if (binding.status !== "confirmed") gates.add("project_binding_unreviewed");
  if (candidate.trigger && !candidate.trigger.eventDate) {
    if (candidate.trigger.kind === "commencement") gates.add("commencement_event_missing");
    else if (candidate.trigger.kind === "signing") gates.add("execution_date_unverified");
    else if (candidate.trigger.kind === "inspection_start") gates.add("inspection_start_event_missing");
    else if (candidate.trigger.kind === "manager_decision") gates.add("future_manager_decision_required");
    else gates.add("trigger_event_missing");
  }
  if (candidate.offset?.unit === "working_day") gates.add("working_calendar_missing");
  if (candidate.offset?.unit === "day") gates.add("calendar_semantics_unresolved");
  if (candidate.offset?.unit === "hour") gates.add("subday_deadline_not_storable_as_date");
  if (candidate.offset?.direction === "before") gates.add("negative_offset_not_supported");
  if (candidate.offset && candidate.offset.value === null) gates.add("offset_missing");
  if (candidate.recurrence) gates.add("recurring_occurrence_history_not_supported");
  if (candidate.projectionHint === "contract_compliance" || candidate.projectionHint === "both") {
    gates.add("compliance_engine_not_approved");
  }
  if (Array.isArray(metadata.temporalSteps) && metadata.temporalSteps.length > 1) gates.add("compound_rule_not_supported");
  if (metadata.paymentRequiresApproval === true) gates.add("approval_guard_not_supported");
  if (candidate.type === "extension_rule") {
    gates.add("extension_event_missing");
    gates.add("entitlement_review_required");
    if (!candidate.offset?.value) gates.add("quantified_days_missing");
  }
  if (candidate.type === "extension_event") {
    gates.add("extension_approval_review_required");
    gates.add("existing_milestone_identity_required");
  }
  if (Array.isArray(metadata.branches) && metadata.branches.length > 1) {
    gates.add("branching_rule_not_supported");
    gates.add("channel_specific_clock_not_supported");
  }
  return [...gates].filter((gate) => GATE_REGISTRY.has(gate)).sort();
}

function storageDispositionFor(type, projection, role, metadata, sourceEvidence) {
  if (type === "extension_event" && role === "approved_extension") {
    const groundedText = sourceEvidence.map((evidence) => evidence.sourceText).join(" ");
    const approvalStatus = String(metadata.approvalStatus || "").trim().toLowerCase();
    const extensionUnit = String(metadata.extensionUnit || "").trim().toLowerCase();
    const milestoneKey = String(metadata.milestoneKey || "").trim();
    const positiveApproval = /(?:\bapproved\b|\bapproval\s+dated\b|\bapproval\s+was\s+granted\b|\u05d0\u05d5\u05e9\u05e8|\u05de\u05d0\u05d5\u05e9\u05e8)/iu.test(groundedText);
    const negativeApproval = /(?:\bnot\s+approved\b|\bno\s+approval\b|\bpending\s+approval\b|\bapproval\s+pending\b|\bdenied\b|\brejected\b|\u05dc\u05d0\s+\u05d0\u05d5\u05e9\u05e8|\u05d8\u05e8\u05dd\s+\u05d0\u05d5\u05e9\u05e8|\u05de\u05de\u05ea\u05d9\u05df\s+\u05dc\u05d0\u05d9\u05e9\u05d5\u05e8|\u05e0\u05d3\u05d7\u05d4)/iu.test(groundedText);
    const approvalGrounded = positiveApproval && !negativeApproval;
    const milestoneGrounded = milestoneKey.length > 0 && roleAnchorAppears(groundedText, "contractual_completion");
    if (
      approvalStatus === "approved" &&
      extensionUnit === "calendar_day" &&
      Number(metadata.extensionAmount) > 0 &&
      dateAppears(groundedText, metadata.approvedDate) &&
      approvalGrounded &&
      milestoneGrounded
    ) {
      return "candidate_for_schedule_contract_extensions";
    }
    return "dry_run_only";
  }
  if (type === "fixed_milestone" && projection === "project_schedule") return "candidate_for_schedule_contract_milestones";
  if (type === "relative_condition" && [
    "contractual_completion",
    "completion_inspection",
    "performance_bond_delivery"
  ].includes(role)) return "candidate_for_schedule_contract_conditions";
  return "dry_run_only";
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 4) return null;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new ContractsAgentError("contracts_metadata_invalid", "Candidate metadata contains an invalid number.", 502);
    return value;
  }
  if (typeof value === "string") return normalizeRequiredText(value, 2000, "candidate metadata string");
  if (Array.isArray(value)) {
    if (value.length > 50) throw new ContractsAgentError("contracts_metadata_invalid", "Candidate metadata array is too large.", 502);
    return value.map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new ContractsAgentError("contracts_metadata_invalid", "Candidate metadata must contain JSON values only.", 502);
  }
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[a-z][a-zA-Z0-9_]{0,79}$/u.test(key) || FORBIDDEN_METADATA_KEY.test(key)) {
      throw new ContractsAgentError(
        "contracts_metadata_field_forbidden",
        "Candidate metadata contains a forbidden operational field.",
        502,
        { issueCodes: ["metadata.forbidden_field"] }
      );
    }
    output[key] = sanitizeMetadata(item, depth + 1);
  }
  if (typeof output.currency === "string") output.currency = output.currency.toUpperCase();
  return output;
}

function validateTypedMetadata(type, role, metadata) {
  if (role === "daily_delay_charge") {
    if (!(Number(metadata.amount) > 0) || typeof metadata.currency !== "string" || typeof metadata.rateUnit !== "string") {
      throw new ContractsAgentError(
        "contracts_consequence_metadata_invalid",
        "Daily delay charges require typed amount, currency, and rateUnit metadata.",
        502,
        { issueCodes: ["metadata.daily_delay_charge_required_fields"] }
      );
    }
  }
  if (type === "extension_event") {
    const valid = Number(metadata.extensionAmount) > 0 &&
      typeof metadata.extensionUnit === "string" &&
      typeof metadata.approvalStatus === "string" &&
      typeof metadata.approvedDate === "string" &&
      typeof metadata.milestoneKey === "string";
    if (!valid) {
      throw new ContractsAgentError(
        "contracts_extension_event_metadata_invalid",
        "Extension events require typed amount, unit, approval status/date, and milestone metadata.",
        502,
        { issueCodes: ["metadata.extension_event_required_fields"] }
      );
    }
  }
  if (type === "extension_rule" && metadata.approvalStatus === "approved") {
    throw new ContractsAgentError(
      "contracts_extension_rule_promoted",
      "A contractual extension rule cannot be represented as an approved extension event.",
      502,
      { issueCodes: ["extension.rule_event_boundary"] }
    );
  }
}

function validateMaterialFactsGrounded(candidate, metadata, sourceEvidence) {
  const groundedText = sourceEvidence.map((evidence) => evidence.sourceText).join(" ");
  const issues = [];
  if (candidate.fixedDate && !dateAppears(groundedText, candidate.fixedDate)) issues.push("material.fixed_date_not_grounded");
  if (candidate.trigger?.eventDate && !dateAppears(groundedText, candidate.trigger.eventDate)) issues.push("material.trigger_date_not_grounded");
  if (candidate.offset?.value !== null && candidate.offset?.value !== undefined) {
    const groundedOffset = sourceEvidence.some((evidence) =>
      numberUnitPairAppears(evidence.sourceText, candidate.offset.value, candidate.offset.unit) &&
      roleAnchorAppears(evidence.sourceText, candidate.roleCode)
    );
    if (!groundedOffset) issues.push("material.offset_not_grounded");
  }
  if (candidate.recurrence?.frequency === "weekly" && !/(?:שבוע|weekly|per\s+week)/iu.test(groundedText)) {
    issues.push("material.weekly_recurrence_not_grounded");
  }
  if (candidate.recurrence?.frequency === "monthly" && !/(?:חודש|monthly|per\s+month)/iu.test(groundedText)) {
    issues.push("material.monthly_recurrence_not_grounded");
  }
  if (candidate.roleCode === "daily_delay_charge" && !numberCurrencyPairAppears(groundedText, metadata.amount)) {
    issues.push("material.charge_amount_not_grounded");
  }
  if (candidate.roleCode === "monthly_payment_chain" && Number.isFinite(Number(metadata.reviewOffsetDays)) &&
      !numberUnitPairAppears(groundedText, metadata.reviewOffsetDays, "day")) {
    issues.push("material.review_offset_not_grounded");
  }
  if (candidate.type === "extension_event") {
    if (!numberUnitPairAppears(groundedText, metadata.extensionAmount, metadata.extensionUnit)) {
      issues.push("material.extension_amount_not_grounded");
    }
    if (!dateAppears(groundedText, metadata.approvedDate)) issues.push("material.extension_approval_date_not_grounded");
  }
  for (const branch of Array.isArray(metadata.branches) ? metadata.branches : []) {
    if (typeof branch !== "object" || branch === null || !branch.offset || Number(branch.offset.value) <= 0) continue;
    if (!numberUnitPairAppears(groundedText, branch.offset.value, branch.offset.unit)) {
      issues.push("material.notice_offset_not_grounded");
      issues.push("material.notice_unit_not_grounded");
    }
  }
  if (issues.length) {
    throw new ContractsAgentError(
      "contracts_material_fact_not_grounded",
      "A structured contract fact is not supported by its exact evidence.",
      502,
      { issueCodes: [...new Set(issues)].sort() }
    );
  }
}

function groundOptionalParties({ role, responsibleParty, beneficiary, sourceEvidence }) {
  if (role === "notice_service") {
    return { responsibleParty: null, beneficiary: null, gates: [] };
  }
  const rawEvidence = sourceEvidence.map((item) => item.sourceText);
  const evidence = rawEvidence.map(normalizeSemanticEvidence);
  const expectedKinds = LOCKED_ROLE_PARTIES.get(role) || [null, null];
  const grounded = { responsibleParty, beneficiary, gates: [] };
  for (const [index, [field, outputField, value]] of [
    ["responsible_party", "responsibleParty", responsibleParty],
    ["beneficiary", "beneficiary", beneficiary]
  ].entries()) {
    if (expectedKinds[index]) {
      const exactParty = rawEvidence.map((text) => exactPartySpan(text, expectedKinds[index])).find(Boolean) || null;
      grounded[outputField] = exactParty;
      if (!exactParty) grounded.gates.push(`${field}_unverified`);
      continue;
    }
    if (!value) continue;
    const normalized = normalizeSemanticEvidence(value);
    const exactSpan = normalized && evidence.some((text) => text.includes(normalized));
    const roleMatches = !expectedKinds[index] || partyKindMatches(normalized, expectedKinds[index]);
    if (!exactSpan || !roleMatches) {
      grounded[outputField] = null;
      grounded.gates.push(`${field}_unverified`);
    }
  }
  return grounded;
}

function exactPartySpan(text, kind) {
  const patterns = {
    contractor: /(?:הקבלן|\bContractor\b)/iu,
    owner: /(?:סמל|המזמין|\bOwner\b|\bEmployer\b|\bClient\b)/iu,
    inspector: /(?:המפקח|\bInspector\b|\bSupervisor\b)/iu
  };
  return String(text || "").match(patterns[kind])?.[0] || null;
}

function partyKindMatches(value, expected) {
  const contractor = /(?:\bcontractor\b|\u05d4\u05e7\u05d1\u05dc\u05df)/iu.test(value);
  const inspector = /(?:\binspector\b|\bsupervisor\b|\u05de\u05e4\u05e7\u05d7)/iu.test(value);
  const owner = /(?:\bowner\b|\bemployer\b|\bclient\b|\u05d4\u05de\u05d6\u05de\u05d9\u05df|\u05e1\u05de\u05dc)/iu.test(value);
  if (expected === "contractor") return contractor && !inspector;
  if (expected === "inspector") return inspector && !contractor;
  if (expected === "owner") return owner || (!contractor && !inspector);
  return true;
}

function normalizeSemanticEvidence(value) {
  return normalizeEvidenceText(value).toLocaleLowerCase("en-US");
}

function roleAnchorAppears(text, role) {
  const patterns = {
    contractual_completion: /(?:השלמ|יושלמ|completion|complete)/iu,
    fixed_completion: /(?:השלמ|יושלמ|completion|complete)/iu,
    exceptional_event_notice: /(?:אירוע\s+חריג|ידווח|notice|report|exceptional\s+event)/iu,
    monthly_payment_chain: /(?:חשבון|תשלום|account|payment)/iu,
    completion_inspection: /(?:בדיק|inspection)/iu,
    performance_bond_delivery: /(?:ערבות|bond)/iu,
    performance_bond_renewal: /(?:ערבות|פקיע|bond|expir)/iu
  };
  return !patterns[role] || patterns[role].test(String(text || ""));
}

function numberAppears(text, value) {
  const expected = Number(value);
  if (!Number.isFinite(expected)) return false;
  return [...String(text || "").matchAll(/\d[\d,.]*/gu)].some((match) => {
    const normalized = match[0].replaceAll(",", "");
    return Number(normalized) === expected;
  });
}

function numberUnitPairAppears(text, value, unit) {
  if (unit === "unknown") return numberAppears(text, value);
  const expected = Number(value);
  if (!Number.isFinite(expected)) return false;
  const source = String(text || "");
  if (expected === 1 && implicitSingularUnitAppears(source, unit)) return true;
  const numbers = [...source.matchAll(/\d[\d,.]*/gu)]
    .filter((match) => Number(match[0].replaceAll(",", "")) === expected)
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
  const units = unitOccurrences(source, unit);
  return numbers.some((number) => units.some((unitMatch) =>
    unitMatch.start >= number.end && unitMatch.start - number.end <= 24
  ));
}

function implicitSingularUnitAppears(text, unit) {
  const deadlinePrefix = "(?:\\u05d1?\\u05ea\\u05d5\\u05da|\\u05dc\\u05d0\\s+\\u05d9\\u05d0\\u05d5\\u05d7\\u05e8\\s+\\u05de(?:-|\\s)?|within|no\\s+later\\s+than)";
  const patterns = {
    day: new RegExp(`${deadlinePrefix}\\s*(?:\\u05d9\\u05d5\\u05dd(?!\\s+(?:\\u05e2\\u05d1\\u05d5\\u05d3\\u05d4|\\u05e2\\u05e1\\u05e7\\u05d9\\u05dd|\\u05e7\\u05dc\\u05e0\\u05d3\\u05e8))|(?:one\\s+)?day)`, "iu"),
    working_day: new RegExp(`${deadlinePrefix}\\s*(?:(?:\\u05d9\\u05d5\\u05dd|\\u05d9\\u05d5\\u05dd\\s+\\u05e2\\u05d1\\u05d5\\u05d3\\u05d4)\\s+(?:\\u05e2\\u05d1\\u05d5\\u05d3\\u05d4|\\u05e2\\u05e1\\u05e7\\u05d9\\u05dd)|(?:one\\s+)?(?:working|business)\\s+day)`, "iu"),
    calendar_day: new RegExp(`${deadlinePrefix}\\s*(?:\\u05d9\\u05d5\\u05dd\\s+\\u05e7\\u05dc\\u05e0\\u05d3\\u05e8(?:\\u05d9)?|(?:one\\s+)?calendar\\s+day)`, "iu"),
    week: new RegExp(`${deadlinePrefix}\\s*(?:\\u05e9\\u05d1\\u05d5\\u05e2|(?:one\\s+)?week)`, "iu"),
    month: new RegExp(`${deadlinePrefix}\\s*(?:\\u05d7\\u05d5\\u05d3\\u05e9|(?:one\\s+)?month)`, "iu"),
    hour: new RegExp(`${deadlinePrefix}\\s*(?:\\u05e9\\u05e2\\u05d4|(?:one\\s+)?hour)`, "iu")
  };
  return Boolean(patterns[unit]?.test(String(text || "")));
}

function numberCurrencyPairAppears(text, value) {
  const expected = Number(value);
  if (!Number.isFinite(expected)) return false;
  const source = String(text || "");
  const currencies = [...source.matchAll(/(?:ILS|NIS|\u20aa|\u05e9[\u05f4"']?\u05d7|\u05e9\u05e7\u05dc(?:\u05d9\u05dd)?)/giu)]
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
  return [...source.matchAll(/\d[\d,.]*/gu)]
    .filter((match) => Number(match[0].replaceAll(",", "")) === expected)
    .some((number) => currencies.some((currency) =>
      currency.start >= number.index + number[0].length && currency.start - (number.index + number[0].length) <= 12
    ));
}

function unitOccurrences(text, unit) {
  const dayWord = "(?:\\u05d9\\u05d5\\u05dd|\\u05d9\\u05de\\u05d9(?:\\u05dd)?|days?)";
  const patterns = {
    day: new RegExp(dayWord, "giu"),
    calendar_day: new RegExp(`(?:${dayWord}\\s+\\u05e7\\u05dc\\u05e0\\u05d3\\u05e8(?:\\u05d9|\\u05d9\\u05d9\\u05dd)?|calendar\\s+days?)`, "giu"),
    working_day: new RegExp(`(?:${dayWord}\\s+(?:\\u05e2\\u05d1\\u05d5\\u05d3\\u05d4|\\u05e2\\u05e1\\u05e7\\u05d9\\u05dd)|working\\s+days?|business\\s+days?)`, "giu"),
    week: /(?:\u05e9\u05d1\u05d5\u05e2|\u05e9\u05d1\u05d5\u05e2\u05d5\u05ea|weeks?)/giu,
    month: /(?:\u05d7\u05d5\u05d3\u05e9|\u05d7\u05d5\u05d3\u05e9\u05d9\u05dd|months?)/giu,
    hour: /(?:\u05e9\u05e2\u05d4|\u05e9\u05e2\u05d5\u05ea|hours?)/giu
  };
  const pattern = patterns[unit];
  if (!pattern) return [];
  return [...String(text || "").matchAll(pattern)]
    .filter((match) => {
      if (unit !== "day") return true;
      const surrounding = String(text || "").slice(
        Math.max(0, match.index - 16),
        Math.min(String(text || "").length, match.index + match[0].length + 18)
      );
      return !/(?:calendar|working|business|\u05e7\u05dc\u05e0\u05d3\u05e8|\u05e2\u05d1\u05d5\u05d3\u05d4|\u05e2\u05e1\u05e7\u05d9\u05dd)/iu.test(surrounding);
    })
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
}

function unitAppears(text, unit) {
  const patterns = {
    day: /(?:יום|ימי|ימים|days?)/iu,
    calendar_day: /(?:(?:יום|ימי|ימים)\s+קלנדר|calendar\s+days?)/iu,
    working_day: /(?:(?:יום|ימי|ימים)\s+עבודה|(?:יום|ימי|ימים)\s+עסקים|working\s+days?|business\s+days?)/iu,
    week: /(?:שבוע|שבועות|weeks?)/iu,
    month: /(?:חודש|חודשים|months?)/iu,
    hour: /(?:שעה|שעות|hours?)/iu
  };
  return unit === "unknown" || Boolean(patterns[unit]?.test(String(text || "")));
}

function dateAppears(text, isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return false;
  const [, year, month, day] = match;
  const variants = [
    `${year}-${month}-${day}`,
    `${day}/${month}/${year}`,
    `${day}.${month}.${year}`,
    `${day}-${month}-${year}`
  ];
  return variants.some((variant) => String(text || "").includes(variant));
}

function normalizeTypedMetadataAliases(type, role, value, sourceEvidence) {
  const metadata = { ...value };
  const groundedText = sourceEvidence.map((evidence) => evidence.sourceText).join(" ");
  if (role !== "monthly_payment_chain") delete metadata.temporalSteps;
  if (role === "daily_delay_charge") {
    const aliasAmount = metadata.amount ?? metadata.value ?? metadata.amountIls ?? metadata.amountNis;
    const evidenceAmount = groundedText.match(/(\d[\d,.]*)\s*(?:ש["״']?ח|₪|שקלים(?:\s+חדשים)?|ILS|NIS)/iu)?.[1];
    const amount = Number(String(aliasAmount ?? evidenceAmount ?? "").replaceAll(",", ""));
    if (Number.isFinite(amount) && amount > 0) metadata.amount = amount;
    if (!metadata.currency && (metadata.amountIls || metadata.amountNis || /(?:ש["״']?ח|₪|שקלים|ILS|NIS)/iu.test(groundedText))) {
      metadata.currency = "ILS";
    }
    metadata.rateUnit = metadata.rateUnit || metadata.rate_unit || metadata.per ||
      (/(?:ליום|כל\s+יום|per\s+day|each\s+day)/iu.test(groundedText) ? "per_day" : null);
    metadata.dayType = metadata.dayType || metadata.day_type ||
      (/(?:ימי\s+עבודה|working\s+days?)/iu.test(groundedText)
        ? "working_day"
        : /(?:ימים?\s+קלנדר|calendar\s+days?)/iu.test(groundedText) ? "calendar_day" : "unspecified");
    delete metadata.value;
    delete metadata.amountIls;
    delete metadata.amountNis;
    delete metadata.rate_unit;
    delete metadata.day_type;
    delete metadata.per;
  }
  if (role === "monthly_payment_chain") {
    const reviewMatch = groundedText.match(/(?:יבדוק|בדיק|review)[^\d]{0,120}(\d{1,3})\s*(?:ימים?|days?)/iu);
    if (!Number.isFinite(Number(metadata.reviewOffsetDays)) && reviewMatch) {
      metadata.reviewOffsetDays = Number(reviewMatch[1]);
    }
    if (metadata.paymentRequiresApproval !== true && /(?:סכום|חשבון)[^.!?\n]{0,120}(?:שאושר|המאושר)|approved\s+(?:amount|account)/iu.test(groundedText)) {
      metadata.paymentRequiresApproval = true;
    }
  }
  if (role === "notice_service") {
    const branches = [];
    const mailDays = groundedText.match(/(?:דואר\s+רשום|registered\s+mail)[^\d]{0,120}(\d{1,3})\s*(?:ימים?|days?)/iu)?.[1];
    if (mailDays) {
      branches.push({
        channel: "registered_mail",
        offset: { value: Number(mailDays), unit: "day", direction: "after" },
        alternative: null,
        selection: "single_clock"
      });
    }
    if (/(?:נמסרה\s+ביד|מסירה\s+ביד|hand\s+delivery)/iu.test(groundedText)) {
      branches.push({
        channel: "hand_delivery",
        offset: { value: 0, unit: "day", direction: "after" },
        alternative: null,
        selection: "immediate"
      });
    }
    const emailBusinessDay = /(?:בתוך\s+יום\s+עסקים|(?:one|1)\s+business\s+day)/iu.test(groundedText);
    if (/(?:דוא[״"']?ל|email)/iu.test(groundedText) && emailBusinessDay) {
      branches.push({
        channel: "email",
        offset: { value: 1, unit: "working_day", direction: "after" },
        alternative: /(?:מענה\s+חוזר|מענה\s+חזרה|reply)/iu.test(groundedText) ? "non_automatic_reply" : null,
        selection: /(?:לפי\s+המוקדם|earlier\s+of)/iu.test(groundedText) ? "earlier_of" : "single_clock"
      });
    }
    if (branches.length) metadata.branches = branches;
  }
  if (type === "extension_event") {
    metadata.extensionAmount = metadata.extensionAmount ?? metadata.amount ?? null;
    metadata.extensionUnit = metadata.extensionUnit || metadata.unit || null;
    metadata.approvalStatus = metadata.approvalStatus || metadata.status || null;
    metadata.approvedDate = metadata.approvedDate || metadata.approvalDate || null;
    metadata.milestoneKey = metadata.milestoneKey || metadata.milestone || null;
  }
  if (typeof metadata.currency === "string") metadata.currency = metadata.currency.toUpperCase();
  return metadata;
}

export function collectContractDomainIssues(output) {
  const issues = [];
  if (output.mode !== "dry_run") issues.push("dry_run.mode");
  if (output.document.documentVersionId !== `sha256:${output.document.sha256}`) issues.push("identity.document_version");
  if (output.document.executionStatus !== "unverified") issues.push("authority.execution_status");
  if (output.document.authorityStatus !== "needs_review") issues.push("authority.status");
  if (output.document.executionDate !== null) issues.push("authority.execution_date");
  if (output.projectBinding.automaticBindingAllowed !== false) issues.push("binding.automatic_forbidden");

  const keys = new Set();
  const prefix = `contract:${output.document.sha256.slice(0, 12).toLowerCase()}:clause:`;
  for (const candidate of output.candidates) {
    if (keys.has(candidate.candidateKey)) issues.push("identity.duplicate_candidate_key");
    keys.add(candidate.candidateKey);
    if (!candidate.candidateKey.startsWith(prefix)) issues.push("identity.candidate_hash_prefix");
    if (candidate.documentVersionId !== output.document.documentVersionId) issues.push("identity.candidate_document_version");
    if (candidate.computedDate !== null) issues.push("dry_run.computed_date");
    if (candidate.automaticPromotionAllowed !== false) issues.push("dry_run.automatic_promotion");
    if (candidate.operationalEligibility !== "blocked") issues.push("dry_run.operational_eligibility");
    if (candidate.reviewStatus !== "needs_review") issues.push("dry_run.review_status");
    if (candidate.gates.some((gate) => !GATE_REGISTRY.has(gate))) issues.push("gates.unregistered");
    for (const evidence of candidate.sourceEvidence) {
      if (evidence.documentSha256 !== output.document.sha256) issues.push("evidence.document_hash");
    }
  }

  for (const conflict of output.conflicts) {
    if (conflict.status !== "unresolved") issues.push("conflict.phase1_status");
    if (conflict.selectedCandidateKey !== null || conflict.reviewDecision !== null) issues.push("conflict.unresolved_winner");
    if (conflict.candidateKeys.some((key) => !keys.has(key))) issues.push("conflict.unknown_candidate");
    for (const key of conflict.candidateKeys) {
      const candidate = output.candidates.find((item) => item.candidateKey === key);
      if (candidate?.conflictGroupId !== conflict.conflictGroupId || candidate?.factStatus !== "conflicting") {
        issues.push("conflict.candidate_link");
      }
    }
  }

  if (output.summary.candidateCount !== output.candidates.length) issues.push("summary.candidate_count");
  if (output.summary.conflictCount !== output.conflicts.length) issues.push("summary.conflict_count");
  if (output.summary.missingInformationCount !== output.missingInformation.length) issues.push("summary.missing_count");
  if (output.summary.approvedScheduleProjectionCount !== 0) issues.push("dry_run.approved_projection_count");
  if (output.summary.computedCompletionDate !== null) issues.push("dry_run.computed_completion_date");
  return uniqueStrings(issues).sort();
}

export function assertContractDomainInvariants(output) {
  assertContractExtractionSchema(output);
  const issueCodes = collectContractDomainIssues(output);
  if (issueCodes.length) {
    throw new ContractsAgentError(
      "contracts_output_invariant_invalid",
      "Contract extraction failed deterministic safety validation.",
      502,
      { issueCodes }
    );
  }
  return output;
}

function normalizeRole(value) {
  const role = normalizeSnakeKey(value);
  if (!/^[a-z][a-z0-9_]{1,79}$/u.test(role)) {
    throw new ContractsAgentError("contracts_role_invalid", "The extracted role code is invalid.", 502);
  }
  return role;
}

function normalizeSnakeKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .replace(/_+/gu, "_");
}

function normalizeConflictHint(value) {
  return normalizeSnakeKey(value).replaceAll("_", "-") || "contract-conflict";
}

function normalizeRequiredText(value, maxLength, label) {
  const normalized = String(value || "").normalize("NFC").replace(BIDI_MARKS, "").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ContractsAgentError("contracts_text_invalid", `Invalid ${label}.`, 502);
  }
  return normalized;
}

function normalizeNullableText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  return normalizeRequiredText(value, maxLength, "text value");
}

function compareEvidence(first, second) {
  return first.pdfPage - second.pdfPage || first.clause.localeCompare(second.clause) || first.sourceText.localeCompare(second.sourceText);
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}
