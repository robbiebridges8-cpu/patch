import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  captureException,
  captureMessage,
  addBreadcrumb,
  registerMonitoring,
  currentProvider,
  __resetMonitoring,
  type MonitoringProvider,
} from "./monitoring";

function fakeProvider(): MonitoringProvider & {
  exceptions: { error: unknown; context?: Record<string, unknown> }[];
} {
  const exceptions: { error: unknown; context?: Record<string, unknown> }[] = [];
  return {
    name: "fake",
    exceptions,
    captureException(error, context) {
      exceptions.push({ error, context: context as Record<string, unknown> });
    },
    captureMessage() {},
    addBreadcrumb() {},
  };
}

describe("monitoring", () => {
  beforeEach(() => {
    __resetMonitoring();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    __resetMonitoring();
    vi.restoreAllMocks();
  });

  it("falls back to the console when no provider is attached", () => {
    captureException(new Error("boom"), { scope: "test" });
    expect(console.error).toHaveBeenCalled();
    expect(currentProvider()).toBeNull();
  });

  it("routes to a registered provider", () => {
    const p = fakeProvider();
    registerMonitoring(p);
    const err = new Error("boom");
    captureException(err, { scope: "api/enquiry" });

    expect(currentProvider()).toBe("fake");
    expect(p.exceptions).toHaveLength(1);
    expect(p.exceptions[0].error).toBe(err);
  });

  // This is a security property, not a nicety: error context is built from
  // request payloads, and a leaked email or token is a breach.
  it("redacts sensitive keys before they leave the process", () => {
    const p = fakeProvider();
    registerMonitoring(p);

    captureException(new Error("x"), {
      scope: "test",
      extra: {
        email: "buyer@example.com",
        password: "hunter2",
        token: "abc123",
        API_KEY: "sk-live-xyz",
        Authorization: "Bearer xyz",
        phone: "07700900000",
        vendorCount: 3,
        slug: "taco-loco",
      },
    });

    const extra = (p.exceptions[0].context as { extra: Record<string, unknown> }).extra;
    for (const key of ["email", "password", "token", "API_KEY", "Authorization", "phone"]) {
      expect(extra[key], `${key} must be redacted`).toBe("[redacted]");
    }
    // Non-sensitive context must survive, or the report is useless.
    expect(extra.vendorCount).toBe(3);
    expect(extra.slug).toBe("taco-loco");
  });

  it("redacts case-insensitively and across naming styles", () => {
    const p = fakeProvider();
    registerMonitoring(p);
    captureException(new Error("x"), {
      extra: { EMAIL: "a@b.c", "api-key": "k", api_key: "k2", Secret: "s" },
    });
    const extra = (p.exceptions[0].context as { extra: Record<string, unknown> }).extra;
    expect(Object.values(extra).every((v) => v === "[redacted]")).toBe(true);
  });

  it("never lets a throwing provider take down the caller", () => {
    registerMonitoring({
      name: "broken",
      captureException() {
        throw new Error("provider exploded");
      },
    });
    expect(() => captureException(new Error("original"))).not.toThrow();
    expect(() => captureMessage("hi")).not.toThrow();
    expect(() => addBreadcrumb("crumb")).not.toThrow();
  });
});
