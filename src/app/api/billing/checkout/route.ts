import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { TIER } from "@/lib/tiers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * One Stripe price per (tier, interval). Falls back to the legacy single
 * STRIPE_PRICE_ID so an existing setup keeps working while the new prices are
 * created — a missing price is a 503, never a silent charge at the wrong rate.
 */
function priceIdFor(interval: "month" | "year"): string | undefined {
  const key = interval === "year" ? "STRIPE_PRICE_YEARLY" : "STRIPE_PRICE_MONTHLY";
  return process.env[key] || process.env.STRIPE_PRICE_ID;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return Response.json({ error: "Billing isn't configured yet." }, { status: 503 });
  }

  let body: { interval?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Callers may send no body; default to monthly.
  }
  const interval: "month" | "year" = body.interval === "year" ? "year" : "month";
  const tier = TIER.PAID;

  const priceId = priceIdFor(interval);
  if (!priceId) {
    return Response.json({ error: "That plan isn't available yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!vendor) return Response.json({ error: "Link a listing before subscribing." }, { status: 400 });

  // Reuse an existing Stripe customer if we have one, otherwise create it.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: vendor.name,
      metadata: { vendor_id: vendor.id },
    });
    customerId = customer.id;
    // Persist the customer id up front (service role — RLS blocks anon writes here).
    const svc = createServiceClient();
    if (svc) {
      await svc.from("subscriptions").upsert(
        { vendor_id: vendor.id, stripe_customer_id: customerId, status: "trialing", plan_tier: tier, billing_interval: interval },
        { onConflict: "vendor_id" },
      );
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${SITE}/vendor/dashboard?billing=success`,
    cancel_url: `${SITE}/vendor/dashboard?billing=cancelled`,
    // The webhook reads these back to set vendors.tier — the tier a vendor
    // actually gets is driven by the completed payment, never by the client.
    metadata: { vendor_id: vendor.id, tier: String(tier), interval },
    subscription_data: { metadata: { vendor_id: vendor.id, tier: String(tier), interval } },
  });

  return Response.json({ url: session.url });
}
