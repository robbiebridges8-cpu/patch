import Link from "next/link";
import HeaderAuth from "./HeaderAuth";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark}>
          Patch<span className={styles.dot}>.</span>
        </Link>

        <div className={styles.spacer} />

        <nav className={styles.nav}>
          <Link href="/enquiries" className={styles.navLink}>My enquiries</Link>
          <Link href="/for-vendors" className={styles.navLink}>List your service</Link>
          <HeaderAuth />
        </nav>
      </div>
    </header>
  );
}
