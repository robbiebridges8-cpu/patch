"use client";

// Buyer-side event logging. Deliberately fire-and-forget: analytics failing
// must never surface to a buyer or block a click.

const SESSION_KEY = "patch:sid";

/** Anonymous, per-tab-session id. Not a identifier for a person — just enough
 *  to stop one buyer refreshing a profile from reading as ten visitors. */
export function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return ""; // private mode / storage blocked
  }
}

export type TrackEvent =
  | "profile_view"
  | "click_contact"
  | "reveal_phone"
  | "visit_website"
  | "share"
  | "save";

export function track(vendorId: string, event: TrackEvent): void {
  if (typeof window === "undefined" || !vendorId) return;

  const payload = JSON.stringify({ vendorId, event, sessionId: sessionId() });

  // sendBeacon survives the page unloading, which matters for outbound clicks.
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch { /* fall through to fetch */ }

  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => { /* analytics must never break the page */ });
}

/** Fires an event at most once per session per vendor. */
export function trackOnce(vendorId: string, event: TrackEvent): void {
  if (typeof window === "undefined" || !vendorId) return;
  const key = `patch:tracked:${event}:${vendorId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked — the server still dedupes by session_id where it can.
  }
  track(vendorId, event);
}
