"use client";

import { useRouter, useSearchParams } from "next/navigation";
import styles from "./SortDropdown.module.css";

const OPTIONS = [
  { value: "best", label: "Best match" },
  { value: "rating", label: "Highest rated" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
];

export default function SortDropdown({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === "best") params.delete("sort");
    else params.set("sort", e.target.value);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <select className={styles.sort} value={current} onChange={handleChange}>
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
