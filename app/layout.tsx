import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import FeedbackWidget from "./components/FeedbackWidget";
import StatusBanner from "./components/StatusBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rankcard.app"),
  title: {
    default: "RankCard: All your ranks. One profile.",
    template: "%s · RankCard",
  },
  description: "Connect League, TFT, Valorant, CS2, Overwatch and Marvel Rivals into one clean, shareable profile with real ranks and deep stats.",
  icons: {
    icon: "/Icons/favicon.png?v=4",
  },
  openGraph: {
    type: "website",
    siteName: "RankCard",
    title: "RankCard: All your ranks. One profile.",
    description: "Connect League, TFT, Valorant, CS2, Overwatch and Marvel Rivals into one clean, shareable profile with real ranks and deep stats.",
  },
  twitter: {
    card: "summary_large_image",
    title: "RankCard: All your ranks. One profile.",
    description: "Connect League, TFT, Valorant, CS2, Overwatch and Marvel Rivals into one clean, shareable profile with real ranks and deep stats.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "GKCdaZM7aZBqNOrbaitjKXNs-6IwioNzTgpB_6oHi9Y",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <StatusBanner />
        {children}
        <FeedbackWidget />
        <Analytics />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6448981035028851"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}