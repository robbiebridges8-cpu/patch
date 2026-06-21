#!/usr/bin/env node
/**
 * Embedding backfill: composes text from each vendor_service + its vendor's
 * soft descriptive fields, calls Voyage voyage-3 (1024 dim), writes the
 * vector to vendor_services.embedding.
 *
 * Incremental: only embeds rows where embedding IS NULL.
 * Re-runnable: safe to call repeatedly.
 *
 * TODO: trigger this on vendor_service INSERT/UPDATE (clear embedding on
 * text change so the next backfill run picks it up).
 *
 * Usage: VOYAGE_API_KEY=... node scripts/embed-services.mjs
 * Or add VOYAGE_API_KEY to .env.local
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

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  console.error("Missing VOYAGE_API_KEY. Set it in .env.local or pass as env var.");
  process.exit(1);
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Load seed data for soft fields (vibe_tags, occasion_fit, etc.) ──
// These fields live in the seed JSON, not in the DB — they're embedding-only.
const seedVendors = JSON.parse(
  readFileSync(resolve(__dirname, "../seed/vendors.json"), "utf-8")
);
const seedById = new Map(seedVendors.map((v) => [v.id, v]));

// ── Compose embedding input text ──
function composeEmbeddingText(service, vendor, seed) {
  const parts = [];

  // Category context (rich free-text, not the canonical chip)
  if (seed?.primary_category) parts.push(seed.primary_category);

  // Service title + description
  parts.push(service.title);
  if (service.description) parts.push(service.description);

  // Vendor bio (long description)
  if (vendor.bio) parts.push(vendor.bio);

  // Soft fields from seed (these are the core of semantic matching)
  if (seed?.signature_items?.length) {
    parts.push("Signature items: " + seed.signature_items.join(", "));
  }
  if (seed?.vibe_tags?.length) {
    parts.push("Vibe: " + seed.vibe_tags.join(", "));
  }
  if (seed?.occasion_fit?.length) {
    parts.push("Good for: " + seed.occasion_fit.join(", "));
  }
  if (seed?.dietary_options?.length) {
    parts.push("Dietary: " + seed.dietary_options.join(", "));
  }
  if (seed?.setup_requirements) {
    parts.push("Setup: " + seed.setup_requirements);
  }
  if (seed?.peak_season) {
    parts.push("Peak season: " + seed.peak_season);
  }
  if (seed?.founder_story) {
    parts.push(seed.founder_story);
  }
  if (seed?.booking_notes) {
    parts.push(seed.booking_notes);
  }
  if (seed?.reviews_sample?.length) {
    parts.push("Reviews: " + seed.reviews_sample.join(" | "));
  }

  return parts.join("\n\n");
}

// ── Call Voyage API ──
async function embedBatch(texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "voyage-3",
      input: texts,
      input_type: "document",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

// ── Main ──
async function main() {
  // Fetch services that need embedding (embedding IS NULL)
  const { data: services, error } = await supabase
    .from("vendor_services")
    .select("id, vendor_id, title, description")
    .is("embedding", null);

  if (error) {
    console.error("Failed to fetch services:", error.message);
    process.exit(1);
  }

  if (services.length === 0) {
    console.log("All services already have embeddings. Nothing to do.");
    return;
  }

  console.log(`${services.length} services need embeddings.`);

  // Fetch their vendors
  const vendorIds = [...new Set(services.map((s) => s.vendor_id))];
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, bio, description")
    .in("id", vendorIds);

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  // Compose texts
  const texts = services.map((svc) => {
    const vendor = vendorMap.get(svc.vendor_id);
    const seed = seedById.get(svc.vendor_id);
    return composeEmbeddingText(svc, vendor, seed);
  });

  // Embed in batches. Use small batches + delay to stay within free-tier
  // rate limits (3 RPM, 10K TPM without payment method).
  const BATCH_SIZE = 2;
  const DELAY_MS = 21_000; // ~3 requests per minute
  let embedded = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batchTexts = texts.slice(i, i + BATCH_SIZE);
    const batchServices = services.slice(i, i + BATCH_SIZE);

    try {
      const embeddings = await embedBatch(batchTexts);

      for (let j = 0; j < embeddings.length; j++) {
        const vec = `[${embeddings[j].join(",")}]`;
        const { error: updateErr } = await supabase
          .from("vendor_services")
          .update({ embedding: vec })
          .eq("id", batchServices[j].id);

        if (updateErr) {
          console.error(`  ✗ ${batchServices[j].title}: ${updateErr.message}`);
        } else {
          embedded++;
        }
      }

      console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`);
    } catch (err) {
      console.error(`  ✗ Batch ${i}-${i + BATCH_SIZE}: ${err.message}`);
      // On rate limit, wait longer and retry once
      if (err.message.includes("429")) {
        console.log("  Rate limited, waiting 30s...");
        await new Promise((r) => setTimeout(r, 30_000));
        i -= BATCH_SIZE; // retry this batch
        continue;
      }
    }

    // Rate limit delay between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n✓ ${embedded}/${services.length} services embedded.`);

  // Verify
  const { count } = await supabase
    .from("vendor_services")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);
  console.log(`Database now has ${count} services with embeddings.`);
}

main().catch(console.error);
