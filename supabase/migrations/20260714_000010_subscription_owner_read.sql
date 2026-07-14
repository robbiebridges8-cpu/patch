-- A vendor can read the subscription for a listing they own (dashboard status).
-- Writes stay service-role only (the Stripe webhook). Applied 2026-07-14.
CREATE POLICY "owner_read_subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));
