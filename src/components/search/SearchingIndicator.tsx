"use client";

import { useState, useEffect } from "react";
import styles from "./SearchingIndicator.module.css";

const MESSAGES = [
  "Reading your brief…",
  "Searching 500 vendors…",
  "Ranking by fit…",
  "Writing your shortlist…",
];

export default function SearchingIndicator() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % MESSAGES.length), 1400);
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
