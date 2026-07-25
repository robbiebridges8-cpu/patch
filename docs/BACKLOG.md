# Backlog

*Things deliberately deferred, with why. Last updated 2026-07-25.*

Strategic decisions live in [PRD.md](./PRD.md). This is the work queue.

> **Full-surface audit (2026-07-25).** Six parallel auditors swept security,
> correctness, schema, UX, SEO and a11y/tests/monitoring/scale — 51 gaps found,
> **43 fixed & committed** (see [gap-audit.html](./gap-audit.html) /
> [register](https://claude.ai/code/artifact/7deba6f3-570c-43a6-8856-2cca8cb40a8d)).
> The role-escalation blocker, the paid-tier ranking regression, the attribute
> duplication/clobber, and the silent Stripe-webhook failure are all closed.
> **Deferred (larger features / assets):** location landing pages, buyer auth UI,
> cross-device thread access, a designed OG share image, real PWA icons, the
> sitemap index, and two Supabase-integration test suites (enquiry batch,
> message/RLS). The first three are detailed below.

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
| **Static-param cap for `/services`** | `generateStaticParams` prerenders the *whole* category × location matrix (616 now, fine). It's multiplicative — past a few thousand combos, cap it to hot pages and let the long tail render on demand. Machinery is already there (`dynamicParams=true` + `revalidate`); it's a one-line change. Do it before the matrix (more categories × more areas) crosses ~2–3k pages. |
| **Sitemap index** | A single sitemap caps at 50k URLs (warns at 45k). Now carries 616 service pages + all vendor URLs; still comfortably under, but the location matrix is what trips it first. Split into a sitemap index before ~45k. |
| PWA icons | Placeholders generated in-repo. Recognisable, want real design. |
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

---

## UX gaps (audit 2026-07-25)

Driven end-to-end. **What's solid:** no 500s on any route; missing vendor 404s,
logged-out dashboard redirects to login; enquiry modal opens and blocks empty
submit (3 required fields, native validation); every empty state has a CTA;
search streams a skeleton so the 6–9s feels responsive.

### Functional gaps — the "bulletproof" ones
| Gap | Impact |
|---|---|
| **Buyer enquiry history is localStorage-only** | Clear the browser or switch device and a buyer's sent enquiries / review links vanish. No account to recover them. The single biggest buyer-side UX hole. |
| **Free-tier locked lead can read as broken** | A free vendor gets "someone enquired" but can't see who. Correct by design, but needs to *feel* like a paywall, not a bug — worth a usability check with a real vendor. |
| **Magic-link auth** | Friction, and a poor fit for the PWA (email→browser→app handoff). Backlogged above; flagged here as a UX cost, not just a tech one. |
| **Search 6–9s vs Netlify 10s timeout** | Streaming hides it from the user until it 500s under load. Config, above. |

### Consistency / framing gaps (deliberate hold — your call on timing)
The homepage was made industry-agnostic last week; **`/search` and the metadata
were not**, so the two now disagree. All food-shaped:
- **`<title>` / meta / OG**: "mobile food & catering vendors in London" — drives Google + AI-answer text.
- **`/search` empty state**: renders the food QuickStarts (Popular occasions + Cuisines) and copy "Describe your occasion… the vibe, guest count".
- **Search bar placeholder**: "pizza van for a 40th in Hackney…".
- **Profile capacity label**: "Serves 40–200 **guests**".

None is a bug; all contradict the horizontal positioning. Cheap to flip when you're ready.
