import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  track,
  identify,
  registerAnalytics,
  currentProvider,
  __resetAnalytics,
  type AnalyticsProvider,
} from "./analytics";

function fakeProvider() {
  const captured: { event: string; properties: Record<string, unknown> }[] = [];
  const provider: AnalyticsProvider = {
    name: "fake",
    capture(event, properties) {
      captured.push({ event, properties });
    },
  };
  return { provider, captured };
}

describe("analytics", () => {
  beforeEach(() => {
    __resetAnalytics();
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    __resetAnalytics();
    vi.restoreAllMocks();
  });

  it("is a no-op with no provider attached", () => {
    expect(currentProvider()).toBeNull();
    expect(() => track({ name: "search_no_results", query: "x" })).not.toThrow();
  });

  it("splits the event name from its properties", () => {
    const { provider, captured } = fakeProvider();
    registerAnalytics(provider);

    track({ name: "search_performed", query: "pizza", results: 12, relaxed: [] });

    expect(captured).toHaveLength(1);
    expect(captured[0].event).toBe("search_performed");
    expect(captured[0].properties).toEqual({ query: "pizza", results: 12, relaxed: [] });
    expect(captured[0].properties).not.toHaveProperty("name");
  });

  // Analytics almost always attaches after first paint, so events fired during
  // initial render would otherwise be silently lost — including the ones at the
  // very top of the funnel.
  it("buffers events fired before registration and replays them in order", () => {
    track({ name: "vendor_viewed", vendorId: "v1", slug: "a" });
    track({ name: "vendor_viewed", vendorId: "v2", slug: "b" });

    const { provider, captured } = fakeProvider();
    registerAnalytics(provider);

    expect(captured.map((c) => c.properties.vendorId)).toEqual(["v1", "v2"]);
  });

  it("does not replay the buffer twice", () => {
    track({ name: "vendor_signup_started" });

    const a = fakeProvider();
    registerAnalytics(a.provider);
    expect(a.captured).toHaveLength(1);

    const b = fakeProvider();
    registerAnalytics(b.provider);
    expect(b.captured).toHaveLength(0);
  });

  it("caps the buffer so a missing provider can't leak memory", () => {
    for (let i = 0; i < 200; i++) track({ name: "search_load_more", shown: i });

    const { provider, captured } = fakeProvider();
    registerAnalytics(provider);
    expect(captured.length).toBeLessThanOrEqual(50);
  });

  it("survives a provider that throws", () => {
    registerAnalytics({
      name: "broken",
      capture() {
        throw new Error("nope");
      },
    });
    expect(() => track({ name: "vendor_signup_started" })).not.toThrow();
    expect(() => identify("user-1")).not.toThrow();
  });

  it("tolerates a provider with no identify implementation", () => {
    const { provider } = fakeProvider();
    registerAnalytics(provider);
    expect(() => identify("user-1", { plan: "free" })).not.toThrow();
  });
});
