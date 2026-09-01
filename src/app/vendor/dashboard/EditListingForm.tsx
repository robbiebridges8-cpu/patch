"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateListing, type ActionState } from "./actions";
import styles from "../vendor.module.css";

// Suggestions only — free text so any vertical can list.
const CATEGORIES = [
  "Pizza", "Street food", "BBQ", "Grazing & cheese", "Coffee", "Desserts",
  "Cocktail bar", "Canapés", "Photographer", "DJ", "Florist", "Cleaner",
  "Mobile bar", "Entertainer", "Event hire",
];
const DIETARY = ["vegetarian", "vegan", "gluten-free", "halal", "dairy-free", "nut-free"];

interface Pair { a: string; b: string; }

/**
 * A set of paired inputs that serialises to the legacy "A | B" line format in a
 * hidden field — so the vendor never types a delimiter, but updateListing's
 * parser is unchanged.
 */
function RepeatableRows({
  name, aLabel, bLabel, aPlaceholder, bPlaceholder, addLabel, initial,
}: {
  name: string; aLabel: string; bLabel: string;
  aPlaceholder: string; bPlaceholder: string; addLabel: string; initial: Pair[];
}) {
  const [rows, setRows] = useState<Pair[]>(initial.length ? initial : [{ a: "", b: "" }]);
  const serialized = rows
    .filter((r) => r.a.trim() && r.b.trim())
    .map((r) => `${r.a.trim()} | ${r.b.trim()}`)
    .join("\n");

  const update = (i: number, patch: Partial<Pair>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className={styles.repWrap}>
      <input type="hidden" name={name} value={serialized} />
      {rows.map((r, i) => (
        <div key={i} className={styles.repRow}>
          <input
            className={styles.input} value={r.a} aria-label={aLabel}
            placeholder={aPlaceholder} maxLength={200}
            onChange={(e) => update(i, { a: e.target.value })}
          />
          <input
            className={styles.input} value={r.b} aria-label={bLabel}
            placeholder={bPlaceholder} maxLength={400}
            onChange={(e) => update(i, { b: e.target.value })}
          />
          <button type="button" className={styles.repRemove} aria-label="Remove row"
            onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ a: "", b: "" }]))}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
      <button type="button" className={styles.repAdd} onClick={() => setRows((rs) => [...rs, { a: "", b: "" }])}>
        + {addLabel}
      </button>
    </div>
  );
}

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
  const [dirty, setDirty] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);

  const attrs = vendor.attributes ?? {};
  const diet = new Set(Array.isArray(attrs.dietary) ? (attrs.dietary as string[]) : []);
  const RESERVED = new Set(["dietary", "capacity_min", "capacity_max", "vibe", "good_for"]);
  const extraRows: Pair[] = Object.entries(attrs)
    .filter(([k, v]) => !RESERVED.has(k) && v != null && v !== "")
    .map(([k, v]) => ({ a: k.replace(/_/g, " "), b: Array.isArray(v) ? v.join(", ") : String(v) }));
  const faqRows: Pair[] = (vendor.faq ?? [])
    .filter((f) => f.q && f.a)
    .map((f) => ({ a: f.q!, b: f.a! }));

  // Unsaved-changes guard. Photos + Availability autosave right below this form,
  // so without this a vendor who edits a field then uploads a photo (which
  // "sticks") reasonably assumes everything saved — and loses their edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (state?.ok) setDirty(false);
    if (state) noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state]);

  return (
    <form action={action} onInput={() => setDirty(true)} onSubmit={() => setDirty(false)}>
      <input type="hidden" name="vendorId" value={vendor.id} />

      {/* ── Basics ── */}
      <div className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>The basics</h3>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="name">Business name *</label>
            <input id="name" name="name" required maxLength={200} className={styles.input} defaultValue={vendor.name ?? ""} />
          </div>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="category">What you do</label>
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
      </div>

      {/* ── Pricing & reach ── */}
      <div className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>Pricing &amp; reach</h3>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="price_from">Price from (£)</label>
            <input id="price_from" name="price_from" type="number" min={0} className={styles.input} defaultValue={vendor.price_from ?? ""} />
          </div>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="coverage_radius_miles">How far you travel (miles)</label>
            <input id="coverage_radius_miles" name="coverage_radius_miles" type="number" min={1} max={100} className={styles.input} defaultValue={vendor.coverage_radius_miles ?? 10} />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="price_notes">Pricing notes</label>
          <input id="price_notes" name="price_notes" maxLength={500} className={styles.input} defaultValue={vendor.price_notes ?? ""} placeholder="e.g. £14/head, minimum spend £600, serves ~80" />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="capacity_min">Group size from</label>
            <input id="capacity_min" name="capacity_min" type="number" min={1} className={styles.input} defaultValue={(attrs.capacity_min as number | null) ?? ""} placeholder="guests" />
          </div>
          <div className={styles.field}>
            <label className={styles.labelText} htmlFor="capacity_max">Up to</label>
            <input id="capacity_max" name="capacity_max" type="number" min={1} className={styles.input} defaultValue={(attrs.capacity_max as number | null) ?? ""} placeholder="guests" />
          </div>
        </div>
      </div>

      {/* ── Contact ── */}
      <div className={styles.formSection}>
        <h3 className={styles.formSectionTitle}>How clients reach you</h3>
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
      </div>

      {/* ── Optional extras — collapsed so first-run isn't a wall ── */}
      <details className={styles.moreDetail}>
        <summary className={styles.moreSummary}>Add more detail <span className={styles.hint}>(optional — sharpens how you match)</span></summary>

        <fieldset className={styles.fieldset}>
          <legend className={styles.labelText}>Dietary options <span className={styles.hint}>(for food &amp; drink)</span></legend>
          <div className={styles.chipCheckRow}>
            {DIETARY.map((d) => (
              <label key={d} className={styles.chipCheck}>
                <input type="checkbox" name="dietary" value={d} defaultChecked={diet.has(d)} />
                <span>{d.charAt(0).toUpperCase() + d.slice(1)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="signature_items">Signature items <span className={styles.hint}>(comma-separated)</span></label>
          <input id="signature_items" name="signature_items" maxLength={1000} className={styles.input} defaultValue={(vendor.signature_items ?? []).join(", ")} placeholder="e.g. 12-hour brisket, Pulled pork, Burnt-end mac" />
        </div>

        <div className={styles.field}>
          <label className={styles.labelText} htmlFor="vibe">Words clients might use <span className={styles.hint}>(comma-separated — style, occasion, feel)</span></label>
          <input id="vibe" name="vibe" maxLength={500} className={styles.input} defaultValue={(Array.isArray(attrs.vibe) ? (attrs.vibe as string[]) : []).join(", ")} placeholder="e.g. wedding-ready, relaxed, interactive" />
        </div>

        <div className={styles.field}>
          <span className={styles.labelText}>Anything else worth knowing</span>
          <p className={styles.hint} style={{ margin: "2px 0 8px" }}>Certifications, equipment, licences — a short label and the detail.</p>
          <RepeatableRows
            name="attributes" aLabel="Label" bLabel="Detail"
            aPlaceholder="e.g. Gas Safe" bPlaceholder="e.g. 123456"
            addLabel="Add another" initial={extraRows}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.labelText}>FAQs</span>
          <p className={styles.hint} style={{ margin: "2px 0 8px" }}>Answer the questions clients always ask.</p>
          <RepeatableRows
            name="faq" aLabel="Question" bLabel="Answer"
            aPlaceholder="Do you need power on site?" bPlaceholder="We bring our own generator."
            addLabel="Add a question" initial={faqRows}
          />
        </div>
      </details>

      <div ref={noticeRef}>
        {state?.error && <div className={`${styles.notice} ${styles.noticeErr}`}>{state.error}</div>}
        {state?.ok && (
          <div className={`${styles.notice} ${styles.noticeOk}`}>
            {vendor.status === "live"
              ? "Saved — your changes are live."
              : "Saved as a draft. Hit Publish (top of the page) to go live and start appearing in search."}
          </div>
        )}
      </div>

      <button type="submit" className={styles.btn} disabled={pending}>
        {pending ? "Saving…" : dirty ? "Save changes" : "Save listing"}
      </button>
    </form>
  );
}
