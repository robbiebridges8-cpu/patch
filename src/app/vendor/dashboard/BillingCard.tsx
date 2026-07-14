"use client";

import { useState } from "react";
import styles from "../vendor.module.css";

export default function BillingCard({ status, hasCustomer }: { status: string | null; hasCustomer: boolean }) {
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
        {active
          ? "Your listing is live on Patch — £20/month. No commission, no per-lead fees."
          : "List on Patch for £20/month, flat. No commission, no per-lead fees, cancel anytime."}
      </p>
      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}
      {active || hasCustomer ? (
        <button className={styles.btnGhost} disabled={loading} onClick={() => go("portal")}>
          {loading ? "Opening…" : "Manage billing"}
        </button>
      ) : (
        <button className={styles.btn} disabled={loading} onClick={() => go("checkout")}>
          {loading ? "Starting…" : "Subscribe — £20/month"}
        </button>
      )}
    </div>
  );
}
