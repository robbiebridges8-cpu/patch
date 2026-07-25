-- Grant-level backstop for the role-escalation blocker (000035).
--
-- A table-level UPDATE/INSERT grant on profiles implies every column, so a
-- column-level REVOKE (role) is a silent no-op while the table grant stands.
-- The app never writes profiles from the client — rows are created by the
-- handle_new_user SECURITY DEFINER trigger and role is managed out-of-band — so
-- revoke the table-level write grants outright. SELECT is retained
-- (own_profile_select); the guard trigger remains the primary control on role.
revoke update, insert on public.profiles from anon, authenticated;
