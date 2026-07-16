"use client";

import { useTransition } from "react";
import { publishListing } from "./actions";
import styles from "../vendor.module.css";

export default function PublishButton({ vendorId }: { vendorId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={styles.btn}
      disabled={pending}
      onClick={() => start(async () => { await publishListing(vendorId); })}
    >
      {pending ? "Publishing…" : "Publish listing"}
    </button>
  );
}
