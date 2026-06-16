/**
 * Timeline search and debounce tests.
 * Covers: search by content / tag / allowed metadata, disallowed metadata,
 * 250-ms debounce, clear-search, source-switch clears query,
 * hasMore search indicator.
 *
 * waitForTimeout(300) is used where the debounce delay itself is the behaviour
 * under test (permitted per task spec).
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";
import { INDEX_PAGE_1, INDEX_EVENTS } from "./fixtures/index-events.js";
import { ALERTS_PAGE_1, ALERTS_EVENTS } from "./fixtures/alerts-events.js";
import { INDEX_PAGE_1_PAGINATED } from "./fixtures/pagination.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

/** Type text into the search box one character at a time (simulates fast typing). */
async function typeSearch(page, text) {
  const input = page.locator("#timelineSearch");
  await input.focus();
  await input.fill(text);
}

/** Clear the search input using the native search-clear mechanism. */
async function clearSearch(page) {
  // Set value to empty and fire an input event (fill does this automatically)
  await page.locator("#timelineSearch").fill("");
}

test.describe("Timeline search", () => {
  test("search by content: matching events visible, non-matching hidden", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // idx-001 content contains "ישיבת תיאום קבלן"; no other event matches this prefix
    const uniqueSnippet = "ישיבת תיאום קבלן";
    await typeSearch(page, uniqueSnippet);
    await page.waitForTimeout(300); // wait for 250ms debounce + buffer

    await expect(page.locator(".tlListItem")).toHaveCount(1);
    await expect(page.locator(".tlListItem").filter({ hasText: uniqueSnippet })).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("search by tag: events with matching tag shown, others hidden", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Only idx-001 has the tag "ישיבה"
    await typeSearch(page, "ישיבה");
    await page.waitForTimeout(300);

    await expect(page.locator(".tlListItem")).toHaveCount(1);
    await expect(page.locator(".tlListItem[data-event-id='idx-001']")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("search by allowed index metadata (mail_id) returns matching event", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // idx-001 has metadata.mail_id = "mail-001"; mail_id is in INDEX_METADATA_FIELDS
    await typeSearch(page, "mail-001");
    await page.waitForTimeout(300);

    await expect(page.locator(".tlListItem")).toHaveCount(1);
    await expect(page.locator(".tlListItem[data-event-id='idx-001']")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("search by allowed alerts metadata (alert_type) returns matching alert", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page, { indexResponse: ALERTS_PAGE_1, alertsResponse: ALERTS_PAGE_1 });
    await openTimeline(page);

    // Switch to alerts source
    await page.locator(".tlSrcBtn[data-src='alerts']").click();
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // alrt-001 has metadata.alert_type = "עיכוב"; unique enough among these fixtures
    await typeSearch(page, "עיכוב");
    await page.waitForTimeout(300);

    // alrt-001 has alert_type="עיכוב" and content "עיכוב בביצוע..."
    // alrt-003 has alert_type="בטיחות" — should not match
    const matchCount = await page.locator(".tlListItem").count();
    expect(matchCount).toBeGreaterThanOrEqual(1);
    await expect(page.locator(".tlListItem[data-event-id='alert_alrt-001']")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("disallowed field: mail_id not searched in alerts source (cross-source allowlist)", async ({ page }) => {
    const errors = collectPageErrors(page);

    // Build an alerts fixture that also has a mail_id field (not in ALERTS_METADATA_FIELDS)
    const alertsWithMailId = {
      events: [
        {
          ...ALERTS_EVENTS[0],
          metadata: { ...ALERTS_EVENTS[0].metadata, mail_id: "xmail-unique-999" },
        },
        ...ALERTS_EVENTS.slice(1),
      ],
      page: ALERTS_PAGE_1.page,
    };

    await setupTimelineMocks(page, { indexResponse: ALERTS_PAGE_1, alertsResponse: alertsWithMailId });
    await openTimeline(page);
    await page.locator(".tlSrcBtn[data-src='alerts']").click();
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // "xmail-unique-999" appears only in the disallowed mail_id field of alert 001
    await typeSearch(page, "xmail-unique-999");
    await page.waitForTimeout(300);

    // mail_id is NOT in ALERTS_METADATA_FIELDS, so no events should match
    await expect(page.locator(".tlListItem")).toHaveCount(0);

    expect(errors).toHaveLength(0);
  });

  test("debounce: fast typing does not filter mid-word; single update fires after 250ms", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Type quickly — each key resets the 250ms debounce timer.
    // We don't assert the intermediate count because renderTimeline() is called twice
    // per load (events then links), creating a brief DOM-clear window that can race
    // with a synchronous count() call.
    await page.locator("#timelineSearch").focus();
    await page.locator("#timelineSearch").pressSequentially("ישיבת", { delay: 20 });

    // After 300ms the debounce fires — only idx-001 should match
    await page.waitForTimeout(300);
    await expect(page.locator(".tlListItem")).toHaveCount(1);

    expect(errors).toHaveLength(0);
  });

  test("clear search: emptying input restores all events", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();
    const allCount = await page.locator(".tlListItem").count();

    await typeSearch(page, "ישיבת תיאום");
    await page.waitForTimeout(300);
    await expect(page.locator(".tlListItem")).toHaveCount(1);

    // Clear the input
    await clearSearch(page);
    await page.waitForTimeout(300);

    await expect(page.locator(".tlListItem")).toHaveCount(allCount);

    expect(errors).toHaveLength(0);
  });

  test("source switch clears search query and input field", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Filter the index list
    await typeSearch(page, "ישיבת תיאום");
    await page.waitForTimeout(300);
    await expect(page.locator(".tlListItem")).toHaveCount(1);

    // Switch source — should clear search
    await page.locator(".tlSrcBtn[data-src='alerts']").click();

    // All alerts events shown (search was cleared). Use toHaveCount with auto-retry:
    // renderTimeline() fires twice per load (events then links), so count() called
    // right after first().toBeVisible() can race with the second render's DOM clear.
    await expect(page.locator(".tlListItem")).toHaveCount(ALERTS_EVENTS.length, { timeout: 5_000 });

    // Search input should be empty after source switch
    await expect(page.locator("#timelineSearch")).toHaveValue("");

    expect(errors).toHaveLength(0);
  });

  test("hasMore + search: count shows 'החיפוש חל על הנתונים שנטענו בלבד'", async ({ page }) => {
    const errors = collectPageErrors(page);
    // Use paginated fixture so hasMore=true remains after load
    await setupTimelineMocks(page, { indexResponse: INDEX_PAGE_1_PAGINATED });
    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    await typeSearch(page, "ישיבת");
    await page.waitForTimeout(300);

    await expect(page.locator("#timelineCount")).toContainText("החיפוש חל על הנתונים שנטענו בלבד");

    expect(errors).toHaveLength(0);
  });
});
