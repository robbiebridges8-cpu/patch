import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session cookie on every matched request and guards the
// vendor area — unauthenticated visitors to /vendor/* are sent to the login page.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // /admin additionally checks the admin role in the page itself — this only
  // keeps signed-out visitors from reaching it.
  const isProtected =
    (path.startsWith("/vendor") && !path.startsWith("/vendor/login")) || path.startsWith("/admin");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    if (path.startsWith("/vendor")) url.searchParams.set("intent", "vendor");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/vendor/:path*", "/admin/:path*", "/auth/:path*"],
};
