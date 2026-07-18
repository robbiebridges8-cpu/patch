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
  ...rest
}: {
  vendorId: string;
  event: TrackEvent;
  href: string;
  className?: string;
  children: React.ReactNode;
  /** Remaining anchor attributes are forwarded — without this, callers pass
   *  things like data-* or aria-* and they vanish with no error. */
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track(vendorId, event)}
      {...rest}
    >
      {children}
    </a>
  );
}
