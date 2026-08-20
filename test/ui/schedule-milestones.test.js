import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const TEST_SESSION_SECRET = "playwright-test-session-secret";

async function addTestSuperadminSession(page) {
  const payload = Buffer.from(JSON.stringify({
    sub: "11111111-1111-4111-8111-111111111111",
    email: "schedule-milestones@example.test",
    role: "סופראדמין",
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", TEST_SESSION_SECRET).update(payload).digest("base64url");
  await page.context().addCookies([{
    name: "bidoc_session", value: `${payload}.${signature}`, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax"
  }]);
}
const lateActivity = {
  subject: { kind: "activity", activityKey: "gantt:file-a:9", milestoneKey: null, name: "פעילות באיחור", isMilestone: false },
  timing: { plannedStart: "2025-12-02", plannedFinish: "2025-12-21", contractFinish: null, percentComplete: 0 },
  lateness: { isLate: true, daysLate: 226, basis: "contractor_planned_finish", basisDate: "2025-12-21" },
  status: "delayed_vs_contractor",
  gates: { contractAxis: "missing", scheduleVersions: 1, dependencies: "missing", observedEvents: "missing", calendar: "ok" }
};
test("Schedule shows a provisional milestone flag when the trigger is saved but holiday coverage is incomplete", async ({ page }) => {
  await addTestSuperadminSession(page);
  // Keep unrelated legacy-page boot requests isolated; this test owns only the
  // Schedule island endpoints below.
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort("blockedbyclient"));
  await page.route("**/api/schedule/projects", (route) => route.fulfill({ json: {
    projects: [{ projectId: PROJECT_ID, files: 1, latestRelevancyDate: "2026-08-01" }]
  }}));
  await page.route("**/api/schedule/health**", (route) => route.fulfill({ json: {
    computed: 2, late: 1, totalDaysLate: 226, milestonesDelayed: 0, schedule: { ageDays: 3, relevancyDate: "2026-08-01" }
  }}));
  await page.route("**/api/schedule/sweep", (route) => route.fulfill({ json: {
    asOf: "2026-08-04",
    scheduleMeta: { displayName: "לוח בדיקה", sourceVersionId: "file-a", relevancyDate: "2026-08-01", versionCount: 1 },
    indicators: [lateActivity]
  }}));
  await page.route("**/api/schedule/alerts**", (route) => route.fulfill({ json: { alerts: [], count: 0 } }));
  await page.route("**/api/schedule/conditions**", (route) => route.fulfill({ json: { conditions: [{
    id: "condition-working-days",
    name: "מועד השלמת השירותים",
    status: "pending",
    trigger_event_date: "2025-09-30",
    metadata: {
      pending_reason: "working_calendar_coverage_incomplete",
      trigger_evidence: { provisionalDueDate: "2026-02-17" }
    }
  }] } }));

  await page.goto("/#schedule");
  await expect(page.locator("#schedule.active .axesContractLine.is-provisional")).toHaveCount(1);
  await expect(page.locator(".axesContractLine label")).toContainText("משוער: מועד השלמת השירותים · 2026-02-17");
  await expect(page.locator("#schedule.active .axesTriggerLine")).toHaveCount(1);
  await expect(page.locator(".axesTriggerLine label")).toContainText("תחילת ספירה: מועד השלמת השירותים · 2025-09-30");
  await expect(page.locator(".axisRow")).toHaveCount(1);

  const left = await page.locator(".axesContractLine").evaluate((element) => Number.parseFloat(element.style.left));
  const [targetTop, triggerTop] = await Promise.all([
    page.locator(".axesContractLine label").evaluate((element) => Number.parseFloat(getComputedStyle(element).top)),
    page.locator(".axesTriggerLine label").evaluate((element) => Number.parseFloat(getComputedStyle(element).top))
  ]);
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(100);
  expect(targetTop).toBeLessThan(0);
  expect(triggerTop).toBeLessThan(0);
});
