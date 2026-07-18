"use client";

import { useState, useTransition } from "react";
import { setEnquiryStatus } from "./actions";
import MessageThread, { type ThreadMessage } from "./MessageThread";
import styles from "../vendor.module.css";

export interface Lead {
  id: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  event_date: string | null;
  postcode: string | null;
  details: Record<string, unknown> | null;
  message: string | null;
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

export default function LeadRow({ lead, thread = [] }: { lead: Lead; thread?: ThreadMessage[] }) {
  const [status, setStatus] = useState(lead.status);
  const [pending, startTransition] = useTransition();
  const unread = thread.filter((m) => m.sender === "buyer" && !m.read_by_vendor).length;
  const [open, setOpen] = useState(unread > 0);

  const isNew = status === "sent" || status === "viewed";
  const subject = encodeURIComponent(`Re: your Patch enquiry`);
  const mailto = lead.parent_email
    ? `mailto:${lead.parent_email}?subject=${subject}`
    : undefined;

  function set(value: string) {
    setStatus(value);
    startTransition(async () => {
      await setEnquiryStatus(lead.id, value);
    });
  }

  return (
    <div className={`${styles.lead} ${isNew ? styles.leadNew : ""}`}>
      <div className={styles.leadHead}>
        <span className={styles.leadName}>{lead.parent_name || "Enquiry"}</span>
        <span className={`${styles.leadStatus} ${styles["status_" + (isNew ? "new" : status)] || ""}`}>
          {statusLabel(status)}
        </span>
      </div>
      <div className={styles.leadMeta}>
        {[
          lead.parent_email,
          lead.parent_phone,
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
          buyerName={lead.parent_name || "the client"}
        />
      )}
    </div>
  );
}
