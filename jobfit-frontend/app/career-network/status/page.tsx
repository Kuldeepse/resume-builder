'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Search, ShieldCheck, Sparkles } from 'lucide-react';

type StatusResult = {
  full_name: string;
  role: string;
  status: string;
  status_message: string;
  whatsapp_group_consent: boolean;
  whatsapp_group_status: string;
  whatsapp_message: string;
  submitted_at: string;
  updated_at: string;
};

const statusTone: Record<string, string> = {
  pending_verification: 'border-amber-200 bg-amber-50 text-amber-900',
  verified: 'border-teal-200 bg-teal-50 text-teal-900',
  declined: 'border-rose-200 bg-rose-50 text-rose-800',
  deleted: 'border-stone-200 bg-stone-100 text-stone-700',
  not_requested: 'border-stone-200 bg-stone-100 text-stone-700',
  pending_approval: 'border-amber-200 bg-amber-50 text-amber-900',
  approved: 'border-sky-200 bg-sky-50 text-sky-900',
  invited: 'border-teal-200 bg-teal-50 text-teal-900',
  withdrawn: 'border-stone-200 bg-stone-100 text-stone-700',
};

export default function CareerNetworkStatusPage() {
  const [email, setEmail] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StatusResult | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/career-network/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          status_lookup_code: trackingCode,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || 'Status could not be loaded.');
      setResult(data);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Status could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-teal-900">
            <ShieldCheck className="h-3.5 w-3.5" /> Private Status Check
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-[2.85rem]">Check your Career Network registration status</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
            Use the same email address you registered with and the tracking code shown after registration. This page does not expose any public member directory.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={submit} className="space-y-5 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
            <div>
              <h2 className="text-xl font-black text-slate-950">Status lookup</h2>
              <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">We only reveal the status for the exact email and tracking-code pair issued at registration time.</p>
            </div>

            <label className="block space-y-1.5 text-xs font-bold text-slate-800">
              Registration email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-3 font-normal outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-600/10"
                placeholder="you@example.com"
              />
            </label>

            <label className="block space-y-1.5 text-xs font-bold text-slate-800">
              Tracking code
              <input
                type="text"
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value.toUpperCase())}
                className="w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-3 font-normal uppercase tracking-[0.18em] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-600/10"
                placeholder="AB12CD34EF56"
              />
            </label>

            {error && <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? 'Checking status…' : 'Check my status'}
            </button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Sparkles className="h-5 w-5" /> What the statuses mean
              </div>
              <div className="mt-4 space-y-3 text-xs leading-6 text-[var(--ink-soft)]">
                <p><strong className="text-slate-900">Pending verification:</strong> waiting for manual review.</p>
                <p><strong className="text-slate-900">Verified:</strong> approved for network coordination.</p>
                <p><strong className="text-slate-900">WhatsApp pending approval:</strong> consent was recorded, but invite approval is still manual.</p>
                <p><strong className="text-slate-900">Invited:</strong> the WhatsApp join step has been sent or completed.</p>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]">
              <div className="text-sm font-black text-slate-900">Need your code?</div>
              <p className="mt-3 text-xs leading-6 text-[var(--ink-soft)]">
                New registrations now receive a tracking code immediately after submission. If you registered before this update, an admin may need to share your code manually after the database migration is applied.
              </p>
            </div>
          </aside>
        </section>

        {result && (
          <section className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-[var(--accent-strong)]">Registration result</div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{result.full_name}</h2>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">Role: {result.role}</p>
              </div>
              <StatusBadge value={result.status} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-white/80 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Registration status</div>
                <p className="mt-3 text-sm leading-7 text-slate-800">{result.status_message}</p>
              </div>
              <div className="rounded-[1.5rem] border border-[var(--surface-border)] bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">WhatsApp invite</div>
                  <StatusBadge value={result.whatsapp_group_status} />
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-800">{result.whatsapp_message}</p>
              </div>
            </div>

            <div className="mt-4 text-xs leading-6 text-[var(--ink-soft)]">
              Submitted: {new Date(result.submitted_at).toLocaleString('en-GB')}<br />
              Last reviewed update: {new Date(result.updated_at).toLocaleString('en-GB')}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${statusTone[value] || 'border-stone-200 bg-stone-100 text-stone-700'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}
