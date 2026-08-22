import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { chromium } from "@playwright/test";

const bundle = fs.readFileSync(new URL("../public/react/bidoc-react.js", import.meta.url));
const styles = fs.readFileSync(new URL("../public/styles.css", import.meta.url));

const extraction = {
  mode: "dry_run",
  extractorVersion: "contracts-agent.phase1.v1",
  document: { documentVersionId: `sha256:${"a".repeat(64)}`, filename: "contract.pdf" },
  projectBinding: { projectId: "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7", projectSite: "Herzliya showroom" },
  candidates: [{
    candidateKey: "review-only-candidate-1",
    role: "contractual_completion",
    action: "Complete and deliver the works",
    storageDisposition: "candidate_for_schedule_contract_conditions",
    gates: ["human_review_required", "working_calendar_missing"],
    offset: { value: 100, unit: "working_day", direction: "after" },
    sourceEvidence: [{ pdfPage: 14, clause: "Appendix B, item 2", sourceText: "The works shall be completed within 100 working days from commencement." }],
    metadata: {}
  }],
  conflicts: []
};

const rejectionPlan = {
  status: "blocked",
  transactionReady: false,
  operationalWritesPerformed: false,
  globalBlockers: [],
  candidatePlans: [{ candidateKey: "review-only-candidate-1", status: "rejected", targetTable: null, blockers: [], row: null }],
  rowsByTable: {
    schedule_contract_milestones: [],
    schedule_contract_extensions: [],
    schedule_contract_conditions: []
  },
  audit: [{ candidateKey: "review-only-candidate-1", outcome: "rejected" }]
};

let applyApproved = true;
let saveMode = "success";
const requests = { save: [], commit: [] };

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
    return sendJson(response, 200, { active: true, mode: applyApproved ? "promotion_enabled" : "review_only", migrationVersion: "20260810175150", applyApproved });
  }
  if (url.pathname === "/api/contracts/activity-mapping/status") {
    return sendJson(response, 200, {
      active: true,
      mode: "manual_review",
      reviewApplyApproved: false,
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
  if (url.pathname === "/api/contracts/review/plan") return sendJson(response, 200, { extraction, plan: rejectionPlan });
  if (url.pathname === "/api/contracts/review/save") {
    requests.save.push(await readJson(request));
    if (saveMode === "migration_missing") {
      return sendJson(response, 503, {
        error: "contracts_promotion_migration_missing",
        message: "The expected Contracts Phase 2 RPC is unavailable in APP DATA. Verify that the approved migration is applied and exposed before retrying."
      });
    }
    return sendJson(response, 200, { status: "reviewed_no_promotion", promotedCount: 0, promotions: [] });
  }
  if (url.pathname === "/api/contracts/review/commit") {
    requests.commit.push(await readJson(request));
    return sendJson(response, 500, { error: "Promotion endpoint must not be called by a review-only action." });
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

async function prepareReview(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nreview-only-fixture", "utf8")
  });
  await page.getByRole("button", { name: "הרץ גם את החילוץ הקלאסי" }).click();
  await page.getByLabel("נימוק החלטה").fill("נדחה זמנית עד לאימות מועד ההתחלה ולוח ימי העבודה.");
  await page.getByLabel("נימוק סקירה כללי").fill("כל המועמדים נדחו לאחר סקירה אנושית מלאה וללא קידום למנוע הלו״ז.");
  await page.getByRole("button", { name: "הכן ובדוק תוכנית קידום" }).click();
  await page.getByText("מוכן לשמירת סקירה").waitFor();
}

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;
const browser = await chromium.launch();

try {
  applyApproved = true;
  saveMode = "success";
  const enabledPage = await browser.newPage();
  await prepareReview(enabledPage, baseUrl);
  const saveButton = enabledPage.getByRole("button", { name: "שמור סקירה ללא קידום" });
  assert.equal(await saveButton.isEnabled(), true);
  await saveButton.click();
  await enabledPage.getByText("הסקירה נשמרה ביומן הביקורת בלבד. לא קודמו ולא נוצרו רשומות לו״ז.").waitFor();
  assert.equal(requests.save.length, 1);
  assert.equal(requests.save[0].persistReview, true);
  assert.equal(requests.save[0].commit, undefined);
  assert.equal(requests.commit.length, 0);
  await enabledPage.close();

  applyApproved = false;
  const disabledPage = await browser.newPage();
  await prepareReview(disabledPage, baseUrl);
  await disabledPage.getByText("שמירת ביקורות מושבתת בצד השרת. שינוי תשתית הנתונים אינו נבדק או מופעל מכפתור זה.").waitFor();
  assert.equal(await disabledPage.getByRole("button", { name: "שמור סקירה ללא קידום" }).isEnabled(), false);
  assert.equal(requests.save.length, 1);
  assert.equal(requests.commit.length, 0);
  await disabledPage.close();

  applyApproved = true;
  saveMode = "migration_missing";
  const missingMigrationPage = await browser.newPage();
  await prepareReview(missingMigrationPage, baseUrl);
  await missingMigrationPage.getByRole("button", { name: "שמור סקירה ללא קידום" }).click();
  await missingMigrationPage.getByText("תשתית שמירת הסקירה אינה זמינה כעת בצד השרת.").waitFor();
  assert.equal(requests.save.length, 2);
  assert.equal(requests.commit.length, 0);
  await missingMigrationPage.close();

  console.log("Contracts review-only UI verification passed: 3 scenarios, 1 audit-only save, 1 migration-readiness error, 0 promotion calls.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
