import Stripe from "stripe";

// Returns a configured Stripe client, or null if STRIPE_SECRET_KEY isn't set.
// Billing routes return a clear 503 when this is null, so the app builds and
// runs fine before real keys are added.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const MONTHLY_PLAN = { amountLabel: "£20/month", currency: "gbp" };
