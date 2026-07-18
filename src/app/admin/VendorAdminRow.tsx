"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { setVendorStatus, setVendorTier } from "./actions";
import { TIER, TIER_NAMES, SELLABLE_TIERS, type Tier } from "@/lib/tiers";
import styles from "./admin.module.css";

export interface AdminVendor {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier: number;
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
  const [tier, setTier] = useState<number>(vendor.tier ?? TIER.FREE);
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

  function changeTier(next: number) {
    const prev = tier;
    setTier(next);
    setError(null);
    startTransition(async () => {
      const res = await setVendorTier(vendor.id, next);
      if (res?.error) {
        setTier(prev);
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
          {tier > TIER.FREE && <span className={`${styles.pill} ${styles.s_featured}`}>{TIER_NAMES[tier as Tier].toLowerCase()}</span>}
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
        <label className={styles.srOnlyLabel} htmlFor={`tier-${vendor.id}`}>Tier</label>
        <select
          id={`tier-${vendor.id}`}
          className={styles.tierSelect}
          value={tier}
          disabled={pending}
          onChange={(e) => changeTier(Number(e.target.value))}
        >
          {([TIER.FREE, ...SELLABLE_TIERS] as Tier[]).map((t) => (
            <option key={t} value={t}>{TIER_NAMES[t]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
