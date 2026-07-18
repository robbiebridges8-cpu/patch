import { sanitizeNoteHtml } from "@/lib/sanitize";
import styles from "./AINote.module.css";

export default function AINote({ html }: { html: string }) {
  return (
    <p className={styles.note} dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(html) }} />
  );
}
