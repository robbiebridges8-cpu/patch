/**
 * How locations are written throughout the product.
 *
 * Buyers don't think in postcodes — they think "somewhere around Hackney".
 * Leading with a postcode is friction when asking, and false precision when
 * displaying (listings store an outward code, not a street address). So the
 * area name leads and the outward code goes in brackets for the people who do
 * know it: "Hackney (E8)".
 */

/** "E8 3RL" -> "E8". Already-outward codes pass through unchanged. */
export function outwardCode(postcode?: string | null): string | null {
  if (!postcode) return null;
  const first = postcode.trim().toUpperCase().split(/\s+/)[0];
  return first || null;
}

/**
 * The canonical label. Degrades sensibly in every direction: area alone if the
 * postcode is missing, the code alone if we never resolved an area, and null if
 * we have neither — callers should render nothing rather than an empty bracket.
 */
export function formatLocation(
  area?: string | null,
  postcode?: string | null,
): string | null {
  const code = outwardCode(postcode);
  const name = area?.trim() || null;

  if (name && code) return `${name} (${code})`;
  return name || code;
}

/**
 * Same idea for a distance-qualified label on search cards:
 * "Hackney (E8) · 2.4 mi away".
 */
export function formatLocationWithDistance(
  area: string | null | undefined,
  postcode: string | null | undefined,
  miles: number | null | undefined,
): string | null {
  const base = formatLocation(area, postcode);
  if (miles == null) return base;
  // One decimal under ten miles, whole numbers above — but never a dangling
  // ".0", because "3 mi away" reads better than "3.0 mi away".
  const d =
    miles < 10
      ? miles.toFixed(1).replace(/\.0$/, "")
      : String(Math.round(miles));
  return base ? `${base} · ${d} mi away` : `${d} mi away`;
}
