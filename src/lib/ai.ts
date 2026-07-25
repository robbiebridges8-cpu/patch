import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import { formatLocation } from "./location";

const anthropic = new Anthropic();

/**
 * Test stub for the paid model calls.
 *
 * The e2e suite drives the real search page, which means every run used to fire
 * live Claude calls — a full suite is dozens of paid requests, and running it
 * repeatedly during development is a genuine and easily-missed bill. With this
 * on, parse and narration are computed locally: search still hits Voyage and
 * pgvector, so the results, ranking, relaxation and pagination under test are
 * all real. Only the two Anthropic calls are faked.
 *
 * Fail-safe: the flag is ignored on any https deployment, so setting it in a
 * production environment by accident cannot silently disable AI matching.
 */
const STUB_AI =
  process.env.PATCH_STUB_AI === "1" &&
  !(process.env.NEXT_PUBLIC_SITE_URL || "").startsWith("https://");

if (STUB_AI) {
  console.warn("[ai] PATCH_STUB_AI=1 — Anthropic calls are stubbed. Never set this in production.");
}

const LONDON_PLACES = [
  "hackney", "shoreditch", "peckham", "brixton", "camden", "islington", "dalston",
  "clapham", "greenwich", "stratford", "wimbledon", "soho", "chelsea", "fulham",
  "walthamstow", "deptford", "bermondsey", "kensington", "london",
];

/**
 * Deterministic stand-in for parseQuery. Extracts the same three universal
 * filters the real prompt does, by rule rather than by model, so tests that
 * depend on budget/location/date — including the no-results relaxation ladder —
 * still exercise the real code paths.
 */
function stubParse(query: string): ParsedQuery {
  const q = query.toLowerCase();

  const budgetMatch = q.match(/(?:£|under |budget (?:of )?|max )\s*(\d[\d,]*)/);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, "")) : NaN;

  const postcode = query.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/i)?.[1];
  const place = LONDON_PLACES.find((p) => q.includes(p));

  const iso = q.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;

  return {
    budget_max: Number.isFinite(budget) && budget > 0 ? budget : null,
    location: postcode ?? place ?? null,
    event_date: iso,
    semantic_query: query,
    categories: [],
    attributes: null,
  };
}


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

/**
 * What the AI extracts from a plain-language brief.
 *
 * Deliberately contains no vertical-specific fields. Anything that varies by
 * trade — dietary needs, capacity, certifications, licences — is matched
 * semantically via `semantic_query` against the vendor's own words, not
 * extracted into typed filters. The only structured outputs are constraints
 * that are universal to every service: where, when, how much.
 *
 * `categories` and `attributes` are NOT produced by the AI. They're set only
 * from UI with known-good values (filter sidebar, quick-start chips, SEO
 * landing pages) — an LLM emitting "nut free" against a stored "nut-free"
 * would silently return nothing, which for a dietary filter is unsafe.
 */
export interface ParsedQuery {
  budget_max: number | null;
  location: string | null;
  event_date: string | null;
  semantic_query: string;
  /** UI-supplied only. */
  categories: string[];
  /** UI-supplied only; jsonb containment against vendor_services.attributes. */
  attributes: Record<string, unknown> | null;
}

interface AIVendorMatch {
  vendor_id: string;
  match_note: string;
  rank: number;
  is_adjacent: boolean;
}

interface AIResult {
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
  vendor_area: string | null;
  vendor_price_from: number | null;
  vendor_price_notes: string | null;
  vendor_rating_avg: number | null;
  vendor_review_count: number;
  vendor_coverage_radius_miles: number;
  service_id: string;
  service_title: string;
  service_category: string | null;
  /** Free-form, vertical-specific. Displayed and embedded, never schema-checked. */
  service_attributes: Record<string, unknown>;
  similarity: number;
  distance_miles: number | null;
}

/** A ParsedQuery with no AI involved — used when the spend cap is reached. */
function bareQuery(
  query: string,
  overrides?: { categories?: string[]; attributes?: Record<string, unknown>; budgetMax?: number },
): ParsedQuery {
  return {
    budget_max: overrides?.budgetMax ?? null,
    location: null,
    event_date: null,
    semantic_query: query,
    categories: overrides?.categories ?? [],
    attributes: overrides?.attributes ?? null,
  };
}

// ── Step 1: Parse user query → structured filters + semantic string ──

async function parseQuery(query: string): Promise<ParsedQuery> {
  if (STUB_AI) return stubParse(query);

  const today = new Date().toISOString().slice(0, 10);
  const response = await anthropic.messages.create({
    // Haiku: this is structured extraction, not reasoning — much faster time-to-cards.
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `You turn a plain-language request for a local service into structured search filters. Today's date is ${today}.

The platform covers every kind of casual service and trade — caterers, plumbers, photographers, cleaners, tutors, DJs, gardeners, mobile bars, lifeguards, anything. Do NOT try to classify the request into a category, and do NOT invent filters for trade-specific requirements. Those are matched semantically.

Extract ONLY these, and only when clearly stated:
- budget_max: a maximum spend in GBP, as a number. null if not mentioned.
- location: a UK place name or postcode. null if not mentioned.
- event_date: if a specific calendar date is implied ("August 15", "next Saturday", "the 3rd"), resolve it to "YYYY-MM-DD" using today's date above. A vague month or season with no day stays null.

For semantic_query: rewrite the whole request as a rich, descriptive sentence describing the service needed, including every qualitative requirement — the kind of work, the occasion, the vibe, and any specific needs (dietary, accessibility, certifications, equipment, experience). This string is matched against how vendors describe themselves, so keep the requirement words in it. Drop only the structured parts you extracted above (budget figures, locations, dates).

Respond with ONLY valid JSON:
{"budget_max": null, "location": null, "event_date": null, "semantic_query": "..."}`,
    messages: [{ role: "user", content: query }],
  });

  try {
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const raw = JSON.parse(extractJSON(text));
    // Model output is untrusted input. budget_max is interpolated into a
    // PostgREST filter string downstream, so coerce it to a finite number
    // rather than trusting the declared type.
    const budget = Number(raw?.budget_max);
    return {
      ...raw,
      budget_max: Number.isFinite(budget) && budget > 0 ? budget : null,
      location: typeof raw?.location === "string" ? raw.location.slice(0, 120) : null,
      event_date: typeof raw?.event_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.event_date)
        ? raw.event_date : null,
      semantic_query: typeof raw?.semantic_query === "string" && raw.semantic_query.trim()
        ? raw.semantic_query.slice(0, 2000) : query,
      categories: [],
      attributes: null,
    };
  } catch {
    return {
      budget_max: null, location: null, event_date: null,
      semantic_query: query,
      categories: [], attributes: null,
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

/**
 * Recently embedded queries, keyed by the semantic string. Repeated and popular
 * briefs are common ("pizza for 50"), and every cache hit is one fewer call
 * against the per-minute limit as well as one fewer thing to pay for.
 */
const embedCache = new Map<string, number[]>();
const EMBED_CACHE_MAX = 500;

function cacheEmbedding(key: string, value: number[]) {
  // Cheap LRU: re-inserting moves a key to the end of Map iteration order.
  if (embedCache.has(key)) embedCache.delete(key);
  embedCache.set(key, value);
  if (embedCache.size > EMBED_CACHE_MAX) {
    embedCache.delete(embedCache.keys().next().value as string);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Embed the query, retrying transient failures.
 *
 * Voyage rate-limits per minute, and a single 429 used to drop the whole search
 * to the non-AI keyword fallback — silently, so a traffic spike quietly made
 * every result worse with nothing to show for it. Retry 429s and 5xx with
 * backoff (honouring Retry-After), and let 4xx fail fast since retrying a bad
 * key or malformed body just wastes the user's time.
 */
async function embedQuery(text: string, attempts = 3): Promise<number[]> {
  const voyageKey = process.env.VOYAGE_API_KEY;
  if (!voyageKey) throw new Error("Missing VOYAGE_API_KEY");

  const cached = embedCache.get(text);
  if (cached) {
    console.log("[embedQuery] cache hit");
    return cached;
  }

  let lastError: Error | null = null;
  const backoff = (attempt: number) =>
    Math.min(2 ** (attempt - 1) * 400, 4_000) + Math.random() * 300;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res: Response;

    // Network-level failures are always worth another go. Kept in its own
    // try/catch so it can't swallow the deliberate non-retryable throw below —
    // that mistake silently turns "fail fast on a bad key" into three attempts.
    try {
      res = await fetch("https://api.voyageai.com/v1/embeddings", {
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
    } catch (err) {
      lastError = err as Error;
      if (attempt === attempts) break;
      await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const embedding = data.data[0].embedding as number[];
      cacheEmbedding(text, embedding);
      return embedding;
    }

    // 4xx other than 429 means the request itself is wrong — a bad key or a
    // malformed body. Retrying just makes the user wait longer for the same
    // failure, so surface it immediately.
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) throw new Error(`Voyage API error ${res.status}`);

    lastError = new Error(`Voyage API error ${res.status}`);
    if (attempt === attempts) break;

    // Prefer the server's own guidance; otherwise exponential backoff with
    // jitter so concurrent searches don't retry in lockstep.
    const retryAfter = Number(res.headers.get("retry-after"));
    const wait =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5_000)
        : backoff(attempt);

    console.warn(
      `[embedQuery] ${res.status}, retry ${attempt}/${attempts - 1} in ${Math.round(wait)}ms`,
    );
    await sleep(wait);
  }

  throw lastError ?? new Error("Voyage embedding failed");
}

/**
 * Test seam for the embedding retry/backoff. Not used by the app — exported so
 * the resilience can be tested without standing up the whole search pipeline.
 */
export function quickSearchEmbedForTest(text: string): Promise<number[]> {
  return embedQuery(text);
}

// ── Step 4: Pre-filter + vector search via match_vendors RPC ──

/** How many matches we pull in one go; the page reveals them a page at a time. */
export const SEARCH_LIMIT = 60;

async function vectorSearch(
  parsed: ParsedQuery,
  queryEmbedding: number[],
  geo: { lat: number; lng: number } | null,
  limit: number = SEARCH_LIMIT,
): Promise<VendorResult[]> {
  const vecStr = `[${queryEmbedding.join(",")}]`;

  const rpcParams = {
    query_embedding: vecStr,
    filter_categories: parsed.categories.length > 0 ? parsed.categories : null,
    filter_attributes: parsed.attributes,
    filter_budget_max: parsed.budget_max,
    search_lat: geo?.lat ?? null,
    search_lng: geo?.lng ?? null,
    match_limit: limit,
  };
  console.log("[vectorSearch] RPC params:", JSON.stringify({
    ...rpcParams,
    query_embedding: `[${queryEmbedding.length} floats]`,
  }));

  const { data, error } = await supabase.rpc("match_vendors", rpcParams);

  if (error) {
    console.error("[vectorSearch] RPC failed:", error.message, error.details, error.hint);
    return fallbackSearch(parsed, limit);
  }

  const results = (data || []) as VendorResult[];
  console.log(`[vectorSearch] returned ${results.length} results`);
  // Trust the RPC order. match_vendors sorts by rank_score = similarity +
  // tier_rank_weight(tier), so paid listings carry their ranking boost. Re-sorting
  // by similarity here would silently throw that boost away — the boost is exactly
  // what vendors pay for, and rank_score isn't returned to sort by instead.
  return results;
}

/**
 * A brief that matches nothing is a dead end, so rather than shrug we widen it
 * one constraint at a time and say what we let go. Order is deliberate: money
 * and headcount are softest, area next, cuisine last. Dietary needs are never
 * relaxed — "vegan" is a requirement, not a preference.
 */
const RELAXATIONS: {
  label: string;
  constraining: (p: ParsedQuery, geo: unknown) => boolean;
  relax: (p: ParsedQuery) => void;
  dropsGeo?: boolean;
}[] = [
  { label: "budget", constraining: (p) => p.budget_max != null, relax: (p) => { p.budget_max = null; } },
  { label: "area", constraining: (_p, geo) => geo != null, relax: () => {}, dropsGeo: true },
  { label: "service type", constraining: (p) => p.categories.length > 0, relax: (p) => { p.categories = []; } },
  // Attributes are never relaxed. They only ever come from an explicit UI
  // filter, so the buyer asked for them deliberately — and "nut-free" or
  // "DBS checked" is a requirement, not a preference.
];

async function searchWithRecovery(
  parsed: ParsedQuery,
  embedding: number[],
  geo: { lat: number; lng: number } | null,
  limit: number,
): Promise<{ results: VendorResult[]; relaxed: string[] }> {
  const results = await vectorSearch(parsed, embedding, geo, limit);
  if (results.length > 0) return { results, relaxed: [] };

  const working: ParsedQuery = { ...parsed, categories: [...parsed.categories] };
  let workingGeo = geo;
  const relaxed: string[] = [];

  for (const step of RELAXATIONS) {
    if (!step.constraining(working, workingGeo)) continue;
    if (step.dropsGeo) workingGeo = null;
    else step.relax(working);
    relaxed.push(step.label);

    const widened = await vectorSearch(working, embedding, workingGeo, limit);
    if (widened.length > 0) {
      console.log(`[searchWithRecovery] recovered after relaxing: ${relaxed.join(", ")}`);
      return { results: widened, relaxed };
    }
  }

  return { results: [], relaxed };
}

// Fallback: basic Supabase query (no vector search)
async function fallbackSearch(parsed: ParsedQuery, limit: number = SEARCH_LIMIT): Promise<VendorResult[]> {
  let query = supabase
    .from("vendor_services")
    .select(`
      id, title, category, attributes, price_from, price_notes,
      vendors!inner ( id, slug, name, description, bio, base_postcode, area,
        rating_avg, review_count, coverage_radius_miles, status )
    `)
    .eq("vendors.status", "live");

  if (parsed.categories.length > 0) {
    query = query.in("category", parsed.categories);
  }
  if (parsed.attributes) {
    query = query.contains("attributes", parsed.attributes);
  }
  if (parsed.budget_max) {
    // Price lives on the service now — filter it there, not on the vendor.
    query = query.or(`price_from.is.null,price_from.lte.${parsed.budget_max}`);
  }

  const { data, error } = await query.order("rating_avg", { referencedTable: "vendors", ascending: false }).limit(limit * 2);
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
      vendor_area: v.area as string | null,
      vendor_price_from: row.price_from as number | null, vendor_price_notes: row.price_notes as string | null,
      vendor_rating_avg: v.rating_avg as number | null, vendor_review_count: v.review_count as number,
      vendor_coverage_radius_miles: v.coverage_radius_miles as number,
      service_id: row.id as string, service_title: row.title as string,
      service_category: row.category as string | null,
      service_attributes: (row.attributes as Record<string, unknown>) ?? {},
      similarity: 0, distance_miles: null,
    });
  }
  return results.slice(0, limit);
}

/**
 * Render free-form attributes as a readable line. Vertical-agnostic by
 * construction — it doesn't know what the keys mean, only how to print them.
 */
export function describeAttributes(attrs: Record<string, unknown> | null | undefined): string | null {
  if (!attrs) return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === "") continue;
    const label = k.replace(/_/g, " ");
    parts.push(Array.isArray(v) ? `${label}: ${v.join(", ")}` : `${label}: ${String(v)}`);
  }
  return parts.length ? parts.join(" · ") : null;
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
        formatLocation(r.vendor_area, r.vendor_base_postcode) ? `Location: ${formatLocation(r.vendor_area, r.vendor_base_postcode)}` : null,
        r.distance_miles != null ? `${r.distance_miles} miles away` : null,
        r.vendor_price_from ? `From £${r.vendor_price_from}` : null,
        r.vendor_price_notes || null,
        r.vendor_rating_avg ? `${r.vendor_rating_avg}★ (${r.vendor_review_count} reviews)` : "New vendor",
        describeAttributes(r.service_attributes),
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
  results: VendorResult[];
  usedFallback: boolean;
  /** Constraints dropped to find anything at all — empty on an exact match. */
  relaxed: string[];
}

export async function quickSearch(
  query: string,
  overrides?: { categories?: string[]; attributes?: Record<string, unknown>; budgetMax?: number },
  limit: number = SEARCH_LIMIT,
  opts?: { useAi?: boolean },
): Promise<QuickSearchResult> {
  // The daily spend cap is enforced by the caller; when it's blown we skip the
  // paid parse/embed entirely rather than calling and discarding.
  if (opts?.useAi === false) {
    const bare = bareQuery(query, overrides);
    return { parsed: bare, results: await fallbackSearch(bare, limit), usedFallback: true, relaxed: [] };
  }

  // Parsing is the only step with no graceful degradation of its own, and it
  // is a paid third-party call: an outage, an expired key, or an exhausted
  // credit balance would otherwise take search down completely. Fall back to
  // the raw query — keyword results are far better than an error box.
  let parsed: ParsedQuery;
  let parseFailed = false;
  try {
    parsed = await parseQuery(query);
  } catch (err) {
    console.error("[quickSearch] parse failed, degrading to keyword search:", err);
    parsed = bareQuery(query, overrides);
    parseFailed = true;
  }

  if (parseFailed) {
    return {
      parsed,
      results: await fallbackSearch(parsed, limit),
      usedFallback: true,
      relaxed: [],
    };
  }

  // Explicit sidebar filters take precedence and become RPC pre-filters, so the
  // vector search only considers eligible vendors (not a post-filter of the top-N).
  // UI-supplied filters. These are the only source of categories/attributes —
  // see the note on ParsedQuery for why the model never produces them.
  if (overrides?.categories?.length) parsed.categories = overrides.categories;
  if (overrides?.attributes && Object.keys(overrides.attributes).length) {
    parsed.attributes = overrides.attributes;
  }
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
  let relaxed: string[] = [];
  let usedFallback = false;
  if (!embedding) {
    results = await fallbackSearch(parsed);
    usedFallback = true;
  } else {
    ({ results, relaxed } = await searchWithRecovery(parsed, embedding, geo, limit));
  }

  return { parsed, results, usedFallback, relaxed };
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
      formatLocation(r.vendor_area, r.vendor_base_postcode),
      r.distance_miles != null ? `${r.distance_miles.toFixed(1)} mi` : null,
      r.vendor_price_from ? `from £${r.vendor_price_from}` : null,
      describeAttributes(r.service_attributes),
    ];
    return parts.filter(Boolean).join(" · ");
  }).join("\n");

  if (STUB_AI) {
    const top = results[0]?.vendor_name;
    return {
      summary: top
        ? `I'd lean <strong>${top}</strong> for this — it's the closest fit on what you described, and the rest of the shortlist covers nearby alternatives.`
        : "",
    };
  }

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
      return { summary: "No vendors match your search.", vendorMatches: [], vendorIds: [] };
    }
    const narration = await narrateResults(query, parsed, results);
    return {
      summary: narration.summary,
      vendorMatches: narration.vendors,
      vendorIds: results.map((r) => r.vendor_id),
    };
  }

  // 4. Pre-filter + vector search
  const results = await vectorSearch(parsed, queryEmbedding, geo, 15);

  if (results.length === 0) {
    return { summary: "No vendors match your search. Try broadening your criteria.", vendorMatches: [], vendorIds: [] };
  }

  // 5. Narrate
  const narration = await narrateResults(query, parsed, results);

  return {
    summary: narration.summary,
    vendorMatches: narration.vendors,
    vendorIds: results.map((r) => r.vendor_id),
  };
}
