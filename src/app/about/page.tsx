import Header from "@/components/layout/Header";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import { safeJsonLd } from "@/lib/sanitize";
import { supabase } from "@/lib/supabase";
import { SERVICE_CATEGORIES } from "@/lib/serviceAreas";
import styles from "./about.module.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hireonpatch.com";

export const revalidate = 3600;

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
    disambiguatingDescription: "The UK London services marketplace at hireonpatch.com. Not affiliated with Patch.com, the US local-news network.",
    areaServed: { "@type": "City", name: "London" },
  },
};

function Icon({ path }: { path: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const principles = [
  {
    path: "M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z",
    title: "Described, not searched",
    desc: "Say what you need in your own words — the occasion, area, budget, scale. Patch works out what actually matters and matches by meaning, not keywords.",
  },
  {
    path: "M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z",
    title: "You deal direct",
    desc: "No commission, no per-lead fees, no middleman. You contact vendors and agree terms yourselves — Patch never takes a cut or sits in the transaction.",
  },
  {
    path: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    title: "Honest by default",
    desc: "We don't vet or verify listings, and we say so — ask to see the licences and insurance that matter. Reviews come only from someone who made a real enquiry.",
  },
  {
    path: "M3 3v18h18M7 14l3-3 3 3 5-5",
    title: "Built to expand",
    desc: "Food and catering is live now — the proving ground for a horizontal platform built to grow into photographers, cleaners, DJs, trades and more.",
  },
];

export default async function AboutPage() {
  const { data: stats } = await supabase.rpc("platform_stats").single();
  const s = stats as { vendor_count: number; area_count: number } | null;
  const vendorsRounded = s?.vendor_count ? Math.floor(s.vendor_count / 10) * 10 : 0;
  const areaCount = s?.area_count ?? 0;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(aboutJsonLd) }} />
      <Header />
      <main id="main-content" className={styles.page}>

        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>About Patch · London</p>
            <h1 className={styles.h1}>The right local business for the job — in <em>plain words</em></h1>
            <p className={styles.lede}>
              Patch is a marketplace for local services in London. Describe what you need and we
              return a short, reasoned shortlist of businesses that genuinely fit — not a keyword
              page to wade through.
            </p>
            {vendorsRounded > 0 && (
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statNum}><CountUp end={vendorsRounded} suffix="+" /></span>
                  <span className={styles.statLabel}>vendors listed</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}><CountUp end={areaCount} /></span>
                  <span className={styles.statLabel}>London areas</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNum}><CountUp end={SERVICE_CATEGORIES.length} /></span>
                  <span className={styles.statLabel}>service categories</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Principles */}
        <section className={styles.section}>
          <Reveal>
            <p className={styles.sectionEyebrow}>What we believe</p>
            <h2 className={styles.sectionH2}>How Patch is built</h2>
          </Reveal>
          <div className={styles.principles}>
            {principles.map((p, i) => (
              <Reveal key={p.title} className={styles.principle} delay={(i % 2) * 90}>
                <span className={styles.principleIcon}><Icon path={p.path} /></span>
                <div className={styles.principleTitle}>{p.title}</div>
                <p className={styles.principleDesc}>{p.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Story */}
        <section className={styles.story}>
          <div className={styles.storyInner}>
            <Reveal>
              <p className={styles.sectionEyebrow}>Where we&apos;re going</p>
              <h2 className={styles.sectionH2}>Started in London, in 2026</h2>
              <p className={styles.storyBody}>
                We launched in 2026, starting with food and catering across London — the proving
                ground for a platform meant to cover every kind of casual local service. If you run
                a business and want to be listed, or you&apos;re a client with feedback, we&apos;d
                love to hear from you at{" "}
                <a href="mailto:hello@hireonpatch.com">hello@hireonpatch.com</a>.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className={styles.finalCta}>
          <div className={styles.finalInner}>
            <Reveal>
              <h2 className={styles.finalH2}>Find your people</h2>
              <p className={styles.finalSub}>
                Describe the job and get a shortlist in seconds — or list your own service, free.
              </p>
              <div className={styles.ctaRow}>
                <a className={styles.btnPrimary} href="/search">Find a service →</a>
                <a className={styles.btnGhost} href="/for-vendors">List your service</a>
              </div>
              <p className={styles.finalEmail}>
                Questions? <a href="mailto:hello@hireonpatch.com">hello@hireonpatch.com</a>
              </p>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
