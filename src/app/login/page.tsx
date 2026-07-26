"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";
import styles from "./login.module.css";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/enquiries";
  const supabase = createClient();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Sends a 6-digit code (and, as a fallback, a magic link that resolves via
    // /auth/callback). shouldCreateUser so first-time buyers get an account.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setError(error.message);
    else setStep("code");
    setLoading(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setError("That code didn't work — check it, or request a new one.");
      setLoading(false);
      return;
    }
    // Attach any past anonymous enquiries sent from this email (idempotent; also
    // runs on /enquiries, so this is belt-and-braces).
    await supabase.rpc("claim_my_enquiries");
    router.push(next);
  }

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        <h1 className={styles.h1}>Sign in to Patch</h1>
        <p className={styles.sub}>
          Save your enquiries and reviews to your account so you can pick up from any device.
          No password — we&apos;ll email you a code.
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} className={styles.card}>
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

            {/* Google slots in here once the provider is enabled in Supabase.
                <button className={styles.btnGoogle} onClick={signInWithGoogle}>Continue with Google</button> */}

            <p className={styles.fine}>
              Use the same email you enquire with, and we&apos;ll link your past enquiries automatically.
            </p>
          </form>
        ) : (
          <form onSubmit={verify} className={styles.card}>
            <label className={styles.label} htmlFor="code">Enter the code we emailed to {email}</label>
            <input
              id="code" inputMode="numeric" autoComplete="one-time-code" autoFocus
              className={styles.input} value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className={styles.fine}>
              No code? It can take a moment — or{" "}
              <button type="button" className={styles.linkBtn} onClick={() => { setStep("email"); setCode(""); setError(null); }}>
                use a different email
              </button>. You can also click the link in the email.
            </p>
          </form>
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
