import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Opens the Stripe customer portal so a vendor can manage or cancel their plan.
export async function POST() {
  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Billing isn't configured yet." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!vendor) return Response.json({ error: "No listing linked." }, { status: 400 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return Response.json({ error: "No billing account yet — subscribe first." }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${SITE}/vendor/dashboard`,
  });

  return Response.json({ url: session.url });
}
