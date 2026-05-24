import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>
          <span className={styles.logoMark}>P</span>
          <span>Patch</span>
          <span className={styles.logoLoc}>London</span>
        </a>
        <nav className={styles.nav}>
          <a href="/search">Search</a>
          <a href="/for-vendors">For vendors</a>
          <a href="/for-vendors" className={styles.navCta}>List your service</a>
        </nav>
      </div>
    </header>
  );
}
