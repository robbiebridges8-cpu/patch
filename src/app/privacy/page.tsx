import Header from "@/components/layout/Header";

export const metadata = {
  title: "Privacy Policy",
  description: "How Patch collects, uses, and protects your data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>Privacy Policy</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch collects the minimum data needed to connect you with food vendors and caterers. We store your search queries to improve our AI matching, but we never sell your data to third parties.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          When you contact a vendor through Patch, we share only the information you provide in your enquiry (name, email, event details). Vendors cannot see your search history or other activity.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          Questions? Email <a href="mailto:privacy@patch.london" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>privacy@patch.london</a>.
        </p>
      </main>
    </>
  );
}
