// Transactional email via Resend. Degrades gracefully: if RESEND_API_KEY is not
// set, the enquiry is still persisted — we just log that the email was skipped.

export interface EnquiryEmailData {
  to: string | null;
  vendorName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string | null;
  eventDate?: string | null;
  guests?: number | null;
  postcode?: string | null;
  message: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export interface ThreadEmailData {
  to: string | null;
  /** Who wrote it, as the recipient should see it. */
  fromName: string;
  /** Where the recipient goes to reply in-platform. */
  threadUrl: string;
  body: string;
}

/**
 * Nudge for a new in-platform message. The reply happens in Patch (not by
 * email), so this is a notification with a deep link, not a conversation.
 */
export async function sendThreadMessageEmail(
  d: ThreadEmailData,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL || "Patch <enquiries@patch.london>";

  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — message stored, notification skipped");
    return { sent: false, reason: "no_api_key" };
  }
  if (!d.to) return { sent: false, reason: "no_recipient" };

  const preview = d.body.length > 600 ? `${d.body.slice(0, 600)}…` : d.body;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2b2620">
      <h2 style="font-size:20px;margin:0 0 4px">New message from ${esc(d.fromName)}</h2>
      <p style="color:#7a736a;margin:0 0 20px">You have a reply on your Patch enquiry.</p>
      <div style="background:#faf7f2;border:1px solid #e7e0d6;border-radius:12px;padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(preview)}</div>
      <p style="margin:24px 0 0">
        <a href="${esc(d.threadUrl)}" style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Read and reply</a>
      </p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [d.to],
        subject: `New message from ${d.fromName} on Patch`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend failed", res.status, await res.text());
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend threw", err);
    return { sent: false, reason: "exception" };
  }
}

export async function sendVendorEnquiryEmail(
  d: EnquiryEmailData,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL || "Patch <enquiries@patch.london>";

  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — enquiry stored, vendor email skipped");
    return { sent: false, reason: "no_api_key" };
  }
  if (!d.to) return { sent: false, reason: "no_recipient" };

  const rows = [
    ["Name", d.buyerName],
    ["Email", d.buyerEmail],
    ["Phone", d.buyerPhone || "—"],
    ["Event date", d.eventDate || "Not specified"],
    ["Guests", d.guests ? String(d.guests) : "Not specified"],
    ["Postcode", d.postcode || "Not specified"],
  ]
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7a736a">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`)
    .join("");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2b2620">
      <h2 style="font-size:20px;margin:0 0 4px">New enquiry via Patch</h2>
      <p style="color:#7a736a;margin:0 0 20px">For <strong>${esc(d.vendorName)}</strong></p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">${rows}</table>
      <div style="background:#faf7f2;border:1px solid #e7e0d6;border-radius:12px;padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(d.message)}</div>
      <p style="color:#9a9186;font-size:13px;margin-top:20px">Reply directly to this email to reach ${esc(d.buyerName)}.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [d.to],
        reply_to: d.buyerEmail,
        subject: `New Patch enquiry from ${d.buyerName}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend failed", res.status, await res.text());
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend threw", err);
    return { sent: false, reason: "exception" };
  }
}

export interface BookingReviewData {
  to: string;
  buyerName: string | null;
  vendorName: string;
  vendorSlug: string;
  enquiryId: string;
}

/**
 * Sent when a vendor marks a booking confirmed. Invites the buyer to review —
 * the passive "notice it next time you visit /enquiries" path misses most
 * reviews, and reviews are the platform's trust moat. No-ops without a key.
 */
export async function sendBookingReviewEmail(
  d: BookingReviewData,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL || "Patch <enquiries@patch.london>";
  if (!key) return { sent: false, reason: "no_api_key" };
  if (!d.to) return { sent: false, reason: "no_recipient" };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
  const link = `${site}/review/${encodeURIComponent(d.enquiryId)}?v=${encodeURIComponent(d.vendorSlug)}`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2b2620">
      <h2 style="font-size:20px;margin:0 0 12px">How was ${esc(d.vendorName)}?</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Hi ${esc(d.buyerName || "there")}, your booking with <strong>${esc(d.vendorName)}</strong> is confirmed. When it's done, a short review helps other people book with confidence.</p>
      <a href="${link}" style="display:inline-block;background:#e8563f;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Leave a review</a>
      <p style="color:#9a9186;font-size:13px;margin-top:20px">Only people who enquired through Patch can review, so ratings stay honest.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [d.to], subject: `How was ${d.vendorName}? Leave a review`, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend failed (booking review)", res.status, await res.text());
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend threw (booking review)", err);
    return { sent: false, reason: "exception" };
  }
}

export interface BuyerConfirmationData {
  to: string;
  buyerName: string;
  vendorNames: string[];
  message: string;
  eventDate: string | null;
  postcode: string;
}

/**
 * Confirms to the BUYER what they just sent, and to whom. Without this a buyer's
 * only record of an enquiry is a localStorage row — clearing the browser loses
 * it. This gives them a durable copy in their own inbox. No-ops without a key.
 */
export async function sendBuyerConfirmationEmail(
  d: BuyerConfirmationData,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL || "Patch <enquiries@patch.london>";

  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — buyer confirmation skipped");
    return { sent: false, reason: "no_api_key" };
  }
  if (!d.to) return { sent: false, reason: "no_recipient" };

  const vendors = d.vendorNames.map((n) => `<li style="margin:2px 0">${esc(n)}</li>`).join("");
  const meta = [
    d.eventDate ? `Event date: <strong>${esc(d.eventDate)}</strong>` : null,
    d.postcode ? `Area: <strong>${esc(d.postcode)}</strong>` : null,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2b2620">
      <h2 style="font-size:20px;margin:0 0 4px">Your enquiry is on its way</h2>
      <p style="color:#7a736a;margin:0 0 20px">Hi ${esc(d.buyerName)}, we've sent your brief to:</p>
      <ul style="font-size:15px;font-weight:600;padding-left:20px;margin:0 0 20px">${vendors}</ul>
      ${meta ? `<p style="color:#7a736a;font-size:14px;margin:0 0 16px">${meta}</p>` : ""}
      <div style="background:#faf7f2;border:1px solid #e7e0d6;border-radius:12px;padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(d.message)}</div>
      <p style="color:#9a9186;font-size:13px;margin-top:20px">Each will reply directly if it's a good fit. No account needed — just keep an eye on this inbox.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [d.to],
        subject: d.vendorNames.length > 1
          ? `Your Patch enquiry to ${d.vendorNames.length} vendors`
          : `Your Patch enquiry to ${d.vendorNames[0] ?? "a vendor"}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend failed (buyer confirmation)", res.status, await res.text());
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend threw (buyer confirmation)", err);
    return { sent: false, reason: "exception" };
  }
}

export interface LockedEnquiryEmailData {
  to: string | null;
  vendorName: string;
  vendorSlug: string;
  eventDate?: string | null;
  postcode?: string | null;
}

/**
 * A free listing has an enquiry waiting. Deliberately shows enough to prove the
 * lead is real — and specific — without giving away the contact details that
 * are the thing being paid for. The enquiry is stored either way, so upgrading
 * opens it rather than recovering it.
 */
export async function sendLockedEnquiryEmail(
  d: LockedEnquiryEmailData,
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ENQUIRY_FROM_EMAIL || "Patch <enquiries@patch.london>";

  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — locked-enquiry notice skipped");
    return { sent: false, reason: "no_api_key" };
  }
  if (!d.to) return { sent: false, reason: "no_recipient" };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
  const detail = [
    d.eventDate ? `Date: ${d.eventDate}` : null,
    d.postcode ? `Area: ${d.postcode}` : null,
  ].filter(Boolean).join(" · ");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#2b2620">
      <h2 style="font-size:20px;margin:0 0 4px">You have a new enquiry</h2>
      <p style="color:#7a736a;margin:0 0 20px">Someone wants to hire <strong>${esc(d.vendorName)}</strong>.</p>
      ${detail ? `<p style="font-size:15px;margin:0 0 16px">${esc(detail)}</p>` : ""}
      <div style="background:#faf7f2;border:1px solid #e7e0d6;border-radius:12px;padding:16px;font-size:15px;line-height:1.6;color:#9a9186">
        Their name, contact details and message are waiting on your dashboard.
      </div>
      <p style="margin:24px 0 0">
        <a href="${esc(site)}/vendor/dashboard" style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Open this enquiry</a>
      </p>
      <p style="color:#9a9186;font-size:13px;margin-top:20px">Free listings can see that an enquiry arrived. Upgrade to read and reply to it.</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [d.to], subject: `New enquiry for ${d.vendorName}`, html }),
    });
    if (!res.ok) {
      console.error("[email] Resend failed", res.status, await res.text());
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Resend threw", err);
    return { sent: false, reason: "exception" };
  }
}
