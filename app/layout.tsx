import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { AppProviders } from "@/components/providers";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Site-wide metadata for the public visitor portal.
 *
 * `metadataBase` resolves the relative `openGraph` and `alternates.canonical`
 * values each page declares; set `NEXT_PUBLIC_SITE_URL` in the deployment
 * environment so canonical URLs and social cards point at the real host.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dev Sanskriti Vishwavidyalaya | Visitor & Campus Visit Portal",
    template: "%s · Dev Sanskriti Vishwavidyalaya",
  },
  description:
    "Plan a visit to Dev Sanskriti Vishwavidyalaya, Haridwar, Uttarakhand. Explore the campus, schools and facilities, read the visitor guide, and pre-book your campus visit online.",
  applicationName: "DSVV Visitor Portal",
  keywords: [
    "Dev Sanskriti Vishwavidyalaya",
    "DSVV Haridwar",
    "campus visit",
    "visitor information",
    "pre-book a visit",
    "university visitor portal",
  ],
  authors: [{ name: "Dev Sanskriti Vishwavidyalaya" }],
  icons: {
    icon: "/assets/university-logo.jpg",
    apple: "/assets/university-logo.jpg",
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Dev Sanskriti Vishwavidyalaya — Visitor Portal",
    title: "Dev Sanskriti Vishwavidyalaya | Visitor & Campus Visit Portal",
    description:
      "Explore the DSVV campus at Haridwar and pre-book your campus visit online.",
    locale: "en_IN",
    images: [
      {
        url: "/assets/dsvv/dsvv-campus-entrance.webp",
        width: 1920,
        height: 1280,
        alt: "Shriram Bhawan, the administrative block of Dev Sanskriti Vishwavidyalaya, Haridwar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dev Sanskriti Vishwavidyalaya | Visitor & Campus Visit Portal",
    description:
      "Explore the DSVV campus at Haridwar and pre-book your campus visit online.",
    images: ["/assets/dsvv/dsvv-campus-entrance.webp"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1521" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-background font-sans">
        <a
          href="#main"
          className="sr-only z-[100] focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
