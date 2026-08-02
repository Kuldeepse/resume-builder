'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'rolecraft-theme';
const CHANGE_EVENT = 'rolecraft-theme-change';

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: theme }));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const nextTheme = stored === 'dark' || stored === 'light' ? stored : preferred;
    setTheme(nextTheme);
    applyTheme(nextTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!mounted}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all disabled:opacity-60 ${
        theme === 'dark'
          ? 'border-white/10 bg-slate-950/84 text-slate-100 hover:border-cyan-300 hover:bg-slate-900'
          : 'border-[var(--surface-border)] bg-[var(--surface-strong)] text-slate-900 shadow-sm hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]'
      }`}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-3.5 w-3.5" /> Light Mode
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5" /> Dark Mode
        </>
      )}
    </button>
  );
}
