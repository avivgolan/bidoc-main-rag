import { defineConfig, devices } from "@playwright/test";

// Use a port that won't conflict with the default dev server (4000)
const TEST_PORT = 4099;

export default defineConfig({
  testDir: "test/ui",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: 1,
  reporter: [["list"]],

  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "node src/server.js",
    port: TEST_PORT,
    reuseExistingServer: false,
    timeout: 15_000,
    // Pass env vars so the server binds to the test port and doesn't block on
    // missing Supabase credentials during smoke runs.
    env: {
      PORT: String(TEST_PORT),
      // Empty strings prevent Supabase init from trying real endpoints.
      // The server handles missing config gracefully (returns empty data).
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      OPENROUTER_API_KEY: "test-noop",
      MAIN_AGENT_SESSION_SECRET: "playwright-test-session-secret",
    },
  },

  outputDir: "test-results",
});
