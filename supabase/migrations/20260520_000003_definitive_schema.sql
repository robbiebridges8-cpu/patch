-- ============================================================
-- Migration 003: Definitive schema — replaces 001 + 002.
-- Drops everything and rebuilds with correct constraints,
-- FK behaviors, indexes, and validation.
-- ============================================================

-- ─────────── TEARDOWN ───────────

drop trigger if exists trg_reviews_update_vendor_rating on reviews;
drop trigger if exists trg_enquiries_updated_at on enquiries;
drop trigger if exists trg_reviews_updated_at on reviews;
drop trigger if exists trg_profiles_updated_at on profiles;
drop trigger if exists trg_vendor_services_updated_at on vendor_services;
drop trigger if exists trg_vendors_updated_at on vendors;

drop function if exists update_vendor_rating();
drop function if exists set_updated_at();

drop table if exists contact_events cascade;
drop table if exists enquiries cascade;
drop table if exists vendor_coverage_areas cascade;
drop table if exists service_pricing cascade;
drop table if exists vendor_blocked_dates cascade;
drop table if exists vendor_schedules cascade;
drop table if exists reviews cascade;
drop table if exists vendor_photos cascade;
drop table if exists vendor_tag_assignments cascade;
drop table if exists tags cascade;
drop table if exists vendor_services cascade;
drop table if exists vendors cascade;
drop table if exists profiles cascade;
drop table if exists queries cascade;

drop type if exists enquiry_status;
drop type if exists day_type;
drop type if exists user_role;
drop type if exists vendor_status;
drop type if exists setting_type;
drop type if exists service_type;
drop type if exists tag_category;
drop type if exists blocked_reason;
drop type if exists contact_event_type;

-- ─────────── EXTENSIONS ───────────

create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "postgis";

-- ─────────── ENUMS ───────────
-- Every closed set is an enum. No CHECK-as-enum patterns.

create type service_type as enum (
  'entertainer', 'magician', 'bouncy_castle', 'soft_play',
  'face_painter', 'balloon_modelling', 'party_food', 'cake',
  'character_visit', 'science_show', 'craft_workshop',
  'music_class', 'dance_party', 'disco', 'petting_zoo',
  'sports_coach', 'photographer', 'venue', 'other'
);

create type setting_type as enum ('indoor', 'outdoor', 'either');
create type vendor_status as enum ('draft', 'live', 'paused', 'rejected');
create type user_role as enum ('parent', 'vendor', 'admin');
create type enquiry_status as enum ('sent', 'viewed', 'replied', 'booked', 'declined', 'expired');
create type day_type as enum ('weekday', 'weekend', 'any');
create type tag_category as enum ('theme', 'style', 'credential');
create type blocked_reason as enum ('booked', 'holiday', 'personal');
create type contact_event_type as enum (
  'click_contact', 'reveal_phone', 'visit_website',
  'enquiry_sent', 'enquiry_viewed', 'enquiry_replied',
  'share', 'save'
);

-- ─────────── TRIGGER FUNCTION ───────────

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────── 1. PROFILES ───────────
-- Linked 1:1 with Supabase auth.users.

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        user_role    not null default 'parent',
  display_name text        check (length(display_name) <= 200),
  email       text         check (length(email) <= 320),
  phone       text         check (length(phone) <= 30),
  avatar_url  text         check (length(avatar_url) <= 1000),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ─────────── 2. VENDORS ───────────

create table vendors (
  id                    uuid primary key default uuid_generate_v4(),
  slug                  text         unique not null check (length(slug) between 1 and 100),
  name                  text         not null check (length(name) between 1 and 200),
  description           text         check (length(description) <= 2000),
  status                vendor_status not null default 'draft',
  owner_id              uuid         references profiles (id) on delete set null,

  -- contact
  contact_email         text         check (length(contact_email) <= 320),
  contact_phone         text         check (length(contact_phone) <= 30),
  website               text         check (length(website) <= 500),
  instagram             text         check (length(instagram) <= 100),
  whatsapp              text         check (length(whatsapp) <= 30),

  -- location
  base_postcode         text         check (length(base_postcode) <= 10),
  base_location         geography(point, 4326),
  coverage_radius_miles numeric      not null default 5
                                     check (coverage_radius_miles > 0 and coverage_radius_miles <= 100),

  -- pricing (headline range — detail lives in service_pricing)
  price_from            numeric      check (price_from >= 0),
  price_to              numeric      check (price_to >= 0),
  price_notes           text         check (length(price_notes) <= 500),
  constraint vendors_price_range check (price_to is null or price_from is null or price_from <= price_to),

  -- content (vendor-authored)
  bio                   text         check (length(bio) <= 5000),
  faq                   jsonb,
  cancellation_policy   text         check (length(cancellation_policy) <= 2000),

  -- availability params
  min_lead_days         int          not null default 7 check (min_lead_days >= 0),
  max_advance_days      int          not null default 180 check (max_advance_days > 0),

  -- denormalised from reviews (maintained by trigger)
  rating_avg            numeric(3,2),
  review_count          int          not null default 0 check (review_count >= 0),

  -- internal
  notes                 text,
  created_at            timestamptz  not null default now(),
  updated_at            timestamptz  not null default now()
);

create index idx_vendors_status on vendors (status);
create index idx_vendors_owner_id on vendors (owner_id);
create index idx_vendors_base_location on vendors using gist (base_location);
-- The query "live vendors near X" hits both status and location:
create index idx_vendors_status_location on vendors (status) include (base_location);

create trigger trg_vendors_updated_at
  before update on vendors
  for each row execute function set_updated_at();

-- ─────────── 3. VENDOR SERVICES ───────────
-- 1:many from vendor. Each service gets its own embedding for AI search.

create table vendor_services (
  id                uuid primary key default uuid_generate_v4(),
  vendor_id         uuid         not null references vendors (id) on delete cascade,
  service_type      service_type not null,
  title             text         not null check (length(title) between 1 and 200),
  description       text         check (length(description) <= 2000),
  position          int          not null default 0,

  -- age range
  age_min           int          check (age_min >= 0 and age_min <= 18),
  age_max           int          check (age_max >= 0 and age_max <= 18),
  constraint vs_age_range check (age_min is null or age_max is null or age_min <= age_max),

  -- capacity
  capacity_min      int          check (capacity_min > 0),
  capacity_max      int          check (capacity_max > 0),
  constraint vs_capacity_range check (capacity_min is null or capacity_max is null or capacity_min <= capacity_max),

  -- setting & duration
  setting           setting_type not null default 'either',
  duration_minutes  int          check (duration_minutes > 0),

  -- headline pricing (detail in service_pricing)
  price_from        numeric      check (price_from >= 0),
  price_to          numeric      check (price_to >= 0),
  constraint vs_price_range check (price_to is null or price_from is null or price_from <= price_to),

  -- AI search
  embedding         vector(1024),

  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

create index idx_vs_vendor_id on vendor_services (vendor_id);
create index idx_vs_service_type on vendor_services (service_type);
create index idx_vs_vendor_type on vendor_services (vendor_id, service_type);
create index idx_vs_embedding on vendor_services using hnsw (embedding vector_cosine_ops);

create trigger trg_vendor_services_updated_at
  before update on vendor_services
  for each row execute function set_updated_at();

-- ─────────── 4. SERVICE PRICING ───────────
-- Richer pricing per service tier.

create table service_pricing (
  id                uuid primary key default uuid_generate_v4(),
  service_id        uuid         not null references vendor_services (id) on delete cascade,
  label             text         not null check (length(label) between 1 and 100),
  duration_minutes  int          check (duration_minutes > 0),
  day_type          day_type     not null default 'any',
  price             numeric      not null check (price > 0),
  per_child         bool         not null default false,
  min_children      int          check (min_children > 0),
  max_children      int          check (max_children > 0),
  constraint sp_children_range check (min_children is null or max_children is null or min_children <= max_children),
  notes             text         check (length(notes) <= 500),
  position          int          not null default 0,
  created_at        timestamptz  not null default now(),
  updated_at        timestamptz  not null default now()
);

create index idx_sp_service_id on service_pricing (service_id);

create trigger trg_service_pricing_updated_at
  before update on service_pricing
  for each row execute function set_updated_at();

-- ─────────── 5. VENDOR PHOTOS ───────────

create table vendor_photos (
  id          uuid primary key default uuid_generate_v4(),
  vendor_id   uuid         not null references vendors (id) on delete cascade,
  service_id  uuid         references vendor_services (id) on delete set null,
  url         text         not null check (length(url) between 1 and 2000),
  alt_text    text         check (length(alt_text) <= 300),
  position    int          not null default 0,
  created_at  timestamptz  not null default now()
);

create index idx_vp_vendor_id on vendor_photos (vendor_id);
create index idx_vp_ordering on vendor_photos (vendor_id, position);

-- ─────────── 6. TAGS ───────────

create table tags (
  id          uuid primary key default uuid_generate_v4(),
  slug        text         unique not null check (length(slug) between 1 and 50),
  name        text         not null check (length(name) between 1 and 100),
  category    tag_category not null
);

create table vendor_tag_assignments (
  vendor_id   uuid not null references vendors (id) on delete cascade,
  tag_id      uuid not null references tags (id) on delete cascade,
  primary key (vendor_id, tag_id)
);

create index idx_vta_tag_id on vendor_tag_assignments (tag_id);

-- Seed tags
insert into tags (slug, name, category) values
  ('bluey', 'Bluey', 'theme'),
  ('spiderman', 'Spiderman', 'theme'),
  ('unicorn', 'Unicorn', 'theme'),
  ('dinosaur', 'Dinosaur', 'theme'),
  ('princess', 'Princess', 'theme'),
  ('superhero', 'Superhero', 'theme'),
  ('frozen', 'Frozen', 'theme'),
  ('high_energy', 'High Energy', 'style'),
  ('calm', 'Calm', 'style'),
  ('educational', 'Educational', 'style'),
  ('messy_play', 'Messy Play', 'style'),
  ('traditional', 'Traditional', 'style'),
  ('interactive', 'Interactive', 'style'),
  ('dbs_checked', 'DBS Checked', 'credential'),
  ('public_liability_insured', 'Public Liability Insured', 'credential'),
  ('eco_friendly', 'Eco Friendly', 'credential'),
  ('allergy_aware', 'Allergy Aware', 'credential'),
  ('accessible', 'Accessible', 'credential');

-- ─────────── 7. REVIEWS ───────────

create table reviews (
  id          uuid primary key default uuid_generate_v4(),
  vendor_id   uuid         not null references vendors (id) on delete cascade,
  service_id  uuid         references vendor_services (id) on delete set null,
  author_id   uuid         references profiles (id) on delete set null,
  rating      int          not null check (rating between 1 and 5),
  title       text         check (length(title) <= 200),
  body        text         check (length(body) <= 5000),
  party_date  date,
  child_age   int          check (child_age >= 0 and child_age <= 18),
  guest_count int          check (guest_count > 0),
  verified    bool         not null default false,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create index idx_reviews_vendor_id on reviews (vendor_id);
create index idx_reviews_author_id on reviews (author_id);
create index idx_reviews_vendor_recent on reviews (vendor_id, created_at desc);

create trigger trg_reviews_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- Rating denormalisation trigger (handles INSERT, UPDATE, and DELETE correctly)
create function update_vendor_rating()
returns trigger as $$
declare
  target_vendor_id uuid;
begin
  if tg_op = 'DELETE' then
    target_vendor_id := old.vendor_id;
  elsif tg_op = 'UPDATE' and old.vendor_id <> new.vendor_id then
    -- vendor_id changed: update both old and new vendor
    update vendors set
      rating_avg   = sub.avg_r,
      review_count = sub.cnt
    from (
      select coalesce(round(avg(rating)::numeric, 2), null) as avg_r,
             count(*)::int as cnt
      from reviews where vendor_id = old.vendor_id
    ) sub
    where vendors.id = old.vendor_id;
    target_vendor_id := new.vendor_id;
  else
    target_vendor_id := new.vendor_id;
  end if;

  update vendors set
    rating_avg   = sub.avg_r,
    review_count = sub.cnt
  from (
    select coalesce(round(avg(rating)::numeric, 2), null) as avg_r,
           count(*)::int as cnt
    from reviews where vendor_id = target_vendor_id
  ) sub
  where vendors.id = target_vendor_id;

  return null;
end;
$$ language plpgsql;

create trigger trg_reviews_update_vendor_rating
  after insert or update or delete on reviews
  for each row execute function update_vendor_rating();

-- ─────────── 8. AVAILABILITY ───────────

-- Weekly schedule (0 = Sunday … 6 = Saturday, matches JS Date.getDay()).
create table vendor_schedules (
  id           uuid primary key default uuid_generate_v4(),
  vendor_id    uuid not null references vendors (id) on delete cascade,
  day_of_week  int  not null check (day_of_week between 0 and 6),
  available    bool not null default true,
  unique (vendor_id, day_of_week)
);

-- Specific blocked dates.
create table vendor_blocked_dates (
  id            uuid primary key default uuid_generate_v4(),
  vendor_id     uuid          not null references vendors (id) on delete cascade,
  blocked_date  date          not null,
  reason        blocked_reason,
  note          text          check (length(note) <= 500),
  created_at    timestamptz   not null default now(),
  unique (vendor_id, blocked_date)
);

create index idx_vbd_vendor_date on vendor_blocked_dates (vendor_id, blocked_date);

-- ─────────── 9. COVERAGE AREAS ───────────
-- Supplements radius for vendors who only cover specific postcode districts.

create table vendor_coverage_areas (
  id                 uuid primary key default uuid_generate_v4(),
  vendor_id          uuid not null references vendors (id) on delete cascade,
  postcode_district  text not null check (length(postcode_district) between 2 and 10),
  unique (vendor_id, postcode_district)
);

create index idx_vca_district on vendor_coverage_areas (postcode_district);

-- ─────────── 10. QUERIES (search log) ───────────

create table queries (
  id                uuid primary key default uuid_generate_v4(),
  query_text        text        not null check (length(query_text) between 1 and 2000),
  parsed_filters    jsonb,
  result_vendor_ids uuid[],
  session_id        text        check (length(session_id) <= 100),
  created_at        timestamptz not null default now()
);

create index idx_queries_session on queries (session_id) where session_id is not null;

-- ─────────── 11. ENQUIRIES ───────────
-- Core marketplace transaction. A parent reaches out to a vendor.
-- Can be anonymous (pre-auth) or linked to a profile.
-- Vendor deletion is RESTRICT: don't destroy enquiry history.

create table enquiries (
  id               uuid primary key default uuid_generate_v4(),
  vendor_id        uuid            not null references vendors (id) on delete restrict,
  service_id       uuid            references vendor_services (id) on delete set null,
  parent_id        uuid            references profiles (id) on delete set null,
  query_id         uuid            references queries (id) on delete set null,
  status           enquiry_status  not null default 'sent',

  -- party details
  party_date       date,
  party_postcode   text            check (length(party_postcode) <= 10),
  child_age        int             check (child_age >= 0 and child_age <= 18),
  guest_count      int             check (guest_count > 0),
  setting          setting_type,
  budget           numeric         check (budget > 0),
  message          text            check (length(message) <= 2000),

  -- parent contact (for anonymous enquiries, or snapshot at send time)
  parent_name      text            check (length(parent_name) <= 200),
  parent_email     text            check (length(parent_email) <= 320),
  parent_phone     text            check (length(parent_phone) <= 30),

  -- vendor response
  vendor_response  text            check (length(vendor_response) <= 2000),
  responded_at     timestamptz,

  created_at       timestamptz     not null default now(),
  updated_at       timestamptz     not null default now()
);

create index idx_enq_vendor_id on enquiries (vendor_id);
create index idx_enq_parent_id on enquiries (parent_id) where parent_id is not null;
create index idx_enq_status on enquiries (status);
create index idx_enq_vendor_inbox on enquiries (vendor_id, status, created_at desc);

create trigger trg_enquiries_updated_at
  before update on enquiries
  for each row execute function set_updated_at();

-- ─────────── 12. CONTACT EVENTS (conversion tracking) ───────────
-- Vendor deletion is RESTRICT: don't destroy analytics.

create table contact_events (
  id           uuid primary key default uuid_generate_v4(),
  query_id     uuid               references queries (id) on delete set null,
  vendor_id    uuid               not null references vendors (id) on delete restrict,
  enquiry_id   uuid               references enquiries (id) on delete set null,
  event_type   contact_event_type not null,
  session_id   text               check (length(session_id) <= 100),
  created_at   timestamptz        not null default now()
);

create index idx_ce_vendor_id on contact_events (vendor_id);
create index idx_ce_event_type on contact_events (event_type);
create index idx_ce_created on contact_events (created_at desc);
