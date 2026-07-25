import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe. Pings the database with a trivial, RLS-safe
 * query so uptime monitoring can distinguish "app up, DB reachable" from a
 * user-facing 500. Deliberately checks only what a request actually depends on
 * at the edge — Anthropic/Voyage degrade gracefully to keyword search, so they
 * are not readiness-critical and aren't probed here (and aren't called, to
 * avoid spending on a health check).
 */
export async function GET() {
  const started = Date.now();
  const { error } = await supabase.from("vendors").select("id").limit(1);
  const ms = Date.now() - started;

  if (error) {
    return Response.json(
      { status: "degraded", db: "error", error: error.message },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { status: "ok", db: "ok", latencyMs: ms },
    { headers: { "cache-control": "no-store" } },
  );
}
