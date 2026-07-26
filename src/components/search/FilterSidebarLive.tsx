"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./FilterSidebar.module.css";

// Only universal constraints are hard filters (PRD §3.3). Budget is one; price
// applies to every vertical. Vertical-specific needs (dietary, certifications,
// setting…) are matched semantically from the plain-language search, not with
// hardcoded filters — a "Vegan / Halal" panel makes no sense on a plumber search.
export default function FilterSidebarLive({
  currentBudget,
}: {
  currentBudget?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push(`/search?${params.toString()}`);
  }

  function handleBudget(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    navigate({ budget: val >= 2000 ? undefined : String(val) });
  }

  const budgetVal = currentBudget || 2000;
  const budgetPct = Math.round(((budgetVal - 100) / (2000 - 100)) * 100);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <h2 className={styles.sidebarTitle}>Refine</h2>
      </div>

      {/* Budget — a universal constraint. Everything else lives in the brief. */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Budget</span>
        <div className={styles.budgetRow}>
          <span className={styles.budgetLabel}>Up to</span>
          <span className={styles.budgetValue}>
            {currentBudget && currentBudget < 2000 ? `£${currentBudget}` : "Any"}
          </span>
        </div>
        <div className={styles.sliderTrack}>
          <div className={styles.sliderFill} style={{ width: `${budgetPct}%` }} />
          <div className={styles.sliderThumb} style={{ left: `${budgetPct}%` }} />
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            defaultValue={budgetVal}
            className={styles.sliderInput}
            onChange={handleBudget}
            aria-label="Maximum budget"
          />
        </div>
      </div>
    </aside>
  );
}
