'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './theme-toggle';

const items = [
  { href: '/', label: 'Career Studio', match: (pathname: string) => pathname === '/' },
  { href: '/career-network', label: 'Career Network', match: (pathname: string) => pathname.startsWith('/career-network') },
  { href: '/admin/career-network', label: 'Admin', match: (pathname: string) => pathname.startsWith('/admin/career-network') },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 text-[11px] font-bold">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? 'rounded-full bg-[var(--accent)] px-4 py-2 text-white shadow-lg shadow-teal-900/20 hover:bg-[var(--accent-strong)]'
                : 'rounded-full border border-transparent px-4 py-2 text-[var(--ink-soft)] hover:border-[var(--surface-border)] hover:bg-white/70 hover:text-slate-950'
            }
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
      <ThemeToggle />
    </nav>
  );
}
