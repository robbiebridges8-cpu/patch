"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { TIER } from "@/lib/tiers";

export type AdminActionState = { ok?: boolean; error?: string } | null;

/**
 * Every action re-checks is_admin() server-side. That check is belt-and-braces:
 * the admin_* RLS policies are the real boundary, so even a forged call from a
 * non-admin session updates zero rows.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, ok: false as const };
  const { data } = await supabase.rpc("is_admin");
  return { supabase, ok: data === true };
}

const VENDOR_STATUSES = ["draft", "live", "paused", "rejected"] as const;
type VendorStatus = (typeof VENDOR_STATUSES)[number];

export async function setVendorStatus(vendorId: string, status: string): Promise<AdminActionState> {
  if (!VENDOR_STATUSES.includes(status as VendorStatus)) return { error: "Unknown status." };

  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "Admins only." };

  const { error } = await supabase.from("vendors").update({ status }).eq("id", vendorId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/vendors");
  return { ok: true };
}

/** Manual tier override. Billing normally drives this via the Stripe webhook. */
export async function setVendorTier(vendorId: string, tier: number): Promise<AdminActionState> {
  if (![TIER.FREE, TIER.STANDARD, TIER.PRO].includes(tier as never)) {
    return { error: "Unknown tier." };
  }
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "Admins only." };

  const { error } = await supabase.from("vendors").update({ tier }).eq("id", vendorId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

/** Hiding also drops the review from the vendor's rating (handled by trigger). */
export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<AdminActionState> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "Admins only." };

  const { error } = await supabase.from("reviews").update({ hidden }).eq("id", reviewId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

export async function setReviewVerified(reviewId: string, verified: boolean): Promise<AdminActionState> {
  const { supabase, ok } = await requireAdmin();
  if (!ok) return { error: "Admins only." };

  const { error } = await supabase.from("reviews").update({ verified }).eq("id", reviewId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
