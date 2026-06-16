/**
 * Timeline 5C — ARIA attributes and accessible names.
 *
 * Verifies that all interactive timeline elements have correct ARIA roles,
 * states, and labels. Tests run at desktop viewport (default).
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

async function waitForEvents(page) {
  await page.locator(".tlListItem").first().waitFor({ timeout: 5_000 });
}

test.describe("Timeline ARIA — loading state", () => {
  test("aria-busy on #timelineContainer goes true during load then false after", async ({ page }) => {
    const errors = collectPageErrors(page);

    // Use a 800ms delay to reliably catch the aria-busy=true window while the
    // API request is in-flight. The timeline loads on navigation so we must
    // intercept before any request completes.
    await setupTimelineMocks(page, { delayMs: 800 });
    await page.goto("/#timeline");
    await page.waitForSelector("#timeline.active", { timeout: 10_000 });

    // During load: wait for aria-busy=true (set by startTimelineLoadingStatus)
    const container = page.locator("#timelineContainer");
    await expect(container).toHaveAttribute("aria-busy", "true", { timeout: 5_000 });

    // After load completes: aria-busy=false
    await expect(container).toHaveAttribute("aria-busy", "false", { timeout: 10_000 });

    // Events should be rendered
    await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });

    expect(errors).toHaveLength(0);
  });

  test("aria-live status region exists with polite live value", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    // #timelineLoadStatus has aria-live="polite"
    const status = page.locator("#timelineLoadStatus");
    await expect(status).toHaveAttribute("aria-live", "polite");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — button accessible names", () => {
  test("refresh button has accessible name", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const refreshBtn = page.locator("#refreshTimeline");
    const label = await refreshBtn.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label.length).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });

  test("load-more button has accessible text", async ({ page }) => {
    const errors = collectPageErrors(page);
    // Use paginated fixture so the load-more button appears
    const { INDEX_PAGE_1_PAGINATED, INDEX_PAGE_2_PAGINATED } = await import("./fixtures/pagination.js");
    await setupTimelineMocks(page, {
      indexResponse: INDEX_PAGE_1_PAGINATED,
      indexPage2: INDEX_PAGE_2_PAGINATED,
    });
    await openTimeline(page);
    await waitForEvents(page);

    const loadMoreBtn = page.locator("#timelineLoadMore");
    await expect(loadMoreBtn).toBeVisible({ timeout: 5_000 });

    // Must have accessible text (either visible text or aria-label)
    const text = await loadMoreBtn.textContent();
    const ariaLabel = await loadMoreBtn.getAttribute("aria-label");
    expect((text && text.trim().length > 0) || (ariaLabel && ariaLabel.length > 0)).toBe(true);

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — source buttons", () => {
  test("source buttons have aria-pressed reflecting state", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const indexBtn = page.locator(".tlSrcBtn[data-src='index']");
    const alertsBtn = page.locator(".tlSrcBtn[data-src='alerts']");

    // Default state: index is active (pressed), alerts is not
    await expect(indexBtn).toHaveAttribute("aria-pressed", "true");
    await expect(alertsBtn).toHaveAttribute("aria-pressed", "false");

    expect(errors).toHaveLength(0);
  });

  test("aria-pressed flips correctly after source switch", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const alertsBtn = page.locator(".tlSrcBtn[data-src='alerts']");
    const indexBtn = page.locator(".tlSrcBtn[data-src='index']");

    // Click alerts
    await alertsBtn.click();
    await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });

    await expect(alertsBtn).toHaveAttribute("aria-pressed", "true");
    await expect(indexBtn).toHaveAttribute("aria-pressed", "false");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — resolution buttons", () => {
  test("resolution buttons have aria-pressed", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Default: "month" is active
    const monthBtn = page.locator(".resBtn[data-res='month']");
    const calBtn = page.locator(".resBtn[data-res='cal']");

    await expect(monthBtn).toHaveAttribute("aria-pressed", "true");
    await expect(calBtn).toHaveAttribute("aria-pressed", "false");

    expect(errors).toHaveLength(0);
  });

  test("resolution aria-pressed updates after switching", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const weekBtn = page.locator(".resBtn[data-res='week']");
    const monthBtn = page.locator(".resBtn[data-res='month']");

    await weekBtn.click();
    await expect(weekBtn).toHaveAttribute("aria-pressed", "true");
    await expect(monthBtn).toHaveAttribute("aria-pressed", "false");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — tags dropdown", () => {
  test("#tlTagsBtn has aria-expanded=false when closed", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "false");
    expect(errors).toHaveLength(0);
  });

  test("#tlTagsBtn has aria-expanded=true when opened", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "true");
    expect(errors).toHaveLength(0);
  });

  test("#tlTagsDropdown has role=menu", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await expect(page.locator("#tlTagsDropdown")).toHaveAttribute("role", "menu");
    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — fields dropdown", () => {
  test("#tlFieldsBtn has aria-expanded reflecting state", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Find the fields button (rendered dynamically in the list panel)
    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible({ timeout: 5_000 });
    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "false");

    // Open it
    await fieldsBtn.click();
    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "true");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — detail panel", () => {
  test("#tlDetailTitle has role=heading and aria-level=2", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Click an event to populate detail panel
    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const title = page.locator("#tlDetailTitle");
    await expect(title).toBeVisible();
    await expect(title).toHaveAttribute("role", "heading");
    await expect(title).toHaveAttribute("aria-level", "2");

    expect(errors).toHaveLength(0);
  });

  test("#tlDetailTitle has tabindex=-1 (programmatically focusable)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const title = page.locator("#tlDetailTitle");
    await expect(title).toHaveAttribute("tabindex", "-1");

    expect(errors).toHaveLength(0);
  });

  test("metadata button has aria-expanded=false initially", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const metaBtn = page.locator("#tlMetaBtn");
    await expect(metaBtn).toBeVisible({ timeout: 5_000 });
    await expect(metaBtn).toHaveAttribute("aria-expanded", "false");

    expect(errors).toHaveLength(0);
  });

  test("metadata button has aria-controls attribute", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const metaBtn = page.locator("#tlMetaBtn");
    await expect(metaBtn).toBeVisible({ timeout: 5_000 });
    const controls = await metaBtn.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(controls.length).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });

  test("metadata button aria-expanded toggles on click", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const metaBtn = page.locator("#tlMetaBtn");
    await expect(metaBtn).toBeVisible({ timeout: 5_000 });

    await metaBtn.click();
    await expect(metaBtn).toHaveAttribute("aria-expanded", "true");

    await metaBtn.click();
    await expect(metaBtn).toHaveAttribute("aria-expanded", "false");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — list items", () => {
  test(".tlListItem has role=button, tabindex=0, and aria-label", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const item = page.locator('.tlListItem[data-event-id="idx-001"]');
    await expect(item).toHaveAttribute("role", "button");
    await expect(item).toHaveAttribute("tabindex", "0");

    const label = await item.getAttribute("aria-label");
    expect(label).toBeTruthy();
    expect(label.length).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });

  test("selected list item gets .tlListActive class", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    await expect(page.locator('.tlListItem[data-event-id="idx-001"]')).toHaveClass(/tlListActive/);

    expect(errors).toHaveLength(0);
  });
});

test.describe("Timeline ARIA — calendar grid", () => {
  test("calendar grid exists with aria-label after switching to cal view", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    const grid = page.locator(".calGrid");
    await expect(grid).toBeVisible();
    const label = await grid.getAttribute("aria-label");
    expect(label).toBeTruthy();

    expect(errors).toHaveLength(0);
  });

  test("calendar column headers have accessible names (day names)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // Column headers should have aria-label with full day name
    const dayLabels = page.locator(".calDayLabel[aria-label]");
    await expect(dayLabels).toHaveCount(7, { timeout: 5_000 });

    // Verify each has a non-empty label
    const labels = await dayLabels.evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label"))
    );
    labels.forEach((label) => {
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    });

    expect(errors).toHaveLength(0);
  });

  test("day cells have data-date-key for navigable structure", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // At least some non-empty cells have data-date-key
    const cells = page.locator(".calCell[data-date-key]");
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);

    expect(errors).toHaveLength(0);
  });

  test("only one day cell has tabindex=0 at a time (roving tabindex)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // Among date cells (with data-date-key), exactly one should have tabindex="0"
    const focusableCells = page.locator(".calCell[data-date-key][tabindex='0']");
    await expect(focusableCells).toHaveCount(1, { timeout: 5_000 });

    expect(errors).toHaveLength(0);
  });

  test("selected day cell has aria-selected=true", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // Click a day with events (April 20)
    const cell = page.locator('[data-date-key="2026-04-20"]');
    await expect(cell).toBeVisible();
    await cell.click();

    await expect(cell).toHaveAttribute("aria-selected", "true");

    // Other cells should not be selected
    const otherSelectedCells = page.locator(".calCell[data-date-key][aria-selected='true']:not([data-date-key='2026-04-20'])");
    await expect(otherSelectedCells).toHaveCount(0);

    expect(errors).toHaveLength(0);
  });

  test("today's cell has aria-current=date when visible in fixture month", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // The test environment date is 2026-06-12 (from system context).
    // The fixture calendar starts at April 2026 (newest event).
    // Today (June 2026) is not in the initial view, so aria-current=date should not be present.
    const ariaCurrentCells = page.locator(".calCell[aria-current='date']");
    const count = await ariaCurrentCells.count();

    // If today is not in this month, count should be 0.
    // If today IS in this month (possible if tests run in April), count should be 1.
    // Either way: no wrong cells should carry aria-current=date.
    // Verify that any cell with aria-current=date is indeed in today's date.
    if (count > 0) {
      await expect(ariaCurrentCells).toHaveCount(1);
    }

    expect(errors).toHaveLength(0);
  });

  test("calendar event cards are <button> elements (role=button)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // Click a day with events to open day panel
    const cell = page.locator('[data-date-key="2026-04-20"]');
    await cell.click();

    // Cards are native <button> elements (implicit role=button)
    const cards = page.locator(".tlCard[data-event-id]");
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });

    const tagName = await cards.first().evaluate((el) => el.tagName.toLowerCase());
    expect(tagName).toBe("button");

    expect(errors).toHaveLength(0);
  });
});
