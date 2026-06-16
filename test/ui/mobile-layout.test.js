/**
 * Timeline 5C — Mobile layout: structure and overflow.
 *
 * Tests are run at three viewport sizes: 320, 375, 768.
 * At all widths ≤980px, buildStaticList is used (all items in DOM).
 *
 * Overflow check: scrollWidth <= clientWidth on the document element.
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";

const VIEWPORTS = [
  { label: "320px", width: 320, height: 568 },
  { label: "375px", width: 375, height: 667 },
  { label: "768px", width: 768, height: 1024 },
];

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

async function waitForEvents(page) {
  // At ≤980px buildStaticList renders all 4 events directly
  await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });
}

async function checkNoHorizontalOverflow(page, label = "") {
  const hasOverflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth;
  });
  expect(hasOverflow, `Horizontal overflow detected${label ? " (" + label + ")" : ""}`).toBe(false);
}

for (const vp of VIEWPORTS) {
  test.describe(`Mobile layout @ ${vp.label}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test(`${vp.label}: no horizontal overflow on default state`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);
      await waitForEvents(page);

      await checkNoHorizontalOverflow(page, "default state");
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: no horizontal overflow when tags dropdown is open`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);
      await waitForEvents(page);

      // Open tags dropdown
      await page.locator("#tlTagsBtn").click();
      await expect(page.locator("#tlTagsDropdown")).toBeVisible({ timeout: 3_000 });

      await checkNoHorizontalOverflow(page, "tags dropdown open");
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: no horizontal overflow after switching to alerts`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);
      await waitForEvents(page);

      await page.locator(".tlSrcBtn[data-src='alerts']").click();
      await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });

      await checkNoHorizontalOverflow(page, "alerts source");
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: no horizontal overflow after entering search text`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);
      await waitForEvents(page);

      await page.locator("#timelineSearch").fill("ישיבת");
      await page.waitForTimeout(300); // debounce

      await checkNoHorizontalOverflow(page, "search active");
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: #timelineSearch is visible`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);

      await expect(page.locator("#timelineSearch")).toBeVisible({ timeout: 5_000 });
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: #refreshTimeline is visible`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);

      await expect(page.locator("#refreshTimeline")).toBeVisible({ timeout: 5_000 });
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: source buttons are visible`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);

      await expect(page.locator(".tlSrcBtn[data-src='index']")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(".tlSrcBtn[data-src='alerts']")).toBeVisible({ timeout: 5_000 });
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: resolution buttons are visible`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);

      await expect(page.locator(".resBtn[data-res='month']")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(".resBtn[data-res='cal']")).toBeVisible({ timeout: 5_000 });
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: #timelineCount is visible`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);
      await waitForEvents(page);

      await expect(page.locator("#timelineCount")).toBeVisible({ timeout: 5_000 });
      expect(errors).toHaveLength(0);
    });

    test(`${vp.label}: event list items are visible after load`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await setupTimelineMocks(page);
      await openTimeline(page);
      await waitForEvents(page);

      // At ≤980px buildStaticList renders all items
      await expect(page.locator(".tlListItem").first()).toBeVisible({ timeout: 5_000 });
      expect(errors).toHaveLength(0);
    });
  });
}

// 320px and 375px specific checks
for (const vpWidth of [320, 375]) {
  const vp = VIEWPORTS.find((v) => v.width === vpWidth);

  test(`${vp.label}: graphical timeline (.tlWave/.tlStrip) is hidden at ≤375px`, async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await setupTimelineMocks(page);
    await openTimeline(page);
    await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });

    // At ≤375px: CSS hides .tlWave and .tlStrip
    // Check visibility via computed style (display:none)
    const waveHidden = await page.evaluate(() => {
      const el = document.querySelector("#timeline.active .tlWave");
      if (!el) return true; // not rendered = effectively hidden
      const style = window.getComputedStyle(el);
      return style.display === "none" || style.visibility === "hidden";
    });
    expect(waveHidden).toBe(true);

    expect(errors).toHaveLength(0);
  });
}

test(`768px: list panel appears without excessive overflow`, async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await setupTimelineMocks(page);
  await openTimeline(page);
  await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });

  // Verify no overflow
  await checkNoHorizontalOverflow(page);
  // List panel should be present
  await expect(page.locator(".tlListItem").first()).toBeVisible();

  expect(errors).toHaveLength(0);
});
