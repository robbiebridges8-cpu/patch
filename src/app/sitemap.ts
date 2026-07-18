import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";

export const revalidate = 3600; // rebuild the sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/for-vendors`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // PostgREST caps a single response at ~1000 rows, so a bare select silently
  // truncates once the catalogue outgrows one page — the sitemap would look
  // fine and quietly omit most of the site. Page through explicitly.
  //
  // NOTE: a sitemap file is also capped at 50,000 URLs by the spec. Beyond
  // that this needs splitting into a sitemap index; see SITEMAP_MAX_URLS.
  const PAGE = 1000;
  const SITEMAP_MAX_URLS = 45_000;
  const vendors: { slug: string; updated_at: string | null }[] = [];

  for (let from = 0; from < SITEMAP_MAX_URLS; from += PAGE) {
    const { data, error } = await supabase
      .from("vendors")
      .select("slug, updated_at")
      .eq("status", "live")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[sitemap] page fetch failed:", error.message);
      break;
    }
    const page = (data as { slug: string; updated_at: string | null }[]) || [];
    vendors.push(...page);
    if (page.length < PAGE) break;
  }

  if (vendors.length >= SITEMAP_MAX_URLS) {
    console.warn(`[sitemap] hit ${SITEMAP_MAX_URLS} URLs — split into a sitemap index`);
  }

  const vendorRoutes: MetadataRoute.Sitemap = vendors.map((v) => ({
    url: `${SITE_URL}/vendors/${v.slug}`,
    lastModified: v.updated_at || undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...vendorRoutes];
}
