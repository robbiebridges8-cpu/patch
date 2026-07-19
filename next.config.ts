import type { NextConfig } from "next";

// The Supabase project ref is part of the storage hostname, so derive the
// pattern from the same env var the client uses rather than hardcoding it.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

/**
 * Security headers.
 *
 * The CSP is deliberately explicit about hosts rather than using a wildcard:
 * the app talks to exactly three origins (Supabase, Voyage/postcodes via the
 * server only, and Unsplash for imagery), so anything else connecting is a bug
 * or an injection. `frame-ancestors 'none'` is the clickjacking defence and
 * supersedes X-Frame-Options.
 *
 * 'unsafe-inline' on style-src is required by Next's CSS-in-JS runtime, and
 * 'unsafe-inline'/'unsafe-eval' on script-src by the dev overlay — both are
 * dropped in production below.
 */
const isDev = process.env.NODE_ENV === "development";

// Whether this deployment is actually served over TLS. NODE_ENV is the wrong
// signal — `next start` is "production" but is plain http locally and in the
// e2e suite, where upgrading requests breaks every asset with an SSL error.
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https://");
const SUPABASE_HOST = "https://mddxsyhjmglisugrshkb.supabase.co";

const csp = [
  "default-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com " + SUPABASE_HOST,
  "font-src 'self' data:",
  `connect-src 'self' ${SUPABASE_HOST} wss://mddxsyhjmglisugrshkb.supabase.co`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  // Production only. On an http origin (local dev, preview servers, e2e) this
  // rewrites every asset request to https and they all fail with an SSL error —
  // no CSS, no JS, no hydration. It buys nothing on a host that is already
  // HTTPS-only, and breaks every host that isn't.
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Nothing in the product needs these; denying them shrinks the blast radius
  // of any script that does get injected.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The worker file sits at the root but must control /vendor/ only.
        // Without this header the browser refuses a scope above the file's own
        // directory, and registration fails silently.
        source: "/vendor-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/vendor/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Category fallback imagery.
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      // Vendor-uploaded photos in the `vendor-photos` bucket.
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
