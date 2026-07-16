"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./FilterSidebar.module.css";

const DIETARY = ["vegan", "vegetarian", "gluten-free", "halal", "dairy-free", "nut-free"];

export default function FilterSidebarLive({
  activeDietary,
  currentBudget,
}: {
  activeDietary: string[];
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

  function toggleDiet(diet: string) {
    const current = new Set(activeDietary);
    if (current.has(diet)) current.delete(diet);
    else current.add(diet);
    navigate({ diet: Array.from(current).join(",") || undefined });
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
        <h3 className={styles.sidebarTitle}>Refine</h3>
      </div>

      {/* Dietary — a real constraint within any cuisine */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Dietary needs</span>
        <div className={styles.chipGrid}>
          {DIETARY.map((diet) => {
            const isSelected = activeDietary.includes(diet);
            const label = diet.charAt(0).toUpperCase() + diet.slice(1);
            return (
              <button
                key={diet}
                type="button"
                className={`${styles.filterChip} ${isSelected ? styles.filterChipSelected : ""}`}
                onClick={() => toggleDiet(diet)}
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
          />
        </div>
      </div>
    </aside>
  );
}
