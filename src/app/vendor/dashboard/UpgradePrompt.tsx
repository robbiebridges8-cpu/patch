"use client";

import { useState } from "react";
import { TIER, TIER_PRICE, annualPrice, UPGRADE_REASONS } from "@/lib/tiers";
import styles from "../vendor.module.css";

/**
 * The upgrade path. Shown compact next to a locked lead (where the vendor has
 * a specific job in front of them) and in full on the billing card.
 */
export default function UpgradePrompt({ compact = false }: { compact?: boolean }) {
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthly = TIER_PRICE[TIER.PAID];

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: annual ? "year" : "month" }),
      });
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

  if (compact) {
    return (
      <div className={styles.upgradeCompact}>
        <button type="button" className={styles.btn} disabled={loading} onClick={checkout}>
          {loading ? "Starting checkout…" : `Unlock — £${monthly}/mo`}
        </button>
        <span className={styles.upgradeHint}>Cancel any time — one booking usually covers the year</span>
        {error && <p className={styles.threadError}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.priceLine}>
        <span className={styles.priceBig}>£{annual ? annualPrice(TIER.PAID) : monthly}</span>
        <span className={styles.priceUnit}>{annual ? "per year" : "per month"}</span>
      </div>
      <p className={styles.priceAnchor}>One booking usually covers the whole year.</p>

      <label className={styles.annualToggle}>
        <input type="checkbox" checked={annual} onChange={(e) => setAnnual(e.target.checked)} />
        <span>
          Pay annually — <strong>2 months free</strong> (£{annualPrice(TIER.PAID)}/year)
        </span>
      </label>

      <ul className={styles.planFeatures}>
        {UPGRADE_REASONS.map((r) => (
          <li key={r.feature}>{r.label}</li>
        ))}
      </ul>

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}
      <button type="button" className={styles.btn} disabled={loading} onClick={checkout}>
        {loading ? "Starting checkout…" : `Upgrade — £${annual ? annualPrice(TIER.PAID) : monthly}${annual ? "/year" : "/month"}`}
      </button>
      <p className={styles.upgradeHint} style={{ marginTop: 10 }}>Cancel any time · secure checkout by Stripe</p>
    </div>
  );
}
