import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://patch.london";
const DESCRIPTION =
  "Describe your occasion in plain words. Patch returns a short, reasoned shortlist of mobile food vendors and caterers in London who actually fit.";

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
    <html lang="en-GB" className={`${inter.variable} ${bricolage.variable} ${geistMono.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
