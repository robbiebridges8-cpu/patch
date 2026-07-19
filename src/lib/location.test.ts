import { describe, it, expect } from "vitest";
import { formatLocation, outwardCode, formatLocationWithDistance } from "./location";

describe("outwardCode", () => {
  it("takes the outward half of a full postcode", () => {
    expect(outwardCode("E8 3RL")).toBe("E8");
    expect(outwardCode("sw11 1aa")).toBe("SW11");
  });
  it("passes an already-outward code through", () => {
    expect(outwardCode("E8")).toBe("E8");
  });
  it("returns null for nothing", () => {
    expect(outwardCode(null)).toBeNull();
    expect(outwardCode("  ")).toBeNull();
  });
});

describe("formatLocation", () => {
  it("leads with the area and brackets the code", () => {
    expect(formatLocation("Hackney", "E8 3RL")).toBe("Hackney (E8)");
  });

  // Each of these is a real state in the data, not a hypothetical.
  it("falls back to the area alone when there's no postcode", () => {
    expect(formatLocation("Hackney", null)).toBe("Hackney");
  });
  it("falls back to the code alone when the area never resolved", () => {
    expect(formatLocation(null, "E8")).toBe("E8");
  });
  it("returns null when there's neither, so callers render nothing", () => {
    expect(formatLocation(null, null)).toBeNull();
    expect(formatLocation("  ", "")).toBeNull();
  });
});

describe("formatLocationWithDistance", () => {
  it("appends distance, one decimal under ten miles", () => {
    expect(formatLocationWithDistance("Hackney", "E8", 2.43)).toBe("Hackney (E8) · 2.4 mi away");
  });
  it("rounds to whole miles above ten", () => {
    expect(formatLocationWithDistance("Bromley", "BR1", 12.7)).toBe("Bromley (BR1) · 13 mi away");
  });
  it("omits distance when there isn't one", () => {
    expect(formatLocationWithDistance("Hackney", "E8", null)).toBe("Hackney (E8)");
  });
  it("shows distance alone rather than a dangling separator", () => {
    expect(formatLocationWithDistance(null, null, 3)).toBe("3 mi away");
  });
});
