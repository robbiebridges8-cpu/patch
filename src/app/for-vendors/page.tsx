import Header from "@/components/layout/Header";
import Reveal from "@/components/Reveal";
import { safeJsonLd } from "@/lib/sanitize";
import { TIER_PRICE, TIER, annualPrice } from "@/lib/tiers";
import styles from "./for-vendors.module.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hireonpatch.com";

// Prices come from the tier config rather than being written into the copy, so
// the page and the checkout can never disagree — they did, at £20 vs £29.
const PAID = TIER_PRICE[TIER.PAID];

const SIGNUP = "/login?intent=vendor&next=/vendor/onboarding";

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

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const freeFeatures = [
  "Your own profile page, findable on Google and by name on Patch",
  "You appear in search results, ranked below paid listings",
  "One photo, your description, your prices",
  "Reviews — only from someone who sent you a real enquiry",
  "You’ll see when an enquiry arrives, but not who sent it",
];

const paidFeatures = [
  "Read and reply to every enquiry",
  "Emailed the moment a lead lands, not a daily digest",
  "Ranked alongside other paid listings, not below them",
  "Full photo gallery, longer profile, FAQs",
  "Availability calendar — rank lower on dates you’re away",
  "Coverage radius — set how far you’ll travel",
  "Analytics — views, enquiries, and how many became bookings",
];

const steps = [
  {
    title: "List free in two minutes",
    desc: "Describe what you do in plain words. We turn it into a profile clients can find — no forms to wrestle, no card needed.",
  },
  {
    title: "Get matched to real jobs",
    desc: "When someone describes a job you fit, you land in their shortlist — with a reason why you’re a good match.",
  },
  {
    title: "Reply and win the work",
    desc: "Talk to the client directly and agree terms yourselves. No commission, no middleman — the booking is entirely yours.",
  },
];

export default function ForVendorsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(forVendorsJsonLd) }} />
      <Header />
      <main id="main-content" className={styles.page}>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>For local businesses · London</p>
              <h1 className={styles.h1}>Get found by people ready to <em>book</em></h1>
              <p className={styles.lead}>
                Patch matches you with clients who are actively describing the job they need done —
                and puts you in their shortlist with a reason why. Listing is free, and stays free.
              </p>
              <div className={styles.ctaRow}>
                <a className={styles.btnPrimary} href={SIGNUP}>
                  List your service — it’s free <span className={styles.arrow}>→</span>
                </a>
                <span className={styles.ctaNote}>About two minutes. No card needed.</span>
              </div>
              <ul className={styles.heroPoints}>
                <li><Check /> Free forever</li>
                <li><Check /> No commission</li>
                <li><Check /> The client is yours</li>
              </ul>
            </div>

            <div className={styles.heroVisual} aria-hidden="true">
              <p className={styles.heroVisualLabel}>A lead, the moment it lands</p>
              <div className={styles.cardStack}>
                <div className={styles.leadCardBehind} />
                <div className={styles.leadCard}>
                  <div className={styles.leadHead}>
                    <span className={styles.leadBadge}><span className={styles.dot} /> New enquiry</span>
                    <span className={styles.leadTime}>2 min ago</span>
                  </div>
                  <div className={styles.leadName}>Sarah M.</div>
                  <div className={styles.leadDetail}>Birthday party · 30 guests · Hackney (E8) · Sat 12 Oct</div>
                  <div className={styles.leadFoot}>
                    <span className={styles.leadBudget}>£600 budget</span>
                    <span className={styles.leadReply}>Reply →</span>
                  </div>
                </div>
                <span className={styles.statChip}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m3 17 6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>
                  3 new enquiries this week
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.sectionEyebrow}>How it works</p>
            <h2 className={styles.sectionH2}>Three steps to your next booking</h2>
          </Reveal>
          <div className={styles.steps}>
            {steps.map((s, i) => (
              <Reveal key={s.title} className={styles.step} delay={i * 90}>
                <span className={styles.stepNum}>{i + 1}</span>
                <div className={styles.stepTitle}>{s.title}</div>
                <p className={styles.stepDesc}>{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className={styles.section}>
          <Reveal className={styles.sectionHead}>
            <p className={styles.sectionEyebrow}>Pricing</p>
            <h2 className={styles.sectionH2}>Free to start. Pay only to go further.</h2>
            <p className={styles.sectionSub}>
              No setup fees, no commission, no per-lead charges — ever. Upgrade for one flat
              subscription, and drop back to free any time without losing your listing.
            </p>
          </Reveal>

          <div className={styles.plans}>
            <Reveal className={styles.planCard}>
              <div className={styles.planName}>Free</div>
              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>£0</span>
                <span className={styles.planPeriod}>/ month</span>
              </div>
              <p className={styles.planTagline}>Get listed and start showing up in results.</p>
              <ul className={styles.features}>
                {freeFeatures.map((f) => (
                  <li key={f}><Check className={styles.checkFree} /> {f}</li>
                ))}
              </ul>
              <a className={`${styles.planCta} ${styles.planCtaGhost}`} href={SIGNUP}>Start free</a>
            </Reveal>

            <Reveal className={`${styles.planCard} ${styles.featured}`} delay={90}>
              <span className={styles.ribbon}>Most popular</span>
              <div className={styles.planName}>Paid</div>
              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>£{PAID}</span>
                <span className={styles.planPeriod}>/ month</span>
              </div>
              <p className={styles.planTagline}>
                Read every lead, reply first, and rank with the paid listings.
              </p>
              <ul className={styles.features}>
                {paidFeatures.map((f) => (
                  <li key={f}><Check className={styles.checkPaid} /> {f}</li>
                ))}
              </ul>
              <a className={`${styles.planCta} ${styles.planCtaPrimary}`} href={SIGNUP}>
                Get started <span className={styles.arrow}>→</span>
              </a>
            </Reveal>
          </div>
          <p className={styles.pricingNote}>
            £{PAID}/month, or £{annualPrice(TIER.PAID)}/year — two months free. Cancel any time;
            your listing stays up on the free tier rather than disappearing.
          </p>
        </section>

        {/* ── Straight up ── */}
        <section className={styles.honest}>
          <div className={styles.honestInner}>
            <Reveal>
              <p className={styles.sectionEyebrow}>Straight up</p>
              <h2 className={styles.sectionH2}>What Patch doesn’t do</h2>
              <p className={styles.honestBody}>
                Patch is discovery only. We don’t take payment, hold deposits, or get involved in
                the job itself — you agree terms directly with the client, and the contract is
                between you and them. We also don’t vet or verify listings, so clients may ask to
                see your licences, insurance or certifications.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className={styles.finalCta}>
          <div className={styles.finalInner}>
            <Reveal>
              <h2 className={styles.finalH2}>Your next booking is looking for you</h2>
              <p className={styles.finalSub}>
                Free to list, free to stay. Set up your profile in about two minutes — no card needed.
              </p>
              <a className={styles.btnOnDark} href={SIGNUP}>
                Create your listing <span className={styles.arrow}>→</span>
              </a>
              <p className={styles.finalEmail}>
                Questions? <a href="mailto:vendors@hireonpatch.com">vendors@hireonpatch.com</a>
              </p>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
