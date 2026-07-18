-- Vendor tiers replace the `featured` boolean. Applied to remote 2026-07-18.
--
-- Three points on one ordered axis rather than three flags: free (0) sits
-- below paid in search and has its leads locked, standard (1) is the normal
-- paid listing, pro (2) gets featured placement. An integer means adding a
-- fourth tier later is a config change, not a billing-data migration.

alter table public.vendors add column if not exists tier smallint not null default 0;
update public.vendors set tier = case when featured then 2 else 0 end;
alter table public.vendors drop constraint if exists vendors_tier_range;
alter table public.vendors add constraint vendors_tier_range check (tier between 0 and 2);
create index if not exists vendors_tier_idx on public.vendors (tier) where tier > 0;
alter table public.vendors drop column if exists featured;

alter table public.subscriptions add column if not exists plan_tier smallint not null default 1;
alter table public.subscriptions add column if not exists billing_interval text not null default 'month';
alter table public.subscriptions drop constraint if exists subscriptions_interval_check;
alter table public.subscriptions add constraint subscriptions_interval_check
  check (billing_interval in ('month', 'year'));

-- Weights are additive on cosine similarity rather than a hard sort by tier.
-- A hard sort would put an irrelevant paid vendor above a perfect free match,
-- which makes the "reasoned shortlist" promise a lie. This way paid wins all
-- close calls without the buyer ever being handed a bad result.
--
-- Measured on the live corpus: promoting a vendor ranked 40th to pro moved it
-- to 12th, and standard moved 45th to 17th, while position 1 stayed a free
-- vendor because relevance still won. These three numbers are the dial —
-- widen the gap as paid supply grows.
create or replace function public.tier_rank_weight(p_tier smallint)
returns double precision language sql immutable as $$
  select case coalesce(p_tier, 0)
    when 0 then -0.12   -- free: below paid for comparable relevance
    when 2 then  0.04   -- pro: featured placement
    else 0.0            -- standard
  end;
$$;

drop function if exists public.match_vendors(vector, text[], jsonb, numeric, double precision, double precision, integer);

create function public.match_vendors(
  query_embedding vector,
  filter_categories text[] default null::text[],
  filter_attributes jsonb default null::jsonb,
  filter_budget_max numeric default null::numeric,
  search_lat double precision default null::double precision,
  search_lng double precision default null::double precision,
  match_limit integer default 15
)
returns table(
  vendor_id uuid, vendor_slug text, vendor_name text, vendor_description text,
  vendor_bio text, vendor_base_postcode text, vendor_price_from numeric,
  vendor_price_notes text, vendor_rating_avg numeric, vendor_review_count integer,
  vendor_coverage_radius_miles numeric, vendor_tier smallint,
  service_id uuid, service_title text, service_category text, service_attributes jsonb,
  similarity double precision, distance_miles double precision
)
language sql stable set search_path to 'public', 'pg_temp'
as $function$
  SELECT
    ranked.vendor_id, ranked.vendor_slug, ranked.vendor_name, ranked.vendor_description,
    ranked.vendor_bio, ranked.vendor_base_postcode, ranked.vendor_price_from,
    ranked.vendor_price_notes, ranked.vendor_rating_avg, ranked.vendor_review_count,
    ranked.vendor_coverage_radius_miles, ranked.vendor_tier,
    ranked.service_id, ranked.service_title, ranked.service_category, ranked.service_attributes,
    ranked.similarity, ranked.distance_miles
  FROM (
    SELECT DISTINCT ON (v.id)
      v.id as vendor_id, v.slug as vendor_slug, v.name as vendor_name,
      v.description as vendor_description, v.bio as vendor_bio,
      v.base_postcode as vendor_base_postcode, v.price_from as vendor_price_from,
      v.price_notes as vendor_price_notes, v.rating_avg as vendor_rating_avg,
      v.review_count as vendor_review_count,
      v.coverage_radius_miles as vendor_coverage_radius_miles,
      v.tier as vendor_tier,
      vs.id as service_id, vs.title as service_title, vs.category as service_category,
      vs.attributes as service_attributes,
      (1 - (vs.embedding <=> query_embedding))::double precision as similarity,
      ((1 - (vs.embedding <=> query_embedding)) + tier_rank_weight(v.tier))::double precision as rank_score,
      CASE
        WHEN search_lat IS NOT NULL AND v.base_location IS NOT NULL
        THEN round((ST_Distance(v.base_location,
              ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography) / 1609.34)::numeric, 1)::double precision
        ELSE NULL
      END as distance_miles
    FROM vendor_services vs
    JOIN vendors v ON v.id = vs.vendor_id
    WHERE v.status = 'live'
      AND vs.embedding IS NOT NULL
      AND (filter_categories IS NULL OR vs.category = ANY(filter_categories))
      AND (filter_attributes IS NULL OR vs.attributes @> filter_attributes)
      AND (filter_budget_max IS NULL OR v.price_from IS NULL OR v.price_from <= filter_budget_max)
      AND (
        search_lat IS NULL OR v.base_location IS NULL
        OR ST_DWithin(v.base_location,
             ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
             v.coverage_radius_miles * 1609.34)
      )
    ORDER BY v.id, (1 - (vs.embedding <=> query_embedding)) DESC
  ) ranked
  ORDER BY ranked.rank_score DESC
  LIMIT greatest(coalesce(match_limit, 15), 1)
$function$;

create or replace function public.admin_stats()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not permitted'; end if;
  select jsonb_build_object(
    'vendors_total',    (select count(*) from vendors),
    'vendors_live',     (select count(*) from vendors where status = 'live'),
    'vendors_draft',    (select count(*) from vendors where status = 'draft'),
    'vendors_paused',   (select count(*) from vendors where status = 'paused'),
    'vendors_rejected', (select count(*) from vendors where status = 'rejected'),
    'vendors_free',     (select count(*) from vendors where tier = 0),
    'vendors_standard', (select count(*) from vendors where tier = 1),
    'vendors_pro',      (select count(*) from vendors where tier = 2),
    'vendors_claimed',  (select count(*) from vendors where owner_id is not null),
    'enquiries_total',  (select count(*) from enquiries),
    'enquiries_30d',    (select count(*) from enquiries where created_at > now() - interval '30 days'),
    'enquiries_booked', (select count(*) from enquiries where status = 'booked'),
    'messages_total',   (select count(*) from messages),
    'reviews_total',    (select count(*) from reviews),
    'reviews_hidden',   (select count(*) from reviews where hidden),
    'reviews_30d',      (select count(*) from reviews where created_at > now() - interval '30 days'),
    'profiles_total',   (select count(*) from profiles),
    'avg_rating',       (select round(avg(rating)::numeric, 2) from reviews where not hidden)
  ) into result;
  return result;
end; $$;
