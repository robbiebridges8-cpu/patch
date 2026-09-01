"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { claimListing, type ActionState } from "./actions";
import styles from "../vendor.module.css";

export default function ClaimListingForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(claimListing, null);
  const router = useRouter();

  // On success the account now owns a listing — go straight to the dashboard
  // rather than leaving a "welcome aboard" notice sitting on a dead form.
  useEffect(() => {
    if (state?.ok) router.push("/vendor/dashboard");
  }, [state?.ok, router]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Claim your existing listing</span>
      </div>
      <p className={styles.sub}>
        Already on Patch? Paste the link to your listing (or just the last part of it) and we&apos;ll
        connect it to your account — for example{" "}
        <strong>hireonpatch.com/vendors/dough-and-co</strong>.
      </p>
      <form action={action}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="slug">Your listing link</label>
          <input
            id="slug" name="slug" required className={styles.input}
            placeholder="hireonpatch.com/vendors/your-business  ·  or  your-business"
            autoComplete="off"
          />
        </div>
        {state?.error && <div className={`${styles.notice} ${styles.noticeErr}`}>{state.error}</div>}
        {state?.ok && <div className={`${styles.notice} ${styles.noticeOk}`}>Listing linked — taking you to your dashboard…</div>}
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? "Linking…" : "Claim listing"}
        </button>
      </form>
    </div>
  );
}
