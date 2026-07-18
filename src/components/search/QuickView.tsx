"use client";

import { useEffect } from "react";
import type { VendorMatch } from "@/types/vendor";
import { useShortlist } from "@/lib/useShortlist";
import EnquiryButton from "@/components/vendor/EnquiryForm";
import styles from "./QuickView.module.css";

export default function QuickView({ match, onClose }: { match: VendorMatch; onClose: () => void }) {
  const v = match.vendor;
  const { has, toggle } = useShortlist();
  const saved = has(v.slug);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={v.name}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.photo} src={match.photoUrl} alt={v.name} />

        <div className={styles.body}>
          <span className={styles.category}>{match.category}</span>
          <h2 className={styles.name}>{v.name}</h2>
          <div className={styles.metaRow}>
            {match.distance && <span>{match.distance}</span>}
            {v.ratingAvg && v.ratingAvg > 0 ? <span>· {v.ratingAvg.toFixed(1)}★ ({match.bookingCount})</span> : null}
            {match.priceLabel && <span className={styles.price}>· {match.priceLabel}</span>}
          </div>

          {(v.description || match.matchReason) && (
            <p className={styles.desc}>{v.description || match.matchReason}</p>
          )}

          {match.matchedTags.length > 0 && (
            <div className={styles.chips}>
              {match.matchedTags.slice(0, 5).map((t) => (
                <span key={t.label} className={`${styles.chip} ${t.good ? styles.chipMet : ""}`}>{t.label}</span>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <EnquiryButton vendorId={v.id} vendorName={v.name} className={styles.enquire} />
            <button
              type="button"
              className={`${styles.save} ${saved ? styles.savedBtn : ""}`}
              onClick={() => toggle({ id: v.id, slug: v.slug, name: v.name, category: match.category, photoUrl: match.photoUrl, priceLabel: match.priceLabel })}
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
          <a href={`/vendors/${v.slug}`} className={styles.full}>View full profile →</a>
        </div>
      </div>
    </div>
  );
}
