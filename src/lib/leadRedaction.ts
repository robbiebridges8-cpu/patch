import type { Lead } from "@/app/vendor/dashboard/LeadRow";

/**
 * Server-side redaction for the free-tier lead paywall. This is the paywall:
 * props passed to a client component are serialised into the RSC payload, so
 * anything NOT stripped here ships to the browser whether it's painted or not.
 * A paywall you can defeat with view-source is not a paywall — hence a pure,
 * tested function rather than conditional rendering.
 *
 * Withheld: name, email, phone, and the message body. Kept: event date, area,
 * status, timestamps, and a word count that proves the message is substantial
 * without disclosing it.
 */
export function redactLead(lead: Lead, locked: boolean): Lead {
  if (!locked) return lead;
  return {
    id: lead.id,
    buyer_name: null,
    buyer_email: null,
    buyer_phone: null,
    event_date: lead.event_date,
    postcode: lead.postcode,
    details: lead.details,
    message: null,
    messageWords: lead.message ? lead.message.trim().split(/\s+/).filter(Boolean).length : 0,
    status: lead.status,
    created_at: lead.created_at,
  };
}
