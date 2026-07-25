import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import { supabase } from "@/lib/supabase";
import { safeJsonLd } from "@/lib/sanitize";
import { categoryPhoto } from "@/lib/categoryPhoto";
import {
  SERVICE_CATEGORIES, LONDON_AREAS, findCategory, findArea,
  type ServiceCategory, type LondonArea,
} from "@/lib/serviceAreas";
import styles from "./page.module.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
export const revalidate = 86400; // rebuild daily
export const dynamicParams = true; // long-tail combos render on demand + cache

interface AreaVendor {
  vendor_id: string; slug: string; name: string; description: string | null;
  area: string | null; base_postcode: string | null; rating_avg: number | null;
  review_count: number | null; tier: number; price_from: number | null;
  service_title: string | null; distance_miles: number | null;
}

async function getVendors(cat: ServiceCategory, area: LondonArea): Promise<AreaVendor[]> {
  const { data, error } = await supabase.rpc("vendors_in_area", {
    p_category: cat.name, p_lat: area.lat, p_lng: area.lng, p_limit: 24,
  });
  if (error) { console.error("[services] vendors_in_area failed:", error.message); return []; }
  return (data as AreaVendor[]) ?? [];
}

// Every category × area is a valid page; the long tail renders on demand.
export function generateStaticParams() {
  return SERVICE_CATEGORIES.flatMap((c) =>
    LONDON_AREAS.map((a) => ({ category: c.slug, location: a.slug })),
  );
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string; location: string }> },
): Promise<Metadata> {
  const { category, location } = await params;
  const cat = findCategory(category);
  const area = findArea(location);
  if (!cat || !area) return { title: "Not found" };

  const vendors = await getVendors(cat, area);
  const where = area.slug === "london" ? "London" : `${area.name}, London`;
  const title = `${cat.name} catering in ${where}`;
  const description = vendors.length
    ? `${vendors.length} ${cat.plural} serving ${where}. Compare prices, availability and reviews, or describe your occasion for an AI-matched shortlist.`
    : `Find ${cat.plural} near ${where} on Patch — describe your occasion for an AI-matched shortlist.`;

  return {
    title,
    description,
    alternates: { canonical: `/services/${cat.slug}/${area.slug}` },
    // Thin/empty combos shouldn't be indexed.
    robots: vendors.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: { title: `${title} · Patch`, description, url: `/services/${cat.slug}/${area.slug}` },
  };
}

function money(n: number | null): string | null {
  return n != null ? `£${n}` : null;
}

export default async function ServiceLocationPage(
  { params }: { params: Promise<{ category: string; location: string }> },
) {
  const { category, location } = await params;
  const cat = findCategory(category);
  const area = findArea(location);
  if (!cat || !area) return notFound();

  const vendors = await getVendors(cat, area);
  const where = area.slug === "london" ? "London" : `${area.name}, London`;
  const inWhere = area.slug === "london" ? "London" : area.name;
  const prices = vendors.map((v) => v.price_from).filter((p): p is number => p != null);
  const fromPrice = prices.length ? Math.min(...prices) : null;

  // ── Structured data: ItemList of the ranked vendors, a breadcrumb trail, and
  // an FAQ — the three things answer engines lift for a "[service] in [place]" query.
  const itemListJsonLd = vendors.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${cat.name} catering in ${where}`,
        numberOfItems: vendors.length,
        itemListElement: vendors.map((v, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "LocalBusiness",
            name: v.name,
            url: `${SITE}/vendors/${v.slug}`,
            ...(v.rating_avg && v.review_count
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(v.rating_avg).toFixed(2), reviewCount: v.review_count } }
              : {}),
          },
        })),
      }
    : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Patch", item: SITE },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services` },
      { "@type": "ListItem", position: 3, name: cat.name, item: `${SITE}/services/${cat.slug}/london` },
      { "@type": "ListItem", position: 4, name: where, item: `${SITE}/services/${cat.slug}/${area.slug}` },
    ],
  };

  const faq = vendors.length
    ? [
        {
          q: `How many ${cat.plural} serve ${inWhere}?`,
          a: `${vendors.length} ${cat.plural} on Patch currently cover ${where}, ranked by fit and rating.`,
        },
        {
          q: `How much does ${cat.name.toLowerCase()} catering cost in ${inWhere}?`,
          a: fromPrice != null
            ? `Listings serving ${where} start from around £${fromPrice}. Most quote per head or per event, so the total depends on guest count and menu.`
            : `Pricing is quoted per head or per event and depends on guest count and menu. Enquire for a quote.`,
        },
        {
          q: `Can I book ${cat.name.toLowerCase()} for an event in ${inWhere}?`,
          a: `Yes. Describe your occasion — date, guests, budget — and Patch returns an AI-matched shortlist of ${cat.plural} available around ${where}.`,
        },
      ]
    : [];
  const faqJsonLd = faq.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    : null;

  const otherAreas = LONDON_AREAS.filter((a) => a.slug !== area.slug && a.slug !== "london").slice(0, 8);
  const otherCats = SERVICE_CATEGORIES.filter((c) => c.slug !== cat.slug).slice(0, 8);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {itemListJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />}
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />}
      <Header />
      <main id="main-content" className={styles.wrap}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Patch</Link> <span aria-hidden="true">›</span>{" "}
          <Link href={`/services/${cat.slug}/london`}>{cat.name}</Link> <span aria-hidden="true">›</span>{" "}
          <span>{where}</span>
        </nav>

        <h1 className={styles.h1}>{cat.name} catering in {where}</h1>
        <p className={styles.lede}>
          {vendors.length > 0 ? (
            <>
              <strong>{vendors.length} {cat.plural}</strong> serve {where}
              {fromPrice != null ? <>, from around <strong>£{fromPrice}</strong></> : null}. Compare
              them below, or <Link href={`/search?q=${encodeURIComponent(`${cat.name} in ${inWhere}`)}`}>describe your occasion</Link> for an AI-matched shortlist.
            </>
          ) : (
            <>
              No {cat.plural} are listed for {where} just yet.{" "}
              <Link href={`/search?q=${encodeURIComponent(`${cat.name} in ${inWhere}`)}`}>Try an AI search</Link> or browse a nearby area below.
            </>
          )}
        </p>

        {vendors.length > 0 && (
          <ul className={styles.grid}>
            {vendors.map((v) => (
              <li key={v.vendor_id} className={styles.card}>
                <Link href={`/vendors/${v.slug}`} className={styles.cardLink}>
                  <div className={styles.thumb}>
                    <Image src={categoryPhoto(cat.name, 480)} alt={`${v.name} — ${cat.name}`} fill sizes="(max-width: 700px) 100vw, 340px" style={{ objectFit: "cover" }} />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardName}>{v.name}</div>
                    <div className={styles.cardMeta}>
                      {[
                        v.rating_avg ? `${Number(v.rating_avg).toFixed(1)}★ (${v.review_count ?? 0})` : "New",
                        v.area || null,
                        money(v.price_from) ? `from ${money(v.price_from)}` : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    {v.description && <p className={styles.cardDesc}>{v.description}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {faq.length > 0 && (
          <section className={styles.faq}>
            <h2 className={styles.h2}>{cat.name} catering in {inWhere} — common questions</h2>
            <dl className={styles.faqList}>
              {faq.map((f) => (
                <div key={f.q} className={styles.faqItem}>
                  <dt className={styles.faqQ}>{f.q}</dt>
                  <dd className={styles.faqA}>{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className={styles.links}>
          <div>
            <h2 className={styles.h3}>{cat.name} in other areas</h2>
            <div className={styles.pills}>
              {otherAreas.map((a) => (
                <Link key={a.slug} href={`/services/${cat.slug}/${a.slug}`} className={styles.pill}>{a.name}</Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className={styles.h3}>Other catering in {inWhere}</h2>
            <div className={styles.pills}>
              {otherCats.map((c) => (
                <Link key={c.slug} href={`/services/${c.slug}/${area.slug}`} className={styles.pill}>{c.name}</Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
