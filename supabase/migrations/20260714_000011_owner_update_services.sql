-- Let a vendor update their own service row (needed to store a refreshed
-- embedding when they edit their listing). Applied 2026-07-14.
CREATE POLICY "owner_update_services" ON public.vendor_services
  FOR UPDATE TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));
