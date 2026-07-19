-- Web Push subscriptions for the vendor control panel.
-- Applied to remote 2026-07-19.
--
-- Speed of response wins jobs, so a push the moment a lead lands is the one
-- thing an installed app does that the website genuinely cannot. Buyers stay on
-- the plain website: their journey is SEO-driven and once-every-18-months, so
-- there is nothing for them to install, and an app would cut the acquisition
-- channel the whole model depends on.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  -- Unique because a browser re-subscribing returns the same endpoint; we want
  -- an upsert rather than a duplicate per device.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subs_vendor_idx on public.push_subscriptions (vendor_id);
alter table public.push_subscriptions enable row level security;

-- An endpoint plus its keys is enough to send someone a push, so these are
-- credentials, not metadata: no anon access at all, and a vendor sees only
-- their own. Verified in a rolled-back transaction — anon reads 0 rows and
-- cannot insert; vendor B reads 0 of vendor A's and cannot subscribe to them.
create policy "owner_read_push_subs" on public.push_subscriptions
  for select to authenticated
  using (vendor_id in (select id from public.vendors where owner_id = auth.uid()));

create policy "owner_insert_push_subs" on public.push_subscriptions
  for insert to authenticated
  with check (vendor_id in (select id from public.vendors where owner_id = auth.uid()));

create policy "owner_delete_push_subs" on public.push_subscriptions
  for delete to authenticated
  using (vendor_id in (select id from public.vendors where owner_id = auth.uid()));

comment on table public.push_subscriptions is
  'Web Push credentials for the vendor PWA. Endpoint + keys are enough to send a push, so treat as secrets: no anon access, and sending requires the service role.';
