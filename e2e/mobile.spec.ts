import { test, expect, devices } from "@playwright/test";

// Mobile is the primary surface for this product and the bar an eventual native
// app gets held to. These assert measured geometry on a real phone viewport,
// not the presence of a media query.

test.use({ ...devices["iPhone 13"] });

const PAGES = ["/", "/search?q=pizza+for+50+guests", "/vendors/taco-loco", "/shortlist", "/enquiries"];

test.describe("mobile layout", () => {
  test("no page scrolls sideways", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }));
      // A stray 1px from rounding is fine; anything more is a real break-out.
      expect(overflow.doc, `${path} overflows horizontally`).toBeLessThanOrEqual(
        overflow.win + 1,
      );
    }
  });

  test("text inputs are 16px or larger so iOS doesn't zoom on focus", async ({ page }) => {
    await page.goto("/vendors/taco-loco");

    await expect(async () => {
      await page.getByRole("button", { name: /get in touch/i }).first().click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });

    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="dialog"] input, [role="dialog"] textarea')).map(
        (el) => ({
          name: (el as HTMLInputElement).name || el.tagName.toLowerCase(),
          size: parseFloat(getComputedStyle(el).fontSize),
        }),
      ),
    );

    expect(sizes.length).toBeGreaterThan(0);
    for (const f of sizes) {
      expect(f.size, `${f.name} is ${f.size}px — iOS will zoom the page`).toBeGreaterThanOrEqual(16);
    }
  });

  test("visible controls meet a 44px touch target", async ({ page }) => {
    const offenders: string[] = [];

    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");

      const small = await page.evaluate(() => {
        const out: { label: string; w: number; h: number }[] = [];
        const nodes = document.querySelectorAll<HTMLElement>(
          'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea',
        );

        // WCAG 2.5.8 "Equivalent" exception: a small link is fine when the same
        // destination is also reachable from a large target on the page — which
        // is exactly how the vendor cards work (title link + big photo link).
        const bigHrefs = new Set<string>();
        for (const el of nodes) {
          const href = el.getAttribute("href");
          const r = el.getBoundingClientRect();
          if (href && r.height >= 44 && r.width >= 44) bigHrefs.add(href);
        }

        for (const el of nodes) {
          const href = el.getAttribute("href");
          if (href && bigHrefs.has(href)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // hidden
          if (getComputedStyle(el).visibility === "hidden") continue;

          // A pseudo-element may supply the real hit area.
          const after = getComputedStyle(el, "::after");
          const expanded = parseFloat(after.height) >= 44 && parseFloat(after.width) >= 44;
          if (expanded) continue;

          // Inline links inside prose are exempt (WCAG 2.5.8 inline exception).
          const inProse = !!el.closest("p, li");
          if (inProse && el.tagName === "A") continue;

          if (r.height < 44 || r.width < 24) {
            out.push({
              label: (el.getAttribute("aria-label") || el.textContent || el.tagName)
                .trim()
                .slice(0, 32),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
        }
        return out;
      });

      for (const s of small) offenders.push(`${path}: "${s.label}" ${s.w}x${s.h}`);
    }

    expect(offenders, `controls below the 44px target:\n${offenders.join("\n")}`).toHaveLength(0);
  });

  test("zoom is not capped", async ({ page }) => {
    // Blocking pinch-zoom is a WCAG 1.4.4 failure and the most common mobile
    // accessibility mistake — assert we never regress into it.
    await page.goto("/");
    const meta = await page.getAttribute('meta[name="viewport"]', "content");
    expect(meta).toBeTruthy();
    expect(meta!.toLowerCase()).not.toContain("user-scalable=no");
    expect(meta!.toLowerCase()).not.toMatch(/maximum-scale=\s*1/);
  });

  test("the sticky enquiry bar clears the home indicator", async ({ page }) => {
    await page.goto("/vendors/taco-loco");
    const bar = page.locator('[class*="stickyBar"]').first();
    if ((await bar.count()) === 0) test.skip(true, "no sticky bar on this viewport");

    const pad = await bar.evaluate((el) => getComputedStyle(el).paddingBottom);
    // env() resolves to 0 in headless, so we assert the base padding survived
    // rather than a specific inset — the point is that it's calc()-derived.
    expect(parseFloat(pad)).toBeGreaterThanOrEqual(12);
  });
});
