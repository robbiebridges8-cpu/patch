"use client";

import { useState, useTransition } from "react";
import { setEnquiryStatus } from "./actions";
import MessageThread, { type ThreadMessage } from "./MessageThread";
import styles from "../vendor.module.css";

export interface Lead {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  event_date: string | null;
  postcode: string | null;
  details: Record<string, unknown> | null;
  message: string | null;
  /** Set only on redacted (locked) leads — the real message never leaves the server. */
  messageWords?: number;
  status: string;
  created_at: string;
}

const ACTIONS: { value: string; label: string }[] = [
  { value: "replied", label: "Replied" },
  { value: "booked", label: "Booked" },
  { value: "declined", label: "Declined" },
];

function statusLabel(s: string) {
  if (s === "sent" || s === "viewed") return "New";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "2 hours ago" — lead heat matters; a bare date hides how fresh (or stale) it is.
function relTime(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// "in 3 days" / "tomorrow" — proximity to the event drives urgency.
function eventCountdown(iso: string): string | null {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Math.ceil((new Date(iso).getTime() - start.getTime()) / 86400000);
  if (days < 0) return null;
  if (days === 0) return "event today";
  if (days === 1) return "event tomorrow";
  if (days <= 21) return `event in ${days} days`;
  return null;
}

export default function LeadRow({
  lead,
  thread = [],
  locked = false,
}: {
  lead: Lead;
  thread?: ThreadMessage[];
  /** Free tier: the lead is real and stored, but the details are withheld. */
  locked?: boolean;
}) {
  const [status, setStatus] = useState(lead.status);
  const [pending, startTransition] = useTransition();
  const unread = thread.filter((m) => m.sender === "buyer" && !m.read_by_vendor).length;
  const [open, setOpen] = useState(unread > 0 && !locked);

  const isNew = status === "sent" || status === "viewed";
  const countdown = lead.event_date ? eventCountdown(lead.event_date) : null;
  const subject = encodeURIComponent(`Re: your Patch enquiry`);
  const mailto = lead.buyer_email
    ? `mailto:${lead.buyer_email}?subject=${subject}`
    : undefined;

  function set(value: string) {
    setStatus(value);
    startTransition(async () => {
      await setEnquiryStatus(lead.id, value);
    });
  }

  if (locked) {
    const words = lead.messageWords ?? 0;
    return (
      <div className={`${styles.lead} ${styles.leadLocked}`}>
        <div className={styles.leadHead}>
          <span className={styles.leadName}>New enquiry</span>
          <span className={styles.leadFresh}>{relTime(lead.created_at)}</span>
          <span className={`${styles.leadStatus} ${styles.status_new}`}>Locked</span>
        </div>
        <div className={styles.leadMeta}>
          {[
            lead.event_date ? `Event: ${new Date(lead.event_date).toLocaleDateString("en-GB")}` : null,
            countdown,
            lead.postcode,
          ].filter(Boolean).join(" · ")}
        </div>
        <div className={styles.leadRedact}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <span>Name, contact details{words > 0 ? ` and a ${words}-word message` : ""} — hidden until you unlock</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.lead} ${isNew ? styles.leadNew : ""}`}>
      <div className={styles.leadHead}>
        <span className={styles.leadName}>{lead.buyer_name || "Enquiry"}</span>
        <span className={styles.leadFresh}>{relTime(lead.created_at)}</span>
        <span className={`${styles.leadStatus} ${styles["status_" + (isNew ? "new" : status)] || ""}`}>
          {statusLabel(status)}
        </span>
      </div>
      <div className={styles.leadMeta}>
        {[
          lead.buyer_email,
          lead.buyer_phone,
          lead.event_date ? `Event: ${new Date(lead.event_date).toLocaleDateString("en-GB")}` : null,
          countdown,
          ...Object.entries(lead.details ?? {})
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`),
          lead.postcode,
        ].filter(Boolean).join(" · ")}
      </div>
      {lead.message && <div className={styles.leadMsg}>{lead.message}</div>}

      <div className={styles.leadActions}>
        <button
          type="button"
          className={`${styles.leadPrimary} ${open ? styles.leadPrimaryOpen : ""}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide conversation" : thread.length ? `Open conversation (${thread.length})` : "Message the buyer"}
          {!open && unread > 0 && <span className={styles.threadDot}>{unread}</span>}
        </button>
        {ACTIONS.map((a) => (
          <button
            key={a.value}
            type="button"
            className={`${styles.statusBtn} ${status === a.value ? styles.statusBtnActive : ""}`}
            disabled={pending}
            onClick={() => set(status === a.value ? "sent" : a.value)}
          >
            {a.label}
          </button>
        ))}
        {mailto && (
          <a href={mailto} className={styles.leadEmail} onClick={() => isNew && set("replied")}>
            or reply by email
          </a>
        )}
      </div>

      {open && (
        <MessageThread
          enquiryId={lead.id}
          initial={thread}
          buyerName={lead.buyer_name || "the client"}
        />
      )}
    </div>
  );
}
