/**
 * Timeline calendar view tests.
 * Covers: switching to calendar, month navigation, day-cell click/keyboard,
 * event-card selection and detail panel.
 *
 * The fixture's newest event is 2026-04-20, so initializeTimelineCalendar() sets
 * the initial calendar month to April 2026 ("אפריל 2026").
 */
import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";
import { INDEX_EVENTS } from "./fixtures/index-events.js";

// Both idx-001 and idx-002 fall on 2026-04-20 → 2 events on that day.
const APRIL_20_KEY = "2026-04-20";

async function openTimelineCalendar(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
  // Wait for events to load so the calendar knows the initial month
  await page.locator(".tlListItem").first().waitFor({ timeout: 5_000 });
  // Switch to calendar view
  // Scope to .resBtn to avoid matching .tlNode or .tlListItem which also have role=button
  await page.locator('.resBtn[data-res="cal"]').click();
  // Wait for the grid
  await page.locator(".calGrid").waitFor({ timeout: 5_000 });
}

test.describe("Timeline calendar", () => {
  test("switching to calendar view renders calGrid for the newest-event month", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    // Calendar should be showing April 2026 (month of newest fixture event)
    await expect(page.locator(".calNavTitle")).toContainText("אפריל");
    // Grid is rendered
    await expect(page.locator(".calGrid")).toBeVisible();
    // Day with events has the has-events class
    await expect(page.locator(`[data-date-key="${APRIL_20_KEY}"].has-events`)).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("next-month button advances the displayed month", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    // Start in April 2026
    await expect(page.locator(".calNavTitle")).toContainText("אפריל");

    // Navigate to May
    await page.locator("#calNext").click();
    await expect(page.locator(".calNavTitle")).toContainText("מאי");

    expect(errors).toHaveLength(0);
  });

  test("prev-month button returns to previous month", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    // Go to May, then back to April
    await page.locator("#calNext").click();
    await expect(page.locator(".calNavTitle")).toContainText("מאי");

    await page.locator("#calPrev").click();
    await expect(page.locator(".calNavTitle")).toContainText("אפריל");

    expect(errors).toHaveLength(0);
  });

  test("clicking a day cell with events shows the day panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    // Click April 20 — has 2 events (idx-001, idx-002)
    await page.locator(`[data-date-key="${APRIL_20_KEY}"]`).click();

    // Day panel appears with at least one tlCard
    await expect(page.locator(".calDayPanel, .calEventList, .tlCard").first()).toBeVisible({ timeout: 3_000 });

    // Two event cards for that day
    await expect(page.locator(".tlCard")).toHaveCount(2);

    expect(errors).toHaveLength(0);
  });

  test("Enter on day cell opens the day panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    const dayCell = page.locator(`[data-date-key="${APRIL_20_KEY}"]`);
    await dayCell.focus();
    await dayCell.press("Enter");

    await expect(page.locator(".tlCard").first()).toBeVisible({ timeout: 3_000 });

    expect(errors).toHaveLength(0);
  });

  test("Space on day cell opens the day panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    const dayCell = page.locator(`[data-date-key="${APRIL_20_KEY}"]`);
    await dayCell.focus();
    await dayCell.press("Space");

    await expect(page.locator(".tlCard").first()).toBeVisible({ timeout: 3_000 });

    expect(errors).toHaveLength(0);
  });

  test("clicking event card in day panel opens detail panel with event content", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    // Open the day panel
    await page.locator(`[data-date-key="${APRIL_20_KEY}"]`).click();
    await expect(page.locator(".tlCard").first()).toBeVisible({ timeout: 3_000 });

    // Click the event card for idx-001 specifically
    await page.locator(`.tlCard[data-event-id="idx-001"]`).click();

    // Detail panel shows the event's content
    await expect(page.locator("#tlDetailTitle")).toBeVisible();
    const expectedSnippet = INDEX_EVENTS[0].content.slice(0, 20);
    await expect(page.locator("#tlDetailTitle")).toContainText(expectedSnippet);
    await expect(page.locator(".tlDetailBody")).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("Enter on event card in day panel opens detail panel", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    await page.locator(`[data-date-key="${APRIL_20_KEY}"]`).click();
    await expect(page.locator(".tlCard").first()).toBeVisible({ timeout: 3_000 });

    const card = page.locator(`.tlCard[data-event-id="idx-001"]`);
    await card.focus();
    await card.press("Enter");

    await expect(page.locator("#tlDetailTitle")).toBeVisible();
    await expect(page.locator("#tlDetailTitle")).toContainText(INDEX_EVENTS[0].content.slice(0, 20));

    expect(errors).toHaveLength(0);
  });

  test("ArrowDown/ArrowUp navigation in day panel cycles through event cards", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    await page.locator(`[data-date-key="${APRIL_20_KEY}"]`).click();
    await expect(page.locator(".tlCard")).toHaveCount(2, { timeout: 3_000 });

    // Focus first card
    const firstCard = page.locator(".tlCard").first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();

    // ArrowDown moves to second card
    await firstCard.press("ArrowDown");
    await expect(page.locator(".tlCard").last()).toBeFocused();

    // ArrowUp cycles back to first card
    await page.locator(".tlCard").last().press("ArrowUp");
    await expect(firstCard).toBeFocused();

    expect(errors).toHaveLength(0);
  });

  test("Escape in day panel returns focus to the day cell", async ({ page }) => {
    const errors = collectPageErrors(page);
    await setupTimelineMocks(page);
    await openTimelineCalendar(page);

    await page.locator(`[data-date-key="${APRIL_20_KEY}"]`).click();
    await expect(page.locator(".tlCard").first()).toBeVisible({ timeout: 3_000 });

    const firstCard = page.locator(".tlCard").first();
    await firstCard.focus();
    await firstCard.press("Escape");

    // Focus should return to the day cell that was selected
    await expect(page.locator(`[data-date-key="${APRIL_20_KEY}"]`)).toBeFocused();

    expect(errors).toHaveLength(0);
  });
});
