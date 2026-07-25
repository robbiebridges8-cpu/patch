import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for how a vendor's searchable text is composed and
// embedded. Mirrors scripts/seed-500.mjs so edits and seeds stay consistent.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

interface VendorText {
  primary_category?: string | null;
  description?: string | null;
  bio?: string | null;
  signature_items?: unknown;
  attributes?: Record<string, unknown> | null;
}
interface ServiceText {
  title?: string | null;
  description?: string | null;
  attributes?: Record<string, unknown> | null;
}

/** Compose the rich "document" that gets embedded (not what's shown to users). */
export function composeEmbeddingText(vendor: VendorText, service: ServiceText): string {
  const sig = Array.isArray(vendor.signature_items)
    ? (vendor.signature_items as unknown[]).map((s) => (typeof s === "string" ? s : (s as { name?: string })?.name)).filter(Boolean)
    : [];
  // Free-form attributes are the whole point of the vertical-agnostic model:
  // whatever a vendor put in there — dietary, certifications, licences, kit —
  // becomes searchable text without the schema needing to know what it means.
  const attrs = { ...(vendor.attributes ?? {}), ...(service.attributes ?? {}) };
  const attrLines = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);

  const parts = [
    vendor.primary_category,
    service.title,
    service.description,
    vendor.description,
    vendor.bio,
    sig.length ? "Signature items: " + sig.join(", ") : null,
    attrLines.length ? attrLines.join("\n") : null,
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
    .select("primary_category, description, bio, attributes, signature_items")
    .eq("id", vendorId)
    .maybeSingle();
  if (ve || !vendor) return { ok: false, error: ve?.message || "vendor not found" };

  const { data: service, error: se } = await client
    .from("vendor_services")
    .select("id, title, description, attributes")
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
