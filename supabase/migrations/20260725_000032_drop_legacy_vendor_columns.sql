-- Schema cleanup: drop dead and duplicated columns on vendors.
-- Applied to remote 2026-07-25.
--
-- Food/kids-party legacy that never generalised to a horizontal services
-- platform, plus one genuine duplication. Verified before applying: no
-- function, view, trigger or generated column referenced any of them, and all
-- code reads were repointed first (build + tests green after).
--
-- Dead (0 code references):
--   setup_requirements, peak_season, min_lead_days, max_advance_days,
--   booking_notes, cancellation_policy, secondary_categories, notes
-- Empty (0 rows, only stale type/mapper refs): whatsapp, price_to
-- Duplicated: typical_event_size_min/max held the same value as
--   vendor_services.attributes.capacity_min/max for all 500 rows. The service
--   attributes are the single source of truth (search reads them); the vendor
--   columns were a redundant copy the profile happened to read instead. Reads
--   repointed to attributes; the duplicate dropped.

alter table public.vendors
  drop column if exists setup_requirements,
  drop column if exists peak_season,
  drop column if exists min_lead_days,
  drop column if exists max_advance_days,
  drop column if exists booking_notes,
  drop column if exists cancellation_policy,
  drop column if exists secondary_categories,
  drop column if exists notes,
  drop column if exists whatsapp,
  drop column if exists price_to,
  drop column if exists typical_event_size_min,
  drop column if exists typical_event_size_max;
