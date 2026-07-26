import { test } from "@playwright/test";

// Not an assertion suite — captures the core buyer journey for a visual UX review.
// Run: npx playwright test ux-capture
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const DIR = "test-results/ux";

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
}

// Capture-only — skipped in normal runs. Run with: UX_CAPTURE=1 npx playwright test ux-capture
test("capture buyer journey", async ({ page }) => {
  test.skip(!process.env.UX_CAPTURE, "UX capture tool — set UX_CAPTURE=1 to run");
  test.setTimeout(120_000);

  // Home
  await page.setViewportSize(DESKTOP);
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "home-desktop");
  await page.setViewportSize(MOBILE);
  await page.goto("/");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "home-mobile");

  // Search — empty state (browse)
  await page.setViewportSize(DESKTOP);
  await page.goto("/search");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "search-empty-desktop");
  await page.setViewportSize(MOBILE);
  await page.goto("/search");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "search-empty-mobile");

  // Search results
  await page.setViewportSize(DESKTOP);
  await page.goto("/search?q=" + encodeURIComponent("pizza for a 40th birthday in Hackney"));
  await page.waitForTimeout(9000); // let cards + note stream in
  await page.screenshot({ path: `${DIR}/search-desktop.png`, fullPage: true });

  // Vendor profile
  await page.goto("/vendors/spice-box");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "profile-desktop");
  await page.setViewportSize(MOBILE);
  await page.goto("/vendors/spice-box");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "profile-mobile");

  // Enquiry modal
  await page.setViewportSize(DESKTOP);
  await page.goto("/vendors/spice-box");
  await page.waitForTimeout(1000);
  const enquire = page.getByRole("button", { name: /enqu/i }).first();
  if (await enquire.count()) {
    await enquire.click().catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${DIR}/enquiry-modal.png` });
  }

  // Location / GEO page
  await page.goto("/services/pizza/hackney");
  await page.waitForLoadState("networkidle").catch(() => {});
  await shot(page, "services-desktop");

  // Login
  await page.goto("/login");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/login-desktop.png` });
});
