# Database schema

*Live reference, regenerated after the 2026-07-25 refactor. 13 app tables.*

Every table has **Row Level Security on**. Convention: `id` is a `uuid` PK,
`created_at`/`updated_at` are `timestamptz` defaulting to `now()` — omitted from
the tables below unless they carry meaning. Nothing here is dead weight; the
refactor dropped 6 tables, 15 columns, and 4 orphaned enum types.

---

## Core domain

### `vendors` — the business (26 cols, 500 rows)
| Column | Why it exists |
|---|---|
| `slug` (unique) | URL + SEO identity. |
| `name`, `description`, `bio` | Display copy; all feed the embedding. |
| `status` (enum draft/live/paused/rejected) | Only `live` is public — the core RLS gate. |
| `owner_id` (FK auth.users) | Controlling account. Null = unclaimed. |
| `tier` (smallint) | 0 free / 1 paid. Drives ranking + the lead paywall. Integer so a 2nd tier needs no migration. |
| `base_postcode`, `base_location` (geography), `coverage_radius_miles`, `area` | Location — the one clean hard filter (`ST_DWithin` + radius). `area` is the "Hackney (E8)" label. |
| `price_range` | The "££" band for JSON-LD structured data — an establishment-level property, not a price anyone pays. The actual price lives on the service (see `vendor_services.price_from`). |
| `contact_email`, `contact_phone`, `website`, `instagram` | Contact + outbound-click analytics targets. |
| `faq` (jsonb), `signature_items` (jsonb) | Profile content; signatures also feed the embedding. |
| `attributes` (jsonb) | **The vertical-agnostic bag.** Dietary, capacity, certifications, `vibe`, `good_for` — anything trade-specific. Folded into the embedding; UI-set values are exact filters. |
| `rating_avg`, `review_count` | Denormalised from `reviews` by trigger. |
| `primary_category` | The business's headline category for display + SEO — **never an AI hard filter**. Mirrors `vendor_services.category` today (1:1), but they're distinct concepts: in the 1:many future a vendor offering several service categories still has one primary label. The editor writes both in sync. |
| `years_active` | "Trading 4 yrs" trust signal. |

### `vendor_services` — what a vendor offers (12 cols, 500 rows)
Search reads **this** table, not `vendors`. 1:1 today, modelled 1:many.

| Column | Why |
|---|---|
| `vendor_id` (FK) | Owner. |
| `title`, `description` | Service copy; embedding input. |
| `category` | Exact-match category filter (UI-set only). |
| `attributes` (jsonb) | **Single source of truth for capacity, dietary, etc.** |
| `embedding` (vector 1024) | Voyage voyage-3 vector, HNSW-indexed — what semantic search matches. |
| `price_from`, `price_notes`, `position` | **Where price lives.** `price_from` is the budget hard filter and the "from £X" shown everywhere; `price_notes` the free-text caveat ("£14/head, min spend £600"). A vendor with two services can price them differently — the reason price is here, not on the business. `position` orders the list. |
| `attributes` **key ownership** | `dietary`, `capacity_min/max`, `setting` and the free-form extras live **here** (search reads this bag). `vibe` / `good_for` live on `vendors.attributes`. Reads (profile + embedding) merge both bags, so each key has exactly one home — the editor never double-writes. |

### `enquiries` — a buyer contacting a vendor (17 cols)
Created anonymously; no account needed to send.

| Column | Why |
|---|---|
| `vendor_id` (FK), `service_id` (FK) | Who / which service. |
| `status` (enum) | sent/viewed/replied/booked/declined/expired. `booked` is the self-reported outcome — the closest thing to ROI data. |
| `buyer_name`, `buyer_email`, `buyer_phone` | Buyer contact. **Renamed from `parent_*`** (kids-party legacy). |
| `buyer_id` (FK auth.users, nullable) | **Buyer identity.** Null at send (anonymous); set when a buyer claims their history by email on login. Indexed on `lower(buyer_email)` for that claim. |
| `event_date`, `postcode`, `budget` | When / where / how much. |
| `message` | The brief. |
| `details` (jsonb) | Vertical-specific extras (guest count, etc.). |
| `vendor_response`, `responded_at` | Reply tracking. |

### `messages` — buyer↔vendor thread (7 cols)
`enquiry_id` FK · `sender` (buyer/vendor) · `body` (1–4000, checked) ·
`read_by_buyer`/`read_by_vendor`. Vendor side via RLS; buyer side (anonymous)
via a definer function.

### `reviews` — post-enquiry ratings (14 cols, 185 rows)
`vendor_id`, `rating` (1–5), `title`, `body`, `event_date`, `details` (jsonb).
`enquiry_id` FK is the integrity anchor — `submit_review` only writes a review
for a real enquiry, and it now rejects reviewing a listing you own. `ON DELETE
RESTRICT` stops a deleted enquiry orphaning its review. (The 185 synthetic seed
reviews predate the anchor and carry a null `enquiry_id`; real user reviews are
always anchored.) `verified` = enquiry reached `booked`. `hidden` = admin-moderated
(drops out of `rating_avg` via trigger). `author_id` = logged-in reviewer.

### `subscriptions` — vendor billing (14 cols)
Written only by the Stripe webhook (service role). `vendor_id`, `status`
(→ `vendors.tier`), `plan_tier`, `billing_interval` (month/year), the two
`stripe_*` ids, period/cancellation timestamps, `currency`.

---

## Supporting

| Table | Rows | Why |
|---|---|---|
| `profiles` | per-user | 1:1 with auth.users. `role` enum **buyer**/vendor/admin (renamed from `parent`); `admin` gates the admin panel. Auto-created by signup trigger. |
| `contact_events` | ~50 | Analytics log: `profile_view`, `enquiry_sent`, outbound clicks. `session_id` dedupes views. Anon insert-only, owner-read. |
| `push_subscriptions` | live | Web Push creds for the vendor PWA. Treated as secrets — no anon access. |
| `vendor_blocked_dates` | 2,471 | Unavailable dates (`reason` enum). Soft signal — ranks down, doesn't exclude. |
| `vendor_photos` | 0 | Gallery (Storage URLs). Empty; seed uses category stock. |

## Infrastructure

| Table | Why |
|---|---|
| `rate_limits` | Atomic cross-instance rate limiting. RLS on, no policies — reached only via the `check_rate_limit` definer function (deliberate). |
| `ai_usage` | Daily AI-spend counter for the circuit breaker. Admin-read. |

---

## Enums (6)
`vendor_status`, `enquiry_status`, `subscription_status`, `user_role`
(buyer/vendor/admin), `contact_event_type`, `blocked_reason`. The four
kids-party orphans (`service_type`, `setting_type`, `tag_category`, `day_type`)
were dropped in the refactor.

## What the refactor removed
- **Tables (6):** `queries` (superseded by contact_events), `tags` +
  `vendor_tag_assignments` (credential system with no verification behind it),
  `service_pricing`, `vendor_coverage_areas`, `vendor_schedules` (never built).
- **Columns:** `enquiries.parent_id/child_age/setting/query_id`,
  `contact_events.query_id`, `vendor_services.secondary_categories`,
  `vendors.vibe_tags/occasion_fit` (folded into `attributes`),
  `subscriptions.plan_price_monthly`.
- **Renames:** `enquiries.parent_* → buyer_*`; `user_role 'parent' → 'buyer'`.
- **Moved to the service:** `vendors.price_from` + `price_notes` → `vendor_services`.
  A vendor with two services needs two prices, so price is authored on the
  service (where search already reads). `vendors.price_range` stays — it's the
  categorical £-band for JSON-LD, an establishment property, not a paid price.

## The remaining known gap
`enquiries.buyer_id` now exists, but **there is no buyer-auth UI yet** — buyers
still can't log in, so enquiry history is localStorage-only in practice. The
schema is ready (nullable FK + email index for claim-by-email); the flow
(optional post-enquiry OTP/Google login, backfill by email) is the next build.
See BACKLOG.
