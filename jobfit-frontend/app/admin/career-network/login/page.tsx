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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffdf8_0%,_#f7efe4_42%,_#ede2d1_100%)] px-4 py-10 text-stone-950 md:px-8">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#d9c3a7] bg-white/92 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)] md:p-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900">
          <ShieldCheck className="h-3.5 w-3.5" /> RoleCraft Admin
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">Career Network Admin Access</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          This dashboard is for authorised RoleCraft administrators only. Registration does not grant access.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block space-y-1.5 text-xs font-bold">
            Admin password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#d6c0a7] bg-[#fffaf3] p-3 font-normal outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/10"
              placeholder="Enter admin password"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 py-3 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {loading ? 'Checking access…' : 'Open admin dashboard'}
          </button>
        </form>
      </div>
    </main>
  );
}
