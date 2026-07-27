"use client";

import { useState, useEffect } from "react";
import styles from "./SearchingIndicator.module.css";

const MESSAGES = [
  "Reading your brief…",
  "Searching the vendors…",
  "Ranking by fit…",
  "Writing your shortlist…",
];

export default function SearchingIndicator() {
  const [i, setI] = useState(0);

  // Advance through the steps and hold on the last one. Looping back to
  // "Reading your brief…" reads as the search restarting — testers called the
  // old cycling behaviour a "broken loop". Forward-only never regresses.
  useEffect(() => {
    const t = setInterval(
      () => setI((v) => Math.min(v + 1, MESSAGES.length - 1)),
      1600,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.orbit} aria-hidden="true">
        <span className={styles.core} />
      </span>
      <span className={styles.msg} key={i}>{MESSAGES[i]}</span>
    </div>
  );
}
