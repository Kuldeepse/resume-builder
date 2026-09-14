'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BrainCircuit, Pause, Play, Trash2 } from 'lucide-react';
import { buildInterviewMemoryCookieValue, INTERVIEW_MEMORY_COOKIE } from '../../lib/interview-agent-context.mjs';

const PROGRESS_KEY = 'cognitwist-interview-progress-v2';
const LEGACY_PROGRESS_KEY = 'cognitwist-interview-progress-v1';
const MEMORY_ENABLED_KEY = 'cognitwist-interview-memory-enabled';

function readProgress() {
  try {
    const current: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || '[]');
    if (Array.isArray(current) && current.length) return current;
    const legacy: unknown = JSON.parse(window.localStorage.getItem(LEGACY_PROGRESS_KEY) || '[]');
    return Array.isArray(legacy) ? legacy : [];
  } catch {
    return [];
  }
}

function expireMemoryCookie() {
  document.cookie = `${INTERVIEW_MEMORY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function writeMemoryCookie(progress: unknown[]) {
  const value = buildInterviewMemoryCookieValue(progress);
  document.cookie = `${INTERVIEW_MEMORY_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function LiveInterviewRuntimeBridge({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState(0);

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(MEMORY_ENABLED_KEY) !== 'off');
    } catch {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (enabled == null) return undefined;
    let lastFingerprint = '';

    const sync = () => {
      const progress = readProgress();
      const fingerprint = JSON.stringify(progress.slice(0, 12));
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        setSessions(progress.length);
      }
      if (enabled) writeMemoryCookie(progress);
      else expireMemoryCookie();
    };

    sync();
    const timer = window.setInterval(sync, 1500);
    window.addEventListener('storage', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [enabled]);

  const toggleMemory = () => {
    const next = !enabled;
    try { window.localStorage.setItem(MEMORY_ENABLED_KEY, next ? 'on' : 'off'); } catch { /* no-op */ }
    setEnabled(next);
    if (!next) expireMemoryCookie();
  };

  const clearHistory = () => {
    try {
      window.localStorage.removeItem(PROGRESS_KEY);
      window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
    } catch { /* no-op */ }
    expireMemoryCookie();
    setSessions(0);
    window.location.reload();
  };

  return (
    <>
      {children}
      <details className="fixed bottom-20 left-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-xl)] md:bottom-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wide">
          <span className="flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-[var(--accent-strong)]" /> Practice memory</span>
          <span className="rounded-full border border-[var(--surface-border)] px-2 py-1 text-[8px] normal-case tracking-normal">{enabled === false ? 'Paused' : `${sessions} session${sessions === 1 ? '' : 's'}`}</span>
        </summary>
        <p className="mt-3 text-[9px] leading-5 text-[var(--ink-soft)]">Stored in this browser. When enabled, CogniTwist sends only a compact score-and-coaching summary with interview-coach requests. It never becomes career evidence or a CV claim.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={toggleMemory} className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] px-2.5 py-1.5 text-[9px] font-black">
            {enabled === false ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {enabled === false ? 'Use memory' : 'Pause memory'}
          </button>
          <button type="button" onClick={clearHistory} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[9px] font-black text-rose-700">
            <Trash2 className="h-3 w-3" /> Clear interview history
          </button>
        </div>
      </details>
    </>
  );
}
