/**
 * Timeline 5C — Detail panel focus management.
 *
 * Key behavior from selectTlEvent():
 *   - fromKeyboard=true → requestAnimationFrame(() => $("tlDetailTitle")?.focus())
 *   - List items call selectTlEvent(ev) WITHOUT fromKeyboard, so list keyboard
 *     activation does NOT focus the detail title.
 *   - Calendar cards use e.detail===0 to detect keyboard activation and pass
 *     { fromKeyboard: true }, so calendar card keyboard activation DOES focus detail.
 *   - Mouse click on list item: no focus move.
 *
 * Metadata button (#tlMetaBtn): aria-expanded + aria-controls verified.
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

async function waitForEvents(page) {
  await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });
}

test.describe("Detail panel focus management", () => {
  test("mouse click on list item: #tlDetailTitle is visible but NOT focused", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Click with mouse (not keyboard)
    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const titleEl = page.locator("#tlDetailTitle");
    await expect(titleEl).toBeVisible({ timeout: 5_000 });

    // After mouse click, focus should NOT have moved to the title
    // (selectTlEvent called without fromKeyboard, so no focus move)
    const isFocused = await page.evaluate(() =>
      document.activeElement?.id === "tlDetailTitle"
    );
    expect(isFocused).toBe(false);

    expect(errors).toHaveLength(0);
  });

  test("#tlDetailTitle has tabindex=-1 (programmatically focusable)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    await expect(page.locator("#tlDetailTitle")).toHaveAttribute("tabindex", "-1");

    expect(errors).toHaveLength(0);
  });

  test("calendar card keyboard activation focuses #tlDetailTitle", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Switch to calendar view
    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // Open the day panel by focusing and pressing Enter on a day cell
    const cell = page.locator('[data-date-key="2026-04-20"]');
    await cell.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".calDayPanel")).toBeVisible({ timeout: 5_000 });

    // Focus the first card and press Enter (keyboard activation, e.detail===0)
    const firstCard = page.locator(".calDayPanel .tlCard").first();
    await expect(firstCard).toBeVisible({ timeout: 5_000 });
    await firstCard.focus();
    await page.keyboard.press("Enter");

    // After keyboard activation, focus should move to #tlDetailTitle.
    // The card's listener calls requestAnimationFrame(() => $("tlDetailTitle")?.focus())
    // via selectTlEvent({ fromKeyboard: true }). Wait for RAF to complete.
    await page.waitForFunction(() => document.activeElement?.id === "tlDetailTitle", {
      timeout: 3_000,
    });

    expect(errors).toHaveLength(0);
  });

  test("calendar card mouse click does NOT focus #tlDetailTitle", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.resBtn[data-res="cal"]').click();
    await page.locator(".calGrid").waitFor({ timeout: 5_000 });

    // Click the day cell to open day panel (mouse click)
    await page.locator('[data-date-key="2026-04-20"]').click();
    await expect(page.locator(".calDayPanel")).toBeVisible({ timeout: 5_000 });

    // Click a card with the mouse
    const firstCard = page.locator(".calDayPanel .tlCard").first();
    await expect(firstCard).toBeVisible({ timeout: 5_000 });
    await firstCard.click(); // mouse click: e.detail >= 1

    await page.waitForTimeout(100);
    const isFocused = await page.evaluate(() =>
      document.activeElement?.id === "tlDetailTitle"
    );
    // Mouse click should NOT move focus to the detail title
    expect(isFocused).toBe(false);

    expect(errors).toHaveLength(0);
  });
});

test.describe("Metadata button", () => {
  test("#tlMetaBtn has aria-expanded=false initially", async ({ page }) => {
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

  test("clicking #tlMetaBtn sets aria-expanded=true and shows metadata", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const metaBtn = page.locator("#tlMetaBtn");
    await expect(metaBtn).toBeVisible({ timeout: 5_000 });
    await metaBtn.click();

    await expect(metaBtn).toHaveAttribute("aria-expanded", "true");
    // Metadata box should be visible
    await expect(page.locator("#tlMetaBox")).toBeVisible({ timeout: 3_000 });

    expect(errors).toHaveLength(0);
  });

  test("clicking #tlMetaBtn again sets aria-expanded=false and hides metadata", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const metaBtn = page.locator("#tlMetaBtn");
    await expect(metaBtn).toBeVisible({ timeout: 5_000 });

    // Open
    await metaBtn.click();
    await expect(metaBtn).toHaveAttribute("aria-expanded", "true");

    // Close
    await metaBtn.click();
    await expect(metaBtn).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlMetaBox")).toHaveCount(0);

    expect(errors).toHaveLength(0);
  });

  test("#tlMetaBtn has aria-controls attribute", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator('.tlListItem[data-event-id="idx-001"]').click();

    const metaBtn = page.locator("#tlMetaBtn");
    await expect(metaBtn).toBeVisible({ timeout: 5_000 });

    const controls = await metaBtn.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(controls).toBe("tlMetaBox");

    expect(errors).toHaveLength(0);
  });
});
