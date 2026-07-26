"use client";

import { useActionState } from "react";
import { updateListing, type ActionState } from "./actions";
import styles from "../vendor.module.css";

// Suggestions only — free text so any vertical can list (see CreateListingForm).
const CATEGORIES = [
  "Pizza", "Burgers", "BBQ", "Grazing & cheese", "Coffee", "Desserts",
  "Cocktail bar", "Canapés", "Photographer", "DJ", "Florist", "Cleaner",
  "Mobile bar", "Entertainer", "Event hire",
];

const DIETARY = ["vegetarian", "vegan", "gluten-free", "halal", "dairy-free", "nut-free"];

export interface EditableVendor {
  id: string;
  status: string;
  name: string;
  primary_category: string | null;
  description: string | null;
  bio: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  instagram: string | null;
  price_from: number | null;
  price_notes: string | null;
  coverage_radius_miles: number | null;
  attributes: Record<string, unknown> | null;
  signature_items: string[] | null;
  faq: { q?: string; a?: string }[] | null;
}

export default function EditListingForm({ vendor }: { vendor: EditableVendor }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateListing, null);
  const attrs = vendor.attributes ?? {};
  const diet = new Set(Array.isArray(attrs.dietary) ? (attrs.dietary as string[]) : []);
  // Everything except the keys with dedicated inputs is edited free-form, so a
  // plumber can add "gas safe: 123456" without anyone shipping a schema for it.
  const RESERVED = new Set(["dietary", "capacity_min", "capacity_max", "vibe", "good_for"]);
  const extraAttrs = Object.entries(attrs)
    .filter(([k, v]) => !RESERVED.has(k) && v != null && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join("\n");

  return (
    <form action={action}>
      <input type="hidden" name="vendorId" value={vendor.id} />

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="name">Business name *</label>
          <input id="name" name="name" required maxLength={200} className={styles.input} defaultValue={vendor.name ?? ""} />
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="category">Category</label>
          <input id="category" name="category" list="category-suggestions" maxLength={100}
            className={styles.input} defaultValue={vendor.primary_category ?? ""}
            placeholder="e.g. Pizza, Photographer, DJ…" autoComplete="off" />
          <datalist id="category-suggestions">
            {CATEGORIES.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="description">Short description</label>
        <textarea id="description" name="description" rows={2} maxLength={2000} className={styles.textarea} defaultValue={vendor.description ?? ""} placeholder="One punchy line — what you do and why people love it." />
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="bio">About your business</label>
        <textarea id="bio" name="bio" rows={4} maxLength={5000} className={styles.textarea} defaultValue={vendor.bio ?? ""} placeholder="Your story, what makes you different, how you work." />
      </div>

      <div className={styles.field}>
        <span className={styles.labelText}>Dietary options you cater for</span>
        <div className={styles.chipCheckRow}>
          {DIETARY.map((d) => (
            <label key={d} className={styles.chipCheck}>
              <input type="checkbox" name="dietary" value={d} defaultChecked={diet.has(d)} />
              <span>{d.charAt(0).toUpperCase() + d.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="attributes">
          Anything else clients search for{" "}
          <span className={styles.hint}>(one per line, as: Label | Value)</span>
        </label>
        <textarea
          id="attributes"
          name="attributes"
          rows={4}
          maxLength={2000}
          className={styles.textarea}
          defaultValue={extraAttrs.replace(/: /g, " | ")}
          placeholder={"Gas Safe | 123456\nDBS checked | yes\nEquipment | own generator, gazebo"}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="vibe">Vibe tags <span className={styles.hint}>(comma-separated — helps AI matching)</span></label>
        <input id="vibe" name="vibe" maxLength={500} className={styles.input} defaultValue={(Array.isArray(vendor.attributes?.vibe) ? (vendor.attributes!.vibe as string[]) : []).join(", ")} placeholder="e.g. wedding-ready, casual, interactive, instagrammable" />
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="signature_items">Signature dishes <span className={styles.hint}>(comma-separated)</span></label>
        <input id="signature_items" name="signature_items" maxLength={1000} className={styles.input} defaultValue={(vendor.signature_items ?? []).join(", ")} placeholder="e.g. 12-hour brisket, Pulled pork, Burnt-end mac" />
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="faq">FAQ <span className={styles.hint}>(one per line, as: Question | Answer)</span></label>
        <textarea id="faq" name="faq" rows={4} maxLength={4000} className={styles.textarea} defaultValue={(vendor.faq ?? []).filter((f) => f.q && f.a).map((f) => `${f.q} | ${f.a}`).join("\n")} placeholder={"Do you need power on site? | We bring our own generator.\nHow far in advance should I book? | 2–3 weeks for weekends."} />
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="capacity_min">Serves from (guests)</label>
          <input id="capacity_min" name="capacity_min" type="number" min={1} className={styles.input} defaultValue={(vendor.attributes?.capacity_min as number | null) ?? ""} />
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="capacity_max">Up to (guests)</label>
          <input id="capacity_max" name="capacity_max" type="number" min={1} className={styles.input} defaultValue={(vendor.attributes?.capacity_max as number | null) ?? ""} />
        </div>
      </div>

      <div className={styles.row2}>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="price_from">Price from (£)</label>
          <input id="price_from" name="price_from" type="number" min={0} className={styles.input} defaultValue={vendor.price_from ?? ""} />
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="coverage_radius_miles">Coverage (miles)</label>
          <input id="coverage_radius_miles" name="coverage_radius_miles" type="number" min={1} max={100} className={styles.input} defaultValue={vendor.coverage_radius_miles ?? 10} />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.labelText} htmlFor="price_notes">Pricing notes</label>
        <input id="price_notes" name="price_notes" maxLength={500} className={styles.input} defaultValue={vendor.price_notes ?? ""} placeholder="e.g. £14/head, minimum spend £600, serves ~80" />
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
          <label className={styles.labelText} htmlFor="website">Website</label>
          <input id="website" name="website" maxLength={500} className={styles.input} defaultValue={vendor.website ?? ""} placeholder="https://…" />
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="instagram">Instagram</label>
          <input id="instagram" name="instagram" maxLength={100} className={styles.input} defaultValue={vendor.instagram ?? ""} placeholder="@yourhandle" />
        </div>
      </div>

      {state?.error && <div className={`${styles.notice} ${styles.noticeErr}`}>{state.error}</div>}
      {state?.ok && (
        <div className={`${styles.notice} ${styles.noticeOk}`}>
          {vendor.status === "live"
            ? "Saved — your changes are live."
            : "Saved as a draft. Hit Publish (top of the page) to go live and start appearing in search."}
        </div>
      )}

      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? "Saving…" : "Save listing"}
      </button>
    </form>
  );
}
