"use client";

import { useEffect } from "react";
import { trackOnce } from "@/lib/track";
import { track as analytics } from "@/lib/analytics";

/** Renders nothing — logs one profile view per session for this listing. */
export default function TrackProfileView({ vendorId, slug = "" }: { vendorId: string; slug?: string }) {
  useEffect(() => {
    // Two different consumers: the vendor's own traffic counter, and our
    // product analytics. Deliberately separate — see src/lib/analytics.ts.
    trackOnce(vendorId, "profile_view");
    analytics({ name: "vendor_viewed", vendorId, slug });
  }, [vendorId, slug]);

  return null;
}
