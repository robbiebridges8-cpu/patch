import Header from "@/components/layout/Header";

export const metadata = {
  title: "List your service",
  description: "Get matched with clients actively looking for what you cook. No commission, no per-lead fees — £20/month to be listed, matched, and reviewed on Patch.",
  alternates: { canonical: "/for-vendors" },
};

export default function ForVendorsPage() {
  return (
    <>
      <Header />
      <main id="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>List your service on Patch</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch connects you with clients who are actively looking for what you cook. No commission, no per-lead fees — just £20/month to be listed, matched, and reviewed.
        </p>
        <h2 id="pricing" style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12, marginTop: 32 }}>What you get</h2>
        <ul style={{ fontSize: 16, lineHeight: 1.9, color: "var(--color-text-secondary)", paddingLeft: 20 }}>
          <li>Your own profile page with descriptions, pricing, signature dishes, and reviews</li>
          <li>AI-matched enquiries from clients whose event fits what you offer</li>
          <li>Availability calendar — only get enquiries for dates you&apos;re free</li>
          <li>Reviews that can only come from a real enquiry</li>
          <li>Coverage area settings — choose which areas of London you serve</li>
        </ul>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12, marginTop: 32 }}>Pricing</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          £20/month, flat. List all your services for one price. No setup fees, cancel anytime.
        </p>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 12, marginTop: 32 }}>Get started</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          Email <a href="mailto:vendors@patch.london" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>vendors@patch.london</a> with your business name, what you offer, and which areas of London you cover. We&apos;ll get you set up within 48 hours.
        </p>
      </main>
    </>
  );
}
