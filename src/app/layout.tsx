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

export const metadata: Metadata = {
  title: "Patch — mobile food & catering vendors in London",
  description: "Describe your occasion in plain words. Patch returns a short, reasoned shortlist of mobile food vendors who actually fit.",
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
