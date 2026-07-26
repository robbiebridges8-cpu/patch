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

  // One sign-in — send failures back to it, preserving where they were headed.
  const intent = next.startsWith("/vendor") ? "&intent=vendor" : "";
  return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}${intent}&error=1`);
}
