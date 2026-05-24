import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";

const anthropic = new Anthropic();

const SCHEMA = `Postgres schema for a mobile food and catering vendor marketplace in London:

- vendors: id (uuid), slug, name, description (long text about the vendor), status ('draft'/'live'/'paused'/'rejected'), base_postcode (London neighbourhood e.g. 'Hackney Wick', 'Dalston', 'Islington'), coverage_radius_miles, price_from (starting price GBP), price_notes (pricing details), bio (founder story), rating_avg (numeric), review_count (int), primary_category (text, e.g. 'pizza vans / wood-fired pizza trailers', 'burger trucks and trailers', 'BBQ and smoker catering', 'taco trucks and Mexican', 'grazing tables and charcuterie', 'ice cream vans and gelato carts', 'dessert vans', 'coffee carts and mobile baristas', 'drop-off canapés and finger food', 'bao, dumplings, and Asian street food', 'Indian street food', 'Middle Eastern', 'pie and mash / British comfort', 'vegan and plant-based specialists', 'cocktail bars and mobile bartenders'), secondary_categories (text[]), dietary_options (text[] e.g. vegetarian/vegan/gluten-free/dairy-free/halal/kosher/nut-free), vibe_tags (text[]), occasion_fit (text[] e.g. weddings/milestone birthdays/corporate events/private parties/festivals), typical_event_size_min (int), typical_event_size_max (int), price_range (text: £/££/£££), signature_items (jsonb array of dish names), booking_notes, setup_requirements, peak_season, years_active
- reviews: id, vendor_id, rating (1-5), title, body, verified (bool)

Always filter vendors.status = 'live'. Prices in GBP. Use ILIKE for text search. Use array operators (@> or &&) for array columns.`;

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

export async function aiSearch(query: string): Promise<AIResult> {
  // Step 1: text → SQL + chips
  const parseResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `${SCHEMA}

You convert parent search queries into SQL. Generate a SELECT that finds matching vendors. Rules:
- Only SELECT, never mutations
- Always filter status = 'live'
- Return: v.id, v.slug, v.name, v.description, v.base_postcode, v.price_from, v.price_to, v.rating_avg, v.review_count, v.bio
- JOIN vendor_services/tags/vendor_coverage_areas as needed
- Use DISTINCT ON (v.id) or GROUP BY to avoid duplicates
- Order by relevance (rating, review_count, price fit)
- LIMIT 15
- Also extract "chips" — key filters understood from the query

Respond with ONLY valid JSON, no markdown: {"sql": "SELECT ...", "chips": ["Age 5", "SW11", ...]}`,
    messages: [{ role: "user", content: query }],
  });

  let sql: string;
  let chips: string[];

  try {
    const parsed = JSON.parse(
      parseResponse.content[0].type === "text" ? parseResponse.content[0].text : "{}"
    );
    sql = parsed.sql;
    chips = parsed.chips || [];

    if (!/^\s*SELECT\b/i.test(sql) || /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(sql)) {
      throw new Error("Unsafe query");
    }
  } catch {
    sql = `SELECT DISTINCT v.id, v.slug, v.name, v.description, v.base_postcode, v.price_from, v.price_to, v.rating_avg, v.review_count, v.bio FROM vendors v WHERE v.status = 'live' ORDER BY v.review_count DESC NULLS LAST LIMIT 15`;
    chips = [query];
  }

  // Step 2: SQL → results
  let vendors: Record<string, unknown>[];
  try {
    const { data, error } = await supabase.rpc("exec_readonly_sql", { query_text: sql });
    if (error) throw error;
    vendors = (data as Record<string, unknown>[]) || [];
  } catch {
    // Fallback to basic fetch
    const { data } = await supabase
      .from("vendors")
      .select("id, slug, name, description, base_postcode, price_from, price_to, rating_avg, review_count, bio")
      .eq("status", "live")
      .order("review_count", { ascending: false })
      .limit(15);
    vendors = (data || []) as Record<string, unknown>[];
  }

  if (vendors.length === 0) {
    return { chips, summary: "No vendors match your search. Try broadening your criteria.", vendorMatches: [] as { vendor_id: string; match_note: string; rank: number; is_adjacent: boolean }[], vendorIds: [] as string[] };
  }

  // Step 3: results → text
  const vendorList = vendors
    .map((v, i) => `${i + 1}. [${v.id}] ${v.name} (${v.base_postcode}) — ${v.description || ""} | From £${v.price_from || "?"} | ${v.rating_avg || "new"} stars (${v.review_count || 0} reviews)`)
    .join("\n");

  const narrateResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: `You are Patch, an AI that helps parents find kids' party vendors in SW London. Given a parent's search and matching vendors, you:

1. Write a "summary" (2-3 sentences) — contextualise results, be opinionated, sound like a knowledgeable friend not a search engine.
2. For each vendor, write a "match_note" (1-2 sentences) explaining fit. Use <strong> for key highlights. Be specific about ages, prices, why they work for THIS party.
3. Set "is_adjacent": true for vendors that don't perfectly match but are worth considering (e.g. a face painter when they asked for entertainment = good add-on).
4. Rank by fit (rank 1 = best).

Respond with ONLY valid JSON, no markdown:
{"summary": "...", "vendors": [{"vendor_id": "uuid", "match_note": "...", "rank": 1, "is_adjacent": false}, ...]}`,
    messages: [{ role: "user", content: `Parent searched: "${query}"\n\nVendors found:\n${vendorList}` }],
  });

  try {
    const narration = JSON.parse(
      narrateResponse.content[0].type === "text" ? narrateResponse.content[0].text : "{}"
    );
    return {
      chips,
      summary: narration.summary || "",
      vendorMatches: narration.vendors || [],
      vendorIds: vendors.map((v) => v.id as string),
    };
  } catch {
    return {
      chips,
      summary: `Found ${vendors.length} vendors matching your search.`,
      vendorMatches: vendors.map((v, i) => ({
        vendor_id: v.id as string,
        match_note: (v.description as string) || "",
        rank: i + 1,
        is_adjacent: false,
      })),
      vendorIds: vendors.map((v) => v.id as string),
    };
  }
}
