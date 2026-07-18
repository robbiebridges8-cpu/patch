import { supabase } from "./supabase";

/**
 * Rate limiting and the AI spend circuit breaker.
 *
 * Two layers, because they stop different things:
 *
 *  1. An in-process sliding window. Free, no round trip, and absorbs a flood
 *     from a single instance before it ever reaches the database.
 *  2. An atomic Postgres check. This is the authoritative one — serverless
 *     runs many instances and recycles them, so an in-memory counter alone
 *     barely limits anything under the load that actually matters.
 *
 * Layer 1 can only ever *deny* early; anything it allows is still checked by
 * layer 2. Postgres rather than Redis is deliberate: it's already in the
 * request path, it's transactional, and it adds no new vendor or key.
 */

const hits = new Map<string, number[]>();
let lastSweep = 0;

/** Cheap local pre-filter. Denies obvious floods without a round trip. */
function localCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => now - t < windowMs);
      if (kept.length) hits.set(k, kept);
      else hits.delete(k);
    }
  }

  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= limit;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

/**
 * Authoritative, cross-instance rate limit.
 *
 * Fails closed. If the database can't be reached we deny rather than allow —
 * every endpoint this guards either costs money per call or writes data, and
 * search can't function without that same database anyway.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.round(windowMs / 1000));

  if (!localCheck(key, limit, windowMs)) {
    return { ok: false, retryAfter: windowSeconds };
  }

  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rateLimit] check failed, denying:", error.message);
      return { ok: false, retryAfter: windowSeconds };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: false, retryAfter: windowSeconds };
    return { ok: !!row.allowed, retryAfter: row.retry_after ?? windowSeconds };
  } catch (err) {
    console.error("[rateLimit] threw, denying:", err);
    return { ok: false, retryAfter: windowSeconds };
  }
}

/**
 * Platform-wide daily cap on AI-backed searches.
 *
 * Rate limiting bounds any single caller; this bounds everyone at once. A
 * distributed attack, a runaway loop, or genuine viral traffic cannot spend
 * more in a day than we've decided we're willing to lose. Over the cap, search
 * degrades to keyword matching rather than stopping — the buyer still gets
 * results, they're just not AI-ranked.
 */
export async function consumeAiBudget(units = 1): Promise<boolean> {
  const cap = Number(process.env.AI_DAILY_SEARCH_CAP || 20_000);
  if (!Number.isFinite(cap) || cap <= 0) return true;

  try {
    const { data, error } = await supabase.rpc("consume_ai_budget", {
      p_units: units,
      p_daily_cap: cap,
    });
    if (error) {
      // Availability over thrift: a broken meter shouldn't take search down,
      // and the per-caller limiter above is still enforcing.
      console.error("[aiBudget] check failed, allowing:", error.message);
      return true;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      console.warn(`[aiBudget] daily cap reached (${row.used}/${row.cap}) — degrading to keyword search`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[aiBudget] threw, allowing:", err);
    return true;
  }
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "anon"
  );
}
