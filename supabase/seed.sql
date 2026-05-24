-- Seed: 3 fake vendors with services, pricing, photos, coverage areas.
-- Embeddings left null — will backfill once embedding pipeline exists.

-- ─────────── VENDORS ───────────

insert into vendors (id, slug, name, description, status, contact_email, contact_phone, base_postcode, base_location, coverage_radius_miles, price_from, price_to)
values
  ('a1111111-1111-1111-1111-111111111111', 'captain-adventures', 'Captain Adventures',
   'High-energy children''s entertainer specialising in superhero and Bluey-themed parties across SW London. Games, music, and balloon modelling included.',
   'live', 'bookings@captainadventures.co.uk', '07700 900001', 'SW4 7AA',
   ST_MakePoint(-0.1480, 51.4620)::geography, 6, 180, 280),

  ('b2222222-2222-2222-2222-222222222222', 'bounce-house-sw', 'Bounce House SW',
   'Bouncy castle and soft play hire for gardens, halls, and parks. All units PAT tested and safety-matted.',
   'live', 'hello@bouncehousesw.co.uk', '07700 900002', 'SW11 1NP',
   ST_MakePoint(-0.1685, 51.4635)::geography, 8, 120, 350),

  ('c3333333-3333-3333-3333-333333333333', 'sparkle-faces', 'Sparkle Faces',
   'Professional face painter and glitter tattoo artist. Hypoallergenic paints, fast turnaround, huge design menu.',
   'live', 'lucy@sparklefaces.co.uk', '07700 900003', 'SW15 2RS',
   ST_MakePoint(-0.2167, 51.4680)::geography, 5, 100, 200);

-- ─────────── VENDOR SERVICES ───────────

insert into vendor_services (id, vendor_id, service_type, title, description, position, age_min, age_max, capacity_max, setting, duration_minutes, price_from, price_to)
values
  ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111',
   'entertainer', 'Bluey-themed party entertainer',
   'Full party hosting with Bluey games, music, and prizes. Includes balloon animals for every child.',
   0, 3, 7, 30, 'either', 120, 200, 280),

  ('d2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111',
   'balloon_modelling', 'Balloon modelling add-on',
   'Standalone balloon modelling session — swords, dogs, unicorns, you name it.',
   1, 2, 10, 40, 'either', 60, 80, 120),

  ('d3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222',
   'bouncy_castle', 'Large bouncy castle hire',
   'Colourful 15x15ft bouncy castle with safety mats and blower. Delivery, setup, and collection included.',
   0, 3, 12, 8, 'outdoor', 240, 150, 200),

  ('d4444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222',
   'soft_play', 'Soft play set hire',
   'Full soft play set with ball pit, rockers, and slide. Perfect for under-5s.',
   1, 1, 5, 15, 'indoor', 240, 120, 180),

  ('d5555555-5555-5555-5555-555555555555', 'c3333333-3333-3333-3333-333333333333',
   'face_painter', 'Party face painting',
   'Unlimited face painting for your party. Butterflies, tigers, superheroes — kids choose from the design menu.',
   0, 3, 12, 25, 'either', 120, 100, 200);

-- ─────────── SERVICE PRICING ───────────

insert into service_pricing (service_id, label, duration_minutes, day_type, price, notes, position)
values
  ('d1111111-1111-1111-1111-111111111111', 'Weekend 2hr party', 120, 'weekend', 280, null, 0),
  ('d1111111-1111-1111-1111-111111111111', 'Weekday 2hr party', 120, 'weekday', 200, 'Mon–Fri, term time only', 1),
  ('d2222222-2222-2222-2222-222222222222', 'Balloon session', 60, 'any', 80, 'Add-on to party or standalone', 0),
  ('d3333333-3333-3333-3333-333333333333', 'Weekend 4hr hire', 240, 'weekend', 200, 'Includes delivery and collection', 0),
  ('d3333333-3333-3333-3333-333333333333', 'Weekday 4hr hire', 240, 'weekday', 150, 'Includes delivery and collection', 1),
  ('d4444444-4444-4444-4444-444444444444', 'Soft play 4hr hire', 240, 'any', 120, 'Ball pit, slide, rockers', 0),
  ('d5555555-5555-5555-5555-555555555555', 'Up to 15 kids', 60, 'any', 100, null, 0),
  ('d5555555-5555-5555-5555-555555555555', 'Up to 25 kids', 120, 'any', 200, null, 1);

-- ─────────── TAG ASSIGNMENTS ───────────

insert into vendor_tag_assignments (vendor_id, tag_id)
select 'a1111111-1111-1111-1111-111111111111', id from tags where slug in ('bluey', 'superhero', 'high_energy', 'interactive', 'dbs_checked', 'public_liability_insured');

insert into vendor_tag_assignments (vendor_id, tag_id)
select 'b2222222-2222-2222-2222-222222222222', id from tags where slug in ('public_liability_insured', 'accessible');

insert into vendor_tag_assignments (vendor_id, tag_id)
select 'c3333333-3333-3333-3333-333333333333', id from tags where slug in ('unicorn', 'princess', 'frozen', 'calm', 'allergy_aware', 'dbs_checked', 'public_liability_insured');

-- ─────────── COVERAGE AREAS ───────────

insert into vendor_coverage_areas (vendor_id, postcode_district) values
  ('a1111111-1111-1111-1111-111111111111', 'SW4'),
  ('a1111111-1111-1111-1111-111111111111', 'SW11'),
  ('a1111111-1111-1111-1111-111111111111', 'SW12'),
  ('a1111111-1111-1111-1111-111111111111', 'SW15'),
  ('b2222222-2222-2222-2222-222222222222', 'SW11'),
  ('b2222222-2222-2222-2222-222222222222', 'SW4'),
  ('b2222222-2222-2222-2222-222222222222', 'SW12'),
  ('b2222222-2222-2222-2222-222222222222', 'SW15'),
  ('b2222222-2222-2222-2222-222222222222', 'SW18'),
  ('c3333333-3333-3333-3333-333333333333', 'SW15'),
  ('c3333333-3333-3333-3333-333333333333', 'SW18'),
  ('c3333333-3333-3333-3333-333333333333', 'SW11');

-- ─────────── VENDOR SCHEDULES ───────────
-- Captain Adventures: weekends + Wednesday
-- Bounce House: every day
-- Sparkle Faces: weekends + Friday

insert into vendor_schedules (vendor_id, day_of_week, available) values
  ('a1111111-1111-1111-1111-111111111111', 0, true),  -- Sun
  ('a1111111-1111-1111-1111-111111111111', 3, true),  -- Wed
  ('a1111111-1111-1111-1111-111111111111', 6, true),  -- Sat
  ('b2222222-2222-2222-2222-222222222222', 0, true),
  ('b2222222-2222-2222-2222-222222222222', 1, true),
  ('b2222222-2222-2222-2222-222222222222', 2, true),
  ('b2222222-2222-2222-2222-222222222222', 3, true),
  ('b2222222-2222-2222-2222-222222222222', 4, true),
  ('b2222222-2222-2222-2222-222222222222', 5, true),
  ('b2222222-2222-2222-2222-222222222222', 6, true),
  ('c3333333-3333-3333-3333-333333333333', 0, true),
  ('c3333333-3333-3333-3333-333333333333', 5, true),
  ('c3333333-3333-3333-3333-333333333333', 6, true);
