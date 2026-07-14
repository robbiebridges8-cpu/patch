import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

// Stripe needs the raw body + Node crypto for signature verification.
export const runtime = "nodejs";

type SubStatus = "active" | "past_due" | "cancelled" | "trialing";

function mapStatus(s: Stripe.Subscription.Status): SubStatus {
  switch (s) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "canceled": return "cancelled";
    case "past_due":
    case "unpaid": return "past_due";
    default: return "trialing"; // incomplete / incomplete_expired / paused
  }
}

function periodEnd(sub: Stripe.Subscription): string | null {
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
    const row: Record<string, unknown> = {
      status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      current_period_end: periodEnd(sub),
      cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
    };

    if (vendorId) {
      await svc!.from("subscriptions").upsert({ vendor_id: vendorId, ...row }, { onConflict: "vendor_id" });
      // Gate public visibility on an active/trialing subscription.
      const listingStatus = status === "active" || status === "trialing" ? "live" : "paused";
      await svc!.from("vendors").update({ status: listingStatus }).eq("id", vendorId);
    } else {
      // Fall back to matching by customer id.
      await svc!.from("subscriptions")
        .update(row)
        .eq("stripe_customer_id", row.stripe_customer_id as string);
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
    console.error("[stripe] handler error:", err);
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }

  return Response.json({ received: true });
}
