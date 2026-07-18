// Lightweight in-memory sliding-window rate limiter. Zero-dependency first line
// of defence against abuse and runaway AI/enquiry costs. Note: in serverless
// this is per-instance (not global) and resets on cold start — for strict
// global limits, back it with Upstash/Redis later. Good enough to stop a bot.

const hits = new Map<string, number[]>();
let lastSweep = 0;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => now - t < windowMs);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }

  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  return { ok: true, retryAfter: 0 };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "anon"
  );
}
