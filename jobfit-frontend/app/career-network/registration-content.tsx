'use client';

import { FormEvent, ReactNode, useState } from 'react';
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

const PRIVACY_CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL || '';
const CONTROLLER_NAME = process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME || 'RoleCraft AI';
const PRIVACY_NOTICE_VERSION = '2026-08-02';
const WHATSAPP_GROUP_NAME = 'RoleCraft IT Jobs referrals UK';

type NetworkRole = 'candidate' | 'referrer' | 'mentor';
type FormState = {
  fullName: string;
  email: string;
  role: NetworkRole;
  linkedinProfile: string;
  whatsappNumber: string;
  currentCompany: string;
  professionalArea: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
  marketingOptIn: boolean;
  whatsappGroupConsent: boolean;
  website: string;
};

const initialForm: FormState = {
  fullName: '', email: '', role: 'candidate', linkedinProfile: '', whatsappNumber: '', currentCompany: '',
  professionalArea: '', ageConfirmed: false, termsAccepted: false, marketingOptIn: false, whatsappGroupConsent: false, website: '',
};

const roles: Record<NetworkRole, { title: string; description: string; icon: typeof Users }> = {
  candidate: {
    title: 'I am seeking career support',
    description: 'Register to request guidance, an introduction, or a referral after verification.',
    icon: UserRoundSearch,
  },
  referrer: {
    title: 'I can help candidates',
    description: 'Register as an insider. Your identity and employer remain private until you accept a match.',
    icon: HeartHandshake,
  },
  mentor: {
    title: 'I can mentor professionals',
    description: 'Register to provide career guidance, interview coaching, or sector insight.',
    icon: BriefcaseBusiness,
  },
};

export function CareerNetworkRegistrationContent() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const privacyReady = Boolean(PRIVACY_CONTACT);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setSuccess(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!privacyReady) return setError('Registration is disabled until the privacy contact is configured.');
    if (!form.fullName.trim() || !form.email.trim() || !form.professionalArea.trim()) {
      return setError('Complete your name, email, and professional area.');
    }
    if (form.role === 'referrer' && !form.currentCompany.trim()) {
      return setError('Current company is required for referrer registration.');
    }
    if (!form.ageConfirmed || !form.termsAccepted) {
      return setError('Age confirmation and privacy/terms acceptance are required.');
    }

    setLoading(true);
    try {
      const response = await fetch('/api/career-network/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.fullName.trim(),
          email: form.email.trim(),
          role: form.role,
          linkedin_profile: form.linkedinProfile.trim() || null,
          whatsapp_number: form.whatsappNumber.trim() || null,
          current_company: form.currentCompany.trim() || null,
          professional_area: form.professionalArea.trim(),
          privacy_notice_version: PRIVACY_NOTICE_VERSION,
          terms_accepted: form.termsAccepted,
          age_confirmed: form.ageConfirmed,
          marketing_opt_in: form.marketingOptIn,
          whatsapp_group_consent: form.whatsappGroupConsent,
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
    <main className="min-h-screen px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="grid gap-6 overflow-hidden rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-teal-900"><Network className="h-3.5 w-3.5" /> RoleCraft Career Network</div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Register once. Get private access to referral support, mentoring, and trusted introductions.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">The page is open, but the network is not. Every registration is reviewed privately, never listed publicly, and approved deliberately before any access or WhatsApp invite is granted.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
              <span className="rounded-full border border-teal-200 bg-white/80 px-3 py-2">Manual review</span>
              <span className="rounded-full border border-orange-200 bg-white/80 px-3 py-2">No public directory</span>
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-2">Consent-based WhatsApp</span>
            </div>
          </div>
          <div className="space-y-3 rounded-[1.75rem] border border-teal-200/80 bg-[linear-gradient(160deg,rgba(215,243,239,0.9),rgba(255,255,255,0.86))] p-5">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-teal-950"><ShieldCheck className="h-5 w-5" /> Privacy by default</h2>
            <PrivacyPoint>Only minimal registration information is collected.</PrivacyPoint>
            <PrivacyPoint>Data is submitted to a private server-side table.</PrivacyPoint>
            <PrivacyPoint>No CV or job description is collected at registration.</PrivacyPoint>
            <PrivacyPoint>Details are shared only after verification and an explicit match decision.</PrivacyPoint>
            <PrivacyPoint>WhatsApp group access requires separate consent and manual approval.</PrivacyPoint>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {(Object.keys(roles) as NetworkRole[]).map((role) => {
            const option = roles[role];
            const Icon = option.icon;
            const selected = form.role === role;
            return (
              <button key={role} type="button" onClick={() => update('role', role)} className={`rounded-[1.75rem] border p-5 text-left transition duration-200 ${selected ? 'border-teal-900 bg-[linear-gradient(145deg,var(--accent)_0%,#164e63_100%)] text-white shadow-xl shadow-teal-950/20 -translate-y-0.5' : 'border-[var(--surface-border)] bg-[var(--surface)] hover:-translate-y-0.5 hover:bg-white/90'}`}>
                <Icon className="h-6 w-6" />
                <h2 className="mt-4 text-base font-black">{option.title}</h2>
                <p className={`mt-2 text-xs leading-6 ${selected ? 'text-amber-100' : 'text-stone-600'}`}>{option.description}</p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
          <form onSubmit={submit} className="space-y-5 rounded-[2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-8">
            <div><h2 className="text-xl font-black text-slate-950">Private registration</h2><p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">Tell us just enough to review your request, verify your role, and manage access in line with the Privacy Notice.</p></div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" value={form.fullName} onChange={(value) => update('fullName', value)} placeholder="Your name" />
              <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} placeholder="you@example.com" />
              <Field label="LinkedIn profile (optional)" value={form.linkedinProfile} onChange={(value) => update('linkedinProfile', value)} placeholder="https://linkedin.com/in/..." wide />
              <Field label="WhatsApp number (optional)" value={form.whatsappNumber} onChange={(value) => update('whatsappNumber', value)} placeholder="+44 7700 900123" wide />
              {form.role === 'referrer' && <Field label="Current company" value={form.currentCompany} onChange={(value) => update('currentCompany', value)} placeholder="Employer name" />}
              <Field label="Professional area" value={form.professionalArea} onChange={(value) => update('professionalArea', value)} placeholder="Cybersecurity, product, cloud…" wide={form.role !== 'referrer'} />
            </div>

            <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update('website', event.target.value)} /></label></div>

            <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 text-xs leading-5">
              <Checkbox checked={form.ageConfirmed} onChange={(value) => update('ageConfirmed', value)}>I confirm that I am at least 18 years old.</Checkbox>
              <Checkbox checked={form.termsAccepted} onChange={(value) => update('termsAccepted', value)}>I have read the <a href="/privacy" className="font-black text-amber-800 underline">Privacy Notice</a> and agree to the Career Network terms.</Checkbox>
              <Checkbox checked={form.whatsappGroupConsent} onChange={(value) => update('whatsappGroupConsent', value)}>I separately consent to being invited to the private WhatsApp group <strong>{WHATSAPP_GROUP_NAME}</strong> after manual approval. This is optional and requires a WhatsApp number.</Checkbox>
              <Checkbox checked={form.marketingOptIn} onChange={(value) => update('marketingOptIn', value)}>I separately opt in to occasional product updates. This is optional.</Checkbox>
            </div>

            {!privacyReady && <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-xs leading-6 text-rose-800"><strong>Launch gate:</strong> configure <code>NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL</code> in Vercel before enabling registration.</div>}
            {error && <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">{error}</div>}
            {success && <div className="flex items-start gap-3 rounded-[1.25rem] border border-teal-200 bg-teal-50 p-4 text-xs leading-6 text-teal-950"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span><strong>Registration received.</strong> Your details remain private and will be reviewed before access is granted or any WhatsApp invite is approved.</span></div>}

            <button type="submit" disabled={loading || !privacyReady} className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--accent)_0%,var(--highlight)_100%)] px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/20 disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}{loading ? 'Submitting securely…' : 'Register for Career Network'}</button>
          </form>

          <aside className="space-y-4">
            <InfoCard icon={<LockKeyhole className="h-5 w-5" />} title="Not publicly searchable">Profiles are not indexed, listed, or exposed to unauthenticated visitors.</InfoCard>
            <InfoCard icon={<Users className="h-5 w-5" />} title="Controlled matching">Members are connected only after suitability checks and the insider accepts the request.</InfoCard>
            <InfoCard icon={<HeartHandshake className="h-5 w-5" />} title="WhatsApp by consent">An invite to {WHATSAPP_GROUP_NAME} can be requested, but only after separate consent and manual approval by RoleCraft.</InfoCard>
            <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="No referral guarantee">Registration does not guarantee guidance, an introduction, an interview, a referral, or employment.</InfoCard>
            <div className="rounded-2xl border border-[#d9c3a7] bg-white/90 p-5 text-xs leading-6 text-stone-600"><strong className="text-stone-900">Data controller:</strong> {CONTROLLER_NAME}<br /><strong className="text-stone-900">Privacy contact:</strong> {PRIVACY_CONTACT || 'Must be configured before launch'}</div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function PrivacyPoint({ children }: { children: ReactNode }) {
  return <div className="flex items-start gap-2 text-xs leading-5 text-teal-950"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />{children}</div>;
}
function Field({ label, value, onChange, placeholder, type = 'text', wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; wide?: boolean }) {
  return <label className={`space-y-1.5 text-xs font-bold text-slate-800 ${wide ? 'md:col-span-2' : ''}`}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-[var(--surface-border)] bg-white/90 p-3 font-normal outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-teal-600/10" placeholder={placeholder} /></label>;
}
function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <label className="flex items-start gap-3 text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-700" /><span>{children}</span></label>;
}
function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <div className="rounded-[1.6rem] border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xl)]"><div className="flex items-center gap-2 text-sm font-black text-slate-900">{icon}{title}</div><p className="mt-3 text-xs leading-6 text-[var(--ink-soft)]">{children}</p></div>;
}
