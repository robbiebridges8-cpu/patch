"use client";

import { Children, useState, useRef, useEffect } from "react";
import styles from "./ProgressiveList.module.css";

/**
 * Reveals server-rendered rows a page at a time. The whole result set is
 * already fetched and rendered, so "show more" is instant — no refetch, and no
 * second trip through the (paid) parse/embed pipeline.
 */
export default function ProgressiveList({
  children,
  initial = 15,
  step = 15,
  className,
}: {
  children: React.ReactNode;
  initial?: number;
  step?: number;
  className?: string;
}) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(initial);
  const listRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(shown);

  const remaining = items.length - shown;
  const next = Math.min(step, remaining);

  // Move focus to the first newly revealed row so keyboard and screen-reader
  // users land on the new content instead of the top of the page.
  useEffect(() => {
    if (shown === lastCount.current) return;
    const rows = listRef.current?.children;
    const first = rows?.[lastCount.current] as HTMLElement | undefined;
    lastCount.current = shown;
    if (first) {
      first.setAttribute("tabindex", "-1");
      first.focus({ preventScroll: true });
    }
  }, [shown]);

  return (
    <>
      <div className={className} ref={listRef}>
        {items.slice(0, shown)}
      </div>

      {remaining > 0 && (
        <div className={styles.moreWrap}>
          <button
            type="button"
            className={styles.moreBtn}
            onClick={() => setShown((s) => s + step)}
          >
            Show {next} more
          </button>
          <span className={styles.moreCount} aria-live="polite">
            Showing {shown} of {items.length}
          </span>
        </div>
      )}
    </>
  );
}
