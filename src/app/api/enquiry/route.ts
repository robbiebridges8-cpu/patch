import { supabase } from "@/lib/supabase";
import { sendVendorEnquiryEmail, sendLockedEnquiryEmail, sendBuyerConfirmationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { canAccess } from "@/lib/tiers";
import { sendPush, pushConfigured } from "@/lib/push";
import { createServiceClient } from "@/lib/supabase/service";
import { captureException } from "@/lib/monitoring";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  const rl = await rateLimit(`enq:${clientIp(request.headers)}`, 8, 60_000);
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
    .select("id, name, slug, contact_email, tier")
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
    buyer_name: name.slice(0, 200),
    buyer_email: email.slice(0, 320),
    buyer_phone: phone ? phone.slice(0, 30) : null,
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
  if (eventErr) captureException(eventErr, { scope: "api/enquiry", severity: "warning", extra: { step: "contact_event", vendorCount: vendors.length } });

  // Push the vendors who've installed the control panel. Best-effort and
  // strictly additive: the enquiry is already stored and the email still goes,
  // so a failure here costs a notification, not a lead.
  //
  // Reading push credentials needs the service role — they're secrets, and RLS
  // deliberately gives anon no access. Without that key this no-ops, exactly
  // like email does without RESEND_API_KEY.
  if (pushConfigured()) {
    const svc = createServiceClient();
    if (svc) {
      const { data: subs } = await svc
        .from("push_subscriptions")
        .select("id, vendor_id, endpoint, p256dh, auth")
        .in("vendor_id", vendors.map((v) => v.id));

      if (subs?.length) {
        const byVendor = new Map<string, typeof subs>();
        for (const sub of subs) {
          const list = byVendor.get(sub.vendor_id) ?? [];
          list.push(sub);
          byVendor.set(sub.vendor_id, list);
        }

        const expired: string[] = [];
        await Promise.all(
          vendors.map(async (v) => {
            const targets = byVendor.get(v.id as string);
            if (!targets?.length) return;
            // Free listings get told a lead exists, not who sent it — the same
            // line the locked inbox draws.
            const unlocked = canAccess(v.tier as number, "unlock_leads");
            const result = await sendPush(targets, {
              title: "New enquiry on Patch",
              body: unlocked
                ? `${name} — ${eventDate ? `${eventDate}, ` : ""}${postcode || "no area given"}`
                : "Someone wants to hire you. Open Patch to see who.",
              url: "/vendor/dashboard",
              tag: `lead-${v.id}`,
            });
            expired.push(...result.expired);
          }),
        );

        // Drop dead endpoints so a vendor who reinstalls doesn't accumulate
        // stale subscriptions that fail on every future send.
        if (expired.length) {
          await svc.from("push_subscriptions").delete().in("id", expired);
        }
      }
    }
  }

  // Best-effort email to each vendor (no-ops without RESEND_API_KEY).
  //
  // Free listings get a teaser, not the lead. The enquiry is still stored and
  // still answerable the moment they upgrade — nothing is thrown away, and the
  // buyer never hits a dead end. For an unclaimed listing this doubles as the
  // acquisition hook: "someone wants to hire you, claim your listing to reply."
  const results = await Promise.all(
    vendors.map((v) =>
      canAccess(v.tier as number, "unlock_leads")
        ? sendVendorEnquiryEmail({
            to: v.contact_email,
            vendorName: v.name,
            buyerName: name,
            buyerEmail: email,
            buyerPhone: phone,
            eventDate,
            guests: guestCount,
            postcode,
            message,
          })
        : sendLockedEnquiryEmail({
            to: v.contact_email,
            vendorName: v.name,
            vendorSlug: v.slug as string,
            eventDate,
            postcode,
          }),
    ),
  );

  // Confirm to the buyer what they sent — their durable record, independent of
  // localStorage. Best-effort: never fail an already-stored enquiry over it.
  await sendBuyerConfirmationEmail({
    to: email,
    buyerName: name,
    vendorNames: vendors.map((v) => v.name as string),
    message,
    eventDate,
    postcode,
  }).catch((err) => {
    captureException(err, { scope: "api/enquiry", severity: "warning", extra: { step: "buyer_confirmation" } });
    return { sent: false };
  });

  return Response.json({
    ok: true,
    sent: vendors.length,
    emailed: results.filter((r) => r.sent).length,
    records,
  });
}
