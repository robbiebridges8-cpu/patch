"use client";

import { useActionState } from "react";
import { updateListing, type ActionState } from "./actions";
import styles from "../vendor.module.css";

interface Vendor {
  id: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  price_from: number | null;
  price_notes: string | null;
}

export default function EditListingForm({ vendor }: { vendor: Vendor }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateListing, null);

  return (
    <form action={action}>
      <input type="hidden" name="vendorId" value={vendor.id} />

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} maxLength={2000} className={styles.textarea} defaultValue={vendor.description ?? ""} />
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="contact_email">Contact email</label>
          <input id="contact_email" name="contact_email" type="email" maxLength={320} className={styles.input} defaultValue={vendor.contact_email ?? ""} />
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="contact_phone">Contact phone</label>
          <input id="contact_phone" name="contact_phone" maxLength={30} className={styles.input} defaultValue={vendor.contact_phone ?? ""} />
        </div>
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="price_from">Price from (£)</label>
          <input id="price_from" name="price_from" type="number" min={0} className={styles.input} defaultValue={vendor.price_from ?? ""} />
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="price_notes">Price notes</label>
          <input id="price_notes" name="price_notes" maxLength={500} className={styles.input} defaultValue={vendor.price_notes ?? ""} placeholder="e.g. minimum spend £600, serves ~50" />
        </div>
      </div>

      {state?.error && <div className={`${styles.notice} ${styles.noticeErr}`}>{state.error}</div>}
      {state?.ok && <div className={`${styles.notice} ${styles.noticeOk}`}>Saved.</div>}

      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
