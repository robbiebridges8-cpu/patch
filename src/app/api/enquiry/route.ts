import { supabase } from "@/lib/supabase";
import { sendVendorEnquiryEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { captureException } from "@/lib/monitoring";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  const rl = rateLimit(`enq:${clientIp(request.headers)}`, 8, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: `Too many enquiries in a short time — please wait ${rl.retryAfter}s and try again.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Accept a single vendorId or a list (batch enquiry from the shortlist).
  const ids: string[] = Array.isArray(body.vendorIds)
    ? (body.vendorIds as unknown[]).filter((v): v is string => typeof v === "string")
    : typeof body.vendorId === "string"
      ? [body.vendorId]
      : [];

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const postcode = typeof body.postcode === "string" ? body.postcode.trim() : "";
  const eventDate = typeof body.eventDate === "string" && body.eventDate ? body.eventDate : null;
  const guests = typeof body.guests === "number" || typeof body.guests === "string"
    ? parseInt(String(body.guests), 10)
    : NaN;

  if (ids.length === 0 || !name || !email || !message) {
    return Response.json({ error: "Please fill in your name, email, and a message." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Confirm the vendors are real + live.
  const { data: vendors, error: vendorErr } = await supabase
    .from("vendors")
    .select("id, name, slug, contact_email")
    .in("id", ids)
    .eq("status", "live");

  if (vendorErr || !vendors || vendors.length === 0) {
    return Response.json({ error: "We couldn't find those vendors." }, { status: 404 });
  }

  const guestCount = Number.isFinite(guests) && guests > 0 ? guests : null;

  // Generate ids client-side of the DB so we can return them for buyer tracking
  // (anon has no SELECT on enquiries, so we can't read them back).
  const records = vendors.map((v) => ({
    enquiryId: crypto.randomUUID(),
    vendorName: v.name as string,
    vendorSlug: v.slug as string,
  }));

  const rows = vendors.map((v, i) => ({
    id: records[i].enquiryId,
    vendor_id: v.id,
    parent_name: name.slice(0, 200),
    parent_email: email.slice(0, 320),
    parent_phone: phone ? phone.slice(0, 30) : null,
    event_date: eventDate,
    postcode: postcode ? postcode.slice(0, 10) : null,
    // Vertical-specific extras live here, not as columns. A plumber enquiry
    // has no guest count; a caterer's does.
    details: guestCount ? { guest_count: guestCount } : {},
    message: message.slice(0, 2000),
    status: "sent" as const,
  }));

  const { error: insertErr } = await supabase.from("enquiries").insert(rows);
  if (insertErr) {
    // A dropped enquiry is lost revenue for a vendor and a dead end for a
    // buyer — the single most important failure on the site to hear about.
    captureException(insertErr, {
      scope: "api/enquiry",
      severity: "fatal",
      extra: { vendorCount: vendors.length },
    });
    return Response.json({ error: "Something went wrong sending your enquiry. Please try again." }, { status: 500 });
  }

  // Log the conversion for vendor analytics. Best-effort: a failure here must
  // not fail an enquiry that's already been persisted.
  const { error: eventErr } = await supabase.from("contact_events").insert(
    vendors.map((v, i) => ({
      vendor_id: v.id,
      enquiry_id: records[i].enquiryId,
      event_type: "enquiry_sent" as const,
      session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
    })),
  );
  if (eventErr) console.error("[enquiry] contact_event insert failed:", eventErr.message);

  // Best-effort email to each vendor (no-ops without RESEND_API_KEY).
  const results = await Promise.all(
    vendors.map((v) =>
      sendVendorEnquiryEmail({
        to: v.contact_email,
        vendorName: v.name,
        buyerName: name,
        buyerEmail: email,
        buyerPhone: phone,
        eventDate,
        guests: guestCount,
        postcode,
        message,
      }),
    ),
  );

  return Response.json({
    ok: true,
    sent: vendors.length,
    emailed: results.filter((r) => r.sent).length,
    records,
  });
}
