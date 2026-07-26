import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.PAGES_BASE_PATH ?? "";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const socialImage = new URL(`${basePath}/og.png`, siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sleep — Xudong Wang",
  description: "Five years of sleep, one tile per day.",
  openGraph: {
    title: "Sleep is all you need",
    description: "Five years of sleep, one tile per day.",
    images: [socialImage],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sleep is all you need",
    description: "Five years of sleep, one tile per day.",
    images: [socialImage],
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
