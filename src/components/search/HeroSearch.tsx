"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./HeroSearch.module.css";

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim() && !pending) {
      setPending(true); // the search route is a server round-trip — show progress, block double-taps
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
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
          placeholder="what do you need, where, and roughly when?"
          aria-label="Describe your event — what you need, where, and roughly when"
        />
        <button type="submit" className={styles.btn} disabled={pending}>{pending ? "Searching…" : "Find someone"}</button>
      </form>

    </div>
  );
}
