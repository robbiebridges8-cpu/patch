-- Vertical-agnostic schema. Applied to remote 2026-07-18.
--
-- The platform is a catch-all services marketplace, not a food one. Typed
-- food/party columns (dietary_options, capacity, guest_count, age_min...) don't
-- generalise to a plumber or a one-off lifeguard, and the previous pivot from
-- kids-parties already left age_min/age_max behind as dead weight. Rather than
-- add a per-vertical attribute registry — unmaintainable at 1,000+ verticals —
-- everything vertical-specific moves into a free-form `attributes` jsonb that
-- is folded into the embedding, and only genuinely universal constraints
-- (location, price, availability) remain as columns.
--
-- Verified before applying: containment on the migrated jsonb returns exactly
-- the same 299 vendors for {"dietary":["vegan"]} as the old text[] column did,
-- so the dietary hard filter (a safety property) survives the move.

alter table public.vendor_services add column if not exists attributes jsonb not null default '{}'::jsonb;
update public.vendor_services set attributes = jsonb_strip_nulls(jsonb_build_object(
  'dietary',          case when coalesce(array_length(dietary_options,1),0)>0 then to_jsonb(dietary_options) else null end,
  'capacity_min',     capacity_min,
  'capacity_max',     capacity_max,
  'setting',          nullif(setting::text,''),
  'duration_minutes', duration_minutes
));

alter table public.vendors add column if not exists attributes jsonb not null default '{}'::jsonb;
update public.vendors set attributes = jsonb_strip_nulls(jsonb_build_object(
  'dietary', case when coalesce(array_length(dietary_options,1),0)>0 then to_jsonb(dietary_options) else null end));

-- jsonb_path_ops: smaller and faster than the default for pure @> containment,
-- which is the only operator the attribute filter uses.
create index if not exists vendor_services_attributes_gin
  on public.vendor_services using gin (attributes jsonb_path_ops);

alter table public.vendor_services
  drop column if exists dietary_options, drop column if exists capacity_min,
  drop column if exists capacity_max, drop column if exists setting,
  drop column if exists duration_minutes, drop column if exists age_min,
  drop column if exists age_max, drop column if exists service_type;
alter table public.vendors drop column if exists dietary_options;

alter table public.enquiries rename column party_date to event_date;
alter table public.enquiries rename column party_postcode to postcode;
alter table public.enquiries add column if not exists details jsonb not null default '{}'::jsonb;
update public.enquiries set details = jsonb_strip_nulls(jsonb_build_object('guest_count', guest_count));
alter table public.enquiries drop column if exists guest_count;

alter table public.reviews rename column party_date to event_date;
alter table public.reviews add column if not exists details jsonb not null default '{}'::jsonb;
update public.reviews set details = jsonb_strip_nulls(jsonb_build_object(
  'guest_count', guest_count, 'child_age', child_age));
alter table public.reviews drop column if exists guest_count, drop column if exists child_age;

-- match_vendors: generic attribute containment instead of typed filters.
-- `filter_attributes` is only ever set from UI with known-good values (the
-- dietary sidebar, quick-start chips, SEO landing pages). The AI parse never
-- emits it — an LLM writing "nut free" against a stored "nut-free" would
-- silently return nothing, and for a dietary filter that failure is unsafe.
drop function if exists public.match_vendors(vector, text[], text[], integer, numeric, double precision, double precision, integer);

create or replace function public.match_vendors(
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
  vendor_coverage_radius_miles numeric, service_id uuid, service_title text,
  service_category text, service_attributes jsonb,
  similarity double precision, distance_miles double precision
)
language sql stable set search_path to 'public', 'pg_temp'
as $function$
  SELECT
    ranked.vendor_id, ranked.vendor_slug, ranked.vendor_name, ranked.vendor_description,
    ranked.vendor_bio, ranked.vendor_base_postcode, ranked.vendor_price_from,
    ranked.vendor_price_notes, ranked.vendor_rating_avg, ranked.vendor_review_count,
    ranked.vendor_coverage_radius_miles, ranked.service_id, ranked.service_title,
    ranked.service_category, ranked.service_attributes,
    ranked.similarity, ranked.distance_miles
  FROM (
    SELECT DISTINCT ON (v.id)
      v.id as vendor_id, v.slug as vendor_slug, v.name as vendor_name,
      v.description as vendor_description, v.bio as vendor_bio,
      v.base_postcode as vendor_base_postcode, v.price_from as vendor_price_from,
      v.price_notes as vendor_price_notes, v.rating_avg as vendor_rating_avg,
      v.review_count as vendor_review_count,
      v.coverage_radius_miles as vendor_coverage_radius_miles,
      vs.id as service_id, vs.title as service_title, vs.category as service_category,
      vs.attributes as service_attributes,
      (1 - (vs.embedding <=> query_embedding))::double precision as similarity,
      ((1 - (vs.embedding <=> query_embedding)) + CASE WHEN v.featured THEN 0.03 ELSE 0 END)::double precision as rank_score,
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

-- Dependent functions that referenced the dropped columns.
create or replace function public.create_vendor_listing(
  p_name text, p_category text, p_description text,
  p_postcode text, p_lat double precision, p_lng double precision)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
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
  insert into vendor_services (vendor_id, category, title, description)
  values (v_id, nullif(p_category,''), p_name, nullif(p_description,''));
  return v_id;
end $function$;

create or replace function public.submit_review(
  p_enquiry_id uuid, p_rating integer, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare e_vendor uuid; e_status text; e_date date; e_details jsonb; r_id uuid;
begin
  select vendor_id, status, event_date, details
    into e_vendor, e_status, e_date, e_details from enquiries where id = p_enquiry_id;
  if e_vendor is null then raise exception 'enquiry not found'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5'; end if;
  if exists (select 1 from reviews where enquiry_id = p_enquiry_id) then raise exception 'already reviewed'; end if;
  insert into reviews (vendor_id, enquiry_id, rating, title, body, event_date, details, verified)
  values (e_vendor, p_enquiry_id, p_rating, nullif(trim(p_title),''), nullif(trim(p_body),''),
          e_date, coalesce(e_details,'{}'::jsonb), e_status = 'booked')
  returning id into r_id;
  return r_id;
end $function$;
