'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

export default function CareerNetworkAdminLoginPage() {
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
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

  const hasCode = Boolean(accessCode.trim());

  return (
    <main className="min-h-[calc(100vh-7rem)] px-3 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-[#fffdf8] text-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.14)]">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <section className="relative overflow-hidden bg-[linear-gradient(145deg,#0f766e_0%,#115e59_56%,#164e63_100%)] px-6 py-8 text-white md:px-9 md:py-10">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />

            <div className="relative flex h-full flex-col">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Protected administration
              </div>

              <div className="mt-7">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-lg">
                  <LockKeyhole className="h-7 w-7" aria-hidden="true" />
                </div>
                <h1 className="mt-5 max-w-md text-3xl font-black tracking-tight text-white md:text-4xl">
                  Open the Admin Report
                </h1>
                <p className="mt-4 max-w-md text-sm leading-7 text-teal-50/90">
                  Review registrations, approval status, WhatsApp requests and confirmation-email outcomes in the private CogniTwist dashboard.
                </p>
              </div>

              <div className="mt-7 space-y-3 text-xs font-semibold text-teal-50/95 lg:mt-auto lg:pt-10">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  Private report data is never shown publicly
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  Access attempts are rate-limited and protected
                </div>
              </div>
            </div>
          </section>

          <section className="px-5 py-7 sm:px-8 md:px-10 md:py-10">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Career Studio
            </Link>

            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-teal-700">Private access</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Verify your administrator code</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Enter only the unique access code created for CogniTwist. Do not enter a Google, LinkedIn, email, banking or reused account password.
              </p>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-5" autoComplete="off">
              <div>
                <label htmlFor="cognitwist-admin-access-code" className="block text-xs font-black text-slate-800">
                  CogniTwist administrator access code
                </label>
                <div className="relative mt-2">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="cognitwist-admin-access-code"
                    type="text"
                    name="cognitwist-admin-access-code"
                    value={accessCode}
                    onChange={(event) => {
                      setAccessCode(event.target.value);
                      if (error) setError('');
                    }}
                    className={`min-h-14 w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-14 text-base font-semibold text-slate-950 shadow-sm outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 ${
                      showAccessCode ? '' : '[-webkit-text-security:disc]'
                    }`}
                    placeholder="Enter your private access code"
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby="access-code-guidance"
                    aria-invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    aria-label={showAccessCode ? 'Hide access code' : 'Show access code'}
                  >
                    {showAccessCode ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div id="access-code-guidance" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p>
                  <span className="font-black">Security reminder:</span> this code must be unique to CogniTwist and stored separately from personal credentials.
                </p>
              </div>

              {error && (
                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !hasCode}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#115e59_60%,#164e63_100%)] px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(15,118,110,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(15,118,110,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-none disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                {loading ? 'Verifying private access…' : hasCode ? 'Open Admin Report' : 'Enter access code to continue'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
