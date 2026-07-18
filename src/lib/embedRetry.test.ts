/**
 * @vitest-environment node
 *
 * ai.ts is server-only and the Anthropic SDK refuses to construct in a
 * browser-like environment, so this file opts out of the default jsdom.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Exercises the retry/backoff in embedQuery through the real module. A single
// Voyage 429 used to drop the whole search to the non-AI keyword fallback, so
// this is the difference between a blip and every result quietly getting worse.

const ORIGINAL_KEY = process.env.VOYAGE_API_KEY;

function jsonResponse(embedding: number[]) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ data: [{ embedding }] }),
  } as unknown as Response;
}

function errorResponse(status: number, retryAfter?: string) {
  return {
    ok: false,
    status,
    headers: new Headers(retryAfter ? { "retry-after": retryAfter } : {}),
    text: async () => "rate limited",
    json: async () => ({}),
  } as unknown as Response;
}

describe("embedQuery retry", () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = "test-key";
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.VOYAGE_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("recovers from a 429 instead of failing the search", async () => {
    const embedding = Array(1024).fill(0.1);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(429, "0"))
      .mockResolvedValueOnce(jsonResponse(embedding));
    vi.stubGlobal("fetch", fetchMock);

    const { quickSearchEmbedForTest } = await import("./ai");
    const result = await quickSearchEmbedForTest("a summer garden party");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1024);
  });

  it("retries 5xx too", async () => {
    const embedding = Array(1024).fill(0.2);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(jsonResponse(embedding));
    vi.stubGlobal("fetch", fetchMock);

    const { quickSearchEmbedForTest } = await import("./ai");
    await expect(quickSearchEmbedForTest("bbq for 40")).resolves.toHaveLength(1024);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails fast on a 401 rather than burning retries on a bad key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401));
    vi.stubGlobal("fetch", fetchMock);

    const { quickSearchEmbedForTest } = await import("./ai");
    await expect(quickSearchEmbedForTest("tacos")).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt budget and surfaces the error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(429, "0"));
    vi.stubGlobal("fetch", fetchMock);

    const { quickSearchEmbedForTest } = await import("./ai");
    await expect(quickSearchEmbedForTest("coffee cart")).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("serves a repeated query from cache without calling the API again", async () => {
    const embedding = Array(1024).fill(0.3);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(embedding));
    vi.stubGlobal("fetch", fetchMock);

    const { quickSearchEmbedForTest } = await import("./ai");
    await quickSearchEmbedForTest("identical brief");
    await quickSearchEmbedForTest("identical brief");

    // Second call is free — fewer paid calls and less rate-limit pressure.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
