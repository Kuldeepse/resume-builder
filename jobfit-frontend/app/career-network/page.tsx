'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react';

const API_BASE = 'https://resume-builder-backend-ph7b.onrender.com';
const STORAGE_KEY = 'rolecraft-career-network-requests-v1';

type SupportType = 'guidance' | 'introduction' | 'referral';

type AiResult = {
  match_score?: number;
  missing_skills?: string[];
  tailoring_tips?: string[];
};

type ReadinessResult = {
  score: number;
  status: string;
  recommendedSupport: SupportType;
  strengths: string[];
  improvements: string[];
  warnings: string[];
  brief: string;
  aiMatchScore: number;
};

type SavedRequest = {
  id: string;
  createdAt: string;
  targetRole: string;
  company: string;
  vacancyUrl: string;
  closingDate: string;
  requestedSupport: SupportType;
  recommendedSupport: SupportType;
  readinessScore: number;
  readinessStatus: string;
  brief: string;
};

const supportOptions: Record<SupportType, { label: string; description: string }> = {
  guidance: {
    label: 'Insider guidance',
    description: 'Ask about the role, company, team, or recruitment process without requesting endorsement.',
  },
  introduction: {
    label: 'Warm introduction',
    description: 'Ask for an introduction to an appropriate recruiter, hiring manager, or professional.',
  },
  referral: {
    label: 'Formal referral',
    description: 'Ask an employee to consider an internal referral after reviewing your evidence.',
  },
};

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

function calculateReadiness(input: {
  fullName: string;
  targetRole: string;
  company: string;
  linkedin: string;
  vacancyUrl: string;
  careerEvidence: string;
  jobDescription: string;
  supportType: SupportType;
  aiResult: AiResult;
}): ReadinessResult {
  const aiMatchScore = typeof input.aiResult.match_score === 'number' ? input.aiResult.match_score : 50;
  let score = aiMatchScore * 0.72;
  score += input.linkedin.trim() ? 5 : 0;
  score += input.vacancyUrl.trim() ? 5 : 0;
  score += input.careerEvidence.trim().length >= 350 ? 8 : input.careerEvidence.trim().length >= 180 ? 4 : 0;
  score += input.jobDescription.trim().length >= 500 ? 6 : 3;
  score += input.fullName.trim() && input.targetRole.trim() && input.company.trim() ? 4 : 0;
  score -= Math.min((input.aiResult.missing_skills?.length || 0) * 1.5, 10);
  score = clamp(score);

  const status = score >= 80 ? 'Referral ready' : score >= 65 ? 'Nearly ready' : 'Strengthen before outreach';
  const recommendedSupport: SupportType = score >= 80 ? input.supportType : score >= 65 ? 'introduction' : 'guidance';

  const strengths = [
    `AI role-fit score: ${aiMatchScore}%`,
    input.vacancyUrl.trim() ? 'Linked to a specific vacancy' : '',
    input.linkedin.trim() ? 'LinkedIn profile available for validation' : '',
    input.careerEvidence.trim().length >= 350 ? 'Detailed role-specific evidence provided' : '',
  ].filter(Boolean) as string[];

  const improvements = [
    ...(input.aiResult.tailoring_tips || []).slice(0, 3),
    !input.linkedin.trim() ? 'Add a LinkedIn profile before approaching an insider.' : '',
    !input.vacancyUrl.trim() ? 'Add the vacancy URL so the request is specific and easy to review.' : '',
    input.careerEvidence.trim().length < 350 ? 'Add two or three quantified achievements mapped to the essential criteria.' : '',
    (input.aiResult.missing_skills?.length || 0) > 0
      ? `Address or explain these gaps: ${(input.aiResult.missing_skills || []).slice(0, 3).join(', ')}.`
      : '',
  ].filter(Boolean) as string[];

  const warnings = input.supportType === 'referral' && score < 70
    ? ['A formal referral may be premature. Begin with guidance or a warm introduction.']
    : [];

  const brief = `${input.fullName} is targeting the ${input.targetRole} role at ${input.company}. RoleCraft assessed the candidate at ${aiMatchScore}% role fit and ${score}% referral readiness. The recommended next step is ${supportOptions[recommendedSupport].label.toLowerCase()}. Please review the vacancy, professional profile, and role-relevant achievements before deciding whether guidance, an introduction, or a formal referral is appropriate.`;

  return {
    score,
    status,
    recommendedSupport,
    strengths: strengths.length ? strengths : ['A specific role and employer have been identified.'],
    improvements: improvements.length ? improvements : ['Keep the outreach concise and lead with quantified outcomes.'],
    warnings,
    brief,
    aiMatchScore,
  };
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="h-36 w-36 rounded-full p-3"
      style={{ background: `conic-gradient(#92400e ${clamp(score) * 3.6}deg, #ede3d4 0deg)` }}
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
        <span className="text-4xl font-black">{clamp(score)}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Readiness</span>
      </div>
    </div>
  );
}

export default function CareerNetworkPage() {
  const [fullName, setFullName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [company, setCompany] = useState('');
  const [vacancyUrl, setVacancyUrl] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [careerEvidence, setCareerEvidence] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [supportType, setSupportType] = useState<SupportType>('guidance');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [requests, setRequests] = useState<SavedRequest[]>([]);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as SavedRequest[];
        if (Array.isArray(parsed)) setRequests(parsed);
      }
    } catch {
      setRequests([]);
    }
  }, []);

  const cards = useMemo(
    () => [
      { label: 'Readiness', value: result ? `${result.score}%` : 'Not assessed', icon: Target },
      { label: 'AI role fit', value: result ? `${result.aiMatchScore}%` : 'Not assessed', icon: Sparkles },
      { label: 'Recommended support', value: result ? supportOptions[result.recommendedSupport].label : 'Pending', icon: MessageCircle },
      { label: 'Saved requests', value: String(requests.length), icon: Network },
    ],
    [requests.length, result],
  );

  const persistRequests = (next: SavedRequest[]) => {
    setRequests(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const assess = async () => {
    if (!fullName.trim() || !targetRole.trim() || !company.trim() || !careerEvidence.trim() || !jobDescription.trim()) {
      setMessage('Complete candidate name, target role, company, career evidence, and job description.');
      return;
    }

    setLoading(true);
    setMessage('');
    setResult(null);

    const formData = new FormData();
    formData.append('full_name', fullName.trim());
    formData.append('target_role', targetRole.trim());
    formData.append('linkedin_profile', linkedin.trim());
    formData.append('interview_duration', '30 minutes');
    formData.append('total_questions_requested', '5');
    formData.append('interview_type', 'hr');
    formData.append('career_history', careerEvidence.trim());
    formData.append('job_description', jobDescription.trim());

    try {
      const response = await fetch(`${API_BASE}/build-resume`, { method: 'POST', body: formData });
      const data = (await response.json().catch(() => null)) as AiResult & { detail?: string };
      if (!response.ok) throw new Error(data?.detail || 'AI role-fit analysis failed.');

      setResult(calculateReadiness({
        fullName,
        targetRole,
        company,
        linkedin,
        vacancyUrl,
        careerEvidence,
        jobDescription,
        supportType,
        aiResult: data,
      }));
      setMessage('Assessment generated. Review the recommendation before saving the request.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI role-fit analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const saveRequest = () => {
    if (!result) return;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
    const next: SavedRequest = {
      id,
      createdAt: new Date().toISOString(),
      targetRole: targetRole.trim(),
      company: company.trim(),
      vacancyUrl: vacancyUrl.trim(),
      closingDate,
      requestedSupport: supportType,
      recommendedSupport: result.recommendedSupport,
      readinessScore: result.score,
      readinessStatus: result.status,
      brief: result.brief,
    };
    persistRequests([next, ...requests]);
    setMessage('Request saved in the pilot queue on this device.');
  };

  const copyBrief = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.brief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fffdf8_0%,_#f7efe4_42%,_#ede2d1_100%)] px-4 py-8 text-stone-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-5 rounded-3xl border border-[#d9c3a7] bg-white/90 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)] lg:grid-cols-[1.25fr_0.75fr] md:p-8">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900">
              <Network className="h-3.5 w-3.5" /> RoleCraft Career Network · Pilot MVP
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-5xl">Become referral-ready before approaching an insider.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
              RoleCraft combines AI role-fit analysis with vacancy-specific evidence, then recommends insider guidance, a warm introduction, or a formal referral.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-800"><ShieldCheck className="h-5 w-5" /> Trust-first design</div>
            <p className="mt-3 text-xs leading-6 text-emerald-800">No referral guarantee, no public employee directory, no referral selling, and no automatic candidate rejection.</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-[#d9c3a7] bg-white/90 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-500"><Icon className="h-4 w-4 text-amber-700" /> {label}</div>
              <div className="text-lg font-black">{value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <div className="space-y-5 rounded-3xl border border-[#d9c3a7] bg-white/90 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)]">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-900"><BriefcaseBusiness className="h-4 w-4" /> Build a vacancy-specific request</h2>
              <p className="mt-2 text-xs leading-6 text-stone-600">Use factual evidence. RoleCraft will not invent qualifications or relationships.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name" value={fullName} onChange={(value) => { setFullName(value); setResult(null); }} placeholder="Candidate name" />
              <Field label="Target role" value={targetRole} onChange={(value) => { setTargetRole(value); setResult(null); }} placeholder="Senior Product Manager" />
              <Field label="LinkedIn profile" value={linkedin} onChange={(value) => { setLinkedin(value); setResult(null); }} placeholder="https://linkedin.com/in/..." wide />
              <Field label="Target company" value={company} onChange={(value) => { setCompany(value); setResult(null); }} placeholder="Company name" />
              <label className="space-y-1.5 text-xs font-bold">Application closing date<input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} className="w-full rounded-xl border border-[#d6c0a7] bg-[#fffaf3] p-3 font-normal outline-none focus:border-amber-700" /></label>
              <Field label="Vacancy URL" value={vacancyUrl} onChange={(value) => { setVacancyUrl(value); setResult(null); }} placeholder="https://company.com/jobs/..." wide />
            </div>

            <div>
              <div className="mb-2 text-xs font-bold">Support requested</div>
              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(supportOptions) as SupportType[]).map((type) => (
                  <button key={type} type="button" onClick={() => { setSupportType(type); setResult(null); }} className={`rounded-xl border p-3 text-left transition ${supportType === type ? 'border-amber-700 bg-amber-900 text-white' : 'border-stone-200 bg-white hover:bg-amber-50'}`}>
                    <div className="text-xs font-black">{supportOptions[type].label}</div>
                    <div className={`mt-1 text-[10px] leading-4 ${supportType === type ? 'text-amber-100' : 'text-stone-500'}`}>{supportOptions[type].description}</div>
                  </button>
                ))}
              </div>
            </div>

            <TextArea label="Career evidence" value={careerEvidence} onChange={(value) => { setCareerEvidence(value); setResult(null); }} rows={9} placeholder="Paste relevant career history, quantified achievements, certifications, and domain experience." />
            <TextArea label="Complete job description" value={jobDescription} onChange={(value) => { setJobDescription(value); setResult(null); }} rows={10} placeholder="Paste the full vacancy description." />

            <button type="button" onClick={assess} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 py-3 text-sm font-black text-white shadow-lg disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              {loading ? 'Running AI role-fit analysis…' : 'Assess referral readiness'}
            </button>
            {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{message}</div>}
          </div>

          <div className="rounded-3xl border border-[#d9c3a7] bg-white/90 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)]">
            {!result ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
                <div className="rounded-full bg-amber-50 p-6"><Network className="h-12 w-12 text-amber-700" /></div>
                <h2 className="mt-5 text-2xl font-black">Your readiness report appears here</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-stone-600">RoleCraft combines AI role fit, evidence completeness, vacancy specificity, and identified gaps.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                  <ScoreRing score={result.score} />
                  <div><h2 className="text-2xl font-black">{result.status}</h2><p className="mt-2 text-sm text-stone-600">Recommended: <strong>{supportOptions[result.recommendedSupport].label}</strong></p><p className="mt-1 text-xs text-stone-500">AI role-fit score: {result.aiMatchScore}%</p></div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ReportList title="Strengths" items={result.strengths} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
                  <ReportList title="Improve" items={result.improvements} icon={<Target className="h-4 w-4" />} tone="amber" />
                </div>

                {result.warnings.length > 0 && <ReportList title="Risk flags" items={result.warnings} icon={<AlertCircle className="h-4 w-4" />} tone="rose" />}

                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><Clipboard className="h-4 w-4" /> Insider-facing brief</h3><button type="button" onClick={copyBrief} className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[10px] font-bold"><Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}</button></div>
                  <p className="text-xs leading-6 text-stone-600">{result.brief}</p>
                </div>

                <button type="button" onClick={saveRequest} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white"><Users className="h-4 w-4" /> Save to pilot matching queue</button>
                <p className="text-[11px] leading-5 text-stone-500">Pilot requests are stored only in this browser. Shared accounts, verified insiders, moderation, and cloud matching are the next phase.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#d9c3a7] bg-white/90 p-6 shadow-[0_20px_60px_rgba(115,74,28,0.08)]">
          <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-wider text-amber-900">My pilot requests</h2><p className="mt-1 text-xs text-stone-600">Prepared requests awaiting the verified-insider workflow.</p></div><span className="rounded-full border border-stone-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">{requests.length} total</span></div>

          {requests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No requests saved yet.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {requests.map((request) => (
                <article key={request.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{supportOptions[request.requestedSupport].label}</div><h3 className="mt-1 text-lg font-black">{request.targetRole}</h3><p className="text-sm font-semibold text-stone-600">{request.company}</p></div><button type="button" onClick={() => persistRequests(requests.filter((item) => item.id !== request.id))} aria-label="Delete request" className="rounded-lg border border-stone-200 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider"><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Ready for matching</span><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">{request.readinessScore}% · {request.readinessStatus}</span></div>
                  <p className="mt-4 text-xs leading-6 text-stone-600">{request.brief}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-stone-500"><span>{new Date(request.createdAt).toLocaleString()}</span>{request.closingDate && <span>Closes {request.closingDate}</span>}{request.vacancyUrl && <a href={request.vacancyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-amber-700">Vacancy <ExternalLink className="h-3 w-3" /></a>}</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-dashed border-amber-900/20 py-5 text-center text-[11px] text-stone-500">RoleCraft AI does not guarantee employment, interviews, introductions, or referrals.</footer>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; wide?: boolean }) {
  return <label className={`space-y-1.5 text-xs font-bold ${wide ? 'md:col-span-2' : ''}`}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#d6c0a7] bg-[#fffaf3] p-3 font-normal outline-none focus:border-amber-700" placeholder={placeholder} /></label>;
}

function TextArea({ label, value, onChange, rows, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows: number; placeholder: string }) {
  return <label className="space-y-1.5 text-xs font-bold">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="w-full rounded-xl border border-[#d6c0a7] bg-[#fffaf3] p-3 font-normal outline-none focus:border-amber-700" placeholder={placeholder} /></label>;
}

function ReportList({ title, items, icon, tone }: { title: string; items: string[]; icon: React.ReactNode; tone: 'emerald' | 'amber' | 'rose' }) {
  const classes = tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-800';
  return <div className={`rounded-xl border p-4 ${classes}`}><h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider">{icon} {title}</h3><ul className="space-y-2 text-xs leading-5">{items.map((item) => <li key={item}>• {item}</li>)}</ul></div>;
}
