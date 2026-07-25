import { supabase } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";
import { sendThreadMessageEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { captureException } from "@/lib/monitoring";

// Buyer side of in-platform messaging. Buyers have no account, so the enquiry
// id they hold locally is their capability token — the same model the
// /enquiries tracker already uses. Both operations go through SECURITY DEFINER
// functions; anon has no direct grant on public.messages.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const enquiryId = new URL(request.url).searchParams.get("enquiryId") || "";
  if (!UUID_RE.test(enquiryId)) {
    return Response.json({ error: "Unknown enquiry." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("enquiry_thread", { p_enquiry_id: enquiryId });
  if (error) {
    captureException(error, { scope: "api/messages#read", severity: "error" });
    return Response.json({ error: "Couldn't load this conversation." }, { status: 500 });
  }
  return Response.json({ messages: data ?? [] });
}

export async function POST(request: Request) {
  const rl = await rateLimit(`msg:${clientIp(request.headers)}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `Too many messages in a short time — please wait ${rl.retryAfter}s and try again.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const enquiryId = typeof body.enquiryId === "string" ? body.enquiryId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!UUID_RE.test(enquiryId)) {
    return Response.json({ error: "Unknown enquiry." }, { status: 400 });
  }
  if (!text) {
    return Response.json({ error: "Write a message first." }, { status: 400 });
  }

  const { error } = await supabase.rpc("send_buyer_message", {
    p_enquiry_id: enquiryId,
    p_body: text.slice(0, 4000),
  });
  if (error) {
    captureException(error, { scope: "api/messages", severity: "error" });
    return Response.json({ error: "Couldn't send your message. Please try again." }, { status: 500 });
  }

  // Best-effort vendor notification. Needs the service role to read the
  // enquiry (anon has no SELECT on it); silently skipped if the key is unset.
  const service = createServiceClient();
  if (service) {
    const { data: enq } = await service
      .from("enquiries")
      .select("buyer_name, vendors(name, slug, contact_email)")
      .eq("id", enquiryId)
      .maybeSingle();

    const vendor = enq?.vendors as unknown as { contact_email: string | null } | null;
    if (vendor) {
      const site = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
      await sendThreadMessageEmail({
        to: vendor.contact_email,
        fromName: (enq?.buyer_name as string) || "A client",
        threadUrl: `${site}/vendor/dashboard`,
        body: text,
      });
    }
  }

  return Response.json({ ok: true });
}
