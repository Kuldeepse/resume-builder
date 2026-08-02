import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full text-[var(--foreground)]">
        <header className="sticky top-0 z-50 px-4 pt-4 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-xl)] backdrop-blur-2xl md:px-6">
            <a href="/" className="flex items-center gap-3 font-black text-slate-950">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] text-xs text-white shadow-lg shadow-teal-900/20">RC</span>
              <span className="flex flex-col leading-none">
                <span className="text-sm uppercase tracking-[0.24em] text-[var(--ink-soft)]">RoleCraft</span>
                <span className="mt-1 text-lg">Career Network</span>
              </span>
            </a>
            <nav className="flex items-center gap-2 text-xs font-bold">
              <a href="/" className="rounded-full px-4 py-2 text-[var(--ink-soft)] hover:bg-white/70 hover:text-slate-950">Career Studio</a>
              <a href="/career-network" className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-white shadow-lg shadow-teal-900/20 hover:bg-[var(--accent-strong)]">
                Career Network
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-white">Live</span>
              </a>
              <a href="/admin/career-network" className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-[var(--ink-soft)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]">Admin</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
