-- Centralize the "can this user manage this vendor?" predicate into ONE function.
--
-- Until now the check `owner_id = auth.uid()` was copy-pasted into ~19 RLS
-- policies across 9 tables (+ storage) and inlined in 3 SECURITY DEFINER RPCs.
-- Moving to multi-user vendors (a `vendor_members` join table) would have meant
-- re-auditing every one of those — a security-critical sweep. By routing them all
-- through `public.auth_can_manage_vendor(uuid)`, that future move becomes a change
-- to THIS function's body alone: swap `vendors.owner_id = auth.uid()` for
-- `exists (select 1 from vendor_members where vendor_id = p_vendor_id
--          and user_id = auth.uid())` and backfill members from owner_id.
--
-- This migration is behaviour-preserving: the function returns exactly what the
-- old inline check did (verified against live data before applying).
--
-- SECURITY DEFINER + locked search_path: the inner vendors read bypasses RLS, so
-- (a) using it inside vendors' own policies can't recurse, and (b) it stays
-- correct when called from the storage schema or any table.

create or replace function public.auth_can_manage_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vendors
    where id = p_vendor_id and owner_id = auth.uid()
  );
$$;

-- Only `authenticated` needs it (every owner policy is TO authenticated). Supabase
-- default privileges re-grant anon on new public functions, so revoke it explicitly.
revoke all on function public.auth_can_manage_vendor(uuid) from public;
revoke execute on function public.auth_can_manage_vendor(uuid) from anon;
grant execute on function public.auth_can_manage_vendor(uuid) to authenticated;

-- ── vendors (self) ────────────────────────────────────────────────────────────
-- NB: claim_unowned_vendor is deliberately NOT touched — it gates claiming an
-- *unowned* listing (owner_id IS NULL), which is not a "manage what you own" check.
drop policy if exists "owner_select_vendors" on public.vendors;
create policy "owner_select_vendors" on public.vendors
  for select to authenticated
  using (public.auth_can_manage_vendor(id));

drop policy if exists "owner_update_vendors" on public.vendors;
create policy "owner_update_vendors" on public.vendors
  for update to authenticated
  using (public.auth_can_manage_vendor(id))
  with check (public.auth_can_manage_vendor(id));

-- ── enquiries ─────────────────────────────────────────────────────────────────
drop policy if exists "owner_read_enquiries" on public.enquiries;
create policy "owner_read_enquiries" on public.enquiries
  for select to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

drop policy if exists "owner_update_enquiries" on public.enquiries;
create policy "owner_update_enquiries" on public.enquiries
  for update to authenticated
  using (public.auth_can_manage_vendor(vendor_id))
  with check (public.auth_can_manage_vendor(vendor_id));

-- ── messages (scoped by the enquiry's vendor) ─────────────────────────────────
drop policy if exists "owner_read_messages" on public.messages;
create policy "owner_read_messages" on public.messages
  for select to authenticated
  using (enquiry_id in (
    select e.id from public.enquiries e
    where public.auth_can_manage_vendor(e.vendor_id)
  ));

drop policy if exists "owner_send_messages" on public.messages;
create policy "owner_send_messages" on public.messages
  for insert to authenticated
  with check (sender = 'vendor' and enquiry_id in (
    select e.id from public.enquiries e
    where public.auth_can_manage_vendor(e.vendor_id)
  ));

-- ── vendor_photos ─────────────────────────────────────────────────────────────
drop policy if exists "owner_insert_photos" on public.vendor_photos;
create policy "owner_insert_photos" on public.vendor_photos
  for insert to authenticated
  with check (public.auth_can_manage_vendor(vendor_id));

drop policy if exists "owner_update_photos" on public.vendor_photos;
create policy "owner_update_photos" on public.vendor_photos
  for update to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

drop policy if exists "owner_delete_photos" on public.vendor_photos;
create policy "owner_delete_photos" on public.vendor_photos
  for delete to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

-- ── vendor_services ───────────────────────────────────────────────────────────
drop policy if exists "owner_update_services" on public.vendor_services;
create policy "owner_update_services" on public.vendor_services
  for update to authenticated
  using (public.auth_can_manage_vendor(vendor_id))
  with check (public.auth_can_manage_vendor(vendor_id));

-- ── subscriptions ─────────────────────────────────────────────────────────────
drop policy if exists "owner_read_subscription" on public.subscriptions;
create policy "owner_read_subscription" on public.subscriptions
  for select to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

-- ── vendor_blocked_dates ──────────────────────────────────────────────────────
drop policy if exists "owner_insert_blocked" on public.vendor_blocked_dates;
create policy "owner_insert_blocked" on public.vendor_blocked_dates
  for insert to authenticated
  with check (public.auth_can_manage_vendor(vendor_id));

drop policy if exists "owner_delete_blocked" on public.vendor_blocked_dates;
create policy "owner_delete_blocked" on public.vendor_blocked_dates
  for delete to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

-- ── contact_events (owner OR admin — preserved) ───────────────────────────────
drop policy if exists "owner_read_contact_events" on public.contact_events;
create policy "owner_read_contact_events" on public.contact_events
  for select to authenticated
  using (public.auth_can_manage_vendor(vendor_id) or public.is_admin());

-- ── push_subscriptions ────────────────────────────────────────────────────────
drop policy if exists "owner_read_push_subs" on public.push_subscriptions;
create policy "owner_read_push_subs" on public.push_subscriptions
  for select to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

drop policy if exists "owner_insert_push_subs" on public.push_subscriptions;
create policy "owner_insert_push_subs" on public.push_subscriptions
  for insert to authenticated
  with check (public.auth_can_manage_vendor(vendor_id));

drop policy if exists "owner_delete_push_subs" on public.push_subscriptions;
create policy "owner_delete_push_subs" on public.push_subscriptions
  for delete to authenticated
  using (public.auth_can_manage_vendor(vendor_id));

-- ── storage.objects (vendor-photos bucket) ────────────────────────────────────
-- The first path segment is the vendor id. Guard the ::uuid cast with a shape
-- check so a malformed folder name denies (as the old text-IN check did) rather
-- than raising.
drop policy if exists "vendor_photos_owner_insert" on storage.objects;
create policy "vendor_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.auth_can_manage_vendor(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "vendor_photos_owner_delete" on storage.objects;
create policy "vendor_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.auth_can_manage_vendor(((storage.foldername(name))[1])::uuid)
  );

-- ── SECURITY DEFINER RPCs that inlined the same check ─────────────────────────
-- Re-created verbatim except the ownership gate, which now calls the helper.

create or replace function public.mark_thread_read(p_enquiry_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.enquiries e
    where e.id = p_enquiry_id and public.auth_can_manage_vendor(e.vendor_id)
  ) then
    raise exception 'not permitted';
  end if;
  update public.messages m set read_by_vendor = true
   where m.enquiry_id = p_enquiry_id and m.sender = 'buyer' and not m.read_by_vendor;
end; $$;

create or replace function public.submit_review(p_enquiry_id uuid, p_rating integer, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare e_vendor uuid; e_status text; e_date date; e_details jsonb; r_id uuid;
begin
  select vendor_id, status, event_date, details
    into e_vendor, e_status, e_date, e_details from enquiries where id = p_enquiry_id;
  if e_vendor is null then raise exception 'enquiry not found'; end if;
  if public.auth_can_manage_vendor(e_vendor) then
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

create or replace function public.vendor_analytics(p_vendor_id uuid, p_days integer default 30)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable as $$
declare
  result jsonb;
  since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));
  prev_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1) * 2);
begin
  if not (public.auth_can_manage_vendor(p_vendor_id) or public.is_admin()) then
    raise exception 'not permitted';
  end if;

  select jsonb_build_object(
    'days', greatest(coalesce(p_days, 30), 1),
    'views', (
      select count(distinct coalesce(session_id, id::text))
      from contact_events
      where vendor_id = p_vendor_id and event_type = 'profile_view' and created_at >= since
    ),
    'views_prev', (
      select count(distinct coalesce(session_id, id::text))
      from contact_events
      where vendor_id = p_vendor_id and event_type = 'profile_view'
        and created_at >= prev_since and created_at < since
    ),
    'enquiries', (
      select count(*) from enquiries
      where vendor_id = p_vendor_id and created_at >= since
    ),
    'enquiries_prev', (
      select count(*) from enquiries
      where vendor_id = p_vendor_id and created_at >= prev_since and created_at < since
    ),
    'enquiries_total', (select count(*) from enquiries where vendor_id = p_vendor_id),
    'contact_clicks', (
      select count(*) from contact_events
      where vendor_id = p_vendor_id
        and event_type in ('click_contact', 'reveal_phone', 'visit_website')
        and created_at >= since
    ),
    'saves', (
      select count(*) from contact_events
      where vendor_id = p_vendor_id and event_type = 'save' and created_at >= since
    ),
    -- Daily view counts for the window, zero-filled so the chart has no gaps.
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', d::date, 'v', c) order by d), '[]'::jsonb)
      from (
        select gs.d,
               (select count(distinct coalesce(ce.session_id, ce.id::text))
                  from contact_events ce
                 where ce.vendor_id = p_vendor_id
                   and ce.event_type = 'profile_view'
                   and ce.created_at >= gs.d and ce.created_at < gs.d + interval '1 day') as c
        from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') gs(d)
      ) days
    )
  ) into result;

  return result;
end; $$;
