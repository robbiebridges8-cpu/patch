import Header from "@/components/layout/Header";
import { safeJsonLd } from "@/lib/sanitize";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";

export const metadata = {
  title: "About",
  description: "Patch is a marketplace matching Londoners with the right local services and trades — caterers, photographers, cleaners, DJs, tradespeople and more.",
  alternates: { canonical: "/about" },
};

// AboutPage → Organization so the canonical "what is Patch" answer is machine-
// readable and entity-disambiguated wherever an engine quotes this page.
const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  url: `${SITE}/about`,
  mainEntity: {
    "@type": "Organization",
    name: "Patch",
    alternateName: ["Patch London", "Patch UK"],
    url: SITE,
    description: "A marketplace for hiring local services in London. Describe a job in plain words and get a short shortlist of vendors that fit, each with a note on why.",
    disambiguatingDescription: "The UK London services marketplace at patch.london. Not affiliated with Patch.com, the US local-news network.",
    areaServed: { "@type": "City", name: "London" },
  },
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(aboutJsonLd) }} />
      <Header />
      <main id="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "64px 32px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 24, letterSpacing: "-0.02em" }}>About Patch</h1>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch is a marketplace for local services in London. We match people with the right business for the job — based on what they actually need, not keyword searches. <strong>Food and catering is live now</strong> — caterers, street food, grazing, bars, coffee. It&apos;s the proving ground for a platform built to expand to photographers, cleaners, DJs, trades and every other kind of casual service.
        </p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Patch does not vet or verify the businesses listed. Listings are self-declared, and it is
          worth asking to see the licences, insurance or certifications that matter for your job
          before you book. What Patch does is find the right handful of people to ask.</p>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-text-secondary)" }}>
          We launched in 2026, starting with London. If you&apos;re a vendor and want to be listed, or a client with feedback, get in touch at <a href="mailto:hello@patch.london" style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>hello@patch.london</a>.
        </p>
      </main>
    </>
  );
}
