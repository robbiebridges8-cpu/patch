-- Price belongs to the service, not the business.
--
-- vendors.price_from duplicated vendor_services.price_from (identical for all
-- 500 rows) and was the vestige of a 1:1 vendor:service model. A vendor that
-- lists two services needs two prices, so price is authored on the service and
-- search reads it there. price_notes moves with it — it explains the price.
-- vendors.price_range stays: it's a categorical £-band for schema.org
-- structured data (an establishment-level property), not a price anyone pays.

alter table public.vendor_services add column if not exists price_notes text;
alter table public.vendor_services drop constraint if exists vendor_services_price_notes_len;
alter table public.vendor_services add constraint vendor_services_price_notes_len check (length(price_notes) <= 500);
update public.vendor_services vs set price_notes = v.price_notes
  from public.vendors v where v.id = vs.vendor_id and vs.price_notes is null;

-- match_vendors now filters on and returns the service price.
drop function if exists public.match_vendors(vector, text[], jsonb, numeric, double precision, double precision, integer);
create function public.match_vendors(
  query_embedding vector, filter_categories text[] default null::text[], filter_attributes jsonb default null::jsonb,
  filter_budget_max numeric default null::numeric, search_lat double precision default null::double precision,
  search_lng double precision default null::double precision, match_limit integer default 15)
returns table(
  vendor_id uuid, vendor_slug text, vendor_name text, vendor_description text, vendor_bio text,
  vendor_base_postcode text, vendor_area text, vendor_price_from numeric, vendor_price_notes text,
  vendor_rating_avg numeric, vendor_review_count integer, vendor_coverage_radius_miles numeric,
  vendor_tier smallint, service_id uuid, service_title text, service_category text,
  service_attributes jsonb, similarity double precision, distance_miles double precision)
language sql stable set search_path to 'public','pg_temp' as $fn$
  select ranked.vendor_id, ranked.vendor_slug, ranked.vendor_name, ranked.vendor_description,
    ranked.vendor_bio, ranked.vendor_base_postcode, ranked.vendor_area, ranked.vendor_price_from,
    ranked.vendor_price_notes, ranked.vendor_rating_avg, ranked.vendor_review_count,
    ranked.vendor_coverage_radius_miles, ranked.vendor_tier, ranked.service_id, ranked.service_title,
    ranked.service_category, ranked.service_attributes, ranked.similarity, ranked.distance_miles
  from (
    select distinct on (v.id)
      v.id as vendor_id, v.slug as vendor_slug, v.name as vendor_name, v.description as vendor_description,
      v.bio as vendor_bio, v.base_postcode as vendor_base_postcode, v.area as vendor_area,
      vs.price_from as vendor_price_from, vs.price_notes as vendor_price_notes,
      v.rating_avg as vendor_rating_avg, v.review_count as vendor_review_count,
      v.coverage_radius_miles as vendor_coverage_radius_miles, v.tier as vendor_tier,
      vs.id as service_id, vs.title as service_title, vs.category as service_category,
      vs.attributes as service_attributes,
      (1 - (vs.embedding <=> query_embedding))::double precision as similarity,
      ((1 - (vs.embedding <=> query_embedding)) + tier_rank_weight(v.tier))::double precision as rank_score,
      case when search_lat is not null and v.base_location is not null
        then round((ST_Distance(v.base_location, ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography)/1609.34)::numeric,1)::double precision
        else null end as distance_miles
    from vendor_services vs join vendors v on v.id = vs.vendor_id
    where v.status='live' and vs.embedding is not null
      and (filter_categories is null or vs.category = any(filter_categories))
      and (filter_attributes is null or vs.attributes @> filter_attributes)
      and (filter_budget_max is null or vs.price_from is null or vs.price_from <= filter_budget_max)
      and (search_lat is null or v.base_location is null
        or ST_DWithin(v.base_location, ST_SetSRID(ST_MakePoint(search_lng,search_lat),4326)::geography, v.coverage_radius_miles*1609.34))
    order by v.id, (1 - (vs.embedding <=> query_embedding)) desc
  ) ranked order by ranked.rank_score desc limit greatest(coalesce(match_limit,15),1)
$fn$;

alter table public.vendors drop column if exists price_from, drop column if exists price_notes;
