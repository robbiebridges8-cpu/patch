import { describe, it, expect } from "vitest";
import {
  TIER, canAccess, requiredTier, annualPrice, TIER_PRICE,
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

  it("gives pro every feature", () => {
    for (const f of ALL) {
      expect(canAccess(TIER.PRO, f), `pro should have ${f}`).toBe(true);
    }
  });

  it("gates the two pro-only features above standard", () => {
    expect(canAccess(TIER.STANDARD, "featured_placement")).toBe(false);
    expect(canAccess(TIER.STANDARD, "multiple_services")).toBe(false);
    expect(canAccess(TIER.PRO, "featured_placement")).toBe(true);
  });

  it("unlocks leads at standard — the core paid promise", () => {
    expect(canAccess(TIER.FREE, "unlock_leads")).toBe(false);
    expect(canAccess(TIER.STANDARD, "unlock_leads")).toBe(true);
  });

  // A vendor row with a null/undefined tier must fail closed, not open.
  it("treats missing tier as free rather than granting access", () => {
    expect(canAccess(null, "unlock_leads")).toBe(false);
    expect(canAccess(undefined, "analytics")).toBe(false);
  });

  it("is monotonic — a higher tier never loses a feature", () => {
    for (const f of ALL) {
      const tiers = [TIER.FREE, TIER.STANDARD, TIER.PRO].map((t) => canAccess(t, f));
      const firstTrue = tiers.indexOf(true);
      if (firstTrue >= 0) {
        expect(tiers.slice(firstTrue).every(Boolean), `${f} regressed at a higher tier`).toBe(true);
      }
    }
  });

  it("requiredTier agrees with canAccess for every feature", () => {
    for (const f of ALL) {
      expect(canAccess(requiredTier(f), f)).toBe(true);
      expect(canAccess(requiredTier(f) - 1, f)).toBe(false);
    }
  });
});

describe("pricing", () => {
  it("charges 10 months for a year — two free", () => {
    expect(ANNUAL_MONTHS_CHARGED).toBe(10);
    expect(annualPrice(TIER.STANDARD)).toBe(TIER_PRICE[TIER.STANDARD] * 10);
    expect(annualPrice(TIER.PRO)).toBe(TIER_PRICE[TIER.PRO] * 10);
  });

  it("makes annual cheaper than 12 months monthly", () => {
    for (const t of [TIER.STANDARD, TIER.PRO] as const) {
      expect(annualPrice(t)).toBeLessThan(TIER_PRICE[t] * 12);
    }
  });

  it("prices free at zero and orders the tiers", () => {
    expect(TIER_PRICE[TIER.FREE]).toBe(0);
    expect(TIER_PRICE[TIER.STANDARD]).toBeLessThan(TIER_PRICE[TIER.PRO]);
  });

  it("leads the upgrade pitch with reading your enquiries", () => {
    expect(UPGRADE_REASONS[0].feature).toBe("unlock_leads");
  });
});
