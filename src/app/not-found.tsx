import Header from "@/components/layout/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" style={{ maxWidth: 560, margin: "0 auto", padding: "96px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-text-primary)", marginBottom: 12 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 28 }}>
          We couldn&apos;t find that page. It may have moved, or the vendor is no longer listed.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a
            href="/search"
            style={{ height: 46, padding: "0 22px", display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 600, color: "var(--color-on-accent)", background: "var(--color-accent)", borderRadius: 12, textDecoration: "none" }}
          >
            Find vendors
          </a>
          <a
            href="/"
            style={{ height: 46, padding: "0 22px", display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-surface-sunken, #f0ebe4)", borderRadius: 12, textDecoration: "none" }}
          >
            Back to home
          </a>
        </div>
      </main>
    </>
  );
}
