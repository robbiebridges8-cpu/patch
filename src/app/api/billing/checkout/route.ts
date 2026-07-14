import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function POST() {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) {
    return Response.json({ error: "Billing isn't configured yet." }, { status: 503 });
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
        { vendor_id: vendor.id, stripe_customer_id: customerId, status: "trialing" },
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
    metadata: { vendor_id: vendor.id },
    subscription_data: { metadata: { vendor_id: vendor.id } },
  });

  return Response.json({ url: session.url });
}
