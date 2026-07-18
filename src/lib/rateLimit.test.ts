import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, clientIp } from "./rateLimit";

// This guards spend as much as abuse — the search path costs real money per
// call, so an off-by-one here is a billing bug.

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows exactly `limit` calls then blocks", () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).ok, `call ${i + 1} of 5`).toBe(true);
    }
    expect(rateLimit(key, 5, 60_000).ok).toBe(false);
  });

  it("keeps separate budgets per key", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    // b must be untouched by a's exhaustion.
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it("frees the budget once the window slides past", () => {
    const key = `w-${Math.random()}`;
    expect(rateLimit(key, 1, 60_000).ok).toBe(true);
    expect(rateLimit(key, 1, 60_000).ok).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(rateLimit(key, 1, 60_000).ok).toBe(true);
  });

  it("reports a positive retryAfter when blocked", () => {
    const key = `r-${Math.random()}`;
    rateLimit(key, 1, 60_000);
    const blocked = rateLimit(key, 1, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });
});

describe("clientIp", () => {
  it("prefers Netlify's header", () => {
    const h = new Headers({
      "x-nf-client-connection-ip": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9",
    });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("takes the first hop of x-forwarded-for", () => {
    // The rest of the chain is proxy-controlled and trivially spoofed.
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.9.9.9" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("falls back to a constant rather than throwing", () => {
    expect(clientIp(new Headers())).toBe("anon");
  });
});
