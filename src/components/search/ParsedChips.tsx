import styles from "./ParsedChips.module.css";

export default function ParsedChips({ chips }: { chips: string[] }) {
  return (
    <div className={styles.row}>
      {chips.map((chip) => (
        <span key={chip} className={styles.chip}>
          {chip}
          <button type="button" className={styles.dismiss} aria-label={`Remove ${chip}`}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
