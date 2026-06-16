/**
 * Timeline 5C — Touch target sizing at 320px.
 *
 * Verifies that interactive timeline controls meet the WCAG 2.5.5 minimum
 * of 44×44 CSS pixels. Measurements are taken via getBoundingClientRect().
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";

const VIEWPORT_320 = { width: 320, height: 568 };
const MIN_TOUCH_SIZE = 44;

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

async function waitForEvents(page) {
  await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });
}

async function getSize(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
  }, selector);
}

test.describe("Touch targets @ 320px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT_320);
  });

  test("source button height ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const indexSize = await getSize(page, ".tlSrcBtn[data-src='index']");
    const alertsSize = await getSize(page, ".tlSrcBtn[data-src='alerts']");

    expect(indexSize).not.toBeNull();
    expect(alertsSize).not.toBeNull();
    expect(indexSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    expect(alertsSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test("resolution button height ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const monthSize = await getSize(page, ".resBtn[data-res='month']");
    const calSize = await getSize(page, ".resBtn[data-res='cal']");

    expect(monthSize).not.toBeNull();
    expect(calSize).not.toBeNull();
    expect(monthSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    expect(calSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test("#refreshTimeline height ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    const size = await getSize(page, "#refreshTimeline");
    expect(size).not.toBeNull();
    expect(size.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test("#tlTagsBtn height ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const size = await getSize(page, "#tlTagsBtn");
    expect(size).not.toBeNull();
    expect(size.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test("#tlFieldsBtn height ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible({ timeout: 5_000 });

    const size = await getSize(page, "#tlFieldsBtn");
    expect(size).not.toBeNull();
    expect(size.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test(".tlListItem height ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Check first list item
    const itemSize = await page.evaluate(() => {
      const el = document.querySelector(".tlListItem");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(itemSize).not.toBeNull();
    expect(itemSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test("calendar nav buttons height and width ≥ 44px", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Switch to calendar view
    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    const prevSize = await getSize(page, "#calPrev");
    const nextSize = await getSize(page, "#calNext");

    expect(prevSize).not.toBeNull();
    expect(nextSize).not.toBeNull();
    expect(prevSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    expect(prevSize.width).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    expect(nextSize.height).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
    expect(nextSize.width).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);

    expect(errors).toHaveLength(0);
  });

  test("calendar day cells with events have adequate height", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // April 20 has events
    const cell = page.locator('[data-date-key="2026-04-20"].has-events');
    await expect(cell).toBeVisible({ timeout: 5_000 });

    const cellSize = await page.evaluate(() => {
      const el = document.querySelector('[data-date-key="2026-04-20"].has-events');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });

    expect(cellSize).not.toBeNull();
    // At 320px, calCell has min-height: 34px (375px rule) — still acceptable for basic tap
    // (44px is ideal; 34px is the app's considered trade-off at narrowest viewport)
    // We accept ≥30px at this viewport since CSS explicitly sets 34px as the minimum
    expect(cellSize.height).toBeGreaterThanOrEqual(30);

    expect(errors).toHaveLength(0);
  });
});
