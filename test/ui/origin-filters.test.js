import { test, expect } from "@playwright/test";
import { collectPageErrors, setupTimelineMocks } from "./helpers/setup.js";

async function openTimeline(page) {
  await page.goto("/#timeline");
  await page.waitForSelector("#timeline.active", { timeout: 10_000 });
  await expect(page.locator(".tlListItem").first()).toBeVisible();
}

function lastEventsRequest(requests) {
  return [...requests].reverse().find((request) => request.includes("/api/timeline/events")) || "";
}

test.describe("Timeline origin filters", () => {
  test("supports multi-select, canonical request params and hides under alerts", async ({ page }) => {
    const errors = collectPageErrors(page);
    const { requests } = await setupTimelineMocks(page);
    await openTimeline(page);

    const all = page.locator('.tlOriginBtn[data-origin="all"]');
    const email = page.locator('.tlOriginBtn[data-origin="email"]');
    const whatsapp = page.locator('.tlOriginBtn[data-origin="whatsapp"]');
    await expect(all).toHaveAttribute("aria-pressed", "true");

    await email.click();
    await expect(email).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => lastEventsRequest(requests)).toContain("origins=email");

    await whatsapp.click();
    await expect(email).toHaveAttribute("aria-pressed", "true");
    await expect(whatsapp).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => decodeURIComponent(lastEventsRequest(requests))).toContain("origins=email,whatsapp");

    await page.getByRole("button", { name: "התראות", exact: true }).click();
    await expect(page.locator("#timelineOriginFilters")).toBeHidden();
    expect(errors).toHaveLength(0);
  });

  test("fits inside a 375px viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupTimelineMocks(page);
    await openTimeline(page);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
    await expect(page.locator(".tlOriginBtn")).toHaveCount(4);
  });
});
