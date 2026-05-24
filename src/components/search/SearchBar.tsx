"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SearchBar.module.css";

export default function SearchBar({ query }: { query: string }) {
  const [value, setValue] = useState(query);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  }

  return (
    <section className={styles.searchRow}>
      <div className={styles.inner}>
        <div className={styles.label}>Tell us what you&apos;re after</div>
        <form onSubmit={handleSubmit} className={styles.bar}>
          <input
            type="text"
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className={styles.btn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            Search again
          </button>
        </form>
      </div>
    </section>
  );
}
