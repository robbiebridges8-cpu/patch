"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./FilterSidebar.module.css";

const SERVICE_LABELS: Record<string, string> = {
  "pizza vans / wood-fired pizza trailers": "Pizza vans",
  "burger trucks and trailers": "Burger trucks",
  "taco trucks and Mexican": "Tacos & Mexican",
  "BBQ and smoker catering": "BBQ & smoker",
  "grazing tables and charcuterie": "Grazing & charcuterie",
  "ice cream vans and gelato carts": "Ice cream & gelato",
  "dessert vans (donuts, churros, crepes, waffles)": "Dessert vans",
  "coffee carts and mobile baristas": "Coffee carts",
  "drop-off canapés and finger food": "Canapés & finger food",
  "bao, dumplings, and Asian street food": "Asian street food",
  "Indian street food (chaat, dosa, curries)": "Indian street food",
  "Middle Eastern (falafel, mezze, shawarma)": "Middle Eastern",
  "pie and mash / British comfort": "British comfort",
  "vegan and plant-based specialists": "Vegan & plant-based",
  "cocktail bars and mobile bartenders": "Cocktail bars",
};

export default function FilterSidebarLive({
  typeCounts,
  activeTypes,
  currentBudget,
  currentSetting,
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

  function handleSetting(val: string) {
    navigate({ setting: val === "any" ? undefined : val });
  }

  // Sort types by count descending, only show those with vendors
  const sortedTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 0);

  return (
    <div className={styles.card}>
      <div className={styles.title}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M6 12h12M10 18h4"/>
        </svg>
        Refine results
      </div>

      <div className={styles.filter}>
        <div className={styles.filterLabel}>
          Budget
          <span className={styles.filterValue}>
            {currentBudget && currentBudget < 800 ? `Up to £${currentBudget}` : "Any"}
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="800"
          step="50"
          defaultValue={currentBudget || 800}
          className={styles.range}
          onChange={handleBudget}
        />
      </div>

      <div className={styles.filter}>
        <div className={styles.filterLabel}>Service type</div>
        {sortedTypes.map(([type, count]) => (
          <label
            key={type}
            className={`${styles.checkbox} ${activeTypes.includes(type) ? styles.checked : ""}`}
          >
            <input
              type="checkbox"
              checked={activeTypes.includes(type)}
              onChange={() => toggleType(type)}
            />
            {SERVICE_LABELS[type] || type}
            <span className={styles.sideCount}>{count}</span>
          </label>
        ))}
      </div>

      <div className={styles.filter}>
        <div className={styles.filterLabel}>Setting</div>
        {["any", "indoor", "outdoor"].map((val) => (
          <label
            key={val}
            className={`${styles.checkbox} ${(currentSetting || "any") === val ? styles.checked : ""}`}
          >
            <input
              type="radio"
              name="setting"
              checked={(currentSetting || "any") === val}
              onChange={() => handleSetting(val)}
            />
            {val === "any" ? "Any" : val.charAt(0).toUpperCase() + val.slice(1)}
          </label>
        ))}
      </div>

      {(activeTypes.length > 0 || currentBudget || currentSetting) && (
        <button
          className={styles.clearBtn}
          onClick={() => navigate({ type: undefined, budget: undefined, setting: undefined })}
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
