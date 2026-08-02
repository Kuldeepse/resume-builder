'use client';

import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Network,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const companies = [
  { name: 'Microsoft', mark: 'MS' },
  { name: 'Google', mark: 'GO' },
  { name: 'Amazon', mark: 'AM' },
  { name: 'Meta', mark: 'ME' },
  { name: 'Barclays', mark: 'BA' },
  { name: 'HSBC', mark: 'HS' },
  { name: 'Accenture', mark: 'AC' },
  { name: 'Deloitte', mark: 'DE' },
  { name: 'IBM', mark: 'IB' },
  { name: 'Capgemini', mark: 'CA' },
  { name: 'TCS', mark: 'TC' },
  { name: 'Infosys', mark: 'IN' },
];

const landingPoints = [
  'Private registration only, with no public profile directory.',
  'Role-based review for candidates, referrers, and mentors.',
  'WhatsApp group access only after separate consent and manual approval.',
];

export default function CareerNetworkLandingPage() {
  const marqueeItems = [...companies, ...companies];

  return (
    <main className="min-h-screen px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-teal-900">
              <Network className="h-3.5 w-3.5" /> RoleCraft Career Network
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-slate-950 md:text-[2.85rem]">
              A trusted referral network with a public front door and a private approval process.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
              Start from a simple landing page, then move into the existing RoleCraft registration flow only when you are ready to apply for access.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/career-network/register"
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/20"
              >
                Registration
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/privacy"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-white/80 px-5 py-3 text-sm font-black text-slate-900 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                Privacy Notice
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
              <span className="rounded-full border border-teal-200 bg-white/80 px-3 py-2">Manual review</span>
              <span className="rounded-full border border-orange-200 bg-white/80 px-3 py-2">No public directory</span>
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-2">Consent-led access</span>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-teal-200/80 bg-[linear-gradient(160deg,rgba(215,243,239,0.9),rgba(255,255,255,0.86))] p-5">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-teal-950">
              <ShieldCheck className="h-5 w-5" /> What changes here
            </div>
            {landingPoints.map((point) => (
              <div key={point} className="flex items-start gap-2 text-xs leading-6 text-teal-950">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span>{point}</span>
              </div>
            ))}
            <div className="rounded-[1.25rem] border border-white/70 bg-white/75 p-4 text-xs leading-6 text-[var(--ink-soft)]">
              Clicking <strong>Registration</strong> opens the current secure RoleCraft registration page, so the private intake process and GDPR-friendly flow remain unchanged.
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <ValueCard
            icon={<Users className="h-5 w-5" />}
            title="Trusted access"
            copy="Candidates, referrers, and mentors enter through the same reviewed workflow instead of a public member list."
          />
          <ValueCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="GDPR-aligned posture"
            copy="The landing page stays public, while the identifiable registration flow stays private, consent-based, and reviewable."
          />
          <ValueCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Clearer journey"
            copy="The network becomes easier to understand: discover first, register second, approve third, then optionally invite to WhatsApp."
          />
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--accent-strong)]">Hiring network</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Representative company coverage</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">
              The strip below signals the kind of employers and ecosystems this community can support. It is best used as representative coverage rather than a public promise of direct partnership.
            </p>
          </div>

          <div className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-[var(--surface-border)] bg-white/75 py-5">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-[linear-gradient(90deg,var(--surface-strong)_0%,rgba(255,253,248,0)_100%)]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-[linear-gradient(270deg,var(--surface-strong)_0%,rgba(255,253,248,0)_100%)]" />
            <div className="flex min-w-max animate-[logo-marquee_36s_linear_infinite] gap-4 px-4">
              {marqueeItems.map((company, index) => (
                <div
                  key={`${company.name}-${index}`}
                  className="flex min-w-[200px] items-center gap-3 rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] text-xs font-black tracking-[0.16em] text-white">
                    {company.mark}
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-950">{company.name}</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-soft)]">Career network</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <a
              href="/career-network/register"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-3 text-sm font-black text-[var(--accent-strong)] hover:bg-white"
            >
              Open registration
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)]">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-950">
              <Globe2 className="h-5 w-5 text-[var(--accent)]" /> Suggested transformation
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              This structure is stronger because it separates marketing from data capture. Visitors first understand the offer, privacy model, and expected employers, then explicitly enter the secure form.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)]">
            <h2 className="text-lg font-black text-slate-950">Recommended next refinements</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
              <p>Add a small “How it works” row: register, review, approve, invite.</p>
              <p>Add approved testimonials later, but only if they are consented and non-sensitive.</p>
              <p>If you want official brand logos, upload rights-cleared assets and I can replace the stylized company badges with real marks.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ValueCard({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return (
    <div className="rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]">
      <div className="flex items-center gap-2 text-sm font-black text-slate-950">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-xs leading-6 text-[var(--ink-soft)]">{copy}</p>
    </div>
  );
}
