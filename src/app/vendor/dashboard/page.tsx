export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vendor dashboard",
  robots: { index: false, follow: false },
};

import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";
import EditListingForm from "./EditListingForm";
import CreateListingForm from "./CreateListingForm";
import PublishButton from "./PublishButton";
import PhotoManager from "./PhotoManager";
import AvailabilityManager from "./AvailabilityManager";
import LeadRow, { type Lead } from "./LeadRow";
import { redactLead } from "@/lib/leadRedaction";
import { type ThreadMessage } from "./MessageThread";
import BillingCard from "./BillingCard";
import AnalyticsCard, { type Analytics } from "./AnalyticsCard";
import CompletenessCard from "./CompletenessCard";
import NotificationsCard from "./NotificationsCard";
import { assessListing } from "@/lib/completeness";
import { canAccess, TIER, FREE_PHOTO_LIMIT } from "@/lib/tiers";
import { signOut } from "./actions";
import styles from "../vendor.module.css";

async function LeadsCard({ vendorId, tier }: { vendorId: string; tier: number }) {
  const supabase = await createClient();
  // Most-recent 50: a busy vendor accumulates enquiries without bound, and this
  // (plus every thread on them) renders in one RSC pass. The messages query below
  // is scoped to these leads, so bounding here bounds both.
  const { data } = await supabase
    .from("enquiries")
    .select("id, buyer_name, buyer_email, buyer_phone, event_date, postcode, details, message, status, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rawLeads = (data as Lead[]) || [];
  const newCount = rawLeads.filter((l) => l.status === "sent" || l.status === "viewed").length;
  const locked = !canAccess(tier, "unlock_leads");

  // Redact server-side (see redactLead) — the paywall lives in the RSC payload,
  // not in what's painted.
  const leads: Lead[] = rawLeads.map((l) => redactLead(l, locked));

  // One query for every thread on this vendor's leads (RLS scopes it to us).
  const { data: msgs } = leads.length && !locked
    ? await supabase
        .from("messages")
        .select("id, enquiry_id, sender, body, created_at, read_by_vendor")
        .in("enquiry_id", leads.map((l) => l.id))
        .order("created_at", { ascending: true })
    : { data: [] };

  const threads = new Map<string, ThreadMessage[]>();
  for (const m of (msgs as (ThreadMessage & { enquiry_id: string })[]) || []) {
    const list = threads.get(m.enquiry_id) || [];
    list.push(m);
    threads.set(m.enquiry_id, list);
  }
  const unreadCount = ((msgs as { sender: string; read_by_vendor: boolean }[]) || [])
    .filter((m) => m.sender === "buyer" && !m.read_by_vendor).length;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Enquiries ({leads.length})</span>
        {newCount > 0 && <span className={styles.badge}>{newCount} new</span>}
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount} unread {unreadCount === 1 ? "message" : "messages"}
          </span>
        )}
      </div>

      {leads.length === 0 ? (
        <div className={styles.empty}>No enquiries yet. They&apos;ll appear here the moment a client gets in touch.</div>
      ) : (
        leads.map((l) => (
          <LeadRow
            key={l.id}
            lead={l}
            thread={threads.get(l.id) ?? []}
            locked={locked}
          />
        ))
      )}
    </div>
  );
}

export default async function VendorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/vendor/dashboard&intent=vendor");

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, slug, description, bio, contact_email, contact_phone, website, instagram, coverage_radius_miles, attributes, signature_items, faq, status, primary_category, tier")
    .eq("owner_id", user.id)
    .maybeSingle();

  // These five reads are independent once we know the vendor — run them together
  // rather than in six sequential round-trips. Price lives on the service now
  // (1:1 today, so the vendor's one service).
  const todayIso = new Date().toISOString().slice(0, 10);
  const vid = vendor?.id as string | undefined;
  const [
    { data: service },
    { data: sub },
    { data: photos },
    { data: analytics },
    { data: blocked },
  ] = vendor
    ? await Promise.all([
        supabase.from("vendor_services").select("price_from, price_notes").eq("vendor_id", vid!).order("position", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("subscriptions").select("status, stripe_customer_id").eq("vendor_id", vid!).maybeSingle(),
        supabase.from("vendor_photos").select("id, url").eq("vendor_id", vid!).order("position", { ascending: true }),
        supabase.rpc("vendor_analytics", { p_vendor_id: vid!, p_days: 30 }),
        supabase.from("vendor_blocked_dates").select("blocked_date").eq("vendor_id", vid!).gte("blocked_date", todayIso),
      ])
    : [{ data: null }, { data: null }, { data: [] }, { data: null }, { data: [] }];

  const priceFrom = (service?.price_from as number | null) ?? null;
  const priceNotes = (service?.price_notes as string | null) ?? null;

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.h1}>{vendor ? (vendor.name as string) : "Your dashboard"}</h1>
            <p className={styles.sub} style={{ margin: 0 }}>Signed in as {user.email}</p>
          </div>
          <form action={signOut}>
            <button className={styles.btnGhost} type="submit">Sign out</button>
          </form>
        </div>

        {billing === "success" && (
          <div className={`${styles.notice} ${styles.noticeOk}`}>
            Payment received — your subscription is being confirmed. It may take a moment to show as active.
          </div>
        )}
        {billing === "cancelled" && (
          <div className={`${styles.notice} ${styles.noticeErr}`}>
            Checkout cancelled — no charge was made. You can subscribe any time below.
          </div>
        )}

        {!vendor ? (
          <CreateListingForm />
        ) : (
          <>
            {vendor.status !== "live" && (
              <div className={styles.publishBanner}>
                <div>
                  <strong>Your listing is a draft.</strong> It won&apos;t appear in search or to buyers until you publish it.
                </div>
                <PublishButton vendorId={vendor.id as string} />
              </div>
            )}

            <CompletenessCard
              completeness={assessListing({
                name: vendor.name as string,
                primary_category: vendor.primary_category as string | null,
                description: vendor.description as string | null,
                bio: vendor.bio as string | null,
                price_from: priceFrom,
                contact_email: vendor.contact_email as string | null,
                capacityMax: ((vendor.attributes as Record<string, unknown>)?.capacity_max as number | null) ?? null,
                attributes: (vendor.attributes as Record<string, unknown> | null) ?? null,
                signature_items: vendor.signature_items as string[] | null,
                faq: vendor.faq as unknown[] | null,
                coverage_radius_miles: vendor.coverage_radius_miles as number | null,
                photoCount: ((photos as { id: string }[]) || []).length,
                hasAvailability: ((blocked as unknown[]) || []).length > 0,
              })}
              previewHref={`/vendors/${vendor.slug as string}?preview=1`}
            />

            {/* Notifications are the reason the vendor side is installable, so
                this is available on every tier — the paid feature is the
                *instant* alert, not the ability to be notified at all. */}
            <NotificationsCard
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
            />

            {canAccess(vendor.tier as number, "analytics") && (
              <AnalyticsCard data={(analytics as Analytics) ?? null} />
            )}

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Listing</span>
                <span className={styles.badge}>{vendor.status as string}</span>
              </div>
              <p className={styles.sub}>
                {(vendor.primary_category as string) || "Mobile catering"} ·{" "}
                <a href={`/vendors/${vendor.slug}`}>View public page →</a>
              </p>
              <EditListingForm
                vendor={{
                  id: vendor.id as string,
                  status: vendor.status as string,
                  name: vendor.name as string,
                  primary_category: vendor.primary_category as string | null,
                  description: vendor.description as string | null,
                  bio: vendor.bio as string | null,
                  contact_email: vendor.contact_email as string | null,
                  contact_phone: vendor.contact_phone as string | null,
                  website: vendor.website as string | null,
                  instagram: vendor.instagram as string | null,
                  price_from: priceFrom,
                  price_notes: priceNotes,
                  coverage_radius_miles: vendor.coverage_radius_miles as number | null,
                  attributes: (vendor.attributes as Record<string, unknown> | null) ?? null,
                    signature_items: (vendor.signature_items as string[] | null) ?? null,
                  faq: (vendor.faq as { q?: string; a?: string }[] | null) ?? null,
                }}
              />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Photos</span>
              </div>
              <PhotoManager
                vendorId={vendor.id as string}
                initial={(photos as { id: string; url: string }[]) || []}
                limit={canAccess(vendor.tier as number, "photo_gallery") ? undefined : FREE_PHOTO_LIMIT}
              />
            </div>

            {canAccess(vendor.tier as number, "availability") && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Availability</span>
              </div>
              <AvailabilityManager
                vendorId={vendor.id as string}
                initial={((blocked as { blocked_date: string }[]) || []).map((b) => b.blocked_date)}
              />
            </div>
            )}

            <BillingCard
              status={(sub?.status as string) ?? null}
              hasCustomer={!!sub?.stripe_customer_id}
              tier={(vendor.tier as number) ?? TIER.FREE}
            />

            <LeadsCard vendorId={vendor.id as string} tier={(vendor.tier as number) ?? TIER.FREE} />
          </>
        )}
      </main>
    </>
  );
}
