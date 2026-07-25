"use server";

import { createClient } from "@/lib/supabase/server";
import { reembedVendor } from "@/lib/embedding";
import { sendThreadMessageEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionState = { ok?: boolean; error?: string } | null;

function str(v: FormDataEntryValue | null, max: number): string | null {
  const s = (v ? String(v) : "").trim();
  return s ? s.slice(0, max) : null;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = v ? String(v).trim() : "";
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const sameArr = (a: unknown, b: string[]) =>
  JSON.stringify((Array.isArray(a) ? a : []).slice().sort()) === JSON.stringify(b.slice().sort());

export async function updateListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const id = String(formData.get("vendorId") || "");
  const name = str(formData.get("name"), 200);
  const category = str(formData.get("category"), 100);
  const description = str(formData.get("description"), 2000);
  const bio = str(formData.get("bio"), 5000);
  const dietary = formData.getAll("dietary").map(String).filter(Boolean);
  const vibeRaw = str(formData.get("vibe"), 500);
  const vibe = vibeRaw ? vibeRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12) : [];
  const capMin = num(formData.get("capacity_min"));
  const capMax = num(formData.get("capacity_max"));

  // Free-form "Label | Value" lines become attribute keys. Normalised to
  // lowercase snake_case so a hand-typed label matches a UI-set filter.
  const attrRaw = str(formData.get("attributes"), 2000);
  const extraAttrs: Record<string, unknown> = {};
  if (attrRaw) {
    for (const line of attrRaw.split("\n").slice(0, 30)) {
      const idx = line.indexOf("|");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const value = line.slice(idx + 1).trim();
      if (key && value) extraAttrs[key] = value;
    }
  }

  const attributes: Record<string, unknown> = { ...extraAttrs };
  if (dietary.length) attributes.dietary = dietary;
  if (vibe.length) attributes.vibe = vibe;
  if (capMin != null) attributes.capacity_min = capMin;
  if (capMax != null) attributes.capacity_max = capMax;
  const coverage = num(formData.get("coverage_radius_miles"));
  const sigRaw = str(formData.get("signature_items"), 1000);
  const signature = sigRaw ? sigRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) : [];
  const faqRaw = str(formData.get("faq"), 4000);
  const faq = faqRaw
    ? faqRaw.split("\n").map((line) => {
        const idx = line.indexOf("|");
        if (idx < 0) return null;
        const q = line.slice(0, idx).trim();
        const a = line.slice(idx + 1).trim();
        return q && a ? { q, a } : null;
      }).filter(Boolean).slice(0, 15)
    : [];

  if (!name) return { error: "Your business needs a name." };

  const { data: before } = await supabase
    .from("vendors")
    .select("name, primary_category, description, bio, attributes, signature_items")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!before) return { error: "We couldn't find your listing." };

  const { error } = await supabase
    .from("vendors")
    .update({
      name,
      primary_category: category,
      description,
      bio,
      contact_email: str(formData.get("contact_email"), 320),
      contact_phone: str(formData.get("contact_phone"), 30),
      website: str(formData.get("website"), 500),
      instagram: str(formData.get("instagram"), 100),
      coverage_radius_miles: coverage ?? 5,
      attributes,
      signature_items: signature,
      faq: faq.length ? faq : null,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Keep the service row (what search reads) in sync with the listing. Price
  // lives here now, not on the vendor.
  await supabase
    .from("vendor_services")
    .update({
      title: name,
      description,
      category,
      attributes,
      price_from: num(formData.get("price_from")),
      price_notes: str(formData.get("price_notes"), 500),
    })
    .eq("vendor_id", id);

  // Re-embed only when the searchable text actually changed (best-effort).
  const changed =
    before.name !== name ||
    before.primary_category !== category ||
    before.description !== description ||
    before.bio !== bio ||
    JSON.stringify(before.attributes ?? {}) !== JSON.stringify(attributes) ||
    !sameArr(
      (Array.isArray(before.signature_items) ? before.signature_items : []).map(String),
      signature,
    );
  if (changed) {
    const r = await reembedVendor(supabase, id);
    if (!r.ok) console.error("[reembed] failed for vendor", id, "-", r.error);
  }

  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

export async function claimListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const slug = String(formData.get("slug") || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!slug) return { error: "Enter your listing's web address." };

  // RLS "claim_unowned_vendor" only permits claiming rows where owner_id IS NULL.
  const { data, error } = await supabase
    .from("vendors")
    .update({ owner_id: user.id })
    .eq("slug", slug)
    .is("owner_id", null)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "No unclaimed listing found at that address — it may already be claimed. Contact hello@patch.london for help." };
  }
  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

const LEAD_STATUSES = ["sent", "viewed", "replied", "booked", "declined", "expired"] as const;

export async function setEnquiryStatus(enquiryId: string, status: string): Promise<ActionState> {
  if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    return { error: "Unknown status." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("enquiries")
    .update({
      status,
      responded_at: status === "replied" || status === "booked" ? new Date().toISOString() : null,
    })
    .eq("id", enquiryId);

  if (error) return { error: error.message };
  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

/**
 * Vendor replies in-platform. RLS ("owner_send_messages") is what actually
 * authorises this — it pins sender to 'vendor' and the thread to a listing the
 * caller owns, so a forged enquiryId just fails the insert.
 */
export async function sendVendorMessage(enquiryId: string, body: string): Promise<ActionState> {
  const text = body.trim().slice(0, 4000);
  if (!text) return { error: "Write a message first." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("messages")
    .insert({ enquiry_id: enquiryId, sender: "vendor", body: text, read_by_vendor: true });
  if (error) return { error: "Couldn't send that message. Please try again." };

  // Replying counts as responding to the lead.
  await supabase
    .from("enquiries")
    .update({ status: "replied", responded_at: new Date().toISOString() })
    .eq("id", enquiryId)
    .in("status", ["sent", "viewed"]);

  // Best-effort buyer notification.
  const { data: enq } = await supabase
    .from("enquiries")
    .select("buyer_email, vendor_id")
    .eq("id", enquiryId)
    .maybeSingle();
  if (enq?.buyer_email) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("name")
      .eq("id", enq.vendor_id as string)
      .maybeSingle();
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
    await sendThreadMessageEmail({
      to: enq.buyer_email as string,
      fromName: (vendor?.name as string) || "Your vendor",
      threadUrl: `${site}/enquiries`,
      body: text,
    });
  }

  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

export async function markThreadRead(enquiryId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase.rpc("mark_thread_read", { p_enquiry_id: enquiryId });
  if (error) return { error: error.message };
  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

/**
 * Resolve whatever the vendor typed into coordinates, an outward code and an
 * area name.
 *
 * The field asks for an area now ("Hackney") rather than insisting on a
 * postcode, so a postcode-only lookup would silently leave new listings without
 * coordinates — and a listing with no coordinates never appears in a location
 * search. Tries, in order: full postcode, outward code, then place name.
 */
async function resolveLocation(
  input: string,
): Promise<{ lat: number; lng: number; postcode: string | null; area: string | null } | null> {
  const raw = input.trim();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "").toUpperCase();

  // 1. Full postcode.
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`);
    if (res.ok) {
      const { result } = await res.json();
      if (result) {
        return {
          lat: result.latitude,
          lng: result.longitude,
          postcode: result.outcode ?? null,
          area: result.admin_district ?? null,
        };
      }
    }
  } catch { /* fall through */ }

  // 2. Outward code on its own ("E8"). Its centroid is reverse-geocoded because
  //    the outcode's own admin_district list is alphabetical, not by coverage —
  //    taking the first entry gives W2 -> Ealing, which is wrong.
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(compact)}`);
    if (res.ok) {
      const { result } = await res.json();
      if (result?.latitude != null) {
        const rev = await fetch(
          `https://api.postcodes.io/postcodes?lon=${result.longitude}&lat=${result.latitude}`,
        );
        const area = rev.ok ? (await rev.json()).result?.[0]?.admin_district ?? null : null;
        return { lat: result.latitude, lng: result.longitude, postcode: result.outcode, area };
      }
    }
  } catch { /* fall through */ }

  // 3. Place name ("Hackney", "Peckham"). Prefer a London match, then reverse
  //    geocode to get a canonical borough and outward code back.
  try {
    const res = await fetch(`https://api.postcodes.io/places?q=${encodeURIComponent(raw)}&limit=10`);
    if (res.ok) {
      const { result } = await res.json();
      if (result?.length) {
        const inLondon = result.find(
          (p: { latitude: number; longitude: number }) =>
            p.latitude >= 51.28 && p.latitude <= 51.7 && p.longitude >= -0.51 && p.longitude <= 0.33,
        );
        const best = inLondon || result[0];
        const rev = await fetch(
          `https://api.postcodes.io/postcodes?lon=${best.longitude}&lat=${best.latitude}`,
        );
        const nearest = rev.ok ? (await rev.json()).result?.[0] : null;
        return {
          lat: best.latitude,
          lng: best.longitude,
          postcode: nearest?.outcode ?? null,
          area: nearest?.admin_district ?? best.name_1 ?? null,
        };
      }
    }
  } catch { /* fall through */ }

  return null;
}

export async function createListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const name = str(formData.get("name"), 200);
  const category = str(formData.get("category"), 100);
  const description = str(formData.get("description"), 2000);
  const postcode = str(formData.get("postcode"), 20);
  if (!name) return { error: "Your business needs a name." };

  const loc = postcode ? await resolveLocation(postcode) : null;

  const { data: vendorId, error } = await supabase.rpc("create_vendor_listing", {
    p_name: name,
    p_category: category,
    p_description: description,
    p_postcode: loc?.postcode ?? postcode,
    p_lat: loc?.lat ?? null,
    p_lng: loc?.lng ?? null,
  });

  if (error) return { error: error.message };

  // Persist the resolved area so the listing reads "Hackney (E8)" rather than
  // echoing back whatever the vendor typed.
  if (typeof vendorId === "string" && loc?.area) {
    await supabase.from("vendors").update({ area: loc.area }).eq("id", vendorId);
  }

  // Embed the new listing so it's searchable the moment it's published.
  if (typeof vendorId === "string") {
    const r = await reembedVendor(supabase, vendorId);
    if (!r.ok) console.error("[reembed] new listing", vendorId, r.error);
  }

  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

export async function publishListing(vendorId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("vendors")
    .update({ status: "live" })
    .eq("id", vendorId)
    .eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/vendor/dashboard");
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/vendor/login");
}
