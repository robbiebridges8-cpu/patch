"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createListing, type ActionState } from "./actions";
import ClaimListingForm from "./ClaimListingForm";
import styles from "../vendor.module.css";

// Suggestions only — the field is free text so any vertical (photographer,
// plumber, DJ, cleaner) can list, not just the food categories we launched with.
const CATEGORIES = [
  "Pizza", "Burgers", "BBQ", "Grazing & cheese", "Coffee", "Desserts",
  "Cocktail bar", "Canapés", "Photographer", "DJ", "Florist", "Cleaner",
  "Mobile bar", "Entertainer", "Event hire",
];

export default function CreateListingForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createListing, null);
  const [showClaim, setShowClaim] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Create your listing</span>
      </div>
      <p className={styles.sub}>
        Get the basics down and you&apos;ll land straight in your dashboard to add photos, pricing, and availability.
        Your listing stays a private draft until you publish it.
      </p>

      <form action={action}>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="name">Business name *</label>
            <input id="name" name="name" required maxLength={200} className={styles.input} placeholder="e.g. Smoke & Bones" />
          </div>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="category">Category</label>
            <input id="category" name="category" list="category-suggestions" maxLength={100}
              className={styles.input} placeholder="e.g. Pizza, Photographer, DJ…" autoComplete="off" />
            <datalist id="category-suggestions">
              {CATEGORIES.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="description">Short description</label>
          <textarea id="description" name="description" rows={2} maxLength={2000} className={styles.textarea} placeholder="One line — what you do and why people love it." />
        </div>

        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="postcode">Where you're based <span className={styles.hint}>(so we can match you to nearby events)</span></label>
          <input id="postcode" name="postcode" maxLength={60} className={styles.input} placeholder="e.g. Hackney, or E8 3RL" />
        </div>

        {state?.error && <div className={`${styles.notice} ${styles.noticeErr}`}>{state.error}</div>}
        {state?.ok && <div className={`${styles.notice} ${styles.noticeOk}`}>Listing created — scroll down to fill in the rest.</div>}

        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? "Creating…" : "Create listing"}
        </button>
      </form>

      <div className={styles.claimToggle}>
        {showClaim ? (
          <ClaimListingForm />
        ) : (
          <button type="button" className={styles.linkBtn} onClick={() => setShowClaim(true)}>
            Already have a listing on Patch? Claim it instead
          </button>
        )}
      </div>
    </div>
  );
}
