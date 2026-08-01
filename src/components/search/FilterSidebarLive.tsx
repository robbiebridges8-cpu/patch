"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./FilterSidebar.module.css";

// Only universal constraints are hard filters (PRD §3.3): budget and location
// apply to every vertical. Vertical-specific needs (dietary, certifications,
// setting…) are matched semantically from the plain-language search, not with
// hardcoded filters — a "Vegan / Halal" panel makes no sense on a plumber search.

// "Up to" budget presets. One tap = one search, so dragging a slider no longer
// fires a fresh 6–9s query on every step. Ceiling sits above real catering spend.
const BUDGET_PRESETS: { label: string; value?: number }[] = [
  { label: "Any" },
  { label: "£500", value: 500 },
  { label: "£1k", value: 1000 },
  { label: "£2.5k", value: 2500 },
  { label: "£5k", value: 5000 },
];

// Popular London areas for one-tap location. The free-text field covers the rest.
const QUICK_AREAS = ["Shoreditch", "Hackney", "Islington", "Clapham", "Peckham", "Greenwich"];

export default function FilterSidebarLive({
  currentBudget,
  currentLocation,
}: {
  currentBudget?: number;
  currentLocation?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loc, setLoc] = useState(currentLocation ?? "");

  function navigate(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, v);
    }
    router.push(`/search?${params.toString()}`);
  }

  const activeBudget = currentBudget && currentBudget < 5000 ? currentBudget : undefined;

  function applyLocation(value: string) {
    const v = value.trim();
    setLoc(v);
    navigate({ loc: v || undefined });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <h2 className={styles.sidebarTitle}>Refine</h2>
      </div>

      {/* Location — a universal constraint; the RPC filters by PostGIS radius. */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Location</span>
        <form
          className={styles.locRow}
          onSubmit={(e) => {
            e.preventDefault();
            applyLocation(loc);
          }}
        >
          <svg className={styles.locIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <input
            type="text"
            className={styles.locInput}
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="Area or postcode"
            aria-label="Filter by area or postcode"
            autoComplete="off"
          />
          {loc && (
            <button
              type="button"
              className={styles.locClear}
              onClick={() => applyLocation("")}
              aria-label="Clear location"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </form>
        <div className={styles.chipGrid}>
          {QUICK_AREAS.map((area) => {
            const selected = loc.toLowerCase() === area.toLowerCase();
            return (
              <button
                key={area}
                type="button"
                className={`${styles.filterChip} ${selected ? styles.filterChipSelected : ""}`}
                aria-pressed={selected}
                onClick={() => applyLocation(selected ? "" : area)}
              >
                {area}
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget — a universal constraint. Everything else lives in the brief. */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Budget</span>
        <div className={styles.chipGrid}>
          {BUDGET_PRESETS.map((preset) => {
            const selected = preset.value === activeBudget;
            return (
              <button
                key={preset.label}
                type="button"
                className={`${styles.filterChip} ${selected ? styles.filterChipSelected : ""}`}
                aria-pressed={selected}
                onClick={() => navigate({ budget: preset.value ? String(preset.value) : undefined })}
              >
                {preset.value ? `Up to ${preset.label}` : preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
