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

  if (!name) return { error: "Your business needs a name." };

  const { data: before } = await supabase
    .from("vendors")
    .select("name, primary_category, description, bio, dietary_options, vibe_tags")
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
    !sameArr(before.vibe_tags, vibe);
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/vendor/login");
}
