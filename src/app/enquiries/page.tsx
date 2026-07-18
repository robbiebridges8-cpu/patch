"use client";

import { useState, useEffect, useCallback } from "react";
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
  const { items } = useEnquiries();
  const [statuses, setStatuses] = useState<Record<string, StatusRow>>({});
  const [open, setOpen] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (items.length === 0) return;
    supabase.rpc("enquiry_status", { p_ids: items.map((i) => i.enquiryId) }).then(({ data }) => {
      if (!data) return;
      const map: Record<string, StatusRow> = {};
      for (const row of data as StatusRow[]) map[row.id] = row;
      setStatuses(map);
    });
  }, [items, supabase]);

  // Opening a thread marks it read server-side; mirror that in the badge.
  const clearUnread = useCallback((id: string) => {
    setStatuses((prev) =>
      prev[id]?.unread_count ? { ...prev, [id]: { ...prev[id], unread_count: 0 } } : prev,
    );
  }, []);

  return (
    <>
      <Header />
      <main className={styles.wrap}>
        <h1 className={styles.h1}>Your enquiries</h1>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <p>You haven&apos;t sent any enquiries yet.</p>
            <Link href="/search" className={styles.cta}>Find vendors</Link>
          </div>
        ) : (
          <>
            <p className={styles.sub}>Track responses and message vendors here. Once a vendor marks your booking confirmed, you can leave a review.</p>
            <div className={styles.list}>
              {items.map((i) => {
                const st = statuses[i.enquiryId];
                const status = st?.status ?? "sent";
                const booked = status === "booked";
                const replied = status === "replied" || booked;
                const unread = st?.unread_count ?? 0;
                const count = st?.message_count ?? 0;
                const isOpen = open === i.enquiryId;
                return (
                  <div key={i.enquiryId} className={styles.card}>
                    <div className={styles.row}>
                      <div className={styles.rowMain}>
                        <Link href={`/vendors/${i.vendorSlug}`} className={styles.vendor}>{i.vendorName}</Link>
                        <span className={styles.date}>Sent {new Date(i.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                      <div className={styles.rowSide}>
                        <span className={`${styles.status} ${replied ? styles.statusOn : ""}`}>{statusLabel(status)}</span>
                        <button
                          type="button"
                          className={styles.threadToggle}
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : i.enquiryId)}
                        >
                          {isOpen ? "Hide messages" : count ? `Messages (${count})` : "Message"}
                          {!isOpen && unread > 0 && <span className={styles.threadDot}>{unread}</span>}
                        </button>
                        {booked && (
                          <Link href={`/review/${i.enquiryId}?v=${i.vendorSlug}`} className={styles.reviewLink}>Leave a review</Link>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <BuyerThread
                        enquiryId={i.enquiryId}
                        vendorName={i.vendorName}
                        onRead={() => clearUnread(i.enquiryId)}
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
