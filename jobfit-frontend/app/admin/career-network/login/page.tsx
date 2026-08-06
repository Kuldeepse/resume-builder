'use client';

import { FormEvent, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';

export default function CareerNetworkAdminLoginPage() {
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/career-network/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || 'Private access verification failed.');
      }

      window.location.href = '/admin/career-network';
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : 'Private access verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 text-[var(--foreground)] md:px-8">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[var(--accent-strong)]">
          <ShieldCheck className="h-3.5 w-3.5" /> CogniTwist private administration
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">Private operations access</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
          This page accepts only the dedicated CogniTwist administrator access code. It does not request or accept your Google, LinkedIn, email, banking, or other saved account password.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4" autoComplete="off">
          <label className="block space-y-1.5 text-xs font-bold text-[var(--foreground)]">
            CogniTwist administrator access code
            <input
              type="text"
              name="cognitwist-admin-access-code"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3 font-normal text-[var(--foreground)] outline-none [-webkit-text-security:disc] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
              placeholder="Enter the dedicated access code"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="access-code-guidance"
            />
          </label>

          <p id="access-code-guidance" className="rounded-[1.25rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4 text-xs leading-6 text-[var(--ink-soft)]">
            Never reuse a password from another website here. The administrator code must be unique to CogniTwist and stored separately from personal account credentials.
          </p>

          {error && <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>}

          <button
            type="submit"
            disabled={loading || !accessCode.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {loading ? 'Verifying private access…' : 'Verify private access'}
          </button>
        </form>
      </div>
    </main>
  );
}
