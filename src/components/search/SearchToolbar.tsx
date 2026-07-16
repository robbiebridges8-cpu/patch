"use client";

import { useState } from "react";
import FilterSidebarLive from "./FilterSidebarLive";
import SortDropdown from "./SortDropdown";
import styles from "./SearchToolbar.module.css";

interface Props {
  activeDietary: string[];
  currentBudget?: number;
  currentSort: string;
  activeCount: number;
}

export default function SearchToolbar(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.bar}>
      <button type="button" className={styles.filterBtn} onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filters{props.activeCount ? ` (${props.activeCount})` : ""}
      </button>

      <label className={styles.sortWrap}>
        <span className={styles.sortLabel}>Sort</span>
        <SortDropdown current={props.currentSort} />
      </label>

      {open && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className={styles.sheet} role="dialog" aria-label="Filters">
            <div className={styles.sheetHead}>
              <span className={styles.sheetTitle}>Filters</span>
              <button type="button" className={styles.done} onClick={() => setOpen(false)}>Done</button>
            </div>
            <FilterSidebarLive
              activeDietary={props.activeDietary}
              currentBudget={props.currentBudget}
            />
          </div>
        </div>
      )}
    </div>
  );
}
