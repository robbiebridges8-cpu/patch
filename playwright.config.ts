import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The suite hits the real Supabase project and the AI pipeline, so keep it
  // serial-ish: parallel searches would trip the rate limiter and cost money.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Retry once everywhere, not just CI: the search tests drive Voyage and
  // Anthropic, and a rate-limited embed makes search fall back to the non-AI
  // path — a real flake with an external cause, not a code failure.
  retries: 1,
  reporter: process.env.CI ? "github" : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
  },
});
