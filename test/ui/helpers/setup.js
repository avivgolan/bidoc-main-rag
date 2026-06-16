/**
 * Shared Playwright route-mock helper for Timeline tests.
 *
 * Usage:
 *   const { requests } = await setupTimelineMocks(page);
 *   await page.goto("/#timeline");
 *
 * All external API calls are intercepted; no real Supabase/OpenRouter traffic.
 */

import { INDEX_PAGE_1 } from "../fixtures/index-events.js";
import { ALERTS_PAGE_1 } from "../fixtures/alerts-events.js";
import { LINKS_EMPTY, SUGGESTIONS_EMPTY } from "../fixtures/links.js";

/**
 * @param {import("@playwright/test").Page} page
 * @param {object} opts
 * @param {object}   [opts.indexResponse]      - Response for source=index (page 1 / no cursor)
 * @param {object}   [opts.alertsResponse]     - Response for source=alerts (page 1 / no cursor)
 * @param {object}   [opts.indexPage2]         - Response when cursor present and source=index
 * @param {object}   [opts.alertsPage2]        - Response when cursor present and source=alerts
 * @param {object}   [opts.linksResponse]      - Response for /api/timeline/links
 * @param {object}   [opts.suggestionsResponse]- Response for /api/timeline/link-suggestions
 * @param {number}   [opts.delayMs]            - Artificial delay before fulfilling (ms)
 * @param {string}   [opts.failUrlPattern]     - URL substring; matching requests return 503
 * @returns {{ requests: string[] }}           - Array of intercepted request URLs (live reference)
 */
export async function setupTimelineMocks(page, {
  indexResponse = INDEX_PAGE_1,
  alertsResponse = ALERTS_PAGE_1,
  indexPage2 = null,
  alertsPage2 = null,
  linksResponse = LINKS_EMPTY,
  suggestionsResponse = SUGGESTIONS_EMPTY,
  delayMs = 0,
  failUrlPattern = null,
} = {}) {
  const requests = [];

  await page.route("**/api/timeline/events**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);

    if (failUrlPattern && route.request().url().includes(failUrlPattern)) {
      return route.fulfill({ status: 503, contentType: "text/plain", body: "Service Unavailable" });
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const source = url.searchParams.get("source") || "index";
    const hasCursor = url.searchParams.has("cursor");

    if (hasCursor) {
      // Return page-2 fixture if provided, otherwise empty second page
      const p2 = source === "alerts" ? alertsPage2 : indexPage2;
      if (p2) return route.fulfill({ json: p2 });
      const empty = source === "alerts" ? alertsResponse : indexResponse;
      return route.fulfill({ json: { ...empty, events: [], page: { ...empty.page, hasMore: false, nextCursor: null } } });
    }

    const response = source === "alerts" ? alertsResponse : indexResponse;
    return route.fulfill({ json: response });
  });

  await page.route("**/api/timeline/links**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    return route.fulfill({ json: linksResponse });
  });

  await page.route("**/api/timeline/link-suggestions**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    return route.fulfill({ json: suggestionsResponse });
  });

  // Block any other external traffic (Supabase, OpenRouter) to keep tests isolated.
  // Requests to localhost pass through.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => {
    route.abort("blockedbyclient");
  });

  return { requests };
}

/**
 * Collect pageerror and console-error messages on a page.
 * Returns a live array; check after interactions complete.
 *
 * Allow-list: narrow list of known benign messages from this app.
 */
export function collectPageErrors(page) {
  const errors = [];
  const ALLOWED = [
    // Server startup may emit these if Supabase is unconfigured
    /MISSING/i,
    // Chromium reports this for RTL text in some builds — not an app error
    /ERR_BLOCKED_BY_CLIENT/i,
  ];

  const isAllowed = (msg) => ALLOWED.some((re) => re.test(msg));

  page.on("pageerror", (err) => {
    if (!isAllowed(err.message)) errors.push(`[pageerror] ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isAllowed(msg.text())) {
      errors.push(`[console.error] ${msg.text()}`);
    }
  });

  return errors;
}
