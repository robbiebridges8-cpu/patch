"use client";

import { track, type TrackEvent } from "@/lib/track";

/**
 * An outbound link that logs the click first. Uses sendBeacon under the hood,
 * so the event survives the browser navigating away.
 */
export default function TrackedLink({
  vendorId,
  event,
  href,
  className,
  children,
}: {
  vendorId: string;
  event: TrackEvent;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track(vendorId, event)}
    >
      {children}
    </a>
  );
}
