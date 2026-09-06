"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useNavAuth } from "./useNavAuth";
import styles from "./Header.module.css";

// Mobile-only nav. The desktop nav is hidden under 760px, so without this a
// phone user had no way to reach enquiries, list a service, or even log in.
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const auth = useNavAuth();
  const btnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Keyboard support while open: Escape closes, Tab is trapped inside the sheet
  // so focus can't wander behind the scrim to the page underneath.
  useEffect(() => {
    if (!open) return;
    // Move focus into the menu when it opens.
    sheetRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const items = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>("a, button"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Restore focus to the toggle when the menu closes (but not on first mount).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) btnRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.mobileMenu}>
      <button
        ref={btnRef}
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
          <nav className={styles.menuSheet} aria-label="Main menu" ref={sheetRef}>
            <Link href="/enquiries" className={styles.menuLink} onClick={close}>My enquiries</Link>
            {auth === "vendor" ? (
              <Link href="/vendor/dashboard" className={styles.menuLink} onClick={close}>My listings</Link>
            ) : (
              <Link href="/for-vendors" className={styles.menuLink} onClick={close}>List your service</Link>
            )}
            {auth === "loading" ? null : auth === "out" ? (
              <Link href="/login" className={styles.menuLink} onClick={close}>Log in</Link>
            ) : (
              <button
                type="button"
                className={styles.menuLink}
                onClick={async () => { await createClient().auth.signOut(); window.location.href = "/"; }}
              >
                Log out
              </button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
