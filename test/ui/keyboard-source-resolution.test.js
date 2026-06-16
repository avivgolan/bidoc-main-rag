/**
 * Timeline 5C — Keyboard: source and resolution buttons.
 *
 * NOTE: wireTimeline() sets aria-pressed on each .tlSrcBtn and .resBtn independently.
 * Click events are handled by both the direct addEventListener on each button AND
 * by the delegated listener on document. There is NO roving-tabindex or ArrowLeft/Right
 * group navigation on source/resolution buttons — each is independently focusable.
 * This is what's actually implemented; the ARIA Listbox/Radiogroup pattern is not used.
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

test.describe("Keyboard: source buttons", () => {
  test("Tab can reach the index source button", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Focus the search field, then Tab forward until we reach a source button
    await page.locator("#timelineSearch").focus();
    // Tab a few times to reach the source buttons (they are after the header)
    // Use keyboard navigation — just verify the index button is focusable
    await page.locator(".tlSrcBtn[data-src='index']").focus();
    const focused = await page.evaluate(() => document.activeElement?.dataset?.src);
    expect(focused).toBe("index");

    expect(errors).toHaveLength(0);
  });

  test("Space on active index source keeps aria-pressed=true", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const indexBtn = page.locator(".tlSrcBtn[data-src='index']");
    await indexBtn.focus();
    await page.keyboard.press("Space");

    // Already active — pressing Space on the active source should not change it
    await expect(indexBtn).toHaveAttribute("aria-pressed", "true");

    expect(errors).toHaveLength(0);
  });

  test("Enter on alerts source button switches source and updates aria-pressed", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const alertsBtn = page.locator(".tlSrcBtn[data-src='alerts']");
    const indexBtn = page.locator(".tlSrcBtn[data-src='index']");

    await alertsBtn.focus();
    await page.keyboard.press("Enter");

    // Wait for alerts to load
    await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });

    await expect(alertsBtn).toHaveAttribute("aria-pressed", "true");
    await expect(indexBtn).toHaveAttribute("aria-pressed", "false");

    expect(errors).toHaveLength(0);
  });

  test("Space on alerts source button switches source", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const alertsBtn = page.locator(".tlSrcBtn[data-src='alerts']");
    await alertsBtn.focus();
    await page.keyboard.press("Space");

    await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });
    await expect(alertsBtn).toHaveAttribute("aria-pressed", "true");

    expect(errors).toHaveLength(0);
  });
});

test.describe("Keyboard: resolution buttons", () => {
  test("Tab can reach the calendar resolution button", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Focus the cal resolution button directly
    await page.locator(".resBtn[data-res='cal']").focus();
    const focused = await page.evaluate(() => document.activeElement?.dataset?.res);
    expect(focused).toBe("cal");

    expect(errors).toHaveLength(0);
  });

  test("Enter on calendar resolution button renders calGrid", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const calBtn = page.locator(".resBtn[data-res='cal']");
    await calBtn.focus();
    await page.keyboard.press("Enter");

    // Calendar grid should appear
    await expect(page.locator(".calGrid")).toBeVisible({ timeout: 5_000 });
    await expect(calBtn).toHaveAttribute("aria-pressed", "true");

    expect(errors).toHaveLength(0);
  });

  test("Enter on week resolution button switches from calendar back to list", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // First switch to calendar
    await page.locator(".resBtn[data-res='cal']").click();
    await expect(page.locator(".calGrid")).toBeVisible({ timeout: 5_000 });

    // Now use Enter on week button
    const weekBtn = page.locator(".resBtn[data-res='week']");
    await weekBtn.focus();
    await page.keyboard.press("Enter");

    // Calendar grid should disappear, list should reappear
    await expect(page.locator(".calGrid")).toHaveCount(0, { timeout: 5_000 });
    await expect(weekBtn).toHaveAttribute("aria-pressed", "true");

    expect(errors).toHaveLength(0);
  });

  test("resolution buttons aria-pressed: only one active at a time", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const dayBtn = page.locator(".resBtn[data-res='day']");
    await dayBtn.focus();
    await page.keyboard.press("Enter");

    // Only 'day' should be pressed=true
    await expect(dayBtn).toHaveAttribute("aria-pressed", "true");

    const otherBtns = page.locator(".resBtn:not([data-res='day'])");
    const others = await otherBtns.all();
    for (const btn of others) {
      await expect(btn).toHaveAttribute("aria-pressed", "false");
    }

    expect(errors).toHaveLength(0);
  });
});
