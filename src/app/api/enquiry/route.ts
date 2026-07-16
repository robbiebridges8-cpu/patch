import { supabase } from "@/lib/supabase";
import { sendVendorEnquiryEmail } from "@/lib/email";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
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
    .select("id, name, contact_email")
    .in("id", ids)
    .eq("status", "live");

  if (vendorErr || !vendors || vendors.length === 0) {
    return Response.json({ error: "We couldn't find those vendors." }, { status: 404 });
  }

  const guestCount = Number.isFinite(guests) && guests > 0 ? guests : null;

  const rows = vendors.map((v) => ({
    vendor_id: v.id,
    parent_name: name.slice(0, 200),
    parent_email: email.slice(0, 320),
    parent_phone: phone ? phone.slice(0, 30) : null,
    party_date: eventDate,
    guest_count: guestCount,
    party_postcode: postcode ? postcode.slice(0, 10) : null,
    message: message.slice(0, 2000),
    status: "sent" as const,
  }));

  const { error: insertErr } = await supabase.from("enquiries").insert(rows);
  if (insertErr) {
    console.error("[enquiry] insert failed:", insertErr);
    return Response.json({ error: "Something went wrong sending your enquiry. Please try again." }, { status: 500 });
  }

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
  });
}
