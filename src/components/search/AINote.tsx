import styles from "./AINote.module.css";

export default function AINote({ html }: { html: string }) {
  return (
    <div className={styles.note}>
      <span className={styles.tag}>Patch</span>
      <div className={styles.text} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
