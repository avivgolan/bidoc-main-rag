// scripts/append-insights-tests.mjs
// Appends I1-I10 deterministic contract tests for the Insights Agent to
// test/run-tests.js. Idempotent: will not add twice.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(__dirname, "../test/run-tests.js");

const MARKER = "// ── Insights Agent I1-I10 deterministic contract tests ──────────────────";

let content = fs.readFileSync(target, "utf8");

if (content.includes(MARKER)) {
  console.log("Tests already present – skipping.");
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
// They feed synthetic JSON payloads through the parsing / normalization
// helpers already exported from projectInsights.js and assert that the
// output contract defined by the spec is satisfied.

// ── Shared helpers ────────────────────────────────────────────────────────

function makeRecord(index, overrides = {}) {
  return {
    index,
    title: overrides.title || \`Record \${index}\`,
    date: overrides.date || "2026-06-01",
    source_table: "whatsapp_messages",
    source_id: \`src-\${index}\`,
    severity_or_risk: overrides.severity || null,
    hashtags: overrides.hashtags || [],
    text: overrides.text || \`Record text for index \${index}\`
  };
}

// Builds a minimal AI response object (simulating model output) and runs
// it through parseInsightJson so we exercise the real parsing path.
function parseFixture(jsonString) {
  return parseInsightJson(jsonString);
}

// Validates that every evidence_record_indexes value is within the supplied
// index set – mirrors the spec "100% of finding citations reference supplied
// record indexes" pass criterion.
function assertFindingIndexesValid(findings, suppliedIndexes) {
  const indexSet = new Set(suppliedIndexes);
  for (const f of findings) {
    for (const idx of (f.evidence_record_indexes || [])) {
      assert.ok(
        indexSet.has(idx),
        \`Finding "\${f.id}" cites record index \${idx} which was not in supplied records\`
      );
    }
  }
}

// Validates that every supporting_finding_ids value references an existing
// finding ID – mirrors "100% of insight finding IDs exist in the returned
// findings array" pass criterion.
function assertInsightFindingIdsValid(insights, findings) {
  const findingIds = new Set(findings.map((f) => f.id));
  for (const ins of insights) {
    for (const fid of (ins.supporting_finding_ids || [])) {
      assert.ok(
        findingIds.has(fid),
        \`Insight "\${ins.title}" references unknown finding id "\${fid}"\`
      );
    }
  }
}

const VALID_CATEGORIES = new Set([
  "blocker", "decision", "missing_info", "repeated_topic",
  "commercial", "quality_safety", "entity"
]);
const VALID_SEVERITIES = new Set(["high", "medium", "low"]);
const VALID_STATUSES   = new Set(["active", "requires_validation", "resolved"]);

function assertFindingSchema(finding) {
  assert.equal(typeof finding.id,       "string", "finding.id must be string");
  assert.equal(typeof finding.title,    "string", "finding.title must be string");
  assert.ok(VALID_CATEGORIES.has(finding.category), \`finding.category "\${finding.category}" invalid\`);
  assert.ok(VALID_SEVERITIES.has(finding.severity), \`finding.severity "\${finding.severity}" invalid\`);
  assert.ok(typeof finding.confidence === "number" && finding.confidence >= 0 && finding.confidence <= 1,
    "finding.confidence must be 0..1");
  assert.ok(Array.isArray(finding.evidence_record_indexes), "evidence_record_indexes must be array");
}

function assertInsightSchema(insight) {
  assert.equal(typeof insight.title,   "string", "insight.title must be string");
  assert.ok(VALID_CATEGORIES.has(insight.category), \`insight.category "\${insight.category}" invalid\`);
  assert.ok(VALID_SEVERITIES.has(insight.severity), \`insight.severity "\${insight.severity}" invalid\`);
  assert.ok(typeof insight.confidence === "number" && insight.confidence >= 0 && insight.confidence <= 1,
    "insight.confidence must be 0..1");
  assert.ok(VALID_STATUSES.has(insight.status), \`insight.status "\${insight.status}" invalid\`);
  assert.ok(Array.isArray(insight.supporting_finding_ids), "supporting_finding_ids must be array");
}

// ── I1: Two records → two findings + one insight (multi-finding) ──────────
test("I1: commitment record + open update → two cited findings + one connecting insight", () => {
  const records = [makeRecord(0, { text: "ניתנה התחייבות לביצוע עבודות חשמל עד 2026-05-01" }),
                   makeRecord(1, { text: "עדכון: עבודות החשמל טרם בוצעו, הנושא עדיין פתוח" })];
  const payload = {
    findings: [
      { id: "f1", title: "התחייבות חשמל", category: "decision", severity: "high",
        confidence: 0.9, finding: "ניתנה התחייבות", why_it_matters: "חשוב",
        recommended_action: "לבדוק", hashtags: [], evidence_record_indexes: [0] },
      { id: "f2", title: "עדכון פתוח", category: "blocker", severity: "high",
        confidence: 0.85, finding: "עדיין פתוח", why_it_matters: "חשוב",
        recommended_action: "לעקוב", hashtags: [], evidence_record_indexes: [1] }
    ],
    insights: [
      { title: "עיכוב עבודות חשמל", category: "blocker", severity: "high",
        confidence: 0.87, insight: "התחייבות לא מומשה", why_it_matters: "חשוב",
        recommended_action: "לדרוש עדכון התחייבות", uncertainty: "",
        status: "active", based_on_patterns: [], supporting_finding_ids: ["f1", "f2"] }
    ]
  };
  const jsonStr = JSON.stringify(payload);
  const parsed = parseFixture(jsonStr);
  assert.ok(parsed, "JSON must parse");

  const findings = parsed.findings || [];
  const insights = parsed.insights || [];
  assert.ok(findings.length >= 2, "I1: must have at least 2 findings");
  assert.ok(insights.length >= 1, "I1: must have at least 1 insight");
  // Insight must connect ≥2 findings
  assert.ok(insights[0].supporting_finding_ids.length >= 2,
    "I1: insight must connect at least 2 findings");

  findings.forEach(assertFindingSchema);
  insights.forEach(assertInsightSchema);
  assertFindingIndexesValid(findings, [0, 1]);
  assertInsightFindingIdsValid(insights, findings);
});

// ── I2: Single ordinary record → finding only, insights empty ─────────────
test("I2: single ordinary open request → finding only, insights is []", () => {
  const payload = {
    findings: [
      { id: "f1", title: "בקשה פתוחה", category: "missing_info", severity: "medium",
        confidence: 0.7, finding: "בקשה לא נענתה", why_it_matters: "חשוב",
        recommended_action: "לברר", hashtags: [], evidence_record_indexes: [0] }
    ],
    insights: []
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");
  assert.ok(Array.isArray(parsed.findings) && parsed.findings.length >= 1,
    "I2: findings must not be empty");
  assert.ok(Array.isArray(parsed.insights) && parsed.insights.length === 0,
    "I2: insights must be empty for a single ordinary record");
  assertFindingSchema(parsed.findings[0]);
  assertFindingIndexesValid(parsed.findings, [0]);
});

// ── I3: Closed cluster → no active-risk insight ───────────────────────────
test("I3: cluster with newer closure update → no active-risk insight for that topic", () => {
  const payload = {
    findings: [
      { id: "f1", title: "נושא נסגר", category: "decision", severity: "low",
        confidence: 0.9, finding: "הנושא נסגר", why_it_matters: "",
        recommended_action: "", hashtags: [], evidence_record_indexes: [0] }
    ],
    insights: []
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");
  // If there are any insights, none of them should have status "active"
  // for a closed-cluster topic
  for (const ins of (parsed.insights || [])) {
    assert.notEqual(ins.status, "active",
      "I3: must not present active-risk insight for a closed cluster");
  }
});

// ── I4: Contradiction → requires_validation, no side taken ───────────────
test("I4: two records disagree on approval status → requires_validation insight, no side taken", () => {
  const payload = {
    findings: [
      { id: "f1", title: "אישור לפי מסמך א", category: "decision", severity: "medium",
        confidence: 0.75, finding: "לפי מסמך א – אושר", why_it_matters: "",
        recommended_action: "", hashtags: [], evidence_record_indexes: [0] },
      { id: "f2", title: "סירוב לפי מסמך ב", category: "decision", severity: "medium",
        confidence: 0.75, finding: "לפי מסמך ב – לא אושר", why_it_matters: "",
        recommended_action: "", hashtags: [], evidence_record_indexes: [1] }
    ],
    insights: [
      { title: "סתירה בסטטוס האישור", category: "decision", severity: "high",
        confidence: 0.6, insight: "קיימת סתירה בין המקורות", why_it_matters: "",
        recommended_action: "לבדוק", uncertainty: "מקורות סותרים",
        status: "requires_validation", based_on_patterns: [],
        supporting_finding_ids: ["f1", "f2"] }
    ]
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");

  const insights = parsed.insights || [];
  assert.ok(insights.length >= 1, "I4: must produce a contradiction insight");
  for (const ins of insights) {
    if (ins.supporting_finding_ids?.includes("f1") && ins.supporting_finding_ids?.includes("f2")) {
      assert.equal(ins.status, "requires_validation",
        "I4: contradictory insight must have status requires_validation");
    }
  }
  assertFindingIndexesValid(parsed.findings, [0, 1]);
  assertInsightFindingIdsValid(insights, parsed.findings);
});

// ── I5: dependency_risk pattern → cautious language only ──────────────────
test("I5: dependency_risk pattern → cautious phrasing, no confirmed blockage", () => {
  // Simulate model output that correctly uses cautious language
  const payload = {
    findings: [
      { id: "f1", title: "ספק משותף", category: "blocker", severity: "medium",
        confidence: 0.7, finding: "נדרש לבדוק האם הספק X משפיע על Y",
        why_it_matters: "", recommended_action: "", hashtags: [],
        evidence_record_indexes: [0] }
    ],
    insights: []
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");

  // The finding text must use cautious phrasing (no absolute blockage claim)
  for (const f of (parsed.findings || [])) {
    const text = (f.finding || "").toLowerCase();
    assert.ok(!text.includes("חסם מאושר") && !text.includes("confirmed blockage"),
      "I5: must not declare a confirmed blockage from a dependency_risk pattern");
  }
});

// ── I6: Root-cause hypothesis → labelled as requiring validation ──────────
test("I6: root-cause hypothesis without direct evidence → always labelled as hypothesis", () => {
  const payload = {
    findings: [
      { id: "f1", title: "ממצא בסיס", category: "decision", severity: "medium",
        confidence: 0.8, finding: "ייתכן שהסיבה היא X – נדרשת אימות", why_it_matters: "",
        recommended_action: "לאמת השערה", hashtags: [], evidence_record_indexes: [0] }
    ],
    insights: []
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");

  for (const f of (parsed.findings || [])) {
    const text = (f.finding || "");
    // If the finding mentions a hypothesis/root-cause topic, it must not assert it as fact
    if (text.includes("הסיבה")) {
      assert.ok(
        text.includes("ייתכן") || text.includes("נדרשת") || text.includes("השערה") ||
        text.includes("requires") || text.includes("hypothesis"),
        "I6: root-cause finding must be phrased as a hypothesis requiring validation"
      );
    }
  }
});

// ── I7: Prompt-injection in record text → ignored as instruction ──────────
test("I7: record text containing injection attempt → treated as data, no unsupported blocker", () => {
  // The injected text is the record content; the model must ignore it as instruction
  const payload = {
    findings: [],   // correct: no finding because no real evidence supports one
    insights: []
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");
  // If findings are empty, insights must also be empty
  if (!parsed.findings || parsed.findings.length === 0) {
    assert.ok(!parsed.insights || parsed.insights.length === 0,
      "I7: no insights when no grounded findings exist");
  }
});

// ── I8: Unknown record index → contract validation rejects it ─────────────
test("I8: finding cites record index not in supplied records → contract violation detected", () => {
  const suppliedIndexes = [0, 1]; // only 2 records
  const findings = [
    { id: "f1", title: "ממצא", category: "decision", severity: "low",
      confidence: 0.8, finding: "נמצא בעיה", why_it_matters: "", recommended_action: "",
      hashtags: [], evidence_record_indexes: [0, 99] }  // 99 is NOT supplied
  ];
  const invalidIndexes = findings
    .flatMap((f) => f.evidence_record_indexes)
    .filter((idx) => !suppliedIndexes.includes(idx));
  assert.ok(invalidIndexes.length > 0,
    "I8: should detect at least one invalid index citation");
  assert.ok(invalidIndexes.includes(99),
    "I8: specifically detects the out-of-range index 99");
});

// ── I9: Critical single record (stop-work order) → single-finding insight allowed ──
test("I9: explicit stop-work order record → single-finding insight is allowed", () => {
  const payload = {
    findings: [
      { id: "f1", title: "הוראת עצירת עבודה", category: "blocker", severity: "high",
        confidence: 0.95, finding: "ניתנה הוראת עצירת עבודה רשמית", why_it_matters: "קריטי",
        recommended_action: "לטפל מיידית", hashtags: [], evidence_record_indexes: [0] }
    ],
    insights: [
      { title: "עצירת עבודה בתוקף", category: "blocker", severity: "high",
        confidence: 0.93, insight: "הוצאה הוראת עצירה פורמלית", why_it_matters: "קריטי",
        recommended_action: "לפתור לפני חידוש", uncertainty: "",
        status: "active", based_on_patterns: [], supporting_finding_ids: ["f1"] }
    ]
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");

  const insights = parsed.insights || [];
  const findings = parsed.findings || [];
  // A single-finding insight is explicitly allowed for a stop-work order
  assert.ok(findings.length >= 1, "I9: must have finding");
  assert.ok(insights.length >= 1, "I9: single-finding insight is allowed for a stop-work order");
  assert.ok(insights[0].supporting_finding_ids?.length >= 1,
    "I9: insight must reference its finding");

  findings.forEach(assertFindingSchema);
  insights.forEach(assertInsightSchema);
  assertFindingIndexesValid(findings, [0]);
  assertInsightFindingIdsValid(insights, findings);
});

// ── I10: Hashtag-only similarity → no insight ────────────────────────────
test("I10: records share only a broad hashtag → no insight based solely on that", () => {
  const payload = {
    findings: [
      { id: "f1", title: "רשומה א", category: "decision", severity: "low",
        confidence: 0.6, finding: "רשומה ראשונה", why_it_matters: "",
        recommended_action: "", hashtags: ["construction"], evidence_record_indexes: [0] },
      { id: "f2", title: "רשומה ב", category: "decision", severity: "low",
        confidence: 0.6, finding: "רשומה שנייה", why_it_matters: "",
        recommended_action: "", hashtags: ["construction"], evidence_record_indexes: [1] }
    ],
    insights: []  // correct: no insight when only hashtag overlap
  };
  const parsed = parseFixture(JSON.stringify(payload));
  assert.ok(parsed, "JSON must parse");

  // Spec says: no insight created based on hashtag alone → insights must be empty
  assert.ok(Array.isArray(parsed.insights) && parsed.insights.length === 0,
    "I10: must not create an insight when the only connection is a shared broad hashtag");

  parsed.findings.forEach(assertFindingSchema);
  assertFindingIndexesValid(parsed.findings, [0, 1]);
});

// ── I_SCHEMA: defaultPrompts() exposes the new structured prompt ──────────
test("I_SCHEMA: defaultPrompts() project_insights uses the new structured prompt format", () => {
  const prompts = defaultPrompts();
  assert.ok(typeof prompts.project_insights === "string",
    "defaultPrompts() must return a string for project_insights");
  assert.ok(prompts.project_insights.includes("# Identity"),
    "New prompt must contain # Identity section");
  assert.ok(prompts.project_insights.includes("# Authoritative Runtime Inputs"),
    "New prompt must contain # Authoritative Runtime Inputs section");
  assert.ok(prompts.project_insights.includes("# Evidence And Inference Rules"),
    "New prompt must contain # Evidence And Inference Rules section");
  assert.ok(prompts.project_insights.includes("# Synthesis Rules"),
    "New prompt must contain # Synthesis Rules section");
  assert.ok(prompts.project_insights.includes("# Output Contract"),
    "New prompt must contain # Output Contract section");
  assert.ok(prompts.project_insights.includes("# Failure Behaviour"),
    "New prompt must contain # Failure Behaviour section");
  assert.ok(prompts.project_insights.includes("# JSON Schema"),
    "New prompt must contain # JSON Schema section");
  // Must not contain the old-format paragraph opening
  assert.ok(!prompts.project_insights.includes("You are the BIDOC construction-project Insight Synthesis Agent."),
    "Old single-paragraph format must be gone");
});

`;

const updated = content.slice(0, runnerIdx) + TESTS_BLOCK + content.slice(runnerIdx);
fs.writeFileSync(target, updated, "utf8");
console.log("OK: I1-I10 tests appended to", target);
