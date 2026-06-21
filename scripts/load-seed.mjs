#!/usr/bin/env node
/**
 * Idempotent seed loader: loads vendors.json into Supabase.
 * - Upserts vendors by slug (re-runnable).
 * - Creates one vendor_service per vendor with structured columns.
 * - Geocodes place names → postcodes.io → lat/lng.
 *
 * Usage: node scripts/load-seed.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env ──
const envPath = resolve(__dirname, "../.env.local");
const envText = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Load seed data ──
const vendors = JSON.parse(
  readFileSync(resolve(__dirname, "../seed/vendors.json"), "utf-8")
);

// ── Category mapping: rich free-text → canonical FilterSidebar chip ──
const CATEGORY_MAP = {
  "pizza vans / wood-fired pizza trailers": "Pizza",
  "burger trucks and trailers": "Burgers",
  "taco trucks and Mexican": "Tacos",
  "BBQ and smoker catering": "BBQ",
  "grazing tables and charcuterie": "Grazing",
  "coffee carts and mobile baristas": "Coffee cart",
  "dessert vans (donuts, churros, crepes, waffles)": "Desserts",
  "ice cream vans and gelato carts": "Desserts",
  "bao, dumplings, and Asian street food": "Tacos",
  "Indian street food (chaat, dosa, curries)": "Tacos",
  "Middle Eastern (falafel, mezze, shawarma)": "Tacos",
  "pie and mash / British comfort": "BBQ",
  "vegan and plant-based specialists": "Grazing",
  "cocktail bars and mobile bartenders": "Coffee cart",
  "drop-off canapés and finger food": "Grazing",
};

// ── Place name → representative postcode/outcode ──
// postcodes.io needs postcodes, not place names. These are representative
// postcodes for each London area in the seed data.
const PLACE_TO_POSTCODE = {
  "Hackney": "E8 1DY",
  "Hackney Wick": "E9 5EN",
  "Hackney Central": "E8 1HP",
  "Stoke Newington": "N16 7XJ",
  "Islington": "N1 2XG",
  "Dalston": "E8 2PB",
  "Walthamstow": "E17 7JR",
  "Walthamstow Village": "E17 6QX",
  "Camden": "NW1 8QS",
  "Shoreditch": "EC2A 3AY",
  "Bermondsey": "SE1 3XB",
  "Tottenham": "N17 8AS",
  "Tottenham Hale": "N17 9LR",
  "Hampstead": "NW3 1QE",
  "Peckham": "SE15 5EW",
  "Clapton": "E5 8BQ",
  "Leyton": "E10 5NR",
  "Bethnal Green": "E2 6DG",
  "Brixton": "SW2 1JF",
  "Wembley": "HA9 0WS",
  "Hoxton": "N1 6TA",
  "Southall": "UB1 3HB",
  "Borough": "SE1 1TL",
  "Green Lanes": "N4 2HA",
  "Finsbury Park": "N4 2DH",
  "Tooting": "SW17 7ER",
  "Wood Green": "N22 6YQ",
  "Muswell Hill": "N10 3PJ",
  "Stratford": "E15 1XE",
  "Whitechapel": "E1 1BB",
  "Seven Sisters": "N15 5NE",
  "Angel": "N1 9LQ",
  "Kings Cross": "N1C 4AG",
  "Crystal Palace": "SE19 2BT",
  "Brick Lane": "E1 6QL",
  "Kings Cross canal": "N1C 4PF",
};

// ── Geocode postcodes via postcodes.io (bulk, max 100) ──
async function geocodePostcodes(postcodes) {
  const unique = [...new Set(postcodes.filter(Boolean))];
  const results = new Map();

  // postcodes.io bulk endpoint, max 100 per request
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const res = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: batch }),
    });
    const data = await res.json();
    for (const item of data.result) {
      if (item.result) {
        results.set(item.query, {
          lat: item.result.latitude,
          lng: item.result.longitude,
          postcode: item.result.postcode,
        });
      }
    }
  }
  return results;
}

// ── Controlled dietary vocab ──
const VALID_DIETARY = new Set([
  "vegan", "vegetarian", "gluten-free", "halal", "dairy-free", "nut-free",
]);
function normaliseDietary(options) {
  return (options || []).filter((d) => VALID_DIETARY.has(d));
}

// ── Main ──
async function main() {
  console.log(`Loading ${vendors.length} vendors from seed...`);

  // Step 1: Resolve place names to postcodes
  const postcodes = vendors.map((v) => {
    const pc = PLACE_TO_POSTCODE[v.base_location];
    if (!pc) return null;
    return pc;
  });

  const unresolved = vendors.filter((v) => !PLACE_TO_POSTCODE[v.base_location]);
  if (unresolved.length > 0) {
    console.error("\n⚠ UNRESOLVED PLACE NAMES (no postcode mapping):");
    for (const v of unresolved) {
      console.error(`  - "${v.base_location}" (${v.name}, ${v.slug})`);
    }
    console.error("");
  }

  // Step 2: Geocode all postcodes via postcodes.io
  const validPostcodes = postcodes.filter(Boolean);
  console.log(`Geocoding ${validPostcodes.length} postcodes via postcodes.io...`);
  const geoMap = await geocodePostcodes(validPostcodes);

  const failedGeo = validPostcodes.filter((pc) => !geoMap.has(pc));
  if (failedGeo.length > 0) {
    console.error("\n⚠ FAILED GEOCODING (postcodes.io returned no result):");
    for (const pc of [...new Set(failedGeo)]) {
      console.error(`  - ${pc}`);
    }
    console.error("");
  }

  // Step 3: Upsert vendors
  let vendorOk = 0;
  let vendorErr = 0;
  let serviceOk = 0;

  for (const v of vendors) {
    const postcode = PLACE_TO_POSTCODE[v.base_location] || null;
    const geo = postcode ? geoMap.get(postcode) : null;

    const vendorRow = {
      id: v.id,
      slug: v.slug,
      name: v.name,
      description: v.short_description || null,
      status: "live",
      contact_email: null,
      contact_phone: null,
      website: v.website_url || null,
      instagram: v.instagram_handle || null,
      base_postcode: geo ? geo.postcode : (postcode || null),
      base_location: geo ? `SRID=4326;POINT(${geo.lng} ${geo.lat})` : null,
      coverage_radius_miles: v.travel_radius_miles || 10,
      price_from: v.starting_price_gbp || null,
      price_notes: v.pricing_notes || null,
      bio: v.long_description || null,
      min_lead_days: v.lead_time_days || 7,
    };

    // Upsert vendor by id
    const { error: vendErr } = await supabase
      .from("vendors")
      .upsert(vendorRow, { onConflict: "id" });

    if (vendErr) {
      console.error(`✗ Vendor "${v.name}": ${vendErr.message}`);
      vendorErr++;
      continue;
    }
    vendorOk++;

    // Upsert one service per vendor (delete existing first for idempotency)
    await supabase.from("vendor_services").delete().eq("vendor_id", v.id);

    const serviceRow = {
      vendor_id: v.id,
      service_type: "other",
      title: v.name,
      description: v.short_description || null,
      capacity_min: v.typical_event_size?.min || null,
      capacity_max: v.typical_event_size?.max || null,
      setting: "either",
      price_from: v.starting_price_gbp || null,
      category: CATEGORY_MAP[v.primary_category] || null,
      secondary_categories: (v.secondary_categories || []).map(
        (c) => CATEGORY_MAP[c] || c
      ),
      dietary_options: normaliseDietary(v.dietary_options),
    };

    const { error: svcErr } = await supabase
      .from("vendor_services")
      .insert(serviceRow);

    if (svcErr) {
      console.error(`  ✗ Service for "${v.name}": ${svcErr.message}`);
    } else {
      serviceOk++;
    }
  }

  console.log(`\n✓ Vendors: ${vendorOk} ok, ${vendorErr} errors`);
  console.log(`✓ Services: ${serviceOk} created`);

  if (unresolved.length > 0) {
    console.log(`⚠ ${unresolved.length} vendors have no geocoded location`);
  }

  // Verify
  const { count } = await supabase
    .from("vendors")
    .select("*", { count: "exact", head: true })
    .eq("status", "live");
  console.log(`\nDatabase now has ${count} live vendors.`);
}

main().catch(console.error);
