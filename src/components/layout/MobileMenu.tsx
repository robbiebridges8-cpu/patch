"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./Header.module.css";

// Mobile-only nav. The desktop nav is hidden under 760px, so without this a
// phone user had no way to reach enquiries, list a service, or even log in.
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.mobileMenu}>
      <button
        type="button"
        className={styles.menuBtn}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <>
          <div className={styles.menuScrim} onClick={close} aria-hidden="true" />
          <nav className={styles.menuSheet} aria-label="Main menu">
            <Link href="/enquiries" className={styles.menuLink} onClick={close}>My enquiries</Link>
            <Link href="/for-vendors" className={styles.menuLink} onClick={close}>List your service</Link>
            {email === undefined ? null : email ? (
              <button
                type="button"
                className={styles.menuLink}
                onClick={async () => { await createClient().auth.signOut(); window.location.href = "/"; }}
              >
                Log out
              </button>
            ) : (
              <Link href="/login" className={styles.menuLink} onClick={close}>Log in</Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
