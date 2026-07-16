-- Public read so the buyer-side "free on your date" check works; owner manages
-- their own blocked dates via the availability calendar. Applied 2026-07-16.
create policy "public_read_blocked" on public.vendor_blocked_dates
  for select to anon, authenticated using (true);
create policy "owner_insert_blocked" on public.vendor_blocked_dates
  for insert to authenticated
  with check (vendor_id in (select id from public.vendors where owner_id = auth.uid()));
create policy "owner_delete_blocked" on public.vendor_blocked_dates
  for delete to authenticated
  using (vendor_id in (select id from public.vendors where owner_id = auth.uid()));
