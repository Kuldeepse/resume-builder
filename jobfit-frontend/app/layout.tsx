import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import SiteNav from "./site-nav";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-rolecraft-sans",
});

const displayFont = Sora({
  subsets: ["latin"],
  variable: "--font-rolecraft-display",
});

const siteTitle = "RoleCraft AI - Career Intelligence and Trusted Access";
const siteDescription = "Tailor CV evidence, prepare for interviews, discover jobs, and create referral-ready requests through RoleCraft Career Network.";
const siteUrl = "https://rolecraftai.duckdns.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: "RoleCraft AI",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "RoleCraft AI social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/opengraph-image"],
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] text-xs text-white shadow-lg shadow-teal-900/20">RC</span>
              <span className="flex flex-col leading-none">
                <span className="text-sm uppercase tracking-[0.24em] text-[var(--ink-soft)]">RoleCraft</span>
                <span className="mt-1 font-[var(--font-rolecraft-display)] text-base tracking-[-0.02em] md:text-lg">Career Network</span>
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
