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
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] bg-white/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--foreground)] transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-3.5 w-3.5" /> Light Theme
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5" /> Dark Theme
        </>
      )}
    </button>
  );
}
