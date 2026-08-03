import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import SiteNav from "./site-nav";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-cognitwist-sans",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-cognitwist-display",
});

const siteTitle = "CogniTwist AI - Career Intelligence and Trusted Connections";
const siteDescription = "Build stronger applications, prepare for interviews, discover jobs, and connect through the private CogniTwist AI Career Network.";
const siteUrl = "https://cognitwistai.duckdns.org";
const socialImageUrl = `${siteUrl}/cognitwist-ai-share-v2`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "CogniTwist AI",
  keywords: [
    "AI resume builder",
    "career network",
    "job referrals UK",
    "interview preparation",
    "job search platform",
    "CogniTwist AI",
  ],
  authors: [{ name: "Kuldeep Sharma" }],
  creator: "Kuldeep Sharma",
  publisher: "CogniTwist AI",
  category: "career technology",
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      "MqfH-9HghpvJxRjii6AV3XIle2_PshtjJeZpqpw7aA4",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "CogniTwist AI",
    type: "website",
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: "CogniTwist AI — Career Intelligence and Trusted Connections",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-full text-[var(--foreground)]`}>
        <header className="sticky top-0 z-50 px-4 pt-4 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-xl)] backdrop-blur-2xl md:px-6">
            <Link href="/" className="flex items-center gap-3 font-black text-slate-950">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] text-xs text-white shadow-lg shadow-teal-900/20">CT</span>
              <span className="flex flex-col leading-none">
                <span className="text-sm tracking-[0.04em] text-[var(--ink-soft)]">CogniTwist AI</span>
                <span className="mt-1 font-[var(--font-cognitwist-display)] text-base tracking-[-0.02em] md:text-lg">Career Network</span>
              </span>
            </Link>
            <SiteNav />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
