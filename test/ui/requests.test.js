/**
 * Timeline request lifecycle tests.
 * Covers: source switching, stale-response protection, cancel, timeout, retry,
 * partial link/suggestion failures.
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";
import { INDEX_PAGE_1, INDEX_EVENTS } from "./fixtures/index-events.js";
import { ALERTS_PAGE_1, ALERTS_EVENTS } from "./fixtures/alerts-events.js";
import { LINKS_EMPTY, SUGGESTIONS_EMPTY } from "./fixtures/links.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

const srcIndex  = () => page => page.locator(".tlSrcBtn[data-src='index']");
const srcAlerts = () => page => page.locator(".tlSrcBtn[data-src='alerts']");

test.describe("Timeline requests", () => {
  test("source switch: all → alerts → all shows correct events each time", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    // Initial: index events visible, "הכל" button pressed
    await expect(page.locator(".tlListItem").first()).toBeVisible();
    await expect(page.locator(".tlSrcBtn[data-src='index']")).toHaveAttribute("aria-pressed", "true");

    // Switch to alerts
    await page.locator(".tlSrcBtn[data-src='alerts']").click();
    await expect(page.locator(".tlListItem").filter({ hasText: ALERTS_EVENTS[0].content.slice(0, 15) })).toBeVisible();
    await expect(page.locator(".tlSrcBtn[data-src='alerts']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".tlSrcBtn[data-src='index']")).toHaveAttribute("aria-pressed", "false");

    // Switch back to index
    await page.locator(".tlSrcBtn[data-src='index']").click();
    await expect(page.locator(".tlListItem").filter({ hasText: INDEX_EVENTS[0].content.slice(0, 15) })).toBeVisible();
    await expect(page.locator(".tlSrcBtn[data-src='index']")).toHaveAttribute("aria-pressed", "true");

    expect(errors).toHaveLength(0);
  });

  test("stale response: rapid all→alerts→all keeps final index source", async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    await page.route("**/api/timeline/links**", route => route.fulfill({ json: LINKS_EMPTY }));
    await page.route("**/api/timeline/link-suggestions**", route => route.fulfill({ json: SUGGESTIONS_EMPTY }));

    // Alerts response is slow (150 ms); index responds immediately.
    // When user switches: index → alerts (slow) → index (fast), the stale alerts
    // response must not overwrite the final index state.
    await page.route("**/api/timeline/events**", async (route) => {
      const source = new URL(route.request().url()).searchParams.get("source") || "index";
      if (source === "alerts") await new Promise(r => setTimeout(r, 150));
      await route.fulfill({ json: source === "alerts" ? ALERTS_PAGE_1 : INDEX_PAGE_1 });
    });

    await openTimeline(page);
    await expect(page.locator(".tlListItem").first()).toBeVisible();

    // Rapidly: click alerts then immediately click index
    await page.locator(".tlSrcBtn[data-src='alerts']").click();
    await page.locator(".tlSrcBtn[data-src='index']").click();

    // Final state must be index (last request wins)
    await expect(page.locator(".tlListItem").filter({ hasText: INDEX_EVENTS[0].content.slice(0, 15) })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(".tlSrcBtn[data-src='index']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".tlSrcBtn[data-src='alerts']")).toHaveAttribute("aria-pressed", "false");

    expect(errors).toHaveLength(0);
  });

  test("cancel: button appears during load, click cancels and shows cancellation message", async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    await page.route("**/api/timeline/links**", route => route.fulfill({ json: LINKS_EMPTY }));
    await page.route("**/api/timeline/link-suggestions**", route => route.fulfill({ json: SUGGESTIONS_EMPTY }));
    // Events hang forever — ensures cancel button stays visible long enough
    await page.route("**/api/timeline/events**", () => new Promise(() => {}));

    await openTimeline(page);

    // Cancel button appears and container is busy
    await expect(page.locator("#timelineCancel")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#timelineContainer")).toHaveAttribute("aria-busy", "true");

    await page.locator("#timelineCancel").click();

    // Cancellation message and aria-busy cleared
    await expect(page.getByText("הטעינה בוטלה.")).toBeVisible();
    await expect(page.locator("#timelineContainer")).toHaveAttribute("aria-busy", "false");

    // Cancel button is gone; refresh button visible and enabled
    await expect(page.locator("#timelineCancel")).toHaveCount(0);
    await expect(page.locator("#refreshTimeline")).toBeEnabled();

    expect(errors).toHaveLength(0);
  });

  test("timeout: 20-second timeout shows distinct message and retry button", async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    await page.route("**/api/timeline/links**", route => route.fulfill({ json: LINKS_EMPTY }));
    await page.route("**/api/timeline/link-suggestions**", route => route.fulfill({ json: SUGGESTIONS_EMPTY }));
    // Events hang; app's 20-second setTimeout drives the timeout
    await page.route("**/api/timeline/events**", () => new Promise(() => {}));

    // Install fake clock before navigation so app timers use it
    await page.clock.install();
    await openTimeline(page);

    // Wait for aria-busy to confirm load started
    await expect(page.locator("#timelineContainer")).toHaveAttribute("aria-busy", "true", { timeout: 5_000 });

    // Advance clock past the 20-second timeout
    await page.clock.runFor(21_000);

    // Timeout message — distinguishable from HTTP error message
    await expect(page.getByText("הטעינה נמשכה יותר מ־20 שניות.")).toBeVisible();

    // Retry button present and aria-busy cleared
    await expect(page.locator("#timelineRetry")).toBeVisible();
    await expect(page.locator("#timelineContainer")).toHaveAttribute("aria-busy", "false");

    expect(errors).toHaveLength(0);
  });

  test("retry: after HTTP error, retry with fixed mock loads events", async ({ page }) => {
    const errors = collectPageErrors(page);

    let shouldFail = true;

    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    await page.route("**/api/timeline/links**", route => route.fulfill({ json: LINKS_EMPTY }));
    await page.route("**/api/timeline/link-suggestions**", route => route.fulfill({ json: SUGGESTIONS_EMPTY }));
    await page.route("**/api/timeline/events**", (route) => {
      if (shouldFail) return route.fulfill({ status: 500, contentType: "text/plain", body: "Error" });
      return route.fulfill({ json: INDEX_PAGE_1 });
    });

    await openTimeline(page);

    // HTTP error message and retry button appear
    await expect(page.getByText("השרת החזיר שגיאה")).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#timelineRetry")).toBeVisible();

    // Fix the mock, then click retry
    shouldFail = false;
    await page.locator("#timelineRetry").click();

    // Events now load
    await expect(page.locator(".tlListItem").first()).toBeVisible({ timeout: 5_000 });
    // Error message gone
    await expect(page.getByText("השרת החזיר שגיאה")).toHaveCount(0);

    // Note: the initial HTTP 500 generates console.error entries — that is the
    // expected failure we're testing. Only unexpected page crashes are a problem.
  });

  test("partial failure — links 503: events visible, page stays functional", async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    // Events and suggestions succeed; links fail with 503
    await page.route("**/api/timeline/events**", route => route.fulfill({ json: INDEX_PAGE_1 }));
    await page.route("**/api/timeline/links**", route =>
      route.fulfill({ status: 503, contentType: "text/plain", body: "Service Unavailable" })
    );
    await page.route("**/api/timeline/link-suggestions**", route => route.fulfill({ json: SUGGESTIONS_EMPTY }));

    await openTimeline(page);

    // Events load despite links failure
    await expect(page.locator(".tlListItem").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#timelineCount")).toBeVisible();
    // No unhandled error covering the timeline
    await expect(page.getByText("אירעה תקלה")).toHaveCount(0);
    // Note: browser logs 503 as console.error — that is the expected links failure.
  });

  test("partial failure — suggestions 503: events visible, page stays functional", async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    await page.route("**/api/timeline/events**", route => route.fulfill({ json: INDEX_PAGE_1 }));
    await page.route("**/api/timeline/links**", route => route.fulfill({ json: LINKS_EMPTY }));
    // Suggestions fail
    await page.route("**/api/timeline/link-suggestions**", route =>
      route.fulfill({ status: 503, contentType: "text/plain", body: "Service Unavailable" })
    );

    await openTimeline(page);

    await expect(page.locator(".tlListItem").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("#timelineCount")).toBeVisible();
    await expect(page.getByText("אירעה תקלה")).toHaveCount(0);
    // Note: browser logs 503 as console.error — that is the expected suggestions failure.
  });
});
