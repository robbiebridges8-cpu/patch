-- Security hardening. Applied to remote 2026-07-14.

-- exec_readonly_sql is SECURITY DEFINER and was callable by anon via PostgREST,
-- which bypasses RLS entirely. Revoke public/anon/authenticated execute.
REVOKE ALL ON FUNCTION public.exec_readonly_sql(text) FROM PUBLIC, anon, authenticated;

-- Pin search_path on our own SECURITY DEFINER / trigger functions.
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_vendor_rating() SET search_path = public, pg_temp;
ALTER FUNCTION public.match_vendors(
  vector, text[], text[], integer, numeric, double precision, double precision, integer
) SET search_path = public, pg_temp;
