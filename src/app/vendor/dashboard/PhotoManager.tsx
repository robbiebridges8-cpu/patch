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
    if (atLimit) {
      setError(`Free listings can show ${limit} photo${limit === 1 ? "" : "s"}. Upgrade to add a gallery.`);
      return;
    }
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is over 5MB — please use a smaller image.`);
        continue;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${vendorId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("vendor-photos").upload(path, file);
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      const url = supabase.storage.from("vendor-photos").getPublicUrl(path).data.publicUrl;
      const { data: row, error: insErr } = await supabase
        .from("vendor_photos")
        .insert({ vendor_id: vendorId, url, position: photos.length })
        .select("id, url")
        .single();
      if (insErr) setError(insErr.message);
      else if (row) setPhotos((p) => [...p, row as Photo]);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(photo: Photo) {
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    await supabase.from("vendor_photos").delete().eq("id", photo.id);
    const marker = "/vendor-photos/";
    const i = photo.url.indexOf(marker);
    if (i >= 0) await supabase.storage.from("vendor-photos").remove([photo.url.slice(i + marker.length)]);
  }

  return (
    <div>
      <p className={styles.sub}>
        Real photos win bookings. Add a few of your food and setup — the first one is your cover.
      </p>

      {photos.length > 0 && (
        <div className={styles.photoGrid}>
          {photos.map((p, i) => (
            <div key={p.id} className={styles.photoThumb}>
              <Image src={p.url} alt="" fill sizes="(max-width: 640px) 45vw, 180px" />
              {i === 0 && <span className={styles.coverTag}>Cover</span>}
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
      <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Uploading…" : photos.length ? "Add more photos" : "Upload photos"}
      </button>
    </div>
  );
}
