-- Public bucket for vendor photos; files live under {vendorId}/{filename}.
-- Applied to remote 2026-07-16.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-photos', 'vendor-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "vendor_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vendor-photos');

create policy "vendor_photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] in (select id::text from public.vendors where owner_id = auth.uid())
  );

create policy "vendor_photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vendor-photos'
    and (storage.foldername(name))[1] in (select id::text from public.vendors where owner_id = auth.uid())
  );
