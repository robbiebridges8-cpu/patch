import type { Completeness } from "@/lib/completeness";
import styles from "../vendor.module.css";

// Each to-do jumps to the card that fixes it, so "what's missing" leads somewhere
// instead of looking clickable and doing nothing.
function anchorFor(key: string): string {
  if (key === "photos") return "#photos";
  if (key === "availability") return "#availability";
  return "#listing";
}

function headline(c: Completeness): { title: string; sub: string } {
  if (c.percent === 100) {
    return {
      title: "Your listing is complete",
      sub: "Nothing left to fill in. Keep your photos and availability current and you're set.",
    };
  }
  if (c.blocking.length > 0) {
    return {
      title: "Finish the essentials",
      sub: `${c.blocking.length} thing${c.blocking.length > 1 ? "s" : ""} still missing that buyers rely on.`,
    };
  }
  return {
    title: "Nearly there",
    sub: "The essentials are done. These extras sharpen how well you match a brief.",
  };
}

export default function CompletenessCard({
  completeness,
  previewHref,
}: {
  completeness: Completeness;
  previewHref: string;
}) {
  const { percent, missing } = completeness;
  const { title, sub } = headline(completeness);

  // Enough to act on, not so many it reads as a chore.
  const shown = missing.slice(0, 5);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Listing strength</span>
        <a className={styles.previewLink} href={previewHref} target="_blank" rel="noopener noreferrer">
          Preview as a buyer →
        </a>
      </div>

      <div className={styles.meterRow}>
        <div className={styles.meterPct}>{percent}%</div>
        <div className={styles.meterBody}>
          <div
            className={styles.meterTrack}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Listing completeness"
          >
            <div
              className={`${styles.meterFill} ${percent === 100 ? styles.meterFull : ""}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className={styles.meterTitle}>{title}</div>
          <div className={styles.meterSub}>{sub}</div>
        </div>
      </div>

      {shown.length > 0 && (
        <ul className={styles.todoList}>
          {shown.map((item) => (
            <li key={item.key}>
              <a className={styles.todo} href={anchorFor(item.key)}>
                <span className={styles.todoBox} aria-hidden="true" />
                <div className={styles.todoText}>
                  <div className={styles.todoLabel}>
                    {item.label}
                    {item.essential && <span className={styles.todoEssential}>essential</span>}
                  </div>
                  <div className={styles.todoWhy}>{item.why}</div>
                </div>
                <span className={styles.todoGo} aria-hidden="true">→</span>
              </a>
            </li>
          ))}
          {missing.length > shown.length && (
            <li className={styles.todoMore}>
              +{missing.length - shown.length} more optional{" "}
              {missing.length - shown.length === 1 ? "item" : "items"}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
