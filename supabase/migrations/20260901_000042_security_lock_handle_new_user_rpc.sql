-- Security advisor: handle_new_user() is an AFTER INSERT trigger on auth.users,
-- but it was ALSO exposed as a public RPC (/rest/v1/rpc/handle_new_user) that
-- anon/authenticated could call directly. Nothing should invoke it by hand.
--
-- Revoking EXECUTE from the API roles closes the RPC without affecting the
-- trigger: triggers execute with the rights of the table owner, not the caller,
-- so new-user provisioning keeps working.
--
-- The other advisor findings are accepted, not bugs:
--   * The remaining SECURITY DEFINER RPCs are the app's intended API surface and
--     each guards internally (is_admin / auth.uid() / owner checks) + pins
--     search_path — the correct Supabase pattern.
--   * st_estimatedextent / postgis / vector live in `public` because that's how
--     the extensions install; relocating them post-hoc would break every
--     reference across the schema.
--   * public.spatial_ref_sys has RLS disabled but is owned by the PostGIS
--     extension (cannot ALTER without superuser); it holds only public spatial-
--     reference reference data, no user rows.
--   * public.rate_limits has RLS enabled with no policy on purpose — it is
--     reached only through the check_rate_limit SECURITY DEFINER function, so
--     deny-all to PostgREST is the intended, locked-down state.
--   * Leaked-password protection is an Auth dashboard toggle and moot here
--     (auth is passwordless email OTP), so it's left to a console decision.

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.handle_new_user() from public;
