-- Data-integrity fixes from the full-surface audit (2026-07-25).

-- ── D3: reviews.enquiry_id is the integrity anchor — stop it silently unanchoring ──
-- Was ON DELETE SET NULL, which turns a review into an anchorless orphan when its
-- enquiry is deleted. RESTRICT keeps the review tied to a real enquiry. (The 185
-- synthetic seed reviews predate the anchor and remain null; real user reviews
-- from submit_review are always anchored.)
alter table public.reviews drop constraint reviews_enquiry_id_fkey;
alter table public.reviews add constraint reviews_enquiry_id_fkey
  foreign key (enquiry_id) references public.enquiries(id) on delete restrict;

-- ── D1: dietary/capacity are service-level; drop the duplicate copies the old
-- editor wrote onto the vendor bag. Reads merge both bags, so this is invisible
-- to buyers — it just removes the drift surface. good_for / vibe stay on the
-- vendor bag; setting stays on the service.
update public.vendors
set attributes = attributes - 'dietary' - 'capacity_min' - 'capacity_max'
where attributes ?| array['dietary','capacity_min','capacity_max'];

-- ── D5: vendor_services.price_to was 100% NULL and written by nothing. The
-- profile's range render is gone; drop the dead column.
alter table public.vendor_services drop column if exists price_to;
