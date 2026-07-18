-- `featured` was stored and toggleable in admin but read by nothing, so
-- promoting a vendor changed exactly nothing a buyer saw.
--
-- It now applies a small ranking boost rather than pinning featured vendors to
-- the top: relevance still decides the shortlist, and a featured vendor that
-- genuinely doesn't fit the brief stays where it belongs. A hard pin would make
-- the "reasoned shortlist" promise dishonest.
-- Applied to remote 2026-07-18. Measured: a vendor ranked 30th moves to 18th;
-- the top result and top-5 relevance are unchanged.
create or replace function public.match_vendors(
  query_embedding vector,
  filter_categories text[] default null::text[],
  filter_dietary text[] default null::text[],
  filter_guest_count integer default null::integer,
  filter_budget_max numeric default null::numeric,
  search_lat double precision default null::double precision,
  search_lng double precision default null::double precision,
  match_limit integer default 15
)
returns table(
  vendor_id uuid, vendor_slug text, vendor_name text, vendor_description text,
  vendor_bio text, vendor_base_postcode text, vendor_price_from numeric,
  vendor_price_notes text, vendor_rating_avg numeric, vendor_review_count integer,
  vendor_coverage_radius_miles numeric, service_id uuid, service_title text,
  service_category text, service_dietary_options text[], service_capacity_min integer,
  service_capacity_max integer, similarity double precision, distance_miles double precision
)
language sql stable set search_path to 'public', 'pg_temp'
as $function$
  SELECT
    ranked.vendor_id, ranked.vendor_slug, ranked.vendor_name, ranked.vendor_description,
    ranked.vendor_bio, ranked.vendor_base_postcode, ranked.vendor_price_from,
    ranked.vendor_price_notes, ranked.vendor_rating_avg, ranked.vendor_review_count,
    ranked.vendor_coverage_radius_miles, ranked.service_id, ranked.service_title,
    ranked.service_category, ranked.service_dietary_options, ranked.service_capacity_min,
    ranked.service_capacity_max, ranked.similarity, ranked.distance_miles
  FROM (
    SELECT DISTINCT ON (v.id)
      v.id as vendor_id,
      v.slug as vendor_slug,
      v.name as vendor_name,
      v.description as vendor_description,
      v.bio as vendor_bio,
      v.base_postcode as vendor_base_postcode,
      v.price_from as vendor_price_from,
      v.price_notes as vendor_price_notes,
      v.rating_avg as vendor_rating_avg,
      v.review_count as vendor_review_count,
      v.coverage_radius_miles as vendor_coverage_radius_miles,
      vs.id as service_id,
      vs.title as service_title,
      vs.category as service_category,
      vs.dietary_options as service_dietary_options,
      vs.capacity_min as service_capacity_min,
      vs.capacity_max as service_capacity_max,
      (1 - (vs.embedding <=> query_embedding))::double precision as similarity,
      -- Featured adds a fixed 0.03 to the cosine score: enough to win a close
      -- call, nowhere near enough to surface an irrelevant vendor.
      ((1 - (vs.embedding <=> query_embedding)) + CASE WHEN v.featured THEN 0.03 ELSE 0 END)::double precision as rank_score,
      CASE
        WHEN search_lat IS NOT NULL AND v.base_location IS NOT NULL
        THEN round((ST_Distance(
          v.base_location,
          ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
        ) / 1609.34)::numeric, 1)::double precision
        ELSE NULL
      END as distance_miles
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
        search_lat IS NULL
        OR v.base_location IS NULL
        OR ST_DWithin(
          v.base_location,
          ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
          v.coverage_radius_miles * 1609.34
        )
      )
    ORDER BY v.id, (1 - (vs.embedding <=> query_embedding)) DESC
  ) ranked
  ORDER BY ranked.rank_score DESC
  LIMIT greatest(coalesce(match_limit, 15), 1)
$function$;
