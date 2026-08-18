import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { chromium } from "@playwright/test";

const bundle = fs.readFileSync(new URL("../public/react/bidoc-react.js", import.meta.url));
const styles = fs.readFileSync(new URL("../public/styles.css", import.meta.url));
const sourceProjectId = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7";
const documentVersionId = `sha256:${"a".repeat(64)}`;
const candidateKey = "phase3f-candidate-1";
const eventId = "77777777-7777-4777-8777-777777777777";
const firstActivityKey = "gantt:1781010000000_01.08.26.xml:17";
const secondActivityKey = "gantt:1781010000000_01.08.26.xml:18";

const reviewCandidateRoles = [
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
  ["notice_service", "Determine deemed receipt according to delivery channel"],
  ["daily_delay_charge", "Pay a daily charge for delayed completion"]
];

const extraction = {
  mode: "dry_run",
  extractorVersion: "contracts-agent.phase1.v1",
  document: { documentVersionId, filename: "contract.pdf" },
  projectBinding: { projectId: sourceProjectId, projectSite: "Herzliya showroom" },
  candidates: reviewCandidateRoles.map(([role, action], index) => ({
    candidateKey: index === 0 ? candidateKey : `phase3f-candidate-${index + 1}`,
    type: index === 0 ? "fixed_date" : "relative_condition",
    role,
    action,
    storageDisposition: index === 0 ? "candidate_for_schedule_contract_milestones" : "dry_run_only",
    gates: ["human_review_required"],
    fixedDate: index === 0 ? "2026-08-31" : null,
    sourceEvidence: [{
      pdfPage: 12 + index,
      clause: `7.${index + 2}`,
      sourceText: index === 0
        ? "The contractor shall complete the structural framing by 31 August 2026."
        : `Original contract evidence for review candidate ${index + 1}.`
    }],
    metadata: index === 0 ? { milestoneKey: "milestone:structural-framing" } : {}
  })),
  conflicts: []
};

const alternatives = [
  {
    rank: 1,
    canonicalKey: null,
    taskUid: 17,
    activityKey: firstActivityKey,
    taskName: "Complete structural framing",
    outlineLevel: 3,
    isSummary: false,
    isMilestone: true,
    plannedStart: "2026-08-20",
    plannedFinish: "2026-08-31",
    confidence: 0.93,
    evidence: [{ kind: "normalized_name_exact", detail: "Complete structural framing", scoreDelta: 0.88 }],
    blockers: ["human_review_required"]
  },
  {
    rank: 2,
    canonicalKey: null,
    taskUid: 18,
    activityKey: secondActivityKey,
    taskName: "Structural framing inspection",
    outlineLevel: 3,
    isSummary: false,
    isMilestone: true,
    plannedStart: "2026-08-31",
    plannedFinish: "2026-08-31",
    confidence: 0.93,
    evidence: [{ kind: "token_overlap", detail: "structural framing", scoreDelta: 0.5 }],
    blockers: ["human_review_required"]
  }
];

const candidateBundle = {
  mappingContractVersion: "contracts-activity-mapping.phase3.v1",
  outputKind: "candidate_bundle",
  projectContext: {
    sourceSystem: "main",
    sourceProjectId,
    scheduleProjectId: "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5",
    projectMappingId: "33333333-3333-4333-8333-333333333333",
    mappingStatus: "active"
  },
  obligation: {
    documentVersionId,
    candidateKey,
    milestoneKey: "milestone:structural-framing",
    label: "Complete structural framing",
    mappingRequirement: "required",
    conditionStatus: "not_applicable",
    triggerEvidenceReviewed: true,
    sourceEvidence: [{
      evidenceId: `${candidateKey}:source:1`,
      sourceText: "The contractor shall complete the structural framing by 31 August 2026.",
      pdfPage: 12,
      clause: "7.2"
    }]
  },
  scheduleVersion: {
    fileId: "1781010000000_01.08.26.xml",
    relevancyDate: "2026-08-01",
    versionConflict: false
  },
  candidates: alternatives,
  blockers: ["ambiguous_candidates"],
  conflict: { type: "ambiguous_candidates", candidateActivityKeys: [firstActivityKey, secondActivityKey] },
  decisionState: "blocked",
  automaticAlertEligible: false
};

const priorHistoryEvent = {
  eventId,
  eventKey: "activity-mapping-review:55555555-5555-4555-8555-555555555555",
  supersedesEventId: null,
  documentVersionId,
  candidateKey,
  action: "confirm",
  selectedCanonicalKey: "schedule-activity:66666666-6666-4666-8666-666666666666",
  selectedActivityKey: firstActivityKey,
  reviewerId: "44444444-4444-4444-8444-444444444444",
  reviewedAt: "2026-08-11T19:00:00.000Z",
  reason: "Confirmed against exact contract and schedule evidence."
};

let reviewApplyApproved = false;
const reviewRequests = [];

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/") {
    return send(response, 200, "text/html; charset=utf-8", `<!doctype html>
      <html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/styles.css"></head>
      <body><main><section id="contracts" class="panel active"><div data-react-island="contracts"></div></section></main>
      <script type="module" src="/react/bidoc-react.js"></script></body></html>`);
  }
  if (url.pathname === "/styles.css") return send(response, 200, "text/css; charset=utf-8", styles);
  if (url.pathname === "/react/bidoc-react.js") return send(response, 200, "text/javascript; charset=utf-8", bundle);
  if (url.pathname === "/api/contracts/review/status") {
    return sendJson(response, 200, { active: true, mode: "review_only", migrationVersion: "20260810175150", applyApproved: false });
  }
  if (url.pathname === "/api/contracts/activity-mapping/status") {
    return sendJson(response, 200, {
      active: true,
      mode: "manual_review",
      reviewApplyApproved,
      historyMigrationVersion: "20260811214619",
      automaticReviewActionsEnabled: false
    });
  }
  if (url.pathname === "/api/contracts/workspaces/status") {
    return sendJson(response, 200, {
      active: false,
      ready: false,
      mode: "saved_workspaces",
      migrationVersion: "20260812135210",
      storageBucket: "contracts-private"
    });
  }
  if (url.pathname === "/api/contracts/extract") return sendJson(response, 200, extraction);
  if (url.pathname === "/api/contracts/activity-mapping/candidates") {
    const body = await readJson(request);
    assert.equal(body.sourceProjectId, sourceProjectId);
    assert.equal(body.obligation.documentVersionId, documentVersionId);
    assert.equal(body.obligation.sourceEvidence[0].sourceText, candidateBundle.obligation.sourceEvidence[0].sourceText);
    return sendJson(response, 200, { ok: true, mode: "read_only", candidateBundle, operationalWritesPerformed: false });
  }
  if (url.pathname === "/api/contracts/activity-mapping/history") {
    assert.equal(url.searchParams.get("sourceProjectId"), sourceProjectId);
    assert.equal(url.searchParams.get("documentVersionId"), documentVersionId);
    assert.equal(url.searchParams.get("candidateKey"), candidateKey);
    return sendJson(response, 200, {
      ok: true,
      historyVersion: "contracts-activity-mapping-history.phase3f.v1",
      total: 1,
      returned: 1,
      events: [priorHistoryEvent],
      operationalWritesPerformed: false
    });
  }
  if (url.pathname === "/api/contracts/activity-mapping/review") {
    const body = await readJson(request);
    reviewRequests.push(body);
    return sendJson(response, 200, {
      ok: true,
      status: "recorded",
      auditWritePerformed: true,
      operationalWritesPerformed: ["confirm", "correct"].includes(body.action)
    });
  }
  return sendJson(response, 404, { error: "not_found" });
});

function send(response, status, contentType, body) {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" });
  response.end(body);
}

function sendJson(response, status, body) {
  send(response, status, "application/json; charset=utf-8", JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function openMappingWorkspace(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nphase3f-fixture", "utf8")
  });
  await page.getByRole("button", { name: "הרץ חילוץ יבש" }).click();
  await page.getByRole("heading", { name: "4. סקירת קישור לפעילות בלוח" }).waitFor();
  await page.getByRole("button", { name: /בדוק התאמה ללוח/u }).first().click();
  await Promise.race([
    page.getByText("Structural framing inspection", { exact: false }).waitFor(),
    page.locator(".contractsMessage.is-error").waitFor().then(async () => {
      throw new Error(`Mapping workspace error: ${await page.locator(".contractsMessage.is-error").innerText()}`);
    })
  ]);
  await page.getByText("Confirmed against exact contract and schedule evidence.", { exact: true }).waitFor();
}

const requestedPortArgument = process.argv.find((argument) => argument.startsWith("--port="));
const requestedPort = requestedPortArgument ? Number(requestedPortArgument.slice("--port=".length)) : 0;

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const serveOnly = process.argv.includes("--serve-only");

if (serveOnly) {
  console.log(`Contracts Phase 3F visual fixture: ${baseUrl}`);
  await new Promise((resolve) => {
    const stop = () => server.close(resolve);
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  process.exit(0);
}

const browser = await chromium.launch();

try {
  reviewApplyApproved = false;
  const disabledPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openMappingWorkspace(disabledPage, baseUrl);
  const candidateLayout = await disabledPage.locator(".contractsMappingCandidates > button").evaluateAll((buttons) => ({
    count: buttons.length,
    clipped: buttons.filter((button) => button.scrollWidth > button.clientWidth + 1).length,
    rawEnglish: buttons.filter((button) => /Complete|Pay a daily|Provide written|performance_bond|contractual_completion/u.test(button.textContent || "")).length,
    rectangles: buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    })
  }));
  assert.equal(candidateLayout.count, 12);
  assert.equal(candidateLayout.clipped, 0, JSON.stringify(candidateLayout));
  assert.equal(candidateLayout.rawEnglish, 0, JSON.stringify(candidateLayout));
  for (let leftIndex = 0; leftIndex < candidateLayout.rectangles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidateLayout.rectangles.length; rightIndex += 1) {
      const left = candidateLayout.rectangles[leftIndex];
      const right = candidateLayout.rectangles[rightIndex];
      const overlaps = left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
      assert.equal(overlaps, false, `candidate cards ${leftIndex + 1} and ${rightIndex + 1} overlap`);
    }
  }
  await disabledPage.getByText("שער שלב 3F סגור בצד השרת. אפשר לבדוק חלופות והיסטוריה, אך אי אפשר לשמור החלטה.").waitFor();
  assert.equal(await disabledPage.getByRole("button", { name: "שמור אישור" }).isEnabled(), false);
  assert.equal(reviewRequests.length, 0);
  await disabledPage.close();

  reviewApplyApproved = true;
  const enabledPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await openMappingWorkspace(enabledPage, baseUrl);
  await enabledPage.getByLabel("בדקתי את האירוע המפעיל, הלוח, קישור הפרויקט והסתירה ובחרתי חלופה במפורש").check();
  await enabledPage.getByLabel("נימוק החלטת מיפוי").fill("אושר לאחר בדיקת הראיה החוזית, גרסת הלוח והסתירה בין שתי החלופות.");
  await enabledPage.getByRole("button", { name: "שמור אישור" }).click();
  await enabledPage.getByText("החלטת המיפוי נרשמה כאירוע ביקורת בלתי־ניתן לשינוי.").waitFor();
  assert.equal(reviewRequests.length, 1);
  assert.equal(reviewRequests[0].action, "confirm");
  assert.equal(reviewRequests[0].selectedActivityKey, firstActivityKey);
  assert.equal(reviewRequests[0].conflictResolved, true);
  assert.match(reviewRequests[0].reviewRequestId, /^[0-9a-f-]{36}$/u);
  assert.equal(reviewRequests[0].reviewerId, undefined);
  assert.equal(reviewRequests[0].reviewedAt, undefined);
  assert.equal(reviewRequests[0].contentSupabaseKey, undefined);

  await enabledPage.getByRole("button", { name: "תקן החלטה קודמת" }).click();
  await enabledPage.getByLabel("אירוע קודם שהתיקון מחליף").selectOption(eventId);
  await enabledPage.getByText("Structural framing inspection", { exact: false }).click();
  await enabledPage.getByLabel("נימוק החלטת מיפוי").fill("תוקן לאחר סקירה חוזרת ובחירה מפורשת בחלופת פעילות מדויקת יותר.");
  await enabledPage.getByRole("button", { name: "שמור תיקון" }).click();
  assert.equal(reviewRequests.length, 2);
  assert.equal(reviewRequests[1].action, "correct");
  assert.equal(reviewRequests[1].selectedActivityKey, secondActivityKey);
  assert.equal(reviewRequests[1].supersedesEventId, eventId);
  assert.notEqual(reviewRequests[1].reviewRequestId, reviewRequests[0].reviewRequestId);
  await enabledPage.close();

  reviewApplyApproved = false;
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await openMappingWorkspace(mobilePage, baseUrl);
  const mobileLayout = await mobilePage.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    summaryColumns: getComputedStyle(document.querySelector(".contractsMappingSummary")).gridTemplateColumns
  }));
  assert.ok(mobileLayout.documentWidth <= mobileLayout.viewportWidth + 1, JSON.stringify(mobileLayout));
  assert.equal(mobileLayout.summaryColumns.split(" ").length, 1);
  assert.equal(await mobilePage.getByRole("button", { name: "שמור אישור" }).isEnabled(), false);
  await mobilePage.close();

  console.log("Contracts Phase 3F UI verification passed: desktop and 390px mobile, 2 alternatives, exact evidence/history, disabled gate, confirmation, correction, and 0 browser-owned identities or credentials.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
