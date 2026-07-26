"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShortlist } from "@/lib/useShortlist";
import styles from "./ShortlistTray.module.css";

export default function ShortlistTray() {
  const { items, remove, clear } = useShortlist();
  const pathname = usePathname();
  // Suppressed on a vendor's own page — there it would overlap the sticky
  // "Send an enquiry" bar (both pinned to the bottom on mobile).
  if (items.length === 0 || pathname?.startsWith("/vendors/")) return null;

  return (
    <div className={styles.wrap} role="region" aria-label="Your shortlist">
      <div className={styles.inner}>
        <div className={styles.left}>
          <span className={styles.count}>{items.length}</span>
          <span className={styles.label}>
            saved
          </span>
          <div className={styles.thumbs}>
            {items.slice(0, 6).map((i) => (
              <span key={i.slug} className={styles.thumb} title={i.name}>
                <Image src={i.photoUrl} alt="" fill sizes="40px" />
                <button
                  type="button"
                  className={styles.remove} data-touch-target
                  aria-label={`Remove ${i.name}`}
                  onClick={() => remove(i.slug)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.right}>
          <button type="button" className={styles.clear} onClick={clear}>Clear</button>
          <Link href="/shortlist" className={styles.cta}>
            Compare &amp; enquire
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
