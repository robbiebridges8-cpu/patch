"use client";

import { useEffect } from "react";

/**
 * Registers the vendor service worker. Renders nothing.
 *
 * Deliberately scoped to /vendor/ — the worker file lives at the root so it can
 * be served with the Service-Worker-Allowed header, but it must never control
 * buyer pages.
 */
export default function VendorAppShell() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registration failing is not worth surfacing: the dashboard works fine as
    // a normal page, it just won't be installable or push-capable.
    navigator.serviceWorker
      .register("/vendor-sw.js", { scope: "/vendor/" })
      .catch((err) => console.warn("[vendor-sw] registration failed:", err));
  }, []);

  return null;
}
