/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The limiter guards endpoints that cost real money per call, so the two
// properties worth pinning are: it denies when the store says so, and it
// denies when the store is unreachable. Failing open here is a billing bug.

const rpc = vi.fn();
vi.mock("./supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

async function fresh() {
  vi.resetModules();
  return import("./rateLimit");
}

describe("rateLimit", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("allows when the authoritative check allows", async () => {
    const { rateLimit } = await fresh();
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });
    await expect(rateLimit(`k${Math.random()}`, 5, 60_000)).resolves.toEqual({ ok: true, retryAfter: 0 });
  });

  it("denies when the authoritative check denies, and surfaces retry_after", async () => {
    const { rateLimit } = await fresh();
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 42 }], error: null });
    await expect(rateLimit(`k${Math.random()}`, 5, 60_000)).resolves.toEqual({ ok: false, retryAfter: 42 });
  });

  // The whole point of the rewrite: an in-memory counter is per-instance, so
  // the database is the source of truth. If it's unreachable we must not spend.
  it("fails CLOSED when the store errors", async () => {
    const { rateLimit } = await fresh();
    rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const r = await rateLimit(`k${Math.random()}`, 5, 60_000);
    expect(r.ok).toBe(false);
  });

  it("fails CLOSED when the store throws", async () => {
    const { rateLimit } = await fresh();
    rpc.mockRejectedValue(new Error("network down"));
    const r = await rateLimit(`k${Math.random()}`, 5, 60_000);
    expect(r.ok).toBe(false);
  });

  it("fails CLOSED on an empty response rather than assuming success", async () => {
    const { rateLimit } = await fresh();
    rpc.mockResolvedValue({ data: [], error: null });
    expect((await rateLimit(`k${Math.random()}`, 5, 60_000)).ok).toBe(false);
  });

  // Layer 1: absorbs a flood without a round trip. It may only ever deny early.
  it("short-circuits a local flood without hitting the store", async () => {
    const { rateLimit } = await fresh();
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });
    const key = `flood${Math.random()}`;
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 60_000);
    const callsBefore = rpc.mock.calls.length;

    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(rpc.mock.calls.length, "should not have consulted the store").toBe(callsBefore);
  });

  it("keeps separate budgets per key", async () => {
    const { rateLimit } = await fresh();
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });
    const a = `a${Math.random()}`;
    const b = `b${Math.random()}`;
    for (let i = 0; i < 3; i++) await rateLimit(a, 3, 60_000);
    expect((await rateLimit(a, 3, 60_000)).ok).toBe(false);
    expect((await rateLimit(b, 3, 60_000)).ok).toBe(true);
  });
});

describe("consumeAiBudget", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("allows under the cap and blocks over it", async () => {
    const { consumeAiBudget } = await fresh();
    rpc.mockResolvedValue({ data: [{ allowed: true, used: 5, cap: 100 }], error: null });
    await expect(consumeAiBudget()).resolves.toBe(true);

    rpc.mockResolvedValue({ data: [{ allowed: false, used: 101, cap: 100 }], error: null });
    await expect(consumeAiBudget()).resolves.toBe(false);
  });

  // Deliberately the opposite of the limiter: a broken meter must not take
  // search down, and the per-caller limiter is still enforcing.
  it("fails OPEN when the meter errors", async () => {
    const { consumeAiBudget } = await fresh();
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(consumeAiBudget()).resolves.toBe(true);
    rpc.mockRejectedValue(new Error("boom"));
    await expect(consumeAiBudget()).resolves.toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers Netlify's header", async () => {
    const { clientIp } = await fresh();
    expect(clientIp(new Headers({
      "x-nf-client-connection-ip": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9",
    }))).toBe("1.2.3.4");
  });

  it("takes the first hop of x-forwarded-for", async () => {
    const { clientIp } = await fresh();
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to a constant rather than throwing", async () => {
    const { clientIp } = await fresh();
    expect(clientIp(new Headers())).toBe("anon");
  });
});
