'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  Mic2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
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

type ScoutTelemetry = {
  run_id: string;
  duration_ms: number;
  roles_returned: number;
  unique_employers: number;
  sources_observed: number;
  direct_sources_observed: number;
  fallback_sources_observed: number;
  direct_roles: number;
  fallback_roles: number;
  direct_share_percent: number;
  source_error_count: number;
  source_health: 'healthy' | 'degraded' | 'no_results';
  fallback_recommended: boolean;
  fallback_reasons: string[];
  coverage_confidence: string;
  coverage_note: string;
  configured_lane_roles?: number;
  expanded_lane_roles?: number;
};

type ScoutResult = {
  jobs: Job[];
  total: number;
  sources: string[];
  direct_count: number;
  fallback_count: number;
  partial?: boolean;
  source_errors?: string[];
  search_strategy?: string;
  telemetry: ScoutTelemetry;
  expanded_discovery?: {
    available?: boolean;
    jobs_before_merge?: number;
    passes_completed?: string[];
    passes_failed?: string[];
  };
};

type ExpansionResult = {
  jobs?: Job[];
  total?: number;
  partial?: boolean;
  status?: string;
  duration_ms?: number;
  passes_completed?: string[];
  passes_failed?: string[];
  coverage_note?: string;
};

const panelClass = 'rounded-[1.75rem] border border-[var(--surface-border)] bg-[var(--surface)] shadow-[var(--shadow-xl)]';
const inputClass = 'w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]';

function jobDescription(job: Job) {
  return [
    `${job.title} at ${job.company}`,
    job.location ? `Location: ${job.location}` : '',
    job.description || '',
    job.skills?.length ? `Role signals: ${job.skills.join(', ')}` : '',
  ].filter(Boolean).join('\n\n');
}

function companyInitials(company: string) {
  return company.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CO';
}

function healthTone(health: ScoutTelemetry['source_health']) {
  if (health === 'healthy') return 'border-emerald-300 bg-emerald-50 text-emerald-900';
  if (health === 'degraded') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-slate-300 bg-slate-50 text-slate-800';
}

function healthLabel(health: ScoutTelemetry['source_health']) {
  if (health === 'healthy') return 'Discovery healthy';
  if (health === 'degraded') return 'Discovery partially degraded';
  return 'No results observed';
}

function coverageLabel(value: string) {
  if (value === 'expanded') return 'Expanded';
  if (value === 'expanded_partial') return 'Expanded · partial';
  if (value === 'configured_sources_only') return 'Configured sources';
  return value ? value.replace(/_/g, ' ') : 'Not measured';
}

function normalize(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(limited|ltd|plc|incorporated|inc|llc|corp|corporation)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalJobUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(utm_|gad_|gclid|gbraid|wbraid|source|src|ref)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return '';
  }
}

function jobIdentity(job: Job) {
  const url = canonicalJobUrl(job.link);
  if (url) return `url::${url}`;
  return `job::${normalize(job.company)}::${normalize(job.title)}::${normalize(job.location).replace(/\b(remote|hybrid|united kingdom|uk)\b/g, '').trim()}`;
}

function semanticIdentity(job: Job) {
  return `${normalize(job.company)}::${normalize(job.title)}::${normalize(job.location).replace(/\b(remote|hybrid|united kingdom|uk)\b/g, '').trim()}`;
}

function mergeJobs(baseJobs: Job[], expandedJobs: Job[]) {
  const exact = new Map<string, Job>();
  const semantic = new Map<string, string>();

  for (const job of [...baseJobs, ...expandedJobs]) {
    const key = jobIdentity(job);
    const semanticKey = semanticIdentity(job);
    const existingExact = exact.get(key);
    if (existingExact) {
      if (job.direct && !existingExact.direct) exact.set(key, job);
      continue;
    }

    const priorKey = semanticKey ? semantic.get(semanticKey) : undefined;
    if (priorKey) {
      const prior = exact.get(priorKey);
      if (prior && job.direct && !prior.direct) {
        exact.delete(priorKey);
        exact.set(key, job);
        semantic.set(semanticKey, key);
      }
      continue;
    }

    exact.set(key, job);
    if (semanticKey) semantic.set(semanticKey, key);
  }

  return Array.from(exact.values()).slice(0, 120);
}

function mergeExpandedResult(base: ScoutResult, expansion: ExpansionResult): ScoutResult {
  const expandedJobs = Array.isArray(expansion.jobs) ? expansion.jobs : [];
  const jobs = mergeJobs(base.jobs, expandedJobs);
  const directJobs = jobs.filter((job) => job.direct);
  const fallbackJobs = jobs.filter((job) => !job.direct);
  const employers = Array.from(new Set(jobs.map((job) => normalize(job.company)).filter(Boolean)));
  const sources = Array.from(new Set(jobs.map((job) => job.source).filter(Boolean)));
  const directSources = Array.from(new Set(directJobs.map((job) => job.source).filter(Boolean)));
  const fallbackSources = Array.from(new Set(fallbackJobs.map((job) => job.source).filter(Boolean)));
  const expandedPartial = Boolean(expansion.partial);
  const coverageConfidence = expandedJobs.length
    ? (expandedPartial ? 'expanded_partial' : 'expanded')
    : base.telemetry.coverage_confidence;
  const fallbackReasons = [
    ...(!jobs.length ? ['No jobs were returned after the available discovery stages.'] : []),
    ...(expandedPartial ? ['Expanded employer/ATS discovery was incomplete in this run.'] : []),
    ...(jobs.length > 0 && directJobs.length === 0 ? ['No direct employer/ATS vacancies were returned.'] : []),
    ...(jobs.length > 0 && employers.length <= 1 ? ['Employer diversity remains unusually narrow.'] : []),
  ];

  return {
    ...base,
    jobs,
    total: jobs.length,
    sources,
    direct_count: directJobs.length,
    fallback_count: fallbackJobs.length,
    partial: Boolean(base.partial) || expandedPartial,
    source_errors: [
      ...(base.source_errors || []),
      ...(expandedPartial ? ['Expanded discovery was incomplete; configured-source results were preserved.'] : []),
    ],
    expanded_discovery: {
      available: expansion.status === 'completed',
      jobs_before_merge: expandedJobs.length,
      passes_completed: expansion.passes_completed || [],
      passes_failed: expansion.passes_failed || [],
    },
    telemetry: {
      ...base.telemetry,
      duration_ms: base.telemetry.duration_ms + Number(expansion.duration_ms || 0),
      roles_returned: jobs.length,
      unique_employers: employers.length,
      sources_observed: sources.length,
      direct_sources_observed: directSources.length,
      fallback_sources_observed: fallbackSources.length,
      direct_roles: directJobs.length,
      fallback_roles: fallbackJobs.length,
      direct_share_percent: jobs.length ? Math.round((directJobs.length / jobs.length) * 100) : 0,
      source_error_count: base.telemetry.source_error_count + (expandedPartial ? 1 : 0),
      source_health: !jobs.length ? 'no_results' : (Boolean(base.partial) || expandedPartial) ? 'degraded' : 'healthy',
      fallback_recommended: fallbackReasons.length > 0,
      fallback_reasons: fallbackReasons,
      coverage_confidence: coverageConfidence,
      coverage_note: expansion.coverage_note || base.telemetry.coverage_note,
      configured_lane_roles: base.telemetry.configured_lane_roles ?? base.jobs.length,
      expanded_lane_roles: expandedJobs.length,
    },
  };
}

export default function CareerCopilotClient() {
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('UK');
  const [postedDays, setPostedDays] = useState('14');
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState('');
  const [expansionNote, setExpansionNote] = useState('');
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [visibleCount, setVisibleCount] = useState(24);

  const searchJobs = async () => {
    if (!role.trim()) {
      setError('Tell Job Scout the role, skill or company you want to explore.');
      return;
    }

    setLoading(true);
    setExpanding(false);
    setError('');
    setExpansionNote('');
    setResult(null);
    setVisibleCount(24);

    const params = new URLSearchParams();
    params.set('q', role.trim());
    if (location.trim()) params.set('location', location.trim());
    if (postedDays) params.set('days', postedDays);

    try {
      const response = await fetch(`/api/jobs/scout?${params.toString()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || `Job Scout failed (${response.status}).`);

      setResult(data as ScoutResult);
      setLoading(false);
      window.setTimeout(() => document.getElementById('job-scout-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

      setExpanding(true);
      try {
        const expandedResponse = await fetch(`/api/jobs/scout-expand?${params.toString()}`, { cache: 'no-store' });
        const expandedData = (await expandedResponse.json().catch(() => null)) as ExpansionResult | null;
        if (!expandedResponse.ok || !expandedData) {
          setExpansionNote('Expanded employer/ATS discovery is temporarily unavailable. Showing configured-source results.');
        } else {
          setResult((current) => current ? mergeExpandedResult(current, expandedData) : current);
          if (!expandedData.jobs?.length) {
            setExpansionNote(expandedData.coverage_note || 'No additional roles were added by the expanded discovery pass.');
          }
        }
      } catch {
        setExpansionNote('Expanded employer/ATS discovery timed out. Configured-source results remain available.');
      } finally {
        setExpanding(false);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Job Scout could not complete this search.');
    } finally {
      setLoading(false);
    }
  };

  const analyseFit = (job: Job) => {
    window.sessionStorage.setItem('cognitwist-job-intelligence-prefill', JSON.stringify({
      targetRole: job.title,
      location: job.location || 'UK',
      jobDescription: jobDescription(job),
    }));
    window.location.href = '/job-intelligence';
  };

  const tailorCv = (job: Job) => {
    window.sessionStorage.setItem('cognitwist-career-studio-context', JSON.stringify({
      targetRole: job.title,
      jobDescription: jobDescription(job),
    }));
    window.location.href = '/studio';
  };

  const startInterview = (job: Job) => {
    window.sessionStorage.setItem('cognitwist-live-interview-context', JSON.stringify({
      role: job.title,
      jobDescription: jobDescription(job),
      interviewType: 'behavioural',
    }));
    window.location.href = `/live-interview?role=${encodeURIComponent(job.title)}&type=behavioural`;
  };

  const agents = [
    ['Career Copilot', 'Coordinates the next best action across opportunity, CV and interview workflows.', 'Ready', Bot],
    ['Job Scout', 'Returns configured-source results first, then expands employer/ATS coverage without blocking the search.', loading || expanding ? 'Working' : result ? 'Completed' : 'Ready', Search],
    ['CV Strategist', 'Turns a selected vacancy into evidence-grounded CV changes for approval.', 'Available', FileText],
    ['Interview Coach', 'Carries the same vacancy context into role-specific interview practice.', 'Available', Mic2],
  ] as const;

  const displayedJobs = result?.jobs.slice(0, visibleCount) || [];

  return (
    <main className="min-h-screen px-3 pb-32 pt-6 text-[var(--foreground)] md:px-8 md:pb-12 md:pt-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2.35rem] border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)] md:p-10">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[var(--accent-soft)] blur-3xl" />
          <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--accent-soft)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><Sparkles className="h-3.5 w-3.5" /> CogniTwist Career Copilot</div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Your AI career team, in one workspace.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">Discover the opportunity market broadly, then carry the same verified role context through fit analysis, evidence-preserving CV tailoring and interview preparation.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => document.getElementById('job-scout')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--highlight))] px-5 text-sm font-black text-white shadow-[var(--shadow-xl)]"><Search className="h-4 w-4" /> Start Job Scout</button>
                <Link href="/studio" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] px-5 text-sm font-black"><FileText className="h-4 w-4" /> Open Career Studio</Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                ['Fast first results', 'Configured-source jobs appear without waiting for slower AI discovery.'],
                ['Progressive coverage', 'Employer and ATS discovery expands the result set in a second pass.'],
                ['Human-controlled actions', 'CogniTwist does not auto-apply or disclose your identity.'],
              ].map(([title, detail], index) => (
                <div key={title} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><div className="flex items-start gap-3">{index === 0 ? <Target className="mt-0.5 h-4 w-4 text-[var(--accent-strong)]" /> : <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--accent-strong)]" />}<div><p className="text-xs font-black">{title}</p><p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)]">{detail}</p></div></div></div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Career agent team">
          {agents.map(([name, detail, status, Icon]) => (
            <article key={name} className={`${panelClass} p-5`}>
              <div className="flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon className={`h-5 w-5 ${status === 'Working' ? 'animate-pulse' : ''}`} /></div><span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[var(--ink-soft)]">{status}</span></div>
              <h2 className="mt-4 text-base font-black">{name}</h2><p className="mt-2 text-xs leading-6 text-[var(--ink-soft)]">{detail}</p>
            </article>
          ))}
        </section>

        <section id="job-scout" className={`${panelClass} scroll-mt-28 overflow-hidden`}>
          <div className="border-b border-[var(--surface-border)] p-5 md:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]"><Activity className="h-3.5 w-3.5" /> Job Scout</div><h2 className="mt-2 text-2xl font-black md:text-3xl">Search broadly without waiting on one long request.</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--ink-soft)]">Job Scout returns the configured ATS/feed market first, then expands direct employer and ATS coverage in a separate non-blocking pass. A slow expansion can no longer fail the whole search.</p></div><Link href="/jobs" className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-3 text-xs font-black">Advanced search <ArrowRight className="h-4 w-4" /></Link></div></div>
          <div className="p-5 md:p-7">
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.65fr_0.45fr_auto] lg:items-end">
              <label className="text-xs font-black">Role, skill or company<input className={`${inputClass} mt-2`} value={role} onChange={(event) => setRole(event.target.value)} placeholder="e.g. Senior Technical Project Manager" /></label>
              <label className="text-xs font-black">Location<input className={`${inputClass} mt-2`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="UK / London / Remote" /></label>
              <label className="text-xs font-black">Freshness<select className={`${inputClass} mt-2`} value={postedDays} onChange={(event) => setPostedDays(event.target.value)}><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option><option value="0">Any date</option></select></label>
              <button type="button" onClick={searchJobs} disabled={loading || expanding} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 text-sm font-black text-white disabled:opacity-55">{loading || expanding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{loading ? 'Finding roles…' : expanding ? 'Expanding market…' : 'Run Job Scout'}</button>
            </div>
            {loading && <div className="mt-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs leading-6"><span className="font-black">Job Scout is checking fast sources.</span> These results return first; expanded discovery will continue separately.</div>}
            {error && <div role="alert" className="mt-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
          </div>
        </section>

        {result && (
          <section id="job-scout-results" className="scroll-mt-28 space-y-5">
            {expanding ? <div className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--accent-soft)] p-4 text-xs"><RefreshCw className="h-4 w-4 animate-spin text-[var(--accent-strong)]" /><div><span className="font-black">Configured-source results are ready.</span> Expanding direct employer and ATS coverage now; new roles will merge into this list automatically.</div></div> : null}
            {!expanding && expansionNote ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-950">{expansionNote}</div> : null}

            <div className={`${panelClass} p-5 md:p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent-strong)]">Job Scout receipt · {result.telemetry.run_id.slice(0, 8)}</p><h2 className="mt-2 text-2xl font-black">{result.total} distinct roles discovered.</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--ink-soft)]">{result.telemetry.coverage_note}</p></div><span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${healthTone(result.telemetry.source_health)}`}>{healthLabel(result.telemetry.source_health)}</span></div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  ['Roles', String(result.telemetry.roles_returned), BriefcaseBusiness],
                  ['Employers', String(result.telemetry.unique_employers), UsersRound],
                  ['Configured lane', String(result.telemetry.configured_lane_roles ?? 0), Activity],
                  ['Expanded lane', expanding ? 'Working…' : String(result.telemetry.expanded_lane_roles ?? 0), Sparkles],
                  ['Run time', `${Math.max(1, Math.round(result.telemetry.duration_ms / 100) / 10)}s`, Clock3],
                  ['Coverage', expanding ? 'Expanding' : coverageLabel(result.telemetry.coverage_confidence), Target],
                ].map(([label, value, MetricIcon]) => {
                  const Icon = MetricIcon as typeof Activity;
                  return <div key={String(label)} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-4"><Icon className="h-4 w-4 text-[var(--accent-strong)]" /><p className="mt-3 text-[9px] font-black uppercase tracking-wide text-[var(--ink-soft)]">{String(label)}</p><p className="mt-1 text-lg font-black">{String(value)}</p></div>;
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">{result.sources.map((source) => <span key={source} className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-strong)] px-3 py-1.5 text-[9px] font-black">{source}</span>)}</div>

              {!expanding && result.telemetry.fallback_recommended ? <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black">Coverage still needs another pass</p><ul className="mt-2 space-y-1 text-[11px] leading-5">{result.telemetry.fallback_reasons.map((reason) => <li key={reason}>• {reason}</li>)}</ul></div></div></div> : null}
              {!expanding && !result.telemetry.fallback_recommended ? <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-950"><CheckCircle2 className="h-4 w-4" /> No anomaly trigger fired for this discovery run.</div> : null}
              {result.source_errors?.length ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">{result.source_errors.join(' ')}</div> : null}
            </div>

            {result.jobs.length ? (
              <>
                <div className="flex items-center justify-between gap-3 px-1 text-xs text-[var(--ink-soft)]"><span>Showing {displayedJobs.length} of {result.jobs.length} discovered roles</span><span>Duplicates removed before display</span></div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {displayedJobs.map((job) => (
                    <article key={`${job.company}-${job.title}-${job.link}`} className={`${panelClass} overflow-hidden`}>
                      <div className="p-5 md:p-6"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] text-xs font-black text-[var(--accent-strong)]">{companyInitials(job.company)}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-black uppercase tracking-wide text-[var(--accent-strong)]">{job.company}</p><h3 className="mt-1 text-lg font-black leading-snug">{job.title}</h3><p className="mt-2 flex items-center gap-1 text-[11px] text-[var(--ink-soft)]"><MapPin className="h-3.5 w-3.5" /> {job.location || 'Location not stated'} {job.posted ? `· ${job.posted}` : ''}</p></div></div><div className="mt-4 flex flex-wrap gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${job.direct ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-[var(--surface-border)] bg-[var(--surface-strong)]'}`}>{job.source}</span>{job.remote ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[9px] font-black text-sky-900">Remote</span> : null}<span className="rounded-full border border-[var(--surface-border)] px-2.5 py-1 text-[9px] font-black">{job.salary || 'Not disclosed'}</span></div><p className="mt-4 line-clamp-4 text-xs leading-6 text-[var(--ink-soft)]">{job.description || 'Open the source vacancy for the full role description.'}</p>{job.skills?.length ? <div className="mt-4 flex flex-wrap gap-1.5">{job.skills.slice(0, 6).map((skill) => <span key={skill} className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-bold text-[var(--accent-strong)]">{skill}</span>)}</div> : null}</div>
                      <div className="grid grid-cols-2 gap-2 border-t border-[var(--surface-border)] bg-[var(--surface-strong)] p-3 sm:grid-cols-4"><button type="button" onClick={() => analyseFit(job)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-2 text-[10px] font-black text-white"><Target className="h-3.5 w-3.5" /> Analyse</button><button type="button" onClick={() => tailorCv(job)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2 text-[10px] font-black"><FileText className="h-3.5 w-3.5" /> Tailor CV</button><button type="button" onClick={() => startInterview(job)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2 text-[10px] font-black"><Mic2 className="h-3.5 w-3.5" /> Practise</button><a href={job.link} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-2 text-[10px] font-black"><ExternalLink className="h-3.5 w-3.5" /> Apply</a></div>
                    </article>
                  ))}
                </div>
                {visibleCount < result.jobs.length ? <div className="flex justify-center"><button type="button" onClick={() => setVisibleCount((count) => Math.min(result.jobs.length, count + 24))} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-6 text-sm font-black shadow-[var(--shadow-lg)]">Show 24 more <ArrowRight className="h-4 w-4" /></button></div> : null}
              </>
            ) : <div className={`${panelClass} p-8 text-center`}><BriefcaseBusiness className="mx-auto h-8 w-8 text-[var(--ink-soft)]" /><h3 className="mt-3 font-black">No roles returned from the configured sources yet.</h3><p className="mt-2 text-xs text-[var(--ink-soft)]">Expanded discovery will still run separately; a zero-result configured pass is not treated as proof that no vacancies exist.</p></div>}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-4 text-xs"><div className="flex items-center gap-2 text-[var(--ink-soft)]"><CheckCircle2 className="h-4 w-4 text-[var(--accent-strong)]" /> Continue from any discovered opportunity without rebuilding context.</div><Link href="/jobs" className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-2 font-black">View full Job Search <ArrowRight className="h-4 w-4" /></Link></div>
          </section>
        )}
      </div>
    </main>
  );
}
