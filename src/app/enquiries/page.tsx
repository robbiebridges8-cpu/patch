"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { useEnquiries } from "@/lib/useEnquiries";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface StatusRow { id: string; status: string; vendor_name: string; vendor_slug: string; }

function statusLabel(s: string) {
  if (s === "sent" || s === "viewed") return "Awaiting reply";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function EnquiriesPage() {
  const { items } = useEnquiries();
  const [statuses, setStatuses] = useState<Record<string, StatusRow>>({});
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
            <p className={styles.sub}>Track responses here. Once a vendor marks your booking confirmed, you can leave a review.</p>
            <div className={styles.list}>
              {items.map((i) => {
                const st = statuses[i.enquiryId];
                const status = st?.status ?? "sent";
                const booked = status === "booked";
                const replied = status === "replied" || booked;
                return (
                  <div key={i.enquiryId} className={styles.row}>
                    <div className={styles.rowMain}>
                      <Link href={`/vendors/${i.vendorSlug}`} className={styles.vendor}>{i.vendorName}</Link>
                      <span className={styles.date}>Sent {new Date(i.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className={styles.rowSide}>
                      <span className={`${styles.status} ${replied ? styles.statusOn : ""}`}>{statusLabel(status)}</span>
                      {booked && (
                        <Link href={`/review/${i.enquiryId}?v=${i.vendorSlug}`} className={styles.reviewLink}>Leave a review</Link>
                      )}
                    </div>
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
