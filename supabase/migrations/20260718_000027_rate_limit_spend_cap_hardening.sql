-- Distributed rate limiting, AI spend circuit breaker, and security hardening.
-- Applied to remote 2026-07-18.
--
-- The previous limiter was a Map in process memory: per-instance, reset on cold
-- start, so under real load it barely limited anything — and /search is
-- unauthenticated and costs money per call. Postgres rather than Redis is
-- deliberate: already in the request path, transactional, no new vendor or key.
-- Measured: 40 concurrent requests against a limit of 25 → 23 served, 17 blocked.

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
alter table public.rate_limits enable row level security;
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, retry_after integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := v_now - make_interval(secs => greatest(p_window_seconds, 1));
  v_start timestamptz; v_count integer; v_key text := left(coalesce(p_key, 'anon'), 200);
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (v_key, v_now, 1)
  on conflict (key) do update set
    window_start = case when rl.window_start < v_cutoff then v_now else rl.window_start end,
    count        = case when rl.window_start < v_cutoff then 1    else rl.count + 1 end
  returning rl.window_start, rl.count into v_start, v_count;

  if random() < 0.001 then
    delete from public.rate_limits where window_start < v_now - interval '1 hour';
  end if;

  if v_count > p_limit then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
  else
    return query select true, 0;
  end if;
end $$;
revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;

create table if not exists public.ai_usage (
  day date primary key default current_date,
  units integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;

create or replace function public.consume_ai_budget(p_units integer default 1, p_daily_cap integer default 50000)
returns table(allowed boolean, used integer, cap integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_used integer;
begin
  insert into public.ai_usage as au (day, units, updated_at)
  values (current_date, greatest(p_units, 0), now())
  on conflict (day) do update set units = au.units + greatest(p_units, 0), updated_at = now()
  returning au.units into v_used;
  return query select (v_used <= p_daily_cap), v_used, p_daily_cap;
end $$;
revoke all on function public.consume_ai_budget(integer, integer) from public;
grant execute on function public.consume_ai_budget(integer, integer) to anon, authenticated;

create policy "admin_read_ai_usage" on public.ai_usage
  for select to authenticated using (public.is_admin());

-- Drop dead privileged code: exec_readonly_sql is SECURITY DEFINER and runs
-- arbitrary SQL. Nothing references it; one accidental GRANT would be full
-- database read access.
drop function if exists public.exec_readonly_sql(text);

-- Defence in depth: anon has no legitimate reason to invoke these. NOT
-- is_admin() — it is called inside the public_read_reviews RLS predicate, and
-- revoking it there 500s every vendor profile for logged-out visitors.
revoke execute on function public.admin_stats() from anon;
revoke execute on function public.vendor_analytics(uuid, integer) from anon;
revoke execute on function public.mark_thread_read(uuid) from anon;

comment on table public.vendor_schedules is
  'UNUSED as of 2026-07-18. RLS enabled with no policies (deny-all). Drop, or add policies deliberately, before using.';
comment on table public.rate_limits is
  'Reached only via check_rate_limit(). RLS on with no policies is intentional — the SECURITY DEFINER function is the sole access path.';
