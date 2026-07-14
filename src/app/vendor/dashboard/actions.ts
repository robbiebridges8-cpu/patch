"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionState = { ok?: boolean; error?: string } | null;

function str(v: FormDataEntryValue | null, max: number): string | null {
  const s = (v ? String(v) : "").trim();
  return s ? s.slice(0, max) : null;
}

export async function updateListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const id = String(formData.get("vendorId") || "");
  const priceRaw = formData.get("price_from");
  const price = priceRaw && String(priceRaw).trim() ? Number(priceRaw) : null;

  const { error } = await supabase
    .from("vendors")
    .update({
      description: str(formData.get("description"), 2000),
      contact_email: str(formData.get("contact_email"), 320),
      contact_phone: str(formData.get("contact_phone"), 30),
      price_from: price != null && Number.isFinite(price) && price >= 0 ? price : null,
      price_notes: str(formData.get("price_notes"), 500),
    })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
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
