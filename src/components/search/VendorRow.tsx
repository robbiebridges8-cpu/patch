"use client";

import { useState } from "react";
import type { VendorMatch } from "@/types/vendor";
import styles from "./VendorRow.module.css";

export default function VendorRow({ match }: { match: VendorMatch }) {
  const v = match.vendor;
  const [hover, setHover] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <article
      className={styles.row}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        boxShadow: hover ? "var(--shadow-hover)" : "none",
        transform: hover ? "translate(-2px, -2px)" : "none",
      }}
    >
      <a href={`/vendors/${v.slug}`} className={styles.mediaBox}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.photo}
          src={match.photoUrl}
          alt={v.name}
          style={{ transform: hover ? "scale(1.02)" : "scale(1)" }}
        />
      </a>

      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.eyebrow}>{match.category}</span>
          {match.priceLabel && (
            <span className={styles.priceSignal}>{match.priceLabel}</span>
          )}
        </div>

        <h3 className={styles.title}>
          <a href={`/vendors/${v.slug}`}>{v.name}</a>
        </h3>

        {match.matchReason && (
          <p className={styles.oneLiner}>{match.matchReason.replace(/<[^>]*>/g, "")}</p>
        )}

        {match.matchedTags.length > 0 && (
          <div className={styles.attributes}>
            {match.matchedTags.slice(0, 3).map((t) => (
              <span key={t.label} className={styles.attrChip}>{t.label}</span>
            ))}
          </div>
        )}

        <div className={styles.bottomRow}>
          <span className={styles.location}>
            {match.distance}
            {v.ratingAvg && v.ratingAvg > 0 ? ` · ${v.ratingAvg.toFixed(1)}★` : ""}
            {match.bookingCount > 0 ? ` · ${match.bookingCount} reviews` : ""}
          </span>
          <button
            type="button"
            className={styles.saveBtn}
            aria-label={saved ? "Saved" : "Save"}
            aria-pressed={saved}
            onClick={() => setSaved(!saved)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
