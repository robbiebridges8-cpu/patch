-- ============================================================
-- Migration 004: Vendor subscriptions
-- One plan, one price. Vendor pays monthly to be listed.
-- ============================================================

create type subscription_status as enum ('active', 'past_due', 'cancelled', 'trialing');

create table subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  vendor_id           uuid               not null references vendors (id) on delete restrict,
  status              subscription_status not null default 'trialing',
  plan_price_monthly  numeric            not null default 20.00 check (plan_price_monthly >= 0),
  currency            text               not null default 'gbp' check (length(currency) = 3),
  trial_ends_at       timestamptz,
  current_period_start timestamptz       not null default now(),
  current_period_end  timestamptz        not null default (now() + interval '1 month'),
  cancelled_at        timestamptz,
  stripe_customer_id  text               check (length(stripe_customer_id) <= 100),
  stripe_subscription_id text            check (length(stripe_subscription_id) <= 100),
  created_at          timestamptz        not null default now(),
  updated_at          timestamptz        not null default now(),

  unique (vendor_id)
);

create index idx_sub_status on subscriptions (status);
create index idx_sub_stripe_customer on subscriptions (stripe_customer_id) where stripe_customer_id is not null;

create trigger trg_subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();
