import styles from "./SearchSkeleton.module.css";

/** Shimmer block sized like the streamed AI reasoning note. */
export function AINoteSkeleton() {
  return (
    <div className={styles.noteWrap} aria-hidden="true">
      <div className={styles.noteHead}>
        <span className={styles.dot} />
        <span className={`${styles.line} ${styles.w30}`} />
      </div>
      <span className={`${styles.line} ${styles.w90}`} />
      <span className={`${styles.line} ${styles.w80}`} />
      <span className={`${styles.line} ${styles.w50}`} />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className={styles.card} aria-hidden="true">
      <div className={styles.media} />
      <div className={styles.cardBody}>
        <span className={`${styles.line} ${styles.w25}`} />
        <span className={`${styles.line} ${styles.w60} ${styles.tall}`} />
        <span className={`${styles.line} ${styles.w90}`} />
        <span className={`${styles.line} ${styles.w40}`} />
      </div>
    </div>
  );
}

/** Full results-column skeleton shown while the vector search runs. */
export function ResultsSkeleton() {
  return (
    <div role="status" aria-label="Finding vendors">
      <div className={styles.chips} aria-hidden="true">
        <span className={styles.chip} />
        <span className={styles.chip} />
        <span className={styles.chip} />
      </div>
      <AINoteSkeleton />
      <div className={styles.list}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <span className={styles.srOnly}>Finding vendors that fit your occasion…</span>
    </div>
  );
}

/** Filter-sidebar skeleton. */
export function SidebarSkeleton() {
  return (
    <div className={styles.sidebar} aria-hidden="true">
      <span className={`${styles.line} ${styles.w40}`} />
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={`${styles.line} ${styles.w80}`} />
      ))}
    </div>
  );
}
