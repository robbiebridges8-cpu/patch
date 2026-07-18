import { test, expect, type Page } from "@playwright/test";

// A focus trap is invisible in the DOM — the only way to know it works is to
// press Tab and see where focus lands. These are the tests that justify the
// claim, not the markup.

const VENDOR = "/vendors/taco-loco";

/** Where is focus right now, described well enough to assert on. */
async function activeDescriptor(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").trim().slice(0, 40),
      label: el.getAttribute("aria-label"),
      inDialog: !!el.closest('[role="dialog"]'),
    };
  });
}

/**
 * Click the trigger and wait for the dialog. Retried because a click can land
 * before React has hydrated the button, in which case it does nothing at all —
 * Playwright's actionability checks can't see a missing event handler.
 */
async function openEnquiryDialog(page: Page) {
  const trigger = page.getByRole("button", { name: /get in touch/i }).first();
  const dialog = page.locator('[role="dialog"]');

  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });

  return { trigger, dialog };
}

test.describe("keyboard access", () => {
  test("skip link is the first tab stop and jumps to main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.locator("a.skipLink");
    await expect(skip).toBeFocused();

    // It must be visible once focused, not just present.
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("every page exposes a main landmark and one h1", async ({ page }) => {
    for (const path of ["/", VENDOR, "/shortlist", "/enquiries", "/about"]) {
      await page.goto(path);
      await expect(page.locator("#main-content")).toHaveCount(1);
      expect(await page.locator("h1").count()).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe("enquiry dialog", () => {
  test("traps focus, closes on Escape, and restores focus to the trigger", async ({ page }) => {
    await page.goto(VENDOR);

    const { trigger, dialog } = await openEnquiryDialog(page);
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Focus must have moved into the dialog on open.
    expect((await activeDescriptor(page))?.inDialog).toBe(true);

    // Tab many times — more than the dialog has controls — and focus must
    // never escape. Without a trap this walks out into the page behind.
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const active = await activeDescriptor(page);
      expect(active?.inDialog, `focus escaped the dialog on Tab #${i + 1}`).toBe(true);
    }

    // Shift+Tab must wrap backwards without escaping either.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+Tab");
      const active = await activeDescriptor(page);
      expect(active?.inDialog, `focus escaped backwards on Shift+Tab #${i + 1}`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Focus returns to what opened it, so the user isn't dumped at the top.
    await expect(trigger).toBeFocused();
  });

  test("locks background scroll while open", async ({ page }) => {
    await page.goto(VENDOR);
    await openEnquiryDialog(page);

    expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});

test.describe("contrast", () => {
  test("muted text meets WCAG AA against its surface", async ({ page }) => {
    await page.goto(VENDOR);

    const ratio = await page.evaluate(() => {
      function lum(rgb: string) {
        const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map(Number);
        const f = (c: number) => {
          const s = c / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      const style = getComputedStyle(document.documentElement);
      const fg = style.getPropertyValue("--color-text-muted").trim();
      const bg = style.getPropertyValue("--color-surface-raised").trim();

      // Resolve the tokens to rgb via a throwaway element.
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      probe.style.color = fg;
      const fgRgb = getComputedStyle(probe).color;
      probe.style.color = bg;
      const bgRgb = getComputedStyle(probe).color;
      probe.remove();

      const a = lum(fgRgb);
      const b = lum(bgRgb);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
