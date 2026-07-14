import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Server-only, for trusted flows like the
// Stripe webhook writing subscription state. Returns null if the key is unset.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
