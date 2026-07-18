export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search",
  description: "Describe your occasion and Patch returns a reasoned shortlist of mobile food vendors in London.",
  robots: { index: false, follow: true },
};

import { Suspense } from "react";
import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { captureException } from "@/lib/monitoring";
import { quickSearch, narrateSummary, type VendorResult, type ParsedQuery } from "@/lib/ai";
import { categoryPhoto } from "@/lib/categoryPhoto";
import { supabase } from "@/lib/supabase";
import type { MatchedTag } from "@/types/vendor";
import Header from "@/components/layout/Header";
import SearchBar from "@/components/search/SearchBar";
import ParsedChips from "@/components/search/ParsedChips";
import AINote from "@/components/search/AINote";
import VendorRow from "@/components/search/VendorRow";
import FilterSidebarLive from "@/components/search/FilterSidebarLive";
import SearchToolbar from "@/components/search/SearchToolbar";
import QuickStarts from "@/components/search/QuickStarts";
import FollowupsCard from "@/components/search/FollowupsCard";
import ProgressiveList from "@/components/search/ProgressiveList";
import NoResults from "@/components/search/NoResults";
import { ResultsSkeleton, AINoteSkeleton } from "@/components/search/SearchSkeleton";
import type { VendorMatch } from "@/types/vendor";
import styles from "./page.module.css";

/** Rows revealed per "show more" click, and the size of the first page. */
const PAGE_SIZE = 15;

interface SearchParams {
  q?: string;
  type?: string; // cuisine pre-filter (from quick-start chips), not a sidebar control
  diet?: string; // comma-separated dietary needs
  budget?: string;
  sort?: string;
}

// ── "Why it fits" — deterministic, query-specific signals (no AI, instant) ──

function matchSignals(parsed: ParsedQuery | null, r: VendorResult): MatchedTag[] {
  const sig: MatchedTag[] = [];

  // Capacity vs guest count
  if (r.service_capacity_max) {
    if (parsed?.guest_count) {
      const fits = r.service_capacity_max >= parsed.guest_count &&
        (!r.service_capacity_min || r.service_capacity_min <= parsed.guest_count);
      sig.push({ label: `Serves ${parsed.guest_count}`, good: fits });
    } else {
      sig.push({ label: `Up to ${r.service_capacity_max}`, good: false });
    }
  }
  // Distance (only present when the search had a location)
  if (r.distance_miles != null) {
    const d = r.distance_miles;
    sig.push({ label: `${d < 10 ? d.toFixed(1) : Math.round(d)} mi away`, good: d <= r.vendor_coverage_radius_miles });
  }
  // Budget
  if (parsed?.budget_max && r.vendor_price_from != null) {
    sig.push({ label: `from £${r.vendor_price_from}`, good: r.vendor_price_from <= parsed.budget_max });
  }
  // Dietary the buyer asked for
  const dietary = r.service_dietary_options || [];
  for (const d of parsed?.dietary || []) {
    if (dietary.includes(d)) sig.push({ label: d, good: true });
  }
  // Fill with the vendor's own dietary badges if we have room
  if (sig.length < 3) {
    for (const d of dietary) {
      if (sig.length >= 3) break;
      if (!sig.some((s) => s.label === d)) sig.push({ label: d, good: false });
    }
  }
  return sig.slice(0, 4);
}

// ── Mappers ──

function resultToMatch(r: VendorResult, rank: number, parsed: ParsedQuery | null, photoUrl?: string): VendorMatch {
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
    rank, featured: rank === 1, adjacent: false, matchReason: r.vendor_description || "",
    matchedTags: matchSignals(parsed, r),
    category: r.service_category || "Vendor",
    distance: r.vendor_base_postcode || "",
    metaLine: "",
    photoUrl: photoUrl || categoryPhoto(r.service_category),
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

// ── Apply the chosen sort to the ranked matches ──

function applySort(matches: VendorMatch[], sort?: string): VendorMatch[] {
  if (!sort || sort === "best") return matches; // keep relevance order
  const out = [...matches];
  switch (sort) {
    case "rating": out.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case "price_low": out.sort((a, b) => (a.vendor.priceFrom ?? Infinity) - (b.vendor.priceFrom ?? Infinity)); break;
    case "price_high": out.sort((a, b) => (b.vendor.priceFrom ?? -1) - (a.vendor.priceFrom ?? -1)); break;
  }
  return out;
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

async function AIResults({ query, params }: { query: string; params: SearchParams }) {
  const overrides = {
    categories: params.type ? params.type.split(",") : undefined,
    dietary: params.diet ? params.diet.split(",") : undefined,
    budgetMax: params.budget ? parseInt(params.budget, 10) : undefined,
  };
  const rl = rateLimit(`search:${clientIp(await headers())}`, 25, 60_000);
  if (!rl.ok) {
    return (
      <div className={styles.errorBox} role="alert">
        <strong>Slow down a moment.</strong> That&apos;s a lot of searches very quickly — give it {rl.retryAfter}s and try again.
      </div>
    );
  }

  let quick: Awaited<ReturnType<typeof quickSearch>>;
  try {
    quick = await quickSearch(query, overrides);
  } catch (e) {
    captureException(e, { scope: "search", severity: "error", extra: { query } });
    return (
      <div className={styles.errorBox} role="alert">
        <strong>Search hit a snag.</strong> We couldn&apos;t reach the matching engine just now —
        please try that search again in a moment.
      </div>
    );
  }

  if (quick.results.length === 0) {
    return <NoResults query={query} parsed={quick.parsed} params={params} />;
  }

  // Real vendor photos where they exist (else category stock).
  const { data: photoRows } = await supabase
    .from("vendor_photos")
    .select("vendor_id, url, position")
    .in("vendor_id", quick.results.map((r) => r.vendor_id))
    .order("position", { ascending: true });
  const photoByVendor = new Map<string, string>();
  for (const row of photoRows || []) {
    const p = row as { vendor_id: string; url: string };
    if (!photoByVendor.has(p.vendor_id)) photoByVendor.set(p.vendor_id, p.url);
  }

  // Category/budget are pre-filtered in the vector search (see overrides); here
  // we just apply the chosen sort. Default "best" keeps relevance order.
  const sortActive = !!params.sort && params.sort !== "best";
  let matches = quick.results.map((r, i) => resultToMatch(r, i + 1, quick.parsed, photoByVendor.get(r.vendor_id)));
  matches = applySort(matches, params.sort);

  // Availability: if the brief names a date, flag who's free and float them up
  // so buyers don't waste an enquiry on a booked vendor.
  const eventDate = quick.parsed.event_date;
  if (eventDate) {
    const { data: blocked } = await supabase
      .from("vendor_blocked_dates")
      .select("vendor_id")
      .eq("blocked_date", eventDate)
      .in("vendor_id", matches.map((m) => m.vendor.id));
    const bookedIds = new Set((blocked || []).map((b) => (b as { vendor_id: string }).vendor_id));
    const label = new Date(`${eventDate}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    matches.forEach((m) => {
      const booked = bookedIds.has(m.vendor.id);
      m.matchedTags = [{ label: booked ? `Booked ${label}` : `Free ${label}`, good: !booked }, ...m.matchedTags].slice(0, 4);
    });
    // Available first (stable sort keeps the prior order within each group).
    matches = [...matches].sort((a, b) => Number(bookedIds.has(a.vendor.id)) - Number(bookedIds.has(b.vendor.id)));
  }

  // Only pin recommendations when showing the default "best match" order.
  const recCount = sortActive ? 0 : matches.length >= 4 ? 2 : matches.length >= 2 ? 1 : 0;
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

      {quick.relaxed.length > 0 && (
        <div className={styles.relaxedNote} role="status">
          <strong>Nothing matched that exactly.</strong> I widened the{" "}
          {quick.relaxed.length === 1
            ? quick.relaxed[0]
            : `${quick.relaxed.slice(0, -1).join(", ")} and ${quick.relaxed[quick.relaxed.length - 1]}`}{" "}
          to find these — so check those details before you enquire.
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
              <ProgressiveList className={styles.vendorList} initial={PAGE_SIZE} step={PAGE_SIZE}>
                {others.map((m) => (
                  <VendorRow key={m.vendor.id} match={m} />
                ))}
              </ProgressiveList>
            </>
          )}
        </>
      ) : (
        <ProgressiveList className={styles.vendorList} initial={PAGE_SIZE} step={PAGE_SIZE}>
          {matches.map((m) => (
            <VendorRow key={m.vendor.id} match={m} />
          ))}
        </ProgressiveList>
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
        <ProgressiveList className={styles.vendorList} initial={PAGE_SIZE} step={PAGE_SIZE}>
          {matches.map((m) => (
            <VendorRow key={m.vendor.id} match={m} />
          ))}
        </ProgressiveList>
      ) : (
        <NoResults query={query} parsed={null} params={params} />
      )}
    </>
  );
}

async function Results({ query, params }: { query: string; params: SearchParams }) {
  const hasAI = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx";
  const hasVoyage = !!process.env.VOYAGE_API_KEY;

  if (hasAI && hasVoyage) return <AIResults query={query} params={params} />;
  return <KeywordResults query={query} params={params} hasAI={hasAI} hasVoyage={hasVoyage} />;
}

// ── Page ──

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = (params.q || "").trim();
  const sort = params.sort || "best";
  const activeDietary = params.diet ? params.diet.split(",") : [];
  const budget = params.budget ? parseInt(params.budget, 10) : undefined;

  if (!query) {
    return (
      <>
        <Header />
        <main id="main-content" className={styles.main}>
          <h1 className="visuallyHidden">Search</h1>
          <div className={styles.searchWrap}>
            <SearchBar query={query} />
          </div>
          <p className={styles.emptyLead}>
            Describe your occasion above — the vibe, guest count, budget, and area — or start here:
          </p>
          <QuickStarts />
        </main>
      </>
    );
  }

  const activeCount = activeDietary.length + (budget ? 1 : 0);
  const boundaryKey = `${query}|${params.type || ""}|${params.diet || ""}|${params.budget || ""}|${sort}`;

  return (
    <>
      <Header />

      <main id="main-content" className={styles.main}>
        {/* The visible page is led by the search field, but the document still
            needs a top-level heading for screen-reader navigation. */}
        <h1 className="visuallyHidden">Search results for “{query}”</h1>

        <div className={styles.searchWrap}>
          <SearchBar query={query} />
        </div>

        <div className={styles.layout}>
          <div className={styles.sidebarWrap}>
            <FilterSidebarLive activeDietary={activeDietary} currentBudget={budget} />
          </div>

          <div className={styles.results}>
            <SearchToolbar
              activeDietary={activeDietary}
              currentBudget={budget}
              currentSort={sort}
              activeCount={activeCount}
            />
            <Suspense key={boundaryKey} fallback={<ResultsSkeleton />}>
              <Results query={query} params={params} />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
