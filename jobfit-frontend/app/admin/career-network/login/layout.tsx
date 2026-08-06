import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Private Administration | CogniTwist AI',
  description: 'Private administrator access for the CogniTwist Career Network.',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      noimageindex: true,
    },
  },
};

export default function AdminLoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
