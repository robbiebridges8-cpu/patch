"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

export default function ReviewPage() {
  const params = useParams<{ enquiryId: string }>();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [vendorName, setVendorName] = useState<string | null>(null);
  // Resolve the vendor from the enquiry id itself, so a review link works even
  // without the ?v= param (e.g. a buyer who cleared localStorage). Fall back to
  // the param if the RPC hasn't resolved yet.
  const [slug, setSlug] = useState<string | null>(searchParams.get("v"));
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.rpc("enquiry_status", { p_ids: [params.enquiryId] }).then(({ data }) => {
      const row = (data as { vendor_name: string; vendor_slug: string }[] | null)?.[0];
      if (row) {
        setVendorName(row.vendor_name);
        setSlug(row.vendor_slug);
      }
    });
  }, [params.enquiryId, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) { setError("Please choose a star rating."); return; }
    setError(null);
    setSending(true);
    const fd = new FormData(e.currentTarget);
    const { error: rpcErr } = await supabase.rpc("submit_review", {
      p_enquiry_id: params.enquiryId,
      p_rating: rating,
      p_title: String(fd.get("title") || ""),
      p_body: String(fd.get("body") || ""),
    });
    if (rpcErr) {
      setError(
        /already reviewed/.test(rpcErr.message) ? "You've already left a review for this booking."
        : /not found/.test(rpcErr.message) ? "We couldn't find that booking."
        : "Something went wrong — please try again."
      );
      setSending(false);
      return;
    }
    setDone(true);
  }

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        {done ? (
          <div className={styles.center}>
            <div className={styles.tick}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 className={styles.h1}>Thanks for your review</h1>
            <p className={styles.sub}>It helps other people find great businesses. {slug && <>You can view it on <Link href={`/vendors/${slug}`}>their page</Link>.</>}</p>
          </div>
        ) : (
          <>
            <h1 className={styles.h1}>Leave a review{vendorName ? ` for ${vendorName}` : ""}</h1>
            <p className={styles.sub}>How was it? Your honest feedback helps other people choose well.</p>

            <form onSubmit={handleSubmit} className={styles.card}>
              <div className={styles.starRow} role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    className={styles.star}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    aria-checked={rating === n}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                  >
                    <svg viewBox="0 0 24 24" fill={(hover || rating) >= n ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z" />
                    </svg>
                  </button>
                ))}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="title">Headline</label>
                <input id="title" name="title" maxLength={200} className={styles.input} placeholder="e.g. Made our wedding" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="body">Your review</label>
                <textarea id="body" name="body" rows={5} maxLength={5000} className={styles.textarea} placeholder="What was the food, service, and setup like?" />
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}
              <button type="submit" className={styles.submit} disabled={sending}>
                {sending ? "Posting…" : "Post review"}
              </button>
            </form>
          </>
        )}
      </main>
    </>
  );
}
