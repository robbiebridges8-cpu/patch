import { safeJsonLd } from "@/lib/sanitize";
import Header from "@/components/layout/Header";
import HeroSearch from "@/components/search/HeroSearch";
import styles from "./page.module.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
// Organization + WebSite (with SearchAction) so answer engines and Google can
// disambiguate the entity and surface the sitelinks search box.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Patch",
      url: SITE,
      logo: `${SITE}/icons/vendor-512.png`,
      description: "AI-native marketplace matching Londoners with the right local services and trades — described in plain words, shortlisted and reasoned by AI.",
      areaServed: "London",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "Patch",
      publisher: { "@id": `${SITE}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }} />
      <Header />

      {/* ─── FRONT DOOR ─── */}
      <main id="main-content" className={styles.hero}>
        <span className={styles.eyebrow}>Local services, London</span>
        <h1 className={styles.heading}>
          Describe what you need in your own words. Get a shortlist in seconds.
        </h1>
        <p className={styles.sub}>
          Tell Patch what you&apos;re after in plain words. It reads the detail and comes back with
          a short, reasoned set — and says why each one fits.
        </p>
        <HeroSearch />
      </main>

      {/* ─── TESTIMONIALS ───
          Intentionally empty until there are real ones. A wall of invented
          quotes is worse than no wall, and this is the first thing that should
          go in once vendors and buyers have actually used it. */}

      {/* ─── HOW IT WORKS ─── */}
      <section className={styles.how}>
        <div className={styles.howInner}>
          <span className={styles.sectionEyebrow}>How it works</span>
          <h2 className={styles.sectionH2}>Skip the spreadsheet. Just say what you need.</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <h3 className={styles.stepTitle}>Describe the job</h3>
              <p className={styles.stepDesc}>
                Tell us what you need, when, where, and roughly what you want to spend — in plain
                English. No filters to fiddle with.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <h3 className={styles.stepTitle}>Get a reasoned shortlist</h3>
              <p className={styles.stepDesc}>
                Patch reads your brief, works out what actually matters in it, and returns a short
                set ranked by fit — with notes explaining why each one made the list.
              </p>
            </div>
            <div className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <h3 className={styles.stepTitle}>Book with confidence</h3>
              <p className={styles.stepDesc}>
                Reviews come only from real enquiries, so ratings mean something. See prices,
                availability and distance — then get in touch directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TRUST ─── */}
      <section className={styles.trust}>
        <div className={styles.trustInner}>
          <span className={styles.sectionEyebrow}>How Patch works with you</span>
          <h2 className={styles.sectionH2}>You choose. We just make choosing easier.</h2>
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <svg className={styles.trustIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/>
              </svg>
              <h3 className={styles.trustTitle}>You deal direct</h3>
              <p className={styles.trustDesc}>
                No commission and no middleman. You contact whoever you like and agree terms
                between you — Patch never takes a cut or sits in the transaction.
              </p>
            </div>
            <div className={styles.trustCard}>
              <svg className={styles.trustIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <h3 className={styles.trustTitle}>Transparent pricing</h3>
              <p className={styles.trustDesc}>
                Listings show what they start at, so you can rule things out before you spend an
                hour on enquiries.
              </p>
            </div>
            <div className={styles.trustCard}>
              <svg className={styles.trustIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <h3 className={styles.trustTitle}>Reviews from real enquiries</h3>
              <p className={styles.trustDesc}>
                A review can only be left by someone who sent a real enquiry through Patch, so
                there is a genuine job behind every one.
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
              You do the work. Let Patch fill your calendar.
            </h2>
            <p className={styles.vendorCtaDesc}>
              No commission. No per-lead fees. List for free, and upgrade when you want to read
              every enquiry and rank alongside paid listings. Clients come to you — already
              describing the job, the date and the budget.
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
            <div className={styles.footerTagline}>Local services worth booking.</div>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <h4>Find services</h4>
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
