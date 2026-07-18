"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setVendorStatus, setVendorFeatured } from "./actions";
import styles from "./admin.module.css";

export interface AdminVendor {
  id: string;
  name: string;
  slug: string;
  status: string;
  featured: boolean;
  primary_category: string | null;
  owner_id: string | null;
  rating_avg: number | null;
  review_count: number;
  created_at: string;
}

const STATUS_ACTIONS: { value: string; label: string }[] = [
  { value: "live", label: "Approve" },
  { value: "rejected", label: "Reject" },
  { value: "paused", label: "Pause" },
];

export default function VendorAdminRow({ vendor }: { vendor: AdminVendor }) {
  const [status, setStatus] = useState(vendor.status);
  const [featured, setFeatured] = useState(vendor.featured);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeStatus(next: string) {
    const prev = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await setVendorStatus(vendor.id, next);
      if (res?.error) {
        setStatus(prev);
        setError(res.error);
      }
    });
  }

  function toggleFeatured() {
    const next = !featured;
    setFeatured(next);
    setError(null);
    startTransition(async () => {
      const res = await setVendorFeatured(vendor.id, next);
      if (res?.error) {
        setFeatured(!next);
        setError(res.error);
      }
    });
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>
          <Link href={`/vendors/${vendor.slug}`} className={styles.rowLink}>
            {vendor.name}
          </Link>
          <span className={`${styles.pill} ${styles["s_" + status] || ""}`}>{status}</span>
          {featured && <span className={`${styles.pill} ${styles.s_featured}`}>featured</span>}
        </div>
        <div className={styles.rowMeta}>
          {[
            vendor.primary_category || "Uncategorised",
            vendor.owner_id ? "claimed" : "unclaimed",
            vendor.rating_avg ? `${vendor.rating_avg}★ (${vendor.review_count})` : "no reviews",
            `Added ${new Date(vendor.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
          ].join(" · ")}
        </div>
        {error && <p className={styles.rowError}>{error}</p>}
      </div>

      <div className={styles.rowActions}>
        {STATUS_ACTIONS.map((a) => (
          <button
            key={a.value}
            type="button"
            className={`${styles.actionBtn} ${status === a.value ? styles.actionBtnActive : ""}`}
            disabled={pending || status === a.value}
            onClick={() => changeStatus(a.value)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.actionBtn} ${featured ? styles.actionBtnActive : ""}`}
          disabled={pending}
          aria-pressed={featured}
          onClick={toggleFeatured}
        >
          {featured ? "Unfeature" : "Feature"}
        </button>
      </div>
    </div>
  );
}
