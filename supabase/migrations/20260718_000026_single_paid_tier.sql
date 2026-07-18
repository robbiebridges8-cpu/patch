-- One paid tier ships; tier 2 stays reserved. Applied to remote 2026-07-18.
--
-- The column stays a smallint with a 0..2 check and the weight function keeps
-- its tier-2 branch, so introducing a second paid tier later is a price
-- constant and a name — no billing-data migration. Nothing sells it today.
create or replace function public.tier_rank_weight(p_tier smallint)
returns double precision language sql immutable as $$
  select case coalesce(p_tier, 0)
    when 0 then -0.12   -- free: ranks below paid for comparable relevance
    when 2 then  0.04   -- reserved: a future premium tier, unsold today
    else 0.0            -- paid
  end;
$$;

create or replace function public.admin_stats()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp stable as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not permitted'; end if;
  select jsonb_build_object(
    'vendors_total',    (select count(*) from vendors),
    'vendors_live',     (select count(*) from vendors where status = 'live'),
    'vendors_draft',    (select count(*) from vendors where status = 'draft'),
    'vendors_paused',   (select count(*) from vendors where status = 'paused'),
    'vendors_rejected', (select count(*) from vendors where status = 'rejected'),
    'vendors_free',     (select count(*) from vendors where tier = 0),
    'vendors_paid',     (select count(*) from vendors where tier > 0),
    'vendors_claimed',  (select count(*) from vendors where owner_id is not null),
    'enquiries_total',  (select count(*) from enquiries),
    'enquiries_30d',    (select count(*) from enquiries where created_at > now() - interval '30 days'),
    'enquiries_booked', (select count(*) from enquiries where status = 'booked'),
    'messages_total',   (select count(*) from messages),
    'reviews_total',    (select count(*) from reviews),
    'reviews_hidden',   (select count(*) from reviews where hidden),
    'reviews_30d',      (select count(*) from reviews where created_at > now() - interval '30 days'),
    'profiles_total',   (select count(*) from profiles),
    'avg_rating',       (select round(avg(rating)::numeric, 2) from reviews where not hidden)
  ) into result;
  return result;
end; $$;
