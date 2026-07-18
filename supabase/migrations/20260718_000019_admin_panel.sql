-- Admin panel: vendor approval, review moderation, featuring, platform stats.
-- Applied to remote 2026-07-18.

alter table public.vendors add column if not exists featured boolean not null default false;
alter table public.reviews add column if not exists hidden boolean not null default false;

create index if not exists vendors_featured_idx on public.vendors (featured) where featured;

-- SECURITY DEFINER so the profiles lookup bypasses RLS — otherwise an admin
-- policy on profiles that calls this would recurse.
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public, pg_temp stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Hidden reviews disappear for everyone but admins.
drop policy if exists "public_read_reviews" on public.reviews;
create policy "public_read_reviews" on public.reviews
  for select to anon, authenticated
  using (not hidden or public.is_admin());

-- Moderation has to move the headline numbers too, or hiding a review would
-- leave its stars in rating_avg. Recompute over visible reviews only.
create or replace function public.update_vendor_rating()
returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  target_vendor_id uuid;
begin
  if tg_op = 'DELETE' then
    target_vendor_id := old.vendor_id;
  elsif tg_op = 'UPDATE' and old.vendor_id <> new.vendor_id then
    update vendors set rating_avg = sub.avg_r, review_count = sub.cnt
    from (
      select coalesce(round(avg(rating)::numeric, 2), null) as avg_r, count(*)::int as cnt
      from reviews where vendor_id = old.vendor_id and not hidden
    ) sub
    where vendors.id = old.vendor_id;
    target_vendor_id := new.vendor_id;
  else
    target_vendor_id := new.vendor_id;
  end if;

  update vendors set rating_avg = sub.avg_r, review_count = sub.cnt
  from (
    select coalesce(round(avg(rating)::numeric, 2), null) as avg_r, count(*)::int as cnt
    from reviews where vendor_id = target_vendor_id and not hidden
  ) sub
  where vendors.id = target_vendor_id;

  return null;
end; $$;

-- Admin reach. Every policy is additive to the existing owner/public ones.
create policy "admin_read_vendors" on public.vendors
  for select to authenticated using (public.is_admin());
create policy "admin_update_vendors" on public.vendors
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin_update_reviews" on public.reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_reviews" on public.reviews
  for delete to authenticated using (public.is_admin());

create policy "admin_read_enquiries" on public.enquiries
  for select to authenticated using (public.is_admin());
create policy "admin_read_profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- Platform stats in one guarded round trip.
create or replace function public.admin_stats()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not permitted';
  end if;

  select jsonb_build_object(
    'vendors_total',      (select count(*) from vendors),
    'vendors_live',       (select count(*) from vendors where status = 'live'),
    'vendors_draft',      (select count(*) from vendors where status = 'draft'),
    'vendors_paused',     (select count(*) from vendors where status = 'paused'),
    'vendors_rejected',   (select count(*) from vendors where status = 'rejected'),
    'vendors_featured',   (select count(*) from vendors where featured),
    'vendors_claimed',    (select count(*) from vendors where owner_id is not null),
    'enquiries_total',    (select count(*) from enquiries),
    'enquiries_30d',      (select count(*) from enquiries where created_at > now() - interval '30 days'),
    'enquiries_booked',   (select count(*) from enquiries where status = 'booked'),
    'messages_total',     (select count(*) from messages),
    'reviews_total',      (select count(*) from reviews),
    'reviews_hidden',     (select count(*) from reviews where hidden),
    'reviews_30d',        (select count(*) from reviews where created_at > now() - interval '30 days'),
    'profiles_total',     (select count(*) from profiles),
    'avg_rating',         (select round(avg(rating)::numeric, 2) from reviews where not hidden)
  ) into result;

  return result;
end; $$;

revoke all on function public.admin_stats() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- To grant yourself access after signing up:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
