"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./HeroSearch.module.css";

const HINTS = [
  "Pizza van for a garden wedding, 100 guests",
  "Vegan-friendly street food for a corporate party",
  "BBQ for a 40th birthday, budget £1500",
  "Something fun for 50 people in Hackney",
];

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleHint(hint: string) {
    setQuery(hint);
    router.push(`/search?q=${encodeURIComponent(hint)}`);
  }

  return (
    <div className={styles.wrap}>
      <form onSubmit={handleSubmit} className={styles.bar}>
        <span className={styles.icon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
        </span>
        <input
          type="text"
          className={styles.input}
          placeholder="e.g. Wood-fired pizza for a garden wedding in Hackney, 120 guests, under £2k"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className={styles.btn}>Search</button>
      </form>
      <div className={styles.hints}>
        {HINTS.map((h) => (
          <button key={h} className={styles.hint} onClick={() => handleHint(h)}>
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}
