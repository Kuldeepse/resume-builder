import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import SiteNav from "./site-nav";
import PwaRegister from "./pwa-register";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-cognitwist-sans",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-cognitwist-display",
});

const siteTitle = "CogniTwist AI - Career Intelligence and Trusted Access";
const siteDescription = "Tailor CV evidence, prepare for interviews, discover jobs, and create referral-ready requests through CogniTwist AI Career Network.";
const siteUrl = "https://cognitwistai.duckdns.org";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: "CogniTwist AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CogniTwist AI",
  },
  formatDetection: {
    telephone: false,
  },
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
  alternates: { canonical: siteUrl },
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
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "CogniTwist AI social preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} min-h-full pb-[calc(5.25rem+env(safe-area-inset-bottom))] text-[var(--foreground)] md:pb-0`}>
        <PwaRegister />
        <header className="sticky top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-8 md:pt-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-3 shadow-[var(--shadow-xl)] backdrop-blur-2xl md:rounded-[2rem] md:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3 font-black text-slate-950">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] text-xs text-white shadow-lg shadow-teal-900/20 md:h-11 md:w-11">CT</span>
              <span className="flex min-w-0 flex-col leading-none">
                <span className="truncate text-xs tracking-[0.04em] text-[var(--ink-soft)] md:text-sm">CogniTwist AI</span>
                <span className="mt-1 truncate font-[var(--font-cognitwist-display)] text-sm tracking-[-0.02em] md:text-lg">Career Network</span>
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
