-- Human-readable area names alongside postcodes. Applied to remote 2026-07-19.
--
-- Buyers don't think in postcodes — they think "somewhere in Hackney". Leading
-- with a postcode is friction when asking and false precision when displaying
-- (listings store an outward code, not a street address). The area name becomes
-- the primary label and the outward code goes in brackets: "Hackney (E8)".
--
-- admin_district (borough) rather than admin_ward: ward names are sometimes the
-- name people actually use ("Stoke Newington") and sometimes not ("Rye Lane",
-- "Stockwell East"). Borough is always recognisable and needs no curated
-- exception list — the same reasoning that removed the category taxonomy.
--
-- Backfilled by scripts/backfill-areas.mjs. Note that resolution goes via the
-- outcode CENTROID, reverse-geocoded: /outcodes returns every borough an
-- outcode touches but the list is ALPHABETICAL, so taking the first entry gives
-- W2 -> Ealing and SE15 -> Lewisham, both wrong.

alter table public.vendors add column if not exists area text;

comment on column public.vendors.area is
  'Human-readable district from postcodes.io admin_district (e.g. "Hackney"). Display as "{area} ({outcode})". Backfilled by scripts/backfill-areas.mjs.';

create index if not exists vendors_area_idx on public.vendors (area) where area is not null;

-- match_vendors returns it so search cards can label locations the same way.
-- (Full function body in 20260719_000030; this migration only adds the column.)
