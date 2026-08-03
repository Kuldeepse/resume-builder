'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const register = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
          // CogniTwist AI remains fully usable when service-worker registration is unavailable.
        });
      };

      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  useEffect(() => {
    if (isStandaloneMode()) return;

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    if (isIosDevice()) setShowIosHelp(true);

    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setDismissed(true);
  };

  if (dismissed || isStandaloneMode() || (!installEvent && !showIosHelp)) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xl)] backdrop-blur-2xl md:bottom-5 md:left-auto md:right-5 md:mx-0"
      aria-label="Install CogniTwist AI"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] text-xs font-black text-white">CT</div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-slate-950">Install CogniTwist AI</p>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">
            {installEvent
              ? 'Add CogniTwist AI to your home screen for faster mobile access.'
              : 'On iPhone, tap Share and choose “Add to Home Screen”.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {installEvent && (
              <button
                type="button"
                onClick={install}
                className="min-h-11 rounded-full bg-[var(--accent)] px-4 text-xs font-black text-white hover:bg-[var(--accent-strong)]"
              >
                Install app
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="min-h-11 rounded-full border border-[var(--surface-border)] px-4 text-xs font-bold text-[var(--ink-soft)] hover:bg-white/70"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
