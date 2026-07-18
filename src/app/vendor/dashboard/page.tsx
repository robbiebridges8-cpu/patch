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
import { type ThreadMessage } from "./MessageThread";
import BillingCard from "./BillingCard";
import { signOut } from "./actions";
import styles from "../vendor.module.css";

async function LeadsCard({ vendorId }: { vendorId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enquiries")
    .select("id, parent_name, parent_email, parent_phone, party_date, guest_count, party_postcode, message, status, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  const leads = (data as Lead[]) || [];
  const newCount = leads.filter((l) => l.status === "sent" || l.status === "viewed").length;

  // One query for every thread on this vendor's leads (RLS scopes it to us).
  const { data: msgs } = leads.length
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
        leads.map((l) => <LeadRow key={l.id} lead={l} thread={threads.get(l.id) ?? []} />)
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
  if (!user) redirect("/vendor/login");

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, slug, description, bio, contact_email, contact_phone, website, instagram, price_from, price_notes, coverage_radius_miles, typical_event_size_min, typical_event_size_max, dietary_options, vibe_tags, signature_items, faq, status, primary_category")
    .eq("owner_id", user.id)
    .maybeSingle();

  const { data: sub } = vendor
    ? await supabase
        .from("subscriptions")
        .select("status, stripe_customer_id")
        .eq("vendor_id", vendor.id as string)
        .maybeSingle()
    : { data: null };

  const { data: photos } = vendor
    ? await supabase
        .from("vendor_photos")
        .select("id, url")
        .eq("vendor_id", vendor.id as string)
        .order("position", { ascending: true })
    : { data: [] };

  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: blocked } = vendor
    ? await supabase
        .from("vendor_blocked_dates")
        .select("blocked_date")
        .eq("vendor_id", vendor.id as string)
        .gte("blocked_date", todayIso)
    : { data: [] };

  return (
    <>
      <Header />
      <main className={styles.wrap}>
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
                  name: vendor.name as string,
                  primary_category: vendor.primary_category as string | null,
                  description: vendor.description as string | null,
                  bio: vendor.bio as string | null,
                  contact_email: vendor.contact_email as string | null,
                  contact_phone: vendor.contact_phone as string | null,
                  website: vendor.website as string | null,
                  instagram: vendor.instagram as string | null,
                  price_from: vendor.price_from as number | null,
                  price_notes: vendor.price_notes as string | null,
                  coverage_radius_miles: vendor.coverage_radius_miles as number | null,
                  typical_event_size_min: vendor.typical_event_size_min as number | null,
                  typical_event_size_max: vendor.typical_event_size_max as number | null,
                  dietary_options: vendor.dietary_options as string[] | null,
                  vibe_tags: vendor.vibe_tags as string[] | null,
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
              />
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Availability</span>
              </div>
              <AvailabilityManager
                vendorId={vendor.id as string}
                initial={((blocked as { blocked_date: string }[]) || []).map((b) => b.blocked_date)}
              />
            </div>

            <BillingCard
              status={(sub?.status as string) ?? null}
              hasCustomer={!!sub?.stripe_customer_id}
            />

            <LeadsCard vendorId={vendor.id as string} />
          </>
        )}
      </main>
    </>
  );
}
