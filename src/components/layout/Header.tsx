import Link from "next/link";
import HeaderNav from "./HeaderNav";
import MobileMenu from "./MobileMenu";
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
          <HeaderNav />
        </nav>
        <MobileMenu />
      </div>
    </header>
  );
}
