import Header from "@/components/layout/Header";

export const metadata = {
  title: "Privacy Policy",
  description: "How Patch collects, uses, and protects your personal data.",
  alternates: { canonical: "/privacy" },
};

const wrap = { maxWidth: 720, margin: "0 auto", padding: "64px 32px 96px" } as const;
const h1 = { fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.005em", color: "var(--color-text-primary)", marginBottom: 8 } as const;
const meta = { fontSize: 13, color: "var(--color-text-muted)", marginBottom: 32 } as const;
const h2 = { fontSize: 19, fontWeight: 600, color: "var(--color-text-primary)", margin: "32px 0 10px" } as const;
const p = { fontSize: 15, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 12 } as const;
const ul = { fontSize: 15, lineHeight: 1.8, color: "var(--color-text-secondary)", paddingLeft: 20, marginBottom: 12 } as const;
const a = { color: "var(--color-text-primary)", fontWeight: 500 } as const;

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main id="main-content" style={wrap}>
        <h1 style={h1}>Privacy Policy</h1>
        <p style={meta}>Last updated: 14 July 2026</p>

        <p style={p}>
          This policy explains what personal data Patch collects, why, and what rights you have over it.
          Patch is the data controller for the personal data described here. You can reach us at{" "}
          <a href="mailto:privacy@patch.london" style={a}>privacy@patch.london</a>.
        </p>

        <h2 style={h2}>Who we are</h2>
        <p style={p}>
          Patch is a discovery platform that connects people planning events with mobile food vendors and caterers in London.
          We are based in the United Kingdom and comply with the UK GDPR and the Data Protection Act 2018.
        </p>

        <h2 style={h2}>What we collect</h2>
        <ul style={ul}>
          <li><strong>Search queries.</strong> The event briefs you type (e.g. occasion, guest count, budget, area) so we can return relevant matches and improve our AI matching.</li>
          <li><strong>Enquiry details.</strong> When you contact a vendor, the information you provide: your name, email, phone (optional), event date, guest count, postcode, and message.</li>
          <li><strong>Vendor account data.</strong> If you list a service, your email and the listing details you manage.</li>
          <li><strong>Technical data.</strong> Basic, privacy-respecting usage data (e.g. approximate device/browser type) needed to run the site securely. We do not use advertising trackers.</li>
        </ul>

        <h2 style={h2}>Why we use it, and our legal basis</h2>
        <ul style={ul}>
          <li><strong>To provide the service</strong> — matching you with vendors and passing on your enquiries (<em>performance of a contract</em> and <em>legitimate interests</em>).</li>
          <li><strong>To improve matching</strong> — analysing anonymised or aggregated search patterns (<em>legitimate interests</em>).</li>
          <li><strong>To operate vendor accounts and billing</strong> (<em>performance of a contract</em>).</li>
          <li><strong>To keep the platform secure</strong> and prevent misuse (<em>legitimate interests</em>).</li>
        </ul>

        <h2 style={h2}>Who we share it with</h2>
        <p style={p}>
          When you send an enquiry, we share the details you provide <strong>with that vendor only</strong>, so they can respond.
          Vendors cannot see your search history or any activity beyond the enquiry you send them.
        </p>
        <p style={p}>
          We use a small number of trusted service providers to run Patch — including our database and hosting (Supabase),
          AI query understanding and embeddings (Anthropic and Voyage AI), transactional email, and, for vendor subscriptions, payment processing (Stripe).
          These providers process data on our instructions. Some may process data outside the UK/EEA; where they do, appropriate safeguards
          (such as Standard Contractual Clauses) are in place. We never sell your personal data.
        </p>

        <h2 style={h2}>How long we keep it</h2>
        <p style={p}>
          We keep enquiry data for as long as needed to facilitate your booking and for a reasonable period afterwards to handle
          any follow-up or disputes, then delete or anonymise it. Search queries used to improve matching are retained in
          anonymised or aggregated form. Vendor account data is kept while the account is active.
        </p>

        <h2 style={h2}>Your rights</h2>
        <p style={p}>Under UK data protection law you can:</p>
        <ul style={ul}>
          <li>access the personal data we hold about you;</li>
          <li>ask us to correct or delete it;</li>
          <li>object to or restrict how we use it;</li>
          <li>request a copy in a portable format;</li>
          <li>withdraw consent where we rely on it.</li>
        </ul>
        <p style={p}>
          To exercise any of these, email <a href="mailto:privacy@patch.london" style={a}>privacy@patch.london</a>.
          You also have the right to complain to the UK Information Commissioner&apos;s Office (ICO) at{" "}
          <a href="https://ico.org.uk" style={a} target="_blank" rel="noopener noreferrer">ico.org.uk</a>.
        </p>

        <h2 style={h2}>Cookies</h2>
        <p style={p}>
          We use only the cookies necessary to run the site and keep you signed in. We do not use advertising or cross-site tracking cookies.
        </p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>
          We may update this policy from time to time. Material changes will be reflected by the &ldquo;last updated&rdquo; date above.
          Questions? Email <a href="mailto:privacy@patch.london" style={a}>privacy@patch.london</a>.
        </p>
      </main>
    </>
  );
}
