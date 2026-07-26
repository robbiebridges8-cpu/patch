"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./Header.module.css";

// Client island so the header can show login state without forcing every page
// (incl. the static ones) into dynamic rendering via a server-side session read.
export default function HeaderAuth() {
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined = still loading

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
  );
}
