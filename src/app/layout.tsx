import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Oswald, Geist_Mono } from "next/font/google";
import ShortlistTray from "@/components/shortlist/ShortlistTray";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
const DESCRIPTION =
  "Describe your occasion in plain words. Patch returns a short, reasoned shortlist of mobile food vendors and caterers in London who actually fit.";

/**
 * viewportFit: "cover" lets the page paint into the notch/home-indicator area;
 * the sticky bars then pad themselves back out with env(safe-area-inset-*).
 * userScalable stays true and maximumScale is left alone — capping zoom is a
 * WCAG 1.4.4 failure, and it's the single most common mobile a11y mistake.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EE" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1712" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Patch — mobile food & catering vendors in London",
    template: "%s · Patch",
  },
  description: DESCRIPTION,
  applicationName: "Patch",
  keywords: [
    "mobile food vendors", "London caterers", "street food catering",
    "event catering London", "food trucks", "private party catering",
  ],
  openGraph: {
    type: "website",
    siteName: "Patch",
    locale: "en_GB",
    url: SITE_URL,
    title: "Patch — mobile food & catering vendors in London",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Patch — mobile food & catering vendors in London",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${oswald.variable} ${geistMono.variable}`}>
      <body>
        {/* Visually hidden until focused — first tab stop on every page, so
            keyboard users can jump the header and filters. */}
        <a href="#main-content" className="skipLink">
          Skip to main content
        </a>
        {children}
        <ShortlistTray />
      </body>
    </html>
  );
}
