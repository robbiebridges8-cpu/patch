-- Vendor analytics: let owners read their own traffic, and aggregate it.
-- Applied to remote 2026-07-18.

-- The dashboard always queries one vendor over a recent window; the existing
-- single-column indexes make that two scans and a merge.
create index if not exists idx_ce_vendor_created
  on public.contact_events (vendor_id, created_at desc);

-- Owners (and admins) can read events for their own listings. Anon stays
-- insert-only, so buyers can log events but never read anyone's traffic.
create policy "owner_read_contact_events" on public.contact_events
  for select to authenticated
  using (
    vendor_id in (select id from public.vendors where owner_id = auth.uid())
    or public.is_admin()
  );

/**
 * Aggregated traffic for one listing. SECURITY DEFINER with an explicit
 * ownership check so a vendor can never pass someone else's id.
 * Views are counted per distinct session, not per request, so a buyer
 * refreshing a profile doesn't inflate the number. Note `daily` counts
 * uniques *per day*, so summing it exceeds the window total by design.
 */
create or replace function public.vendor_analytics(p_vendor_id uuid, p_days integer default 30)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable as $$
declare
  result jsonb;
  since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1));
  prev_since timestamptz := now() - make_interval(days => greatest(coalesce(p_days, 30), 1) * 2);
begin
  if not exists (
    select 1 from public.vendors v
    where v.id = p_vendor_id and (v.owner_id = auth.uid() or public.is_admin())
  ) then
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

revoke all on function public.vendor_analytics(uuid, integer) from public;
grant execute on function public.vendor_analytics(uuid, integer) to authenticated;
