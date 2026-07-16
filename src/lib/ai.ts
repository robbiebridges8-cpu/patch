import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";

const anthropic = new Anthropic();

/** Strip markdown code fences if Claude wraps JSON in ```json ... ``` */
function extractJSON(text: string): string {
  // Handle closed fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Handle unclosed fences (response truncated before closing ```)
  const open = text.match(/```(?:json)?\s*([\s\S]*)/);
  if (open) return open[1].trim();
  return text.trim();
}

// ── Interfaces ──

export interface ParsedQuery {
  categories: string[];
  dietary: string[];
  budget_max: number | null;
  guest_count: number | null;
  location: string | null;
  setting: string | null;
  season: string | null;
  event_date: string | null;
  semantic_query: string;
  chips: string[];
}

interface AIVendorMatch {
  vendor_id: string;
  match_note: string;
  rank: number;
  is_adjacent: boolean;
}

interface AIResult {
  chips: string[];
  summary: string;
  vendorMatches: AIVendorMatch[];
  vendorIds: string[];
}

export interface VendorResult {
  vendor_id: string;
  vendor_slug: string;
  vendor_name: string;
  vendor_description: string | null;
  vendor_bio: string | null;
  vendor_base_postcode: string | null;
  vendor_price_from: number | null;
  vendor_price_notes: string | null;
  vendor_rating_avg: number | null;
  vendor_review_count: number;
  vendor_coverage_radius_miles: number;
  service_id: string;
  service_title: string;
  service_category: string | null;
  service_dietary_options: string[];
  service_capacity_min: number | null;
  service_capacity_max: number | null;
  similarity: number;
  distance_miles: number | null;
}

// ── Step 1: Parse user query → structured filters + semantic string ──

async function parseQuery(query: string): Promise<ParsedQuery> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await anthropic.messages.create({
    // Haiku: this is structured extraction, not reasoning — much faster time-to-cards.
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You parse event catering search queries into structured filters. Extract what you can; leave null for anything not mentioned. Today's date is ${today}.

Categories (use ONLY these exact values, and only when the cuisine is clearly implied; leave empty if unsure): African, Asian street food, BBQ, British comfort, Burgers, Canapés, Caribbean, Chinese, Cocktail bar, Coffee, Crêpes & waffles, Desserts, Doughnuts, Fish & chips, Fried chicken, Grazing & cheese, Greek, Ice cream, Indian, Japanese, Korean, Middle Eastern, Pizza, Seafood, Spanish, Tacos & Mexican, Thai, Vegan
Dietary (use ONLY these): vegan, vegetarian, gluten-free, halal, dairy-free, nut-free
Setting: indoor, outdoor, or null

For semantic_query: rewrite the user's intent as a rich, descriptive sentence suitable for semantic search against vendor descriptions. Include the vibe, occasion type, food preferences, and any qualitative aspects. Drop the structured parts (budget numbers, guest counts, locations) since those are filtered in SQL.

For chips: short, machine-terse labels shown to the user as parsed-intent readback. Examples: "Hackney", "~50 guests", "July", "garden", "≤ £600", "pizza". Lowercase/abbreviated, 2-6 chips.

For event_date: if the query implies a specific calendar date (e.g. "August 15", "next Saturday", "on the 3rd", "12th July"), resolve it to an ISO date "YYYY-MM-DD" using today's date above; otherwise null. A vague season/month with no day stays null.

Respond with ONLY valid JSON:
{"categories": [], "dietary": [], "budget_max": null, "guest_count": null, "location": null, "setting": null, "season": null, "event_date": null, "semantic_query": "...", "chips": []}`,
    messages: [{ role: "user", content: query }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    return JSON.parse(extractJSON(text));
  } catch {
    return {
      categories: [], dietary: [], budget_max: null, guest_count: null,
      location: null, setting: null, season: null, event_date: null,
      semantic_query: query,
      chips: query.split(/,\s*/).map((s) => s.trim()).filter(Boolean),
    };
  }
}

// ── Step 2: Geocode location via postcodes.io ──

// London bounding box for place-name disambiguation
const LONDON_BOUNDS = { latMin: 51.28, latMax: 51.70, lngMin: -0.51, lngMax: 0.33 };

function isInLondon(lat: number, lng: number): boolean {
  return lat >= LONDON_BOUNDS.latMin && lat <= LONDON_BOUNDS.latMax
    && lng >= LONDON_BOUNDS.lngMin && lng <= LONDON_BOUNDS.lngMax;
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  if (!location) return null;

  // Try as postcode first
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(location)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.result) return { lat: data.result.latitude, lng: data.result.longitude };
    }
  } catch { /* fall through */ }

  // Try as place name — fetch multiple results, prefer the London one
  try {
    const res = await fetch(`https://api.postcodes.io/places?q=${encodeURIComponent(location)}&limit=10`);
    if (res.ok) {
      const data = await res.json();
      if (data.result?.length > 0) {
        // Prefer a result inside London
        const londonMatch = data.result.find((p: { latitude: number; longitude: number }) =>
          isInLondon(p.latitude, p.longitude)
        );
        const best = londonMatch || data.result[0];
        return { lat: best.latitude, lng: best.longitude };
      }
    }
  } catch { /* fall through */ }

  return null;
}

// ── Step 3: Embed query string via Voyage ──

async function embedQuery(text: string): Promise<number[]> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) throw new Error("Missing VOYAGE_API_KEY");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${voyageKey}`,
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: [text],
      input_type: "query",
    }),
  });

  if (!res.ok) throw new Error(`Voyage API error ${res.status}`);
  const data = await res.json();
  return data.data[0].embedding;
}

// ── Step 4: Pre-filter + vector search via match_vendors RPC ──

async function vectorSearch(
  parsed: ParsedQuery,
  queryEmbedding: number[],
  geo: { lat: number; lng: number } | null,
): Promise<VendorResult[]> {
  const vecStr = `[${queryEmbedding.join(",")}]`;

  const rpcParams = {
    query_embedding: vecStr,
    filter_categories: parsed.categories.length > 0 ? parsed.categories : null,
    filter_dietary: parsed.dietary.length > 0 ? parsed.dietary : null,
    filter_guest_count: parsed.guest_count,
    filter_budget_max: parsed.budget_max,
    search_lat: geo?.lat ?? null,
    search_lng: geo?.lng ?? null,
    match_limit: 15,
  };
  console.log("[vectorSearch] RPC params:", JSON.stringify({
    ...rpcParams,
    query_embedding: `[${queryEmbedding.length} floats]`,
  }));

  const { data, error } = await supabase.rpc("match_vendors", rpcParams);

  if (error) {
    console.error("[vectorSearch] RPC failed:", error.message, error.details, error.hint);
    return fallbackSearch(parsed);
  }

  const results = (data || []) as VendorResult[];
  console.log(`[vectorSearch] returned ${results.length} results`);
  results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  return results.slice(0, 15);
}

// Fallback: basic Supabase query (no vector search)
async function fallbackSearch(parsed: ParsedQuery): Promise<VendorResult[]> {
  let query = supabase
    .from("vendor_services")
    .select(`
      id, title, category, dietary_options, capacity_min, capacity_max,
      vendors!inner ( id, slug, name, description, bio, base_postcode,
        price_from, price_notes, rating_avg, review_count,
        coverage_radius_miles, status )
    `)
    .eq("vendors.status", "live");

  if (parsed.categories.length > 0) {
    query = query.in("category", parsed.categories);
  }
  if (parsed.budget_max) {
    query = query.or(`price_from.is.null,price_from.lte.${parsed.budget_max}`, { referencedTable: "vendors" });
  }

  const { data, error } = await query.order("rating_avg", { referencedTable: "vendors", ascending: false }).limit(30);

  if (error || !data) return [];

  const seen = new Set<string>();
  const results: VendorResult[] = [];
  for (const row of data) {
    const v = row.vendors as unknown as Record<string, unknown>;
    const vid = v.id as string;
    if (seen.has(vid)) continue;
    seen.add(vid);
    results.push({
      vendor_id: vid, vendor_slug: v.slug as string, vendor_name: v.name as string,
      vendor_description: v.description as string | null, vendor_bio: v.bio as string | null,
      vendor_base_postcode: v.base_postcode as string | null,
      vendor_price_from: v.price_from as number | null, vendor_price_notes: v.price_notes as string | null,
      vendor_rating_avg: v.rating_avg as number | null, vendor_review_count: v.review_count as number,
      vendor_coverage_radius_miles: v.coverage_radius_miles as number,
      service_id: row.id as string, service_title: row.title as string,
      service_category: row.category as string | null,
      service_dietary_options: row.dietary_options as string[],
      service_capacity_min: row.capacity_min as number | null,
      service_capacity_max: row.capacity_max as number | null,
      similarity: 0, distance_miles: null,
    });
  }
  return results.slice(0, 15);
}

// ── Step 5: Generate AINote narration ──

async function narrateResults(
  query: string,
  parsed: ParsedQuery,
  results: VendorResult[],
): Promise<{ summary: string; vendors: AIVendorMatch[] }> {
  const vendorList = results
    .map((r, i) => {
      const parts = [
        `${i + 1}. [${r.vendor_id}] ${r.vendor_name}`,
        r.service_category ? `Category: ${r.service_category}` : null,
        r.vendor_base_postcode ? `Location: ${r.vendor_base_postcode}` : null,
        r.distance_miles != null ? `${r.distance_miles} miles away` : null,
        r.vendor_price_from ? `From £${r.vendor_price_from}` : null,
        r.vendor_price_notes || null,
        r.vendor_rating_avg ? `${r.vendor_rating_avg}★ (${r.vendor_review_count} reviews)` : "New vendor",
        r.service_dietary_options?.length ? `Dietary: ${r.service_dietary_options.join(", ")}` : null,
        r.service_capacity_min && r.service_capacity_max ? `Serves ${r.service_capacity_min}–${r.service_capacity_max}` : null,
        r.vendor_description || null,
      ];
      return parts.filter(Boolean).join(" | ");
    })
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `You are Patch — a calm, knowledgeable concierge for mobile food and catering in London. Given a search query and ranked vendor results, you write:

1. "summary": 2–4 sentences in the answer voice. Light first person ("I'd lean…", "I've put…"). Reason about the occasion — why these vendors fit. Never say "As an AI". Be specific: mention cuisine types, guest count feasibility, budget fit, distances.

2. For each vendor, a "match_note": 1–2 sentences explaining fit for THIS event. Use <strong> tags for key highlights. Be concrete: reference prices, distances, capacity, signature dishes.

3. "is_adjacent": true only for vendors that don't match the primary ask but are worth considering (different cuisine, dessert add-on, slightly over budget but exceptional).

4. "rank": 1 = best fit. Re-rank based on overall fit, not just similarity.

British English. £ not $. Sentence case. No emoji.

Respond with ONLY valid JSON:
{"summary": "...", "vendors": [{"vendor_id": "uuid", "match_note": "...", "rank": 1, "is_adjacent": false}, ...]}`,
    messages: [{
      role: "user",
      content: `Client searched: "${query}"\n\nParsed: ${JSON.stringify(parsed)}\n\nVendors:\n${vendorList}`,
    }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    return JSON.parse(extractJSON(text));
  } catch (err) {
    const raw = response.content[0].type === "text" ? response.content[0].text : "(no text)";
    console.error("Narration JSON parse failed:", err, "\nRaw response:", raw.slice(0, 500));
    return {
      summary: `Found ${results.length} vendors matching your search.`,
      vendors: results.map((r, i) => ({
        vendor_id: r.vendor_id,
        match_note: r.vendor_description || "",
        rank: i + 1,
        is_adjacent: false,
      })),
    };
  }
}

// ── Streaming-friendly exports ──
//
// The page renders in two stages so cards appear before the slow narration:
//   1. quickSearch()  — parse, then embed + geocode in parallel, then vector search.
//   2. narrate()      — the heavy Claude call, streamed into a Suspense boundary.

export interface QuickSearchResult {
  parsed: ParsedQuery;
  chips: string[];
  results: VendorResult[];
  usedFallback: boolean;
}

export async function quickSearch(
  query: string,
  overrides?: { categories?: string[]; dietary?: string[]; budgetMax?: number },
): Promise<QuickSearchResult> {
  const parsed = await parseQuery(query);
  // Explicit sidebar filters take precedence and become RPC pre-filters, so the
  // vector search only considers eligible vendors (not a post-filter of the top-N).
  if (overrides?.categories?.length) parsed.categories = overrides.categories;
  if (overrides?.dietary?.length) parsed.dietary = overrides.dietary;
  if (overrides?.budgetMax != null) parsed.budget_max = overrides.budgetMax;
  console.log("[quickSearch] parsed:", JSON.stringify(parsed));

  // Embed and geocode are independent once we have the parse — run them together.
  const [embedding, geo] = await Promise.all([
    embedQuery(parsed.semantic_query).catch((err) => {
      console.error("[quickSearch] embed failed:", err);
      return null;
    }),
    parsed.location ? geocodeLocation(parsed.location) : Promise.resolve(null),
  ]);

  let results: VendorResult[];
  let usedFallback = false;
  if (!embedding) {
    results = await fallbackSearch(parsed);
    usedFallback = true;
  } else {
    results = await vectorSearch(parsed, embedding, geo);
  }

  return { parsed, chips: parsed.chips, results, usedFallback };
}

export async function narrate(
  query: string,
  parsed: ParsedQuery,
  results: VendorResult[],
): Promise<{ summary: string; vendors: AIVendorMatch[] }> {
  return narrateResults(query, parsed, results);
}

/**
 * Lightweight reasoning summary for the streamed AI note.
 * Prose (not JSON) at a small token budget — an order of magnitude faster than
 * narrateResults() and immune to the truncation/parse failures that hits.
 */
export async function narrateSummary(
  query: string,
  parsed: ParsedQuery,
  results: VendorResult[],
): Promise<{ summary: string }> {
  const top = results.slice(0, 6).map((r, i) => {
    const parts = [
      `${i + 1}. ${r.vendor_name}`,
      r.service_category ? `(${r.service_category})` : null,
      r.vendor_base_postcode || null,
      r.distance_miles != null ? `${r.distance_miles.toFixed(1)} mi` : null,
      r.vendor_price_from ? `from £${r.vendor_price_from}` : null,
      r.service_dietary_options?.length ? `dietary: ${r.service_dietary_options.join(", ")}` : null,
    ];
    return parts.filter(Boolean).join(" · ");
  }).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 320,
      system: `You are Patch — a calm, knowledgeable concierge for mobile food and catering in London. The vendors are given in ranked order of fit; the top one or two are shown to the client as "Patch recommends". Write a SHORT reasoned summary: 2–3 sentences, light first person ("I'd lean…", "I've put…"). LEAD by endorsing the top one or two by name (they are the featured recommendations) and why they fit, then a sentence on the wider set. Reason about the occasion — cuisine, guest count, budget, area. Wrap the recommended vendor names and 1–2 other key phrases in <strong> tags. British English, £ not $, sentence case, no emoji. Output ONLY the summary sentences — no preamble, no JSON, no lists.`,
      messages: [{
        role: "user",
        content: `Client searched: "${query}"\nParsed intent: ${JSON.stringify(parsed)}\n\nTop vendors:\n${top}`,
      }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    return { summary: text };
  } catch (err) {
    console.error("[narrateSummary] failed:", err);
    return { summary: "" };
  }
}

// ── Main export (legacy, single-shot) ──

export async function aiSearch(query: string): Promise<AIResult> {
  // 1. Parse → structured filters + semantic string
  const parsed = await parseQuery(query);
  console.log("[aiSearch] parsed:", JSON.stringify(parsed));

  // 2. Geocode location (if any)
  const geo = parsed.location ? await geocodeLocation(parsed.location) : null;
  console.log("[aiSearch] geo:", geo);

  // 3. Embed the semantic query via Voyage
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(parsed.semantic_query);
    console.log(`[aiSearch] embedding: ${queryEmbedding.length} dims`);
  } catch (err) {
    console.error("Embedding failed, using fallback:", err);
    const results = await fallbackSearch(parsed);
    if (results.length === 0) {
      return { chips: parsed.chips, summary: "No vendors match your search.", vendorMatches: [], vendorIds: [] };
    }
    const narration = await narrateResults(query, parsed, results);
    return {
      chips: parsed.chips,
      summary: narration.summary,
      vendorMatches: narration.vendors,
      vendorIds: results.map((r) => r.vendor_id),
    };
  }

  // 4. Pre-filter + vector search
  const results = await vectorSearch(parsed, queryEmbedding, geo);

  if (results.length === 0) {
    return { chips: parsed.chips, summary: "No vendors match your search. Try broadening your criteria.", vendorMatches: [], vendorIds: [] };
  }

  // 5. Narrate
  const narration = await narrateResults(query, parsed, results);

  return {
    chips: parsed.chips,
    summary: narration.summary,
    vendorMatches: narration.vendors,
    vendorIds: results.map((r) => r.vendor_id),
  };
}
