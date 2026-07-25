-- Schema refactor: honest names, no dead weight, buyer identity added.
-- Applied to remote 2026-07-25. Verified in a rolled-back transaction first;
-- all application code updated before applying.
--
-- A. Fold embedding-only soft arrays (vibe_tags, occasion_fit) into the
--    vertical-agnostic `attributes` bag as `vibe` / `good_for`.
-- B. Rename enquiries.parent_* -> buyer_* (kids-party legacy; means "buyer").
-- C. Add enquiries.buyer_id (nullable FK auth.users) — the structural gap.
--    Enquiries stay anonymous at send; a buyer claims them by email on login.
-- D-H. Drop dead/duplicated columns (parent_id, child_age, setting, query_id
--    on enquiries; query_id on contact_events; secondary_categories on
--    vendor_services; vibe_tags/occasion_fit on vendors; plan_price_monthly on
--    subscriptions — price lives in lib/tiers.ts).
-- I. Rename user_role value 'parent' -> 'buyer'.
-- J. Drop 6 dead tables: queries, tags, vendor_tag_assignments, service_pricing,
--    vendor_coverage_areas, vendor_schedules.
-- K. Drop orphaned enum types: service_type, setting_type, tag_category, day_type.

update public.vendors set attributes = attributes
  || case when coalesce(array_length(vibe_tags,1),0)>0 then jsonb_build_object('vibe', to_jsonb(vibe_tags)) else '{}'::jsonb end
  || case when coalesce(array_length(occasion_fit,1),0)>0 then jsonb_build_object('good_for', to_jsonb(occasion_fit)) else '{}'::jsonb end;

alter table public.enquiries rename column parent_name to buyer_name;
alter table public.enquiries rename column parent_email to buyer_email;
alter table public.enquiries rename column parent_phone to buyer_phone;

alter table public.enquiries add column buyer_id uuid references auth.users(id) on delete set null;
create index if not exists enquiries_buyer_id_idx on public.enquiries(buyer_id) where buyer_id is not null;
create index if not exists enquiries_buyer_email_idx on public.enquiries(lower(buyer_email));

alter table public.enquiries
  drop column if exists parent_id, drop column if exists child_age,
  drop column if exists setting, drop column if exists query_id;
alter table public.contact_events drop column if exists query_id;
alter table public.vendor_services drop column if exists secondary_categories;
alter table public.vendors drop column if exists vibe_tags, drop column if exists occasion_fit;
alter table public.subscriptions drop column if exists plan_price_monthly;

alter type public.user_role rename value 'parent' to 'buyer';

drop table if exists public.vendor_tag_assignments cascade;
drop table if exists public.tags cascade;
drop table if exists public.service_pricing cascade;
drop table if exists public.vendor_coverage_areas cascade;
drop table if exists public.vendor_schedules cascade;
drop table if exists public.queries cascade;

drop type if exists public.service_type;
drop type if exists public.setting_type;
drop type if exists public.tag_category;
drop type if exists public.day_type;
