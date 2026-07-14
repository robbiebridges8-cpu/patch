import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.wordmark}>
          Patch<span className={styles.dot}>.</span>
        </Link>

        <div className={styles.locationPill}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Hackney, London
        </div>

        <div className={styles.spacer} />

        <nav className={styles.nav}>
          <Link href="/for-vendors" className={styles.navLink}>List your service</Link>
          <Link href="/vendor/dashboard" className={styles.accountBtn} aria-label="Vendor sign in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21a8 8 0 0 0-16 0"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
