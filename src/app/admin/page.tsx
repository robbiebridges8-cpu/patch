export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";
import VendorAdminRow, { type AdminVendor } from "./VendorAdminRow";
import ReviewAdminRow, { type AdminReview } from "./ReviewAdminRow";
import styles from "./admin.module.css";

interface Stats {
  vendors_total: number;
  vendors_live: number;
  vendors_draft: number;
  vendors_paused: number;
  vendors_rejected: number;
  vendors_featured: number;
  vendors_claimed: number;
  enquiries_total: number;
  enquiries_30d: number;
  enquiries_booked: number;
  messages_total: number;
  reviews_total: number;
  reviews_hidden: number;
  reviews_30d: number;
  profiles_total: number;
  avg_rating: number | null;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {hint && <div className={styles.statHint}>{hint}</div>}
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/vendor/login?next=/admin");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    // Don't confirm the page exists to non-admins.
    redirect("/");
  }

  const { data: statsRaw } = await supabase.rpc("admin_stats");
  const stats = (statsRaw as Stats) || null;

  // Anything not live needs a decision, newest first.
  const { data: pendingRaw } = await supabase
    .from("vendors")
    .select("id, name, slug, status, featured, primary_category, owner_id, rating_avg, review_count, created_at")
    .neq("status", "live")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: featuredRaw } = await supabase
    .from("vendors")
    .select("id, name, slug, status, featured, primary_category, owner_id, rating_avg, review_count, created_at")
    .eq("featured", true)
    .order("name")
    .limit(50);

  const { data: reviewsRaw } = await supabase
    .from("reviews")
    .select("id, rating, title, body, hidden, verified, created_at, vendors(name, slug)")
    .order("created_at", { ascending: false })
    .limit(40);

  const pending = (pendingRaw as AdminVendor[]) || [];
  const featured = (featuredRaw as AdminVendor[]) || [];
  const reviews = ((reviewsRaw as unknown as (Omit<AdminReview, "vendor_name" | "vendor_slug"> & {
    vendors: { name: string; slug: string } | null;
  })[]) || []).map((r) => ({
    ...r,
    vendor_name: r.vendors?.name ?? "Unknown vendor",
    vendor_slug: r.vendors?.slug ?? "",
  }));

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        <h1 className={styles.h1}>Admin</h1>
        <p className={styles.sub}>Signed in as {user.email}</p>

        {stats && (
          <>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Platform</h2>
              <div className={styles.statGrid}>
                <Stat
                  label="Vendors live"
                  value={stats.vendors_live}
                  hint={`${stats.vendors_total} total · ${stats.vendors_claimed} claimed`}
                />
                <Stat
                  label="Awaiting review"
                  value={stats.vendors_draft}
                  hint={`${stats.vendors_paused} paused · ${stats.vendors_rejected} rejected`}
                />
                <Stat label="Featured" value={stats.vendors_featured} />
                <Stat
                  label="Enquiries (30d)"
                  value={stats.enquiries_30d}
                  hint={`${stats.enquiries_total} all time · ${stats.enquiries_booked} booked`}
                />
                <Stat label="Messages" value={stats.messages_total} />
                <Stat
                  label="Reviews (30d)"
                  value={stats.reviews_30d}
                  hint={`${stats.reviews_total} all time · ${stats.reviews_hidden} hidden`}
                />
                <Stat label="Avg rating" value={stats.avg_rating ?? "—"} />
                <Stat label="Accounts" value={stats.profiles_total} />
              </div>
            </section>
          </>
        )}

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Needs a decision ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className={styles.empty}>
              Nothing waiting — every listing is live. New self-serve listings land here as drafts.
            </p>
          ) : (
            pending.map((v) => <VendorAdminRow key={v.id} vendor={v} />)
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Featured ({featured.length})</h2>
          {featured.length === 0 ? (
            <p className={styles.empty}>
              No featured vendors yet. Feature one from the list above once it&apos;s live.
            </p>
          ) : (
            featured.map((v) => <VendorAdminRow key={v.id} vendor={v} />)
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Latest reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className={styles.empty}>No reviews yet.</p>
          ) : (
            reviews.map((r) => <ReviewAdminRow key={r.id} review={r} />)
          )}
        </section>
      </main>
    </>
  );
}
