import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";
import { INDEX_PAGE_1, INDEX_EVENTS } from "./fixtures/index-events.js";
import { ALERTS_EVENTS } from "./fixtures/alerts-events.js";
import { INDEX_PAGE_1_PAGINATED, INDEX_PAGE_2_PAGINATED } from "./fixtures/pagination.js";

// Navigate to the Timeline tab and wait for it to become active.
async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

test.describe("Timeline smoke", () => {
  test("loads timeline, calls compact endpoint, renders events, no page errors", async ({ page }) => {
    const errors = collectPageErrors(page);
    const { requests } = await setupTimelineMocks(page);

    await openTimeline(page);

    // At least one list item visible
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Count element is present
    await expect(page.locator("#timelineCount")).toBeVisible();

    // Compact events endpoint was requested
    expect(requests.some((r) => r.includes("/api/timeline/events"))).toBe(true);

    // First event content appears somewhere in the list (order may vary for same-date events)
    const snippet = INDEX_EVENTS[0].content.slice(0, 15);
    await expect(page.locator(".tlListItem").filter({ hasText: snippet })).toBeVisible();

    // No unexpected page errors
    expect(errors).toHaveLength(0);
  });

  test("switches source to alerts: alerts endpoint called, alert content visible", async ({ page }) => {
    const errors = collectPageErrors(page);
    const { requests } = await setupTimelineMocks(page);

    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Switch to alerts source
    await page.getByRole("button", { name: "התראות" }).click();

    // Wait for alerts to load
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // source=alerts was requested
    expect(requests.some((r) => r.includes("source=alerts"))).toBe(true);

    // Alert content is visible (order may vary for same-date events)
    const alertSnippet = ALERTS_EVENTS[0].content.slice(0, 15);
    await expect(page.locator(".tlListItem").filter({ hasText: alertSnippet })).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("pagination: 'טען עוד' button appears, click loads second page events", async ({ page }) => {
    const errors = collectPageErrors(page);

    await setupTimelineMocks(page, {
      indexResponse: INDEX_PAGE_1_PAGINATED,
      indexPage2: INDEX_PAGE_2_PAGINATED,
    });

    await openTimeline(page);

    // First page items visible
    await expect(page.locator(".tlListItem").first()).toBeVisible();
    const firstPageCount = INDEX_PAGE_1_PAGINATED.events.length;
    await expect(page.locator(".tlListItem")).toHaveCount(firstPageCount);

    // "טען עוד" button is visible
    const loadMoreBtn = page.getByRole("button", { name: "טען עוד" });
    await expect(loadMoreBtn).toBeVisible();

    // Click it
    await loadMoreBtn.click();

    // Both pages now visible
    const totalCount = firstPageCount + INDEX_PAGE_2_PAGINATED.events.length;
    await expect(page.locator(".tlListItem")).toHaveCount(totalCount);

    // Page 2 content is present anywhere in the list (not .last() — sort may vary)
    const p2Snippet = INDEX_PAGE_2_PAGINATED.events[0].content.slice(0, 15);
    await expect(page.locator(".tlListItem").filter({ hasText: p2Snippet })).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("clicking event item opens detail panel with event content", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);

    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Click a specific list item by ID to avoid date-sort ambiguity between same-date events
    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    // Detail title heading is visible
    const detailTitle = page.locator("#tlDetailTitle");
    await expect(detailTitle).toBeVisible();

    // Title reflects the clicked event (idx-001 = INDEX_EVENTS[0])
    const expectedTitle = INDEX_EVENTS[0].content.slice(0, 20);
    await expect(detailTitle).toContainText(expectedTitle);

    // Detail body content visible
    await expect(page.locator(".tlDetailBody")).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
