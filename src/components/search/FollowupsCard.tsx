"use client";

import { useState } from "react";
import styles from "./FollowupsCard.module.css";

const followups = [
  "Only the ones with their own gazebo?",
  "Swap pizza for tacos?",
  "Anything under £500?",
  "Who can do gluten-free properly?",
];

export default function FollowupsCard() {
  const [value, setValue] = useState("");

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-on-dark)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        <span className={styles.label}>Ask Patch</span>
      </div>

      <p className={styles.note}>
        Want me to tighten this? I can filter to vans with their own gazebo, or swap the cuisine entirely.
      </p>

      <div className={styles.followups}>
        {followups.map((f) => (
          <button key={f} type="button" className={styles.followup}>
            {f}
          </button>
        ))}
      </div>

      <div className={styles.inputRow}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Refine, swap, or ask anything…"
          className={styles.input}
        />
        <button type="button" className={styles.sendBtn} aria-label="Ask">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
