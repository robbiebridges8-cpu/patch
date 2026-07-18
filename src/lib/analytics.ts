/**
 * Provider-agnostic product analytics.
 *
 * Nothing here talks to a vendor SDK. The app calls `track(...)` with a typed
 * event; a provider is attached at runtime if one is configured. That keeps the
 * choice of Plausible/PostHog/Segment out of every call site, and means the app
 * behaves identically with no provider at all — which is the current state.
 *
 * This is distinct from src/lib/track.ts, which writes vendor-facing traffic
 * counts to our own database. That one is a product feature vendors see; this
 * one is instrumentation for us.
 */

export type AnalyticsEvent =
  | { name: "search_performed"; query: string; results: number; relaxed: string[] }
  | { name: "search_no_results"; query: string }
  | { name: "search_load_more"; shown: number }
  | { name: "vendor_viewed"; vendorId: string; slug: string }
  | { name: "vendor_quick_viewed"; vendorId: string }
  | { name: "shortlist_added"; vendorId: string; size: number }
  | { name: "shortlist_removed"; vendorId: string; size: number }
  | { name: "enquiry_started"; vendorId: string; batch: number }
  | { name: "enquiry_sent"; vendorIds: string[]; batch: number }
  | { name: "message_sent"; side: "buyer" | "vendor" }
  | { name: "review_submitted"; rating: number }
  | { name: "vendor_signup_started" }
  | { name: "vendor_listing_published"; vendorId: string };

export interface AnalyticsProvider {
  name: string;
  capture(event: string, properties: Record<string, unknown>): void;
  identify?(id: string, traits?: Record<string, unknown>): void;
}

let provider: AnalyticsProvider | null = null;
/** Events fired before a provider attaches; replayed on registration. */
const buffer: { event: string; properties: Record<string, unknown> }[] = [];
const MAX_BUFFER = 50;

export function registerAnalytics(p: AnalyticsProvider): void {
  provider = p;
  const pending = buffer.splice(0, buffer.length);
  for (const item of pending) {
    try {
      p.capture(item.event, item.properties);
    } catch {
      // A broken provider must never take the app with it.
    }
  }
}

export function track(event: AnalyticsEvent): void {
  const { name, ...properties } = event;

  if (!provider) {
    // Buffer rather than drop — analytics usually attaches after first paint.
    if (buffer.length < MAX_BUFFER) buffer.push({ event: name, properties });
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", name, properties);
    }
    return;
  }

  try {
    provider.capture(name, properties);
  } catch (err) {
    console.error("[analytics] provider threw:", err);
  }
}

export function identify(id: string, traits?: Record<string, unknown>): void {
  try {
    provider?.identify?.(id, traits);
  } catch (err) {
    console.error("[analytics] identify threw:", err);
  }
}

/** Test seam. */
export function __resetAnalytics(): void {
  provider = null;
  buffer.length = 0;
}

export function currentProvider(): string | null {
  return provider?.name ?? null;
}
