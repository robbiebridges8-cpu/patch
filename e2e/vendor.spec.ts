import { test, expect } from "@playwright/test";

/**
 * Vendor dashboard journeys.
 *
 * These need a real signed-in vendor, and the only database available is the
 * live one — so rather than create and delete auth users on every run, they're
 * opt-in. Set credentials for a vendor account you don't mind mutating:
 *
 *   E2E_VENDOR_EMAIL=you@example.com E2E_VENDOR_PASSWORD=... npm run test:e2e
 *
 * Without them the suite still runs; these tests report as skipped rather than
 * quietly passing and implying coverage that isn't there.
 */
const EMAIL = process.env.E2E_VENDOR_EMAIL;
const PASSWORD = process.env.E2E_VENDOR_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const configured = !!(EMAIL && PASSWORD && SUPABASE_URL && ANON_KEY);

test.describe("vendor dashboard", () => {
  test.skip(!configured, "set E2E_VENDOR_EMAIL and E2E_VENDOR_PASSWORD to run");

  test.beforeEach(async ({ page, request }) => {
    // Sign in against Supabase directly and plant the session cookie the
    // @supabase/ssr client expects, rather than driving the magic-link flow.
    const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON_KEY!, "Content-Type": "application/json" },
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(res.status(), "sign-in failed — check the credentials").toBe(200);
    const session = await res.json();

    const ref = new URL(SUPABASE_URL!).hostname.split(".")[0];
    const value =
      "base64-" +
      Buffer.from(
        JSON.stringify({
          access_token: session.access_token,
          token_type: session.token_type,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token,
          user: session.user,
        }),
      ).toString("base64");

    await page.context().addCookies([
      {
        name: `sb-${ref}-auth-token`,
        value,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  });

  test("shows the dashboard with listing strength and performance", async ({ page }) => {
    await page.goto("/vendor/dashboard");
    await expect(page).toHaveURL(/\/vendor\/dashboard/);

    await expect(page.getByText(/listing strength/i)).toBeVisible();
    await expect(page.getByText(/performance/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /preview as a buyer/i })).toBeVisible();
  });

  test("edits the listing and persists the change", async ({ page }) => {
    await page.goto("/vendor/dashboard");

    const description = page.getByLabel(/short description|description/i).first();
    await expect(description).toBeVisible();

    const marker = `E2E edit ${Date.now()}`;
    const original = await description.inputValue();
    await description.fill(`${original} ${marker}`.slice(0, 1900));

    await page.getByRole("button", { name: /save|update/i }).first().click();

    // Reload to prove it round-tripped through the database, not just state.
    await page.reload();
    await expect(page.getByLabel(/short description|description/i).first()).toHaveValue(
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );

    // Put it back so repeated runs don't grow the field forever.
    const restore = page.getByLabel(/short description|description/i).first();
    await restore.fill(original);
    await page.getByRole("button", { name: /save|update/i }).first().click();
  });

  test("preview shows the listing as a buyer sees it", async ({ page }) => {
    await page.goto("/vendor/dashboard");
    const preview = page.getByRole("link", { name: /preview as a buyer/i });
    const href = await preview.getAttribute("href");
    expect(href).toMatch(/^\/vendors\/.+\?preview=1$/);

    await page.goto(href!);
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });
});
