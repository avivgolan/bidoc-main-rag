# Timeline UI Tests (Playwright)

Browser smoke tests for the Timeline page. Chromium only, fully mocked — no external services required.

## Prerequisites

- Node.js ≥ 20
- Chromium installed: `npx playwright install chromium`

## Commands

| Command | Description |
|---|---|
| `npm run test:ui` | Run all UI tests headless |
| `npm run test:ui:headed` | Run with visible browser window |
| `npm run test:ui:debug` | Open Playwright Inspector for step-through |

Node unit tests (`npm test`) run independently and do not require Playwright.

## 5C — Accessibility, Keyboard, and Mobile tests

Added in Timeline 5C (2026-06-12). All 120 new tests are fully mocked (no Supabase/OpenRouter).

### New test files

| File | Tests | Description |
|---|---|---|
| `a11y-aria.test.js` | 27 | ARIA roles, states, and accessible names across all timeline controls |
| `keyboard-source-resolution.test.js` | 9 | Keyboard: Tab/Enter/Space on source and resolution buttons |
| `keyboard-dropdowns.test.js` | 12 | Keyboard: tags and fields dropdown open/close/Escape |
| `keyboard-list.test.js` | 7 | Keyboard: Enter/Space on event list items, focus, active class |
| `keyboard-calendar.test.js` | 12 | Keyboard: calendar arrow nav, Enter/Space on day cells, Escape from cards |
| `mobile-layout.test.js` | 31 | Overflow checks and element visibility at 320px, 375px, 768px |
| `mobile-touch-targets.test.js` | 8 | Touch target measurements (≥44px) at 320px viewport |
| `reduced-motion.test.js` | 7 | Full feature functionality under `prefers-reduced-motion: reduce` |
| `focus-detail.test.js` | 8 | Detail panel focus management, metadata button ARIA |

### Viewports covered

| Width | Layout mode | Notes |
|---|---|---|
| 320px | Mobile (buildStaticList) | Full overflow + touch target checks; `.tlWave` hidden |
| 375px | Mobile (buildStaticList) | Overflow checks; `.tlWave` hidden |
| 768px | Tablet (buildStaticList) | Overflow checks |
| 800px | Narrow (buildStaticList) | Used in keyboard-list tests to avoid virtual-list detachment |
| Desktop | Virtual (buildVirtualList) | Default; used in ARIA, dropdown, source/resolution tests |

### Known behavior (not automated — manual tests)

- **ArrowUp/ArrowDown in list view**: Not implemented. Each `.tlListItem` is independently focusable (tabindex=0) but there is no arrow-key navigation between items. To add: wire a `keydown` container handler that moves focus to prev/next sibling item.
- **Roving tabindex on source/resolution buttons**: Not implemented. Each button is independently focusable (no grouped navigation).
- **Home/End week boundary in calendar**: Implemented via `calWeekBoundary()` (not tested — complex fixture dates needed).
- **Shift+PageUp/Down for year navigation**: Implemented in `wireCalendarKeyboard` (not tested separately).

## How it works

The webServer config starts the app on port 4099. Each test uses `page.route()` to
intercept all `/api/timeline/*` calls and return fixture data. No real Supabase or
OpenRouter traffic is made.

## Fixtures

| File | Contents |
|---|---|
| `fixtures/index-events.js` | 4 index events spanning 3+ months; two same day; long content; long URL |
| `fixtures/alerts-events.js` | 4 alert events; two same day; varied severities; full metadata |
| `fixtures/pagination.js` | Split versions of above into page-1 (hasMore) + page-2 |
| `fixtures/links.js` | Empty and minimal link/suggestion responses |

## Adding a route mock

In `helpers/setup.js`, `setupTimelineMocks(page, opts)` accepts:

```js
await setupTimelineMocks(page, {
  indexResponse: MY_CUSTOM_RESPONSE,   // overrides default index fixture
  alertsPage2: MY_PAGE_2,              // used when cursor param is present
  delayMs: 500,                        // simulate slow network
  failUrlPattern: "source=alerts",     // make matching requests return 503
});
```

## Running a single test

```sh
npx playwright test smoke --grep "pagination"
```

## Artifacts

Traces and screenshots are saved to `test-results/` on failure only (gitignored).
Reports land in `playwright-report/` (also gitignored).
