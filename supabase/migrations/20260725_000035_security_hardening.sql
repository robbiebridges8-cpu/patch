-- Security hardening from the full-surface audit (2026-07-25).

-- ── S1 (Blocker): profiles.role was client-writable → vendor could PATCH to admin ──
-- A guard trigger blocks role changes by anyone who isn't a platform admin or a
-- privileged backend role. Signup still works: handle_new_user is SECURITY
-- DEFINER and inserts with the owner's privileges (see 000036 for the grant-level
-- backstop, which the app can afford because it never writes profiles directly).
create or replace function public.guard_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('service_role','supabase_admin','postgres')
     and not public.is_admin() then
    raise exception 'changing role is not permitted';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ── S2 (High): vendors could fabricate verified reviews on their own listing ──
create or replace function public.submit_review(p_enquiry_id uuid, p_rating integer, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare e_vendor uuid; e_status text; e_date date; e_details jsonb; r_id uuid;
begin
  select vendor_id, status, event_date, details
    into e_vendor, e_status, e_date, e_details from enquiries where id = p_enquiry_id;
  if e_vendor is null then raise exception 'enquiry not found'; end if;
  if exists (select 1 from vendors where id = e_vendor and owner_id = auth.uid()) then
    raise exception 'you cannot review your own listing';
  end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'rating must be 1-5'; end if;
  if exists (select 1 from reviews where enquiry_id = p_enquiry_id) then raise exception 'already reviewed'; end if;

  insert into reviews (vendor_id, enquiry_id, rating, title, body, event_date, details, verified)
  values (e_vendor, p_enquiry_id, p_rating, nullif(trim(p_title),''), nullif(trim(p_body),''),
          e_date, coalesce(e_details,'{}'::jsonb), e_status = 'booked')
  returning id into r_id;
  return r_id;
end $function$;

-- ── S4 (Medium): analytics + junk-lead poisoning via WITH CHECK(true) ──
-- Require the target to be a real, live vendor. App-layer rate limiting still
-- applies; the residual volume risk needs a WAF (tracked).
drop policy if exists public_insert_enquiries on public.enquiries;
create policy public_insert_enquiries on public.enquiries for insert to anon, authenticated
  with check (exists (select 1 from vendors v where v.id = vendor_id and v.status = 'live'));

drop policy if exists public_insert_contact_events on public.contact_events;
create policy public_insert_contact_events on public.contact_events for insert to anon, authenticated
  with check (exists (select 1 from vendors v where v.id = vendor_id and v.status = 'live'));

-- ── S6 (Low): public bucket allowed anonymous object listing ──
-- The bucket is public, so object URLs still resolve without this SELECT policy.
drop policy if exists vendor_photos_public_read on storage.objects;

-- tier_rank_weight had a mutable search_path (advisor 0011).
alter function public.tier_rank_weight(smallint) set search_path = public, pg_temp;
