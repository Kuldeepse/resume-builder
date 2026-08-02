'use client';

import { FormEvent, useState } from 'react';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  LockKeyhole,
  Network,
  ShieldCheck,
  UserRoundSearch,
  Users,
} from 'lucide-react';

const API_BASE = 'https://resume-builder-backend-ph7b.onrender.com';
const PRIVACY_CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || '';
const CONTROLLER_NAME = process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME || 'RoleCraft AI';
const PRIVACY_NOTICE_VERSION = '2026-08-02';

type NetworkRole = 'candidate' | 'referrer' | 'mentor';

type FormState = {
  fullName: string;
  email: string;
  role: NetworkRole;
  linkedinProfile: string;
  currentCompany: string;
  professionalArea: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
  marketingOptIn: boolean;
  website: string;
};

const initialForm: FormState = {
  fullName: '',
  email: '',
  role: 'candidate',
  linkedinProfile: '',
  currentCompany: '',
  professionalArea: '',
  ageConfirmed: false,
  termsAccepted: false,
  marketingOptIn: false,
  website: '',
};

const roleOptions: Record<NetworkRole, { title: string; description: string; icon: typeof Users }> = {
  candidate: {
    title: 'I am seeking career support',
    description: 'Register to request insider guidance, a warm introduction, or a referral after verification.',
    icon: UserRoundSearch,
  },
  referrer: {
    title: 'I can help candidates',
    description: 'Register as a company insider. Your identity and employer details remain private until you accept a match.',
    icon: HeartHandshake,
  },
  mentor: {
    title: 'I can mentor professionals',
    description: 'Register to provide career guidance, interview coaching, or sector insight.',
    icon: BriefcaseBusiness,
  },
};

export default function CareerNetworkRegistrationPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const privacyReady = Boolean(PRIVACY_CONTACT);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!privacyReady) {
      setError('Registration is disabled until the privacy contact is configured.');
      return;
    }

    if (!form.fullName.trim() || !form.email.trim() || !form.professionalArea.trim()) {
      setError('Complete your name, email, and professional area.');
      return;
    }

    if (form.role === 'referrer' && !form.currentCompany.trim()) {
      setError('Current company is required for referrer registration.');
      return;
    }

    if (!form.ageConfirmed || !form.termsAccepted) {
      setError('Age confirmation and privacy/terms acceptance are required.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/career-network/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          linkedin_profile: form.linkedinProfile.trim() || null,
          current_company: form.currentCompany.trim() || null,
          professional_area: form.professionalArea.trim(),
          privacy_notice_version: PRIVACY_NOTICE_VERSION,
          terms_accepted: form.termsAccepted,
          age_confirmed: form.ageConfirmed,
          marketing_opt_in: form.marketingOptIn,
          website: form.website,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || 'Registration could not be completed securely.');

      setSuccess(true);
      setForm(initialForm);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffdf8_0%,_#f7efe4_42%,_#ede2d1_100%)] px-4 py-8 text-stone-950 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 rounded-3xl border border-[#d9c3a7] bg-white/92 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)] lg:grid-cols-[1.15fr_0.85fr] md:p-9">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900">
              <Network className="h-3.5 w-3.5" /> RoleCraft Career Network
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight md:text-5xl">Register for trusted career introductions and referrals.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
              Choose how you want to participate. Registration is private and subject to verification. No candidate, referrer, mentor, employer, or contact information is displayed in a public directory.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-black text-emerald-900"><ShieldCheck className="h-5 w-5" /> Privacy by default</h2>
            <PrivacyPoint>Only minimal registration information is collected.</PrivacyPoint>
            <PrivacyPoint>Registration data is submitted to a private server-side table.</PrivacyPoint>
            <PrivacyPoint>No CV or job description is collected at registration.</PrivacyPoint>
            <PrivacyPoint>Details are shared with another member only after verification and an explicit match decision.</PrivacyPoint>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {(Object.keys(roleOptions) as NetworkRole[]).map((role) => {
            const option = roleOptions[role];
            const Icon = option.icon;
            return (
              <button
                key={role}
                type="button"
                onClick={() => update('role', role)}
                className={`rounded-2xl border p-5 text-left transition ${form.role === role ? 'border-amber-800 bg-amber-900 text-white shadow-lg' : 'border-[#d9c3a7] bg-white/90 hover:bg-amber-50'}`}
              >
                <Icon className="h-6 w-6" />
                <h2 className="mt-4 text-base font-black">{option.title}</h2>
                <p className={`mt-2 text-xs leading-6 ${form.role === role ? 'text-amber-100' : 'text-stone-600'}`}>{option.description}</p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-[#d9c3a7] bg-white/92 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)] md:p-8">
            <div>
              <h2 className="text-xl font-black">Private registration</h2>
              <p className="mt-2 text-xs leading-6 text-stone-600">Required fields are limited to what is needed to verify and administer network access.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" value={form.fullName} onChange={(value) => update('fullName', value)} placeholder="Your name" />
              <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} placeholder="you@example.com" />
              <Field label="LinkedIn profile (optional)" value={form.linkedinProfile} onChange={(value) => update('linkedinProfile', value)} placeholder="https://linkedin.com/in/..." wide />
              {form.role === 'referrer' && <Field label="Current company" value={form.currentCompany} onChange={(value) => update('currentCompany', value)} placeholder="Employer name" />}
              <Field label="Professional area" value={form.professionalArea} onChange={(value) => update('professionalArea', value)} placeholder="Cybersecurity, product, cloud…" wide={form.role !== 'referrer'} />
            </div>

            <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
              <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update('website', event.target.value)} /></label>
            </div>

            <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs leading-5">
              <Checkbox checked={form.ageConfirmed} onChange={(value) => update('ageConfirmed', value)}>I confirm that I am at least 18 years old.</Checkbox>
              <Checkbox checked={form.termsAccepted} onChange={(value) => update('termsAccepted', value)}>
                I have read the <a href="/privacy" className="font-black text-amber-800 underline">Privacy Notice</a> and agree to the Career Network terms.
              </Checkbox>
              <Checkbox checked={form.marketingOptIn} onChange={(value) => update('marketingOptIn', value)}>I separately opt in to occasional RoleCraft product updates. This is optional.</Checkbox>
            </div>

            {!privacyReady && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-800">
                <strong>Launch gate:</strong> configure <code>NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL</code> in Vercel before enabling registration.
              </div>
            )}

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>}
            {success && <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-6 text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span><strong>Registration received.</strong> Your details remain private and will be reviewed before network access is granted.</span></div>}

            <button type="submit" disabled={loading || !privacyReady} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 py-3 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              {loading ? 'Submitting securely…' : 'Register for Career Network'}
            </button>
          </form>

          <aside className="space-y-4">
            <InfoCard icon={<LockKeyhole className="h-5 w-5" />} title="Not publicly searchable">Profiles will not be indexed, listed, or made visible to unauthenticated visitors.</InfoCard>
            <InfoCard icon={<Users className="h-5 w-5" />} title="Controlled matching">A candidate and insider are connected only after suitability checks and the insider accepts the request.</InfoCard>
            <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="No referral guarantee">Registration does not guarantee guidance, an introduction, an interview, a referral, or employment.</InfoCard>
            <div className="rounded-2xl border border-[#d9c3a7] bg-white/90 p-5 text-xs leading-6 text-stone-600">
              <strong className="text-stone-900">Data controller:</strong> {CONTROLLER_NAME}<br />
              <strong className="text-stone-900">Privacy contact:</strong> {PRIVACY_CONTACT || 'Must be configured before launch'}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function PrivacyPoint({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 text-xs leading-5 text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; wide?: boolean }) {
  return <label className={`space-y-1.5 text-xs font-bold ${wide ? 'md:col-span-2' : ''}`}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#d6c0a7] bg-[#fffaf3] p-3 font-normal outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/10" placeholder={placeholder} /></label>;
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return <label className="flex items-start gap-3"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-amber-800" /><span>{children}</span></label>;
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#d9c3a7] bg-white/90 p-5"><div className="flex items-center gap-2 text-sm font-black text-amber-900">{icon}{title}</div><p className="mt-3 text-xs leading-6 text-stone-600">{children}</p></div>;
}
