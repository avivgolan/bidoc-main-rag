import { collectContractDomainIssues } from "./compiler.js";
import { contractExtractionSchemaErrors } from "./schema.js";

export const CONTRACTS_GOLD_THRESHOLDS = Object.freeze({
  candidateTypeMicroF1: 0.9,
  projectionMacroF1: 0.9,
  criticalRoleRecall: 1,
  falseOperationalEligibility: 0
});

const DEFAULT_CRITICAL_ROLES = [
  "contractual_completion",
  "daily_delay_charge",
  "exceptional_event_notice",
  "weekly_waste_removal",
  "monthly_payment_chain",
  "owner_requested_delay_relief",
  "completion_inspection",
  "manager_set_corrections",
  "performance_bond_delivery",
  "performance_bond_renewal",
  "notice_service"
];

export function evaluateContractExtraction({ expected, actual, criticalRoles = DEFAULT_CRITICAL_ROLES } = {}) {
  const expectedSchemaIssues = contractExtractionSchemaErrors(expected);
  const actualSchemaIssues = contractExtractionSchemaErrors(actual);
  const actualDomainIssues = actualSchemaIssues.length ? [] : collectContractDomainIssues(actual);
  const expectedCandidates = keyedCandidates(expected?.candidates || []);
  const actualCandidates = keyedCandidates(actual?.candidates || []);
  const candidateKeys = new Set([...expectedCandidates.keys(), ...actualCandidates.keys()]);

  let typeTruePositive = 0;
  let typeFalsePositive = 0;
  let typeFalseNegative = 0;
  for (const key of candidateKeys) {
    const expectedCandidate = expectedCandidates.get(key);
    const actualCandidate = actualCandidates.get(key);
    if (expectedCandidate && actualCandidate && expectedCandidate.type === actualCandidate.type) typeTruePositive += 1;
    else {
      if (actualCandidate) typeFalsePositive += 1;
      if (expectedCandidate) typeFalseNegative += 1;
    }
  }
  const candidateType = prf(typeTruePositive, typeFalsePositive, typeFalseNegative);
  const projectionMacroF1 = macroLabelF1(expectedCandidates, actualCandidates, "projection");

  const expectedCritical = [...expectedCandidates.values()].filter((candidate) => criticalRoles.includes(candidate.role));
  const matchedCritical = expectedCritical.filter((candidate) => {
    const predicted = actualCandidates.get(candidate.candidateKey.toLowerCase());
    return predicted && predicted.type === candidate.type && predicted.role === candidate.role;
  });
  const criticalRoleRecall = expectedCritical.length ? matchedCritical.length / expectedCritical.length : 1;
  const materialFacts = compareMaterialFacts(expectedCandidates, actualCandidates);

  const evidence = compareEvidence(expectedCandidates, actualCandidates);
  const expectedConflictPairs = conflictPairs(expected?.conflicts || []);
  const actualConflictPairs = conflictPairs(actual?.conflicts || []);
  const conflictsExact = equalSets(expectedConflictPairs, actualConflictPairs) &&
    conflictStatesExact(expected?.conflicts || [], actual?.conflicts || []);
  const missingExact = missingInformationMatches(
    expected?.missingInformation || [],
    actual?.missingInformation || []
  );
  const packetGapsExact = equalSets(
    new Set((expected?.packetGaps || []).map((item) => `${normalizeSetText(item.reference)}|${item.status}`)),
    new Set((actual?.packetGaps || []).map((item) => `${normalizeSetText(item.reference)}|${item.status}`))
  );
  const projectBindingExact = projectBindingMatches(expected?.projectBinding, actual?.projectBinding);
  const storageDispositionExact = candidateFieldExact(expectedCandidates, actualCandidates, "storageDisposition");
  const candidateSemanticsExact = candidateSemanticsMatch(expectedCandidates, actualCandidates);
  const candidateGatesExact = candidateSetFieldExact(expectedCandidates, actualCandidates, "gates");
  const falseOperationalEligibility = (actual?.candidates || []).filter((candidate) =>
    candidate.operationalEligibility !== "blocked" || candidate.automaticPromotionAllowed !== false || candidate.computedDate !== null
  ).length;

  const hardGates = {
    expectedSchemaValid: expectedSchemaIssues.length === 0,
    actualSchemaValid: actualSchemaIssues.length === 0,
    actualDomainValid: actualDomainIssues.length === 0,
    materialFactsExact: materialFacts.exact,
    evidenceCoverageComplete: evidence.coverage === 1,
    evidencePageAndClauseExact: evidence.locationAccuracy === 1,
    conflictsExact,
    projectBindingExact,
    candidateSemanticsExact,
    candidateGatesExact,
    missingInformationExact: missingExact,
    packetGapsExact,
    storageDispositionExact,
    dryRunOnly: actual?.mode === "dry_run" && actual?.summary?.approvedScheduleProjectionCount === 0 && actual?.summary?.computedCompletionDate === null,
    noFalseOperationalEligibility: falseOperationalEligibility === 0
  };
  const metrics = {
    candidateTypeMicroPrecision: candidateType.precision,
    candidateTypeMicroRecall: candidateType.recall,
    candidateTypeMicroF1: candidateType.f1,
    projectionMacroF1,
    criticalRoleRecall,
    materialFactPrecision: materialFacts.precision,
    materialFactRecall: materialFacts.recall,
    evidenceCoverage: evidence.coverage,
    evidenceLocationAccuracy: evidence.locationAccuracy,
    falseOperationalEligibility
  };
  const thresholds = {
    candidateTypeMicroF1: metrics.candidateTypeMicroF1 >= CONTRACTS_GOLD_THRESHOLDS.candidateTypeMicroF1,
    projectionMacroF1: metrics.projectionMacroF1 >= CONTRACTS_GOLD_THRESHOLDS.projectionMacroF1,
    criticalRoleRecall: metrics.criticalRoleRecall >= CONTRACTS_GOLD_THRESHOLDS.criticalRoleRecall,
    falseOperationalEligibility: metrics.falseOperationalEligibility <= CONTRACTS_GOLD_THRESHOLDS.falseOperationalEligibility
  };
  return {
    passed: Object.values(hardGates).every(Boolean) && Object.values(thresholds).every(Boolean),
    hardGates,
    thresholds,
    metrics,
    issues: {
      expectedSchema: expectedSchemaIssues,
      actualSchema: actualSchemaIssues,
      actualDomain: actualDomainIssues,
      materialFacts: materialFacts.mismatches
    }
  };
}

function compareMaterialFacts(expected, actual) {
  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  const mismatches = [];
  for (const [key, expectedCandidate] of expected) {
    const expectedFacts = materialFactsForCandidate(expectedCandidate);
    const actualFacts = materialFactsForCandidate(actual.get(key));
    for (const fact of expectedFacts) {
      if (actualFacts.has(fact)) truePositive += 1;
      else {
        falseNegative += 1;
        mismatches.push(`${key}:${fact.split("=")[0]}`);
      }
    }
    for (const fact of actualFacts) {
      if (!expectedFacts.has(fact)) falsePositive += 1;
    }
  }
  for (const [key, actualCandidate] of actual) {
    if (expected.has(key)) continue;
    falsePositive += materialFactsForCandidate(actualCandidate).size;
  }
  const score = prf(truePositive, falsePositive, falseNegative);
  return {
    exact: falsePositive === 0 && falseNegative === 0,
    precision: score.precision,
    recall: score.recall,
    mismatches: [...new Set(mismatches)].sort()
  };
}

function materialFactsForCandidate(candidate) {
  const facts = new Set();
  if (!candidate) return facts;
  if (candidate.trigger) {
    facts.add(`trigger.kind=${candidate.trigger.kind || "unknown"}`);
    if (candidate.trigger.eventDate) facts.add(`trigger.event_date=${candidate.trigger.eventDate}`);
  }
  if (candidate.fixedDate) facts.add(`fixed_date=${candidate.fixedDate}`);
  if (candidate.offset) {
    facts.add(`offset=${candidate.offset.value ?? "null"}|${candidate.offset.unit}|${candidate.offset.direction}|${candidate.offset.inclusivity}|${candidate.offset.rollConvention}`);
  }
  if (candidate.recurrence) {
    facts.add(`recurrence=${candidate.recurrence.frequency}|${candidate.recurrence.occurrencePolicy}`);
    if (candidate.role === "monthly_payment_chain") {
      const numbers = String(candidate.recurrence.window || "").match(/\d+/gu)?.map(Number) || [];
      if (numbers.length >= 2) facts.add(`recurrence.submission_window=${numbers[0]}-${numbers[1]}`);
    }
  }

  const metadata = candidate.metadata || {};
  if (candidate.role === "daily_delay_charge") {
    if (Number.isFinite(Number(metadata.amount))) facts.add(`charge.amount=${Number(metadata.amount)}`);
    if (metadata.currency) facts.add(`charge.currency=${normalizeCurrency(metadata.currency)}`);
    if (metadata.rateUnit) facts.add(`charge.rate_unit=${normalizeRateUnit(metadata.rateUnit)}`);
    if (metadata.dayType) facts.add(`charge.day_type=${normalizeDayType(metadata.dayType)}`);
  }
  if (candidate.role === "monthly_payment_chain") {
    if (Number.isFinite(Number(metadata.reviewOffsetDays))) facts.add(`payment.review_offset_days=${Number(metadata.reviewOffsetDays)}`);
    if (typeof metadata.paymentRequiresApproval === "boolean") {
      facts.add(`payment.requires_approval=${metadata.paymentRequiresApproval}`);
    }
  }
  if (candidate.role === "notice_service" && Array.isArray(metadata.branches)) {
    for (const value of metadata.branches) {
      const branch = typeof value === "string" ? { channel: value } : value;
      if (!branch?.channel) continue;
      const channel = normalizeSetText(branch.channel);
      facts.add(`notice.channel=${channel}`);
      if (branch.offset) {
        facts.add(`notice.${channel}.offset=${branch.offset.value ?? "null"}|${branch.offset.unit}|${branch.offset.direction}`);
      }
      if (branch.alternative) facts.add(`notice.${channel}.alternative=${normalizeSetText(branch.alternative)}`);
      if (branch.selection) facts.add(`notice.${channel}.selection=${normalizeSetText(branch.selection)}`);
    }
  }
  if (candidate.role === "owner_requested_delay_relief") {
    facts.add(`extension.is_event=${candidate.type === "extension_event"}`);
  }
  if (candidate.type === "extension_event") {
    for (const key of ["extensionAmount", "extensionUnit", "approvalStatus", "approvedDate", "milestoneKey"]) {
      if (metadata[key] !== undefined && metadata[key] !== null) facts.add(`extension.${key}=${normalizeSetText(metadata[key])}`);
    }
  }
  return facts;
}

function normalizeCurrency(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "NIS" || normalized === "₪" ? "ILS" : normalized;
}

function normalizeRateUnit(value) {
  const normalized = normalizeSetText(value).replaceAll("-", "_");
  return ["day", "daily", "per day"].includes(normalized) ? "per_day" : normalized;
}

function normalizeDayType(value) {
  const normalized = normalizeSetText(value).replaceAll("-", "_");
  return ["day", "unknown", "unresolved", "unspecified_day"].includes(normalized) ? "unspecified" : normalized;
}

function candidateFieldExact(expected, actual, field) {
  if (expected.size !== actual.size) return false;
  for (const [key, candidate] of expected) {
    if (actual.get(key)?.[field] !== candidate[field]) return false;
  }
  return true;
}

function candidateSemanticsMatch(expected, actual) {
  if (expected.size !== actual.size) return false;
  for (const [key, candidate] of expected) {
    const predicted = actual.get(key);
    if (!predicted) return false;
    for (const field of ["responsibleParty", "beneficiary", "action"]) {
      if (normalizeNullableSetText(predicted[field]) !== normalizeNullableSetText(candidate[field])) return false;
    }
  }
  return true;
}

function candidateSetFieldExact(expected, actual, field) {
  if (expected.size !== actual.size) return false;
  for (const [key, candidate] of expected) {
    const predicted = actual.get(key);
    if (!predicted || !equalSets(
      new Set((candidate[field] || []).map(normalizeSetText)),
      new Set((predicted[field] || []).map(normalizeSetText))
    )) return false;
  }
  return true;
}

function missingInformationMatches(expected, actual) {
  const normalize = (item) => JSON.stringify({
    field: normalizeSetText(item.field),
    description: normalizeSetText(item.description),
    blocks: [...new Set((item.blocks || []).map(normalizeSetText))].sort()
  });
  const expectedByKey = new Map(expected.map((item) => [normalizeSetText(item.key), normalize(item)]));
  const actualByKey = new Map(actual.map((item) => [normalizeSetText(item.key), normalize(item)]));
  if (expectedByKey.size !== actualByKey.size) return false;
  return [...expectedByKey].every(([key, value]) => actualByKey.get(key) === value);
}

function projectBindingMatches(expected, actual) {
  if (!expected || !actual) return false;
  if (expected.status !== actual.status ||
      expected.selectedByUser !== actual.selectedByUser ||
      expected.automaticBindingAllowed !== actual.automaticBindingAllowed) return false;
  if (expected.projectId && expected.projectId !== actual.projectId) return false;
  return equalSets(new Set(expected.mismatchReasons || []), new Set(actual.mismatchReasons || []));
}

function conflictStatesExact(expected, actual) {
  const stateFor = (conflict) => JSON.stringify({
    status: conflict.status,
    selectedCandidateKey: conflict.selectedCandidateKey,
    reviewDecision: conflict.reviewDecision
  });
  const expectedStates = new Map(expected.map((conflict) => [conflict.conflictGroupId, stateFor(conflict)]));
  const actualStates = new Map(actual.map((conflict) => [conflict.conflictGroupId, stateFor(conflict)]));
  if (expectedStates.size !== actualStates.size) return false;
  return [...expectedStates].every(([key, state]) => actualStates.get(key) === state);
}

function keyedCandidates(candidates) {
  return new Map(candidates.map((candidate) => [String(candidate.candidateKey || "").toLowerCase(), candidate]));
}

function prf(tp, fp, fn) {
  const precision = tp + fp ? tp / (tp + fp) : tp + fn ? 0 : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

function macroLabelF1(expected, actual, field) {
  const labels = new Set([
    ...[...expected.values()].map((candidate) => candidate[field]),
    ...[...actual.values()].map((candidate) => candidate[field])
  ].filter(Boolean));
  if (!labels.size) return 1;
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  const scores = [];
  for (const label of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const key of keys) {
      const expectedLabel = expected.get(key)?.[field];
      const actualLabel = actual.get(key)?.[field];
      if (expectedLabel === label && actualLabel === label) tp += 1;
      else {
        if (actualLabel === label) fp += 1;
        if (expectedLabel === label) fn += 1;
      }
    }
    scores.push(prf(tp, fp, fn).f1);
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function compareEvidence(expected, actual) {
  let expectedCount = 0;
  let matchedCount = 0;
  let matchedLocations = 0;
  for (const [key, candidate] of expected) {
    const actualCandidate = actual.get(key);
    for (const evidence of candidate.sourceEvidence || []) {
      expectedCount += 1;
      const exact = (actualCandidate?.sourceEvidence || []).find((item) =>
        item.pdfPage === evidence.pdfPage &&
        item.clause === evidence.clause &&
        evidenceTextCovers(item.sourceText, evidence.sourceText) &&
        String(item.documentSha256).toLowerCase() === String(evidence.documentSha256).toLowerCase()
      );
      if (exact) {
        matchedCount += 1;
        matchedLocations += 1;
      } else if ((actualCandidate?.sourceEvidence || []).some((item) => evidenceTextCovers(item.sourceText, evidence.sourceText))) {
        matchedCount += 1;
      }
    }
  }
  return {
    coverage: expectedCount ? matchedCount / expectedCount : 1,
    locationAccuracy: expectedCount ? matchedLocations / expectedCount : 1
  };
}

function evidenceTextCovers(actualText, expectedExcerpt) {
  const actual = normalizeSetText(actualText);
  const expected = normalizeSetText(expectedExcerpt);
  return Boolean(actual && expected && actual === expected);
}

function conflictPairs(conflicts) {
  const pairs = new Set();
  for (const conflict of conflicts) {
    const keys = [...(conflict.candidateKeys || [])].map((key) => String(key).toLowerCase()).sort();
    for (let first = 0; first < keys.length; first += 1) {
      for (let second = first + 1; second < keys.length; second += 1) pairs.add(`${keys[first]}|${keys[second]}`);
    }
  }
  return pairs;
}

function equalSets(first, second) {
  return first.size === second.size && [...first].every((item) => second.has(item));
}

function normalizeSetText(value) {
  return String(value || "").normalize("NFC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function normalizeNullableSetText(value) {
  return value === null || value === undefined ? null : normalizeSetText(value);
}
