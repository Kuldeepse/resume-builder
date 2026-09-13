'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  Mic2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

type Job = {
  title: string;
  company: string;
  location: string;
  salary: string;
  posted: string;
  description: string;
  skills: string[];
  link: string;
  remote: boolean;
  source: string;
  direct: boolean;
};

type BrowseResult = {
  jobs: Job[];
  total: number;
  sources: string[];
  direct_count: number;
  fallback_count: number;
  partial?: boolean;
  source_errors?: string[];
  search_strategy?: string;
};

const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';
const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';

function jobDescription(job: Job) {
  return [
    `${job.title} at ${job.company}`,
    job.location ? `Location: ${job.location}` : '',
    job.description || '',
    job.skills?.length ? `Role signals: ${job.skills.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function companyInitials(company: string) {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CO';
}

export default function CareerCopilotPage() {
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('UK');
  const [postedDays, setPostedDays] = useState('14');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BrowseResult | null>(null);

  const directShare = useMemo(() => {
    if (!result) return 0;
    const totalInventory = result.direct_count + result.fallback_count;
    return totalInventory ? Math.round((result.direct_count / totalInventory) * 100) : 0;
  }, [result]);

  const searchJobs = async () => {
    if (!role.trim()) {
      setError('Tell Job Scout the role, skill or company you want to explore.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams();
      params.set('q', role.trim());
      if (location.trim()) params.set('location', location.trim());
      if (postedDays) params.set('days', postedDays);

      const response = await fetch(`/api/jobs/browse?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || `Job Scout failed (${response.status}).`);
      setResult(data as BrowseResult);
      window.setTimeout(() => document.getElementById('job-scout-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Job Scout could not complete this search.');
    } finally {
      setLoading(false);
    }
  };

  const analyseFit = (job: Job) => {
    window.sessionStorage.setItem(
      'cognitwist-job-intelligence-prefill',
      JSON.stringify({
        targetRole: job.title,
        location: job.location || 'UK',
        jobDescription: jobDescription(job),
      }),
    );
    window.location.href = '/job-intelligence';
  };

  const tailorCv = (job: Job) => {
    window.sessionStorage.setItem(
      'cognitwist-career-studio-context',
      JSON.stringify({ targetRole: job.title, jobDescription: jobDescription(job) }),
    );
    window.location.href = '/studio';
  };

  const startInterview = (job: Job) => {
    window.sessionStorage.setItem(
      'cognitwist-live-interview-context',
      JSON.stringify({ role: job.title, jobDescription: jobDescription(job), interviewType: 'behavioural' }),
    );
    window.location.href = `/live-interview?role=${encodeURIComponent(job.title)}&type=behavioural`;
  };

  const agentCards = [
    {
      name: 'Career Copilot',
      role: 'Orchestrates the next best action across jobs, CV and interview preparation.',
      state: 'Ready',
      icon: Bot,
    },
    {
      name: 'Job Scout',
      role: 'Searches the market first, preferring direct employer and ATS sources.',
      state: loading ? 'Working' : result ? 'Completed' : 'Ready',
      icon: Search,
    },
    {
      name: 'CV Strategist',
      role: 'Turns a selected role into evidence-grounded CV changes for human approval.',
      state: 'Available',
      icon: FileText,
    },
    {
      name: 'Interview Coach',
      role: 'Moves a selected role directly into focused behavioural or technical practice.',
      state: 'Available',
      icon: Mic2,
    },
  ];

  return (
    <main className="min-h-screen px-3 pb-32 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.35rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--highlight)_16%,transparent)] blur-3xl" />

          <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">
                <Sparkles className="h-3.5 w-3.5" /> CogniTwist Career Copilot · V3 foundation
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Your AI career team, in one workspace.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
                Start with the opportunity market, then move the same role through fit analysis, evidence-preserving CV tailoring and interview preparation without rebuilding the context every time.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => document.getElementById('job-scout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)]"
                >
                  <Search className="h-4 w-4" /> Start Job Scout
                </button>
                <Link href="/studio" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-5 text-sm font-black">
                  <FileText className="h-4 w-4" /> Open Career Studio
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                ['Market-first discovery', 'Personal fit does not decide which roles get discovered.'],
                ['Evidence guardrails', 'Unsupported claims are not silently added to your CV.'],
                ['Human-controlled actions', 'CogniTwist does not auto-apply or reveal your identity.'],
              ].map(([title, detail], index) => (
                <div key={title} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                  <div className="flex items-start gap-3">
                    {index === 0 ? <Target className="mt-0.5 h-4 w-4 text-[var(--accent-strong)]" /> : <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--accent-strong)]" />}
                    <div>
                      <p className="text-xs font-black">{title}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)]">{detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Career agent team">
          {agentCards.map((agent) => {
            const Icon = agent.icon;
            const working = agent.state === 'Working';
            return (
              <article key={agent.name} className={`${panelClass} p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon className={`h-5 w-5 ${working ? 'animate-pulse' : ''}`} /></div>
                  <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[var(--ink-soft)]">{agent.state}</span>
                </div>
                <h2 className="mt-4 text-base font-black">{agent.name}</h2>
                <p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{agent.role}</p>
              </article>
            );
          })}
        </section>

        <section id="job-scout" className={`${panelClass} scroll-mt-28 overflow-hidden`}>
          <div className="border-b border-[var(--surface-border)] p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><Activity className="h-3.5 w-3.5" /> Job Scout</div>
                <h2 className="mt-2 text-2xl font-black md:text-3xl">Tell the team what opportunity to explore.</h2>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--ink-soft)]">This first V3 slice uses CogniTwist's existing direct ATS/employer and fallback-source discovery. A CV is deliberately not required at this stage.</p>
              </div>
              <Link href="/jobs" className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">Advanced search <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>

          <div className="p-5 md:p-7">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.65fr_0.45fr_auto] lg:items-end">
              <label className="text-xs font-black">Role, skill or company
                <input className={`${inputClass} mt-2`} value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Senior Technical Project Manager" />
              </label>
              <label className="text-xs font-black">Location
                <input className={`${inputClass} mt-2`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="UK / London / Remote" />
              </label>
              <label className="text-xs font-black">Freshness
                <select className={`${inputClass} mt-2`} value={postedDays} onChange={(event) => setPostedDays(event.target.value)}>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="0">Any date</option>
                </select>
              </label>
              <button type="button" onClick={searchJobs} disabled={loading} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 text-sm font-black text-white disabled:opacity-55">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Scout working…' : 'Run Job Scout'}
              </button>
            </div>

            {loading && (
              <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6 text-[var(--foreground)]">
                <span className="font-black">Job Scout is working.</span> Querying direct ATS/employer sources and configured fallback sources, then deduplicating and ranking the returned market set.
              </div>
            )}
            {error && <div role="alert" className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
          </div>
        </section>

        {result && (
          <section id="job-scout-results" className="scroll-mt-28 space-y-5">
            <div className={`${panelClass} p-5 md:p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Job Scout receipt</p>
                  <h2 className="mt-2 text-2xl font-black">Discovery run completed.</h2>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--ink-soft)]">These are observed search results, not a claim that the entire market has been covered. Full false-negative coverage scoring is the next P0 backend slice.</p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${result.partial ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}>
                  {result.partial ? 'Partial source availability' : 'Configured sources responded'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  ['Roles returned', String(result.total)],
                  ['Sources observed', String(result.sources.length)],
                  ['Direct inventory', String(result.direct_count)],
                  ['Direct share', `${directShare}%`],
                  ['Coverage confidence', 'Not measured'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4">
                    <p className="text-[9px] font-black uppercase tracking-wide text-[var(--ink-soft)]">{label}</p>
                    <p className="mt-2 text-xl font-black">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {result.sources.slice(0, 12).map((source) => <span key={source} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5 text-[9px] font-black">{source}</span>)}
              </div>

              {result.partial && result.source_errors?.length ? (
                <details className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  <summary className="cursor-pointer font-black">Source issues detected</summary>
                  <ul className="mt-2 space-y-1 pl-5">
                    {result.source_errors.map((item) => <li key={item} className="list-disc">{item}</li>)}
                  </ul>
                </details>
              ) : null}
            </div>

            {result.jobs.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {result.jobs.slice(0, 12).map((job) => (
                  <article key={`${job.company}-${job.title}-${job.link}`} className={`${panelClass} overflow-hidden`}>
                    <div className="p-5 md:p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] text-xs font-black text-[var(--accent-strong)]">{companyInitials(job.company)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{job.company}</p>
                          <h3 className="mt-1 text-lg font-black leading-snug">{job.title}</h3>
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--ink-soft)]"><MapPin className="h-3.5 w-3.5" /> {job.location || 'Location not stated'} {job.posted ? `· ${job.posted}` : ''}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${job.direct ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}>{job.source}</span>
                        {job.remote ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-black text-sky-900">Remote</span> : null}
                        <span className="rounded-full border border-[var(--surface-border)] px-2.5 py-1 text-[9px] font-black">{job.salary || 'Not disclosed'}</span>
                      </div>

                      <p className="mt-4 line-clamp-4 text-xs leading-6 text-[var(--ink-soft)]">{job.description || 'Open the source vacancy for the full role description.'}</p>

                      {job.skills?.length ? <div className="mt-4 flex flex-wrap gap-1.5">{job.skills.slice(0, 6).map((skill) => <span key={skill} className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-bold text-[var(--accent-strong)]">{skill}</span>)}</div> : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-[var(--surface-border)] bg-[var(--surface-strong)] p-3 sm:grid-cols-4">
                      <button type="button" onClick={() => analyseFit(job)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-2 text-[10px] font-black text-white"><Target className="h-3.5 w-3.5" /> Analyse</button>
                      <button type="button" onClick={() => tailorCv(job)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2 text-[10px] font-black"><FileText className="h-3.5 w-3.5" /> Tailor CV</button>
                      <button type="button" onClick={() => startInterview(job)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2 text-[10px] font-black"><Mic2 className="h-3.5 w-3.5" /> Practise</button>
                      <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2 text-[10px] font-black"><ExternalLink className="h-3.5 w-3.5" /> Apply</a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={`${panelClass} p-8 text-center`}>
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-[var(--ink-soft)]" />
                <h3 className="mt-3 font-black">No roles returned from this search.</h3>
                <p className="mt-2 text-xs text-[var(--ink-soft)]">That is not the same as confirming that no vacancies exist. Broaden the role/location while the full coverage engine is being added.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 text-xs">
              <div className="flex items-center gap-2 text-[var(--ink-soft)]"><CheckCircle2 className="h-4 w-4 text-[var(--accent-strong)]" /> Continue from the selected opportunity without rebuilding the job context.</div>
              <Link href="/jobs" className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-2 font-black">View full Job Search <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
