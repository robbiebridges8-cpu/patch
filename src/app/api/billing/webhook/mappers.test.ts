import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { mapStatus, periodEnd } from "./route";

describe("mapStatus", () => {
  it("maps live states to paying statuses", () => {
    expect(mapStatus("active")).toBe("active");
    expect(mapStatus("trialing")).toBe("trialing");
  });
  it("maps canceled to cancelled (UK spelling stored)", () => {
    expect(mapStatus("canceled")).toBe("cancelled");
  });
  it("maps dunning states to past_due", () => {
    expect(mapStatus("past_due")).toBe("past_due");
    expect(mapStatus("unpaid")).toBe("past_due");
  });
  it("treats incomplete/paused as trialing (not yet active, not lapsed)", () => {
    expect(mapStatus("incomplete")).toBe("trialing");
    expect(mapStatus("incomplete_expired")).toBe("trialing");
    expect(mapStatus("paused" as Stripe.Subscription.Status)).toBe("trialing");
  });
});

describe("periodEnd", () => {
  const at = 1_800_000_000; // fixed unix seconds
  const iso = new Date(at * 1000).toISOString();

  it("reads the top-level current_period_end", () => {
    const sub = { current_period_end: at, items: { data: [] } } as unknown as Stripe.Subscription;
    expect(periodEnd(sub)).toBe(iso);
  });
  it("falls back to the line-item period end (newer Stripe shape)", () => {
    const sub = { items: { data: [{ current_period_end: at }] } } as unknown as Stripe.Subscription;
    expect(periodEnd(sub)).toBe(iso);
  });
  it("prefers the top-level value when both are present", () => {
    const sub = { current_period_end: at, items: { data: [{ current_period_end: 1 }] } } as unknown as Stripe.Subscription;
    expect(periodEnd(sub)).toBe(iso);
  });
  it("returns null when neither is set", () => {
    const sub = { items: { data: [] } } as unknown as Stripe.Subscription;
    expect(periodEnd(sub)).toBeNull();
  });
});
