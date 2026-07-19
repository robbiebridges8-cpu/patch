import { createClient } from "@/lib/supabase/server";

/**
 * Register or remove a device for lead notifications.
 *
 * Authorisation is RLS: the insert policy pins vendor_id to a listing the
 * caller owns, so a forged vendor id simply fails. The route re-checks the
 * session first only to return a clean 401 rather than an opaque RLS error.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors").select("id").eq("owner_id", user.id).maybeSingle();
  if (!vendor) return Response.json({ error: "No listing to notify about." }, { status: 400 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Incomplete subscription." }, { status: 400 });
  }

  // A browser re-subscribing returns the same endpoint, so upsert rather than
  // accumulating duplicates for the same device.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      vendor_id: vendor.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("[push] subscribe failed:", error.message);
    return Response.json({ error: "Couldn't enable notifications." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  let endpoint: string | undefined;
  try {
    endpoint = (await request.json()).endpoint;
  } catch { /* fall through */ }
  if (!endpoint) return Response.json({ error: "Invalid request." }, { status: 400 });

  // RLS scopes the delete to the caller's own listing.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return Response.json({ error: "Couldn't turn notifications off." }, { status: 500 });
  return Response.json({ ok: true });
}
