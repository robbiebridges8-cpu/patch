import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /shortlist and /enquiries are per-user and thin/empty for a crawler.
      disallow: ["/api/", "/admin", "/vendor/dashboard", "/enquiries", "/shortlist"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
