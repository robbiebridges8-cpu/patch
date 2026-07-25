-- Powers /services/[category]/[location] pages: vendors of a category whose
-- coverage radius reaches a given point, ranked by the same tier boost + rating
-- the search uses. SECURITY INVOKER — runs under the caller's RLS (anon sees
-- only live vendors), so no data leaks.
create or replace function public.vendors_in_area(
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 24
)
returns table(
  vendor_id uuid, slug text, name text, description text, area text,
  base_postcode text, rating_avg numeric, review_count integer, tier smallint,
  price_from numeric, service_title text, distance_miles double precision
)
language sql stable set search_path to 'public','pg_temp' as $$
  select v.id, v.slug, v.name, v.description, v.area, v.base_postcode,
    v.rating_avg, v.review_count, v.tier, vs.price_from, vs.title,
    round((ST_Distance(v.base_location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) / 1609.34)::numeric, 1)::double precision
  from vendors v
  join vendor_services vs on vs.vendor_id = v.id
  where v.status = 'live'
    and vs.category = p_category
    and v.base_location is not null
    and ST_DWithin(v.base_location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, v.coverage_radius_miles * 1609.34)
  order by (tier_rank_weight(v.tier) + coalesce(v.rating_avg, 0) / 5) desc, v.review_count desc nulls last
  limit greatest(coalesce(p_limit, 24), 1)
$$;

grant execute on function public.vendors_in_area(text, double precision, double precision, integer) to anon, authenticated;
