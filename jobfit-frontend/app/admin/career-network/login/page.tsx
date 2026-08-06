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
    <main className="min-h-[calc(100vh-7rem)] px-3 py-6 text-[var(--foreground)] md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface-strong)] text-[var(--foreground)] shadow-[var(--shadow-xl)] transition-colors duration-300">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <section
            className="relative overflow-hidden px-6 py-8 text-white md:px-9 md:py-10"
            style={{
              background:
                'linear-gradient(145deg, color-mix(in srgb, var(--accent) 82%, #020617) 0%, color-mix(in srgb, var(--accent-strong) 66%, #020617) 56%, color-mix(in srgb, var(--highlight) 58%, #020617) 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-2xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--highlight) 22%, transparent)' }}
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full blur-3xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)' }}
            />

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
                <p className="mt-4 max-w-md text-sm leading-7 text-white/85">
                  Review registrations, approval status, WhatsApp requests and confirmation-email outcomes in the private CogniTwist dashboard.
                </p>
              </div>

              <div className="mt-7 space-y-3 text-xs font-semibold text-white/90 lg:mt-auto lg:pt-10">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                  Private report data is never shown publicly
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                  Access attempts are rate-limited and protected
                </div>
              </div>
            </div>
          </section>

          <section className="bg-[var(--surface-strong)] px-5 py-7 transition-colors duration-300 sm:px-8 md:px-10 md:py-10">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Career Studio
            </Link>

            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent-strong)]">Private access</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[var(--foreground)] md:text-3xl">
                Verify your administrator code
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                Enter only the unique access code created for CogniTwist. Do not enter a Google, LinkedIn, email, banking or reused account password.
              </p>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-5" autoComplete="off">
              <div>
                <label htmlFor="cognitwist-admin-access-code" className="block text-xs font-black text-[var(--foreground)]">
                  CogniTwist administrator access code
                </label>
                <div className="relative mt-2">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--ink-soft)]" aria-hidden="true" />
                  <input
                    id="cognitwist-admin-access-code"
                    type="text"
                    name="cognitwist-admin-access-code"
                    value={accessCode}
                    onChange={(event) => {
                      setAccessCode(event.target.value);
                      if (error) setError('');
                    }}
                    className={`min-h-14 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] py-3 pl-12 pr-14 text-base font-semibold text-[var(--foreground)] shadow-sm outline-none placeholder:font-normal placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] ${
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
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--ink-soft)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label={showAccessCode ? 'Hide access code' : 'Show access code'}
                  >
                    {showAccessCode ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div
                id="access-code-guidance"
                className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-3 text-xs leading-5 text-[var(--foreground)]"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
                <p>
                  <span className="font-black">Security reminder:</span> this code must be unique to CogniTwist and stored separately from personal credentials.
                </p>
              </div>

              {error && (
                <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !hasCode}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 text-sm font-black text-[var(--surface-strong)] shadow-[var(--shadow-xl)] transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:border disabled:border-[var(--surface-border)] disabled:bg-none disabled:bg-[var(--surface)] disabled:text-[var(--ink-soft)] disabled:shadow-none"
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
