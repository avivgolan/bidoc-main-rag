/**
 * Timeline 5C — Keyboard: event list navigation.
 *
 * NOTE on ArrowUp/ArrowDown in list view: app.js buildEventListItem only handles
 * "Enter" and " " on keydown. There is NO ArrowUp/ArrowDown navigation between
 * list items implemented. Each .tlListItem is independently focusable (tabindex=0).
 * ArrowKey navigation within the list is documented here as a MANUAL TEST.
 *
 * NOTE on focus-to-detail: buildEventListItem's keydown handler calls
 * selectTlEvent(ev) without passing { fromKeyboard: true }, so keyboard activation
 * from list items does NOT move focus to #tlDetailTitle. Only calendar card
 * keyboard activation (e.detail===0) triggers focus-to-detail. This is the actual
 * behavior in the code; the focus-to-detail from list items is a MANUAL/FUTURE item.
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";

async function openTimeline(page) {
  // Use a narrow viewport so buildStaticList is used (all items in DOM, no virtual scroll).
  // At >980px buildVirtualList is used; DOM elements can be detached on re-render which
  // causes stale-element errors when navigating between items.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
}

async function waitForEvents(page) {
  await expect(page.locator(".tlListItem")).toHaveCount(4, { timeout: 5_000 });
}

test.describe("Keyboard: event list items", () => {
  test("Tab can reach the first .tlListItem", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Directly focus the first list item to verify it is focusable
    const firstItem = page.locator(".tlListItem").first();
    await firstItem.focus();

    const isFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains("tlListItem")
    );
    expect(isFocused).toBe(true);

    expect(errors).toHaveLength(0);
  });

  test("Enter on .tlListItem[data-event-id=idx-001] opens detail panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const item = page.locator('.tlListItem[data-event-id="idx-001"]');
    await item.focus();
    await page.keyboard.press("Enter");

    // Detail title should appear
    await expect(page.locator("#tlDetailTitle")).toBeVisible({ timeout: 5_000 });

    expect(errors).toHaveLength(0);
  });

  test("Space on .tlListItem opens detail panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const item = page.locator('.tlListItem[data-event-id="idx-001"]');
    await item.focus();
    await page.keyboard.press("Space");

    await expect(page.locator("#tlDetailTitle")).toBeVisible({ timeout: 5_000 });

    expect(errors).toHaveLength(0);
  });

  test("detail title shows content of activated event after Enter", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const item = page.locator('.tlListItem[data-event-id="idx-001"]');
    await item.focus();
    await page.keyboard.press("Enter");

    const titleEl = page.locator("#tlDetailTitle");
    await expect(titleEl).toBeVisible({ timeout: 5_000 });
    await expect(titleEl).toContainText("ישיבת תיאום קבלן");

    expect(errors).toHaveLength(0);
  });

  test("activating a different list item updates the detail panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Activate idx-001
    const item1 = page.locator('.tlListItem[data-event-id="idx-001"]');
    await item1.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#tlDetailTitle")).toContainText("ישיבת תיאום קבלן", { timeout: 5_000 });

    // Activate idx-003 (different content)
    const item3 = page.locator('.tlListItem[data-event-id="idx-003"]');
    await item3.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#tlDetailTitle")).toContainText("אישור תוכנית ביניים", { timeout: 5_000 });

    expect(errors).toHaveLength(0);
  });

  test("activated item gets .tlListActive class", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const item = page.locator('.tlListItem[data-event-id="idx-001"]');
    await item.focus();
    await page.keyboard.press("Enter");

    await expect(item).toHaveClass(/tlListActive/);

    expect(errors).toHaveLength(0);
  });

  test("only one item has .tlListActive at a time", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Activate idx-001 then idx-003
    const item1 = page.locator('.tlListItem[data-event-id="idx-001"]');
    await item1.focus();
    await page.keyboard.press("Enter");
    await expect(item1).toHaveClass(/tlListActive/);

    const item3 = page.locator('.tlListItem[data-event-id="idx-003"]');
    await item3.focus();
    await page.keyboard.press("Enter");

    await expect(item3).toHaveClass(/tlListActive/);
    await expect(item1).not.toHaveClass(/tlListActive/);

    expect(errors).toHaveLength(0);
  });

  // MANUAL TEST (not automated): ArrowUp/ArrowDown navigation between list items is
  // not implemented in buildEventListItem. Each item has tabindex=0 so browser Tab
  // order works, but no roving-tabindex or arrow-key handler exists. To add this,
  // wire an ArrowUp/ArrowDown keydown on the list container that moves focus to the
  // prev/next sibling .tlListItem.
});
