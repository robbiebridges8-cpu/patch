# Database schema

*Live reference, generated from the database 2026-07-25. 19 app tables.*

Every table has **Row Level Security on**. Convention throughout: `id` is a
`uuid` primary key, `created_at`/`updated_at` are `timestamptz` defaulting to
`now()`. Those three are omitted from the column tables below unless they carry
meaning beyond the obvious.

Legend: **PK** primary key · **FK** foreign key · **RLS** who can see/write it.

---

## Core domain

### `vendors` — the business entity (30 cols, 500 rows)
One row per listed business. The heart of the platform.

| Column | Type | Why it exists |
|---|---|---|
| `slug` | text, unique | URL identity (`/vendors/taco-loco`). Human-readable, SEO. |
| `name` | text | Display name. |
| `description` | text | One-liner shown on cards; feeds the embedding. |
| `bio` | text | Long-form profile copy; richest embedding input. |
| `status` | enum | `draft` / `live` / `paused` / `rejected`. Only `live` is publicly visible — the core RLS gate. |
| `owner_id` | uuid, FK→auth.users | Which account controls this listing. Null = unclaimed (seed data, or a scraped listing awaiting its owner). |
| `tier` | smallint | 0 free / 1 paid. Drives search ranking and the lead paywall. Integer not boolean so a 2nd paid tier needs no migration. |
| `base_postcode` | text | Vendor's base. Stored as outward code ("E8"). |
| `base_location` | geography(Point) | PostGIS point — **the** location filter. `ST_DWithin` against the buyer's search point. |
| `coverage_radius_miles` | numeric | How far they travel. Second half of the location filter. |
| `area` | text | Human borough ("Hackney") for the "Hackney (E8)" label. Backfilled from postcodes.io. |
| `price_from` | numeric | Starting price — **the** budget filter (`price_from <= budget`, nulls pass). |
| `price_notes` | text | Free-text pricing caveats ("per head", "min spend £300"). |
| `contact_email` | text | Where enquiries are emailed. |
| `contact_phone`, `website`, `instagram` | text | Contact channels; the outbound-click analytics targets. |
| `faq` | jsonb | `[{q,a}]` shown on the profile. |
| `attributes` | jsonb | **Vertical-agnostic bag.** Dietary, capacity, certifications — anything trade-specific. Folded into the embedding; UI-set values are exact filters. This is the schema's answer to 1,000 verticals. |
| `rating_avg`, `review_count` | numeric/int | Denormalised from `reviews` by a trigger. Cheap sort/display without a join. |
| `primary_category` | text | Display + SEO label only. **Never a hard filter from AI.** Fuzzy is fine. |
| `signature_items` | jsonb | "Known for" list; embedding input + profile. |
| `years_active` | int | "Trading 4 yrs" trust signal. |
| `price_range` | text | "££" band for JSON-LD structured data. |
| `vibe_tags`, `occasion_fit` | text[] | **Legacy soft fields** — feed the embedding only. Food/event-shaped; candidates to fold into `attributes`. |

### `vendor_services` — what a vendor offers (13 cols, 500 rows)
1:1 with `vendors` today, modelled 1:many for later. **Search reads this table**,
not `vendors` — the embedding and the filterable attributes live here.

| Column | Type | Why it exists |
|---|---|---|
| `vendor_id` | uuid, FK→vendors | Owner. |
| `title`, `description` | text | Service-level copy; embedding input. |
| `category` | text | The exact-match category filter (UI-set only). |
| `attributes` | jsonb | **Capacity, dietary, etc. — the single source of truth** (the profile reads capacity from here after the July cleanup). |
| `embedding` | vector(1024) | Voyage voyage-3 vector. HNSW-indexed. The thing semantic search actually matches on. |
| `price_from`, `price_to` | numeric | Service-level pricing. |
| `position` | int | Ordering when a vendor has several services. |
| `secondary_categories` | text[] | **Unused.** Legacy; safe to drop. |

### `enquiries` — a buyer contacting a vendor (20 cols, ~live)
The conversion event. Created anonymously — no buyer account needed.

| Column | Type | Why it exists |
|---|---|---|
| `vendor_id` | uuid, FK | Who was contacted. |
| `status` | enum | `sent`/`viewed`/`replied`/`booked`/`declined`/`expired`. `booked` is the self-reported outcome — the closest thing to ROI data. |
| `parent_name` / `parent_email` / `parent_phone` | text | **Buyer** contact. The "parent" naming is kids-party legacy — it means the buyer. Worth renaming. |
| `event_date` | date | When they need it. Powers the availability signal. |
| `postcode` | text | Where the job is. |
| `budget` | numeric | Their stated budget. |
| `message` | text | The brief. |
| `details` | jsonb | Vertical-specific extras (guest count, etc.) — the vertical-agnostic pattern applied to enquiries. |
| `vendor_response`, `responded_at` | text/ts | Reply tracking. |
| `service_id`, `query_id` | uuid, FK | Optional links to the service enquired about and the search that produced it. |
| `parent_id`, `child_age`, `setting` | uuid/int/enum | **Kids-party legacy. Unused. Drop candidates.** |

### `messages` — in-platform buyer↔vendor thread (7 cols)
One thread per enquiry.

| Column | Why |
|---|---|
| `enquiry_id` FK | The thread this belongs to. |
| `sender` | `'buyer'` or `'vendor'`. RLS pins the vendor side; the buyer side goes through a definer function (buyers are anonymous). |
| `body` | Message text (1–4000 chars, checked). |
| `read_by_buyer` / `read_by_vendor` | Unread badges + read receipts. |

### `reviews` — post-enquiry ratings (14 cols, 185 rows)
| Column | Why |
|---|---|
| `vendor_id` FK | Who's reviewed. |
| `rating` | 1–5, required. |
| `title`, `body` | The review. |
| `enquiry_id` FK | **The integrity anchor** — a review can only come from a real enquiry. |
| `verified` | Enquiry reached `booked`. Cleared on all seed rows (they had no booking). |
| `hidden` | Admin moderation. Hidden rows drop out of `rating_avg` via trigger. |
| `event_date`, `details` | When/context; `details` is the vertical-agnostic jsonb. |
| `author_id`, `service_id` | Optional links. |

### `subscriptions` — vendor billing (15 cols)
Mirrors Stripe. Written only by the webhook (service role).

| Column | Why |
|---|---|
| `vendor_id` FK | Whose subscription. |
| `status` | Stripe status → drives `vendors.tier`. |
| `plan_tier` | Which tier bought (1). |
| `billing_interval` | `month`/`year` (annual = 10 months for 12). |
| `stripe_customer_id`, `stripe_subscription_id` | Stripe linkage. |
| `current_period_end`, `cancelled_at`, `trial_ends_at` | Lifecycle. |
| `plan_price_monthly`, `currency` | **Stale** — price lives in `lib/tiers.ts` now. Historical. |

---

## Supporting

| Table | Rows | Why it exists |
|---|---|---|
| **`profiles`** | per-user | 1:1 with `auth.users`. Holds `role` (`parent`/`vendor`/`admin`) — `admin` gates the admin panel; the role enum still uses the legacy `parent` for buyer. Auto-created by a signup trigger. |
| **`contact_events`** | 51 | Analytics event log: `profile_view`, `enquiry_sent`, outbound clicks. `session_id` dedupes views per visit. Powers the vendor Performance card. Anon insert-only; owner-read. |
| **`push_subscriptions`** | live | Web Push credentials for the vendor PWA. Treated as secrets (endpoint+keys can notify someone) — no anon access, sends need service role. |
| **`vendor_blocked_dates`** | 2,471 | Dates a vendor is unavailable. Soft signal — ranks them down for that date, doesn't exclude. |
| **`vendor_photos`** | 0 | Gallery images (Supabase Storage URLs). Empty — seed vendors use category stock photos. |

---

## Infrastructure

| Table | Why it exists |
|---|---|
| **`rate_limits`** | Atomic cross-instance rate limiting (`key`, `window_start`, `count`). RLS on, **no policies** — reachable only through the `check_rate_limit` definer function. That's deliberate, not a gap. |
| **`ai_usage`** | Daily AI-spend counter for the circuit breaker. Admin-read. |

---

## Unused / legacy — candidates for the next cleanup

Present in the schema, **zero or near-zero use**. Kept for now because dropping
needs a check, not because they earn their place.

| Table | Rows | Status |
|---|---|---|
| `queries` | 0 | Was meant to log searches. Superseded by `contact_events`. |
| `tags` / `vendor_tag_assignments` | 0 | Credential-badge system with no verification behind it. The badge renders nothing today (see the vetting-claim commit). |
| `vendor_coverage_areas` | 0 | Per-district coverage. Never built a UI; coverage is a radius. |
| `vendor_schedules` | 0 | Recurring availability. Never built; RLS on with no policies (deny-all). |
| `service_pricing` | 0 | Structured per-service price list. Never surfaced. |

**Column-level legacy** (kids-party / food origin, still present):
- `enquiries.parent_id`, `enquiries.child_age`, `enquiries.setting` — unused, droppable
- `enquiries.parent_*` naming — means "buyer"; rename for clarity
- `vendor_services.secondary_categories` — unused
- `vendors.vibe_tags`, `vendors.occasion_fit` — embedding-only, fold into `attributes`
- `profiles.role` enum value `parent` — means "buyer"

---

## The one structural gap: buyers have no account

`enquiries` stores the buyer by **email string**, not a `buyer_id` FK. There is
no buyer account, so enquiry history lives in the browser's localStorage and
dies with it. Adding optional buyer auth (see BACKLOG) means an
`enquiries.buyer_id uuid` linking to `auth.users`, backfilled by matching email,
so a buyer can claim past anonymous enquiries on first login.
