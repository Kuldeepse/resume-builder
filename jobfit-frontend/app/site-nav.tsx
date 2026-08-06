'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, Home, Network, ShieldCheck } from 'lucide-react';
import ThemeToggle from './theme-toggle';

const items = [
  { href: '/', label: 'Studio', desktopLabel: 'Career Studio', icon: Home, match: (pathname: string) => pathname === '/' },
  { href: '/career-network', label: 'Network', desktopLabel: 'Career Network', icon: Network, match: (pathname: string) => pathname.startsWith('/career-network') },
  { href: '/privacy', label: 'Privacy', desktopLabel: 'Privacy', icon: ShieldCheck, match: (pathname: string) => pathname.startsWith('/privacy') },
  { href: '/admin/career-network', label: 'Admin', desktopLabel: 'Admin', icon: BriefcaseBusiness, match: (pathname: string) => pathname.startsWith('/admin/career-network') },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-center gap-2 text-[11px] font-bold md:flex" aria-label="Primary navigation">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'rounded-full bg-[var(--accent)] px-4 py-2 text-white shadow-lg shadow-teal-900/20 hover:bg-[var(--accent-strong)]'
                  : 'rounded-full border border-transparent px-4 py-2 text-[var(--ink-soft)] hover:border-[var(--surface-border)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]'
              }
              aria-current={active ? 'page' : undefined}
            >
              {item.desktopLabel}
            </Link>
          );
        })}
        <ThemeToggle />
      </nav>

      <nav
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] grid grid-cols-5 rounded-[1.5rem] border border-[var(--surface-border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-xl)] backdrop-blur-2xl md:hidden"
        aria-label="Mobile navigation and appearance"
      >
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-extrabold ${
                active ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <ThemeToggle mobileNav />
      </nav>
    </>
  );
}
