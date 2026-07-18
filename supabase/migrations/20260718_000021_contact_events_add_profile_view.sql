-- The enum had every event type except the one a vendor most wants to see.
-- Separate migration: a new enum value can't be used in the same transaction
-- that adds it.
-- Applied to remote 2026-07-18.
alter type public.contact_event_type add value if not exists 'profile_view';
