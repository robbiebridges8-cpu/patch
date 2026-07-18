import { safeJsonLd } from "@/lib/sanitize";
import Header from "@/components/layout/Header";
import HeroSearch from "@/components/search/HeroSearch";
import QuickStarts from "@/components/search/QuickStarts";
import styles from "./page.module.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Patch",
  url: SITE,
  description: "AI-native marketplace matching London event organisers with mobile food vendors and caterers.",
  areaServed: "London",
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }} />
      <Header />

      {/* ─── FRONT DOOR ─── */}
      <main id="main-content" className={styles.hero}>
        <span className={styles.eyebrow}>Mobile food &amp; catering</span>
        <h1 className={styles.heading}>
          Describe the occasion. Get a shortlist.
        </h1>
        <p className={styles.sub}>
          Tell Patch what you&apos;re planning in plain words — Patch reads the detail and comes back with a short, reasoned set, not a directory.
        </p>
        <HeroSearch />
        <QuickStarts />
      </main>

      {/* ─── HOW IT WORKS ─── */}
      <section className={styles.how}>
        <div className={styles.howInner}>
          <span className={styles.sectionEyebrow}>How it works</span>
          <h2 className={styles.sectionH2}>Skip the spreadsheet. Just describe the event.</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <h3 className={styles.stepTitle}>Describe your event</h3>
              <p className={styles.stepDesc}>
                Tell us the occasion, vibe, budget, guest count, and any dietary needs — in plain English. No filters to fiddle with.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <h3 className={styles.stepTitle}>Get a reasoned shortlist</h3>
              <p className={styles.stepDesc}>
                Patch reads your brief, understands what you need, and returns a short set of vendors ranked by fit — with match notes explaining why.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <h3 className={styles.stepTitle}>Book with confidence</h3>
              <p className={styles.stepDesc}>
                Every vendor is reviewed by real clients. See prices, availability, and distance — then get in touch directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST ─── */}
      <section className={styles.trust}>
        <div className={styles.trustInner}>
          <span className={styles.sectionEyebrow}>Why people trust Patch</span>
          <h2 className={styles.sectionH2}>We do the vetting so you don&apos;t have to.</h2>
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <svg className={styles.trustIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/>
              </svg>
              <h3 className={styles.trustTitle}>Vetted vendors</h3>
              <p className={styles.trustDesc}>
                Every vendor is checked — food hygiene, public liability, and real trading history.
              </p>
            </div>
            <div className={styles.trustCard}>
              <svg className={styles.trustIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <h3 className={styles.trustTitle}>Transparent pricing</h3>
              <p className={styles.trustDesc}>
                No hidden fees. Every listing shows starting prices, per-head costs, and minimum spends.
              </p>
            </div>
            <div className={styles.trustCard}>
              <svg className={styles.trustIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <h3 className={styles.trustTitle}>Real reviews</h3>
              <p className={styles.trustDesc}>
                Every review is from someone who actually booked. No anonymous ratings, no fake five-stars.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VENDOR CTA ─── */}
      <section className={styles.vendorCta}>
        <div className={styles.vendorCtaInner}>
          <div className={styles.vendorCtaContent}>
            <span className={styles.vendorCtaEyebrow}>For vendors</span>
            <h2 className={styles.vendorCtaH2}>
              You make the food. Let Patch fill your calendar.
            </h2>
            <p className={styles.vendorCtaDesc}>
              No commission. No lead fees. Just £20/month to be listed, matched, and reviewed.
              Clients come to you — pre-qualified, budget-ready, and looking for exactly what you cook.
            </p>
            <a href="/for-vendors" className={styles.vendorCtaBtn}>
              List your service
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerBrand}>
              Patch<span className={styles.footerDot}>.</span>
            </div>
            <div className={styles.footerTagline}>Mobile food vendors worth booking.</div>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <h4>Find food</h4>
              <a href="#how-it-works">How it works</a>
              <a href="/search">Search</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Vendors</h4>
              <a href="/for-vendors">List your service</a>
              <a href="/for-vendors">Vendor FAQ</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Company</h4>
              <a href="/about">About</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Patch</span>
          <span>London</span>
        </div>
      </footer>
    </>
  );
}
