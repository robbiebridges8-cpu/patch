import Link from "next/link";
import type { ParsedQuery } from "@/lib/ai";
import styles from "./NoResults.module.css";

/**
 * A dead end is a lost buyer. Even after auto-widening found nothing, give them
 * one-click ways out: drop the specific constraint that's likely to blame, or
 * jump to a broader brief.
 */
export default function NoResults({
  query,
  parsed,
  params,
  outOfScope = false,
}: {
  query: string;
  parsed: ParsedQuery | null;
  params: { type?: string; budget?: string; sort?: string };
  /** The request is for something Patch doesn't cover yet (not just a no-match). */
  outOfScope?: boolean;
}) {
  // Each escape hatch drops exactly one constraint and keeps the rest.
  function urlWithout(drop: "type" | "budget"): string {
    const sp = new URLSearchParams();
    sp.set("q", query);
    if (params.type && drop !== "type") sp.set("type", params.type);
    if (params.budget && drop !== "budget") sp.set("budget", params.budget);
    return `/search?${sp.toString()}`;
  }

  const escapes: { href: string; label: string }[] = [];
  if (params.budget) {
    escapes.push({ href: urlWithout("budget"), label: `Ignore the £${params.budget} budget` });
  }
  if (params.type) {
    escapes.push({ href: urlWithout("type"), label: `Look beyond ${params.type.split(",").join(" + ")}` });
  }

  // Nothing explicit to drop — suggest loosening what the brief itself implied.
  const implied: string[] = [];
  if (!params.budget && parsed?.budget_max) implied.push("raising or removing the budget");
  if (parsed?.location) implied.push(`widening the area beyond ${parsed.location}`);
  if (!params.type && parsed?.categories?.length) implied.push(`trying something other than ${parsed.categories.join(" or ")}`);

  const STARTERS = [
    "A wedding caterer in south London for 80 guests",
    "A mobile bar for a 30th birthday",
    "A photographer for a summer party",
    "A DJ for a Saturday night wedding",
  ];

  // in_scope=false means the brief wasn't a coherent request to hire anyone
  // (empty or gibberish) — NOT that the service is the "wrong" kind. Patch is
  // vertical-agnostic, so we never turn a request away for being off-category;
  // we just ask for a clearer brief.
  if (outOfScope) {
    return (
      <div className={styles.wrap}>
        <h2 className={styles.title}>Tell us what you&apos;re looking for</h2>
        <p className={styles.lead}>
          We couldn&apos;t make sense of &ldquo;{query}&rdquo;. Describe the job in plain words —
          what you need, the area, and roughly when. For example:
        </p>
        <div className={styles.block}>
          <div className={styles.chips}>
            {STARTERS.map((s) => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className={styles.chip}>
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Nothing matched that brief</h2>
      <p className={styles.lead}>
        We couldn&apos;t find a vendor for &ldquo;{query}&rdquo; — even after widening it. It&apos;s
        usually one constraint doing the damage.
      </p>

      {escapes.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Try without</h3>
          <div className={styles.chips}>
            {escapes.map((e) => (
              <Link key={e.href} href={e.href} className={styles.chip}>
                {e.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {implied.length > 0 && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>Or loosen the brief</h3>
          <ul className={styles.list}>
            {implied.map((s) => (
              <li key={s}>Consider {s}.</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Start somewhere broader</h3>
        <div className={styles.chips}>
          {STARTERS.map((s) => (
            <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className={styles.chip}>
              {s}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
