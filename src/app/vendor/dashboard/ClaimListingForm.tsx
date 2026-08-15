"use client";

import { useActionState } from "react";
import { claimListing, type ActionState } from "./actions";
import styles from "../vendor.module.css";

export default function ClaimListingForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(claimListing, null);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Link your listing</span>
      </div>
      <p className={styles.sub}>
        Your account isn&apos;t linked to a listing yet. Enter your listing&apos;s web address to claim it —
        it&apos;s the last part of your Patch URL, e.g. <strong>dough-and-co</strong> from
        {" "}hireonpatch.com/vendors/<strong>dough-and-co</strong>.
      </p>
      <form action={action}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="slug">Listing address</label>
          <input id="slug" name="slug" required className={styles.input} placeholder="your-business-name" />
        </div>
        {state?.error && <div className={`${styles.notice} ${styles.noticeErr}`}>{state.error}</div>}
        {state?.ok && <div className={`${styles.notice} ${styles.noticeOk}`}>Listing linked — welcome aboard.</div>}
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? "Linking…" : "Claim listing"}
        </button>
      </form>
    </div>
  );
}
