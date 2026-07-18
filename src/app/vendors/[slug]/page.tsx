export const dynamic = "force-dynamic";

import { cache } from "react";
import Image from "next/image";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { categoryPhoto } from "@/lib/categoryPhoto";
import Header from "@/components/layout/Header";
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

const getVendor = cache(async function getVendor(slug: string) {
  const { data } = await supabase
    .from("vendors")
    .select(`
      *,
      vendor_services ( id, category, attributes, title, description, price_from, price_to, position ),
      vendor_photos ( id, url, alt_text, position ),
      vendor_tag_assignments ( tag_id, tags ( slug, name, category ) ),
      reviews ( id, rating, title, body, event_date, details, verified, created_at ),
      vendor_coverage_areas ( postcode_district )
    `)
    .eq("slug", slug)
    .eq("status", "live")
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
      vendor_services ( id, category, attributes, title, description, price_from, price_to, position ),
      vendor_photos ( id, url, alt_text, position ),
      vendor_tag_assignments ( tag_id, tags ( slug, name, category ) ),
      reviews ( id, rating, title, body, event_date, details, verified, created_at ),
      vendor_coverage_areas ( postcode_district )
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
  const desc =
    (vendor.description as string) ||
    `${vendor.name} — mobile food & catering in London on Patch.`;

  return {
    title: vendor.name as string,
    description: desc.slice(0, 160),
    alternates: { canonical: `/vendors/${slug}` },
    openGraph: {
      type: "profile",
      title: `${vendor.name} · Patch`,
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

  const photos = (vendor.vendor_photos as Record<string, unknown>[]) || [];
  const sortedPhotos = [...photos].sort((a, b) => (a.position as number) - (b.position as number));
  const services = ((vendor.vendor_services as Record<string, unknown>[]) || [])
    .sort((a, b) => (a.position as number) - (b.position as number));
  const tagAssignments = (vendor.vendor_tag_assignments as Record<string, unknown>[]) || [];
  const reviews = ((vendor.reviews as Record<string, unknown>[]) || [])
    .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
  const coverageAreas = (vendor.vendor_coverage_areas as Record<string, unknown>[]) || [];

  const credentials = tagAssignments.filter((ta) => {
    const tag = ta.tags as Record<string, unknown>;
    return tag.category === "credential";
  });
  const otherTags = tagAssignments.filter((ta) => {
    const tag = ta.tags as Record<string, unknown>;
    return tag.category !== "credential";
  });

  const categories = [...new Set(services.map((s) => s.category as string).filter(Boolean))];
  const category = categories.slice(0, 2).join(" · ") || "Mobile catering";
  const heroFallback = categoryPhoto(categories[0], 1200);

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
  const capMin = vendor.typical_event_size_min as number | null;
  const capMax = vendor.typical_event_size_max as number | null;
  const years = vendor.years_active as number | null;
  const rating = (vendor.rating_avg as number) || 0;
  const reviewCount = (vendor.review_count as number) || 0;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: vendor.name as string,
    description: (vendor.description as string) || undefined,
    image: sortedPhotos.length ? sortedPhotos.map((p) => p.url as string) : [heroFallback],
    servesCuisine: categories,
    url: `${SITE}/vendors/${slug}`,
    areaServed: "London",
    address: {
      "@type": "PostalAddress",
      addressLocality: "London",
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
            reviewRating: { "@type": "Rating", ratingValue: r.rating as number, bestRating: 5 },
            reviewBody: (r.body as string) || (r.title as string) || undefined,
            datePublished: (r.created_at as string)?.slice(0, 10),
          })),
        }
      : {}),
  };

  const glance: { label: string; value: string; sub?: string }[] = [];
  if (capMax) glance.push({ label: "Serves", value: capMin ? `${capMin}–${capMax}` : `up to ${capMax}`, sub: "guests" });
  if (vendor.coverage_radius_miles) glance.push({ label: "Covers", value: `${vendor.coverage_radius_miles} mi`, sub: vendor.base_postcode as string });
  if (years) glance.push({ label: "Trading", value: `${years} yr${years > 1 ? "s" : ""}` });
  if (rating > 0) glance.push({ label: "Rated", value: rating.toFixed(1), sub: `${reviewCount} review${reviewCount !== 1 ? "s" : ""}` });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
              <span>{vendor.base_postcode as string}</span>
              {vendor.coverage_radius_miles && (
                <>
                  <span className={styles.metaDot}>·</span>
                  <span>Covers {vendor.coverage_radius_miles as number} miles</span>
                </>
              )}
              {credentials.length > 0 && (
                <>
                  <span className={styles.metaDot}>·</span>
                  {credentials.map((ta) => {
                    const tag = ta.tags as Record<string, unknown>;
                    return (
                      <span key={tag.slug as string} className={styles.verified}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/></svg>
                        {tag.name as string}
                      </span>
                    );
                  })}
                </>
              )}
            </div>

            {(vendor.rating_avg as number) > 0 && (
              <div className={styles.rating}>
                <span className={styles.stars}>
                  <Star />
                  {(vendor.rating_avg as number).toFixed(2)}
                </span>
                <span className={styles.ratingCount}>({vendor.review_count as number} reviews)</span>
              </div>
            )}

            <p className={styles.desc}>{vendor.description as string}</p>

            <div className={styles.tags}>
              {credentials.map((ta) => {
                const tag = ta.tags as Record<string, unknown>;
                return (
                  <span key={tag.slug as string} className={styles.tagGood}><Check />{tag.name as string}</span>
                );
              })}
              {otherTags.map((ta) => {
                const tag = ta.tags as Record<string, unknown>;
                return (
                  <span key={tag.slug as string} className={styles.tag}>{tag.name as string}</span>
                );
              })}
            </div>

            <div className={styles.ctaRow}>
              <EnquiryButton
                vendorId={vendor.id as string}
                vendorName={vendor.name as string}
                className={styles.ctaPrimary}
              />
              {vendor.website && (
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
          <div className={styles.glance}>
            {glance.map((g) => (
              <div key={g.label} className={styles.glanceStat}>
                <span className={styles.glanceLabel}>{g.label}</span>
                <span className={styles.glanceValue}>{g.value}</span>
                {g.sub && <span className={styles.glanceSub}>{g.sub}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.body}>
        <div>
          {/* Dietary */}
          {dietary.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Dietary options</h2>
              <div className={styles.dietRow}>
                {dietary.map((d) => (
                  <span key={d} className={styles.dietChip}><Check />{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                ))}
              </div>
            </div>
          )}

          {/* Signature dishes */}
          {signatureItems.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Signature dishes</h2>
              <div className={styles.dishList}>
                {signatureItems.map((s) => <span key={s} className={styles.dish}>{s}</span>)}
              </div>
            </div>
          )}

          {/* Services */}
          {services.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Services ({services.length})</h2>
              {services.map((s) => (
                <div key={s.id as string} className={styles.serviceCard}>
                  <div className={styles.serviceHeader}>
                    <div className={styles.serviceTitle}>{s.title as string}</div>
                    {(s.price_from as number | null) != null && (
                      <div className={styles.servicePrice}>
                        £{s.price_from as number}{(s.price_to as number | null) != null ? `–£${s.price_to}` : "+"}
                      </div>
                    )}
                  </div>
                  {(s.description as string | null) && (
                    <div className={styles.serviceDesc}>{s.description as string}</div>
                  )}
                  <div className={styles.serviceMeta}>
                    {Object.entries((s.attributes as Record<string, unknown>) ?? {})
                      .filter(([, v]) => v != null && v !== "" && !Array.isArray(v))
                      .slice(0, 3)
                      .map(([k, v]) => (
                        <span key={k}>{k.replace(/_/g, " ")}: {String(v)}</span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className={styles.section}>
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
            </div>
          )}

          {/* Bio */}
          {vendor.bio && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>About {vendor.name as string}</h2>
              <p className={styles.desc}>{vendor.bio as string}</p>
            </div>
          )}

          {/* FAQ */}
          {faq.filter((f) => f.q && f.a).length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Frequently asked</h2>
              {faq.filter((f) => f.q && f.a).map((f, i) => (
                <div key={i} className={styles.faqItem}>
                  <div className={styles.faqQ}>{f.q}</div>
                  <div className={styles.faqA}>{f.a}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sideCard}>
          {vendor.price_from && (
            <>
              <div className={styles.sidePrice}>From</div>
              <div className={styles.sidePriceAmount}>£{vendor.price_from as number}</div>
              <div className={styles.sidePriceUnit}>
                {services.length > 0 ? (services[0].title as string) : ""}
              </div>
            </>
          )}

          <EnquiryButton
            vendorId={vendor.id as string}
            vendorName={vendor.name as string}
            className={styles.sideCtaPrimary}
          />
          {vendor.contact_phone && (
            <a href={`tel:${vendor.contact_phone as string}`} className={styles.sideCtaSecondary}>
              Call {vendor.contact_phone as string}
            </a>
          )}

          <div style={{ marginTop: 20 }}>
            {vendor.base_postcode && (
              <div className={styles.sideDetail}>
                <span className={styles.sideDetailLabel}>Based in</span>
                <span className={styles.sideDetailValue}>{vendor.base_postcode as string}</span>
              </div>
            )}
            <div className={styles.sideDetail}>
              <span className={styles.sideDetailLabel}>Coverage</span>
              <span className={styles.sideDetailValue}>
                {coverageAreas.length > 0
                  ? coverageAreas.map((a) => a.postcode_district as string).join(", ")
                  : `${vendor.coverage_radius_miles} miles`}
              </span>
            </div>
            <div className={styles.sideDetail}>
              <span className={styles.sideDetailLabel}>Services</span>
              <span className={styles.sideDetailValue}>{services.length}</span>
            </div>
            {(vendor.review_count as number) > 0 && (
              <div className={styles.sideDetail}>
                <span className={styles.sideDetailLabel}>Reviews</span>
                <span className={styles.sideDetailValue}>{vendor.review_count as number}</span>
              </div>
            )}
          </div>

          {(vendor.website || vendor.instagram) && (
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
        {vendor.price_from && (
          <span className={styles.stickyPrice}>from £{vendor.price_from as number}</span>
        )}
        <EnquiryButton
          vendorId={vendor.id as string}
          vendorName={vendor.name as string}
          className={styles.stickyCta}
        />
      </div>
    </>
  );
}
