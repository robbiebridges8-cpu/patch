export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
  description: "Describe your occasion and Patch returns a reasoned shortlist of mobile food vendors in London.",
  robots: { index: false, follow: true },
};

import { Suspense } from "react";
import { quickSearch, narrateSummary, type VendorResult } from "@/lib/ai";
import { categoryPhoto } from "@/lib/categoryPhoto";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import SearchBar from "@/components/search/SearchBar";
import ParsedChips from "@/components/search/ParsedChips";
import AINote from "@/components/search/AINote";
import VendorRow from "@/components/search/VendorRow";
import FilterSidebarLive from "@/components/search/FilterSidebarLive";
import FollowupsCard from "@/components/search/FollowupsCard";
import { ResultsSkeleton, SidebarSkeleton, AINoteSkeleton } from "@/components/search/SearchSkeleton";
import type { VendorMatch } from "@/types/vendor";
import styles from "./page.module.css";

interface SearchParams {
  q?: string;
  type?: string;
  budget?: string;
  sort?: string;
  setting?: string;
}

// ── Mappers ──

function resultToMatch(r: VendorResult, rank: number, note: string, adjacent = false): VendorMatch {
  const dietary = r.service_dietary_options || [];
  return {
    vendor: {
      id: r.vendor_id, slug: r.vendor_slug, name: r.vendor_name,
      description: r.vendor_description, status: "live",
      ownerId: null, contactEmail: null, contactPhone: null, website: null,
      instagram: null, whatsapp: null, basePostcode: r.vendor_base_postcode,
      coverageRadiusMiles: r.vendor_coverage_radius_miles,
      priceFrom: r.vendor_price_from, priceTo: null, priceNotes: r.vendor_price_notes,
      bio: r.vendor_bio, faq: null, cancellationPolicy: null,
      minLeadDays: 0, maxAdvanceDays: 0,
      ratingAvg: r.vendor_rating_avg, reviewCount: r.vendor_review_count,
      createdAt: "", updatedAt: "",
    },
    rank, featured: rank === 1, adjacent, matchReason: note,
    matchedTags: dietary.slice(0, 3).map((d) => ({ label: d, good: true })),
    category: r.service_category || "Vendor",
    distance: r.vendor_base_postcode || "",
    metaLine: "",
    photoUrl: categoryPhoto(r.service_category),
    photoCount: 0,
    rating: r.vendor_rating_avg || 0,
    bookingCount: r.vendor_review_count,
    priceLabel: r.vendor_price_from ? `from £${r.vendor_price_from}` : "Enquire",
    priceUnit: "",
  };
}

function rowToMatch(v: Record<string, unknown>, rank: number, note: string): VendorMatch {
  const services = (v.vendor_services as Record<string, unknown>[]) || [];
  const svc = services[0] || {};
  const dietary = (svc.dietary_options as string[]) || [];
  return {
    vendor: {
      id: v.id as string, slug: v.slug as string, name: v.name as string,
      description: v.description as string | null, status: "live",
      ownerId: null, contactEmail: null, contactPhone: null, website: null,
      instagram: null, whatsapp: null, basePostcode: v.base_postcode as string | null,
      coverageRadiusMiles: (v.coverage_radius_miles as number) ?? 5,
      priceFrom: v.price_from as number | null, priceTo: null,
      priceNotes: v.price_notes as string | null, bio: v.bio as string | null,
      faq: null, cancellationPolicy: null, minLeadDays: 0, maxAdvanceDays: 0,
      ratingAvg: v.rating_avg as number | null, reviewCount: (v.review_count as number) ?? 0,
      createdAt: "", updatedAt: "",
    },
    rank, featured: rank === 1, adjacent: false, matchReason: note,
    matchedTags: dietary.slice(0, 3).map((d) => ({ label: d, good: true })),
    category: (svc.category as string) || "Vendor",
    distance: (v.base_postcode as string) || "",
    metaLine: "",
    photoUrl: categoryPhoto(svc.category as string),
    photoCount: 0,
    rating: (v.rating_avg as number) || 0,
    bookingCount: (v.review_count as number) || 0,
    priceLabel: v.price_from ? `from £${v.price_from}` : "Enquire",
    priceUnit: "",
  };
}

// ── Sidebar (its own boundary so it never blocks results) ──

async function SidebarData({
  activeTypes, currentBudget, currentSetting,
}: {
  activeTypes: string[];
  currentBudget?: number;
  currentSetting?: string;
}) {
  const { data } = await supabase
    .from("vendor_services")
    .select("category")
    .not("category", "is", null);

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const c = (row as { category: string | null }).category;
    if (c) counts[c] = (counts[c] || 0) + 1;
  }

  return (
    <FilterSidebarLive
      typeCounts={counts}
      activeTypes={activeTypes}
      currentBudget={currentBudget}
      currentSetting={currentSetting}
    />
  );
}

// ── Streamed AI reasoning note ──

async function StreamedNote({ promise }: { promise: Promise<{ summary: string }> }) {
  let n: { summary: string } | null = null;
  try {
    n = await promise;
  } catch {
    return null; // reasoning is a nice-to-have; cards already rendered
  }
  if (!n?.summary) return null;
  return (
    <div className={styles.answerRow}>
      <AINote html={n.summary} />
    </div>
  );
}

// ── AI results (fast cards first, narration streams in) ──

async function AIResults({ query }: { query: string }) {
  let quick: Awaited<ReturnType<typeof quickSearch>>;
  try {
    quick = await quickSearch(query);
  } catch (e) {
    console.error("[search] quickSearch failed:", e);
    return (
      <div className={styles.errorBox} role="alert">
        <strong>Search hit a snag.</strong> We couldn&apos;t reach the matching engine just now —
        please try that search again in a moment.
      </div>
    );
  }

  if (quick.results.length === 0) {
    return (
      <div className={styles.empty}>
        No vendors match &ldquo;{query}&rdquo; yet. Try broadening the occasion, budget, or area.
      </div>
    );
  }

  const matches = quick.results.map((r, i) => resultToMatch(r, i + 1, r.vendor_description || ""));
  // The vector search already ranks by fit, so the top rows are the strongest
  // matches — flag them as Patch's recommendations and pin them at the top.
  const recCount = matches.length >= 4 ? 2 : matches.length >= 2 ? 1 : 0;
  matches.forEach((m, i) => { m.featured = i < recCount; });
  const recommended = matches.slice(0, recCount);
  const others = matches.slice(recCount);

  // Kick off the heavy narration but don't await it — it streams into its own boundary.
  const narratePromise = quick.usedFallback
    ? null
    : narrateSummary(query, quick.parsed, quick.results);

  return (
    <>
      {quick.chips.length > 0 && (
        <div className={styles.chipsRow}>
          <ParsedChips chips={quick.chips} />
        </div>
      )}

      {narratePromise && (
        <Suspense fallback={<AINoteSkeleton />}>
          <StreamedNote promise={narratePromise} />
        </Suspense>
      )}

      {recCount > 0 ? (
        <>
          <h2 className={styles.groupLabel}>{recCount > 1 ? "Patch recommends" : "Top match"}</h2>
          <div className={styles.vendorList}>
            {recommended.map((m) => (
              <VendorRow key={m.vendor.id} match={m} />
            ))}
          </div>
          {others.length > 0 && (
            <>
              <h2 className={styles.groupLabel}>More options</h2>
              <div className={styles.vendorList}>
                {others.map((m) => (
                  <VendorRow key={m.vendor.id} match={m} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className={styles.vendorList}>
          {matches.map((m) => (
            <VendorRow key={m.vendor.id} match={m} />
          ))}
        </div>
      )}

      <div className={styles.askPatch}>
        <FollowupsCard />
      </div>
    </>
  );
}

// ── Keyword fallback (no AI keys configured) ──

async function KeywordResults({
  query, params, hasAI, hasVoyage,
}: {
  query: string;
  params: SearchParams;
  hasAI: boolean;
  hasVoyage: boolean;
}) {
  const { data } = await supabase
    .from("vendors")
    .select("*, vendor_services ( category, dietary_options )")
    .eq("status", "live");

  let rows = (data as Record<string, unknown>[]) || [];

  if (params.type) {
    const types = params.type.split(",");
    rows = rows.filter((v) => {
      const svc = ((v.vendor_services as Record<string, unknown>[]) || [])[0];
      return types.includes((svc?.category as string) || "");
    });
  }
  if (params.budget) {
    const max = parseInt(params.budget, 10);
    if (!isNaN(max)) rows = rows.filter((v) => (v.price_from as number | null) == null || (v.price_from as number) <= max);
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    rows = rows.filter((v) => {
      const svc = ((v.vendor_services as Record<string, unknown>[]) || [])[0];
      const hay = `${v.name} ${v.description} ${v.bio} ${svc?.category || ""}`.toLowerCase();
      return terms.some((t) => hay.includes(t));
    });
  }
  rows.sort((a, b) => ((b.review_count as number) || 0) - ((a.review_count as number) || 0));

  const matches = rows.map((v, i) => rowToMatch(v, i + 1, (v.description as string) || ""));
  const note = `<strong>${matches.length} vendor${matches.length !== 1 ? "s" : ""}</strong> found${
    !hasAI ? ". Add an Anthropic API key to enable AI-powered matching." : !hasVoyage ? ". Add a Voyage API key to enable semantic search." : "."
  }`;

  return (
    <>
      <div className={styles.answerRow}>
        <AINote html={note} />
      </div>
      {matches.length > 0 ? (
        <div className={styles.vendorList}>
          {matches.map((m) => (
            <VendorRow key={m.vendor.id} match={m} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>No vendors match your filters. Try broadening your search.</div>
      )}
    </>
  );
}

async function Results({ query, params }: { query: string; params: SearchParams }) {
  const hasAI = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx";
  const hasVoyage = !!process.env.VOYAGE_API_KEY;

  if (hasAI && hasVoyage) return <AIResults query={query} />;
  return <KeywordResults query={query} params={params} hasAI={hasAI} hasVoyage={hasVoyage} />;
}

// ── Page ──

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const sort = params.sort || "reviews";
  const activeTypes = params.type ? params.type.split(",") : [];
  const boundaryKey = `${query}|${params.type || ""}|${params.budget || ""}|${params.setting || ""}|${sort}`;

  return (
    <>
      <Header />

      <main className={styles.main}>
        <div className={styles.searchWrap}>
          <SearchBar query={query} />
        </div>

        <div className={styles.layout}>
          <div className={styles.sidebarWrap}>
            <Suspense fallback={<SidebarSkeleton />}>
              <SidebarData
                activeTypes={activeTypes}
                currentBudget={params.budget ? parseInt(params.budget, 10) : undefined}
                currentSetting={params.setting}
              />
            </Suspense>
          </div>

          <div className={styles.results}>
            {query ? (
              <Suspense key={boundaryKey} fallback={<ResultsSkeleton />}>
                <Results query={query} params={params} />
              </Suspense>
            ) : (
              <div className={styles.empty}>
                Describe your occasion above — the vibe, guest count, budget, and area —
                and Patch will put together a shortlist.
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
