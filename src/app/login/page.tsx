"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  // One sign-in for everyone. Context (where you're headed + how you arrived)
  // only tailors the copy, where you land, and the role stamped on a brand-new
  // account — it is NOT a second flow. Buyer vs vendor is what your account
  // *does*, not a door you pick at sign-in.
  const rawNext = params.get("next") || "";
  const vendorContext = params.get("intent") === "vendor" || rawNext.startsWith("/vendor") || rawNext.startsWith("/admin");
  const next = rawNext || (vendorContext ? "/vendor/dashboard" : "/enquiries");

  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") ? "That sign-in link didn't work — it may have expired. Enter your email for a fresh code." : null,
  );
  const [resent, setResent] = useState(false);

  // Already signed in? Don't make anyone re-authenticate — continue to `next`.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(next);
      else setChecking(false);
    });
  }, [next, router, supabase]);

  function otpOptions() {
    return {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // New vendor accounts get the vendor role; new customers default to buyer.
      // (Applied only on first sign-up; ignored for returning users.)
      ...(vendorContext ? { data: { intended_role: "vendor" } } : {}),
    };
  }

  async function send(isResend = false) {
    setLoading(true);
    setError(null);
    setResent(false);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: otpOptions() });
    if (error) setError(error.message);
    else if (isResend) setResent(true);
    else setStep("code");
    setLoading(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // A returning user's code verifies as "email"; a brand-new account's first
    // code is a "signup" confirmation. We don't know which this is, so try the
    // common case and fall back rather than making the user care.
    const addr = email.trim();
    const token = code.trim();
    let { error } = await supabase.auth.verifyOtp({ email: addr, token, type: "email" });
    if (error) {
      ({ error } = await supabase.auth.verifyOtp({ email: addr, token, type: "signup" }));
    }
    if (error) {
      setError("That code didn't work — check it, or request a new one.");
      setLoading(false);
      return;
    }
    // Attach any past anonymous enquiries sent from this email (idempotent).
    try { await supabase.rpc("claim_my_enquiries"); } catch { /* best-effort */ }
    router.push(next);
  }

  if (checking) {
    return <><Header /><main id="main-content" className={styles.wrap} aria-busy="true" /></>;
  }

  const heading = vendorContext ? "Log in to your listing" : "Log in to Patch";
  const sub = vendorContext
    ? "Manage your listing, photos and enquiries. No password — we'll email you a 6-digit sign-in code. New here? It sets your account up too."
    : "Track your enquiries and reviews from any device. No password — we'll email you a 6-digit sign-in code. New here? It creates your account too.";

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        <h1 className={styles.h1}>{heading}</h1>
        <p className={styles.sub}>{sub}</p>

        {step === "email" ? (
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className={styles.card}>
            <label className={styles.label} htmlFor="email">Email address</label>
            <input
              id="email" type="email" required autoComplete="email" autoFocus
              className={styles.input} value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? "Sending…" : "Email me a code"}
            </button>

            {/* "Continue with Google" slots in here once the provider is enabled
                in Supabase — same account, one more way in. */}

            <p className={styles.fine}>
              {vendorContext
                ? "Use the email you listed with and we'll link everything to your account automatically."
                : "Use the email you enquire with and we'll link your past enquiries automatically."}
            </p>
          </form>
        ) : (
          // Code-first: the 6-digit code is typed into THIS tab, so it sidesteps
          // the magic-link redirect handoff that breaks when the email opens in a
          // different browser. The email still carries a link as a backup.
          <form onSubmit={verify} className={styles.card}>
            <div className={styles.sentIcon} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            </div>
            <p className={styles.sentLead}>
              We emailed a 6-digit code to <strong>{email}</strong>. Enter it below to finish signing in.
            </p>
            <label className={styles.label} htmlFor="code">6-digit code</label>
            <input
              id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus
              maxLength={6} pattern="[0-9]*"
              className={styles.input} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.btn} disabled={loading || code.trim().length < 6}>
              {loading ? "Signing in…" : "Log in"}
            </button>
            {resent && <p className={styles.ok} role="status">Sent again — check your inbox.</p>}
            <p className={styles.fine}>
              No code yet?{" "}
              <button type="button" className={styles.linkBtn} onClick={() => send(true)}>Resend it</button>
              {" · "}
              <button type="button" className={styles.linkBtn} onClick={() => { setStep("email"); setCode(""); setError(null); setResent(false); }}>Use a different email</button>
            </p>
            <p className={styles.fine}>
              Prefer to click? The same email has a sign-in link — just open it in this browser.
            </p>
          </form>
        )}

        {/* Gentle escape hatch if someone landed in the wrong framing. */}
        {vendorContext ? (
          <p className={styles.switch}>Just looking to book someone? <a href="/login">Log in as a customer</a>.</p>
        ) : (
          <p className={styles.switch}>Want to list your business? <a href="/login?intent=vendor&next=/vendor/dashboard">Log in as a vendor</a>.</p>
        )}
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
