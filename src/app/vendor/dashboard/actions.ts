"use server";

import { createClient } from "@/lib/supabase/server";
import { reembedVendor } from "@/lib/embedding";
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
    .select("name, primary_category, description, bio, dietary_options, vibe_tags, signature_items")
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
      price_from: num(formData.get("price_from")),
      price_notes: str(formData.get("price_notes"), 500),
      coverage_radius_miles: coverage ?? 5,
      typical_event_size_min: capMin,
      typical_event_size_max: capMax,
      dietary_options: dietary,
      vibe_tags: vibe,
      signature_items: signature,
      faq: faq.length ? faq : null,
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // Keep the service row (what search reads) in sync with the listing.
  await supabase
    .from("vendor_services")
    .update({
      title: name,
      description,
      category,
      dietary_options: dietary,
      capacity_min: capMin,
      capacity_max: capMax,
    })
    .eq("vendor_id", id);

  // Re-embed only when the searchable text actually changed (best-effort).
  const changed =
    before.name !== name ||
    before.primary_category !== category ||
    before.description !== description ||
    before.bio !== bio ||
    !sameArr(before.dietary_options, dietary) ||
    !sameArr(before.vibe_tags, vibe) ||
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

async function geocode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  if (!postcode) return null;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.result) return { lat: data.result.latitude, lng: data.result.longitude };
    }
  } catch { /* ignore */ }
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

  const geo = postcode ? await geocode(postcode) : null;

  const { data: vendorId, error } = await supabase.rpc("create_vendor_listing", {
    p_name: name,
    p_category: category,
    p_description: description,
    p_postcode: postcode,
    p_lat: geo?.lat ?? null,
    p_lng: geo?.lng ?? null,
  });

  if (error) return { error: error.message };

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
