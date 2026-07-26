-- Buyer accounts: role model fix + claim-by-email, so a buyer can recover their
-- enquiries across devices. Login itself is optional and post-enquiry.

-- handle_new_user hardcoded role='vendor' for every signup. Default to 'buyer',
-- let a signup opt into 'vendor' via metadata (the vendor login sets it), and
-- make 'admin' unreachable this way. Listing creation upgrades buyer→vendor.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $function$
begin
  insert into public.profiles (id, role, email, display_name)
  values (
    new.id,
    case when new.raw_user_meta_data->>'intended_role' = 'vendor' then 'vendor'::user_role else 'buyer'::user_role end,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $function$;

-- Anyone who creates a listing is a vendor (never downgrade an admin). Runs as
-- definer, so the guard_profile_role trigger permits it.
create or replace function public.create_vendor_listing(p_name text, p_category text, p_description text, p_postcode text, p_lat double precision, p_lng double precision)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $function$
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

  update public.profiles set role = 'vendor'
    where id = auth.uid() and role not in ('vendor', 'admin');

  return v_id;
end $function$;

-- Buyer can read their own enquiries once logged in.
drop policy if exists buyer_read_enquiries on public.enquiries;
create policy buyer_read_enquiries on public.enquiries for select to authenticated
  using (buyer_id = auth.uid());

-- Claim-by-email: on login, attach past anonymous enquiries to the account.
-- Matches only the caller's own verified email, only unclaimed rows.
create or replace function public.claim_my_enquiries()
returns integer language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_email text; v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  update public.enquiries
    set buyer_id = auth.uid()
    where buyer_id is null and lower(buyer_email) = lower(v_email);
  get diagnostics v_count = row_count;
  return v_count;
end $function$;

grant execute on function public.claim_my_enquiries() to authenticated;
