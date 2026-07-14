"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 32px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)", marginBottom: 12 }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 28 }}>
        A hiccup on our end — not yours. Try again, and if it keeps happening,
        drop us a line at <a href="mailto:hello@patch.london" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>hello@patch.london</a>.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button
          type="button"
          onClick={reset}
          style={{ height: 46, padding: "0 22px", fontSize: 15, fontWeight: 600, color: "var(--color-on-accent)", background: "var(--color-accent)", border: "none", borderRadius: 12, cursor: "pointer" }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{ height: 46, padding: "0 22px", display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-surface-sunken, #f0ebe4)", borderRadius: 12, textDecoration: "none" }}
        >
          Back to home
        </a>
      </div>
    </main>
  );
}
