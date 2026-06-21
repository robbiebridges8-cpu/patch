"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./HeroSearch.module.css";

const EXAMPLES = [
  "ceilidh band for a barn wedding near Bath, August, 80 guests",
  "taco cart for an office summer party, 30 people, Shoreditch",
  "grazing table for a christening, ~25, north London",
];

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleExample(ex: string) {
    setQuery(ex);
    router.push(`/search?q=${encodeURIComponent(ex)}`);
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.bar} ${focused ? styles.focused : ""}`}
      >
        <svg className={styles.icon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="pizza van for a 40th in Hackney, July, ~50 in the garden, ~£600"
        />
        <button type="submit" className={styles.btn}>Find vendors</button>
      </form>

      <div className={styles.examples}>
        <span className={styles.exLabel}>Try</span>
        <div className={styles.exList}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className={styles.exLink} onClick={() => handleExample(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
