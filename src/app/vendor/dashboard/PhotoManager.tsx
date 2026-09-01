"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../vendor.module.css";

interface Photo { id: string; url: string; }

export default function PhotoManager({
  vendorId,
  initial,
  limit,
}: {
  vendorId: string;
  initial: Photo[];
  /** Free listings get one photo — an empty card helps nobody, a gallery is paid. */
  limit?: number;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const atLimit = limit != null && photos.length >= limit;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      if (photos.length + 0 >= (limit ?? Infinity)) break; // safety, though button is swapped at limit
      if (file.size > 5 * 1024 * 1024) {
        failed.push(`${file.name} (over 5MB)`);
        continue;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${vendorId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vendor-photos").upload(path, file);
      if (upErr) { failed.push(file.name); continue; }
      const url = supabase.storage.from("vendor-photos").getPublicUrl(path).data.publicUrl;
      const { data: row, error: insErr } = await supabase
        .from("vendor_photos")
        .insert({ vendor_id: vendorId, url, position: photos.length })
        .select("id, url")
        .single();
      if (insErr || !row) { failed.push(file.name); continue; }
      setPhotos((p) => [...p, row as Photo]);
    }
    // Human copy, aggregated — never a raw storage/Postgres string, and never
    // just the last failure.
    if (failed.length) {
      setError(`Couldn't upload ${failed.join(", ")}. Please try again.`);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Promote a photo to the cover (position 0) and persist the new order. This is
  // the merchandising lever — the old manager could only append + delete.
  async function makeCover(photo: Photo) {
    const reordered = [photo, ...photos.filter((x) => x.id !== photo.id)];
    setPhotos(reordered);
    setError(null);
    const results = await Promise.all(
      reordered.map((p, i) => supabase.from("vendor_photos").update({ position: i }).eq("id", p.id)),
    );
    if (results.some((r) => r.error)) setError("Couldn't reorder your photos — please try again.");
  }

  async function remove(photo: Photo) {
    if (!window.confirm("Remove this photo? This can't be undone.")) return;
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    setError(null);
    const { error: delErr } = await supabase.from("vendor_photos").delete().eq("id", photo.id);
    if (delErr) {
      setPhotos(prev); // roll back — the photo is still there
      setError("Couldn't remove that photo — please try again.");
      return;
    }
    const marker = "/vendor-photos/";
    const i = photo.url.indexOf(marker);
    if (i >= 0) await supabase.storage.from("vendor-photos").remove([photo.url.slice(i + marker.length)]);
  }

  return (
    <div>
      <p className={styles.sub}>
        Real photos win bookings. Add a few of your work and setup — the first one is your cover.
      </p>

      {photos.length > 0 && (
        <div className={styles.photoGrid}>
          {photos.map((p, i) => (
            <div key={p.id} className={styles.photoThumb}>
              <Image src={p.url} alt="" fill sizes="(max-width: 640px) 45vw, 180px" />
              {i === 0 ? (
                <span className={styles.coverTag}>Cover</span>
              ) : (
                <button type="button" className={styles.makeCover} onClick={() => makeCover(p)}>Make cover</button>
              )}
              <button type="button" className={styles.photoRemove} data-touch-target aria-label="Remove photo" onClick={() => remove(p)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: "none" }}
      />

      {atLimit ? (
        <div className={styles.photoLimit}>
          <span>Free listings show {limit} photo{limit === 1 ? "" : "s"}. A full gallery is part of a paid plan.</span>
          <a href="#billing" className={styles.btn}>Upgrade to add more photos</a>
        </div>
      ) : (
        <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Uploading…" : photos.length ? "Add more photos" : "Upload photos"}
        </button>
      )}
    </div>
  );
}
