"use client";

import { useEffect, useRef, useState } from "react";
import { completeOnboarding } from "../dashboard/actions";
import ClaimListingForm from "../dashboard/ClaimListingForm";
import styles from "./onboarding.module.css";

// Suggestions only — free text, so any vertical can list (not just food).
const CATEGORIES = [
  "Pizza", "Street food", "BBQ", "Grazing & cheese", "Cocktail bar", "Coffee cart",
  "Canapés", "Desserts", "Photographer", "DJ", "Florist", "Event hire",
];
const COVERAGE = [
  { label: "Local (5 mi)", value: 5 },
  { label: "10 miles", value: 10 },
  { label: "25 miles", value: 25 },
  { label: "All London (50 mi)", value: 50 },
];
const STORE_KEY = "patch-vendor-onboarding-v1";

type Data = {
  category: string;
  name: string;
  location: string;
  coverage: number;
  priceFrom: string;
  priceNotes: string;
  description: string;
  email: string;
};

const STEPS = ["category", "name", "location", "price", "description", "email", "review"] as const;
type StepKey = (typeof STEPS)[number];

export default function OnboardingWizard({ defaultEmail }: { defaultEmail: string }) {
  const [step, setStep] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug?: string; published: boolean } | null>(null);
  const [d, setD] = useState<Data>({
    category: "", name: "", location: "", coverage: 10,
    priceFrom: "", priceNotes: "", description: "", email: defaultEmail,
  });
  const firstInput = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Restore in-progress answers (a refresh mid-flow shouldn't lose their work).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setD((prev) => ({ ...prev, ...saved.d, email: saved.d?.email || defaultEmail }));
        if (typeof saved.step === "number") setStep(Math.min(saved.step, STEPS.length - 1));
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ d, step })); } catch { /* ignore */ }
  }, [d, step]);

  // Focus the step's input when it changes.
  useEffect(() => { firstInput.current?.focus(); }, [step]);

  const set = (patch: Partial<Data>) => setD((prev) => ({ ...prev, ...patch }));
  const key: StepKey = STEPS[step];

  const canNext = (() => {
    switch (key) {
      case "category": return d.category.trim().length > 0;
      case "name": return d.name.trim().length > 0;
      case "location": return d.location.trim().length > 0;
      case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim());
      default: return true; // price, description, review
    }
  })();
  const skippable = key === "price" || key === "description";

  function next() {
    setError(null);
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }
  function back() { setError(null); setStep((s) => Math.max(0, s - 1)); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && key !== "description" && canNext) { e.preventDefault(); next(); }
  }

  async function publish(shouldPublish: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await completeOnboarding({
      name: d.name,
      category: d.category,
      description: d.description,
      location: d.location,
      coverageMiles: d.coverage,
      priceFrom: d.priceFrom.trim() ? Number(d.priceFrom.replace(/[^\d.]/g, "")) : null,
      priceNotes: d.priceNotes,
      contactEmail: d.email,
      publish: shouldPublish,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error || "Something went wrong. Please try again."); return; }
    try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
    setDone({ slug: res.slug, published: shouldPublish });
  }

  // ── Success ──
  if (done) {
    return (
      <div className={styles.screen}>
        <div className={styles.topbar}>
          <span className={styles.wordmark}>Patch<span className={styles.dot}>.</span></span>
        </div>
        <div className={styles.done}>
          <div className={styles.doneMark}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className={styles.doneTitle}>
            {done.published ? "You're live on Patch! 🎉" : "Your listing is saved"}
          </h1>
          <p className={styles.doneSub}>
            {done.published
              ? <>Buyers searching for what you do can find <strong>{d.name}</strong> right now.</>
              : <><strong>{d.name}</strong> is saved as a draft. Publish it from your dashboard when you&apos;re ready.</>}
          </p>
          <div className={styles.nudge}>
            📸 <strong>Add a photo next.</strong> Listings with photos get far more enquiries — it&apos;s the single biggest thing you can do.
          </div>
          <div className={styles.doneActions}>
            <a className={styles.primary} href="/vendor/dashboard">Add photos &amp; finish up</a>
            {done.published && done.slug && (
              <a className={styles.doneSecondary} href={`/vendors/${done.slug}`}>View your listing</a>
            )}
          </div>
        </div>
      </div>
    );
  }

  const progress = Math.round(((step + (canNext ? 1 : 0)) / STEPS.length) * 100);

  return (
    <div className={styles.screen}>
      <div className={styles.topbar}>
        <span className={styles.wordmark}>Patch<span className={styles.dot}>.</span></span>
        <div className={styles.progressWrap}><div className={styles.progressFill} style={{ width: `${progress}%` }} /></div>
        <a className={styles.exit} href="/">Save &amp; exit</a>
      </div>

      <div className={styles.stage}>
        <div className={styles.panel}>
          <span className={styles.stepMeta}>Step {step + 1} of {STEPS.length}</span>

          {key === "category" && (
            <>
              <h1 className={styles.question}>What do you offer?</h1>
              <p className={styles.help}>Pick the closest match or type your own — this is just how you&apos;ll show up. You can change it any time.</p>
              <div className={styles.fieldWrap}>
                <input ref={firstInput as React.RefObject<HTMLInputElement>} className={styles.bigInput}
                  value={d.category} onChange={(e) => set({ category: e.target.value })} onKeyDown={onKeyDown}
                  placeholder="e.g. Wood-fired pizza, Wedding photographer…" maxLength={100} />
                <div className={styles.chipsLabel}>Popular:</div>
                <div className={styles.chips}>
                  {CATEGORIES.map((c) => (
                    <button type="button" key={c}
                      className={`${styles.chip} ${d.category === c ? styles.chipOn : ""}`}
                      onClick={() => set({ category: c })}>{c}</button>
                  ))}
                </div>
              </div>
              {!claiming ? (
                <p className={styles.claimLink}>
                  Already have a listing on Patch? <button type="button" onClick={() => setClaiming(true)}>Claim it instead</button>
                </p>
              ) : (
                <div className={styles.fieldWrap}><ClaimListingForm /></div>
              )}
            </>
          )}

          {key === "name" && (
            <>
              <h1 className={styles.question}>What&apos;s your business called?</h1>
              <p className={styles.help}>The name buyers will see on your listing.</p>
              <div className={styles.fieldWrap}>
                <input ref={firstInput as React.RefObject<HTMLInputElement>} className={styles.bigInput}
                  value={d.name} onChange={(e) => set({ name: e.target.value })} onKeyDown={onKeyDown}
                  placeholder="e.g. Smoke &amp; Bones" maxLength={200} autoComplete="off" />
              </div>
            </>
          )}

          {key === "location" && (
            <>
              <h1 className={styles.question}>Where are you based?</h1>
              <p className={styles.help}>We use this to match you to nearby events. An area or postcode is fine.</p>
              <div className={styles.fieldWrap}>
                <input ref={firstInput as React.RefObject<HTMLInputElement>} className={styles.bigInput}
                  value={d.location} onChange={(e) => set({ location: e.target.value })} onKeyDown={onKeyDown}
                  placeholder="e.g. Hackney, or E8 3RL" maxLength={60} autoComplete="off" />
                <div className={styles.chipsLabel}>How far will you travel?</div>
                <div className={styles.chips}>
                  {COVERAGE.map((c) => (
                    <button type="button" key={c.value}
                      className={`${styles.chip} ${d.coverage === c.value ? styles.chipOn : ""}`}
                      onClick={() => set({ coverage: c.value })}>{c.label}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {key === "price" && (
            <>
              <h1 className={styles.question}>What&apos;s your starting price?</h1>
              <p className={styles.help}>A rough &ldquo;from&rdquo; price helps buyers self-qualify — you&apos;ll still quote each job properly. Skip if it varies too much.</p>
              <div className={styles.fieldWrap}>
                <div className={styles.prefixRow}>
                  <span className={styles.prefix}>£</span>
                  <input ref={firstInput as React.RefObject<HTMLInputElement>} className={styles.bigInput}
                    value={d.priceFrom} onChange={(e) => set({ priceFrom: e.target.value.replace(/[^\d.]/g, "") })}
                    onKeyDown={onKeyDown} inputMode="decimal" placeholder="600" />
                </div>
                <input className={styles.subInput} value={d.priceNotes}
                  onChange={(e) => set({ priceNotes: e.target.value })}
                  placeholder="Optional — e.g. £14/head, minimum spend £600" maxLength={500} />
              </div>
            </>
          )}

          {key === "description" && (
            <>
              <h1 className={styles.question}>Tell buyers what makes you great.</h1>
              <p className={styles.help}>One or two lines. What you do, and why people love it — this is what wins the enquiry.</p>
              <div className={styles.fieldWrap}>
                <textarea ref={firstInput as React.RefObject<HTMLTextAreaElement>} className={styles.bigTextarea}
                  value={d.description} onChange={(e) => set({ description: e.target.value })}
                  placeholder="e.g. Neapolitan pizza from a converted horse trailer — 90-second bakes, proper 00 flour, and a crust people talk about."
                  maxLength={2000} rows={4} />
              </div>
            </>
          )}

          {key === "email" && (
            <>
              <h1 className={styles.question}>Where should we send your leads?</h1>
              <p className={styles.help}>When a buyer enquires, we email you the details here. We&apos;ve pre-filled your account email — change it if leads should go elsewhere.</p>
              <div className={styles.fieldWrap}>
                <input ref={firstInput as React.RefObject<HTMLInputElement>} className={styles.bigInput}
                  type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} onKeyDown={onKeyDown}
                  placeholder="you@yourbusiness.com" maxLength={320} autoComplete="email" />
              </div>
            </>
          )}

          {key === "review" && (
            <>
              <h1 className={styles.question}>Ready to go live?</h1>
              <p className={styles.help}>Here&apos;s how buyers will see you. You can edit anything later from your dashboard.</p>
              <div className={styles.mobilePreview}><PreviewCard d={d} /></div>
              <div className={styles.reviewList}>
                <ReviewRow k="Offers" v={d.category} onEdit={() => setStep(0)} />
                <ReviewRow k="Name" v={d.name} onEdit={() => setStep(1)} />
                <ReviewRow k="Based in" v={d.location ? `${d.location} · covers ${d.coverage} mi` : ""} onEdit={() => setStep(2)} />
                <ReviewRow k="From" v={d.priceFrom ? `£${d.priceFrom}` : ""} onEdit={() => setStep(3)} />
                <ReviewRow k="Leads to" v={d.email} onEdit={() => setStep(5)} />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.nav}>
                <button type="button" className={styles.back} onClick={back} disabled={submitting}>Back</button>
                <button type="button" className={styles.primary} onClick={() => publish(true)} disabled={submitting}>
                  {submitting ? "Publishing…" : "Publish my listing"}
                </button>
                <button type="button" className={styles.skip} onClick={() => publish(false)} disabled={submitting}>
                  Save as draft
                </button>
              </div>
            </>
          )}

          {key !== "review" && (
            <>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.nav}>
                {step > 0 && <button type="button" className={styles.back} onClick={back}>Back</button>}
                <button type="button" className={styles.primary} onClick={next} disabled={!canNext}>
                  Continue
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
                {skippable && <button type="button" className={styles.skip} onClick={next}>Skip</button>}
              </div>
              <p className={styles.enterHint}>press <kbd>Enter</kbd> to continue</p>
            </>
          )}
        </div>

        <div className={styles.previewCol}>
          <div className={styles.previewLabel}>Live preview</div>
          <PreviewCard d={d} />
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ k, v, onEdit }: { k: string; v: string; onEdit: () => void }) {
  return (
    <div className={styles.reviewRow}>
      <span className={styles.reviewKey}>{k}</span>
      <span className={`${styles.reviewVal} ${v ? "" : styles.empty}`}>{v || "Not added"}</span>
      <button type="button" className={styles.reviewEdit} onClick={onEdit}>Edit</button>
    </div>
  );
}

function PreviewCard({ d }: { d: Data }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardMedia}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
        Your photo goes here
      </div>
      <div className={styles.cardBody}>
        <span className={styles.cardCat}>{d.category || "Your service"}</span>
        <h3 className={styles.cardName}>{d.name || "Your business name"}</h3>
        <div className={styles.cardMeta}>
          {d.location || "Your area"}
          {d.priceFrom ? ` · from £${d.priceFrom}` : ""}
        </div>
        <p className={`${styles.cardDesc} ${d.description ? "" : styles.cardPlaceholder}`}>
          {d.description || "A line about what you do and why people love it will appear here."}
        </p>
        <span className={styles.cardCta}>Send an enquiry</span>
      </div>
    </div>
  );
}
