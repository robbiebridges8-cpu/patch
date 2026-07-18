import { supabase } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Buyer-side event logging. Fired from the client rather than during SSR so we
// count people, not prefetches and crawlers. anon is insert-only on
// contact_events, so a caller can write events but never read anyone's traffic.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED = new Set([
  "profile_view",
  "click_contact",
  "reveal_phone",
  "visit_website",
  "share",
  "save",
]);

export async function POST(request: Request) {
  // Generous: a browsing session legitimately fires several of these.
  const rl = await rateLimit(`track:${clientIp(request.headers)}`, 60, 60_000);
  if (!rl.ok) return new Response(null, { status: 204 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
  const event = typeof body.event === "string" ? body.event : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;

  // Analytics must never break a page — every rejection is a silent 204.
  if (!UUID_RE.test(vendorId) || !ALLOWED.has(event)) {
    return new Response(null, { status: 204 });
  }

  const { error } = await supabase.from("contact_events").insert({
    vendor_id: vendorId,
    event_type: event,
    session_id: sessionId,
  });
  if (error) console.error("[track] insert failed:", error.message);

  return new Response(null, { status: 204 });
}
