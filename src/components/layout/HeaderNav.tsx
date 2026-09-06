"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNavAuth } from "./useNavAuth";
import styles from "./Header.module.css";

// The whole desktop nav, state-aware (see useNavAuth). A vendor manages their
// listing ("My listings") and never sees the "List your service" marketing CTA,
// which for them is a dead link. Everyone else keeps the buyer/marketing nav.
export default function HeaderNav() {
  const auth = useNavAuth();

  const logOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/";
  };

  const logOutBtn = (
    <button
      type="button"
      className={styles.navLink}
      style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
      onClick={logOut}
    >
      Log out
    </button>
  );

  // "My enquiries" is universal — buyer is a capability everyone has, so even a
  // vendor keeps a path to enquiries they've *sent*. The middle slot is the one
  // that flips: own a listing → manage it; don't → the marketing CTA to make one.
  return (
    <>
      <Link href="/enquiries" className={styles.navLink}>My enquiries</Link>
      {auth === "vendor" ? (
        <Link href="/vendor/dashboard" className={styles.navLink}>My listings</Link>
      ) : (
        <Link href="/for-vendors" className={styles.navLink}>List your service</Link>
      )}
      {auth === "loading" ? null : auth === "out" ? (
        <Link href="/login" className={styles.navLink}>Log in</Link>
      ) : (
        logOutBtn
      )}
    </>
  );
}
