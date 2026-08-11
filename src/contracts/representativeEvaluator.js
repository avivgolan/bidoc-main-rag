import crypto from "node:crypto";
import { compileContractDraft } from "./compiler.js";

export function compileRepresentativeCases(input) {
  return (input?.cases || []).map((item) => ({
    id: item.id,
    output: compileContractDraft({
      draft: item.draft,
      identity: item.identity,
      segments: item.segments,
      projectSelection: item.projectSelection || null,
      unreadablePages: []
    })
  }));
}

export function evaluateRepresentativeCases({ input, expected }) {
  const actual = compileRepresentativeCases(input);
  const expectedById = new Map((expected?.cases || []).map((item) => [item.id, item]));
  const results = actual.map((item) => {
    const annotation = expectedById.get(item.id);
    const canonicalSha256 = canonicalOutputSha256(item.output);
    const assertionIssues = annotation ? representativeAssertionIssues(item.output, annotation.assertions || {}) : ["annotation_missing"];
    return {
      id: item.id,
      passed: Boolean(annotation) && canonicalSha256 === annotation.canonicalSha256 && assertionIssues.length === 0,
      canonicalSha256,
      assertionIssues
    };
  });
  const unexpectedExpectedIds = [...expectedById.keys()].filter((id) => !actual.some((item) => item.id === id));
  return {
    caseSetVersion: input?.caseSetVersion || null,
    expectedVersion: expected?.expectedVersion || null,
    synthetic: input?.synthetic === true,
    passed: results.length > 0 && results.every((item) => item.passed) && unexpectedExpectedIds.length === 0,
    caseCount: results.length,
    passedCount: results.filter((item) => item.passed).length,
    results,
    unexpectedExpectedIds
  };
}

export function canonicalOutputSha256(output) {
  return crypto.createHash("sha256").update(JSON.stringify(output), "utf8").digest("hex");
}

function representativeAssertionIssues(output, assertions) {
  const issues = [];
  const candidate = output.candidates?.[0] || null;
  const compare = (name, actual, expected) => {
    if (expected !== undefined && JSON.stringify(actual) !== JSON.stringify(expected)) issues.push(name);
  };
  compare("candidate_count", output.candidates?.length, assertions.candidateCount);
  compare("candidate_type", candidate?.type, assertions.type);
  compare("candidate_role", candidate?.role, assertions.role);
  compare("fixed_date", candidate?.fixedDate, assertions.fixedDate);
  compare("projection", candidate?.projection, assertions.projection);
  compare("storage_disposition", candidate?.storageDisposition, assertions.storageDisposition);
  compare("project_binding_status", output.projectBinding?.status, assertions.projectBindingStatus);
  compare("project_binding_mismatches", output.projectBinding?.mismatchReasons, assertions.projectBindingMismatchReasons);
  compare("computed_date", candidate?.computedDate, assertions.computedDate);
  compare("automatic_promotion", candidate?.automaticPromotionAllowed, assertions.automaticPromotionAllowed);
  compare("approved_projection_count", output.summary?.approvedScheduleProjectionCount, assertions.approvedScheduleProjectionCount);
  if (assertions.offset) {
    for (const [key, value] of Object.entries(assertions.offset)) compare(`offset_${key}`, candidate?.offset?.[key], value);
  }
  for (const gate of assertions.requiredGates || []) {
    if (!candidate?.gates?.includes(gate)) issues.push(`required_gate_${gate}`);
  }
  return issues.sort();
}
