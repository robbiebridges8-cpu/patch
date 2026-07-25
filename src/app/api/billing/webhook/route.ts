import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { TIER } from "@/lib/tiers";
import { captureException } from "@/lib/monitoring";

// Stripe needs the raw body + Node crypto for signature verification.
export const runtime = "nodejs";

type SubStatus = "active" | "past_due" | "cancelled" | "trialing";

export function mapStatus(s: Stripe.Subscription.Status): SubStatus {
  switch (s) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "canceled": return "cancelled";
    case "past_due":
    case "unpaid": return "past_due";
    default: return "trialing"; // incomplete / incomplete_expired / paused
  }
}

export function periodEnd(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  const item = sub.items?.data?.[0]?.current_period_end;
  const unix = top ?? item;
  return unix ? new Date(unix * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "Billing isn't configured." }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "Missing signature." }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe] signature verification failed:", err);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  const svc = createServiceClient();
  if (!svc) {
    console.error("[stripe] SUPABASE_SERVICE_ROLE_KEY not set — cannot persist subscription");
    return Response.json({ received: true, persisted: false });
  }

  async function syncSubscription(sub: Stripe.Subscription, vendorIdHint?: string) {
    const vendorId = vendorIdHint || (sub.metadata?.vendor_id ?? undefined);
    const status = mapStatus(sub.status);
    const paying = status === "active" || status === "trialing";
    const boughtTier = TIER.PAID;
    const interval = sub.metadata?.interval === "year" ? "year" : "month";

    const row: Record<string, unknown> = {
      status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      current_period_end: periodEnd(sub),
      cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      plan_tier: boughtTier,
      billing_interval: interval,
    };

    if (vendorId) {
      const { error: subErr } = await svc!.from("subscriptions")
        .upsert({ vendor_id: vendorId, ...row }, { onConflict: "vendor_id" });
      // A lapsed subscription drops the vendor to free — it does NOT hide the
      // listing. Their profile, reviews and SEO presence are supply density we
      // want to keep, and a live free listing is a standing upgrade prompt.
      // The tier comes from the completed payment, never from the client.
      const { error: venErr } = await svc!.from("vendors")
        .update({ tier: paying ? boughtTier : TIER.FREE, status: "live" })
        .eq("id", vendorId);
      // A discarded error here means a paid vendor silently never gets their
      // tier. Throw so the handler returns non-2xx and Stripe retries.
      if (subErr || venErr) throw new Error(`persist failed: ${(subErr ?? venErr)!.message}`);
    } else {
      // Fall back to matching by customer id.
      const { error } = await svc!.from("subscriptions")
        .update(row)
        .eq("stripe_customer_id", row.stripe_customer_id as string);
      if (error) throw new Error(`persist by customer failed: ${error.message}`);
    }
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await syncSubscription(sub, session.metadata?.vendor_id ?? undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // A payment that doesn't persist is lost revenue and a vendor stuck on free.
    console.error("[stripe] handler error:", err);
    captureException(err, { scope: "api/billing/webhook", severity: "fatal", extra: { eventType: event.type } });
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
