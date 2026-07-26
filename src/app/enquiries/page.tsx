"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { useEnquiries } from "@/lib/useEnquiries";
import { createClient } from "@/lib/supabase/client";
import BuyerThread from "./BuyerThread";
import styles from "./page.module.css";

interface StatusRow {
  id: string;
  status: string;
  vendor_name: string;
  vendor_slug: string;
  message_count: number;
  unread_count: number;
}

function statusLabel(s: string) {
  if (s === "sent" || s === "viewed") return "Awaiting reply";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function EnquiriesPage() {
  const { items } = useEnquiries(); // localStorage — works with no account
  const [user, setUser] = useState<{ id: string; email?: string } | null | undefined>(undefined);
  const [dbRows, setDbRows] = useState<{ id: string; created_at: string }[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusRow>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  // Session + account-backed enquiries. On login we claim any past anonymous
  // enquiries sent from this email, then read them by buyer_id (RLS-scoped).
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUser(u ? { id: u.id, email: u.email } : null);
      if (!u) return;
      await supabase.rpc("claim_my_enquiries"); // idempotent
      const { data } = await supabase
        .from("enquiries")
        .select("id, created_at")
        .eq("buyer_id", u.id)
        .order("created_at", { ascending: false });
      if (!cancelled && data) setDbRows(data as { id: string; created_at: string }[]);
    })();
    return () => { cancelled = true; };
  }, []);

  // Union of local + account enquiries, newest first. Vendor name/slug comes
  // from enquiry_status (below) for account-only rows; from localStorage for the
  // rest until it resolves.
  const ordered = useMemo(() => {
    const byId = new Map<string, { at: number; vendorName?: string; vendorSlug?: string }>();
    for (const d of dbRows) byId.set(d.id, { at: new Date(d.created_at).getTime() });
    for (const i of items) {
      const at = byId.get(i.enquiryId)?.at ?? i.at;
      byId.set(i.enquiryId, { at, vendorName: i.vendorName, vendorSlug: i.vendorSlug });
    }
    return [...byId.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.at - a.at);
  }, [items, dbRows]);

  const idsKey = ordered.map((o) => o.id).join(",");

  useEffect(() => {
    if (!idsKey) { setLoading(false); return; }
    const supabase = createClient();
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("enquiry_status", { p_ids: idsKey.split(",") });
        if (cancelled) return;
        if (error) { setLoadError(true); return; }
        const map: Record<string, StatusRow> = {};
        for (const row of (data as StatusRow[]) ?? []) map[row.id] = row;
        setStatuses(map);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [idsKey]);

  const clearUnread = useCallback((id: string) => {
    setStatuses((prev) =>
      prev[id]?.unread_count ? { ...prev, [id]: { ...prev[id], unread_count: 0 } } : prev,
    );
  }, []);

  const isEmpty = ordered.length === 0;

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        <h1 className={styles.h1}>Your enquiries</h1>

        {/* Account state — the cross-device recovery story. */}
        {user === null && (
          <p className={styles.sub}>
            These are saved on this device only.{" "}
            <Link href="/login">Log in</Link> to keep them — and your review links — on any device.
          </p>
        )}
        {user && (
          <p className={styles.sub}>Logged in as {user.email}. Your enquiries follow you across devices.</p>
        )}

        {isEmpty ? (
          <div className={styles.empty}>
            <p>You haven&apos;t sent any enquiries yet.</p>
            <Link href="/search" className={styles.cta}>Find someone</Link>
          </div>
        ) : (
          <>
            <p className={styles.sub}>Track responses and message them here. Once your booking is marked confirmed, you can leave a review.</p>
            {loadError && (
              <p className={styles.sub} role="status">
                We couldn&apos;t load the latest status just now. Your enquiries are safe — refresh to try again.
              </p>
            )}
            <div className={styles.list} aria-busy={loading}>
              {ordered.map((o) => {
                const st = statuses[o.id];
                const status = st?.status ?? "sent";
                const booked = status === "booked";
                const replied = status === "replied" || booked;
                const unread = st?.unread_count ?? 0;
                const count = st?.message_count ?? 0;
                const isOpen = open === o.id;
                const vendorName = st?.vendor_name ?? o.vendorName ?? "Vendor";
                const vendorSlug = st?.vendor_slug ?? o.vendorSlug;
                return (
                  <div key={o.id} className={styles.card}>
                    <div className={styles.row}>
                      <div className={styles.rowMain}>
                        {vendorSlug
                          ? <Link href={`/vendors/${vendorSlug}`} className={styles.vendor}>{vendorName}</Link>
                          : <span className={styles.vendor}>{vendorName}</span>}
                        <span className={styles.date}>Sent {new Date(o.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                      <div className={styles.rowSide}>
                        <span className={`${styles.status} ${replied ? styles.statusOn : ""}`}>{loading && !st ? "…" : statusLabel(status)}</span>
                        <button
                          type="button"
                          className={styles.threadToggle}
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : o.id)}
                        >
                          {isOpen ? "Hide messages" : count ? `Messages (${count})` : "Message"}
                          {!isOpen && unread > 0 && <span className={styles.threadDot}>{unread}</span>}
                        </button>
                        {booked && vendorSlug && (
                          <Link href={`/review/${o.id}?v=${vendorSlug}`} className={styles.reviewLink}>Leave a review</Link>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <BuyerThread
                        enquiryId={o.id}
                        vendorName={vendorName}
                        onRead={() => clearUnread(o.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
  );
}
