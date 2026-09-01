"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../vendor.module.css";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function AvailabilityManager({ vendorId, initial }: { vendorId: string; initial: string[] }) {
  const [blocked, setBlocked] = useState<Set<string>>(new Set(initial));
  const now = new Date();
  const [view, setView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const today = ymd(now);

  async function toggle(dateStr: string) {
    if (dateStr < today || busy) return;
    setBusy(dateStr);
    setError(null);
    const isBlocked = blocked.has(dateStr);
    const next = new Set(blocked);
    if (isBlocked) next.delete(dateStr);
    else next.add(dateStr);
    setBlocked(next);

    // A silent failure here is commercially dangerous: the calendar would show a
    // date as closed while the DB says it's open (or vice versa), so buyers keep
    // enquiring for a date the vendor thinks they've blocked. Check + roll back.
    const { error: err } = isBlocked
      ? await supabase.from("vendor_blocked_dates").delete().eq("vendor_id", vendorId).eq("blocked_date", dateStr)
      : await supabase.from("vendor_blocked_dates").insert({ vendor_id: vendorId, blocked_date: dateStr, reason: "booked" });

    if (err) {
      setBlocked((cur) => {
        const rolled = new Set(cur);
        if (isBlocked) rolled.add(dateStr); else rolled.delete(dateStr);
        return rolled;
      });
      setError("Couldn't update that date — please try again.");
    }
    setBusy(null);
  }

  const year = view.getFullYear();
  const m = view.getMonth();
  const startDay = (new Date(year, m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const viewIdx = year * 12 + m;
  const canPrev = viewIdx > now.getFullYear() * 12 + now.getMonth();
  const canNext = viewIdx < now.getFullYear() * 12 + now.getMonth() + 11; // ~1 year ahead

  return (
    <div>
      <p className={styles.sub}>
        Tap a date to mark it booked/unavailable. Clients see your availability, so you won&apos;t get enquiries for dates you&apos;ve blocked.
      </p>

      <div className={styles.calHead}>
        <button type="button" className={styles.calNav} disabled={!canPrev} onClick={() => setView(new Date(year, m - 1, 1))} aria-label="Previous month">‹</button>
        <span className={styles.calMonth}>{view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button type="button" className={styles.calNav} disabled={!canNext} onClick={() => setView(new Date(year, m + 1, 1))} aria-label="Next month">›</button>
      </div>

      <div className={styles.calGrid}>
        {DOW.map((d) => <span key={d} className={styles.calDow}>{d}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const ds = ymd(new Date(year, m, d));
          const past = ds < today;
          const isBlocked = blocked.has(ds);
          return (
            <button
              key={ds}
              type="button"
              disabled={past || busy === ds}
              aria-pressed={isBlocked}
              className={`${styles.calDay} ${isBlocked ? styles.calDayBlocked : ""} ${past ? styles.calDayPast : ""}`}
              onClick={() => toggle(ds)}
            >
              {d}
            </button>
          );
        })}
      </div>

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

      <div className={styles.calLegend}>
        <span><span className={`${styles.calDot} ${styles.calDotFree}`} /> Available</span>
        <span><span className={`${styles.calDot} ${styles.calDotBlocked}`} /> Blocked</span>
      </div>
    </div>
  );
}
