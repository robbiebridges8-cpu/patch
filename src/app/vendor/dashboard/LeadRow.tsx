"use client";

import { useState, useTransition } from "react";
import { setEnquiryStatus } from "./actions";
import MessageThread, { type ThreadMessage } from "./MessageThread";
import UpgradePrompt from "./UpgradePrompt";
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
    // Deliberately specific — date, area and length of message prove this is a
    // real job, not a placeholder. Everything actionable stays behind the gate.
    const words = lead.messageWords ?? 0;
    return (
      <div className={`${styles.lead} ${styles.leadLocked}`}>
        <div className={styles.leadHead}>
          <span className={styles.leadName}>New enquiry</span>
          <span className={`${styles.leadStatus} ${styles.status_new}`}>Locked</span>
        </div>
        <div className={styles.leadMeta}>
          {[
            lead.event_date ? `Event: ${new Date(lead.event_date).toLocaleDateString("en-GB")}` : null,
            ...Object.entries(lead.details ?? {})
              .filter(([, v]) => v != null && v !== "")
              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`),
            lead.postcode,
            `Received ${new Date(lead.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
          ].filter(Boolean).join(" · ")}
        </div>
        <div className={styles.leadBlur} aria-hidden="true">
          {"•".repeat(9)} · {"•".repeat(14)}@{"•".repeat(8)}
          <div className={styles.leadBlurMsg}>{"•".repeat(Math.min(words * 6, 220))}</div>
        </div>
        <p className={styles.leadLockedNote}>
          Their name, contact details and {words > 0 ? `${words}-word ` : ""}message are ready.
          Upgrade to open this enquiry — it stays here either way.
        </p>
        <UpgradePrompt compact />
      </div>
    );
  }

  return (
    <div className={`${styles.lead} ${isNew ? styles.leadNew : ""}`}>
      <div className={styles.leadHead}>
        <span className={styles.leadName}>{lead.buyer_name || "Enquiry"}</span>
        <span className={`${styles.leadStatus} ${styles["status_" + (isNew ? "new" : status)] || ""}`}>
          {statusLabel(status)}
        </span>
      </div>
      <div className={styles.leadMeta}>
        {[
          lead.buyer_email,
          lead.buyer_phone,
          lead.event_date ? `Event: ${new Date(lead.event_date).toLocaleDateString("en-GB")}` : null,
          // Whatever the enquiry form captured for this vertical.
          ...Object.entries(lead.details ?? {})
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`),
          lead.postcode,
          `Received ${new Date(lead.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        ].filter(Boolean).join(" · ")}
      </div>
      {lead.message && <div className={styles.leadMsg}>{lead.message}</div>}

      <div className={styles.leadActions}>
        <button
          type="button"
          className={styles.threadToggle}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide messages" : thread.length ? `Messages (${thread.length})` : "Message"}
          {!open && unread > 0 && <span className={styles.threadDot}>{unread}</span>}
        </button>
        {mailto && (
          <a href={mailto} className={styles.btnGhost} onClick={() => isNew && set("replied")}>
            Reply by email
          </a>
        )}
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
