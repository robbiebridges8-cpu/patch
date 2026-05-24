import type { VendorMatch } from "@/types/vendor";
import styles from "./VendorRow.module.css";

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const PhotoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <circle cx="9" cy="11" r="2"/>
    <path d="m21 17-5-5L7 21"/>
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/>
  </svg>
);

const StarIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/>
  </svg>
);

export default function VendorRow({ match }: { match: VendorMatch }) {
  const v = match.vendor;
  const cls = [styles.vendor, match.featured ? styles.featured : ""].filter(Boolean).join(" ");

  return (
    <article className={cls}>
      <div className={styles.photoWrap}>
        {match.featured && <span className={styles.photoTag}>Top match</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.photo} src={match.photoUrl} alt={v.name} />
        <span className={styles.photoCount}>
          <PhotoIcon />
          {match.photoCount} photos
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.cat}>{match.category}</div>
        <h2 className={styles.name}><a href={`/vendors/${v.slug}`} style={{ color: "inherit", textDecoration: "none" }}>{v.name}</a></h2>
        <div className={styles.meta}>
          {match.metaLine.split(" · ").map((segment, i, arr) => {
            const isVerified = segment.includes("verified") || segment.includes("insured") || segment.includes("hygiene");
            return (
              <span key={i}>
                {i > 0 && <span className={styles.dot}>· </span>}
                {isVerified ? (
                  <span className={styles.verified}>
                    <ShieldIcon />
                    {segment}
                  </span>
                ) : (
                  segment
                )}
              </span>
            );
          })}
        </div>

        {match.matchReason && (
          <div className={styles.match}>
            <span className={styles.matchIcon}>P</span>
            <div dangerouslySetInnerHTML={{ __html: match.matchReason }} />
          </div>
        )}

        <div className={styles.tags}>
          {match.matchedTags.map((t) =>
            t.good ? (
              <span key={t.label} className={styles.tagGood}>
                <CheckIcon />
                {t.label}
              </span>
            ) : (
              <span key={t.label} className={styles.tag}>{t.label}</span>
            )
          )}
        </div>
      </div>

      <div className={styles.priceCol}>
        <div>
          {match.rating > 0 ? (
            <div className={styles.rating}>
              <span className={styles.stars}>
                <StarIcon />
                {match.rating.toFixed(2)}
              </span>
              <span className={styles.count}>({match.bookingCount} reviews)</span>
            </div>
          ) : (
            <div className={styles.rating}>
              <span className={styles.count}>New vendor</span>
            </div>
          )}
          <div>
            <div className={styles.priceFrom}>From</div>
            <div className={styles.priceAmount}>{match.priceLabel}</div>
            <div className={styles.priceUnit}>{match.priceUnit}</div>
          </div>
        </div>
        <div>
          <a href={`/vendors/${v.slug}`} className={styles.cta}>View &amp; contact</a>
          <a href={`/vendors/${v.slug}`} className={styles.secondary}>
            View profile
          </a>
        </div>
      </div>
    </article>
  );
}
