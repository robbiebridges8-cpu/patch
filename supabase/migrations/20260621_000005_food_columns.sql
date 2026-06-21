-- Migration 005: Add structured filter columns to vendor_services + vector search RPC.
--
-- category: canonical chip label for FilterSidebar pre-filtering.
-- Controlled vocab: Pizza, Burgers, Tacos, BBQ, Grazing, Coffee cart, Desserts.
--
-- dietary_options: structured flags buyers filter on.
-- Controlled vocab: vegan, vegetarian, gluten-free, halal, dairy-free, nut-free.

ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS secondary_categories text[] NOT NULL DEFAULT '{}';
ALTER TABLE vendor_services ADD COLUMN IF NOT EXISTS dietary_options text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_vs_category ON vendor_services (category);
NOTIFY pgrst, 'reload schema';

-- Vector search function: pre-filters + cosine similarity.
-- Called from ai.ts via supabase.rpc('match_vendors', ...).
CREATE OR REPLACE FUNCTION match_vendors(
  query_embedding vector(1024),
  filter_categories text[] DEFAULT NULL,
  filter_dietary text[] DEFAULT NULL,
  filter_guest_count int DEFAULT NULL,
  filter_budget_max numeric DEFAULT NULL,
  search_lat double precision DEFAULT NULL,
  search_lng double precision DEFAULT NULL,
  match_limit int DEFAULT 15
)
RETURNS TABLE (
  vendor_id uuid,
  vendor_slug text,
  vendor_name text,
  vendor_description text,
  vendor_bio text,
  vendor_base_postcode text,
  vendor_price_from numeric,
  vendor_price_notes text,
  vendor_rating_avg numeric,
  vendor_review_count int,
  vendor_coverage_radius_miles numeric,
  service_id uuid,
  service_title text,
  service_category text,
  service_dietary_options text[],
  service_capacity_min int,
  service_capacity_max int,
  similarity double precision,
  distance_miles double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT ON (v.id)
    v.id, v.slug, v.name, v.description, v.bio, v.base_postcode,
    v.price_from, v.price_notes, v.rating_avg, v.review_count,
    v.coverage_radius_miles,
    vs.id, vs.title, vs.category, vs.dietary_options,
    vs.capacity_min, vs.capacity_max,
    (1 - (vs.embedding <=> query_embedding))::double precision,
    CASE
      WHEN search_lat IS NOT NULL AND v.base_location IS NOT NULL
      THEN round((ST_Distance(
        v.base_location,
        ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
      ) / 1609.34)::numeric, 1)::double precision
      ELSE NULL
    END
  FROM vendor_services vs
  JOIN vendors v ON v.id = vs.vendor_id
  WHERE v.status = 'live'
    AND vs.embedding IS NOT NULL
    AND (filter_categories IS NULL OR vs.category = ANY(filter_categories))
    AND (filter_dietary IS NULL OR vs.dietary_options @> filter_dietary)
    AND (filter_guest_count IS NULL OR vs.capacity_max IS NULL OR vs.capacity_max >= filter_guest_count)
    AND (filter_guest_count IS NULL OR vs.capacity_min IS NULL OR vs.capacity_min <= filter_guest_count)
    AND (filter_budget_max IS NULL OR v.price_from IS NULL OR v.price_from <= filter_budget_max)
    AND (
      search_lat IS NULL OR v.base_location IS NULL
      OR ST_DWithin(v.base_location, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography, v.coverage_radius_miles * 1609.34)
    )
  ORDER BY v.id, (1 - (vs.embedding <=> query_embedding)) DESC
$$;
