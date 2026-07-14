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

  const vendorId = typeof body.vendorId === "string" ? body.vendorId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const postcode = typeof body.postcode === "string" ? body.postcode.trim() : "";
  const eventDate = typeof body.eventDate === "string" && body.eventDate ? body.eventDate : null;
  const guestsRaw = body.guests;
  const guests = typeof guestsRaw === "number" || typeof guestsRaw === "string"
    ? parseInt(String(guestsRaw), 10)
    : NaN;

  if (!vendorId || !name || !email || !message) {
    return Response.json({ error: "Please fill in your name, email, and a message." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Confirm the vendor is real + live (also fetches the address we notify).
  const { data: vendor, error: vendorErr } = await supabase
    .from("vendors")
    .select("id, name, contact_email")
    .eq("id", vendorId)
    .eq("status", "live")
    .maybeSingle();

  if (vendorErr || !vendor) {
    return Response.json({ error: "We couldn't find that vendor." }, { status: 404 });
  }

  // Persist the lead. No .select() back — the RLS insert policy allows the write
  // but there is (intentionally) no anon SELECT policy on enquiries.
  const { error: insertErr } = await supabase.from("enquiries").insert({
    vendor_id: vendorId,
    parent_name: name.slice(0, 200),
    parent_email: email.slice(0, 320),
    parent_phone: phone ? phone.slice(0, 30) : null,
    party_date: eventDate,
    guest_count: Number.isFinite(guests) && guests > 0 ? guests : null,
    party_postcode: postcode ? postcode.slice(0, 10) : null,
    message: message.slice(0, 2000),
    status: "sent",
  });

  if (insertErr) {
    console.error("[enquiry] insert failed:", insertErr);
    return Response.json({ error: "Something went wrong sending your enquiry. Please try again." }, { status: 500 });
  }

  const emailResult = await sendVendorEnquiryEmail({
    to: vendor.contact_email,
    vendorName: vendor.name,
    buyerName: name,
    buyerEmail: email,
    buyerPhone: phone,
    eventDate,
    guests: Number.isFinite(guests) && guests > 0 ? guests : null,
    postcode,
    message,
  });

  return Response.json({ ok: true, emailed: emailResult.sent });
}
