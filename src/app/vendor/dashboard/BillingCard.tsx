"use client";

import { useState } from "react";
import UpgradePrompt from "./UpgradePrompt";
import { TIER, TIER_NAMES, type Tier } from "@/lib/tiers";
import styles from "../vendor.module.css";

const HUMAN_STATUS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed",
  unpaid: "Payment failed",
  canceled: "Cancelled",
  incomplete: "Incomplete",
};

export default function BillingCard({ status, hasCustomer, tier }: { status: string | null; hasCustomer: boolean; tier: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = status === "active" || status === "trialing";
  const pastDue = status === "past_due" || status === "unpaid";

  async function go(endpoint: "checkout" | "portal") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      if (data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setError("Couldn't reach billing. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Subscription</span>
        {status && (
          <span className={`${styles.badge} ${active ? styles.badgeOk : pastDue ? styles.badgeWarn : ""}`}>
            {HUMAN_STATUS[status] ?? status}
          </span>
        )}
      </div>

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

      {active ? (
        <>
          <p className={styles.sub}>
            You&apos;re on {TIER_NAMES[tier as Tier]} — no commission, no per-lead fees. Manage your
            plan, card or invoices below.
          </p>
          <button className={styles.btnGhost} disabled={loading} onClick={() => go("portal")}>
            {loading ? "Opening…" : "Manage billing"}
          </button>
        </>
      ) : pastDue ? (
        <>
          <div className={`${styles.notice} ${styles.noticeErr}`}>
            <strong>Your last payment failed.</strong> Your paid features are paused — update your
            card to restore them.
          </div>
          <button className={styles.btn} disabled={loading} onClick={() => go("portal")}>
            {loading ? "Opening…" : "Update payment"}
          </button>
        </>
      ) : (
        <>
          <p className={styles.sub}>
            {hasCustomer
              ? "Your subscription has ended and your listing is back on the free tier. Resubscribe any time to read your enquiries again."
              : "Your listing is free and stays free. Upgrade to read your enquiries, rank alongside paid listings, and drop the competitors from your profile."}
          </p>
          <UpgradePrompt />
        </>
      )}
    </div>
  );
}
