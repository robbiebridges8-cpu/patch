"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./FollowupsCard.module.css";

const followups = [
  "only the ones with their own gazebo",
  "swap to tacos instead",
  "keep it under £500",
  "must do gluten-free properly",
];

export default function FollowupsCard() {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") || "";

  function refine(text: string) {
    const t = text.trim();
    if (!t) return;
    // Fold the refinement into the current brief so the AI re-parses the whole intent.
    const combined = currentQuery ? `${currentQuery}, ${t}` : t;
    setPending(true);
    router.push(`/search?q=${encodeURIComponent(combined)}`);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-on-dark)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        <span className={styles.label}>Ask Patch</span>
      </div>

      <p className={styles.note}>
        Want me to tighten this? Add a detail and I&apos;ll rework the shortlist around it.
      </p>

      <div className={styles.followups}>
        {followups.map((f) => (
          <button key={f} type="button" className={styles.followup} onClick={() => refine(f)} disabled={pending}>
            {f}
          </button>
        ))}
      </div>

      <form
        className={styles.inputRow}
        onSubmit={(e) => {
          e.preventDefault();
          refine(value);
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Refine, swap, or ask anything…"
          className={styles.input}
          disabled={pending}
        />
        <button type="submit" className={styles.sendBtn} aria-label="Refine search" disabled={pending || !value.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </section>
  );
}
