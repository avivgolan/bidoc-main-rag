import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const TEST_SESSION_SECRET = "playwright-test-session-secret";

async function addTestSuperadminSession(page) {
  const payload = Buffer.from(JSON.stringify({
    sub: "11111111-1111-4111-8111-111111111111",
    email: "build-version@example.test",
    role: "סופראדמין",
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", TEST_SESSION_SECRET).update(payload).digest("base64url");
  await page.context().addCookies([{
    name: "bidoc_session",
    value: `${payload}.${signature}`,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax"
  }]);
}

test("the active build version is visible below the logo", async ({ page }) => {
  await addTestSuperadminSession(page);
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.goto("/");

  const brand = page.locator(".sidebarBrand");
  const tagline = brand.locator(".brandTagline");
  const version = brand.locator(".brandVersion");

  await expect(version).toBeVisible();
  await expect(version).toHaveText(/גרסה\s+local/u);
  await expect(version).toHaveAttribute("data-build-version", "local");

  const taglineBox = await tagline.boundingBox();
  const versionBox = await version.boundingBox();
  expect(taglineBox).not.toBeNull();
  expect(versionBox).not.toBeNull();
  expect(versionBox.y).toBeGreaterThan(taglineBox.y);
});
