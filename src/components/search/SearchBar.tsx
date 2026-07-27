"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./SearchBar.module.css";

export default function SearchBar({ query }: { query: string }) {
  const [value, setValue] = useState(query);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  // Clear the pending state once the new results (new query prop) have arrived.
  useEffect(() => {
    setValue(query);
    setPending(false);
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q || q === query) return;
    setPending(true);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="pizza van for a 40th in Hackney, July, ~50 in the garden, ~£600"
        aria-label="Describe what you need"
      />
      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? (
          <span className={styles.pending}>
            <span className={styles.spinner} aria-hidden="true" />
            Searching…
          </span>
        ) : (
          "Find someone"
        )}
      </button>
    </form>
  );
}
