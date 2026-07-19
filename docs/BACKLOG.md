# Backlog

*Things deliberately deferred, with why. Last updated 2026-07-19.*

Strategic decisions live in [PRD.md](./PRD.md). This is the work queue.

---

## Blocks launch

**Config, not code — nothing here needs building.**

| Item | Why it matters |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Stripe webhook can't write subscription state, so **tiers never update on payment**. Push sending is also dead without it. |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemap, Stripe redirects and the CSP's `upgrade-insecure-requests` all key off it. |
| `RESEND_API_KEY` + `ENQUIRY_FROM_EMAIL` | No email at all — vendors never hear about a lead. |
| Stripe live keys + price IDs | `STRIPE_PRICE_PAID_MONTHLY` / `_YEARLY`. Checkout 503s without them. |
| Anthropic credit | Search currently degrades to keyword-only. Works, but isn't the product. |
| **Netlify function timeout** | Search takes 6–9s against a 10s default. Will surface as random 500s under load, not as slowness. Raise the limit or move narration to a client-triggered endpoint. |

---

## High value, not started

### Location landing pages — the biggest organic lever
A `/services/[category]/[location]` route over existing PostGIS data. People search
*"plumber in Hackney"*, not *"plumber"*. Thousands of indexable pages from data
already held, and it's what makes free listings pay for themselves. Also the
main input to being cited by AI answers.

### Reranking
At 100k vendors, vector-only recall degrades. Voyage sells rerank models. Real
per-search cost (~$400/mo at 1M searches), meaningful quality gain. Not needed
below ~10k listings.

### Vendor auth: magic link → email OTP
Magic links are a poor fit for an installed app — the email → browser → app
handoff is fragile and drops people. **Do this before vendors are using the PWA
on phones, not after.** Also removes a common source of "I can't log in" support.

### Distributed abuse defences, phase 2
Rate limiting and a spend cap are done. Still missing: Turnstile on `/search`,
and a WAF in front of origin. The current guard is good; it isn't defence in
depth.

---

## Cleanup — small, known

| Item | Note |
|---|---|
| `/search` empty state | Still renders the food-specific QuickStarts (cuisine list, "Browse by food"). Removed from the homepage; missed here. |
| Root `<title>` / meta description | Still "mobile food & catering vendors in London". Drives what Google and AI answers show. |
| `/about` copy | Still food-framed. |
| PWA icons | Placeholders generated in-repo. Recognisable, want real design. |
| Sitemap index | Paginated correctly, but a single sitemap caps at 50k URLs. Warns at 45k; needs splitting beyond that. |
| `vendor_schedules` | Dead table, RLS on with no policies. Drop it or use it. |
| Second paid tier | `tier` is an integer and tier 2 already inherits every feature — adding one is a price constant and a name, no migration. |
| Monitoring providers | Sentry and analytics seams exist, no keys wired. |

---

## Decided against (don't re-litigate without new information)

- **A buyer app.** Acquisition is SEO; the transaction recurs every ~18 months.
  An app cuts the channel the model depends on. See PRD §3.1 and the Airbnb
  comparison — Airbnb's app works because it owns the transaction and people
  travel repeatedly. Neither is true here.
- **Per-vertical attribute schemas.** Unmaintainable across 1,000+ long-tail
  verticals. The embedding is the schema (PRD §3.3).
- **AI-emitted hard filters.** An LLM writing "nut free" against a stored
  "nut-free" fails silently, which for a dietary or certification filter is a
  safety failure (PRD §3.4).
- **Taking payment / commission.** Higher ceiling, but creates exactly the
  liability discovery-only exists to avoid. Genuinely open as a *strategy*
  change (PRD §4) — just not a small one.
