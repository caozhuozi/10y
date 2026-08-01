import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.PAGES_BASE_PATH ?? "";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const canonicalUrl = `${siteUrl.replace(/\/$/, "")}/`;
const socialImage = new URL(`${basePath}/og.png`, siteUrl).toString();
const favicon = new URL(`${basePath}/favicon.svg`, siteUrl).toString();
const description =
  "A personal ten-year sleep heatmap: one day, one tile, tracing nights already lived against the nights still ahead.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: canonicalUrl,
  },
  icons: {
    icon: [{ url: favicon, type: "image/svg+xml" }],
    shortcut: favicon,
  },
  title: "sleep is all you need — a ten-year sleep heatmap",
  description,
  keywords: [
    "sleep heatmap",
    "sleep visualization",
    "personal sleep data",
    "sleep tracking",
    "sleep diary",
    "quantified self",
    "data art",
    "Fitbit sleep",
    "ten-year sleep project",
  ],
  openGraph: {
    title: "Sleep is all you need",
    description,
    images: [socialImage],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sleep is all you need",
    description,
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
