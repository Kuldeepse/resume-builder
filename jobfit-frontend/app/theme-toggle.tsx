'use client';

import { useEffect, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { CHANGE_EVENT, STORAGE_KEY, THEME_PRESETS, type ThemePreset } from './theme-config';
import { applyTheme, loadInitialTheme } from './theme-sync';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreset>(THEME_PRESETS[0]);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextTheme = loadInitialTheme();
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme.key);
    applyTheme(nextTheme.key);
    setMounted(true);

    const syncTheme = (event: Event) => {
      const customEvent = event as CustomEvent<ThemePreset>;
      if (customEvent.detail?.key) {
        setTheme(customEvent.detail);
      }
    };

    window.addEventListener(CHANGE_EVENT, syncTheme);
    return () => window.removeEventListener(CHANGE_EVENT, syncTheme);
  }, []);

  const selectTheme = (nextTheme: ThemePreset) => {
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme.key);
    applyTheme(nextTheme.key);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={!mounted}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-900 shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] disabled:opacity-60"
        aria-label="Open theme picker"
        aria-expanded={open}
      >
        <span className={`h-3.5 w-3.5 rounded-full bg-gradient-to-r ${theme.swatch}`} />
        <Palette className="h-3.5 w-3.5" />
        {theme.label}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.6rem)] z-[80] w-64 rounded-[1.25rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-2 shadow-[var(--shadow-xl)] backdrop-blur-xl">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]">Themes</div>
          <div className="space-y-1">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => selectTheme(preset)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition-all ${
                  theme.key === preset.key ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-slate-800 hover:bg-[var(--accent-soft)]/70'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`h-5 w-5 rounded-full bg-gradient-to-r ${preset.swatch}`} />
                  <span>
                    <span className="block text-sm font-black">{preset.label}</span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                      {preset.mode} · {preset.fontStyle}
                    </span>
                  </span>
                </span>
                {theme.key === preset.key && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
