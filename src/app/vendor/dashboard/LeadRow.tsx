"use client";

import { useState, useTransition } from "react";
import { setEnquiryStatus } from "./actions";
import styles from "../vendor.module.css";

export interface Lead {
  id: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  party_date: string | null;
  guest_count: number | null;
  party_postcode: string | null;
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

export default function LeadRow({ lead }: { lead: Lead }) {
  const [status, setStatus] = useState(lead.status);
  const [pending, startTransition] = useTransition();

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
          lead.party_date ? `Event: ${new Date(lead.party_date).toLocaleDateString("en-GB")}` : null,
          lead.guest_count ? `${lead.guest_count} guests` : null,
          lead.party_postcode,
          `Received ${new Date(lead.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        ].filter(Boolean).join(" · ")}
      </div>
      {lead.message && <div className={styles.leadMsg}>{lead.message}</div>}

      <div className={styles.leadActions}>
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
    </div>
  );
}
