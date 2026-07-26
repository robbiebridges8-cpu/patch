-- Pin the search_path on the role-guard trigger (advisor 0011); every other
-- function this session sets it, this one was missed.
alter function public.guard_profile_role() set search_path = public, pg_temp;
