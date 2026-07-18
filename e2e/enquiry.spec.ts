import { test, expect, type Page } from "@playwright/test";

// The enquiry is the conversion event — if this breaks, the marketplace has no
// product. Covers the dialog, validation, and the buyer-side tracking that lets
// someone follow up without an account.

const VENDOR = "/vendors/taco-loco";

async function openDialog(page: Page) {
  const trigger = page.getByRole("button", { name: /get in touch/i }).first();
  const dialog = page.locator('[role="dialog"]');
  // Retried: a click can land before hydration, in which case it does nothing.
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  return dialog;
}

test.describe("enquiry", () => {
  test("rejects an incomplete form without hitting the server", async ({ page }) => {
    await page.goto(VENDOR);
    const dialog = await openDialog(page);

    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/enquiry")) posts.push(r.url());
    });

    await dialog.getByRole("button", { name: /send/i }).click();

    // Native required-field validation should stop it before any network call.
    await expect(dialog).toBeVisible();
    expect(posts, "an empty form must not reach the API").toHaveLength(0);
  });

  test("sends an enquiry and confirms it to the buyer", async ({ page }) => {
    await page.goto(VENDOR);
    const dialog = await openDialog(page);

    const stamp = Date.now();
    await dialog.getByLabel(/your name/i).fill("E2E Buyer");
    await dialog.getByLabel(/email/i).fill(`e2e-${stamp}@test.local`);
    await dialog
      .getByLabel(/what are you planning/i)
      .fill("Automated end-to-end test enquiry — please ignore.");

    const response = page.waitForResponse(
      (r) => r.url().includes("/api/enquiry") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: /send/i }).click();

    const res = await response;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.records?.[0]?.enquiryId).toBeTruthy();

    // The buyer must see it landed.
    await expect(dialog.getByText(/thank|sent|touch|received/i).first()).toBeVisible();

    // And it must be tracked locally so /enquiries can follow it up.
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("patch:enquiries") || "[]"),
    );
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].enquiryId).toBe(body.records[0].enquiryId);
  });

  test("the tracker page lists a sent enquiry", async ({ page }) => {
    // Seed the local record directly — this page reads localStorage, and we
    // already proved the send path writes it in the test above.
    await page.goto("/enquiries");
    await page.evaluate(() => {
      localStorage.setItem(
        "patch:enquiries",
        JSON.stringify([
          {
            enquiryId: "00000000-0000-0000-0000-0000000000ab",
            vendorName: "Taco Loco",
            vendorSlug: "taco-loco",
            at: Date.now(),
          },
        ]),
      );
    });
    await page.reload();

    await expect(page.getByText("Taco Loco")).toBeVisible();
    await expect(page.getByRole("button", { name: /message/i }).first()).toBeVisible();
  });
});

test.describe("api/enquiry", () => {
  test("validates input", async ({ request }) => {
    const bad = await request.post("/api/enquiry", {
      data: { vendorId: "not-a-uuid", name: "x", email: "x", message: "x" },
    });
    expect(bad.status()).toBeGreaterThanOrEqual(400);

    const noEmail = await request.post("/api/enquiry", {
      data: { vendorId: "00000000-0000-0000-0000-000000000001", name: "x", message: "x" },
    });
    expect(noEmail.status()).toBe(400);
  });
});
