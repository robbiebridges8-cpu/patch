export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { aiSearch } from "@/lib/ai";
import Header from "@/components/layout/Header";
import SearchBar from "@/components/search/SearchBar";
import ParsedChips from "@/components/search/ParsedChips";
import AINote from "@/components/search/AINote";
import VendorRow from "@/components/search/VendorRow";
import FilterSidebarLive from "@/components/search/FilterSidebarLive";
import FollowupsCard from "@/components/search/FollowupsCard";
import type { VendorMatch } from "@/types/vendor";
import styles from "./page.module.css";

interface SearchParams {
  q?: string;
  type?: string;
  budget?: string;
  sort?: string;
  setting?: string;
}

const VENDOR_SELECT = `
  *,
  vendor_photos ( url, alt_text, position ),
  vendor_services ( id, category, dietary_options, capacity_min, capacity_max )
`;

async function getAllVendors() {
  const { data, error } = await supabase
    .from("vendors")
    .select(VENDOR_SELECT)
    .eq("status", "live");
  if (error) console.error("getAllVendors error:", error);
  return data || [];
}

async function getVendorsByIds(ids: string[]) {
  const { data, error } = await supabase
    .from("vendors")
    .select(VENDOR_SELECT)
    .in("id", ids)
    .eq("status", "live");
  if (error) console.error("getVendorsByIds error:", error);
  return data || [];
}

function getVendorCategory(v: Record<string, unknown>): string {
  const services = (v.vendor_services as Record<string, unknown>[]) || [];
  if (services.length > 0 && services[0].category) return services[0].category as string;
  return "Vendor";
}

function getVendorDietary(v: Record<string, unknown>): string[] {
  const services = (v.vendor_services as Record<string, unknown>[]) || [];
  if (services.length > 0) return (services[0].dietary_options as string[]) || [];
  return [];
}

function toVendorMatch(
  v: Record<string, unknown>,
  rank: number,
  matchNote: string,
  featured: boolean,
  adjacent: boolean
): VendorMatch {
  const photos = (v.vendor_photos as Record<string, unknown>[]) || [];
  const sortedPhotos = [...photos].sort((a, b) => (a.position as number) - (b.position as number));
  const category = getVendorCategory(v);
  const dietary = getVendorDietary(v);

  return {
    vendor: {
      id: v.id as string, slug: v.slug as string, name: v.name as string,
      description: v.description as string | null, status: v.status as "live",
      ownerId: v.owner_id as string | null, contactEmail: v.contact_email as string | null,
      contactPhone: v.contact_phone as string | null, website: v.website as string | null,
      instagram: v.instagram as string | null, whatsapp: v.whatsapp as string | null,
      basePostcode: v.base_postcode as string | null,
      coverageRadiusMiles: v.coverage_radius_miles as number,
      priceFrom: v.price_from as number | null, priceTo: v.price_to as number | null,
      priceNotes: v.price_notes as string | null, bio: v.bio as string | null,
      faq: null, cancellationPolicy: v.cancellation_policy as string | null,
      minLeadDays: v.min_lead_days as number, maxAdvanceDays: v.max_advance_days as number,
      ratingAvg: v.rating_avg as number | null, reviewCount: v.review_count as number,
      createdAt: v.created_at as string, updatedAt: v.updated_at as string,
    },
    rank, featured, adjacent, matchReason: matchNote,
    matchedTags: dietary.slice(0, 3).map((d) => ({ label: d, good: true })),
    category,
    distance: `${v.base_postcode}`,
    metaLine: [v.base_postcode, (v.review_count as number) > 0 ? `${v.review_count} reviews` : null].filter(Boolean).join(" · "),
    photoUrl: sortedPhotos.length > 0 ? sortedPhotos[0].url as string : "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    photoCount: photos.length,
    rating: (v.rating_avg as number) || 0,
    bookingCount: v.review_count as number,
    priceLabel: v.price_from ? `from £${v.price_from}` : "Enquire",
    priceUnit: v.price_notes ? (v.price_notes as string).split('.')[0] : "",
  };
}

function filterVendors(vendors: Record<string, unknown>[], params: SearchParams) {
  let results = [...vendors];
  if (params.type) {
    const types = params.type.split(",");
    results = results.filter((v) => types.includes(getVendorCategory(v)));
  }
  if (params.budget) {
    const max = parseInt(params.budget, 10);
    if (!isNaN(max)) results = results.filter((v) => (v.price_from as number | null) === null || (v.price_from as number) <= max);
  }
  if (params.q) {
    const terms = params.q.toLowerCase().split(/\s+/);
    results = results.filter((v) => {
      const searchable = `${v.name} ${v.description} ${v.bio} ${getVendorCategory(v)}`.toLowerCase();
      return terms.some((t) => searchable.includes(t));
    });
  }
  return results;
}

function sortVendors(vendors: Record<string, unknown>[], sort: string) {
  const sorted = [...vendors];
  switch (sort) {
    case "rating": sorted.sort((a, b) => ((b.rating_avg as number) || 0) - ((a.rating_avg as number) || 0)); break;
    case "price_low": sorted.sort((a, b) => ((a.price_from as number) || 9999) - ((b.price_from as number) || 9999)); break;
    case "price_high": sorted.sort((a, b) => ((b.price_from as number) || 0) - ((a.price_from as number) || 0)); break;
    default: sorted.sort((a, b) => ((b.review_count as number) || 0) - ((a.review_count as number) || 0)); break;
  }
  return sorted;
}

function countByCategory(vendors: Record<string, unknown>[]) {
  const counts: Record<string, number> = {};
  for (const v of vendors) {
    const cat = getVendorCategory(v);
    if (cat && cat !== "Vendor") counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

const hasAI = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx";
const hasVoyage = !!process.env.VOYAGE_API_KEY;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = params.q || "";
  const sort = params.sort || "reviews";
  const activeTypes = params.type ? params.type.split(",") : [];

  const allVendors = await getAllVendors();
  const typeCounts = countByCategory(allVendors);

  let matches: VendorMatch[];
  let chips: string[] = [];
  let aiSummary = "";
  let usedAI = false;

  if (query && hasAI && hasVoyage) {
    try {
      const ai = await aiSearch(query);
      chips = ai.chips;
      aiSummary = ai.summary;
      usedAI = true;

      const matchedIds = ai.vendorMatches.map((m) => m.vendor_id);
      const fullVendors = matchedIds.length > 0 ? await getVendorsByIds(matchedIds) : [];
      const vendorMap = new Map(fullVendors.map((v) => [v.id as string, v]));
      const sortedAIMatches = [...ai.vendorMatches].sort((a, b) => a.rank - b.rank);

      matches = sortedAIMatches
        .filter((m) => vendorMap.has(m.vendor_id))
        .map((m, i) => toVendorMatch(
          vendorMap.get(m.vendor_id)!,
          m.rank,
          m.match_note,
          i === 0,
          m.is_adjacent,
        ));
    } catch (e) {
      console.error("AI search failed, falling back:", e);
      const filtered = filterVendors(allVendors, params);
      const sorted = sortVendors(filtered, sort);
      matches = sorted.map((v, i) => toVendorMatch(v, i + 1, v.description as string || "", i === 0, false));
      chips = query.split(/,\s*/).map((c) => c.trim()).filter(Boolean);
    }
  } else {
    const filtered = filterVendors(allVendors, params);
    const sorted = sortVendors(filtered, sort);
    matches = sorted.map((v, i) => toVendorMatch(v, i + 1, v.description as string || "", i === 0, false));
    if (query) chips = query.split(/,\s*/).map((c) => c.trim()).filter(Boolean);
  }

  return (
    <>
      <Header />

      <main className={styles.main}>
        <div className={styles.searchWrap}>
          <SearchBar query={query} />
        </div>

        <div className={styles.layout}>
          <div className={styles.sidebarWrap}>
            <FilterSidebarLive
              typeCounts={typeCounts}
              activeTypes={activeTypes}
              currentBudget={params.budget ? parseInt(params.budget, 10) : undefined}
              currentSetting={params.setting}
            />
          </div>

          <div className={styles.results}>
            {chips.length > 0 && (
              <div className={styles.chipsRow}>
                <ParsedChips chips={chips} />
              </div>
            )}

            {aiSummary && (
              <div className={styles.answerRow}>
                <AINote html={aiSummary} />
              </div>
            )}

            {query && !usedAI && (
              <div className={styles.answerRow}>
                <AINote html={`<strong>${matches.length} vendor${matches.length !== 1 ? "s" : ""}</strong> found${!hasAI ? ". Add your Anthropic API key to enable AI-powered matching." : !hasVoyage ? ". Add your Voyage API key to enable semantic search." : "."}`} />
              </div>
            )}

            <div className={styles.vendorList}>
              {matches.map((m) => (
                <VendorRow key={m.vendor.id} match={m} />
              ))}
            </div>

            {matches.length === 0 && (
              <div className={styles.empty}>No vendors match your filters. Try broadening your search.</div>
            )}

            <div className={styles.askPatch}>
              <FollowupsCard />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
