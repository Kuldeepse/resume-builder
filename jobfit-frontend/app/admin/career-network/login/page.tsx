'use client';

import { FormEvent, useState } from 'react';
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function CareerNetworkAdminLoginPage() {
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || 'Admin login failed.');
      }

      window.location.href = '/admin/career-network';
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 text-slate-950 md:px-8">
      <div className="mx-auto max-w-lg rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-teal-900">
          <ShieldCheck className="h-3.5 w-3.5" /> CogniTwist AI Admin
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">Private operations access</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
          Review registrations, approve network access, and manage WhatsApp invitations from one protected control room.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block space-y-1.5 text-xs font-bold text-slate-800">
            Admin password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-3 font-normal outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-600/10"
              placeholder="Enter admin password"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {loading ? 'Checking access…' : 'Enter admin dashboard'}
          </button>
        </form>
      </div>
    </main>
  );
}
