"use client";

import { useState } from "react";
import { TIER, TIER_PRICE, TIER_NAMES, annualPrice, UPGRADE_REASONS, type Tier } from "@/lib/tiers";
import styles from "../vendor.module.css";

/**
 * The upgrade path. Shown compact next to a locked lead (where the vendor has
 * a specific job in front of them) and in full on the billing card.
 */
export default function UpgradePrompt({ compact = false }: { compact?: boolean }) {
  const [tier, setTier] = useState<Tier>(TIER.STANDARD);
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval: annual ? "year" : "month" }),
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
          {loading ? "Opening…" : `Unlock — £${TIER_PRICE[TIER.STANDARD]}/mo`}
        </button>
        <span className={styles.upgradeHint}>Cancel any time</span>
        {error && <p className={styles.threadError}>{error}</p>}
      </div>
    );
  }

  const price = annual ? annualPrice(tier) : TIER_PRICE[tier];

  return (
    <div>
      <div className={styles.planRow}>
        {([TIER.STANDARD, TIER.PRO] as Tier[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.planBtn} ${tier === t ? styles.planBtnActive : ""}`}
            aria-pressed={tier === t}
            onClick={() => setTier(t)}
          >
            <span className={styles.planName}>{TIER_NAMES[t]}</span>
            <span className={styles.planPrice}>£{TIER_PRICE[t]}<small>/mo</small></span>
          </button>
        ))}
      </div>

      <label className={styles.annualToggle}>
        <input type="checkbox" checked={annual} onChange={(e) => setAnnual(e.target.checked)} />
        <span>
          Pay annually — <strong>2 months free</strong> (£{annualPrice(tier)}/year)
        </span>
      </label>

      <ul className={styles.planFeatures}>
        {UPGRADE_REASONS.filter((r) => r.feature !== "featured_placement" || tier === TIER.PRO).map((r) => (
          <li key={r.feature}>{r.label}</li>
        ))}
      </ul>

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}
      <button type="button" className={styles.btn} disabled={loading} onClick={checkout}>
        {loading ? "Starting…" : `Upgrade — £${price}${annual ? "/year" : "/month"}`}
      </button>
    </div>
  );
}
