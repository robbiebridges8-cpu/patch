import type { Metadata } from "next";
import VendorAppShell from "./VendorAppShell";

/**
 * The manifest is linked here rather than in the root layout so only /vendor/*
 * is installable. A buyer landing on a listing from Google gets an ordinary
 * website — no install prompt, no service worker, nothing cached. Their journey
 * is search-driven and infrequent; there is nothing for them to install.
 */
export const metadata: Metadata = {
  manifest: "/vendor.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Patch Vendor",
    statusBarStyle: "default",
  },
  robots: { index: false, follow: false },
};

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <VendorAppShell />
      {children}
    </>
  );
}
