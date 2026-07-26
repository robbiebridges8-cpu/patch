# Patch — Product Requirements

*Living document. Last updated 2026-07-18.*

---

## 1. What Patch is

A discovery marketplace for local services. A buyer describes what they need in
plain words — *"someone to do vegan canapés for a launch"*, *"a lifeguard for a
pool party on the 14th"* — and gets a short, reasoned, photo-led shortlist.

**Food is the proving vertical, not the business.** The business is a catch-all:
every casual service, freelancer and trade. The thing people currently use
Google, Instagram and word-of-mouth for.

**Patch never touches the transaction.** Buyers and vendors talk; money and
contracts happen off-platform.

---

## 2. Where we are

Working two-sided product, deployed nowhere. **19 commits unpushed on `main`.**

| Area | State |
|---|---|
| Buyer discovery | AI search (parse → embed → vector → narrate), streaming, pagination, no-results recovery, shortlist, quick-view, `/services/[category]/[location]` landing pages |
| Enquiry & comms | Enquiry flow, buyer tracker (localStorage + optional account), in-platform messaging, reviews tied to real enquiries |
| Buyer accounts | Optional passwordless email-OTP login, claim-enquiries-by-email, cross-device history + RLS |
| Vendor | Self-serve onboarding, listing editor, photos, availability, lead inbox, listing-strength meter, buyer preview, analytics |
| Monetisation | Free + paid tiers, locked leads, feature gates, annual prepay, Stripe scaffold |
| Admin | Approve/reject, review moderation, tier override, platform stats |
| Quality | WCAG AA verified, mobile-verified on real WebKit, 86 unit + 18 e2e specs |

**Data:** 500 seed vendors (London food), 185 reviews, 0 accounts, 0 real enquiries.

**Not live:** no domain, no deploy, no paying vendors, no buyers.

---

## 3. Strategic decisions

The decisions that shape everything else, and what would reverse each one.

### 3.1 Discovery only — never the transaction

We do not take payment, hold funds, or mediate disputes. The value is
match quality, not escrow.

**Why:** a bad gas engineer or caterer creates liability we can't carry as a
small team. Staying out of the transaction removes payment disputes, chargebacks,
FCA territory, and being party to the contract.

**What it costs:** we can't see outcomes, so we can't prove ROI to vendors —
the failure mode that churns lead-gen marketplaces. *Mitigation:* vendors
self-report via the "Booked" status in their inbox. **"We sent 14 enquiries,
you marked 3 booked" is the single most important number in the product.**

**What survives anyway:** hosting reviews about named businesses (defamation),
user-to-user messaging (UK Online Safety Act), and ranking transparency if paid
placement influences results (CMA).

### 3.2 Horizontal platform, one vertical at a time

Food proves the model. The ceiling is every service.

**Why:** UK street food is ~7,000 businesses — too small to be the business.
Horizontal, the addressable set is 100k+ and the £20–50/mo model works.

**What it costs:** each vertical is a **fresh cold start**, not a free
extension. The AI discovery layer generalises; supply density and review
liquidity don't. Buyers search "plumber near me", so SEO is won vertical by
vertical. The catch-all brand is the *output* of stacking verticals.

### 3.3 The embedding is the schema

Only genuinely universal constraints are columns: **location, price,
availability**. Everything vertical-specific lives in a free-form `attributes`
jsonb that is folded into the embedding.

**Why:** a per-vertical attribute registry (Thumbtack/Bark's approach) needs an
ops team to maintain question trees and does not survive 1,000+ long-tail
verticals. Semantic search already does the matching — the taxonomy was
decoration. Verified: deleting a 28-category taxonomy cost nothing; *"wood fired
pizza for a wedding"* still returns pizza vendors.

**Corollary:** category labels exist for **SEO and display only, never
filtering**. They can be fuzzy or wrong without breaking search.

### 3.4 The AI never emits hard filters

The parse extracts only budget, location and date. **Category** is the one
UI-supplied hard filter (from a quick-start chip or a `/services` landing page).
Everything else — dietary, certifications, setting, guest count — is matched
**semantically** from the brief (§3.3), never from a hardcoded filter panel.

**Why.** Two reasons converge. *Agnosticism:* a "Vegan / Halal" sidebar makes no
sense on a plumber search, so a dietary filter was never horizontal. *Safety:* an
LLM — or a hardcoded filter — turning `"nut free"` into a silent containment
filter against a self-declared `"nut-free"` tag fails *silently* on a mismatch,
and Patch doesn't vet those tags anyway (§3.1). So a critical need stays in the
semantic query (ranked and surfaced), and the buyer confirms it with the vendor.
The no-results ladder relaxes budget → area → category, and never touches the
brief itself.

*(Earlier this session the dietary sidebar filter — a food-vertical vestige that
contradicted §3.3 — was removed; dietary is now semantic-only.)*

### 3.5 Free listings, paid to unlock

Listing is free. Free ranks below paid and its leads arrive **locked**.

**Why:** in cold start, supply density *is* the product — a buyer who gets two
results doesn't come back. Free listings are also the SEO asset (tens of
thousands of indexed pages) and a genuine product for a sole trader whose only
web presence is a Facebook page.

**Why locked rather than capped:** a numeric cap silently drops enquiries and
the *buyer* hits the dead end and blames Patch. A locked lead always arrives,
is always answerable on upgrade, and puts a specific job in front of the vendor.

**Sequencing (unresolved — see §4):** the harshest version of this, excluding
free from general search entirely, is right *later*. Applied now it starves
search of the density that makes the product work.

### 3.6 Priced as advertising, not lead-gen

**£29/month** (provisional), or £290/year — 10 months for 12.

**Why:** below the threshold where a sole trader audits spend. We compete with a
Yell listing and an Instagram boost, not Checkatrade at £1,000/yr. It also
sidesteps the attribution problem: at £29 nobody demands a CAC analysis.

**What it doesn't fix:** silent churn (vendors lapse rather than cancel — hence
annual prepay), support cost per vendor (hence the self-serve completeness
meter), and the volume required (~2,800 paying vendors for £1M ARR).

### 3.7 Ranking is additive, never a hard sort

Paid gets a weight added to its similarity score; it does not sort above free.

**Why:** a hard sort puts an irrelevant paid vendor above a perfect free match,
which makes the "reasoned shortlist" promise a lie. Measured: promoting a
vendor from #40 lifts it to #12, while **position 1 stayed a free vendor**
because relevance still won.

The three weights (`tier_rank_weight`) are a **deliberate dial** — widen the
gap as paid supply grows.

### 3.8 One paid tier, a second reserved

`tier` is an integer, not a boolean, and tier 2 already inherits every feature.
Adding a second paid tier is a price constant and a name — no billing migration.

### 3.9 A lapsed subscription drops to free, never hidden

**Why:** their profile, reviews and SEO presence are supply density worth
keeping, and a live free listing is a standing upgrade prompt.

---

## 4. Open questions

*Deferred work and its rationale lives in [BACKLOG.md](./BACKLOG.md).*

| Question | Notes |
|---|---|
| **Price point** | £29 is provisional within your £20–50 range. One line in `src/lib/tiers.ts`. Easier to discount later than to raise. |
| **When to tighten the free tier** | Free is currently *in* search, ranked below paid. Excluding it (name-lookup only) is right once paid supply is dense enough that search still works. No trigger defined. |
| **Vertical #2, and when** | Needs a signal that food liquidity works first. What's the bar? |
| **Whether discovery-only is permanent** | Payments would unlock commission on a £1.2bn (food alone) GMV, at the cost of the liability position in §3.1. |
| **Reranking** | At 100k vendors, vector-only recall degrades. Adds real per-search cost. Not built. |

---

## 5. Known risks

**Ordered by what would hurt most.**

1. **`/search` is unauthenticated and costs ~$0.0064 per request in Claude
   spend.** Now mitigated: distributed rate limiting (Postgres `check_rate_limit`,
   survives across serverless instances) and a hard daily Anthropic spend cap
   (`consume_ai_budget`) are live. **Still missing: a CAPTCHA/Turnstile on
   `/search` and a WAF** — the guard is good but not defence in depth.
2. **Search takes 6–9s; Netlify's function timeout is 10s.** Will surface as
   random 500s under load, not as slowness.
3. **`SUPABASE_SERVICE_ROLE_KEY` is unset** — the Stripe webhook can't write
   subscription state, so **tiers won't update on payment**. Billing silently
   does nothing.
4. **Cold start.** No buyers, no paying vendors. Vendor supply is small enough
   to work manually (~1,500–2,500 in London); buyer demand is the real spend.
5. **Voyage rate limits** degrade search to keyword fallback. Now retried and
   visibly disclosed, but a paid tier removes the ceiling.
6. **Competition.** Bark is the horizontal UK analogue at scale; Checkatrade,
   MyBuilder and Rated People hold trades. Plain-language AI discovery is a real
   UX edge but copyable in a quarter. The durable moat is supply and reviews per
   vertical.

---

## 6. Economics (measured, not estimated)

Per search: **$0.0064** — 77% Sonnet narration, 18% Haiku parse, **0.03%
embeddings**. Vendor count barely affects cost; search volume is the whole curve.

| Scale | Infra |
|---|---|
| Today (500 vendors, low traffic) | ~$25–50/mo |
| 100k vendors, 1M searches/mo | ~$8,100/mo |

**Biggest lever:** moving narration to Haiku halves the bill. Untested for
quality.

Non-infra platform costs (pen test, GDPR, insurance, possibly SOC 2) run
**£30–80k/year** and dwarf hosting. People are the real P&L: a two-person team
is £120–150k/yr loaded.

*CAC figures discussed in planning (£40–150/enquiry) are **estimates, not
measurements**. Validate with ~£500 of ads before building a plan on them.*
