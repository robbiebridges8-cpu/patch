-- Vendor auth: profile-creation trigger + owner-scoped RLS.
-- Applied to remote 2026-07-14.

-- Create a profile row for every new auth user (vendor-only auth for MVP).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, email, display_name)
  VALUES (
    NEW.id,
    'vendor',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Owner-scoped policies (authenticated vendors) ──
CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "owner_select_vendors" ON public.vendors
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner_update_vendors" ON public.vendors
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "claim_unowned_vendor" ON public.vendors
  FOR UPDATE TO authenticated USING (owner_id IS NULL) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner_read_enquiries" ON public.enquiries
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));

CREATE POLICY "owner_insert_photos" ON public.vendor_photos
  FOR INSERT TO authenticated
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));
CREATE POLICY "owner_update_photos" ON public.vendor_photos
  FOR UPDATE TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));
CREATE POLICY "owner_delete_photos" ON public.vendor_photos
  FOR DELETE TO authenticated
  USING (vendor_id IN (SELECT id FROM public.vendors WHERE owner_id = auth.uid()));
