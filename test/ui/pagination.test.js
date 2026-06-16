/**
 * Timeline pagination tests.
 * Covers: first-load query params, hasMore shows/hides load-more, cursor sent on
 * page 2, page 2 appended not replaced, no duplicates across pages.
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";
import { INDEX_PAGE_1 } from "./fixtures/index-events.js";
import {
  INDEX_PAGE_1_PAGINATED,
  INDEX_PAGE_2_PAGINATED,
  INDEX_CURSOR_P2,
} from "./fixtures/pagination.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

test.describe("Timeline pagination", () => {
  test("first request includes source, from, to, limit and sort=desc", async ({ page }) => {
    const errors = collectPageErrors(page);
    const { requests } = await setupTimelineMocks(page);

    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Find the first events request
    const eventsReq = requests.find(r => r.includes("/api/timeline/events"));
    expect(eventsReq).toBeTruthy();

    const url = new URL("http://localhost" + eventsReq);
    expect(url.searchParams.get("source")).toBe("index");
    expect(url.searchParams.get("sort")).toBe("desc");
    // from and to are ISO date strings
    expect(url.searchParams.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(url.searchParams.get("to")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // limit is a positive integer
    expect(Number(url.searchParams.get("limit"))).toBeGreaterThan(0);
    // cursor not sent on first load
    expect(url.searchParams.has("cursor")).toBe(false);

    expect(errors).toHaveLength(0);
  });

  test("hasMore=true: load-more button visible and enabled", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page, { indexResponse: INDEX_PAGE_1_PAGINATED });

    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    await expect(page.locator("#timelineLoadMore")).toBeVisible();
    await expect(page.locator("#timelineLoadMore")).toBeEnabled();

    expect(errors).toHaveLength(0);
  });

  test("hasMore=false: load-more bar hidden", async ({ page }) => {
    const errors = collectPageErrors(page);
    // INDEX_PAGE_1 has hasMore=false
    await setupTimelineMocks(page, { indexResponse: INDEX_PAGE_1 });

    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    await expect(page.locator("#timelineLoadMoreBar")).toBeHidden();

    expect(errors).toHaveLength(0);
  });

  test("load-more click sends cursor param to server", async ({ page }) => {
    const errors = collectPageErrors(page);
    const { requests } = await setupTimelineMocks(page, {
      indexResponse: INDEX_PAGE_1_PAGINATED,
      indexPage2: INDEX_PAGE_2_PAGINATED,
    });

    await openTimeline(page);
    await expect(page.locator("#timelineLoadMore")).toBeVisible();

    await page.locator("#timelineLoadMore").click();

    // Wait for page 2 items to appear
    await expect(page.locator(".tlListItem")).toHaveCount(
      INDEX_PAGE_1_PAGINATED.events.length + INDEX_PAGE_2_PAGINATED.events.length,
      { timeout: 5_000 }
    );

    // The page-2 request must include the cursor from page-1 response
    const p2Req = requests.find(r => r.includes("cursor="));
    expect(p2Req).toBeTruthy();
    const url = new URL("http://localhost" + p2Req);
    expect(url.searchParams.get("cursor")).toBe(INDEX_CURSOR_P2);

    expect(errors).toHaveLength(0);
  });

  test("page-2 events appended (not replaced), no duplicates", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page, {
      indexResponse: INDEX_PAGE_1_PAGINATED,
      indexPage2: INDEX_PAGE_2_PAGINATED,
    });

    await openTimeline(page);
    const p1Count = INDEX_PAGE_1_PAGINATED.events.length;
    await expect(page.locator(".tlListItem")).toHaveCount(p1Count);

    await page.locator("#timelineLoadMore").click();

    const totalExpected = p1Count + INDEX_PAGE_2_PAGINATED.events.length;
    await expect(page.locator(".tlListItem")).toHaveCount(totalExpected, { timeout: 5_000 });

    // No duplicates: each data-event-id appears exactly once
    const ids = await page.locator(".tlListItem").evaluateAll(
      els => els.map(el => el.dataset.eventId)
    );
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);

    expect(errors).toHaveLength(0);
  });

  test("after page-2 with hasMore=false, load-more bar hidden", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page, {
      indexResponse: INDEX_PAGE_1_PAGINATED,
      indexPage2: INDEX_PAGE_2_PAGINATED,
    });

    await openTimeline(page);
    await page.locator("#timelineLoadMore").click();

    await expect(page.locator(".tlListItem")).toHaveCount(
      INDEX_PAGE_1_PAGINATED.events.length + INDEX_PAGE_2_PAGINATED.events.length,
      { timeout: 5_000 }
    );
    await expect(page.locator("#timelineLoadMoreBar")).toBeHidden();

    expect(errors).toHaveLength(0);
  });
});
