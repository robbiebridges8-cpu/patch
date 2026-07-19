import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Serial: the suite hits the real Supabase project, and parallel searches
  // would trip the rate limiter. Anthropic is stubbed (see webServer env), so
  // a run no longer costs anything at the model provider.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Retry once everywhere, not just CI: the search tests still drive Voyage,
  // and a rate-limited embed makes search fall back to the non-AI path — a real
  // flake with an external cause, not a code failure.
  retries: 1,
  reporter: process.env.CI ? "github" : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      // Mobile Safari specifically: the input-zoom and safe-area behaviours
      // this product cares about are WebKit's, not Chromium's.
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  // Runs against a production build, not `next dev`. Partly because that's the
  // artifact users get, and partly because the dev server's HMR websocket can
  // fail to hand off in headless Chromium, leaving the page server-rendered but
  // never hydrated — every click silently does nothing and every interactive
  // test fails for a reason that has nothing to do with the code.
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // Never let the test suite spend money at Anthropic. Voyage and pgvector
      // stay real, so ranking, relaxation and pagination are genuinely tested;
      // only the two paid model calls are faked. The flag is ignored on any
      // https deployment, so it cannot leak into production.
      PATCH_STUB_AI: "1",
      // Belt and braces: even if the stub were bypassed, the platform cap
      // bounds a runaway loop during a test run.
      AI_DAILY_SEARCH_CAP: process.env.AI_DAILY_SEARCH_CAP || "200",
    },
  },
});
