"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./FilterSidebar.module.css";

export default function FilterSidebarLive({
  typeCounts,
  activeTypes,
  currentBudget,
}: {
  typeCounts: Record<string, number>;
  activeTypes: string[];
  currentBudget?: number;
  currentSetting?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    router.push(`/search?${params.toString()}`);
  }

  function toggleType(type: string) {
    const current = new Set(activeTypes);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    const val = Array.from(current).join(",");
    navigate({ type: val || undefined });
  }

  function handleBudget(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    navigate({ budget: val >= 800 ? undefined : String(val) });
  }

  const budgetVal = currentBudget || 800;
  const budgetPct = Math.round(((budgetVal - 50) / (800 - 50)) * 100);

  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 0);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <h3 className={styles.sidebarTitle}>Filters</h3>
      </div>

      {/* Type chips */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Type</span>
        <div className={styles.chipGrid}>
          {sortedTypes.map(([type]) => {
            const label = type;
            const isSelected = activeTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                className={`${styles.filterChip} ${isSelected ? styles.filterChipSelected : ""}`}
                onClick={() => toggleType(type)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Budget</span>
        <div className={styles.budgetRow}>
          <span className={styles.budgetLabel}>Up to</span>
          <span className={styles.budgetValue}>
            {currentBudget && currentBudget < 800 ? `£${currentBudget}` : "Any"}
          </span>
        </div>
        <div className={styles.sliderTrack}>
          <div className={styles.sliderFill} style={{ width: `${budgetPct}%` }} />
          <div className={styles.sliderThumb} style={{ left: `${budgetPct}%` }} />
          <input
            type="range"
            min="50"
            max="800"
            step="50"
            defaultValue={budgetVal}
            className={styles.sliderInput}
            onChange={handleBudget}
          />
        </div>
      </div>

    </aside>
  );
}
