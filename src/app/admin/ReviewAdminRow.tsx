"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setReviewHidden, setReviewVerified } from "./actions";
import styles from "./admin.module.css";

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  hidden: boolean;
  verified: boolean;
  created_at: string;
  vendor_name: string;
  vendor_slug: string;
}

export default function ReviewAdminRow({ review }: { review: AdminReview }) {
  const [hidden, setHidden] = useState(review.hidden);
  const [verified, setVerified] = useState(review.verified);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(kind: "hidden" | "verified") {
    setError(null);
    if (kind === "hidden") {
      const next = !hidden;
      setHidden(next);
      startTransition(async () => {
        const res = await setReviewHidden(review.id, next);
        if (res?.error) {
          setHidden(!next);
          setError(res.error);
        }
      });
    } else {
      const next = !verified;
      setVerified(next);
      startTransition(async () => {
        const res = await setReviewVerified(review.id, next);
        if (res?.error) {
          setVerified(!next);
          setError(res.error);
        }
      });
    }
  }

  return (
    <div className={`${styles.row} ${hidden ? styles.rowMuted : ""}`}>
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>
          <span className={styles.stars} aria-label={`${review.rating} out of 5`}>
            {"★".repeat(review.rating)}
            <span className={styles.starsOff}>{"★".repeat(5 - review.rating)}</span>
          </span>
          <Link href={`/vendors/${review.vendor_slug}`} className={styles.rowLink}>
            {review.vendor_name}
          </Link>
          {verified && <span className={`${styles.pill} ${styles.s_live}`}>verified</span>}
          {hidden && <span className={`${styles.pill} ${styles.s_rejected}`}>hidden</span>}
        </div>
        {review.title && <div className={styles.reviewTitle}>{review.title}</div>}
        {review.body && <p className={styles.reviewBody}>{review.body}</p>}
        <div className={styles.rowMeta}>
          {new Date(review.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
        {error && <p className={styles.rowError}>{error}</p>}
      </div>

      <div className={styles.rowActions}>
        <button
          type="button"
          className={`${styles.actionBtn} ${verified ? styles.actionBtnActive : ""}`}
          disabled={pending}
          aria-pressed={verified}
          onClick={() => toggle("verified")}
        >
          {verified ? "Unverify" : "Verify"}
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${hidden ? styles.actionBtnActive : ""}`}
          disabled={pending}
          aria-pressed={hidden}
          onClick={() => toggle("hidden")}
        >
          {hidden ? "Unhide" : "Hide"}
        </button>
      </div>
    </div>
  );
}
