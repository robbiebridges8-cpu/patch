-- In-platform messaging: one thread per enquiry, buyer <-> vendor.
-- Applied to remote 2026-07-18.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  sender text not null check (sender in ('buyer', 'vendor')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_by_buyer boolean not null default false,
  read_by_vendor boolean not null default false
);

create index if not exists messages_enquiry_created_idx
  on public.messages (enquiry_id, created_at);

alter table public.messages enable row level security;

-- Vendors: read + send on threads for listings they own. No UPDATE policy —
-- read receipts go through mark_thread_read() so bodies stay immutable.
create policy "owner_read_messages" on public.messages
  for select to authenticated
  using (enquiry_id in (
    select e.id from public.enquiries e
    join public.vendors v on v.id = e.vendor_id
    where v.owner_id = auth.uid()
  ));

create policy "owner_send_messages" on public.messages
  for insert to authenticated
  with check (sender = 'vendor' and enquiry_id in (
    select e.id from public.enquiries e
    join public.vendors v on v.id = e.vendor_id
    where v.owner_id = auth.uid()
  ));

-- Buyers are anonymous: the (unguessable) enquiry id is their capability token,
-- matching the existing enquiry_status() tracker. Access via definer functions.
create or replace function public.enquiry_thread(p_enquiry_id uuid)
returns table (id uuid, sender text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.messages m set read_by_buyer = true
   where m.enquiry_id = p_enquiry_id and m.sender = 'vendor' and not m.read_by_buyer;
  return query
    select m.id, m.sender, m.body, m.created_at
    from public.messages m
    where m.enquiry_id = p_enquiry_id
    order by m.created_at;
end; $$;

create or replace function public.send_buyer_message(p_enquiry_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'empty message';
  end if;
  if not exists (select 1 from public.enquiries e where e.id = p_enquiry_id) then
    raise exception 'enquiry not found';
  end if;
  insert into public.messages (enquiry_id, sender, body, read_by_buyer)
  values (p_enquiry_id, 'buyer', left(btrim(p_body), 4000), true)
  returning id into v_id;
  return v_id;
end; $$;

-- Vendor read receipts (owner-checked, since there is no UPDATE policy).
create or replace function public.mark_thread_read(p_enquiry_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (
    select 1 from public.enquiries e
    join public.vendors v on v.id = e.vendor_id
    where e.id = p_enquiry_id and v.owner_id = auth.uid()
  ) then
    raise exception 'not permitted';
  end if;
  update public.messages m set read_by_vendor = true
   where m.enquiry_id = p_enquiry_id and m.sender = 'buyer' and not m.read_by_vendor;
end; $$;

-- Buyer tracker now also carries thread counts (one round trip on /enquiries).
drop function if exists public.enquiry_status(uuid[]);
create or replace function public.enquiry_status(p_ids uuid[])
returns table (
  id uuid, status text, vendor_name text, vendor_slug text,
  message_count integer, unread_count integer
)
language sql security definer set search_path = public, pg_temp stable as $$
  select e.id, e.status::text, v.name, v.slug,
         (select count(*)::int from public.messages m where m.enquiry_id = e.id),
         (select count(*)::int from public.messages m
           where m.enquiry_id = e.id and m.sender = 'vendor' and not m.read_by_buyer)
  from public.enquiries e
  join public.vendors v on v.id = e.vendor_id
  where e.id = any(p_ids);
$$;

revoke all on function public.enquiry_thread(uuid) from public;
revoke all on function public.send_buyer_message(uuid, text) from public;
revoke all on function public.mark_thread_read(uuid) from public;
revoke all on function public.enquiry_status(uuid[]) from public;
grant execute on function public.enquiry_thread(uuid) to anon, authenticated;
grant execute on function public.send_buyer_message(uuid, text) to anon, authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.enquiry_status(uuid[]) to anon, authenticated;
