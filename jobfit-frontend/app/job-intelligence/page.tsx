'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileText,
  MapPin,
  Mic2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { parseLegacyScoutPrefill } from '../../lib/job-intelligence-core.mjs';

type Vacancy = {
  title: string;
  company: string;
  location: string;
  salary?: string;
  posted?: string;
  description: string;
  skills: string[];
  link?: string;
  remote?: boolean;
  source?: string;
  direct?: boolean;
  handoff_version?: string;
};

type EvidenceStatus = 'confirmed' | 'partial' | 'gap' | 'unknown';
type EvidenceItem = {
  requirement: string;
  category: 'must_have' | 'preferred' | 'responsibility' | 'signal';
  source: string;
  status: EvidenceStatus;
  candidate_evidence: string[];
  rationale: string;
  overlap_terms: string[];
};

type Dimension = {
  key: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
};

type IntelligenceResult = {
  engine: string;
  vacancy: Vacancy;
  vacancy_confidence: {
    score: number;
    level: 'high' | 'medium' | 'low';
    valid_url: boolean;
    freshness: 'fresh' | 'aging' | 'stale' | 'unknown';
    notes: string[];
  };
  assessment: {
    overall_fit: number;
    fit_label: string;
    recommendation: 'Apply' | 'Apply after tailoring' | 'Review carefully';
    confidence: 'high' | 'medium' | 'low';
    dimensions: Dimension[];
    evidence: EvidenceItem[];
    strengths: string[];
    partials: string[];
    gaps: string[];
    unknowns: string[];
    summary: string;
  };
  safeguards: {
    exact_selected_vacancy: boolean;
    independent_market_search: boolean;
    freshness_excluded_from_candidate_fit: boolean;
    unknown_kept_separate_from_gap: boolean;
  };
};

const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';
const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';

function safeVacancy(raw: unknown): Vacancy | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<Vacancy>;
  if (!item.title || !item.description) return null;
  return {
    title: String(item.title).slice(0, 240),
    company: String(item.company || 'Selected employer').slice(0, 240),
    location: String(item.location || 'Location not confirmed').slice(0, 240),
    salary: String(item.salary || '').slice(0, 240),
    posted: String(item.posted || '').slice(0, 160),
    description: String(item.description).slice(0, 12000),
    skills: Array.isArray(item.skills) ? item.skills.map((value) => String(value).slice(0, 120)).filter(Boolean).slice(0, 20) : [],
    link: String(item.link || '').slice(0, 1600),
    remote: Boolean(item.remote),
    source: String(item.source || 'Job Scout verified selection').slice(0, 160),
    direct: Boolean(item.direct),
    handoff_version: String(item.handoff_version || 'v2').slice(0, 40),
  };
}

function readScoutVacancy(): Vacancy | null {
  try {
    const raw = window.sessionStorage.getItem('cognitwist-job-intelligence-prefill');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const current = safeVacancy(parsed?.vacancy);
    if (current) return current;
    return safeVacancy(parseLegacyScoutPrefill(parsed));
  } catch {
    return null;
  }
}

function downstreamJobDescription(vacancy: Vacancy) {
  return [
    `${vacancy.title} at ${vacancy.company}`,
    vacancy.location ? `Location: ${vacancy.location}` : '',
    vacancy.source ? `Source: ${vacancy.source}` : '',
    vacancy.description,
    vacancy.skills.length ? `Role signals: ${vacancy.skills.join(', ')}` : '',
  ].filter(Boolean).join('\n\n');
}

function evidenceTone(status: EvidenceStatus) {
  if (status === 'confirmed') return 'border-emerald-300 bg-emerald-50 text-emerald-950';
  if (status === 'partial') return 'border-amber-300 bg-amber-50 text-amber-950';
  if (status === 'gap') return 'border-rose-300 bg-rose-50 text-rose-950';
  return 'border-slate-300 bg-slate-50 text-slate-800';
}

function EvidenceIcon({ status }: { status: EvidenceStatus }) {
  if (status === 'confirmed') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'gap') return <XCircle className="h-4 w-4" />;
  if (status === 'partial') return <AlertTriangle className="h-4 w-4" />;
  return <CircleHelp className="h-4 w-4" />;
}

function confidenceTone(level: 'high' | 'medium' | 'low') {
  if (level === 'high') return 'border-emerald-300 bg-emerald-50 text-emerald-950';
  if (level === 'medium') return 'border-amber-300 bg-amber-50 text-amber-950';
  return 'border-slate-300 bg-slate-50 text-slate-800';
}

export default function JobIntelligencePage() {
  const [vacancy, setVacancy] = useState<Vacancy | null>(null);
  const [profileText, setProfileText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IntelligenceResult | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setVacancy(readScoutVacancy());
  }, []);

  const cancelAnalysis = () => controllerRef.current?.abort();

  const analyse = async () => {
    if (!vacancy) {
      setError('Select a vacancy in Job Scout before running Job Intelligence.');
      return;
    }
    if (!profileText.trim() && !resumeFile) {
      setError('Upload a DOCX CV or paste a career summary so CogniTwist can map evidence to this vacancy.');
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError('');
    setResult(null);

    const form = new FormData();
    form.append('vacancy_json', JSON.stringify(vacancy));
    form.append('resume_skills', profileText.trim());
    if (resumeFile) form.append('resume_file', resumeFile);

    try {
      const response = await fetch('/api/jobs/intelligence', { method: 'POST', body: form, signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || `Job Intelligence failed (${response.status}).`);
      setResult(data as IntelligenceResult);
      window.setTimeout(() => document.getElementById('intelligence-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') {
        setError('Analysis cancelled. Your selected vacancy and candidate evidence are still available.');
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Job Intelligence could not complete this analysis.');
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setLoading(false);
    }
  };

  const tailorCv = () => {
    if (!vacancy) return;
    window.sessionStorage.setItem('cognitwist-career-studio-context', JSON.stringify({
      targetRole: vacancy.title,
      jobDescription: downstreamJobDescription(vacancy),
      jobIntelligence: result ? {
        overallFit: result.assessment.overall_fit,
        recommendation: result.assessment.recommendation,
        strengths: result.assessment.strengths,
        gaps: result.assessment.gaps,
        partials: result.assessment.partials,
      } : undefined,
    }));
    window.location.href = '/studio';
  };

  const practiceInterview = () => {
    if (!vacancy) return;
    const candidateEvidence = result
      ? Array.from(new Set(
          result.assessment.evidence
            .filter((item) => item.status === 'confirmed' || item.status === 'partial')
            .flatMap((item) => item.candidate_evidence)
            .map((item) => item.trim())
            .filter(Boolean),
        )).slice(0, 30)
      : [];
    window.sessionStorage.setItem('cognitwist-live-interview-context', JSON.stringify({
      role: vacancy.title,
      company: vacancy.company,
      jobDescription: downstreamJobDescription(vacancy),
      interviewType: 'behavioural',
      candidateEvidence,
      jobIntelligence: result ? {
        overallFit: result.assessment.overall_fit,
        strengths: result.assessment.strengths,
        gaps: result.assessment.gaps,
        partials: result.assessment.partials,
      } : undefined,
    }));
    window.location.href = `/live-interview?role=${encodeURIComponent(vacancy.title)}&type=behavioural`;
  };

  return (
    <main className="min-h-screen px-3 pb-28 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.2rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><BriefcaseBusiness className="h-3.5 w-3.5" /> Job Intelligence</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Should you pursue this exact vacancy?</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Job Intelligence analyses the vacancy selected in Job Scout. It does not run another market search. Candidate fit is based on evidence; vacancy freshness and source confidence are shown separately.</p>
            </div>
            <Link href="/career" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black"><ArrowLeft className="h-4 w-4" /> Back to Job Scout</Link>
          </div>
        </section>

        {!vacancy ? (
          <section className={`${panelClass} p-6 md:p-9`}>
            <div className="mx-auto max-w-2xl text-center">
              <Target className="mx-auto h-10 w-10 text-[var(--accent-strong)]" />
              <h2 className="mt-4 text-2xl font-black">Select a vacancy first</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">Job Intelligence no longer performs a second independent job search. Choose a validated role in Job Scout and click <strong>Analyse</strong> so the exact vacancy context is carried here.</p>
              <Link href="/career" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-black text-white">Open Job Scout <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        ) : (
          <>
            <section className={`${panelClass} overflow-hidden`}>
              <div className="border-b border-[var(--surface-border)] p-5 md:p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Selected vacancy</p>
                    <h2 className="mt-2 text-2xl font-black md:text-3xl">{vacancy.title}</h2>
                    <p className="mt-1 text-sm font-bold text-[var(--ink-soft)]">{vacancy.company}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] px-3 py-1.5"><MapPin className="h-3.5 w-3.5" /> {vacancy.location}</span>
                      {vacancy.posted ? <span className="rounded-full border border-[var(--surface-border)] px-3 py-1.5">{vacancy.posted}</span> : null}
                      {vacancy.source ? <span className="rounded-full border border-[var(--surface-border)] px-3 py-1.5">{vacancy.source}</span> : null}
                      {vacancy.direct ? <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-950">Direct source</span> : null}
                    </div>
                  </div>
                  {vacancy.link ? <a href={vacancy.link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] px-4 text-xs font-black">Open vacancy <ExternalLink className="h-4 w-4" /></a> : null}
                </div>
              </div>
              <div className="p-5 md:p-7">
                <p className="text-xs leading-6 text-[var(--ink-soft)]">{vacancy.description}</p>
                {vacancy.skills.length ? <div className="mt-4 flex flex-wrap gap-2">{vacancy.skills.map((skill) => <span key={skill} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5 text-[10px] font-black">{skill}</span>)}</div> : null}
              </div>
            </section>

            <section className={`${panelClass} p-5 md:p-7`}>
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--accent-strong)]" /><div><h2 className="text-lg font-black">Candidate evidence</h2><p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">Upload a DOCX CV or paste a career summary. Job Intelligence maps only explicit evidence and keeps unknowns separate from gaps.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                  <input id="intelligence-cv" type="file" accept=".docx" className="hidden" onChange={(event) => setResumeFile(event.target.files?.[0] || null)} />
                  <label htmlFor="intelligence-cv" className="flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--surface-border)] px-4 text-center text-xs font-black hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"><Upload className="h-5 w-5 text-[var(--accent-strong)]" />{resumeFile ? resumeFile.name : 'Upload CV · DOCX · max 5 MB'}</label>
                </div>
                <label className="text-xs font-black">Or paste a career summary<textarea className={`${inputClass} mt-2 min-h-28 resize-y text-xs leading-6`} value={profileText} onChange={(event) => setProfileText(event.target.value)} placeholder="Titles, responsibilities, technologies, industries, certifications and measurable achievements…" /></label>
              </div>
              {error ? <div role="alert" className="mt-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-950"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div> : null}
              {loading ? <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs font-bold"><div className="flex items-center gap-3"><RefreshCw className="h-4 w-4 animate-spin text-[var(--accent-strong)]" />Mapping vacancy requirements to candidate evidence…</div><button type="button" onClick={cancelAnalysis} className="inline-flex items-center gap-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2.5 py-1.5 text-[10px] font-black"><X className="h-3.5 w-3.5" /> Cancel</button></div> : null}
              <button type="button" onClick={analyse} disabled={loading} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)] disabled:opacity-55">{loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{loading ? 'Analysing evidence…' : 'Analyse this vacancy'}</button>
            </section>
          </>
        )}

        {result ? (
          <section id="intelligence-result" className="scroll-mt-28 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className={`${panelClass} p-5`}><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Candidate fit</p><p className="mt-2 text-4xl font-black">{result.assessment.overall_fit}%</p><p className="mt-1 text-xs font-black text-[var(--accent-strong)]">{result.assessment.fit_label}</p></div>
              <div className={`${panelClass} p-5`}><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Recommendation</p><p className="mt-3 text-lg font-black">{result.assessment.recommendation}</p><p className="mt-2 text-xs leading-5 text-[var(--ink-soft)]">{result.assessment.summary}</p></div>
              <div className={`${panelClass} p-5`}><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Evidence confidence</p><span className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${confidenceTone(result.assessment.confidence)}`}>{result.assessment.confidence}</span><p className="mt-3 text-[11px] leading-5 text-[var(--ink-soft)]">Confidence reflects how much explicit candidate evidence was available, not model certainty.</p></div>
              <div className={`${panelClass} p-5`}><p className="text-[10px] font-black uppercase tracking-wide text-[var(--ink-soft)]">Vacancy confidence</p><p className="mt-2 text-3xl font-black">{result.vacancy_confidence.score}%</p><span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${confidenceTone(result.vacancy_confidence.level)}`}>{result.vacancy_confidence.level} · {result.vacancy_confidence.freshness}</span></div>
            </div>

            <section className={`${panelClass} p-5 md:p-7`}>
              <div className="flex items-start gap-3"><Target className="mt-0.5 h-5 w-5 text-[var(--accent-strong)]" /><div><h2 className="text-lg font-black">Fit dimensions</h2><p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">Posting age and source freshness are intentionally excluded from candidate fit.</p></div></div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{result.assessment.dimensions.map((dimension) => <div key={dimension.key} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black">{dimension.label}</p><span className="text-lg font-black">{dimension.score}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-border)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${dimension.score}%` }} /></div><p className="mt-3 text-[10px] leading-5 text-[var(--ink-soft)]">{dimension.detail}</p></div>)}</div>
            </section>

            <section className={`${panelClass} p-5 md:p-7`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">Requirement-by-requirement evidence</h2><p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">Confirmed, partial, gap and unknown are deliberately separate states.</p></div><span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5 text-[10px] font-black">{result.assessment.evidence.length} signals assessed</span></div>
              <div className="mt-5 space-y-3">{result.assessment.evidence.length ? result.assessment.evidence.map((item, index) => <article key={`${item.requirement}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-wide text-[var(--ink-soft)]">{item.category.replace(/_/g, ' ')}</p><h3 className="mt-1 text-sm font-black leading-6">{item.requirement}</h3></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black ${evidenceTone(item.status)}`}><EvidenceIcon status={item.status} /> {item.status}</span></div><p className="mt-3 text-[11px] leading-5 text-[var(--ink-soft)]">{item.rationale}</p>{item.candidate_evidence.length ? <div className="mt-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3"><p className="text-[9px] font-black uppercase tracking-wide text-[var(--accent-strong)]">Candidate evidence</p>{item.candidate_evidence.map((evidence) => <p key={evidence} className="mt-2 text-[11px] leading-5">“{evidence}”</p>)}</div> : null}</article>) : <p className="text-sm text-[var(--ink-soft)]">The vacancy description did not expose enough structured requirement signals for a reliable evidence matrix.</p>}</div>
            </section>

            {result.vacancy_confidence.notes.length ? <section className={`${panelClass} p-5 md:p-7`}><div className="flex items-start gap-3"><CircleHelp className="mt-0.5 h-5 w-5 text-[var(--accent-strong)]" /><div><h2 className="text-lg font-black">Vacancy-confidence notes</h2><ul className="mt-3 space-y-2 text-xs leading-6 text-[var(--ink-soft)]">{result.vacancy_confidence.notes.map((note) => <li key={note}>• {note}</li>)}</ul></div></div></section> : null}

            <section className={`${panelClass} p-5 md:p-7`}>
              <h2 className="text-lg font-black">Continue with the same vacancy context</h2>
              <p className="mt-1 text-xs leading-6 text-[var(--ink-soft)]">No second search is performed. The selected vacancy and evidence summary move into the next workflow.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <button type="button" onClick={tailorCv} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-xs font-black text-white"><FileText className="h-4 w-4" /> Tailor CV</button>
                <button type="button" onClick={practiceInterview} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black"><Mic2 className="h-4 w-4" /> Practise interview</button>
                {result.vacancy.link ? <a href={result.vacancy.link} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black">Open vacancy <ExternalLink className="h-4 w-4" /></a> : <Link href="/career" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black">Return to Job Scout <ArrowLeft className="h-4 w-4" /></Link>}
                <Link href="/career" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 text-xs font-black">Find another role <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </main>
  );
}
