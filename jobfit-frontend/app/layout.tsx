import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteTitle = "CogniTwist AI - Career Intelligence and Trusted Connections";
const siteDescription =
  "Build stronger applications, prepare for interviews, and connect through a private career network with CogniTwist AI.";
const siteUrl = "https://cognitwistai.duckdns.org";

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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
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
      url: "/cognitwist-ai-share-v1.png",
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
  images: ["/cognitwist-ai-share-v1.png"],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
