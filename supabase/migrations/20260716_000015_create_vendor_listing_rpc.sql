-- Lets a signed-in vendor create their own draft listing (vendor + service) with
-- a unique slug + geocoded PostGIS point. SECURITY DEFINER but hard-checks
-- auth.uid() and only assigns the caller as owner. Applied 2026-07-16.
create or replace function public.create_vendor_listing(
  p_name text, p_category text, p_description text,
  p_postcode text, p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_slug text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'name required'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if v_slug = '' then v_slug := 'vendor'; end if;
  if exists (select 1 from vendors where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end if;
  insert into vendors (name, slug, primary_category, description, base_postcode, base_location,
                       status, owner_id, coverage_radius_miles)
  values (p_name, v_slug, nullif(p_category,''), nullif(p_description,''), upper(nullif(p_postcode,'')),
          case when p_lat is not null and p_lng is not null
               then ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography else null end,
          'draft', auth.uid(), 10)
  returning id into v_id;
  insert into vendor_services (vendor_id, service_type, category, title, description, setting)
  values (v_id, 'other', nullif(p_category,''), p_name, nullif(p_description,''), 'either');
  return v_id;
end $$;
revoke all on function public.create_vendor_listing(text, text, text, text, double precision, double precision) from public, anon;
grant execute on function public.create_vendor_listing(text, text, text, text, double precision, double precision) to authenticated;
