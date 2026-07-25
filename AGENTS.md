<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Patch — project map

AI-native marketplace for local services in London. A buyer describes a job in
plain words → AI returns a short, reasoned, photo-led shortlist. Food is the
proving vertical; the platform is horizontal. Patch never touches the transaction.
Strategy → `docs/PRD.md` · schema → `docs/SCHEMA.md` · work queue → `docs/BACKLOG.md`.

**Stack:** Next.js 16 (App Router, TS, `src/`, CSS Modules) · Supabase (Postgres
+ pgvector + PostGIS, RLS on every table) · Anthropic (Haiku parse, Sonnet
narrate) · Voyage `voyage-3` embeddings · Netlify.

## Invariants — don't break these without updating the PRD

- **The embedding is the schema.** Only *location, price, availability* are hard
  filters. Everything vertical-specific lives in an `attributes` jsonb folded
  into the embedding. Category labels are for display/SEO, never filtering.
- **Price, dietary, capacity, setting live on `vendor_services`, not `vendors`.**
  Reads merge both attribute bags; each key has exactly one home.
- **The AI never emits hard filters** — categories/attributes come only from the
  UI. The no-results ladder relaxes budget → area → category, *never attributes*.
- **Ranking is additive** (`tier_rank_weight`), never a hard sort — trust the
  `match_vendors` RPC order.
- **Free listings, locked leads.** Lead redaction is server-side (it ships in the
  RSC payload) — `src/lib/leadRedaction.ts`.

## Key paths

- AI search `src/lib/ai.ts` · search page `src/app/search/page.tsx` · profile
  `src/app/vendors/[slug]/page.tsx` · vendor dashboard `src/app/vendor/dashboard/`
- Location/GEO pages `src/app/services/[category]/[location]/` (data in
  `src/lib/serviceAreas.ts`)
- Migrations `supabase/migrations/` — apply via the Supabase MCP tool, then save
  a matching file (test in a rolled-back tx first).

## Working rules

- **Pushing to `main` is fine** (Netlify CD is off, no cost). **Never trigger a
  deploy** — deploys are manual.
- **Never claim vendors are vetted or verified.** Listings are self-declared;
  reviews come only from real enquiries.
- **Keep docs in sync.** A change to the schema, the backlog, or anything that
  conflicts with `docs/PRD.md` must update the affected doc in the *same* change.
  The `.html` files in `docs/` are point-in-time snapshots, not living docs.
