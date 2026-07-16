-- Vendors can update the status/response of leads for listings they own.
-- Applied to remote 2026-07-16.
create policy "owner_update_enquiries" on public.enquiries
  for update to authenticated
  using (vendor_id in (select id from public.vendors where owner_id = auth.uid()))
  with check (vendor_id in (select id from public.vendors where owner_id = auth.uid()));
