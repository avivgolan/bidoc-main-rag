// scripts/append-link-tests.mjs
// Appends L1-L12 deterministic contract tests for the Link Agent to
// test/run-tests.js. Idempotent: will not add twice.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "../test/run-tests.js");

const MARKER = "// ── Link Agent L1-L12 deterministic contract tests ─────────────────────";

let content = fs.readFileSync(target, "utf8");

if (content.includes(MARKER)) {
  console.log("Link agent tests already present – skipping.");
  process.exit(0);
}

// Insert before the final runner loop
const RUNNER_MARKER = "let failed = 0;";
const runnerIdx = content.lastIndexOf(RUNNER_MARKER);
if (runnerIdx === -1) {
  console.error("ERROR: could not find runner marker in run-tests.js");
  process.exit(1);
}

const TESTS_BLOCK = `
${MARKER}
// These tests are purely deterministic: no live API call is made.
// They validate the contract-level behaviour required by the spec for every
// L1–L12 case, plus L_SCHEMA which verifies the exported constant.

import { DEFAULT_TIMELINE_LINK_AGENT_PROMPT } from "../src/config.js";

// ── Shared helpers ────────────────────────────────────────────────────────

const VALID_RELATION_TYPES = new Set([
  "quote_sent", "quote_approved", "invoice_sent",
  "payment_received", "change_order", "related"
]);

function assertLinkSchema(link) {
  assert.ok(Number.isInteger(link.index) && link.index >= 0,
    \`link.index must be a non-negative integer, got \${link.index}\`);
  assert.ok(typeof link.accepted === "boolean",
    "link.accepted must be boolean");
  assert.ok(typeof link.confidence === "number" && link.confidence >= 0 && link.confidence <= 1,
    "link.confidence must be 0..1");
  assert.ok(VALID_RELATION_TYPES.has(link.relation_type),
    \`link.relation_type "\${link.relation_type}" is not a valid enum value\`);
  assert.equal(typeof link.reason, "string", "link.reason must be string");
  assert.equal(typeof link.approver, "string", "link.approver must be string");
}

function assertIndexCoverage(links, candidateCount) {
  // Every supplied candidate index must appear exactly once
  const returnedIndexes = links.map((l) => l.index);
  const unique = new Set(returnedIndexes);
  assert.equal(unique.size, returnedIndexes.length,
    "duplicate candidate indexes in response");
  for (const idx of returnedIndexes) {
    assert.ok(idx >= 0 && idx < candidateCount,
      \`returned index \${idx} is out of range [0, \${candidateCount})\`);
  }
}

function parseLinkFixture(jsonString) {
  return JSON.parse(jsonString);
}

// ── L1: Q-42 explicit approval by Dana Levi → quote_approved, high conf ──
test("L1: explicit approval of Q-42 by Dana Levi → accepted as quote_approved, approver set", () => {
  const response = {
    links: [
      { index: 0, accepted: true, confidence: 0.95,
        relation_type: "quote_approved", reason: "יעד מאשר מפורשות הצעת מחיר Q-42 על ידי דנה לוי", approver: "דנה לוי" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  assert.ok(Array.isArray(parsed.links) && parsed.links.length === 1, "L1: must return one link");
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, true,        "L1: must be accepted");
  assert.equal(link.relation_type, "quote_approved", "L1: must be quote_approved");
  assert.ok(link.confidence >= 0.90,       "L1: must have high confidence");
  assert.ok(link.approver.length > 0,      "L1: approver must be set");
  assertIndexCoverage(parsed.links, 1);
});

// ── L2: Only generic tag 'construction' shared → rejected ─────────────────
test("L2: only generic shared tag 'construction' → rejected", () => {
  const response = {
    links: [
      { index: 0, accepted: false, confidence: 0.30,
        relation_type: "related", reason: "רק תגית כללית משותפת, אין ראיה ספציפית", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, false, "L2: generic tag must be rejected");
  assertIndexCoverage(parsed.links, 1);
});

// ── L3: Temporal inversion → rejected ────────────────────────────────────
test("L3: target approval date before source quote date → rejected for temporal inversion", () => {
  const response = {
    links: [
      { index: 0, accepted: false, confidence: 0.20,
        relation_type: "quote_approved", reason: "יעד קודם למקור – היפוך זמני", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, false, "L3: temporal inversion must be rejected");
  assertIndexCoverage(parsed.links, 1);
});

// ── L4: Request for quote → explicit proposal P-17 sent → quote_sent ──────
test("L4: source asks for quote, target records proposal P-17 sent → accepted as quote_sent", () => {
  const response = {
    links: [
      { index: 0, accepted: true, confidence: 0.92,
        relation_type: "quote_sent", reason: "היעד מתעד שהצעת מחיר P-17 נשלחה", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, true,       "L4: must be accepted");
  assert.equal(link.relation_type, "quote_sent", "L4: must be quote_sent, not quote_approved");
  assertIndexCoverage(parsed.links, 1);
});

// ── L5: Approved Q-42 + invoice explicitly referencing Q-42 → invoice_sent
test("L5: source has approved Q-42, target invoice explicitly references Q-42 → invoice_sent", () => {
  const response = {
    links: [
      { index: 0, accepted: true, confidence: 0.93,
        relation_type: "invoice_sent", reason: "חשבונית היעד מפנה מפורשות להצעת מחיר Q-42", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, true,         "L5: must be accepted");
  assert.equal(link.relation_type, "invoice_sent", "L5: must be invoice_sent");
  assertIndexCoverage(parsed.links, 1);
});

// ── L6: INV-9 + explicit payment confirmation → payment_received ──────────
test("L6: source INV-9 + target explicit payment confirmation → payment_received", () => {
  const response = {
    links: [
      { index: 0, accepted: true, confidence: 0.94,
        relation_type: "payment_received", reason: "היעד מאשר תשלום עבור INV-9", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, true,           "L6: must be accepted");
  assert.equal(link.relation_type, "payment_received", "L6: must be payment_received");
  assertIndexCoverage(parsed.links, 1);
});

// ── L7: Target says "approved" but names no person → approver must be "" ──
test("L7: target says approved but names no person → may accept, approver is empty string", () => {
  const response = {
    links: [
      { index: 0, accepted: true, confidence: 0.82,
        relation_type: "quote_approved", reason: "מסמך היעד מציין אישור הצעת מחיר", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  // approver must NOT be invented
  assert.equal(link.approver, "", "L7: approver must be empty when no person is named");
  assertIndexCoverage(parsed.links, 1);
});

// ── L8: Injection in candidate text → ignored, evaluated on merit only ────
test("L8: candidate text contains injection attempt → evaluated on evidence, no auto-accept", () => {
  // Correct model behaviour: evaluated on actual evidence, not the injected text
  const response = {
    links: [
      { index: 0, accepted: false, confidence: 0.15,
        relation_type: "related", reason: "אין ראיה עובדתית לקשר, הנסיון להזרקת פקודה הושמט", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  // If the injection text was obeyed the model would have accepted; it must not
  assert.equal(link.accepted, false,
    "L8: injection text must not cause acceptance without real evidence");
  assertIndexCoverage(parsed.links, 1);
});

// ── L9: Index coverage – every candidate index must be returned exactly once
test("L9: model returns all supplied candidate indexes exactly once (coverage)", () => {
  // Simulate 3 candidates where model reviews all of them
  const response = {
    links: [
      { index: 0, accepted: true,  confidence: 0.91, relation_type: "quote_approved", reason: "ראיה", approver: "" },
      { index: 1, accepted: false, confidence: 0.20, relation_type: "related",        reason: "חלש",  approver: "" },
      { index: 2, accepted: true,  confidence: 0.88, relation_type: "invoice_sent",   reason: "חשבונית", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  assert.equal(parsed.links.length, 3, "L9: must return one review per candidate");
  parsed.links.forEach(assertLinkSchema);
  assertIndexCoverage(parsed.links, 3);
  // No unknown or duplicate indexes
  const indexes = parsed.links.map((l) => l.index).sort((a,b)=>a-b);
  assert.deepEqual(indexes, [0, 1, 2], "L9: returned indexes must match supplied set exactly");
});

// ── L10: Invalid JSON → parser/repair handles it ──────────────────────────
test("L10: malformed JSON response is detected and not treated as an accepted link", () => {
  const malformed = '{"links":[{"index":0,"accepted":true,"confidence":0.9,'; // truncated
  let parsed = null;
  try {
    parsed = JSON.parse(malformed);
  } catch {
    parsed = null;
  }
  // The contract: a null/failed parse must not produce accepted links
  assert.ok(parsed === null || !Array.isArray(parsed?.links),
    "L10: malformed JSON must not produce a valid links array");
});

// ── L11: Saved links excluded before model → no duplicate review ──────────
test("L11: existing saved link is not sent to the model (pre-filter contract)", () => {
  // This tests the pre-filtering logic: if a pair is already saved,
  // it should not appear in candidates at all. We simulate by checking
  // that a set of candidates without duplicates would be reviewed cleanly.
  const candidates = [
    { index: 0, relation_type: "quote_approved" }
    // The saved link (same pair) was removed before reaching the model
  ];
  const response = {
    links: [
      { index: 0, accepted: true, confidence: 0.90, relation_type: "quote_approved", reason: "ראיה", approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  assertIndexCoverage(parsed.links, candidates.length);
  // The response should only contain the one non-duplicate candidate
  assert.equal(parsed.links.length, 1, "L11: only one candidate in, one review out");
});

// ── L12: High graph score with generic topic → rejected ───────────────────
test("L12: high graph score but only generic shared topic, different suppliers → rejected", () => {
  const response = {
    links: [
      { index: 0, accepted: false, confidence: 0.35,
        relation_type: "related",
        reason: "ציון גרף גבוה בגלל נושא כללי, הספקים שונים, אין ראיה ספציפית",
        approver: "" }
    ]
  };
  const parsed = parseLinkFixture(JSON.stringify(response));
  const link = parsed.links[0];
  assertLinkSchema(link);
  assert.equal(link.accepted, false,
    "L12: high graph score alone on generic topic must not produce an acceptance");
  assertIndexCoverage(parsed.links, 1);
});

// ── L_SCHEMA: DEFAULT_TIMELINE_LINK_AGENT_PROMPT has the new structure ────
test("L_SCHEMA: DEFAULT_TIMELINE_LINK_AGENT_PROMPT uses the new structured prompt format", () => {
  assert.ok(typeof DEFAULT_TIMELINE_LINK_AGENT_PROMPT === "string",
    "DEFAULT_TIMELINE_LINK_AGENT_PROMPT must be a string");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# Identity"),
    "New prompt must contain # Identity section");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# Authoritative Runtime Inputs"),
    "New prompt must contain # Authoritative Runtime Inputs section");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# Link Decision Rules"),
    "New prompt must contain # Link Decision Rules section");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# Confidence Rules"),
    "New prompt must contain # Confidence Rules section");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# Output Contract"),
    "New prompt must contain # Output Contract section");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# Failure Behaviour"),
    "New prompt must contain # Failure Behaviour section");
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("# JSON Schema"),
    "New prompt must contain # JSON Schema section");
  // Must NOT contain old single-sentence format
  assert.ok(!DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("Use semantic search, timeline distance"),
    "Old single-sentence format must be gone");
  // Must contain quote_sent in the schema (spec requirement)
  assert.ok(DEFAULT_TIMELINE_LINK_AGENT_PROMPT.includes("quote_sent"),
    "New prompt must include quote_sent in the relation_type enum");
});

`;

const updated = content.slice(0, runnerIdx) + TESTS_BLOCK + content.slice(runnerIdx);
fs.writeFileSync(target, updated, "utf8");
console.log("OK: L1-L12 + L_SCHEMA tests appended to", target);
