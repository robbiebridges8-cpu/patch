-- Homepage citable stats. Computes the counts in SQL rather than fetching every
-- live vendor's area and deduping in JS (which is wasteful and silently
-- undercounts past PostgREST's ~1000-row response cap).
create or replace function public.platform_stats()
returns table(vendor_count integer, area_count integer)
language sql stable set search_path to 'public','pg_temp' as $$
  select count(*)::int, count(distinct area)::int
  from vendors where status = 'live';
$$;

grant execute on function public.platform_stats() to anon, authenticated;
