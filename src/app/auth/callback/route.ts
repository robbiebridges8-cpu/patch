import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges the magic-link code for a session cookie, then continues to `next`.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/vendor/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Send failures back to the right sign-in for who was signing in.
  const loginPath = next.startsWith("/vendor") ? "/vendor/login" : "/login";
  return NextResponse.redirect(`${origin}${loginPath}?error=Could not sign you in. The link may have expired — please request a new one.`);
}
