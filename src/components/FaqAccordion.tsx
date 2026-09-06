"use client";

import { useState } from "react";
import styles from "./FaqAccordion.module.css";

// Accessible animated accordion. All answers stay in the DOM (collapsed via a
// grid-rows transition), so the visible copy is crawlable and the FAQPage schema
// rendered server-side stays the source of truth for answer engines.
export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className={styles.list}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <div className={styles.item} key={it.q}>
            <button
              type="button"
              className={styles.q}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{it.q}</span>
              <svg className={styles.chevron} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            <div className={styles.answerWrap} data-open={isOpen}>
              <div className={styles.answerInner}>
                <p className={styles.answer}>{it.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
