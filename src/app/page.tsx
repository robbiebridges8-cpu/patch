import HeroSearch from "@/components/search/HeroSearch";
import styles from "./page.module.css";

const Star = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/></svg>
);

const Shield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/>
  </svg>
);

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function Home() {
  return (
    <>
      {/* ─── HERO ─── */}
      <section className={styles.hero}>
        <nav className={styles.heroNav}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoMark}>P</span>
            <span>Patch</span>
          </a>
          <div className={styles.navLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="/for-vendors">For vendors</a>
            <a href="/for-vendors" className={styles.navCta}>List your service</a>
          </div>
        </nav>

        <div className={styles.heroContent}>
          <div className={styles.heroLabel}>
            <span className={styles.heroLabelDot} />
            Now live across London
          </div>

          <h1 className={styles.heroH1}>
            Tell us the event.<br />
            We&apos;ll find <em>the food</em>.
          </h1>

          <p className={styles.heroSub}>
            Describe what you need in your own words — the occasion, the vibe, the
            guest count, the budget. Our AI matches you with mobile caterers and
            street food vendors who actually fit.
          </p>

          <HeroSearch />
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className={styles.stats}>
        <div className={styles.statsInner}>
          <div className={styles.stat}>
            <div className={styles.statNum}>74</div>
            <div className={styles.statLabel}>Vetted vendors</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>15</div>
            <div className={styles.statLabel}>Categories</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>4.9</div>
            <div className={styles.statLabel}>Average rating</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statNum}>London</div>
            <div className={styles.statLabel}>Wide coverage</div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className={styles.how}>
        <div className={styles.sectionLabel}>How it works</div>
        <h2 className={styles.sectionH2}>Skip the spreadsheet.<br />Just describe the event.</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <div className={styles.stepConnector} />
            <div className={styles.stepTitle}>Describe your event</div>
            <div className={styles.stepDesc}>
              Tell us the occasion, vibe, budget, guest count, and any dietary needs — in plain English. No filters to fiddle with.
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <div className={styles.stepConnector} />
            <div className={styles.stepTitle}>Get matched by AI</div>
            <div className={styles.stepDesc}>
              Patch reads your brief, understands what you actually need, and returns a shortlist of vendors ranked by fit — not by who paid the most.
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <div className={styles.stepTitle}>Book with confidence</div>
            <div className={styles.stepDesc}>
              Every vendor is reviewed by real clients. Read match notes explaining exactly why they fit your event, then get in touch directly.
            </div>
          </div>
        </div>
      </section>

      {/* ─── CATEGORIES ─── */}
      <section id="categories" className={styles.categories}>
        <div className={styles.categoriesInner}>
          <div className={styles.sectionLabel}>Browse by category</div>
          <h2 className={styles.sectionH2}>Every kind of event food, covered.</h2>
          <div className={styles.catGrid}>
            <a href="/search?q=pizza" className={styles.cat}>
              <div className={styles.catIcon}>🍕</div>
              <div className={styles.catName}>Pizza Vans</div>
              <div className={styles.catCount}>Wood-fired, sourdough, Neapolitan</div>
            </a>
            <a href="/search?q=burger" className={styles.cat}>
              <div className={styles.catIcon}>🍔</div>
              <div className={styles.catName}>Burger Trucks</div>
              <div className={styles.catCount}>Smash burgers, fried chicken, hot dogs</div>
            </a>
            <a href="/search?q=taco mexican" className={styles.cat}>
              <div className={styles.catIcon}>🌮</div>
              <div className={styles.catName}>Tacos &amp; Mexican</div>
              <div className={styles.catCount}>Tacos, burritos, birria, margaritas</div>
            </a>
            <a href="/search?q=bbq smoker" className={styles.cat}>
              <div className={styles.catIcon}>🔥</div>
              <div className={styles.catName}>BBQ &amp; Smoker</div>
              <div className={styles.catCount}>Brisket, ribs, pulled pork, fire cooking</div>
            </a>
            <a href="/search?q=grazing charcuterie cheese" className={styles.cat}>
              <div className={styles.catIcon}>🧀</div>
              <div className={styles.catName}>Grazing &amp; Cheese</div>
              <div className={styles.catCount}>Grazing tables, charcuterie, raclette</div>
            </a>
            <a href="/search?q=ice cream gelato" className={styles.cat}>
              <div className={styles.catIcon}>🍦</div>
              <div className={styles.catName}>Ice Cream &amp; Gelato</div>
              <div className={styles.catCount}>Gelato carts, soft serve, vintage vans</div>
            </a>
            <a href="/search?q=asian bao dumpling" className={styles.cat}>
              <div className={styles.catIcon}>🥟</div>
              <div className={styles.catName}>Asian Street Food</div>
              <div className={styles.catCount}>Bao, dumplings, noodles, Korean</div>
            </a>
            <a href="/search?q=coffee espresso" className={styles.cat}>
              <div className={styles.catIcon}>☕</div>
              <div className={styles.catName}>Coffee &amp; Cocktails</div>
              <div className={styles.catCount}>Mobile baristas, espresso martinis, gin bars</div>
            </a>
          </div>
        </div>
      </section>

      {/* ─── TRUST ─── */}
      <section className={styles.trust}>
        <div className={styles.sectionLabel}>Why people trust Patch</div>
        <h2 className={styles.sectionH2}>We do the vetting so you don&apos;t have to.</h2>
        <div className={styles.trustGrid}>
          <div className={styles.trustCard}>
            <div className={styles.trustIcon}><Shield /></div>
            <div className={styles.trustTitle}>Vetted vendors</div>
            <div className={styles.trustDesc}>
              Every vendor is checked before they go live — food hygiene ratings, public liability insurance, and real trading history.
            </div>
          </div>
          <div className={styles.trustCard}>
            <div className={styles.trustIcon}><Check /></div>
            <div className={styles.trustTitle}>Transparent pricing</div>
            <div className={styles.trustDesc}>
              No hidden fees. Every listing shows starting prices, per-head costs, and minimum spends so you can plan your budget honestly.
            </div>
          </div>
          <div className={styles.trustCard}>
            <div className={styles.trustIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className={styles.trustTitle}>Real reviews</div>
            <div className={styles.trustDesc}>
              Every review is from someone who actually booked the vendor. No anonymous ratings, no fake five-stars.
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className={styles.testimonials}>
        <div className={styles.testimonialsInner}>
          <div className={styles.sectionLabel}>What clients say</div>
          <h2 className={styles.sectionH2}>Don&apos;t take our word for it.</h2>
          <div className={styles.testimonialGrid}>
            <div className={styles.testimonial}>
              <div className={styles.testimonialStars}>
                <Star /><Star /><Star /><Star /><Star />
              </div>
              <div className={styles.testimonialText}>
                &ldquo;I typed &lsquo;wood-fired pizza for a garden wedding, 120 guests, under £2k&rsquo; and got three perfect options in seconds. Booked Dough & Co and they were incredible.&rdquo;
              </div>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>S</div>
                <div>
                  <div className={styles.testimonialName}>Sarah M.</div>
                  <div className={styles.testimonialMeta}>Wedding · Hackney · June 2026</div>
                </div>
              </div>
            </div>
            <div className={styles.testimonial}>
              <div className={styles.testimonialStars}>
                <Star /><Star /><Star /><Star /><Star />
              </div>
              <div className={styles.testimonialText}>
                &ldquo;Needed a vegan-friendly option for a corporate summer party. Patch found us Green Machine — 150 people fed, zero complaints, and the carnivores didn&apos;t even notice.&rdquo;
              </div>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>T</div>
                <div>
                  <div className={styles.testimonialName}>Tom R.</div>
                  <div className={styles.testimonialMeta}>Corporate event · Shoreditch · July 2026</div>
                </div>
              </div>
            </div>
            <div className={styles.testimonial}>
              <div className={styles.testimonialStars}>
                <Star /><Star /><Star /><Star /><Star />
              </div>
              <div className={styles.testimonialText}>
                &ldquo;Planning a 40th with 80 guests and no idea where to start. Patch was like texting a friend who knows every food truck in London. The match notes were brilliant.&rdquo;
              </div>
              <div className={styles.testimonialAuthor}>
                <div className={styles.testimonialAvatar}>R</div>
                <div>
                  <div className={styles.testimonialName}>Rachel K.</div>
                  <div className={styles.testimonialMeta}>40th birthday · Islington · April 2026</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VENDOR CTA ─── */}
      <section className={styles.vendorCta}>
        <div className={styles.vendorCtaInner}>
          <div>
            <div className={styles.sectionLabel} style={{ color: 'rgba(255,255,255,0.5)' }}>For vendors</div>
            <h2 className={styles.vendorCtaH2}>
              You make the food.<br />
              Let Patch <em>fill your calendar</em>.
            </h2>
            <p className={styles.vendorCtaDesc}>
              No commission. No lead fees. Just £20/month to be listed, matched, and
              reviewed. Clients come to you — pre-qualified, budget-ready, and looking
              for exactly what you cook.
            </p>
            <a href="/for-vendors" className={styles.vendorCtaBtn}>
              List your service
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
          </div>
          <div className={styles.vendorCtaPerks}>
            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              <div>
                <div className={styles.perkTitle}>£20/month, flat</div>
                <div className={styles.perkDesc}>No commission, no per-lead charges. List everything you offer for one simple price.</div>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                </svg>
              </div>
              <div>
                <div className={styles.perkTitle}>AI-matched enquiries</div>
                <div className={styles.perkDesc}>Clients find you because you actually fit their event — not because you gamed an algorithm.</div>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <div className={styles.perkTitle}>Verified reviews</div>
                <div className={styles.perkDesc}>Build a reputation that follows you. Every review is from a confirmed booking.</div>
              </div>
            </div>
            <div className={styles.perk}>
              <div className={styles.perkIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <div>
                <div className={styles.perkTitle}>Availability calendar</div>
                <div className={styles.perkDesc}>Block dates, set lead times, and only get enquiries for days you&apos;re actually free.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerBrand}>
              <span className={styles.logoMark}>P</span>
              Patch
            </div>
            <div className={styles.footerTagline}>Mobile food vendors worth booking.</div>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <h4>Find food</h4>
              <a href="#how-it-works">How it works</a>
              <a href="/search">Search</a>
              <a href="#categories">Browse categories</a>
            </div>
            <div className={styles.footerCol}>
              <h4>Vendors</h4>
              <a href="/for-vendors">List your service</a>
              <a href="/for-vendors#pricing">Pricing</a>
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
