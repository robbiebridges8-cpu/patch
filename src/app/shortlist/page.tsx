"use client";

import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { useShortlist } from "@/lib/useShortlist";
import { useEnquiries } from "@/lib/useEnquiries";
import styles from "./page.module.css";

export default function ShortlistPage() {
  const { items, remove, clear } = useShortlist();
  const { add } = useEnquiries();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorIds: items.map((i) => i.id),
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          eventDate: fd.get("eventDate"),
          guests: fd.get("guests"),
          postcode: fd.get("postcode"),
          message: fd.get("message"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSending(false);
        return;
      }
      if (data.records) add(data.records);
      setSentCount(data.sent);
      clear();
    } catch {
      setError("Couldn't reach the server. Please check your connection and try again.");
      setSending(false);
    }
  }

  if (sentCount !== null) {
    return (
      <>
        <Header />
        <main id="main-content" className={`${styles.wrap} ${styles.center}`}>
          <div className={styles.successIcon}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className={styles.h1}>Enquiry sent to {sentCount} {sentCount === 1 ? "vendor" : "vendors"}</h1>
          <p className={styles.sub}>
            Each will get your brief and reply directly — usually within a day. You&apos;ll hear from whoever&apos;s the best fit,
            and you can compare their responses before you book anything.
          </p>
          <Link href="/search" className={styles.cta}>Keep looking</Link>
        </main>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <Header />
        <main id="main-content" className={`${styles.wrap} ${styles.center}`}>
          <h1 className={styles.h1}>Your shortlist is empty</h1>
          <p className={styles.sub}>Search for vendors and tap the heart to save them here — then enquire with everyone at once.</p>
          <Link href="/search" className={styles.cta}>Find vendors</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main id="main-content" className={styles.wrap}>
        <div className={styles.head}>
          <h1 className={styles.h1}>Your shortlist ({items.length})</h1>
          <button type="button" className={styles.clear} onClick={clear}>Clear all</button>
        </div>

        <div className={styles.grid}>
          {items.map((i) => (
            <div key={i.slug} className={styles.card}>
              <Link href={`/vendors/${i.slug}`} className={styles.cardMedia}>
                <Image
                  src={i.photoUrl}
                  alt={i.name}
                  fill
                  sizes="(max-width: 700px) 50vw, 260px"
                />
              </Link>
              <div className={styles.cardBody}>
                <span className={styles.cardCat}>{i.category}</span>
                <Link href={`/vendors/${i.slug}`} className={styles.cardName}>{i.name}</Link>
                <span className={styles.cardPrice}>{i.priceLabel}</span>
              </div>
              <button type="button" className={styles.cardRemove} aria-label={`Remove ${i.name}`} onClick={() => remove(i.slug)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>

        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Enquire with all {items.length}</h2>
          <p className={styles.formSub}>Write your brief once — we&apos;ll send it to everyone on your shortlist and they&apos;ll reply directly.</p>

          <form onSubmit={handleSubmit}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.labelText}>Your name *</span>
                <input name="name" required maxLength={200} className={styles.input} autoComplete="name" />
              </label>
              <label className={styles.field}>
                <span className={styles.labelText}>Email *</span>
                <input name="email" type="email" required maxLength={320} className={styles.input} autoComplete="email" />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.labelText}>Phone</span>
                <input name="phone" type="tel" maxLength={30} className={styles.input} autoComplete="tel" />
              </label>
              <label className={styles.field}>
                <span className={styles.labelText}>Event date</span>
                <input name="eventDate" type="date" className={styles.input} />
              </label>
            </div>
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.labelText}>Guests</span>
                <input name="guests" type="number" min={1} max={100000} className={styles.input} inputMode="numeric" />
              </label>
              <label className={styles.field}>
                <span className={styles.labelText}>Event postcode</span>
                <input name="postcode" maxLength={10} className={styles.input} placeholder="e.g. E8 3RL" />
              </label>
            </div>
            <label className={styles.field}>
              <span className={styles.labelText}>What are you planning? *</span>
              <textarea name="message" required maxLength={2000} rows={4} className={styles.textarea} placeholder="Tell them about the occasion, vibe, and anything they should know…" />
            </label>

            {error && <div className={styles.error} role="alert">{error}</div>}

            <button type="submit" className={styles.submit} disabled={sending}>
              {sending ? "Sending…" : `Send to all ${items.length} vendors`}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
