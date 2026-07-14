-- ─────────────────────────────────────────────────────────────
-- RLS: public read for the browse surface, locked writes.
-- The app uses the anon key for all server-side reads, so every
-- table the UI/RPC touches needs an explicit SELECT policy.
-- Service role bypasses RLS (used by seed/backfill/admin scripts).
-- Applied to remote 2026-07-14.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.vendors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_services        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_photos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_coverage_areas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pricing        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_schedules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_blocked_dates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions          ENABLE ROW LEVEL SECURITY;

-- ── Public read: browse surface ──
CREATE POLICY "public_read_live_vendors" ON public.vendors
  FOR SELECT TO anon, authenticated
  USING (status = 'live');

CREATE POLICY "public_read_services" ON public.vendor_services
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_photos" ON public.vendor_photos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_reviews" ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_tags" ON public.tags
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_tag_assignments" ON public.vendor_tag_assignments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_coverage" ON public.vendor_coverage_areas
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_pricing" ON public.service_pricing
  FOR SELECT TO anon, authenticated USING (true);

-- ── Public insert: lead capture, search logging, analytics ──
CREATE POLICY "public_insert_enquiries" ON public.enquiries
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_insert_queries" ON public.queries
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public_insert_contact_events" ON public.contact_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Everything else (profiles, subscriptions, schedules, blocked_dates, and
-- SELECT on enquiries/queries/contact_events) has RLS on with no policy,
-- so it is denied to anon/authenticated until auth-scoped policies land.
