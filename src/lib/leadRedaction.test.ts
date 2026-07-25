import { describe, it, expect } from "vitest";
import { redactLead } from "./leadRedaction";
import type { Lead } from "@/app/vendor/dashboard/LeadRow";

const raw: Lead = {
  id: "e1",
  buyer_name: "Jo Bloggs",
  buyer_email: "jo@example.com",
  buyer_phone: "07700 900000",
  event_date: "2026-09-01",
  postcode: "E8",
  details: { guest_count: 40 },
  message: "We need catering for forty people in August",
  status: "sent",
  created_at: "2026-07-25T00:00:00Z",
};

describe("redactLead", () => {
  it("returns the lead untouched when unlocked", () => {
    expect(redactLead(raw, false)).toBe(raw);
  });

  it("strips every piece of contact info when locked", () => {
    const r = redactLead(raw, true);
    expect(r.buyer_name).toBeNull();
    expect(r.buyer_email).toBeNull();
    expect(r.buyer_phone).toBeNull();
    expect(r.message).toBeNull();
  });

  it("keeps the non-identifying proof fields when locked", () => {
    const r = redactLead(raw, true);
    expect(r.event_date).toBe("2026-09-01");
    expect(r.postcode).toBe("E8");
    expect(r.status).toBe("sent");
    expect(r.created_at).toBe(raw.created_at);
    expect(r.details).toEqual({ guest_count: 40 });
  });

  it("exposes a word count but never the words", () => {
    const r = redactLead(raw, true);
    expect(r.messageWords).toBe(8);
    expect(JSON.stringify(r)).not.toContain("catering");
  });

  it("handles an empty message as zero words", () => {
    expect(redactLead({ ...raw, message: null }, true).messageWords).toBe(0);
    expect(redactLead({ ...raw, message: "   " }, true).messageWords).toBe(0);
  });
});
