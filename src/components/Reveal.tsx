"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Fades + rises its children in when they scroll into view. SSR-safe: the hidden
// state is only applied after mount, so no-JS clients and crawlers render the
// content visible. Above-the-fold children reveal immediately (they're already in
// view); reduced-motion users get the content with no transition (see globals).
export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "hidden" | "in">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only reveal init
      setState("in");
      return;
    }
    // Applying "hidden" only after mount is the whole point: no-JS/SSR stays visible.
    setState("hidden");
    const io = new IntersectionObserver(
      ([entry]) => {
        // Reveal when it enters view, OR when it's already been scrolled past
        // (top < 0) — so an anchor jump or fast scroll never strands content hidden.
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setState("in");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fx = state === "hidden" ? "fx-reveal" : state === "in" ? "fx-reveal is-in" : "";

  return (
    <div
      ref={ref}
      className={`${className} ${fx}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
