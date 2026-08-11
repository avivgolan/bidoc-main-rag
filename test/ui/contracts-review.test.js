import { test, expect } from "@playwright/test";
import crypto from "node:crypto";
import { collectPageErrors } from "./helpers/setup.js";

const TEST_SESSION_SECRET = "playwright-test-session-secret";

async function addTestSuperadminSession(page) {
  const payload = Buffer.from(JSON.stringify({
    sub: "11111111-1111-4111-8111-111111111111",
    email: "contracts-review@example.test",
    role: "סופראדמין",
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", TEST_SESSION_SECRET).update(payload).digest("base64url");
  await page.context().addCookies([{
    name: "bidoc_session",
    value: `${payload}.${signature}`,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax"
  }]);
}

const extraction = {
  mode: "dry_run",
  extractorVersion: "contracts-agent.phase1.v1",
  document: {
    documentVersionId: `sha256:${"a".repeat(64)}`,
    filename: "contract.pdf"
  },
  projectBinding: {
    projectId: "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7",
    projectSite: "Herzliya showroom"
  },
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

async function openPreparedRejectionReview(page, { applyApproved }) {
  const requests = { save: [], commit: [] };
  await addTestSuperadminSession(page);
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort("blockedbyclient"));
  await page.route("**/api/contracts/review/status", (route) => route.fulfill({
    json: { active: true, mode: applyApproved ? "promotion_enabled" : "review_only", migrationVersion: "20260810175150", applyApproved }
  }));
  await page.route("**/api/contracts/extract", (route) => route.fulfill({ json: extraction }));
  await page.route("**/api/contracts/review/plan", (route) => route.fulfill({ json: { extraction, plan: rejectionPlan } }));
  await page.route("**/api/contracts/review/save", async (route) => {
    requests.save.push(JSON.parse(route.request().postData() || "{}"));
    return route.fulfill({ json: { status: "reviewed_no_promotion", promotedCount: 0, promotions: [] } });
  });
  await page.route("**/api/contracts/review/commit", async (route) => {
    requests.commit.push(JSON.parse(route.request().postData() || "{}"));
    return route.fulfill({ status: 500, json: { error: "Promotion endpoint must not be called by a review-only action." } });
  });

  await page.goto("/#contracts");
  await page.waitForSelector("#contracts.active", { timeout: 10_000 });
  await page.locator('#contracts input[type="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nreview-only-fixture", "utf8")
  });
  await page.getByRole("button", { name: "הרץ חילוץ יבש" }).click();
  await expect(page.getByRole("heading", { name: "Complete and deliver the works" })).toBeVisible();
  await page.getByLabel("נימוק החלטה").fill("נדחה זמנית עד לאימות מועד ההתחלה ולוח ימי העבודה.");
  await page.getByLabel("נימוק סקירה כללי").fill("כל המועמדים נדחו לאחר סקירה אנושית מלאה וללא קידום למנוע הלו״ז.");
  await page.getByRole("button", { name: "הכן ובדוק תוכנית קידום" }).click();
  await expect(page.getByText("מוכן לשמירת סקירה")).toBeVisible();
  return requests;
}

test.describe("Contracts review-only workflow", () => {
  test("saves a complete rejection review without calling the promotion action", async ({ page }) => {
    const requests = await openPreparedRejectionReview(page, { applyApproved: true });
    const errors = collectPageErrors(page);
    const saveButton = page.getByRole("button", { name: "שמור סקירה ללא קידום" });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(page.getByText("הסקירה נשמרה ביומן הביקורת בלבד. לא קודמו ולא נוצרו רשומות לו״ז.")).toBeVisible();
    expect(requests.save).toHaveLength(1);
    expect(requests.save[0].persistReview).toBe(true);
    expect(requests.save[0].commit).toBeUndefined();
    expect(requests.commit).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test("distinguishes a disabled server activation gate from a missing migration", async ({ page }) => {
    const requests = await openPreparedRejectionReview(page, { applyApproved: false });
    await expect(page.getByText("שמירת ביקורות מושבתת בצד השרת. ה־migration אינו נבדק או מופעל מכפתור זה.")).toBeVisible();
    await expect(page.getByRole("button", { name: "שמור סקירה ללא קידום" })).toBeDisabled();
    expect(requests.save).toHaveLength(0);
    expect(requests.commit).toHaveLength(0);
  });
});
