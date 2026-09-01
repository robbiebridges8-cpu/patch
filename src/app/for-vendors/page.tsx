import Header from "@/components/layout/Header";
import { safeJsonLd } from "@/lib/sanitize";
import { TIER_PRICE, TIER, annualPrice } from "@/lib/tiers";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hireonpatch.com";

// Prices come from the tier config rather than being written into the copy, so
// the page and the checkout can never disagree — they did, at £20 vs £29.
const PAID = TIER_PRICE[TIER.PAID];

// WebPage describing the vendor-acquisition offer, machine-readable for engines
// answering "how do I list my catering business in London".
const forVendorsJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  url: `${SITE}/for-vendors`,
  name: "List your service on Patch",
  isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website` },
  about: {
    "@type": "Service",
    name: "Patch vendor listing",
    provider: { "@type": "Organization", name: "Patch", url: SITE },
    areaServed: { "@type": "City", name: "London" },
    description: `Free listing for local-service businesses in London. No commission and no per-lead charges; an optional £${PAID}/month plan unlocks every enquiry and paid ranking.`,
  },
};

export const metadata = {
  title: "List your service",
  description:
    `Get matched with clients actively looking for what you do. Free to list. No commission and no per-lead charges — £${PAID}/month when you want to read every enquiry.`,
  alternates: { canonical: "/for-vendors" },
};

const sectionH2 = {
  fontSize: 20,
  fontWeight: 600,
  color: "var(--color-text-primary)",
  marginBottom: 12,
  marginTop: 32,
} as const;

const body = {
  fontSize: 16,
  lineHeight: 1.7,
  color: "var(--color-text-secondary)",
  marginBottom: 16,
} as const;

export default function ForVendorsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(forVendorsJsonLd) }} />
      <Header />
      <main id="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>
          List your service on Patch
        </h1>
        <p style={body}>
          Patch connects you with clients who are actively looking for what you do. Listing is free,
          and stays free. No commission and no per-lead charges — if you upgrade, it&apos;s one flat
          subscription.
        </p>

        <a href="/login?intent=vendor&next=/vendor/onboarding" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--color-accent)", color: "var(--color-on-accent)",
          fontWeight: 600, fontSize: 16, padding: "14px 26px", borderRadius: 12,
          textDecoration: "none", marginTop: 4,
        }}>
          List your service — it&apos;s free →
        </a>
        <p style={{ ...body, fontSize: 14, color: "var(--color-text-muted)", marginTop: 12 }}>
          Takes about two minutes. No card needed.
        </p>

        <h2 style={sectionH2}>Free listing</h2>
        <ul style={{ fontSize: 16, lineHeight: 1.9, color: "var(--color-text-secondary)", paddingLeft: 20 }}>
          <li>Your own profile page, findable on Google and by name on Patch</li>
          <li>You appear in search results, ranked below paid listings</li>
          <li>One photo, your description, your prices</li>
          <li>Reviews — which can only be left by someone who sent you a real enquiry</li>
          <li>You&apos;ll see when an enquiry arrives, but not who sent it</li>
        </ul>

        <h2 style={sectionH2}>Paid — £{PAID}/month</h2>
        <ul style={{ fontSize: 16, lineHeight: 1.9, color: "var(--color-text-secondary)", paddingLeft: 20 }}>
          <li>Read and reply to every enquiry</li>
          <li>Email the moment a lead lands, rather than a daily digest</li>
          <li>Ranked alongside other paid listings instead of below them</li>
          <li>Full photo gallery, longer profile, FAQs</li>
          <li>Availability calendar — mark yourself unavailable and you rank lower for those dates</li>
          <li>Coverage radius — set how far you&apos;ll travel</li>
          <li>See your views, enquiries and how many became bookings</li>
        </ul>

        <h2 style={sectionH2}>Pricing</h2>
        <p style={body}>
          £{PAID}/month, flat, or £{annualPrice(TIER.PAID)}/year — two months free. No setup fees,
          no commission, cancel any time. If you cancel, your listing stays up on the free tier
          rather than disappearing.
        </p>

        <h2 style={sectionH2}>What Patch doesn&apos;t do</h2>
        <p style={body}>
          Patch is discovery only. We don&apos;t take payment, hold deposits, or get involved in the
          job itself — you agree terms directly with the client, and the contract is between you and
          them. We also don&apos;t vet or verify listings, so clients may ask to see your licences,
          insurance or certifications.
        </p>

        <h2 style={sectionH2}>Get started</h2>
        <p style={{ ...body, marginBottom: 0 }}>
          <a href="/login?intent=vendor&next=/vendor/onboarding" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
            Create your listing
          </a>{" "}
          — it takes a few minutes and you don&apos;t need a card. Questions:{" "}
          <a href="mailto:vendors@hireonpatch.com" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
            vendors@hireonpatch.com
          </a>
          .
        </p>
      </main>
    </>
  );
}
