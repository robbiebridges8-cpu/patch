"use client";

import { useSyncExternalStore, useCallback } from "react";

// A persistent, login-free shortlist backed by localStorage. Any component can
// read/subscribe via useShortlist(); changes broadcast so the save button, the
// sticky tray, and the shortlist page all stay in sync (across tabs too).

const KEY = "patch:shortlist";
const EVENT = "patch:shortlist";

export interface ShortlistItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  photoUrl: string;
  priceLabel: string;
}

function read(): ShortlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: ShortlistItem[]) {
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

// Cache the parsed snapshot keyed by the raw string so useSyncExternalStore gets
// a stable reference when nothing changed (avoids an infinite render loop).
const EMPTY: ShortlistItem[] = [];
let cache: ShortlistItem[] = EMPTY;
let cacheKey = "";
function getSnapshot(): ShortlistItem[] {
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
function getServerSnapshot(): ShortlistItem[] {
  return EMPTY;
}

export function useShortlist() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const has = useCallback((slug: string) => items.some((i) => i.slug === slug), [items]);
  const toggle = useCallback((item: ShortlistItem) => {
    const cur = read();
    write(cur.some((i) => i.slug === item.slug) ? cur.filter((i) => i.slug !== item.slug) : [...cur, item]);
  }, []);
  const remove = useCallback((slug: string) => write(read().filter((i) => i.slug !== slug)), []);
  const clear = useCallback(() => write([]), []);

  return { items, has, toggle, remove, clear };
}
