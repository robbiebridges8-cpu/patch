"use client";

import { useEffect } from "react";
import { trackOnce } from "@/lib/track";

/** Renders nothing — logs one profile view per session for this listing. */
export default function TrackProfileView({ vendorId }: { vendorId: string }) {
  useEffect(() => {
    trackOnce(vendorId, "profile_view");
  }, [vendorId]);

  return null;
}
