import { describe, it, expect } from "vitest";
import { assessListing, type CompletenessInput } from "./completeness";

const EMPTY: CompletenessInput = { photoCount: 0, hasAvailability: false };

const FULL: CompletenessInput = {
  name: "Taco Loco",
  primary_category: "Tacos & Mexican",
  description: "A converted horsebox slinging proper Baja-style tacos at London events.",
  bio: "x".repeat(120),
  price_from: 12,
  contact_email: "hi@tacoloco.example",
  capacityMax: 200,
  attributes: { dietary: ["vegan"], gas_safe: "123456" },
  signature_items: ["Baja fish taco"],
  faq: [{ q: "Do you travel?", a: "Yes" }],
  coverage_radius_miles: 15,
  photoCount: 4,
  hasAvailability: true,
};

describe("assessListing", () => {
  it("scores an empty listing at 0 and a complete one at 100", () => {
    expect(assessListing(EMPTY).percent).toBe(0);
    expect(assessListing(FULL).percent).toBe(100);
  });

  it("weights sum to exactly 100 so the meter can't overflow or stall short", () => {
    const total = assessListing(EMPTY).items.reduce((s, i) => s + i.weight, 0);
    expect(total).toBe(100);
  });

  it("treats a too-short description as not done", () => {
    // Buyers see this first and it feeds the embedding — a stub shouldn't count.
    const stub = assessListing({ ...FULL, description: "Tacos" });
    expect(stub.missing.map((m) => m.key)).toContain("description");
    expect(stub.percent).toBeLessThan(100);
  });

  it("requires three photos, not just one", () => {
    expect(assessListing({ ...FULL, photoCount: 1 }).missing.map((m) => m.key)).toContain("photos");
    expect(assessListing({ ...FULL, photoCount: 3 }).missing.map((m) => m.key)).not.toContain("photos");
  });

  it("reports missing essentials separately from optional extras", () => {
    const c = assessListing({ ...FULL, price_from: null, faq: [] });
    expect(c.blocking.map((b) => b.key)).toEqual(["price"]);
    expect(c.missing.map((m) => m.key)).toContain("faq");
    expect(c.blocking.map((b) => b.key)).not.toContain("faq");
  });

  it("does not credit a zero or negative price", () => {
    expect(assessListing({ ...FULL, price_from: 0 }).missing.map((m) => m.key)).toContain("price");
  });

  it("ignores empty attributes and arrays", () => {
    const c = assessListing({ ...FULL, attributes: {}, signature_items: [] });
    const keys = c.missing.map((m) => m.key);
    expect(keys).toContain("attributes");
    expect(keys).toContain("signature");
  });

  it("gives every item a reason, so the checklist is never bare instruction", () => {
    for (const item of assessListing(EMPTY).items) {
      expect(item.why.length).toBeGreaterThan(10);
      expect(item.label.length).toBeGreaterThan(2);
    }
  });
});
