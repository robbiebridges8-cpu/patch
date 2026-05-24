import styles from "./ParsedChips.module.css";

export default function ParsedChips({ chips }: { chips: string[] }) {
  return (
    <div className={styles.row}>
      <div className={styles.inner}>
        <span className={styles.label}>We understood</span>
        {chips.map((chip) => (
          <span key={chip} className={styles.chip}>
            {chip} <span className={styles.chipX}>×</span>
          </span>
        ))}
      </div>
    </div>
  );
}
