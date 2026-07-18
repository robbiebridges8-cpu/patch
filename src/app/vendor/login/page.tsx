"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";
import styles from "../vendor.module.css";

export default function VendorLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const next = new URLSearchParams(window.location.search).get("next") || "/vendor/dashboard";
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  return (
    <>
      <Header />
      <main id="main-content" className={`${styles.wrap} ${styles.narrow}`}>
        <h1 className={styles.h1}>Vendor sign in</h1>
        <p className={styles.sub}>
          Manage your listing and see enquiries. Enter your email and we&apos;ll send you a secure sign-in link.
        </p>

        {sent ? (
          <div className={`${styles.notice} ${styles.noticeOk}`}>
            Check your inbox — we&apos;ve sent a sign-in link to <strong>{email}</strong>.
            Open it on this device to continue.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.card}>
            <div className={styles.field}>
              <label className={styles.labelText} htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@yourbusiness.com"
              />
            </div>
            {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
