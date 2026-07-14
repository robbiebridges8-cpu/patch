import Header from "@/components/layout/Header";

export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Patch.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>Terms of Service</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch is a discovery platform. We help you find mobile food vendors and caterers, but we are not a party to the contract between you and the vendor. All bookings, payments, and service delivery are between you and the vendor directly.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          We do our best to verify vendors (food hygiene, insurance, reviews), but we cannot guarantee the quality of any individual booking. Always confirm details directly with the vendor before paying.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          Questions? Email <a href="mailto:hello@patch.london" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>hello@patch.london</a>.
        </p>
      </main>
    </>
  );
}
