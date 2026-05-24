# Patch

AI-powered marketplace for mobile food vendors and small caterers in London. Describe your event in plain English — the occasion, the vibe, the guest count — and Patch matches you with the right street food trucks, caterers, and mobile bars.

## Stack

- **Frontend**: Next.js 15 (App Router, TypeScript, CSS Modules)
- **Database**: Supabase (Postgres + pgvector + PostGIS)
- **AI**: Anthropic Claude (text-to-SQL-to-text search pipeline)
- **Hosting**: Vercel (planned)

## Local development

```bash
npm install
cp .env.local.example .env.local
# Add your Supabase and Anthropic keys to .env.local
npm run dev
```

App runs at http://localhost:3000.

## Environment variables

See `.env.local.example`:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `ANTHROPIC_API_KEY` — Anthropic API key (enables AI search)

## Pages

- `/` — Landing page with hero search, categories, testimonials
- `/search` — Search results with AI matching, filters, sort
- `/vendors/[slug]` — Vendor profile with services, reviews, contact
- `/about`, `/privacy`, `/terms`, `/for-vendors` — Static pages

## Data

74 vendors across 15 categories (pizza vans, burger trucks, BBQ, tacos, grazing, ice cream, desserts, coffee, canapés, Asian street food, Indian, Middle Eastern, British comfort, vegan, cocktail bars). Seed data in `seed/vendors.json`.
