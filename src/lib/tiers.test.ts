import { describe, it, expect } from "vitest";
import {
  TIER, SELLABLE_TIERS, canAccess, requiredTier, annualPrice, TIER_PRICE,
  ANNUAL_MONTHS_CHARGED, UPGRADE_REASONS, type Feature,
} from "./tiers";

// This module is the paywall. A wrong answer here either gives away the
// product or withholds something a vendor paid for, so it's worth pinning.

const ALL: Feature[] = [
  "unlock_leads", "search_visibility", "featured_placement", "analytics",
  "photo_gallery", "availability", "rich_profile", "instant_alerts",
  "no_competitor_panel", "multiple_services",
];

describe("canAccess", () => {
  it("gives free tier none of the paid features", () => {
    for (const f of ALL) {
      expect(canAccess(TIER.FREE, f), `free should not have ${f}`).toBe(false);
    }
  });

  it("gives the paid tier every feature", () => {
    for (const f of ALL) {
      expect(canAccess(TIER.PAID, f), `paid should have ${f}`).toBe(true);
    }
  });

  it("unlocks leads on upgrade — the core paid promise", () => {
    expect(canAccess(TIER.FREE, "unlock_leads")).toBe(false);
    expect(canAccess(TIER.PAID, "unlock_leads")).toBe(true);
  });

  // A vendor row with a null/undefined tier must fail closed, not open.
  it("treats a missing tier as free rather than granting access", () => {
    expect(canAccess(null, "unlock_leads")).toBe(false);
    expect(canAccess(undefined, "analytics")).toBe(false);
  });

  it("is monotonic — a higher tier never loses a feature", () => {
    for (const f of ALL) {
      const grants = [TIER.FREE, TIER.PAID, 2].map((t) => canAccess(t, f));
      const firstTrue = grants.indexOf(true);
      if (firstTrue >= 0) {
        expect(grants.slice(firstTrue).every(Boolean), `${f} regressed at a higher tier`).toBe(true);
      }
    }
  });

  it("requiredTier agrees with canAccess for every feature", () => {
    for (const f of ALL) {
      expect(canAccess(requiredTier(f), f)).toBe(true);
      expect(canAccess(requiredTier(f) - 1, f)).toBe(false);
    }
  });

  // Tier 2 is reserved for a future paid tier. It must already behave
  // sensibly (grant everything tier 1 does) so adding it is config, not a fix.
  it("leaves room for a second paid tier that inherits everything", () => {
    for (const f of ALL) {
      expect(canAccess(2, f), `reserved tier 2 should inherit ${f}`).toBe(true);
    }
  });
});

describe("what the product sells", () => {
  it("sells exactly one paid tier today", () => {
    expect(SELLABLE_TIERS).toEqual([TIER.PAID]);
  });

  it("charges 10 months for a year — two free", () => {
    expect(ANNUAL_MONTHS_CHARGED).toBe(10);
    expect(annualPrice(TIER.PAID)).toBe(TIER_PRICE[TIER.PAID] * 10);
  });

  it("makes annual cheaper than 12 months monthly", () => {
    expect(annualPrice(TIER.PAID)).toBeLessThan(TIER_PRICE[TIER.PAID] * 12);
  });

  it("prices free at zero", () => {
    expect(TIER_PRICE[TIER.FREE]).toBe(0);
    expect(TIER_PRICE[TIER.PAID]).toBeGreaterThan(0);
  });

  it("leads the upgrade pitch with reading your enquiries", () => {
    expect(UPGRADE_REASONS[0].feature).toBe("unlock_leads");
  });
});
