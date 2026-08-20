import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

const PROJECT_ID = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
const ACTIVITY_KEY = "gantt:file-a:9";

async function addTestSuperadminSession(page) {
  const payload = Buffer.from(JSON.stringify({
    sub: "11111111-1111-4111-8111-111111111111",
    email: "schedule-updates@example.test",
    role: "סופראדמין",
    exp: Date.now() + 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", "playwright-test-session-secret").update(payload).digest("base64url");
  await page.context().addCookies([{
    name: "bidoc_session", value: `${payload}.${signature}`, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax"
  }]);
}

const activity = {
  subject: { kind: "activity", activityKey: ACTIVITY_KEY, milestoneKey: null, name: "יציקת קומת קרקע", isMilestone: false },
  timing: { plannedStart: "2026-01-01", plannedFinish: "2026-02-28", contractFinish: null, percentComplete: 40 },
  lateness: { isLate: true, daysLate: 20, basis: "contractor_planned_finish", basisDate: "2026-02-28" },
  status: "delayed_vs_contractor",
  gates: { contractAxis: "missing", scheduleVersions: 1, dependencies: "missing", observedEvents: "ok", calendar: "ok" }
};

const assignedItem = {
  id: "17", sourceTable: "alerts", sourceKind: "content_alert", kind: "update", alertType: "עדכון ביצוע",
  title: "הושלמה יציקת יסודות", date: "2026-02-10", severity: 2, status: "פתוח", href: null, activityKey: ACTIVITY_KEY
};
const unassignedItem = {
  id: "18", sourceTable: "alerts", sourceKind: "content_alert", kind: "alert", alertType: "עיכוב",
  title: "עיכוב באספקת ברזל", date: "2026-02-15", severity: 4, status: "בטיפול", href: null, activityKey: null
};

test("Schedule assigns searchable updates and expands them as dated points under an activity", async ({ page }) => {
  await addTestSuperadminSession(page);
  await page.route("**/api/**", (route) => route.fulfill({ json: {} }));
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort("blockedbyclient"));
  await page.route("**/api/schedule/projects", (route) => route.fulfill({ json: {
    projects: [{ projectId: PROJECT_ID, files: 1, latestRelevancyDate: "2026-03-20" }]
  }}));
  await page.route("**/api/schedule/health**", (route) => route.fulfill({ json: {
    computed: 1, late: 1, totalDaysLate: 20, milestonesDelayed: 0, schedule: { ageDays: 1, relevancyDate: "2026-03-20" }
  }}));
  await page.route("**/api/schedule/sweep", (route) => route.fulfill({ json: {
    asOf: "2026-03-20",
    scheduleMeta: { displayName: "לוח בדיקה", sourceVersionId: "file-a", relevancyDate: "2026-03-20", versionCount: 1 },
    indicators: [activity]
  }}));
  await page.route("**/api/schedule/alerts**", (route) => route.fulfill({ json: { alerts: [], count: 0 } }));
  await page.route("**/api/schedule/conditions**", (route) => route.fulfill({ json: { conditions: [] } }));
  await page.route("**/api/schedule/activity-updates?**", (route) => route.fulfill({ json: {
    total: 2, items: [assignedItem, unassignedItem]
  }}));
  await page.route("**/api/schedule/activity-updates/assign", async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ projectId: PROJECT_ID, sourceId: "18", activityKey: ACTIVITY_KEY });
    await route.fulfill({ json: { ok: true, item: { ...unassignedItem, activityKey: ACTIVITY_KEY } } });
  });

  await page.goto("/#schedule");
  await expect(page.locator(".activityUpdatesTable tbody tr")).toHaveCount(2);
  await expect(page.locator(".axisExpandBtn")).toContainText("1");
  await page.locator(".axisExpandBtn").click();
  await expect(page.locator(".axisEventPoint")).toHaveCount(1);
  await expect(page.locator(".axisEventName")).toContainText("הושלמה יציקת יסודות");

  const alertRow = page.locator(".activityUpdatesTable tbody tr").filter({ hasText: "עיכוב באספקת ברזל" });
  await alertRow.locator(".activityPicker summary").click();
  await alertRow.locator(".activityPicker input[type=search]").fill("יציקת קומת");
  const activityOption = alertRow.locator(".activityPickerOptions button").filter({ hasText: "יציקת קומת קרקע" });
  await expect(activityOption).toContainText("01.01.26–28.02.26");
  await expect(activityOption).not.toContainText("9");
  await activityOption.click();

  await expect(alertRow.locator(".activityPicker summary")).toContainText("יציקת קומת קרקע");
  await expect(page.locator(".axisExpandBtn")).toContainText("2");
  await expect(page.locator(".axisEventPoint")).toHaveCount(2);
});
