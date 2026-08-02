import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteTitle = "RoleCraft AI - Career Intelligence and Trusted Access";
const siteDescription = "Tailor CV evidence, prepare for interviews, discover jobs, and create referral-ready requests through RoleCraft Career Network.";
const siteUrl = "https://rolecraftai.duckdns.org";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#f7efe4]">
        <header className="sticky top-0 z-50 border-b border-amber-900/15 bg-white/90 px-4 py-3 backdrop-blur-xl md:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <a href="/" className="flex items-center gap-3 font-black text-stone-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-900 text-xs text-white">RC</span>
              <span>RoleCraft AI</span>
            </a>
            <nav className="flex items-center gap-2 text-xs font-bold">
              <a href="/" className="rounded-xl px-3 py-2 text-stone-700 hover:bg-amber-50">Career Studio</a>
              <a href="/career-network" className="flex items-center gap-2 rounded-xl bg-amber-900 px-3 py-2 text-white">
                Career Network
                <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] text-amber-950">New</span>
              </a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
