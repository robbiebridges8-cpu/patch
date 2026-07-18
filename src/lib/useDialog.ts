"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Everything a modal dialog owes a keyboard or screen-reader user: Escape to
 * close, focus moved in on open and restored to the trigger on close, Tab
 * cycled within the dialog, and the page behind it locked from scrolling.
 *
 * Without the trap, Tab walks straight out of the dialog into the page
 * underneath while the overlay still covers it — focus goes somewhere the user
 * can't see.
 */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  // Kept in a ref so a caller passing an inline arrow doesn't re-run the effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const node = ref.current;

    // Remember where focus came from so we can hand it back on close.
    const previous = document.activeElement as HTMLElement | null;

    // Move focus into the dialog — first real control, else the dialog itself.
    if (node) {
      const first = focusable(node)[0];
      if (first) {
        first.focus();
      } else {
        node.setAttribute("tabindex", "-1");
        node.focus();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;

      const items = focusable(node);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped entirely.
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger, but only if the user hasn't already moved
      // it somewhere deliberate. By the time this cleanup runs React has
      // usually detached the dialog, so focus has fallen back to <body> — that
      // counts as lost, not as a deliberate move.
      const active = document.activeElement as HTMLElement | null;
      const focusWasLost =
        !active || active === document.body || (!!node && node.contains(active));

      if (previous?.isConnected && focusWasLost) {
        previous.focus();
      }
    };
  }, [open, ref]);
}
