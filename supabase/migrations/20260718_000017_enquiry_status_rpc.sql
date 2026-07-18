-- Buyer "my enquiries" tracker: read live status of enquiries you hold the ids
-- for (no account needed). Applied to remote 2026-07-18.
create or replace function public.enquiry_status(p_ids uuid[])
returns table(id uuid, status text, vendor_name text, vendor_slug text)
language sql security definer set search_path = public, pg_temp stable as $$
  select e.id, e.status::text, v.name, v.slug
  from enquiries e join vendors v on v.id = e.vendor_id
  where e.id = any(p_ids);
$$;
revoke all on function public.enquiry_status(uuid[]) from public;
grant execute on function public.enquiry_status(uuid[]) to anon, authenticated;
