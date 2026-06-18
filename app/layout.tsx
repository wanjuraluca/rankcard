import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RankCard",
  description: "Your gaming profile",
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
      <body>{children}</body>
    </html>
  );
}