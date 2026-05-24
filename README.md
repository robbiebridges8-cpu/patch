# Patch

UK consumer marketplace for kids' party vendors — entertainers, bouncy castles, soft play, face painters, party food, and more. AI-native discovery, not a directory. First patch: SW London.

## Stack

Next.js 15 (App Router, TypeScript), Supabase (Postgres + pgvector + PostGIS), Tailwind, shadcn/ui.

## Local development

```bash
npm install
npm run dev
```

App runs at http://localhost:3000.

## Supabase (local)

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

```bash
# Start local Supabase (Postgres, Auth, Storage, etc.)
supabase start

# Copy the anon key and URL from the output into .env.local
cp .env.local.example .env.local
# Edit .env.local with the values from `supabase start`
```

### Run migrations

```bash
supabase db reset
```

This applies all migrations in `supabase/migrations/` and then runs `supabase/seed.sql`.

### Run migrations only (no reset)

```bash
supabase migration up
```

### Seed only

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

## Environment variables

See `.env.local.example` for the full list.
