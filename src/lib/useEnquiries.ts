"use client";

import { useSyncExternalStore, useCallback } from "react";

// Tracks the enquiries a buyer has sent (no account needed) so they can follow
// up and leave a review. Stored locally; the live status is fetched separately.

const KEY = "patch:enquiries";
const EVENT = "patch:enquiries";

export interface EnquiryRecord {
  enquiryId: string;
  vendorName: string;
  vendorSlug: string;
  at: number;
}

function read(): EnquiryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: EnquiryRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const EMPTY: EnquiryRecord[] = [];
let cache: EnquiryRecord[] = EMPTY;
let cacheKey = "";
function getSnapshot(): EnquiryRecord[] {
  const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) || "[]" : "[]";
  if (raw !== cacheKey) {
    cacheKey = raw;
    try {
      cache = JSON.parse(raw);
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

export function useEnquiries() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  const add = useCallback((records: { enquiryId: string; vendorName: string; vendorSlug: string }[]) => {
    if (!records?.length) return;
    const cur = read();
    const seen = new Set(cur.map((r) => r.enquiryId));
    const fresh = records.filter((r) => r.enquiryId && !seen.has(r.enquiryId)).map((r) => ({ ...r, at: Date.now() }));
    if (fresh.length) write([...fresh, ...cur]);
  }, []);

  return { items, add };
}
