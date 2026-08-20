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
  await expect(page.getByRole("heading", { name: "השלם ומסור את העבודות" })).toBeVisible();
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
    await expect(page.getByText("שמירת ביקורות מושבתת בצד השרת. שינוי תשתית הנתונים אינו נבדק או מופעל מכפתור זה.")).toBeVisible();
    await expect(page.getByRole("button", { name: "שמור סקירה ללא קידום" })).toBeDisabled();
    expect(requests.save).toHaveLength(0);
    expect(requests.commit).toHaveLength(0);
  });
});

const SAVED_WORKSPACE_ID = "88888888-8888-4888-8888-888888888888";
const SAVED_SCHEDULE_PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const SAVED_CLAUSE_WORKSPACE_ID = "99999999-9999-4999-8999-999999999999";

const savedClausePreview = {
  persisted: true,
  document: {
    documentVersionId: `sha256:${"b".repeat(64)}`,
    filename: "saved-contract.pdf",
    pageCount: 1
  },
  generations: {
    parserGenerationId: "contracts-clause-parser.r2.v1:test",
    enrichmentGenerationId: "contracts-clause-enrichment.r3.v1:test",
    modelVersion: "test-model"
  },
  coverage: {
    sourceLineCount: 1,
    accountedSourceLineCount: 1,
    numberedSourceCount: 1,
    errorCount: 0
  },
  quality: { referenceCount: 0 },
  clauses: [{
    clauseKey: "1.1",
    clauseOrder: 1,
    parentClauseKey: null,
    clauseType: "subclause",
    clauseTitle: null,
    rawText: "1.1 הקבלן יבצע את העבודות בהתאם להסכם.",
    rawTextSha256: "source-hash",
    contentSha256: "content-hash",
    summaryHe: "הקבלן יבצע את העבודות בהתאם להסכם.",
    hashtags: ["execution"],
    crossReferences: [],
    pageStart: 1,
    pageEnd: 1,
    processingStatus: "processed"
  }]
};

async function openSavedClauseWorkspace(page) {
  await addTestSuperadminSession(page);
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort("blockedbyclient"));
  await page.route("**/api/contracts/clauses/status", (route) => route.fulfill({
    json: { active: true, ready: true, applyApproved: true, migrationVersion: "20260815180207" }
  }));
  await page.route(/\/api\/contracts\/clauses\/workspaces\?.*$/u, (route) => route.fulfill({
    json: {
      items: [{
        workspaceId: SAVED_CLAUSE_WORKSPACE_ID,
        projectSite: "חוזה בדיקה שמור",
        filename: savedClausePreview.document.filename,
        clauseCount: 1,
        pageCount: 1,
        createdAt: "2026-08-19T08:00:00.000Z",
        documentVersionId: savedClausePreview.document.documentVersionId
      }]
    }
  }));
  await page.route(`**/api/contracts/clauses/workspaces/${SAVED_CLAUSE_WORKSPACE_ID}`, (route) => route.fulfill({
    json: {
      workspace: { workspaceId: SAVED_CLAUSE_WORKSPACE_ID, projectSite: "חוזה בדיקה שמור" },
      preview: savedClausePreview
    }
  }));

  await page.goto("/#contracts");
  await page.waitForSelector("#contracts.active", { timeout: 10_000 });
  await page.getByRole("button", { name: "פתח ללא חילוץ חוזר" }).click();
  await expect(page.getByRole("tablist", { name: "שלבי העבודה בחוזה הפתוח" })).toBeVisible();
}

test.describe("Contracts saved-clause workspace tabs", () => {
  test("shows one stage at a time and preserves the stage state while switching", async ({ page }) => {
    await openSavedClauseWorkspace(page);
    const errors = collectPageErrors(page);
    const clausesTab = page.getByRole("tab", { name: /תוכן החוזה/u });
    const relationshipsTab = page.getByRole("tab", { name: /קשרים בין סעיפים/u });
    const decisionsTab = page.getByRole("tab", { name: /החלטות חוזיות/u });
    const indicatorTab = page.getByRole("tab", { name: /מסירה ל־Indicator/u });

    await expect(clausesTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "2. תוכן החוזה שחולץ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. קשרים בין סעיפי החוזה" })).toBeHidden();

    const search = page.getByRole("searchbox", { name: "חיפוש בכל הסעיפים" });
    await search.fill("קבלן");
    await relationshipsTab.click();
    await expect(relationshipsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "3. קשרים בין סעיפי החוזה" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "2. תוכן החוזה שחולץ" })).toBeHidden();

    await decisionsTab.click();
    await expect(page.getByRole("heading", { name: "4. החלטות חוזיות מנורמלות" })).toBeVisible();
    await indicatorTab.click();
    await expect(page.getByRole("heading", { name: "5. ערכת החלטות ל־Indicator" })).toBeVisible();
    await clausesTab.click();
    await expect(search).toHaveValue("קבלן");
    expect(errors).toHaveLength(0);
  });
});

function savedReviewDraft(revision, reviewReason = "טיוטה שמורה מהשרת") {
  return {
    draftVersion: "contracts-review-draft.phase3f1.v1",
    decisions: {
      "review-only-candidate-1": {
        action: "reject",
        reason: "נדחה עד לאימות מלא של לוח ימי העבודה.",
        gatesReviewed: false,
        milestoneKey: "",
        approvedBy: "",
        calendarSemantics: "",
        conflictReason: ""
      }
    },
    reviewReason,
    batchId: "contracts-review-saved-test",
    reviewedAt: "2026-08-12T12:00:00.000Z",
    mappingDraft: null,
    candidateCount: 1,
    reviewedCount: 1,
    approvedCount: 0,
    rejectedCount: 1,
    revision,
    updatedAt: "2026-08-12T12:00:00.000Z"
  };
}

function savedWorkspace(draft) {
  return {
    workspaceId: SAVED_WORKSPACE_ID,
    workspaceVersion: "contracts-workspace.phase3f1.v1",
    documentVersionId: extraction.document.documentVersionId,
    filename: extraction.document.filename,
    projectSite: extraction.projectBinding.projectSite,
    sourceProjectId: extraction.projectBinding.projectId,
    scheduleProjectId: SAVED_SCHEDULE_PROJECT_ID,
    candidateCount: extraction.candidates.length,
    createdAt: "2026-08-12T11:00:00.000Z",
    lastOpenedAt: "2026-08-12T12:00:00.000Z",
    extraction,
    draft
  };
}

async function openSavedWorkspaceReview(page, { initialDraft, onDraftSave, canonicalDraft = initialDraft }) {
  await addTestSuperadminSession(page);
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort("blockedbyclient"));
  await page.route("**/api/contracts/review/status", (route) => route.fulfill({
    json: { active: true, mode: "review_only", migrationVersion: "20260810175150", applyApproved: false }
  }));
  await page.route("**/api/contracts/activity-mapping/status", (route) => route.fulfill({
    json: { active: true, mode: "manual_review", reviewApplyApproved: false }
  }));
  await page.route("**/api/contracts/workspaces/status", (route) => route.fulfill({
    json: {
      active: true,
      ready: true,
      mode: "saved_workspaces",
      migrationVersion: "20260812135210",
      storageBucket: "contracts-private"
    }
  }));
  await page.route(/\/api\/contracts\/workspaces(?:\?.*)?$/u, (route) => route.fulfill({
    json: { workspaceVersion: "contracts-workspace.phase3f1.v1", items: [savedWorkspace(initialDraft)] }
  }));
  await page.route("**/api/contracts/workspaces/extract", (route) => route.fulfill({
    json: {
      ok: true,
      reused: true,
      workspace: savedWorkspace(null),
      extraction,
      draft: initialDraft
    }
  }));
  await page.route(`**/api/contracts/workspaces/${SAVED_WORKSPACE_ID}`, (route) => route.fulfill({
    json: { ok: true, workspace: savedWorkspace(canonicalDraft) }
  }));
  await page.route(`**/api/contracts/workspaces/${SAVED_WORKSPACE_ID}/draft`, onDraftSave);

  await page.goto("/#contracts");
  await page.waitForSelector("#contracts.active", { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "טען, חלץ ושמור חוזה" })).toBeVisible();
  await page.locator('#contracts input[type="file"]').setInputFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nsaved-workspace-fixture", "utf8")
  });
  await page.getByRole("button", { name: "טען, חלץ ושמור חוזה" }).click();
  await expect(page.getByRole("heading", { name: "השלם ומסור את העבודות" })).toBeVisible();
}

test.describe("Contracts saved-workspace autosave concurrency", () => {
  test("labels a newly opened untouched workspace without creating a draft row", async ({ page }) => {
    let draftWrites = 0;
    await openSavedWorkspaceReview(page, {
      initialDraft: null,
      onDraftSave: (route) => {
        draftWrites += 1;
        return route.fulfill({ status: 500, json: { error: "unexpected_draft_write" } });
      }
    });

    await expect(page.getByText("טרם בוצעו שינויים בטיוטה", { exact: true })).toBeVisible();
    await page.waitForTimeout(900);
    expect(draftWrites).toBe(0);
  });

  test("does not save on open and serializes rapid edits with the latest revision", async ({ page }) => {
    const requests = [];
    let signalFirstSave;
    let releaseFirstSave;
    const firstSaveStarted = new Promise((resolve) => { signalFirstSave = resolve; });
    const firstSaveRelease = new Promise((resolve) => { releaseFirstSave = resolve; });

    await openSavedWorkspaceReview(page, {
      initialDraft: savedReviewDraft(5),
      onDraftSave: async (route) => {
        const body = JSON.parse(route.request().postData() || "{}");
        requests.push(body);
        if (requests.length === 1) {
          signalFirstSave();
          await firstSaveRelease;
        }
        return route.fulfill({
          json: {
            ok: true,
            saved: {
              workspaceId: SAVED_WORKSPACE_ID,
              draftVersion: "contracts-review-draft.phase3f1.v1",
              revision: body.expectedRevision + 1,
              updatedAt: "2026-08-12T12:05:00.000Z",
              reviewedCount: 1,
              approvedCount: 0,
              rejectedCount: 1
            }
          }
        });
      }
    });

    await page.waitForTimeout(900);
    expect(requests).toHaveLength(0);
    await expect(page.locator(".contractsSavedList bdi").first()).toHaveText(SAVED_SCHEDULE_PROJECT_ID);

    const reviewReason = page.getByLabel("נימוק סקירה כללי");
    await reviewReason.fill("עריכה ראשונה שממתינה לשמירה");
    await firstSaveStarted;
    await reviewReason.fill("עריכה שנייה ועדכנית בזמן שהשמירה הראשונה פעילה");
    await page.waitForTimeout(800);
    expect(requests).toHaveLength(1);

    releaseFirstSave();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[0].expectedRevision).toBe(5);
    expect(requests[1].expectedRevision).toBe(6);
    expect(requests[1].reviewReason).toBe("עריכה שנייה ועדכנית בזמן שהשמירה הראשונה פעילה");
    await expect(page.getByText("כל שינויי הטיוטה נשמרו", { exact: true })).toBeVisible();
  });

  test("reloads the canonical draft after a 409 and never overwrites it automatically", async ({ page }) => {
    let draftWrites = 0;
    let canonicalReads = 0;
    const canonicalDraft = savedReviewDraft(8, "הגרסה העדכנית שנשמרה בחלון האחר");

    await openSavedWorkspaceReview(page, {
      initialDraft: savedReviewDraft(7),
      canonicalDraft,
      onDraftSave: (route) => {
        draftWrites += 1;
        return route.fulfill({
          status: 409,
          json: {
            error: "contracts_workspace_draft_stale",
            code: "contracts_workspace_draft_stale",
            message: "A newer draft revision already exists."
          }
        });
      }
    });
    await page.route(`**/api/contracts/workspaces/${SAVED_WORKSPACE_ID}`, (route) => {
      canonicalReads += 1;
      return route.fulfill({ json: { ok: true, workspace: savedWorkspace(canonicalDraft) } });
    });

    await page.getByLabel("נימוק סקירה כללי").fill("שינוי מקומי שנוצר על בסיס גרסה ישנה");
    await expect(page.getByText("הטיוטה השתנתה בחלון אחר. נטענה הגרסה העדכנית מהשרת; השינויים המקומיים שלא נשמרו לא הוחלו ולא דרסו החלטות חדשות יותר.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("נימוק סקירה כללי")).toHaveValue("הגרסה העדכנית שנשמרה בחלון האחר");
    await expect(page.getByText("זוהתה טיוטה חדשה יותר", { exact: true })).toBeVisible();
    await page.waitForTimeout(900);
    expect(draftWrites).toBe(1);
    expect(canonicalReads).toBe(1);
  });
});
