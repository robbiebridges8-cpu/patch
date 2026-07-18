import styles from "../vendor.module.css";

export interface Analytics {
  days: number;
  views: number;
  views_prev: number;
  enquiries: number;
  enquiries_prev: number;
  enquiries_total: number;
  contact_clicks: number;
  saves: number;
  daily: { d: string; v: number }[];
}

/** "+40%" / "−12%" against the previous window, or null when there's no base. */
function delta(now: number, prev: number): { text: string; up: boolean } | null {
  if (prev === 0) return now > 0 ? { text: "new", up: true } : null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return null;
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`, up: pct > 0 };
}

function Metric({
  label, value, prev, hint, suffix,
}: {
  label: string;
  value: number;
  prev?: number;
  hint?: string;
  suffix?: string;
}) {
  const d = prev === undefined ? null : delta(value, prev);
  return (
    <div className={styles.metric}>
      <div className={styles.metricValue}>
        {value}{suffix}
        {d && (
          <span className={`${styles.metricDelta} ${d.up ? styles.deltaUp : styles.deltaDown}`}>
            {d.text}
          </span>
        )}
      </div>
      <div className={styles.metricLabel}>{label}</div>
      {hint && <div className={styles.metricHint}>{hint}</div>}
    </div>
  );
}

/** Bar-per-day view counts. Deliberately unlabelled — it's a shape, not a chart. */
function Sparkline({ daily }: { daily: { d: string; v: number }[] }) {
  if (daily.length === 0) return null;
  const max = Math.max(...daily.map((p) => p.v), 1);
  const total = daily.reduce((s, p) => s + p.v, 0);
  if (total === 0) return null;

  return (
    <div className={styles.spark} role="img" aria-label={`Daily profile views over the last ${daily.length} days`}>
      {daily.map((p) => (
        <div
          key={p.d}
          className={styles.sparkBar}
          style={{ height: `${Math.max((p.v / max) * 100, p.v > 0 ? 8 : 2)}%` }}
          title={`${new Date(p.d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: ${p.v} view${p.v !== 1 ? "s" : ""}`}
        />
      ))}
    </div>
  );
}

export default function AnalyticsCard({ data }: { data: Analytics | null }) {
  if (!data) return null;

  const { views, enquiries } = data;
  // Only meaningful once there's traffic to divide by.
  const rate = views > 0 ? Math.round((enquiries / views) * 100) : null;
  const noTraffic = views === 0 && enquiries === 0 && data.contact_clicks === 0;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Performance</span>
        <span className={styles.badge}>last {data.days} days</span>
      </div>

      {noTraffic ? (
        <div className={styles.empty}>
          No views yet. Once your listing is live and buyers start finding it, your traffic and
          enquiries will show up here.
        </div>
      ) : (
        <>
          <div className={styles.metricGrid}>
            <Metric label="Profile views" value={views} prev={data.views_prev} />
            <Metric
              label="Enquiries"
              value={enquiries}
              prev={data.enquiries_prev}
              hint={`${data.enquiries_total} all time`}
            />
            <Metric
              label="Contact clicks"
              value={data.contact_clicks}
              hint="website, phone, socials"
            />
            <Metric
              label="Enquiry rate"
              value={rate ?? 0}
              suffix="%"
              hint={rate === null ? "needs views" : "of views became enquiries"}
            />
          </div>
          <Sparkline daily={data.daily} />
        </>
      )}
    </div>
  );
}
