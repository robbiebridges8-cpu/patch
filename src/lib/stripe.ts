import Stripe from "stripe";

// Returns a configured Stripe client, or null if STRIPE_SECRET_KEY isn't set.
// Billing routes return a clear 503 when this is null, so the app builds and
// runs fine before real keys are added.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// Price lives in src/lib/tiers.ts (TIER_PRICE), which is what the UI and
// checkout both read. Duplicating it here is how the site ended up advertising
// £20 while charging £29 — don't reintroduce a second source of truth.
export const CURRENCY = "gbp";
