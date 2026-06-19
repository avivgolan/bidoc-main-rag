import { test, expect } from "@playwright/test";
import { collectPageErrors } from "./helpers/setup.js";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function openChat(page) {
  await page.goto("/#chat");
  await page.waitForSelector("#chat.active", { timeout: 10_000 });
  await expect(page.locator(".mobileShellBar")).toBeVisible();
  await expect(page.locator("#chatForm")).toBeVisible();
}

test.describe("Mobile shell and chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort("blockedbyclient"));
  });

  test("main sidebar opens as a mobile drawer and closes after navigation", async ({ page }) => {
    const errors = collectPageErrors(page);
    await openChat(page);

    const shell = page.locator("#appShell");
    const toggle = page.locator("#toggleSidebar");

    await toggle.click();
    await expect(shell).toHaveClass(/sidebarOpen/);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#sidebarBackdrop")).toBeVisible();

    await page.locator('.tab[data-tab="settings"]').click();
    await expect(page.locator("#settings.active")).toBeVisible();
    await expect(shell).not.toHaveClass(/sidebarOpen/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#mobileActiveTabLabel")).toContainText("הגדרות");

    expect(errors).toHaveLength(0);
  });

  test("chat history drawer opens above the workspace on mobile", async ({ page }) => {
    const errors = collectPageErrors(page);
    await openChat(page);

    await page.locator("#toggleChatDrawer").click();
    await expect(page.locator("#chat")).toHaveClass(/drawerOpen/);
    await expect(page.locator("#toggleChatDrawer")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#chatDrawerBackdrop")).toBeVisible();

    await page.locator("#chatDrawerBackdrop").click();
    await expect(page.locator("#chat")).not.toHaveClass(/drawerOpen/);
    await expect(page.locator("#toggleChatDrawer")).toHaveAttribute("aria-expanded", "false");

    expect(errors).toHaveLength(0);
  });

  test("composer tools stay in a two-column mobile grid without horizontal overflow", async ({ page }) => {
    const errors = collectPageErrors(page);
    await openChat(page);

    const layout = await page.evaluate(() => {
      const toolbar = document.querySelector(".composerTools");
      const composer = document.querySelector("#chatForm");
      const buttons = [...document.querySelectorAll(".composerTool")];
      const doc = document.documentElement;
      if (!toolbar || !composer || !buttons.length) return null;
      const style = window.getComputedStyle(toolbar);
      return {
        display: style.display,
        columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
        overflow: doc.scrollWidth > doc.clientWidth,
        buttonWidths: buttons.map((button) => button.getBoundingClientRect().width),
        composerWidth: composer.getBoundingClientRect().width,
        viewportWidth: window.innerWidth
      };
    });

    expect(layout).not.toBeNull();
    expect(layout.display).toBe("grid");
    expect(layout.columns).toBe(2);
    expect(layout.overflow).toBe(false);
    expect(Math.round(layout.composerWidth)).toBeLessThanOrEqual(layout.viewportWidth);
    for (const width of layout.buttonWidths) {
      expect(width).toBeGreaterThan(80);
    }

    expect(errors).toHaveLength(0);
  });
});
