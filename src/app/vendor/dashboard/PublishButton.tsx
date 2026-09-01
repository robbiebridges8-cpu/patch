"use client";

import { useTransition } from "react";
import { publishListing } from "./actions";
import styles from "../vendor.module.css";

export default function PublishButton({ vendorId, blockingCount = 0 }: { vendorId: string; blockingCount?: number }) {
  const [pending, start] = useTransition();
  const blocked = blockingCount > 0;
  return (
    <button
      type="button"
      className={styles.btn}
      disabled={pending || blocked}
      title={blocked ? "Finish the essential fields first" : undefined}
      onClick={() => !blocked && start(async () => { await publishListing(vendorId); })}
    >
      {pending
        ? "Publishing…"
        : blocked
          ? `Add ${blockingCount} essential${blockingCount > 1 ? "s" : ""} to publish`
          : "Publish listing"}
    </button>
  );
}
