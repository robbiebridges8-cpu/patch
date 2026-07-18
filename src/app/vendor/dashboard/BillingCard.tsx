"use client";

import { useState } from "react";
import UpgradePrompt from "./UpgradePrompt";
import { TIER, TIER_NAMES, type Tier } from "@/lib/tiers";
import styles from "../vendor.module.css";

export default function BillingCard({ status, hasCustomer, tier }: { status: string | null; hasCustomer: boolean; tier: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = status === "active" || status === "trialing";

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
        {status && <span className={styles.badge}>{status}</span>}
      </div>
      <p className={styles.sub}>
        {tier > TIER.FREE
          ? `You're on ${TIER_NAMES[tier as Tier]} — no commission, no per-lead fees.`
          : "Your listing is free and stays free. Upgrade to read your enquiries, rank alongside paid listings, and drop the competitors from your profile."}
      </p>
      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}
      {active || hasCustomer ? (
        <button className={styles.btnGhost} disabled={loading} onClick={() => go("portal")}>
          {loading ? "Opening…" : "Manage billing"}
        </button>
      ) : (
        <UpgradePrompt />
      )}
    </div>
  );
}
