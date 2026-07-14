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
