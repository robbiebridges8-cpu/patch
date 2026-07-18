"use client";

import { useState, useEffect, useRef } from "react";
import { useEnquiries } from "@/lib/useEnquiries";
import styles from "./EnquiryForm.module.css";

interface Props {
  vendorId: string;
  vendorName: string;
  className?: string;
  label?: string;
}

export default function EnquiryButton({ vendorId, vendorName, className, label = "Get in touch" }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { add } = useEnquiries();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

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
          vendorId,
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
      setDone(true);
    } catch {
      setError("Couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  function close() {
    setOpen(false);
    // reset after the closing transition so re-opening is clean
    setTimeout(() => {
      setDone(false);
      setError(null);
    }, 200);
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>

      {open && (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className={styles.dialog} ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Enquire with ${vendorName}`}>
            <button type="button" className={styles.closeBtn} onClick={close} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>

            {done ? (
              <div className={styles.success}>
                <div className={styles.successIcon}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h3 className={styles.successTitle}>Enquiry sent</h3>
                <p className={styles.successBody}>
                  {vendorName} has your brief and will reply directly — usually within a day.
                  Comparing options? Shortlist a few more and enquire them all at once.
                </p>
                <button type="button" className={styles.primaryBtn} onClick={close}>Done</button>
              </div>
            ) : (
              <>
                <h3 className={styles.title}>Enquire with {vendorName}</h3>
                <p className={styles.sub}>Share a few details and they&apos;ll come back to you directly.</p>

                <form onSubmit={handleSubmit} className={styles.form}>
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

                  <button type="submit" className={styles.primaryBtn} disabled={sending}>
                    {sending ? "Sending…" : "Send enquiry"}
                  </button>
                  <p className={styles.privacy}>
                    By sending, you agree to share these details with {vendorName}. See our{" "}
                    <a href="/privacy">privacy policy</a>.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
