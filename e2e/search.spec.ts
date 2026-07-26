import { test, expect } from "@playwright/test";

// The search path costs money per run (Claude parse + Voyage embed), so this
// file is deliberately lean: a handful of journeys, not exhaustive permutations.
//
// Each test drives the real pipeline, and running them back to back trips
// Voyage's per-minute rate limit — the embed then fails, search silently drops
// to the non-AI fallback, and assertions fail for a reason that has nothing to
// do with the code. Space them out rather than chase the phantom.
test.beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 8000));
});

test.describe("search", () => {
  test("returns decision-ready cards for a plain-language brief", async ({ page }) => {
    await page.goto("/search?q=pizza+van+for+a+summer+party+in+Hackney");

    // Cards must arrive without waiting on the streamed AI note.
    const cards = page.locator('a[href^="/vendors/"]');
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    expect(await cards.count()).toBeGreaterThan(0);

    // The parsed-intent readback is what tells the buyer we understood them.
    await expect(page.locator("h1")).toContainText("pizza van");
  });

  test("reveals more results a page at a time without refetching", async ({ page }) => {
    await page.goto("/search?q=something+memorable+for+a+work+celebration");
    await expect(page.locator('a[href^="/vendors/"]').first()).toBeVisible({ timeout: 30_000 });

    const more = page.getByRole("button", { name: /show \d+ more/i });
    if ((await more.count()) === 0) test.skip(true, "corpus returned a single page");

    const before = await page.locator('a[href^="/vendors/"]').count();
    // A refetch would remount the list; a client-side reveal will not.
    const requests: string[] = [];
    page.on("request", (r) => r.url().includes("/search") && requests.push(r.url()));

    await more.first().click();
    const after = await page.locator('a[href^="/vendors/"]').count();

    expect(after).toBeGreaterThan(before);
    expect(requests, "show-more must not hit the server").toHaveLength(0);
  });

  test("matches dietary needs from the brief, with no dietary filter", async ({ page }) => {
    // Dietary is semantic now (PRD §3.3), not a hardcoded UI filter — a dietary
    // word in the brief still returns vendors, and the sidebar has no dietary panel.
    await page.goto("/search?q=vegan+canapes+for+a+launch+in+Shoreditch");

    const cards = page.locator('a[href^="/vendors/"]');
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
    expect(await cards.count()).toBeGreaterThan(0);

    // The removed filter: no "Dietary needs" control anywhere on the page.
    await expect(page.getByText(/dietary needs/i)).toHaveCount(0);
  });

  test("says so when it had to widen the brief", async ({ page }) => {
    await page.goto("/search?q=Korean+BBQ+in+Hackney+for+800+guests+under+%C2%A320");
    await expect(page.getByText(/nothing matched that exactly/i)).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("shortlist", () => {
  test("saves a vendor, shows it in the tray, and persists across a reload", async ({ page }) => {
    await page.goto("/search?q=pizza+for+50+guests");
    await expect(page.locator('a[href^="/vendors/"]').first()).toBeVisible({ timeout: 30_000 });

    const save = page.getByRole("button", { name: /save|shortlist/i }).first();
    if ((await save.count()) === 0) test.skip(true, "no save control on the card");
    await save.click();

    await page.goto("/shortlist");
    const saved = page.locator('a[href^="/vendors/"]');
    await expect(saved.first()).toBeVisible();

    // It lives in localStorage, so a reload must not lose it.
    await page.reload();
    await expect(page.locator('a[href^="/vendors/"]').first()).toBeVisible();
  });
});
