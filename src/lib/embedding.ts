import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for how a vendor's searchable text is composed and
// embedded. Mirrors scripts/seed-500.mjs so edits and seeds stay consistent.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

interface VendorText {
  primary_category?: string | null;
  description?: string | null;
  bio?: string | null;
  vibe_tags?: string[] | null;
  occasion_fit?: string[] | null;
  dietary_options?: string[] | null;
  signature_items?: unknown;
}
interface ServiceText {
  title?: string | null;
  description?: string | null;
  dietary_options?: string[] | null;
}

/** Compose the rich "document" that gets embedded (not what's shown to users). */
export function composeEmbeddingText(vendor: VendorText, service: ServiceText): string {
  const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
  const sig = Array.isArray(vendor.signature_items)
    ? (vendor.signature_items as unknown[]).map((s) => (typeof s === "string" ? s : (s as { name?: string })?.name)).filter(Boolean)
    : [];
  const dietary = arr(service.dietary_options).length ? arr(service.dietary_options) : arr(vendor.dietary_options);

  const parts = [
    vendor.primary_category,
    service.title,
    service.description,
    vendor.description,
    vendor.bio,
    sig.length ? "Signature items: " + sig.join(", ") : null,
    arr(vendor.vibe_tags).length ? "Vibe: " + arr(vendor.vibe_tags).join(", ") : null,
    arr(vendor.occasion_fit).length ? "Good for: " + arr(vendor.occasion_fit).join(", ") : null,
    dietary.length ? "Dietary: " + dietary.join(", ") : null,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Embed a document via Voyage voyage-3; returns the pgvector literal string. */
export async function embedDocument(text: string): Promise<string> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not set");
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "voyage-3", input: [text], input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const data = await res.json();
  return `[${data.data[0].embedding.join(",")}]`;
}

/**
 * Recompute and store a vendor's service embedding from its current DB text.
 * Best-effort: returns {ok:false, error} instead of throwing so callers can
 * keep the user's save successful even if embedding fails.
 * The passed client must have permission to update the vendor's service row.
 */
export async function reembedVendor(
  client: SupabaseClient,
  vendorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: vendor, error: ve } = await client
    .from("vendors")
    .select("primary_category, description, bio, vibe_tags, occasion_fit, dietary_options, signature_items")
    .eq("id", vendorId)
    .maybeSingle();
  if (ve || !vendor) return { ok: false, error: ve?.message || "vendor not found" };

  const { data: service, error: se } = await client
    .from("vendor_services")
    .select("id, title, description, dietary_options")
    .eq("vendor_id", vendorId)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (se || !service) return { ok: false, error: se?.message || "service not found" };

  let vector: string;
  try {
    vector = await embedDocument(composeEmbeddingText(vendor as VendorText, service as ServiceText));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "embed failed" };
  }

  const { error: ue } = await client
    .from("vendor_services")
    .update({ embedding: vector })
    .eq("id", (service as { id: string }).id);
  if (ue) return { ok: false, error: ue.message };
  return { ok: true };
}
