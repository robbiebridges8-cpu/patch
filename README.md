# Patch

AI-native marketplace for hiring local services in London. Describe a job in
plain words — the occasion, area, budget, guest count — and Patch returns a
short, reasoned, photo-led shortlist of vendors that fit. Food and catering is
the proving vertical; the platform is built for every casual service and trade.
Patch never touches the transaction.

> **Orientation for contributors (and agents):** [`AGENTS.md`](./AGENTS.md) is the
> project map and the invariants. Strategy lives in [`docs/PRD.md`](./docs/PRD.md),
> the schema in [`docs/SCHEMA.md`](./docs/SCHEMA.md), the work queue in
> [`docs/BACKLOG.md`](./docs/BACKLOG.md).

## Stack

- **App**: Next.js 16 (App Router, TypeScript, `src/`, CSS Modules) on Netlify
- **Data**: Supabase — Postgres + pgvector + PostGIS, RLS on every table
- **AI search**: Anthropic Claude (Haiku parse → Sonnet narrate) + Voyage
  `voyage-3` embeddings. Pipeline: parse the brief → geocode → embed → vector +
  location search (`match_vendors` RPC) → narrate the shortlist.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the keys below
npm run dev                  # http://localhost:3000
```

**Avoid burning Anthropic credit in dev and tests:** set `PATCH_STUB_AI=1` to stub
the paid Claude calls (it's ignored on https, so it never affects production).

Scripts: `npm run build`, `npm start`, `npm test` (Vitest), `npm run test:e2e`
(Playwright, runs with AI stubbed). Seed/backfill scripts live in `scripts/`.

## Environment variables

**Core (search + data):**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `ANTHROPIC_API_KEY` — query parse + narration
- `VOYAGE_API_KEY` — embeddings
- `NEXT_PUBLIC_SITE_URL` — canonical URLs, sitemap, OG, Stripe redirects

**Features (each no-ops cleanly if unset):**
- `SUPABASE_SERVICE_ROLE_KEY` — Stripe webhook writes + Web Push (secrets)
- `RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL` — transactional email
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` — billing
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push

**Dev / ops:** `PATCH_STUB_AI` (stub paid AI), `AI_DAILY_SEARCH_CAP` (spend cap).

## Key routes

- `/` — hero search, how-it-works, FAQ
- `/search` — AI-matched shortlist (streamed)
- `/services` and `/services/[category]/[location]` — category × area landing pages
- `/vendors/[slug]` — vendor profile
- `/vendor/dashboard` — vendor control panel (listing, leads, photos, availability)
- `/enquiries`, `/shortlist` — buyer-side tracking
- `/about`, `/for-vendors`, `/privacy`, `/terms`

## Data

500 seed vendors (London food) across 28 categories, in `seed/`. Loaded and
embedded via the scripts in `scripts/`.
