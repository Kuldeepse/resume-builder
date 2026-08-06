'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Palette, X } from 'lucide-react';
import { CHANGE_EVENT, STORAGE_KEY, THEME_PRESETS, type ThemePreset } from './theme-config';
import { applyTheme, loadInitialTheme } from './theme-sync';

type ThemeToggleProps = {
  mobileNav?: boolean;
};

export default function ThemeToggle({ mobileNav = false }: ThemeToggleProps) {
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

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    if (mobileNav) document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      if (mobileNav) document.body.style.overflow = '';
    };
  }, [mobileNav, open]);

  const selectTheme = (nextTheme: ThemePreset) => {
    setTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme.key);
    applyTheme(nextTheme.key);
    setOpen(false);
  };

  const themeOptions = (
    <div className={mobileNav ? 'grid gap-2 sm:grid-cols-2' : 'space-y-1'}>
      {THEME_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => selectTheme(preset)}
          className={`flex min-h-14 w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all ${
            theme.key === preset.key
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]'
              : 'border-transparent text-[var(--foreground)] hover:border-[var(--surface-border)] hover:bg-[var(--accent-soft)]/70'
          }`}
        >
          <span className="flex items-center gap-3">
            <span className={`h-6 w-6 rounded-full bg-gradient-to-r ${preset.swatch}`} aria-hidden="true" />
            <span>
              <span className="block text-sm font-black">{preset.label}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                {preset.mode} · {preset.fontStyle}
              </span>
            </span>
          </span>
          {theme.key === preset.key && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );

  const mobilePicker =
    mounted && open && mobileNav
      ? createPortal(
          <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Choose application theme">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label="Close theme picker"
            />
            <section className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[78vh] overflow-y-auto rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-[var(--foreground)] shadow-[0_30px_100px_rgba(2,6,23,0.5)]">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]">Application theme</div>
                  <div className="mt-1 text-base font-black">Current: {theme.label}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                  aria-label="Close theme picker"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              {themeOptions}
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={mobileNav ? 'min-w-0' : 'relative'}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={!mounted}
        className={
          mobileNav
            ? 'flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-extrabold text-[var(--ink-soft)] transition-all hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] disabled:opacity-60'
            : 'inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] disabled:opacity-60'
        }
        aria-label={`Choose theme. Current theme: ${theme.label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {mobileNav ? (
          <>
            <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
              <Palette className="h-5 w-5" />
              <span className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-[var(--surface-strong)] bg-gradient-to-r ${theme.swatch}`} />
            </span>
            <span>Theme</span>
          </>
        ) : (
          <>
            <span className={`h-3.5 w-3.5 rounded-full bg-gradient-to-r ${theme.swatch}`} aria-hidden="true" />
            <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            {theme.label}
          </>
        )}
      </button>

      {!mobileNav && open && (
        <div className="absolute right-0 top-[calc(100%+0.6rem)] z-[80] w-64 rounded-[1.25rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-2 text-[var(--foreground)] shadow-[var(--shadow-xl)] backdrop-blur-xl" role="dialog" aria-label="Choose application theme">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--ink-soft)]">Themes</div>
          {themeOptions}
        </div>
      )}

      {mobilePicker}
    </div>
  );
}
