import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import FeedbackWidget from "./components/FeedbackWidget";
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
  title: "RankCard — All your ranks. One profile.",
  description: "Connect League, Valorant and CS2 into one clean, shareable profile with real ranks and deep stats.",
  icons: {
  icon: "/Icons/LogoSmall.png?v=2",
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
        {children}
        <FeedbackWidget />
        <Analytics />
      </body>
    </html>
  );
}