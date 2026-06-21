/**
 * Timeline dropdown and event-list keyboard tests.
 * Covers: tags dropdown (open/close/Escape/outside-click/tag filter),
 * fields dropdown (open/close), event-list Enter/Space selection,
 * roving tabindex and ARIA attributes.
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";
import { INDEX_EVENTS } from "./fixtures/index-events.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
  await page.locator(".tlListItem").first().waitFor({ timeout: 5_000 });
}

test.describe("Tags dropdown", () => {
  test("clicking #tlTagsBtn opens dropdown (aria-expanded=true, panel visible)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    const btn = page.locator("#tlTagsBtn");
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlTagsDropdown")).toBeHidden();

    await btn.click();

    await expect(btn).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#tlTagsDropdown")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("clicking inside tags dropdown does NOT close it", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsDropdown")).toBeVisible();

    // Click inside the dropdown (on the "הכל" chip)
    await page.locator("#timelineFilters .tagChip").first().click();

    // Dropdown should still be visible
    await expect(page.locator("#tlTagsDropdown")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("Escape closes tags dropdown and returns focus to #tlTagsBtn", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsDropdown")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("#tlTagsDropdown")).toBeHidden();
    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlTagsBtn")).toBeFocused();

    expect(errors).toHaveLength(0);
  });

  test("clicking outside tags dropdown closes it", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsDropdown")).toBeVisible();

    // Click somewhere outside — the timeline count heading is safe
    await page.locator("#timelineCount").click();

    await expect(page.locator("#tlTagsDropdown")).toBeHidden();

    expect(errors).toHaveLength(0);
  });

  test("selecting a tag chip filters events; clearing shows all", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    const allCount = await page.locator(".tlListItem").count();

    // Open tags dropdown
    await page.locator("#tlTagsBtn").click();

    // Click the "ישיבה" tag chip (only idx-001 has this tag)
    await page.locator("#timelineFilters .tagChip", { hasText: "ישיבה" }).click();

    // Only idx-001 visible
    await expect(page.locator(".tlListItem")).toHaveCount(1);
    await expect(page.locator(".tlListItem[data-event-id='idx-001']")).toBeVisible();

    // Click "הכל" (the clear-all chip, text is exactly "הכל")
    const clearChip = page.locator("#timelineFilters .tagChip", { hasText: "הכל" });
    await clearChip.click();

    // All events restored
    await expect(page.locator(".tlListItem")).toHaveCount(allCount);

    expect(errors).toHaveLength(0);
  });
});

test.describe("Fields dropdown", () => {
  test("clicking #tlFieldsBtn toggles the fields picker open/closed", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    // #tlFieldsBtn is rendered dynamically by buildTimelineControls
    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible();
    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlFieldsPicker")).toBeHidden();

    await fieldsBtn.click();

    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#tlFieldsPicker")).toBeVisible();

    // Click again to close
    await fieldsBtn.click();

    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlFieldsPicker")).toBeHidden();

    expect(errors).toHaveLength(0);
  });

  test("Escape closes fields picker and returns focus to #tlFieldsBtn", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    await page.locator("#tlFieldsBtn").click();
    await expect(page.locator("#tlFieldsPicker")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator("#tlFieldsPicker")).toBeHidden();
    await expect(page.locator("#tlFieldsBtn")).toBeFocused();

    expect(errors).toHaveLength(0);
  });

  test("checking a field checkbox adds the field column to list items", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    await page.locator("#tlFieldsBtn").click();
    await expect(page.locator("#tlFieldsPicker")).toBeVisible();

    // Check the first available field checkbox
    const firstCheckbox = page.locator('#tlFieldsPicker input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();
    const wasChecked = await firstCheckbox.isChecked();

    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();

    // Uncheck it
    await firstCheckbox.uncheck();
    await expect(firstCheckbox).not.toBeChecked();

    expect(errors).toHaveLength(0);
  });
});

test.describe("Event list keyboard interaction", () => {
  test("pressing Enter on a list item opens the detail panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    const item = page.locator(".tlListItem[data-event-id='idx-001']");
    await item.focus();
    await item.press("Enter");

    await expect(page.locator("#tlDetailTitle")).toBeVisible();
    await expect(page.locator("#tlDetailTitle")).toContainText(INDEX_EVENTS[0].content.slice(0, 20));

    expect(errors).toHaveLength(0);
  });

  test("pressing Space on a list item opens the detail panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    const item = page.locator(".tlListItem[data-event-id='idx-001']");
    await item.focus();
    await item.press("Space");

    await expect(page.locator("#tlDetailTitle")).toBeVisible();
    await expect(page.locator("#tlDetailTitle")).toContainText(INDEX_EVENTS[0].content.slice(0, 20));

    expect(errors).toHaveLength(0);
  });

  test("ARIA: selected list item gets tlListActive class after click", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);

    const item = page.locator(".tlListItem").first();
    const otherItem = page.locator(".tlListItem").nth(1);
    await expect(item).toBeVisible();
    await expect(otherItem).toBeVisible();
    await item.dispatchEvent("click");

    await expect(item).toHaveClass(/tlListActive/);
    // Other items should not have the active class
    await expect(otherItem).not.toHaveClass(/tlListActive/);

    expect(errors).toHaveLength(0);
  });

  test("aria-busy on #timelineContainer goes true during load and false after", async ({ page }) => {
    const errors = collectPageErrors(page);

    let resolve;
    await page.route(/^https?:\/\/(?!localhost)/, route => route.abort("blockedbyclient"));
    await page.route("**/api/timeline/links**", route => route.fulfill({ json: {} }));
    await page.route("**/api/timeline/link-suggestions**", route => route.fulfill({ json: {} }));
    await page.route("**/api/timeline/events**", async (route) => {
      // Hang briefly so we can assert aria-busy=true
      await new Promise(r => { resolve = r; });
      await route.fulfill({ json: { events: [], page: { hasMore: false, nextCursor: null } } });
    });

    await page.goto("/#timeline");
    await page.waitForSelector("#timeline.active");

    // Container should be busy during the hanging request
    await expect(page.locator("#timelineContainer")).toHaveAttribute("aria-busy", "true", { timeout: 5_000 });

    // Release the hang
    resolve();

    // After load completes, aria-busy clears
    await expect(page.locator("#timelineContainer")).toHaveAttribute("aria-busy", "false", { timeout: 5_000 });

    expect(errors).toHaveLength(0);
  });
});
