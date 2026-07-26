"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./Header.module.css";

// The single auth affordance in the header, state-aware so there's never two
// competing "sign in" entry points. Logged out → one "Log in". Logged in → an
// account shortcut + "Log out". Client island so static pages stay static.
export default function HeaderAuth() {
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (email === undefined) return null; // avoid a flash of the wrong state

  if (!email) {
    return <Link href="/login" className={styles.navLink}>Log in</Link>;
  }

  return (
    <>
      <Link href="/vendor/dashboard" className={styles.accountBtn} aria-label="Your account">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </Link>
      <button
        type="button"
        className={styles.navLink}
        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
        onClick={async () => {
          await createClient().auth.signOut();
          window.location.href = "/";
        }}
      >
        Log out
      </button>
    </>
  );
}
