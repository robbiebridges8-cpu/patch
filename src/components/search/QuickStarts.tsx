"use client";

import { useRouter } from "next/navigation";
import styles from "./QuickStarts.module.css";

const OCCASIONS = [
  { label: "Birthday", emoji: "🎂", q: "food for a birthday party" },
  { label: "Wedding", emoji: "💍", q: "catering for a wedding" },
  { label: "Office event", emoji: "💼", q: "catering for an office event" },
  { label: "Kids' party", emoji: "🎈", q: "food for a kids' party" },
  { label: "Summer BBQ", emoji: "🔥", q: "bbq for a summer garden party" },
  { label: "Drinks reception", emoji: "🍸", q: "canapés and a bar for a drinks reception" },
];

const CUISINES = [
  "Pizza", "Burgers", "Tacos & Mexican", "BBQ", "Indian", "Thai",
  "Grazing & cheese", "Middle Eastern", "Desserts", "Cocktail bar",
];

export default function QuickStarts() {
  const router = useRouter();
  const go = (q: string, type?: string) =>
    router.push(`/search?q=${encodeURIComponent(q)}${type ? `&type=${encodeURIComponent(type)}` : ""}`);

  return (
    <div className={styles.wrap}>
      <div className={styles.block}>
        <span className={styles.label}>Popular occasions</span>
        <div className={styles.occasions}>
          {OCCASIONS.map((o) => (
            <button key={o.label} type="button" className={styles.tile} onClick={() => go(o.q)}>
              <span className={styles.emoji} aria-hidden="true">{o.emoji}</span>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <span className={styles.label}>Or browse by category</span>
        <div className={styles.cuisines}>
          {CUISINES.map((c) => (
            <button key={c} type="button" className={styles.chip} onClick={() => go(c, c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
