export const dynamic = "force-dynamic";

import { safeJsonLd } from "@/lib/sanitize";
import { formatLocation } from "@/lib/location";
import { cache } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { categoryPhoto } from "@/lib/categoryPhoto";
import { showsRating } from "@/lib/rating";
import { SERVICE_CATEGORIES } from "@/lib/serviceAreas";
import Header from "@/components/layout/Header";
import Reveal from "@/components/Reveal";
import FaqAccordion from "@/components/FaqAccordion";
import EnquiryButton from "@/components/vendor/EnquiryForm";
import TrackProfileView from "@/components/vendor/TrackProfileView";
import TrackedLink from "@/components/vendor/TrackedLink";
import { notFound } from "next/navigation";
import styles from "./page.module.css";

const Star = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/></svg>
);

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Render a service's free-form attributes as human lines — never raw keys like
// "setting: either". Capacity is skipped here (it's in the glance bar).
function humanizeServiceAttrs(attrs: Record<string, unknown> | null): string[] {
  if (!attrs) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === "" || Array.isArray(v)) continue;
    if (k === "capacity_min" || k === "capacity_max") continue;
    if (k === "setting") {
      const s = String(v);
      out.push(s === "either" ? "Indoor or outdoor" : s === "indoor" ? "Indoor" : s === "outdoor" ? "Outdoor" : s);
      continue;
    }
    out.push(`${k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}: ${String(v)}`);
  }
  return out.slice(0, 4);
}

const getVendor = cache(async function getVendor(slug: string) {
  const { data } = await supabase
    .from("vendors")
    .select(`
      *,
      vendor_services ( id, category, attributes, title, description, price_from, position ),
      vendor_photos ( id, url, alt_text, position ),
      reviews ( id, rating, title, body, event_date, details, verified, created_at )
    `)
    .eq("slug", slug)
    .eq("status", "live")
    // Cap the nested reviews — the page renders the most recent and JSON-LD uses 5.
    .order("created_at", { referencedTable: "reviews", ascending: false })
    .limit(30, { referencedTable: "reviews" })
    .single();

  return data;
});

/**
 * Preview mode. A draft listing is invisible to the public (RLS only exposes
 * status='live'), so an owner checking their work would otherwise get a 404.
 * This reads through the *authenticated* client, so RLS still decides: it
 * returns a row only if the caller actually owns it.
 */
async function getOwnPreview(slug: string) {
  const authed = await createServerClient();
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return null;

  const { data } = await authed
    .from("vendors")
    .select(`
      *,
      vendor_services ( id, category, attributes, title, description, price_from, position ),
      vendor_photos ( id, url, alt_text, position ),
      reviews ( id, rating, title, body, event_date, details, verified, created_at )
    `)
    .eq("slug", slug)
    .eq("owner_id", user.id)
    .maybeSingle();

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await getVendor(slug);
  if (!vendor) return { title: "Vendor not found" };

  const photos = (vendor.vendor_photos as { url: string; position: number }[]) || [];
  const hero = [...photos].sort((a, b) => a.position - b.position)[0]?.url;
  const cat = (vendor.primary_category as string) || null;
  const area = (vendor.area as string) || "London";
  const desc =
    (vendor.description as string) ||
    `${vendor.name}${cat ? ` — ${cat}` : ""} in ${area}, on Patch.`;
  // Title captures the long-tail "[service] in [area]" query on the highest-
  // volume page type, not just the bare business name.
  const title = `${vendor.name}${cat ? ` — ${cat}` : ""} in ${area}`;

  return {
    title,
    description: desc.slice(0, 160),
    alternates: { canonical: `/vendors/${slug}` },
    openGraph: {
      type: "profile",
      title: `${title} · Patch`,
      description: desc.slice(0, 200),
      url: `/vendors/${slug}`,
      images: hero ? [{ url: hero }] : undefined,
    },
  };
}

export default async function VendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";

  let vendor = await getVendor(slug);
  // Only reach for the owner view if the public one found nothing — a live
  // listing previews through exactly the same path a buyer sees.
  if (!vendor && isPreview) vendor = await getOwnPreview(slug);

  if (!vendor) return notFound();

  const previewing = isPreview && vendor.status !== "live";
  // Only show outbound contact links (website / Instagram / phone) once a vendor
  // has claimed their listing — unclaimed seed listings carry placeholder
  // details, and a dead "Visit website" link reads as "this is fake".
  const claimed = !!vendor.owner_id;

  const photos = (vendor.vendor_photos as Record<string, unknown>[]) || [];
  const sortedPhotos = [...photos].sort((a, b) => (a.position as number) - (b.position as number));
  const services = ((vendor.vendor_services as Record<string, unknown>[]) || [])
    .sort((a, b) => (a.position as number) - (b.position as number));
  // Price lives on the service now — the sidebar "from" is the cheapest service.
  // Track the whole service so the caption names the one the price came from
  // (not just services[0], which need not be the cheapest).
  const cheapestService = services
    .filter((s) => (s.price_from as number | null) != null)
    .sort((a, b) => (a.price_from as number) - (b.price_from as number))[0] ?? null;
  const priceFrom = (cheapestService?.price_from as number | null) ?? null;
  const reviews = ((vendor.reviews as Record<string, unknown>[]) || [])
    .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());


  const categories = [...new Set(services.map((s) => s.category as string).filter(Boolean))];
  const category = categories.slice(0, 2).join(" · ") || "Local service";
  const heroFallback = categoryPhoto(categories[0], 1200, vendor.slug as string);

  // Attributes are free-form and vertical-specific — merge vendor- and
  // service-level, and render whatever is there without knowing what it means.
  const attributes: Record<string, unknown> = {
    ...((vendor.attributes as Record<string, unknown>) ?? {}),
    ...((services[0]?.attributes as Record<string, unknown>) ?? {}),
  };
  // Free-form data: filter to strings rather than trusting the shape.
  const dietary = (Array.isArray(attributes.dietary) ? attributes.dietary : [])
    .filter((d): d is string => typeof d === "string" && d.length > 0);
  const signatureItems = ((Array.isArray(vendor.signature_items) ? vendor.signature_items : []) as unknown[])
    .map((s) => (typeof s === "string" ? s : (s as { name?: string })?.name))
    .filter(Boolean) as string[];
  const faq = (Array.isArray(vendor.faq) ? vendor.faq : []) as { q?: string; a?: string }[];
  // Capacity lives in the service's attributes (its single source of truth),
  // not on the vendor row.
  const svcAttrs = (services[0]?.attributes as Record<string, unknown>) ?? {};
  const capMin = (svcAttrs.capacity_min as number | null) ?? null;
  const capMax = (svcAttrs.capacity_max as number | null) ?? null;
  const years = vendor.years_active as number | null;
  const rating = (vendor.rating_avg as number) || 0;
  const reviewCount = (vendor.review_count as number) || 0;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hireonpatch.com";
  const jsonLd = {
    "@context": "https://schema.org",
    // LocalBusiness, not FoodEstablishment: the platform is horizontal, and a
    // wrong schema type costs rich results for every non-food vertical.
    "@type": "LocalBusiness",
    name: vendor.name as string,
    description: (vendor.description as string) || undefined,
    image: sortedPhotos.length ? sortedPhotos.map((p) => p.url as string) : [heroFallback],
    knowsAbout: categories,
    url: `${SITE}/vendors/${slug}`,
    areaServed: "London",
    address: {
      "@type": "PostalAddress",
      addressLocality: (vendor.area as string) || "London",
      postalCode: (vendor.base_postcode as string) || undefined,
      addressCountry: "GB",
    },
    priceRange: (vendor.price_range as string) || "££",
    ...(rating > 0 && reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(2),
            reviewCount: reviewCount,
          },
        }
      : {}),
    ...(reviews.length
      ? {
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: "Patch client" },
            reviewRating: { "@type": "Rating", ratingValue: r.rating as number, bestRating: 5 },
            reviewBody: (r.body as string) || (r.title as string) || undefined,
            datePublished: (r.created_at as string)?.slice(0, 10),
          })),
        }
      : {}),
    // Priced services are machine-readable offers.
    ...(services.some((s) => (s.price_from as number | null) != null)
      ? {
          makesOffer: services
            .filter((s) => (s.price_from as number | null) != null)
            .map((s) => ({
              "@type": "Offer",
              name: s.title as string,
              priceCurrency: "GBP",
              price: s.price_from as number,
              ...(s.category ? { category: s.category as string } : {}),
            })),
        }
      : {}),
  };

  // FAQ rich results / AI-answer extraction — only when there are real Q/A pairs.
  const faqPairs = faq.filter((f) => f.q && f.a);
  const faqJsonLd = faqPairs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqPairs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  // Breadcrumb ties the profile into the Services → Category hierarchy (rich
  // snippet + it tells engines where this vendor sits). Links to the category
  // landing page when we have a matching slug.
  const catSlug = SERVICE_CATEGORIES.find((c) => c.name === vendor.primary_category)?.slug;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Patch", item: SITE },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/services` },
      ...(catSlug
        ? [{ "@type": "ListItem", position: 3, name: vendor.primary_category as string, item: `${SITE}/services/${catSlug}/london` }]
        : []),
      { "@type": "ListItem", position: catSlug ? 4 : 3, name: vendor.name as string, item: `${SITE}/vendors/${slug}` },
    ],
  };

  const glance: { label: string; value: string; sub?: string }[] = [];
  if (capMax) glance.push({ label: "Serves", value: capMin ? `${capMin}–${capMax}` : `up to ${capMax}`, sub: "guests" });
  if (vendor.coverage_radius_miles) glance.push({ label: "Covers", value: `${vendor.coverage_radius_miles} mi`, sub: formatLocation(vendor.area as string | null, vendor.base_postcode as string | null) ?? undefined });
  if (years) glance.push({ label: "Trading", value: `${years} yr${years > 1 ? "s" : ""}` });
  // Only show a score once there are enough reviews to mean something (see rating.ts).
  const hasRating = showsRating(reviewCount);
  if (hasRating) glance.push({ label: "Rated", value: rating.toFixed(1), sub: `${reviewCount} review${reviewCount !== 1 ? "s" : ""}` });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />}
      {!isPreview && <TrackProfileView vendorId={vendor.id as string} slug={slug} />}
      <Header />

      {previewing && (
        <div className={styles.previewBanner} role="status">
          <strong>Preview.</strong> This is how your listing will look to buyers. It&apos;s still a
          draft — publish it from your dashboard to make it findable.
          <a href="/vendor/dashboard" className={styles.previewBannerLink}>Back to dashboard</a>
        </div>
      )}

      <main id="main-content">
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.gallery}>
            {sortedPhotos.length > 0 ? (
              <>
                <div className={styles.mainPhotoWrap}>
                  <Image
                    className={styles.mainPhoto}
                    src={sortedPhotos[0].url as string}
                    alt={(sortedPhotos[0].alt_text as string) || (vendor.name as string)}
                    fill
                    sizes="(max-width: 900px) 100vw, 800px"
                    priority
                  />
                </div>
                {sortedPhotos.length > 1 && (
                  <div className={styles.thumbs}>
                    {sortedPhotos.slice(1, 5).map((p) => (
                      <Image
                        key={p.id as string}
                        className={styles.thumb}
                        src={p.url as string}
                        alt={(p.alt_text as string) || ""}
                        width={72}
                        height={52}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.mainPhotoWrap}>
                <Image
                  className={styles.mainPhoto}
                  src={heroFallback}
                  alt={vendor.name as string}
                  fill
                  sizes="(max-width: 900px) 100vw, 800px"
                  priority
                />
              </div>
            )}
          </div>

          <div className={styles.heroBody}>
            <a href="/search" className={styles.backLink} data-tap-row>← Back to results</a>
            <div className={styles.category}>{category}</div>
            <h1 className={styles.name}>{vendor.name as string}</h1>

            <div className={styles.meta}>
              <span>{formatLocation(vendor.area as string | null, vendor.base_postcode as string | null)}</span>
              {vendor.coverage_radius_miles && (
                <>
                  <span className={styles.metaDot}>·</span>
                  <span>Covers {vendor.coverage_radius_miles as number} miles</span>
                </>
              )}
            </div>

            {hasRating ? (
              <div className={styles.rating}>
                <span className={styles.stars}>
                  <Star />
                  {(vendor.rating_avg as number).toFixed(2)}
                </span>
                <span className={styles.ratingCount}>({vendor.review_count as number} reviews)</span>
              </div>
            ) : (
              <div className={styles.rating}>
                <span className={styles.ratingCount}>New to Patch</span>
              </div>
            )}

            <p className={styles.desc}>{vendor.description as string}</p>


            <div className={styles.ctaRow}>
              <EnquiryButton
                vendorId={vendor.id as string}
                vendorName={vendor.name as string}
                className={styles.ctaPrimary}
                claimed={claimed}
              />
              {claimed && vendor.website && (
                <TrackedLink
                  vendorId={vendor.id as string}
                  event="visit_website"
                  href={vendor.website as string}
                  className={styles.ctaSecondary}
                >
                  Visit website
                </TrackedLink>
              )}
            </div>
          </div>
        </div>
      </section>

      {glance.length > 0 && (
        <div className={styles.glanceWrap}>
          <Reveal className={styles.glance}>
            {glance.map((g) => (
              <div key={g.label} className={styles.glanceStat}>
                <span className={styles.glanceLabel}>{g.label}</span>
                <span className={styles.glanceValue}>{g.value}</span>
                {g.sub && <span className={styles.glanceSub}>{g.sub}</span>}
              </div>
            ))}
          </Reveal>
        </div>
      )}

      <div className={styles.body}>
        <div>
          {/* Dietary */}
          {dietary.length > 0 && (
            <Reveal className={styles.section}>
              <h2 className={styles.sectionTitle}>Dietary options</h2>
              <div className={styles.dietRow}>
                {dietary.map((d) => (
                  <span key={d} className={styles.dietChip}><Check />{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                ))}
              </div>
            </Reveal>
          )}

          {/* Signature offerings */}
          {signatureItems.length > 0 && (
            <Reveal className={styles.section}>
              <h2 className={styles.sectionTitle}>Signature offerings</h2>
              <div className={styles.dishList}>
                {signatureItems.map((s) => <span key={s} className={styles.dish}>{s}</span>)}
              </div>
            </Reveal>
          )}

          {/* Services — only when a vendor lists more than one. For a single
              service the header, glance bar and sidebar already say everything;
              a card here would just repeat it (and leak raw attribute keys). */}
          {services.length > 1 && (
            <Reveal className={styles.section}>
              <h2 className={styles.sectionTitle}>Services ({services.length})</h2>
              {services.map((s) => (
                <div key={s.id as string} className={styles.serviceCard}>
                  <div className={styles.serviceHeader}>
                    <div className={styles.serviceTitle}>{s.title as string}</div>
                    {(s.price_from as number | null) != null && (
                      <div className={styles.servicePrice}>from £{s.price_from as number}</div>
                    )}
                  </div>
                  {(s.description as string | null) && (
                    <div className={styles.serviceDesc}>{s.description as string}</div>
                  )}
                  <div className={styles.serviceMeta}>
                    {humanizeServiceAttrs(s.attributes as Record<string, unknown> | null).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </Reveal>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <Reveal className={styles.section}>
              <h2 className={styles.sectionTitle}>Reviews ({reviews.length})</h2>
              {reviews.map((r) => (
                <div key={r.id as string} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewStars}>
                      {Array.from({ length: r.rating as number }).map((_, i) => (
                        <Star key={i} />
                      ))}
                    </div>
                    <div className={styles.reviewDate}>
                      {r.verified ? <span className={styles.verifiedReview}><Check />Verified booking</span> : null}
                      {new Date(r.created_at as string).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </div>
                  </div>
                  {(r.title as string | null) && <div className={styles.reviewTitle}>{r.title as string}</div>}
                  {(r.body as string | null) && <div className={styles.reviewBody}>{r.body as string}</div>}
                  <div className={styles.reviewMeta}>
                    {[

                      r.event_date ? `Event: ${new Date(r.event_date as string).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}` : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </Reveal>
          )}

          {/* Bio */}
          {vendor.bio && (
            <Reveal className={styles.section}>
              <h2 className={styles.sectionTitle}>About {vendor.name as string}</h2>
              <p className={styles.desc}>{vendor.bio as string}</p>
            </Reveal>
          )}

          {/* FAQ */}
          {faqPairs.length > 0 && (
            <Reveal className={styles.section}>
              <h2 className={styles.sectionTitle}>Frequently asked</h2>
              <FaqAccordion items={faqPairs.map((f) => ({ q: f.q as string, a: f.a as string }))} />
            </Reveal>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sideCard}>
          {priceFrom != null && (
            <>
              <div className={styles.sidePrice}>From</div>
              <div className={styles.sidePriceAmount}>£{priceFrom}</div>
              <div className={styles.sidePriceUnit}>
                {(cheapestService?.title as string) ?? ""}
              </div>
            </>
          )}

          <EnquiryButton
            vendorId={vendor.id as string}
            vendorName={vendor.name as string}
            className={styles.sideCtaPrimary}
            claimed={claimed}
          />
          {!claimed && (
            <p className={styles.unclaimedNote}>
              This listing hasn&apos;t been confirmed by the business yet. You can still
              enquire — we&apos;ll invite them to reply.
            </p>
          )}
          {claimed && vendor.contact_phone && (
            <a href={`tel:${vendor.contact_phone as string}`} className={styles.sideCtaSecondary}>
              Call {vendor.contact_phone as string}
            </a>
          )}

          <div style={{ marginTop: 20 }}>
            {vendor.base_postcode && (
              <div className={styles.sideDetail}>
                <span className={styles.sideDetailLabel}>Based in</span>
                <span className={styles.sideDetailValue}>{formatLocation(vendor.area as string | null, vendor.base_postcode as string | null)}</span>
              </div>
            )}
            <div className={styles.sideDetail}>
              <span className={styles.sideDetailLabel}>Coverage</span>
              <span className={styles.sideDetailValue}>
                {`${vendor.coverage_radius_miles} miles`}
              </span>
            </div>
            {services.length > 1 && (
              <div className={styles.sideDetail}>
                <span className={styles.sideDetailLabel}>Services</span>
                <span className={styles.sideDetailValue}>{services.length}</span>
              </div>
            )}
            {(vendor.review_count as number) > 0 && (
              <div className={styles.sideDetail}>
                <span className={styles.sideDetailLabel}>Reviews</span>
                <span className={styles.sideDetailValue}>{vendor.review_count as number}</span>
              </div>
            )}
          </div>

          {claimed && (vendor.website || vendor.instagram) && (
            <div className={styles.contactLinks}>
              {vendor.website && (
                <TrackedLink
                  vendorId={vendor.id as string}
                  event="visit_website"
                  href={vendor.website as string}
                  className={styles.contactLink} data-tap-row
                >
                  🌐 Website
                </TrackedLink>
              )}
              {vendor.instagram && (
                <TrackedLink
                  vendorId={vendor.id as string}
                  event="click_contact"
                  href={`https://instagram.com/${(vendor.instagram as string).replace("@", "")}`}
                  className={styles.contactLink} data-tap-row
                >
                  📸 {vendor.instagram as string}
                </TrackedLink>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© 2026 Patch · Local services worth booking</span>
          <span>
            <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
          </span>
        </div>
      </footer>
      </main>

      {/* Mobile: keep the primary action reachable while scrolling */}
      <div className={styles.stickyBar}>
        {priceFrom != null && (
          <span className={styles.stickyPrice}>from £{priceFrom}</span>
        )}
        <EnquiryButton
          vendorId={vendor.id as string}
          vendorName={vendor.name as string}
          className={styles.stickyCta}
          claimed={claimed}
        />
      </div>
    </>
  );
}
