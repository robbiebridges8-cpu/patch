import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { safeJsonLd } from "@/lib/sanitize";
import { SERVICE_CATEGORIES, LONDON_AREAS } from "@/lib/serviceAreas";
import styles from "./[category]/[location]/page.module.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hireonpatch.com";

export const metadata: Metadata = {
  title: "Browse local services in London",
  description:
    "Browse Patch by service and London area — caterers, coffee carts, mobile bars and more across every part of the city. Pick a category to see who serves your area.",
  alternates: { canonical: "/services" },
};

// A CollectionPage listing the service categories, so an engine can enumerate
// what Patch covers and follow into each category × area page.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  url: `${SITE}/services`,
  name: "Local services in London",
  isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website` },
  about: SERVICE_CATEGORIES.map((c) => ({ "@type": "Thing", name: c.name })),
};

const POPULAR_AREAS = LONDON_AREAS.filter((a) => a.slug !== "london").slice(0, 12);

export default function ServicesIndexPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <Header />
      <main id="main-content" className={styles.wrap}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Patch</Link> <span aria-hidden="true">›</span> <span>Services</span>
        </nav>
        <h1 className={styles.h1}>Local services across London</h1>
        <p className={styles.lede}>
          Browse by what you need and where you are, or{" "}
          <Link href="/search">describe your occasion</Link> and let Patch match you. Food and
          catering is live now, with {SERVICE_CATEGORIES.length} categories across every part of London.
        </p>

        <section className={styles.links} style={{ borderTop: "none", paddingTop: 0 }}>
          <div>
            <h2 className={styles.h3}>By category</h2>
            <div className={styles.pills}>
              {SERVICE_CATEGORIES.map((c) => (
                <Link key={c.slug} href={`/services/${c.slug}/london`} className={styles.pill}>{c.name}</Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className={styles.h3}>By area</h2>
            <div className={styles.pills}>
              {POPULAR_AREAS.map((a) => (
                <Link key={a.slug} href={`/services/pizza/${a.slug}`} className={styles.pill}>{a.name}</Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
