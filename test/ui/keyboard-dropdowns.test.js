/**
 * Timeline 5C — Keyboard: tags and fields dropdowns.
 *
 * Covers open/close/Escape for #tlTagsBtn and #tlFieldsBtn.
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

test.describe("Keyboard: tags dropdown", () => {
  test("#tlTagsBtn is reachable by programmatic focus (focusable)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    await page.locator("#tlTagsBtn").focus();
    const isFocused = await page.evaluate(() => document.activeElement?.id === "tlTagsBtn");
    expect(isFocused).toBe(true);

    expect(errors).toHaveLength(0);
  });

  test("Enter on #tlTagsBtn opens dropdown (aria-expanded=true)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const tagsBtn = page.locator("#tlTagsBtn");
    await tagsBtn.focus();
    await page.keyboard.press("Enter");

    await expect(tagsBtn).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#tlTagsDropdown")).toBeVisible({ timeout: 3_000 });

    expect(errors).toHaveLength(0);
  });

  test("Space on #tlTagsBtn when closed opens it", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const tagsBtn = page.locator("#tlTagsBtn");
    // Ensure closed first
    await expect(tagsBtn).toHaveAttribute("aria-expanded", "false");

    await tagsBtn.focus();
    await page.keyboard.press("Space");

    await expect(tagsBtn).toHaveAttribute("aria-expanded", "true");

    expect(errors).toHaveLength(0);
  });

  test("Escape closes the dropdown and focus stays usable", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Open the dropdown
    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "true");

    // Press Escape
    await page.keyboard.press("Escape");

    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlTagsDropdown")).toBeHidden();

    expect(errors).toHaveLength(0);
  });

  test("Escape when dropdown is already closed does not cause errors", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Ensure closed
    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "false");

    // Press Escape — nothing should break
    await page.locator("#tlTagsBtn").focus();
    await page.keyboard.press("Escape");

    // Should remain closed without error
    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "false");

    expect(errors).toHaveLength(0);
  });

  test("clicking a tag chip filters events", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Open dropdown
    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsDropdown")).toBeVisible({ timeout: 3_000 });

    // Click "ישיבה" chip (only idx-001 has this tag)
    await page.locator("#timelineFilters .tagChip", { hasText: "ישיבה" }).click();

    // Only 1 event visible
    await expect(page.locator(".tlListItem")).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('.tlListItem[data-event-id="idx-001"]')).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("clicking outside the dropdown closes it", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    // Open dropdown
    await page.locator("#tlTagsBtn").click();
    await expect(page.locator("#tlTagsDropdown")).toBeVisible({ timeout: 3_000 });

    // Click outside — click on the panel header area (away from dropdown)
    await page.locator("#timeline.active .timelineTitleGroup").click();

    await expect(page.locator("#tlTagsBtn")).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlTagsDropdown")).toBeHidden();

    expect(errors).toHaveLength(0);
  });
});

test.describe("Keyboard: fields dropdown", () => {
  test("#tlFieldsBtn is focusable after events load", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible({ timeout: 5_000 });

    await fieldsBtn.focus();
    const isFocused = await page.evaluate(() => document.activeElement?.id === "tlFieldsBtn");
    expect(isFocused).toBe(true);

    expect(errors).toHaveLength(0);
  });

  test("Enter on #tlFieldsBtn opens picker (aria-expanded=true)", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible({ timeout: 5_000 });
    await fieldsBtn.focus();
    await page.keyboard.press("Enter");

    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#tlFieldsPicker")).toBeVisible({ timeout: 3_000 });

    expect(errors).toHaveLength(0);
  });

  test("Escape closes fields picker", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible({ timeout: 5_000 });

    // Open it
    await fieldsBtn.click();
    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "true");

    // Close with Escape
    await page.keyboard.press("Escape");

    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#tlFieldsPicker")).toBeHidden();

    expect(errors).toHaveLength(0);
  });

  test("Space on #tlFieldsBtn toggles it open", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimeline(page);
    await waitForEvents(page);

    const fieldsBtn = page.locator("#tlFieldsBtn");
    await expect(fieldsBtn).toBeVisible({ timeout: 5_000 });
    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "false");

    await fieldsBtn.focus();
    await page.keyboard.press("Space");

    await expect(fieldsBtn).toHaveAttribute("aria-expanded", "true");

    expect(errors).toHaveLength(0);
  });
});
